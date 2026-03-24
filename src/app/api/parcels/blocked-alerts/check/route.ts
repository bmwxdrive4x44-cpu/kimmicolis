import { NextRequest, NextResponse } from "next/server";
import {
  detectBlockedParcels,
  notifyBlockedParcel,
} from "@/lib/parcel-alerts";

/**
 * POST /api/parcels/blocked-alerts/check
 * Job cron: Vérifie automatiquement les colis bloqués et envoie les alertes
 * À appeler toutes les heures ou demies heures
 *
 * Pour la sécurité, on peut utiliser:
 * - Un secret API dans les headers
 * - IP whitelist si c'est un service cron externe
 * - NextAuth avec un user system
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier le header de sécurité (utiliser une variable d'env)
    const authHeader = request.headers.get("x-cron-secret");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== cronSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Récupérer les paramètres
    const body = await request.json().catch(() => ({}));
    const { 
      sendNotifications = true,
      dryRun = false 
    } = body;

    // Détecter les colis bloqués
    const blockedParcels = await detectBlockedParcels();

    if (blockedParcels.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No blocked parcels detected",
        count: 0,
        dryRun,
      });
    }

    console.log(`[cron] Detected ${blockedParcels.length} blocked parcels`);

    // Si mode dry-run, retourner sans envoyer les notifications
    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: "Dry run mode",
        count: blockedParcels.length,
        parcels: blockedParcels.map((p) => ({
          id: p.parcelId,
          trackingNumber: p.trackingNumber,
          status: p.currentStatus,
          hoursSinceUpdate: p.hoursSinceUpdate,
        })),
        dryRun: true,
      });
    }

    // Envoyer les notifications
    const successCount = { value: 0 };
    const errors: string[] = [];

    for (const parcel of blockedParcels) {
      try {
        if (sendNotifications) {
          await notifyBlockedParcel(parcel, "Alerte automatique - colis bloqué");

          // Optionnel: enregistrer que l'alerte a été envoyée
          await recordAlertSent(parcel.parcelId);
        }
        successCount.value++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Parcel ${parcel.parcelId}: ${msg}`);
        console.error(`[cron] Error notifying parcel ${parcel.parcelId}:`, error);
      }
    }

    console.log(
      `[cron] Successfully processed alerts for ${successCount.value}/${blockedParcels.length} parcels`
    );

    return NextResponse.json({
      success: true,
      message: "Cron job completed",
      count: blockedParcels.length,
      successCount: successCount.value,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron-blocked-alerts] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * Enregistre qu'une alerte a été envoyée pour un colis
 * (optionnel: ajouter une table AlertLog si besoin de historique)
 */
async function recordAlertSent(colisId: string) {
  // Pour l'instant, on peut ajouter un log en DB si une table AlertLog existe
  // Sinon, les notifications elles-mêmes servent de trace
  // Voir schema.prisma:: ajouter si besoin:
  // model AlertLog {
  //   id        String   @id @default(cuid())
  //   colisId   String
  //   sentAt    DateTime @default(now())
  //   colis     Colis    @relation(fields: [colisId], references: [id])
  // }
  console.log(`[alert] Alert recorded for parcel ${colisId}`);
}
