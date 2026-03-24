# GitHub Secrets Quick Setup

## 1️⃣ Aller aux Settings du Repository

https://github.com/bmwxdrive4x44-cpu/kimmicolis/settings/secrets/actions

Ou dans GitHub: Project → Settings → Secrets and variables → Actions

---

## 2️⃣ Ajouter les Secrets Requis

### Requis: DATABASE_URL

```
Secret name: DATABASE_URL
Secret value: postgresql://user:password@host:port/database
```

**Obtenir l'URL:**
- **Supabase**: Settings → Database → Connection string (Pt pooler pour Prisma)
- **Neon**: Dashboard → Connection string → Prisma
- **Railway**: Connect → Generate database URL

**Format valide:** `postgresql://username:password@host:port/dbname`

### Requis: NEXTAUTH_SECRET

```
Secret name: NEXTAUTH_SECRET
Secret value: (généré avec openssl ou utilisez une clé existante)
```

**Générer une nouvelle clé:**
```bash
openssl rand -base64 32
# Ou sur Windows:
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Random -Maximum 1000000000).ToString())) | Out-Host
```

Utiliser une clé existante si elle fonctionne déjà localement.

### Optionnel: SLACK_WEBHOOK_URL

```
Secret name: SLACK_WEBHOOK_URL
Secret value: https://hooks.slack.com/services/T.../B.../X...
```

**Setup Slack webhook:**
1. Allez à: https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. App name: "SwiftColis CI", Workspace: votre workspace Slack
4. Dans sidebar: "Incoming Webhooks" → "Add New Webhook to Workspace"
5. Choisissez le channel (#deployments, #errors, etc.)
6. Copiez l'URL webhook dans GitHub Secrets

---

## 3️⃣ Valider la Configuration

Pousser une modification vers `main` ou `develop`:

```bash
git commit --allow-empty -m "test: trigger ci/cd workflow"
git push origin main
```

Aller à: https://github.com/bmwxdrive4x44-cpu/kimmicolis/actions

Vous devriez voir:
- ✅ Workflow "Smoke Test CI" en cours d'exécution
- ✅ Logs détaillés des étapes (Build, Test, etc.)
- ✅ Résumé à la fin avec PASS/FAIL/SKIP counts

---

## 4️⃣ Résoudre les Problèmes Courants

### Workflow fails: "DATABASE_URL not found"
→ Vérifier le secret `DATABASE_URL` est bien ajouté et pas vide

### Build fails: "Not authorized to access this database"
→ Vérifier credentials dans DATABASE_URL (user/password corrects)

### Server fails to start: "Port 3000 already in use"
→ Augmenter le timeout dans `.github/workflows/smoke-test.yml`
(Voir step: "Wait for server to be ready")

### Smoke tests fail with 401 Unauthorized
→ Vérifier NEXTAUTH_SECRET matches local .env
→ Ou générer une nouvelle clé: `openssl rand -base64 32`

### No Slack notification on failure
→ Vérifier `SLACK_WEBHOOK_URL` est présent ET valide
→ Tester webhook manuellement:
```bash
curl -X POST -d '{"text":"test"}' <WEBHOOK_URL>
```

---

## 5️⃣ Variables d'Environnement Supplémentaires (Optionnel)

Si votre app utilise d'autres secrets, les ajouter aussi:

```
NODE_ENV: production
VERCEL_ENV: production
GOOGLE_API_KEY: xxx
```

Les ajouter de la même façon que DATABASE_URL.

---

## 6️⃣ Tester Localement Avant de Pusher

```bash
# Setup local .env
cat > .env.local << EOF
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=your-secret-key
EOF

# Lancer le test
npm run smoke:ci

# Vérifier le rapport
cat smoke-test-report.json | jq .
```

Si ça passe localement → Devrait passer sur GitHub Actions aussi.

---

## 📋 Checklist Finale

- [ ] DATABASE_URL configuré dans GitHub Secrets
- [ ] NEXTAUTH_SECRET configuré dans GitHub Secrets
- [ ] Optionnel: SLACK_WEBHOOK_URL si notifications Slack requises
- [ ] Pousser un changement vers `main` ou `develop`
- [ ] Vérifier workflow "Smoke Test CI" sur GitHub Actions
- [ ] Voir le résumé PASS/FAIL/SKIP dans logs
- [ ] (Si PR) Voir commentaire automatique avec résultats
- [ ] (Si FAIL + Slack) Recevoir notification Slack

---

## ✅ Vous êtes Prêt!

Le CI/CD est maintenant actif. Chaque push:
- ✅ Compile le code
- ✅ Lance le serveur  
- ✅ Valide le workflow complet (21 checks)
- ✅ Commente les PRs en cas d'erreur
- ✅ Notifie Slack en cas d'incident

**Questions?** Consulter [CI_CD_SETUP.md](CI_CD_SETUP.md) ou [SMOKE_TEST.md](SMOKE_TEST.md).

