# 🚨 Intégration du Système d'Alertes Colis Bloqués

Guide rapide pour intégrer et configurer le système d'alertes dans votre environnement.

## 1️⃣ Configuration Environnement

### .env.local
```bash
# Ajouter la variable CRON_SECRET
CRON_SECRET=your-secure-random-string-here

# Générer avec:
# macOS/Linux: openssl rand -base64 32
# Windows: powershell -Command "[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Random -Maximum 1000000000).ToString()))"
```

### Vérifier les variables existantes
- ✅ `DATABASE_URL` doit être en `postgresql://...` (Prisma standard)
- ✅ `NEXTAUTH_SECRET` pour JWT
- ✅ `NEXTAUTH_URL` pour auth callbacks

## 2️⃣ Intégrer au Dashboard Admin

### Option A: Ajouter un nouvel onglet (Recommandé)

**Fichier**: `src/app/[locale]/dashboard/admin/page.tsx`

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlockedParcelsAlert } from "@/components/dashboard/admin/blocked-parcels-alert";

export default async function AdminDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard Administrateur</h1>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="alerts">
            🚨 Alertes Colis
          </TabsTrigger>
          {/* ... autres onglets ... */}
        </TabsList>

        <TabsContent value="alerts">
          <BlockedParcelsAlert />
        </TabsContent>

        {/* ... autres contenus ... */}
      </Tabs>
    </div>
  );
}
```

### Option B: Ajouter une nouvelle page

Créer `src/app/[locale]/dashboard/admin/alerts/page.tsx`:

```typescript
import { BlockedParcelsAlert } from "@/components/dashboard/admin/blocked-parcels-alert";

export const metadata = {
  title: "Alertes Colis Bloqués",
  description: "Gérer les colis bloqués et envoyer des alertes"
};

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <BlockedParcelsAlert />
    </div>
  );
}
```

Puis ajouter le lien dans la navigation:

```typescript
// src/components/layout/admin-nav.tsx
<NavLink href="/dashboard/admin/alerts">
  {t('Navigation.alerts')} 🚨
</NavLink>
```

## 3️⃣ Configurer la Tâche Cron

### Option A: Vercel Cron (Si déployé sur Vercel)

Ajouter à `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/parcels/blocked-alerts/check",
      "schedule": "0 * * * *"
    }
  ]
}
```

Configurer le secret GitHub:
- Go to: Settings → Secrets and variables → Actions
- Add: `CRON_SECRET` avec une valeur strong

Dans le workflow GitHub Actions, passer le secret:
```yaml
env:
  CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

### Option B: Service Cron Externe (Recommandé pour Flexibility)

**Utiliser EasyCron.com ou Uptime Kuma:**

1. Créer un nouveau webhook cron
2. URL: `https://votre-app.vercel.app/api/parcels/blocked-alerts/check`
3. Method: `POST`
4. Headers:
   ```
   X-Cron-Secret: your-secret-from-env
   Content-Type: application/json
   ```
5. Body:
   ```json
   {
     "sendNotifications": true,
     "dryRun": false
   }
   ```
6. Schedule: Hourly (0 * * * *)
7. Save & Test

### Option C: Node.js Cron (Self-hosted)

Ajouter à `src/instrumentation.ts`:

```typescript
import cron from 'node-cron';

// À la fin du fichier ou dans une fonction export
if (process.env.NEXT_RUNTIME === 'nodejs') {
  // Toutes les heures à la minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('[cron] Running blocked parcels check...');
      
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const response = await fetch(
        `${baseUrl}/api/parcels/blocked-alerts/check`,
        {
          method: 'POST',
          headers: {
            'X-Cron-Secret': process.env.CRON_SECRET || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sendNotifications: true,
            dryRun: false,
          }),
        }
      );

      const result = await response.json();
      console.log('[cron] Blocked parcels check completed:', result);
    } catch (error) {
      console.error('[cron] Error checking blocked parcels:', error);
    }
  });
}
```

**Note**: Installer `node-cron`:
```bash
npm install node-cron
npm install --save-dev @types/node
```

## 4️⃣ Tester Localement

### Test 1: Vérifier l'endpoint
```bash
# Terminal 1: Démarrer le serveur
npm run dev

# Terminal 2: Test dry-run du cron
curl -X POST http://localhost:3000/api/parcels/blocked-alerts/check \
  -H "X-Cron-Secret: test-secret" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true, "sendNotifications": false}'
```

**Response attendue:**
```json
{
  "success": true,
  "message": "Dry run mode",
  "count": 3,
  "parcels": [
    {
      "id": "...",
      "trackingNumber": "SWIFT...",
      "status": "EN_TRANSPORT",
      "hoursSinceUpdate": 75.5
    }
  ],
  "dryRun": true
}
```

### Test 2: Vérifier les colis bloqués
```bash
# 1. Seed data
curl -X POST http://localhost:3000/api/seed

# 2. Login admin
TOKEN=$(curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@swiftcolis.dz","password":"admin123"}' \
  | jq -r '.token')

# 3. List blocked parcels
curl http://localhost:3000/api/parcels/blocked-alerts \
  -H "Authorization: Bearer $TOKEN"

# 4. Check stats
curl http://localhost:3000/api/parcels/blocked-alerts/stats \
  -H "Authorization: Bearer $TOKEN"
```

### Test 3: Envoyer une alerte manuelle
```bash
# Après login (voir Test 2)
curl -X POST http://localhost:3000/api/parcels/{parcel-id}/alert \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test alerte - veuillez accélérer",
    "notifyRole": "ALL",
    "isAutomatic": false
  }'
```

## 5️⃣ Monitoring & Troubleshooting

### Logs
- **Bloc notifications**: Vérifier `src/lib/parcel-alerts.ts` → `notifyBlockedParcel()`
- **Cron job**: Vérifier les logs Vercel/production
- **API errors**: Vérifier la console du serveur

### Erreurs Courantes

**401 Unauthorized on /api/parcels/blocked-alerts**
- ✅ Vérifier le token admin est valide
- ✅ Vérifier `Authorization: Bearer <token>` header

**CRON_SECRET mismatch**
- ✅ Vérifier `X-Cron-Secret` header matches env var
- ✅ Rappel: case-sensitive!

**No blocked parcels detected**
- Peut être normal si tous les colis avancent régulièrement
- Utiliser test data: modifier `updatedAt` manuellement:
```sql
UPDATE colis 
SET updated_at = NOW() - INTERVAL '80 hours'
WHERE id = 'test-colis-id' AND status = 'EN_TRANSPORT';
```

**Notifications ne s'envoient pas**
- ✅ Vérifier les users (admin, client, transporter) existent
- ✅ Vérifier la relation `missions` du colis
- ✅ Vérifier les logs: `console.error` in `notifyBlockedParcel()`

## 6️⃣ Évolutions Recommandées

### Court terme (1-2 semaines)
- [ ] Ajouter email provider (SendGrid, Mailgun)
- [ ] SMS alerts pour criticités > 96h
- [ ] UI pour configurer seuils par statut

### Moyen terme (1 mois)
- [ ] AlertLog table pour historique
- [ ] Escalation automatique (relais → admin → client)
- [ ] Prédiction ML des blocages

### Long terme
- [ ] Webhook notifications (Slack, Teams, Discord)
- [ ] Mobile push notifications
- [ ] Analytics dashboard sur les blocages

## 7️⃣ Checklist de Déploiement

- [ ] `.env.local` contient `CRON_SECRET`
- [ ] Component `BlockedParcelsAlert` intégré au dashboard
- [ ] Cron job configuré (Vercel / EasyCron / Node.js)
- [ ] Test local: `npm run dev` + appel API
- [ ] Test production: observer premier cron run
- [ ] Vérifier les logs: `console.log` dans `notifyBlockedParcel()`
- [ ] Notifs arrivant aux admin/client/transporter
- [ ] Dashboard montre les bonnes stats

---

## Documentation Supplémentaire

- `.github/BLOCKED_PARCELS_ALERTS.md` — API complète + configuration
- `.github/FEATURE_02_BLOCKED_ALERTS.md` — Status de feature
- `src/lib/parcel-alerts.ts` — Source code commenté

---

**Questions?** Consulter la documentation ou les logs du serveur.

