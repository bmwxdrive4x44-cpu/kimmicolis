# 🚨 Système d'Alertes pour Colis Bloqués

## Overview

Le système détecte automatiquement les colis dont le statut n'avance pas depuis X heures, et envoie des notifications aux administrateurs, transporteurs et clients concernés.

## Configuration

### Variables d'Environnement

Ajouter dans `.env.local`:

```bash
# Secret pour la tâche cron (générer avec un random string)
CRON_SECRET=your-secure-random-string-here
```

**Pour générer une clé secure:**
```bash
# macOS/Linux
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Random -Maximum 1000000000).ToString()))
```

### Seuils de Blocage par Défaut

Modifiables dans `src/lib/parcel-alerts.ts`:

```typescript
const BLOCKED_THRESHOLDS = {
  CREATED: 24,                    // 24h max avant dépôt au relais
  PAID_RELAY: 48,                 // 48h max au relais avant transport
  DEPOSITED_RELAY: 24,            // 24h max en attente transporteur
  EN_TRANSPORT: 72,               // 72h max en transit
  ARRIVE_RELAIS_DESTINATION: 24,  // 24h max avant livraison
};
```

## API Endpoints

### 1. Lister les Colis Bloqués

```http
GET /api/parcels/blocked-alerts
Authorization: Bearer <admin-token>
```

**Query Parameters:**
- `hours` (optionnel) - Overrider le seuil par défaut (en heures)

**Response:**
```json
{
  "success": true,
  "count": 3,
  "thresholdHours": "default",
  "parcels": [
    {
      "parcelId": "colis-123",
      "trackingNumber": "SWIFTCOLIS-001",
      "currentStatus": "EN_TRANSPORT",
      "hoursSinceUpdate": 75.5,
      "thresholdHours": 72,
      "clientId": "client-456",
      "relaisDepartId": "relay-a",
      "relaisArriveeId": "relay-b",
      "missions": [{"transporterId": "transport-789"}],
      "lastUpdate": "2025-03-22T10:30:00Z"
    }
  ]
}
```

---

### 2. Obtenir les Statistiques

```http
GET /api/parcels/blocked-alerts/stats
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalBlocked": 5,
    "byStatus": {
      "EN_TRANSPORT": 2,
      "ARRIVE_RELAIS_DESTINATION": 2,
      "DEPOSITED_RELAY": 1
    },
    "criticalCount": 1,
    "averageDelayHours": 48.6
  },
  "timestamp": "2025-03-22T14:22:00Z"
}
```

---

### 3. Envoyer une Alerte Manuelle

```http
POST /api/parcels/{parcelId}/alert
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "message": "Urgent: Veuillez accélérer la livraison du colis",
  "notifyRole": "ADMIN",
  "isAutomatic": false
}
```

**Parameters:**
- `message` (string, requis si isAutomatic=false) - Message d'alerte personnalisé
- `notifyRole` (enum) - `ADMIN` | `TRANSPORTER` | `CLIENT` | `ALL`
- `isAutomatic` (boolean, default: false) - Utiliser le template automatique si true

**Response:**
```json
{
  "success": true,
  "message": "Alert sent successfully",
  "recipients": "ADMIN"
}
```

---

### 4. Job Cron: Vérifier et Notifier

```http
POST /api/parcels/blocked-alerts/check
Content-Type: application/json
X-Cron-Secret: your-cron-secret

{
  "sendNotifications": true,
  "dryRun": false
}
```

**Headers requis:**
- `X-Cron-Secret` - Doit correspondre à la variable d'env `CRON_SECRET`

**Query Parameters:**
- `sendNotifications` (boolean, default: true) - Envoyer les notifications
- `dryRun` (boolean, default: false) - Tester sans envoyer

**Response:**
```json
{
  "success": true,
  "message": "Cron job completed",
  "count": 3,
  "successCount": 3,
  "timestamp": "2025-03-22T14:22:00Z"
}
```

---

## Configuration de la Tâche Cron

### Option 1: Vercel Crons (Simple)

N/A pour ce projet (à utiliser pour production sur Vercel).

### Option 2: Service Cron Externe (Uptime Kuma, EasyCron, etc.)

1. **Créer un webhook cron:**
   ```
   URL: https://votre-app.vercel.app/api/parcels/blocked-alerts/check
   Method: POST
   Headers: X-Cron-Secret: <votre-secret>
   Interval: 1 hour
   ```

2. **Tester localement:**
   ```bash
   curl -X POST http://localhost:3000/api/parcels/blocked-alerts/check \
     -H "X-Cron-Secret: test-secret" \
     -H "Content-Type: application/json" \
     -d '{"dryRun": true}'
   ```

### Option 3: Node.js Cron (Apps locales/self-hosted)

Ajouter à `src/instrumentation.ts` ou créer un worker:

```typescript
import cron from 'node-cron';

// Toutes les heures
cron.schedule('0 * * * *', async () => {
  try {
    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/parcels/blocked-alerts/check`,
      {
        method: 'POST',
        headers: {
          'X-Cron-Secret': process.env.CRON_SECRET || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sendNotifications: true }),
      }
    );
    console.log('[cron] Blocked alerts job:', await response.json());
  } catch (error) {
    console.error('[cron] Error:', error);
  }
});
```

---

## Flux de Notifications

### Automatique (Cron Job)

1. Job cron s'exécute toutes les heures
2. Détecte les colis bloqués
3. Pour chaque colis bloqué:
   - Notifie l'admin
   - Notifie le client (statut RETARD)
   - Notifie le(s) transporteur(s) impliqué(s)

### Manuel (Admin)

Admin peut envoyer une alerte directement via:
- `/api/parcels/{id}/alert` avec message personnalisé
- Ou via un dashboard UI

---

## Dashboard Admin (Optionnel)

Créer une page `/[locale]/dashboard/alerts` pour visualiser:

```typescript
// src/app/[locale]/dashboard/alerts/page.tsx
export default async function AlertsPage() {
  const blockedParcels = await fetch('/api/parcels/blocked-alerts');
  const stats = await fetch('/api/parcels/blocked-alerts/stats');
  
  return (
    <div>
      <h1>Colis Bloqués ({stats.totalBlocked})</h1>
      
      {/* Stats Cards */}
      <StatsCards stats={stats} />
      
      {/* Blocked Parcels Table */}
      <BlockedParcelsTable parcels={blockedParcels} />
      
      {/* Alert Actions */}
      <AlertActions />
    </div>
  );
}
```

---

## Exemples d'Utilisation

### Vérifier les colis bloqués depuis plus de 48h

```bash
curl http://localhost:3000/api/parcels/blocked-alerts?hours=48 \
  -H "Authorization: Bearer <token-admin>"
```

### Envoyer une alerte à tous (admin + transporteur + client)

```bash
curl -X POST http://localhost:3000/api/parcels/colis-123/alert \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Urgent: Accélérez la livraison !",
    "notifyRole": "ALL"
  }'
```

### Test cron en dry-run

```bash
curl -X POST http://localhost:3000/api/parcels/blocked-alerts/check \
  -H "X-Cron-Secret: test-secret" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true, "sendNotifications": false}'
```

---

## Stockage des Logs d'Alerte (Optionnel)

Pour tracker les alertes envoyées, ajouter à `schema.prisma`:

```prisma
model AlertLog {
  id        String   @id @default(cuid())
  colisId   String
  type      String   // AUTOMATIC, MANUAL
  message   String?
  sentAt    DateTime @default(now())
  colis     Colis    @relation(fields: [colisId], references: [id])
}
```

Puis ajouter une relation:
```prisma
model Colis {
  // ...
  alerts    AlertLog[]
}
```

---

## Troubleshooting

### Cron job returns 401

- Vérifier `X-Cron-Secret` header correspond à `CRON_SECRET` en .env
- Vérifier que `CRON_SECRET` est défini (non vide)

### Notifications ne s'envoient pas

- Vérifier que les users (admin, client, transporteur) existent
- Vérifier que les missions du colis existent
- Consulter les logs: `console.log` dans `notifyBlockedParcel()`

### Certains colis ne sont pas détectés

- Vérifier que le statut est dans `NORMAL_STATUSES`
- Vérifier que `updatedAt` est correctement mis à jour à chaque transition
- Utiliser `?hours=<threshold>` pour override les seuils

### Test local

```bash
# Démarrer le serveur
npm run dev

# Appeler manuellement le job
curl -X POST http://localhost:3000/api/parcels/blocked-alerts/check \
  -H "X-Cron-Secret: $(echo $CRON_SECRET)" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

---

## Évolutions Futures

- [ ] Dashboard UI pour visualiser les alertes
- [ ] Email notifications (ajouter provider email)
- [ ] SMS alerts pour cas critiques (> 2x seuil)
- [ ] Escalade automatique (.ex: relais → admin → client)
- [ ] Historique des alertes (`AlertLog` table)
- [ ] Machine Learning pour prédire les blocages

