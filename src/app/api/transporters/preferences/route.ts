import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

// GET preferences du transporteur actuel
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER']);
  if (!auth.success) return auth.response;

  try {
    const prefs = await db.transporterPreferences.findUnique({
      where: { userId: auth.payload.id },
    });

    if (!prefs) {
      // Créer les préférences par défaut
      const defaultPrefs = await db.transporterPreferences.create({
        data: {
          userId: auth.payload.id,
          autoAssignEnabled: false,
          maxDailyMissions: 10,
          maxActiveParallel: 5,
          acceptsCOD: true,
          acceptsPriority: true,
          acceptsBulk: false,
          scoreWeightDistance: 30,
          scoreWeightCapacity: 25,
          scoreWeightTiming: 20,
          scoreWeightEarnings: 25,
          successRate: 100,
        },
      });
      return NextResponse.json(defaultPrefs);
    }

    return NextResponse.json(prefs);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

// POST/PUT update preferences
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const {
      autoAssignEnabled,
      autoAssignSchedule,
      maxDailyMissions,
      maxActiveParallel,
      maxWeightKg,
      maxDimensionCm,
      acceptsCOD,
      acceptsPriority,
      acceptsBulk,
      preferredCities,
      preferredRoutes,
      excludedCities,
      scoreWeightDistance,
      scoreWeightCapacity,
      scoreWeightTiming,
      scoreWeightEarnings,
      availabilityWindows,
    } = body;

    // Valider les poids de scoring
    const weights = {
      scoreWeightDistance: scoreWeightDistance || 30,
      scoreWeightCapacity: scoreWeightCapacity || 25,
      scoreWeightTiming: scoreWeightTiming || 20,
      scoreWeightEarnings: scoreWeightEarnings || 25,
    };

    const totalWeight =
      weights.scoreWeightDistance +
      weights.scoreWeightCapacity +
      weights.scoreWeightTiming +
      weights.scoreWeightEarnings;

    if (totalWeight <= 0) {
      return NextResponse.json(
        { error: 'La somme des poids de scoring doit être > 0' },
        { status: 400 }
      );
    }

    // Valider limites
    if (maxDailyMissions && (maxDailyMissions < 1 || maxDailyMissions > 100)) {
      return NextResponse.json(
        { error: 'maxDailyMissions doit être entre 1 et 100' },
        { status: 400 }
      );
    }

    if (maxActiveParallel && (maxActiveParallel < 1 || maxActiveParallel > 50)) {
      return NextResponse.json(
        { error: 'maxActiveParallel doit être entre 1 et 50' },
        { status: 400 }
      );
    }

    // Chercher ou créer les préférences
    let prefs = await db.transporterPreferences.findUnique({
      where: { userId: auth.payload.id },
    });

    if (!prefs) {
      prefs = await db.transporterPreferences.create({
        data: {
          userId: auth.payload.id,
          autoAssignEnabled: autoAssignEnabled ?? false,
          autoAssignSchedule,
          maxDailyMissions: maxDailyMissions || 10,
          maxActiveParallel: maxActiveParallel || 5,
          maxWeightKg,
          maxDimensionCm,
          acceptsCOD: acceptsCOD ?? true,
          acceptsPriority: acceptsPriority ?? true,
          acceptsBulk: acceptsBulk ?? false,
          preferredCities: preferredCities ? JSON.stringify(preferredCities) : null,
          preferredRoutes: preferredRoutes ? JSON.stringify(preferredRoutes) : null,
          excludedCities: excludedCities ? JSON.stringify(excludedCities) : null,
          scoreWeightDistance: weights.scoreWeightDistance,
          scoreWeightCapacity: weights.scoreWeightCapacity,
          scoreWeightTiming: weights.scoreWeightTiming,
          scoreWeightEarnings: weights.scoreWeightEarnings,
          availabilityWindows: availabilityWindows
            ? JSON.stringify(availabilityWindows)
            : null,
        },
      });
    } else {
      // Update
      prefs = await db.transporterPreferences.update({
        where: { userId: auth.payload.id },
        data: {
          autoAssignEnabled: autoAssignEnabled ?? prefs.autoAssignEnabled,
          autoAssignSchedule: autoAssignSchedule ?? prefs.autoAssignSchedule,
          maxDailyMissions: maxDailyMissions ?? prefs.maxDailyMissions,
          maxActiveParallel: maxActiveParallel ?? prefs.maxActiveParallel,
          maxWeightKg: maxWeightKg ?? prefs.maxWeightKg,
          maxDimensionCm: maxDimensionCm ?? prefs.maxDimensionCm,
          acceptsCOD: acceptsCOD ?? prefs.acceptsCOD,
          acceptsPriority: acceptsPriority ?? prefs.acceptsPriority,
          acceptsBulk: acceptsBulk ?? prefs.acceptsBulk,
          preferredCities: preferredCities
            ? JSON.stringify(preferredCities)
            : prefs.preferredCities,
          preferredRoutes: preferredRoutes
            ? JSON.stringify(preferredRoutes)
            : prefs.preferredRoutes,
          excludedCities: excludedCities
            ? JSON.stringify(excludedCities)
            : prefs.excludedCities,
          scoreWeightDistance: weights.scoreWeightDistance,
          scoreWeightCapacity: weights.scoreWeightCapacity,
          scoreWeightTiming: weights.scoreWeightTiming,
          scoreWeightEarnings: weights.scoreWeightEarnings,
          availabilityWindows: availabilityWindows
            ? JSON.stringify(availabilityWindows)
            : prefs.availabilityWindows,
          lastAssignmentCheck: autoAssignEnabled ? new Date() : prefs.lastAssignmentCheck,
        },
      });
    }

    return NextResponse.json(prefs, { status: 201 });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

// DELETE reset preferences to defaults
export async function DELETE(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER']);
  if (!auth.success) return auth.response;

  try {
    const prefs = await db.transporterPreferences.findUnique({
      where: { userId: auth.payload.id },
    });

    if (!prefs) {
      return NextResponse.json(
        { error: 'Préférences non trouvées' },
        { status: 404 }
      );
    }

    // Reset to defaults
    const updated = await db.transporterPreferences.update({
      where: { userId: auth.payload.id },
      data: {
        autoAssignEnabled: false,
        autoAssignSchedule: null,
        maxDailyMissions: 10,
        maxActiveParallel: 5,
        maxWeightKg: null,
        maxDimensionCm: null,
        acceptsCOD: true,
        acceptsPriority: true,
        acceptsBulk: false,
        preferredCities: null,
        preferredRoutes: null,
        excludedCities: null,
        scoreWeightDistance: 30,
        scoreWeightCapacity: 25,
        scoreWeightTiming: 20,
        scoreWeightEarnings: 25,
        availabilityWindows: null,
      },
    });

    return NextResponse.json(
      { message: 'Préférences réinitialisées', preferences: updated }
    );
  } catch (error) {
    console.error('Error resetting preferences:', error);
    return NextResponse.json(
      { error: 'Failed to reset preferences' },
      { status: 500 }
    );
  }
}
