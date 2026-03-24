import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { getBlockedStatistics } from "@/lib/parcel-alerts";

/**
 * GET /api/parcels/blocked-alerts/stats
 * Retourne les statistiques sur les colis bloqués
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier les droits
    const authResult = await requireRole(request, ["ADMIN"]);
    if (!authResult.success) {
      return authResult.response;
    }

    // Récupérer les statistiques
    const stats = await getBlockedStatistics();

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[blocked-alerts-stats] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
