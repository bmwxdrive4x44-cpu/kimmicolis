import { db } from "./db";

/**
 * Statuts "normaux" qui ne devraient pas être bloqués longtemps
 */
const NORMAL_STATUSES = [
  "CREATED",           // Vient d'être créé
  "PAID_RELAY",        // En attente dépôt
  "DEPOSITED_RELAY",   // Déposé, en attente transport
  "EN_TRANSPORT",      // En cours de transport
  "ARRIVE_RELAIS_DESTINATION", // Arrivé destination
];

/**
 * Statuts "finaux" (ne devraient pas être bloqués)
 */
const FINAL_STATUSES = ["LIVRE", "ANNULE", "RETOUR", "EN_DISPUTE"];

/**
 * Configuration des seuils de blocage par statut (en heures)
 */
const BLOCKED_THRESHOLDS: Record<string, number> = {
  CREATED: 24,                    // 24h max before deposit at relay
  PAID_RELAY: 48,                 // 48h max at relay before transport
  DEPOSITED_RELAY: 24,            // 24h max waiting for transporter
  EN_TRANSPORT: 72,               // 72h max in transit
  ARRIVE_RELAIS_DESTINATION: 24,  // 24h max before delivery
};

export interface BlockedParcelAlert {
  parcelId: string;
  trackingNumber: string;
  currentStatus: string;
  hoursSinceUpdate: number;
  thresholdHours: number;
  clientId: string;
  relaisDepartId: string;
  relaisArriveeId: string;
  missions: Array<{ transporterId: string }>;
  lastUpdate: Date;
}

/**
 * Détecte les colis bloqués = pas de changement de statut depuis X heures
 * @param hoursThreshold - Utiliser les seuils par défaut si non fourni
 * @returns Liste des colis bloqués avec détails
 */
export async function detectBlockedParcels(
  hoursThreshold?: number
): Promise<BlockedParcelAlert[]> {
  const now = new Date();
  const blockedParcels: BlockedParcelAlert[] = [];

  // Récupérer tous les colis non finalisés
  const parcels = await db.colis.findMany({
    where: {
      status: {
        notIn: FINAL_STATUSES,
      },
    },
    include: {
      missions: {
        select: {
          transporteurId: true,
        },
      },
    },
  });

  for (const parcel of parcels) {
    // Déterminer le seuil applicableéal
    const threshold = hoursThreshold ?? BLOCKED_THRESHOLDS[parcel.status];
    if (!threshold) continue; // Ignorer si pas de seuil défini

    // Calculer les heures écoulées depuis la dernière mise à jour
    const hoursSinceUpdate =
      (now.getTime() - parcel.updatedAt.getTime()) / (1000 * 60 * 60);

    // Vérifier si bloqué
    if (hoursSinceUpdate > threshold) {
      blockedParcels.push({
        parcelId: parcel.id,
        trackingNumber: parcel.trackingNumber,
        currentStatus: parcel.status,
        hoursSinceUpdate: Math.round(hoursSinceUpdate * 10) / 10,
        thresholdHours: threshold,
        clientId: parcel.clientId,
        relaisDepartId: parcel.relaisDepartId,
        relaisArriveeId: parcel.relaisArriveeId,
        missions: parcel.missions.map((mission) => ({
          transporterId: mission.transporteurId,
        })),
        lastUpdate: parcel.updatedAt,
      });
    }
  }

  return blockedParcels;
}

/**
 * Notifie l'admin et les responsables d'un colis bloqué
 * @param alert - Alerte de colis bloqué
 * @param reason - Raison de l'alerte (optionnelle)
 */
export async function notifyBlockedParcel(
  alert: BlockedParcelAlert,
  reason?: string
) {
  const title = `🚨 Colis Bloqué: ${alert.trackingNumber}`;
  const message =
    `Statut: ${alert.currentStatus} depuis ${Math.floor(alert.hoursSinceUpdate)}h ` +
    `(seuil: ${alert.thresholdHours}h)` +
    (reason ? `\nRaison: ${reason}` : "");

  // Notifier l'admin
  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
  });

  const adminNotifications = admins.map((admin) =>
    db.notification.create({
      data: {
        userId: admin.id,
        title,
        message,
        type: "IN_APP",
      },
    })
  );

  // Notifier le client
  const clientNotif = db.notification.create({
    data: {
      userId: alert.clientId,
      title: `⏱️ Votre colis ${alert.trackingNumber} prend du retard`,
      message: `Votre colis est au statut "${alert.currentStatus}" depuis quelques heures. 
      Nous enquêtons pour accélérer la livraison. Un agent vous contactera si besoin.`,
      type: "IN_APP",
    },
  });

  // Notifier les transporteurs impliqués
  const transporterNotifs = alert.missions
    .map((m) =>
      db.notification.create({
        data: {
          userId: m.transporterId,
          title: `⚠️ Colis bloqué: ${alert.trackingNumber}`,
          message: `Le colis ${alert.trackingNumber} au statut "${alert.currentStatus}" 
          depuis ${Math.floor(alert.hoursSinceUpdate)}h. Veuillez accélérer le traitement.`,
          type: "IN_APP",
        },
      })
    );

  // Exécuter toutes les notifications
  await Promise.all([...adminNotifications, clientNotif, ...transporterNotifs]);
}

/**
 * Envoie une alerte manuelle pour un colis
 * @param colisId - ID du colis
 * @param message - Message d'alerte personnalisé
 * @param notifyRole - Rôle à notifier: 'ADMIN', 'TRANSPORTER', 'CLIENT', ou 'ALL'
 */
export async function sendManualAlert(
  colisId: string,
  message: string,
  notifyRole: "ADMIN" | "TRANSPORTER" | "CLIENT" | "ALL" = "ADMIN"
) {
  // Récupérer le colis
  const parcel = await db.colis.findUnique({
    where: { id: colisId },
    include: {
      missions: {
        select: { transporteurId: true },
      },
      client: { select: { id: true } },
    },
  });

  if (!parcel) {
    throw new Error(`Colis ${colisId} not found`);
  }

  const title = `🚨 Alerte Colis: ${parcel.trackingNumber}`;
  const userIds: string[] = [];

  // Déterminer les utilisateurs à notifier
  if (notifyRole === "ADMIN" || notifyRole === "ALL") {
    const admins = await db.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    userIds.push(...admins.map((a) => a.id));
  }

  if (notifyRole === "TRANSPORTER" || notifyRole === "ALL") {
    userIds.push(...parcel.missions.map((m) => m.transporteurId));
  }

  if (notifyRole === "CLIENT" || notifyRole === "ALL") {
    userIds.push(parcel.client.id);
  }

  // Créer les notifications
  await Promise.all(
    [...new Set(userIds)].map((userId) =>
      db.notification.create({
        data: {
          userId,
          title,
          message,
          type: "IN_APP",
        },
      })
    )
  );
}

/**
 * Analyse les statistiques de blocage
 * @returns Statistiques par statut
 */
export async function getBlockedStatistics() {
  const blockedParcels = await detectBlockedParcels();

  const stats = {
    totalBlocked: blockedParcels.length,
    byStatus: {} as Record<string, number>,
    criticalCount: 0, // Bloqués > 2x le seuil
    averageDelayHours: 0,
  };

  let totalDelay = 0;

  for (const parcel of blockedParcels) {
    stats.byStatus[parcel.currentStatus] ||= 0;
    stats.byStatus[parcel.currentStatus]++;

    if (parcel.hoursSinceUpdate > parcel.thresholdHours * 2) {
      stats.criticalCount++;
    }

    totalDelay += parcel.hoursSinceUpdate;
  }

  if (blockedParcels.length > 0) {
    stats.averageDelayHours =
      Math.round((totalDelay / blockedParcels.length) * 10) / 10;
  }

  return stats;
}
