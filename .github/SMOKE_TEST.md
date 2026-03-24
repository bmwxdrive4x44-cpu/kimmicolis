# Smoke Test - Documentation Détaillée

## Vue d'ensemble

Le smoke-test est une suite E2E qui valide le workflow complet de la plateforme SwiftColis:
- **Durée**: ~60 secondes (sans réseau)
- **Exit code**: 0 (SUCCESS) ou 1 (FAILURE)
- **Rapport**: JSON optionnel (mode CI)

## Modes d'exécution

### Mode Normal (Développement)
```bash
npm run smoke:ci
powershell -ExecutionPolicy Bypass -File ./smoke-test.ps1 -BaseUrl http://localhost:3000
```
Affiche: Console colorée avec sections détaillées, résumé final, exit 0 si tous PASS

### Mode CI (GitHub Actions)
```bash
npm run smoke:ci
bash ./smoke-test.sh --base-url http://localhost:3000 --ci --report smoke-test-report.json
```
Affiche: Résumé compact `[CI] total=22 pass=21 fail=0 skip=1`, JSON report généré

### Mode Strict CI
```bash
npm run smoke:ci  # Utilise -StrictExit par défaut
bash ./smoke-test.sh --base-url http://localhost:3000 --ci --strict --report smoke-test-report.json
```
**Différence**: EXIT 1 si SKIP > 0 (considère les skipped tests comme des failures)

## Phases du Smoke Test

### Phase 0: Seed Database
**API**: `POST /api/seed`
**Crée**:
- 4 users: admin, client, transporter, relais
- 7 lignes de transport (Alger-Oran, etc.)
- Relais locations

**Expected**: HTTP 200, response.success === true

---

### Phase 1: Login (Admin)
**API**: `POST /api/auth/signin`
**Body**: 
```json
{
  "email": "admin@swiftcolis.dz",
  "password": "admin123"
}
```
**Expected**: HTTP 200, token JWT via Set-Cookie + body.token

---

### Phase 2: Get Sessions
**API**: `GET /debug-session`
**Auth**: Bearer JWT depuis Phase 1
**Expected**: HTTP 200, response.session.user.role === 'ADMIN'

---

### Phase 3: Approve Relais (Admin)
**API**: `PUT /api/relais/{id}`
**Body**: `{ status: 'APPROVED' }`
**Expected**: HTTP 200, relais status updated

---

### Phase 4: Create Parcel (Client)
**API**: `POST /api/parcels/create`
**Body**:
```json
{
  "weight": 2.5,
  "price": 4750,
  "senderLongitude": 3.058,
  "senderLatitude": 36.755,
  "recipientLongitude": -0.6417,
  "recipientLatitude": 35.0956,
  "withdrawalCode": "ABC123"
}
```
**Expected**: HTTP 200, response.id (parcel ID), status === 'CREATED'

---

### Phase 5: Create Trajet (Transporter)
**API**: `POST /api/trajets/create`
**Body**:
```json
{
  "departureCity": "Alger",
  "arrivalCity": "Oran",
  "departureTime": "2025-12-20T08:00:00Z",
  "capacite": 1,
  "lineId": 1,
  "itinerary": ["Alger", "Tipaza", "Oran"]
}
```
**Expected**: HTTP 200, response.id (trajet ID), availableCapacity === 1

---

### Phase 6: Match Parcel to Trajet (Matching)
**API**: `POST /api/matching`
**Body**: `{ colisId: <parcel_id>, trajetId: <trajet_id> }`
**Expected**: HTTP 200, mission created, trajet.availableCapacity decremented

---

### Phase 7: Scan Dépôt (Relais)
**API**: `POST /api/relais/scan-depot`
**Body**:
```json
{
  "trackingNumber": "SWIFTCOLIS...",
  "relaisId": 1,
  "status": "ENCAISSEMENT" // optional, for cash collection
}
```
**Expected**: HTTP 200, parcel.status === 'RECU_RELAIS'

---

### Phase 8: Scan Remise Transporteur
**API**: `POST /api/relais/scan-remise-transporteur`
**Body**:
```json
{
  "trackingNumber": "SWIFTCOLIS...",
  "relaisId": 1
}
```
**Expected**: HTTP 200, parcel.status === 'EN_TRANSPORT'

---

### Phase 9: Scan Arrivée
**API**: `POST /api/relais/scan-arrivee`
**Body**:
```json
{
  "trackingNumber": "SWIFTCOLIS...",
  "relaisId": 2 // destination relais
}
```
**Expected**: HTTP 200, parcel.status === 'ARRIVE_RELAIS_DESTINATION'

---

### Phase 10: Scan Livraison
**API**: `POST /api/relais/scan-livraison`
**Body**:
```json
{
  "trackingNumber": "SWIFTCOLIS...",
  "relaisId": 2,
  "identity": "ID_12345",
  "withdrawalCode": "ABC123"
}
```
**Expected**: HTTP 200, parcel.status === 'LIVRE', recipient verified

---

### Phase 11: Public Tracking (Client)
**API**: `GET /api/parcels/{trackingNumber}/public`
**Auth**: None (public endpoint)
**Expected**: HTTP 200, parcel timeline + history

---

## JSON Report Format

```json
{
  "baseUrl": "http://localhost:3000",
  "ciMode": true,
  "strictExit": false,
  "totals": {
    "total": 22,
    "pass": 21,
    "fail": 0,
    "skip": 1
  },
  "failedChecks": [
    "Phase X: Check Y failed - reason"
  ],
  "skippedChecks": [
    "Phase X: Check Y skipped - reason"
  ],
  "generatedAt": "2025-03-22T10:30:45Z"
}
```

## Exit Codes

| Code | Condition | Mode |
|------|-----------|------|
| 0 | PASS > 0 && FAIL === 0 | All |
| 0 | PASS > 0 && FAIL === 0 && SKIP ignored | Normal |
| 1 | FAIL > 0 | All |
| 1 | SKIP > 0 | Strict mode |
| 1 | Server error | All |

## Debugging

### Enable verbose logging (PowerShell)
```powershell
$VerbosePreference = "Continue"
./smoke-test.ps1 -BaseUrl http://localhost:3000 -Verbose
```

### Check server logs
```bash
npm run dev  # Watch console for errors
# OR
npm run build && npm run start  # Production logs
```

### Inspect database state
```bash
npx prisma studio  # UI browser for DB
```

### Manual API calls
```bash
# Test seed
curl -X POST http://localhost:3000/api/seed

# Test parcel creation
curl -X POST http://localhost:3000/api/parcels/create \
  -H "Content-Type: application/json" \
  -d '{"weight":2.5,"price":4750,...}'

# Check parcel status
curl http://localhost:3000/api/parcels/{id}
```

## Troubleshooting

### "Failed to connect to server"
- Vérifier que le serveur écoute sur le bon port: `lsof -i :3000`
- Vérifier les logs de build: `npm run build`
- Augmenter le timeout (voir `.github/workflows/smoke-test.yml`)

### "Parcel not found" after creation
- Check seed phase passed (should be 1st)
- Verify DATABASE_URL is correct
- Check Prisma migrations applied: `npx prisma migrate status`

### "JWT invalid" or "Unauthorized"
- Verify NEXTAUTH_SECRET is set
- Check token isn't expired (smoke-test should be < 1 min)
- Verify Bearer header format: `Authorization: Bearer <token>`

### "Relais not approved"
- Seed should create relais with APPROVED status
- If Phase 3 fails, manually approve: `UPDATE relais SET status = 'APPROVED'`

## Performance Notes

- **PowerShell version**: ~600ms per HTTP call (Windows overhead)
- **Bash version**: ~150ms per HTTP call (Linux native)
- **Database**: Seed + 11 phases = ~30s total (DB-bound)
- **Total E2E**: ~60s on localhost

## Extending the Smoke Test

To add a new phase:

### PowerShell
```powershell
function Test-NewPhase {
    $result = Invoke-API "POST" "/api/new-endpoint" @{
        field1 = "value1"
    }
    
    if ($result.success) {
        Write-Pass "Phase X: New check passed"
    } else {
        Write-Fail "Phase X: New check failed - reason"
    }
}

# Add to main flow:
Test-NewPhase
```

### Bash
```bash
# In smoke-test.sh test_new_phase() {
  local response=$(api_call "POST" "/api/new-endpoint" '{"field1":"value1"}')
  
  if echo "$response" | grep -q '"success":true'; then
    log_pass "Phase X: New check passed"
  else
    log_fail "Phase X: New check failed"
  fi
}

# Add to main:
test_new_phase
```

## CI Integration Status

✅ **Currently integrated with:**
- GitHub Actions (ubuntu-latest runner)
- PR comments on failure
- Slack webhooks (optional)
- Artifact upload (smoke-test-report.json)

🔄 **Future enhancements:**
- Screenshot capture on failure
- Performance metrics tracking
- Automated rollback on FAIL
- Slack thread updates with phases

