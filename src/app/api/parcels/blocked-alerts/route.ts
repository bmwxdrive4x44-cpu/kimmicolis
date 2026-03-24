import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import {
  detectBlockedParcels,
  notifyBlockedParcel,
  getBlockedStatistics,
} from "@/lib/parcel-alerts";

/**
 * GET /api/parcels/blocked-alerts
 * Liste tous les colis bloqués (statut n'avance pas depuis X heures)
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier les droits
    const authResult = await requireRole(request, ["ADMIN"]);
    if (!authResult.success) {
      return authResult.response;
    }

    // Récupérer le paramètre hoursThreshold optionnel
    const searchParams = request.nextUrl.searchParams;
    const hoursThreshold = searchParams.get("hours")
      ? parseInt(searchParams.get("hours")!)
      : undefined;

    // Détecter les colis bloqués
    const blockedParcels = await detectBlockedParcels(hoursThreshold);

    // Trier par delay décroissant
    blockedParcels.sort(
      (a, b) => b.hoursSinceUpdate - a.hoursSinceUpdate
    );

    return NextResponse.json({
      success: true,
      count: blockedParcels.length,
      thresholdHours: hoursThreshold || "default",
      parcels: blockedParcels,
    });
  } catch (error) {
    console.error("[blocked-alerts] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
