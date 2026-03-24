# Configuration GitHub Actions & CI/CD

## Setup requis

### 1. Secrets GitHub

Ajouter les secrets suivants dans **Settings → Secrets and variables → Actions**:

**Requis pour tous les workflows:**
- `DATABASE_URL`: URL Supabase PostgreSQL (format: `postgresql://...`)
- `NEXTAUTH_SECRET`: JWT secret pour next-auth

**Optionnel - Slack Notifications:**
- `SLACK_WEBHOOK_URL`: Webhook URL Slack pour notifications de failure

### 2. Slack Configuration (Optionnel)

1. Aller dans Slack Workspace Settings → App Management
2. Créer une nouvelle app ou utiliser GitHub App existante
3. Activer **Incoming Webhooks**
4. Créer un webhook pointant vers un channel (ex: #deployments)
5. Copier l'URL dans GitHub Secrets → `SLACK_WEBHOOK_URL`

### 3. GitHub Workflow Configuration

Le workflow `.github/workflows/smoke-test.yml` s'exécute automatiquement sur:
- ✅ `push` vers `main` ou `develop`
- ✅ Pull requests vers `main` ou `develop`

## Workflow Steps

### Build Phase
1. **Checkout** - Récupère le code
2. **Setup Node.js 20** - Prépare l'environnement
3. **Install dependencies** - `npm ci`
4. **Build** - `npm run build`

### Test Phase
5. **Start server** - Lance `npm run start` en background
6. **Wait for ready** - Poll `GET /` jusqu'à réponse positive (max 60s)
7. **Run smoke-tests** - Exécute `./smoke-test.sh --ci --strict`

### Reporting Phase
8. **Parse results** - Extrait PASS/FAIL/SKIP du JSON
9. **Generate summary** - Affiche dans GitHub Actions UI
10. **Comment PR** - Si failure + PR, commente automatiquement
11. **Slack alert** - Si failure + webhook configuré

## Résultats

### GitHub Actions UI
✅ Affiche une table de résultats dans le workflow summary:

| Status | Count |
|--------|-------|
| ✅ PASS | 21 |
| ❌ FAIL | 0 |
| ⏭️ SKIP | 1 |
| 📊 Total | 22 |

### PR Comment (si FAIL)
Automatiquement poste un commentaire GitHub avec:
- Counts PASS/FAIL/SKIP
- Liste des failed checks
- Lien vers le workflow

### Slack Notification
Message formaté avec:
- Repo + branch + commit
- Counts détaillés
- Bouton vers GitHub Actions

## Local Testing

Pour tester le smoke-test localement:

```bash
# Mode normal (affiche tous les détails)
powershell -ExecutionPolicy Bypass -File ./smoke-test.ps1 -BaseUrl http://localhost:3000

# Mode CI (résumé + JSON report)
npm run smoke:ci

# Avec URL personnalisée
SMOKE_BASE_URL=http://localhost:4000 npm run smoke:ci
```

## Troubleshooting

### Workflow fails: "Failed to connect to server"
- Vérifier que le build réussit: `npm run build`
- Vérifier les secrets DATABASE_URL et NEXTAUTH_SECRET
- Augmenter le timeout wait (voir `Wait for server to be ready`)

### Smoke tests fail: "Parcel not found"
- Les tests supposent une DB fraîche à chaque run
- Vérifier que `DATABASE_URL` pointe vers la bonne DB
- Les migrations doivent s'appliquer automatiquement

### Slack notifications not working
- Vérifier que `SLACK_WEBHOOK_URL` est configué
- Tester le webhook directement: `curl -X POST -d '{"text":"test"}' <WEBHOOK_URL>`
- Vérifier les logs GitHub Actions pour les erreurs

## Phases Smoke-Test

Le script `smoke-test.sh` valide:

1. **Seed Database** - Initialise données de test
2. **Authentication** - Login + session validation
3. **Parcel Lifecycle** - Création → Relay scans → Livraison
4. **Trajet Management** - Création trajectes, matching automatique
5. **Public Tracking** - Accès client QR code

**Exit codes:**
- `0` = SUCCESS (tous tests PASS)
- `1` = FAILURE (≥1 test FAIL ou SKIP en mode strict)

## CI/CD Best Practices

✅ **À faire:**
- Pousser sur une branche feature avant de merger vers main
- Attendre que le workflow réussisse avant le merge
- Vérifier le smoke-test report avant deployment en prod

❌ **À éviter:**
- Merger avec FAIL > 0
- Ignorer les SKIP (peuvent indiquer une condition non testée)
- Committer sans lancer les smoke-tests localement

