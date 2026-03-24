import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { sendManualAlert, notifyBlockedParcel, detectBlockedParcels } from "@/lib/parcel-alerts";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/parcels/[id]/alert
 * Envoie une alerte manuelle ou automatique pour un colis bloqué
 * Body:
 * {
 *   "message": "Message d'alerte",
 *   "notifyRole": "ADMIN" | "TRANSPORTER" | "CLIENT" | "ALL",
 *   "isAutomatic": false // Si true, utilise le template automatique
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Vérifier les droits (ADMIN ou TRANSPORTER/RELAIS can send alerts for their parcels)
    const authResult = await requireRole(request, [
      "ADMIN",
      "TRANSPORTER",
      "RELAIS",
    ]);
    if (!authResult.success) {
      return authResult.response;
    }

    const body = await request.json();
    const { message, notifyRole = "ADMIN", isAutomatic = false } = body;

    if (!message && !isAutomatic) {
      return NextResponse.json(
        { success: false, error: "Message or isAutomatic flag required" },
        { status: 400 }
      );
    }

    // Mode automatique: détecter et notifier si bloqué
    if (isAutomatic) {
      // Vérifier que le colis existe et est bloqué
      const blockedParcels = await detectBlockedParcels();
      const parcel = blockedParcels.find((p) => p.parcelId === id);

      if (!parcel) {
        return NextResponse.json(
          { success: false, error: "Parcel not found or not blocked" },
          { status: 404 }
        );
      }

      // Envoyer les notifications automatiques
      await notifyBlockedParcel(
        parcel,
        "Alerte automatique de blocage de colis"
      );

      return NextResponse.json({
        success: true,
        message: "Automatic alert sent",
        parcel: {
          id: parcel.parcelId,
          trackingNumber: parcel.trackingNumber,
          status: parcel.currentStatus,
          hoursSinceUpdate: parcel.hoursSinceUpdate,
        },
      });
    }

    // Mode manuel: envoyer le message personnalisé
    await sendManualAlert(id, message, notifyRole);

    return NextResponse.json({
      success: true,
      message: "Alert sent successfully",
      recipients: notifyRole,
    });
  } catch (error: any) {
    console.error("[parcel-alert] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
