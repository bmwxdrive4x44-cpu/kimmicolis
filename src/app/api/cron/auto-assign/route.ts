import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/cron/auto-assign
 * Endpoint cron déclenché par un scheduler externe (Vercel Cron, cron-job.org, etc.)
 *
 * Protégé par CRON_SECRET en-tête ou query param.
 * Schedule recommandé: 0 8 * * * (tous les jours à 8h), 0 18 * * * (18h)
 *
 * Exemple Vercel cron config (vercel.json):
 *   { "crons": [{ "path": "/api/cron/auto-assign?schedule=DAILY_8AM", "schedule": "0 7 * * *" }] }
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier le secret cron
    const { searchParams } = new URL(request.url);
    const secret = request.headers.get('x-cron-secret') || searchParams.get('secret');
    const scheduleFilter = searchParams.get('schedule') || null; // DAILY_8AM | DAILY_6PM | WEEKLY

    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && secret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Trouver tous les transporteurs avec auto-assign activé correspondant au schedule
    const transportersQuery: any = {
      autoAssignEnabled: true,
      user: {
        role: 'TRANSPORTER',
        isActive: true,
      },
    };

    if (scheduleFilter && scheduleFilter !== 'ALL') {
      transportersQuery.autoAssignSchedule = scheduleFilter;
    }

    const transporters = await db.transporterPreferences.findMany({
      where: transportersQuery,
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    if (transporters.length === 0) {
      return NextResponse.json({
        message: 'Aucun transporteur avec auto-assign pour ce schedule',
        schedule: scheduleFilter,
        ran: 0,
      });
    }

    const results: Array<{ transporterId: string; name: string; status: string; assigned: number }> = [];
    let totalAssigned = 0;
    let totalErrors = 0;

    for (const pref of transporters) {
      const transporterId = pref.userId;

      try {
        // Vérifier capacité actuelle
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [activeCount, todayCount] = await Promise.all([
          db.mission.count({
            where: { transporteurId: transporterId, status: { in: ['ASSIGNE', 'EN_COURS'] } },
          }),
          db.mission.count({
            where: {
              transporteurId: transporterId,
              assignedAt: { gte: today, lt: tomorrow },
            },
          }),
        ]);

        const availableParallel = Math.max(pref.maxActiveParallel - activeCount, 0);
        const availableToday = Math.max(pref.maxDailyMissions - todayCount, 0);
        const slotsAvailable = Math.min(availableParallel, availableToday);

        if (slotsAvailable <= 0) {
          results.push({ transporterId, name: pref.user.name, status: 'AT_CAPACITY', assigned: 0 });
          continue;
        }

        // Chercher colis éligibles
        const unassignedColis = await db.colis.findMany({
          where: {
            status: { in: ['PAID_RELAY', 'DEPOSITED_RELAY', 'READY_FOR_DEPOSIT', 'WAITING_PICKUP'] },
            missions: {
              none: { status: { in: ['ASSIGNE', 'EN_COURS', 'LIVRE'] } },
            },
            ...(pref.maxWeightKg ? { weight: { lte: pref.maxWeightKg } } : {}),
          },
          select: { id: true, villeDepart: true, villeArrivee: true, weight: true, isPriority: true },
          take: slotsAvailable,
        });

        let assigned = 0;
        for (const colis of unassignedColis) {
          // Respecter préférences priorité
          if (colis.isPriority && !pref.acceptsPriority) continue;

          // Vérifier ville exclue
          if (pref.excludedCities) {
            try {
              const excluded: string[] = JSON.parse(pref.excludedCities);
              const normalize = (s: string) => s.trim().toLowerCase();
              if (
                excluded.some(c => normalize(c) === normalize(colis.villeDepart)) ||
                excluded.some(c => normalize(c) === normalize(colis.villeArrivee))
              ) continue;
            } catch {}
          }

          try {
            // Double-check si pas déjà assigné
            const existing = await db.mission.findFirst({
              where: { colisId: colis.id, status: { in: ['ASSIGNE', 'EN_COURS'] } },
            });
            if (existing) continue;

            await db.mission.create({
              data: { colisId: colis.id, transporteurId: transporterId, status: 'ASSIGNE' },
            });

            assigned++;
            totalAssigned++;

            // Notification en-ligne
            await db.notification.create({
              data: {
                userId: transporterId,
                title: 'Nouveau colis assigné automatiquement',
                message: `${colis.villeDepart} → ${colis.villeArrivee}`,
                type: 'IN_APP',
              },
            }).catch(() => {});
          } catch {
            totalErrors++;
          }
        }

        // Mettre à jour lastAssignmentCheck
        await db.transporterPreferences.update({
          where: { userId: transporterId },
          data: { lastAssignmentCheck: new Date() },
        });

        results.push({ transporterId, name: pref.user.name, status: 'OK', assigned });
      } catch (err) {
        totalErrors++;
        results.push({ transporterId, name: pref.user.name, status: 'ERROR', assigned: 0 });
      }
    }

    return NextResponse.json({
      success: true,
      schedule: scheduleFilter || 'ALL',
      transportersProcessed: transporters.length,
      totalAssigned,
      totalErrors,
      results,
      ran: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron auto-assign error:', error);
    return NextResponse.json({ error: 'Internal error', detail: String(error) }, { status: 500 });
  }
}
