# Système d'Auto-Assign Intelligent - Documentation

## 📋 Vue d'ensemble

Le système d'auto-assign intelligent automatise l'attribution de colis aux transporteurs en fonction de leurs **préférences individuelles** et de leurs **capacités disponibles**.

### Améliorations par rapport au système classique

| Aspect | Matching classique | Auto-assign intelligent |
|--------|-------------------|------------------------|
| Critères | Route + capacité | Préférences + optimisation scoring |
| Configuration | Globale | Par transporteur |
| Limites | Aucune | Quotidienne + parallèles |
| Poids de scoring | Fixes | Personnalisables |
| Horaires | Continu | Programmable |
| Disponibilité | Basée sur trajets | Basée sur capacités |

---

## 🚀 Flux d'utilisation

### 1. **Transporteur configure ses préférences**

```
Dashboard Transporteur
  ↓
Paramètres → Auto-assign
  ↓
Configurer : Villes, routes, limites, horaires
  ↓
Activer toggle "Auto-assign activé"
```

### 2. **Administrateur déclenche batch ou schedule**

```
Admin Dashboard
  ↓
Colis non assignés
  ↓
[Bouton] Auto-assign intelligent
  ↓
Système teste tous les transporteurs avec:
  - Filtre par préférences (villes, poids, etc.)
  - Vérification capacité (quotidienne + parallèles)
  - Assignation au premier compatible
```

### 3. **Auto-assign programmé (futur)**

```
Cron Job (ex: 8AM chaque jour)
  ↓
Pour chaque transporteur avec auto-assign = ON
  ↓
Déclencher: PUT /api/transporters/auto-assign
  ↓
Notifo transporteur + MAJ statut missions
```

---

## 📊 Schema de données

### TransporterPreferences (model Prisma)

```prisma
model TransporterPreferences {
  id                    String   @id
  userId                String   @unique  // FK User TRANSPORTER
  
  // Préférences géographiques
  preferredCities       String?  // JSON: ["Alger", "Oran", "Constantine"]
  preferredRoutes       String?  // JSON: [{villeDepart, villeArrivee}, ...]
  excludedCities        String?  // JSON: ["Bab-Ezzouar"]
  
  // Limitations capacité
  maxDailyMissions      Int      // Max par jour (1-100)
  maxActiveParallel     Int      // Max missions actives (1-50)
  maxWeightKg           Float?   // Poids max accepté (kg)
  maxDimensionCm        Float?   // Dimension max (cm)
  
  // Préférences colis
  acceptsCOD            Boolean  // Accept cash-on-delivery
  acceptsPriority       Boolean  // Accept colis prioritaires (pro)
  acceptsBulk           Boolean  // Accept expéditions groupées
  
  // Auto-assign programmation
  autoAssignEnabled     Boolean  // Activer auto-assign
  autoAssignSchedule    String?  // DAILY_8AM | DAILY_6PM | WEEKLY | MANUAL
  
  // Poids de scoring (doivent totalisent > 0)
  scoreWeightDistance   Int      // Distance prioritaire (0-100)
  scoreWeightCapacity   Int      // Capacité disponible (0-100)
  scoreWeightTiming     Int      // Timing départ (0-100)
  scoreWeightEarnings   Int      // Potentiel gains (0-100)
  
  // Horaires de disponibilité
  availabilityWindows   String?  // JSON: [{dayOfWeek: 0-6, startTime, endTime}, ...]
  
  // Statistiques/Learning
  lastAssignmentCheck   DateTime? // Dernière vérification auto-assign
  successRate           Float    // Taux complétion (%)
  avgRating             Float?   // Note moyenne client
  
  createdAt            DateTime
  updatedAt            DateTime
}
```

---

## 🔌 Endpoints API

### 1. **GET /api/transporters/preferences**
Récupère les préférences du transporteur actuel

```bash
curl -X GET \
  http://localhost:3000/api/transporters/preferences \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200)**
```json
{
  "id": "pref_123",
  "userId": "user_456",
  "autoAssignEnabled": true,
  "autoAssignSchedule": "DAILY_8AM",
  "maxDailyMissions": 15,
  "maxActiveParallel": 8,
  "maxWeightKg": 50,
  "acceptsCOD": true,
  "acceptsPriority": true,
  "acceptsBulk": false,
  "preferredCities": ["Alger", "Oran"],
  "scoreWeightDistance": 35,
  "scoreWeightCapacity": 20,
  ...
}
```

### 2. **POST /api/transporters/preferences**
Met à jour les préférences

```bash
curl -X POST \
  http://localhost:3000/api/transporters/preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "autoAssignEnabled": true,
    "autoAssignSchedule": "DAILY_8AM",
    "maxDailyMissions": 20,
    "maxActiveParallel": 10,
    "maxWeightKg": 60,
    "acceptsCOD": true,
    "acceptsPriority": false,
    "preferredCities": ["Alger", "Oran", "Blida"],
    "preferredRoutes": [
      { "villeDepart": "Alger", "villeArrivee": "Blida" },
      { "villeDepart": "Alger", "villeArrivee": "Oran" }
    ],
    "scoreWeightDistance": 40,
    "scoreWeightCapacity": 30,
    "scoreWeightTiming": 15,
    "scoreWeightEarnings": 15
  }'
```

**Response (201/200)**
```json
{
  "id": "pref_123",
  "userId": "user_456",
  "autoAssignEnabled": true,
  ...
}
```

### 3. **GET /api/transporters/auto-assign**
Récupère l'état de l'auto-assign

```bash
curl -X GET \
  http://localhost:3000/api/transporters/auto-assign \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200)**
```json
{
  "enabled": true,
  "schedule": "DAILY_8AM",
  "maxDailyMissions": 15,
  "maxActiveParallel": 8,
  "todayCount": 5,
  "activeCount": 3,
  "canAssignMore": true,
  "lastCheck": "2026-04-03T08:15:00Z"
}
```

### 4. **POST /api/transporters/auto-assign**
Active/désactive l'auto-assign

```bash
curl -X POST \
  http://localhost:3000/api/transporters/auto-assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "schedule": "DAILY_8AM"
  }'
```

### 5. **PUT /api/transporters/auto-assign**
Déclenche manuellement l'auto-assign

```bash
curl -X PUT \
  http://localhost:3000/api/transporters/auto-assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "automateUnmatched": true,
    "limit": 10
  }'
```

**Response (200)**
```json
{
  "message": "5 colis assignés",
  "assigned": [
    {
      "colisId": "colis_1",
      "missionId": "mission_1",
      "route": "Alger → Blida"
    }
  ],
  "errors": [],
  "summary": {
    "total": 5,
    "success": 5,
    "failed": 0,
    "activeMissions": 8,
    "todayCount": 10
  }
}
```

### 6. **POST /api/matching**
Matching intelligent avec préférences

```bash
curl -X POST \
  http://localhost:3000/api/matching \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "colisId": "colis_123",
    "usePreferences": true  # Utiliser intelligent matching
  }'
```

---

## 🎯 Algorithme de scoring

### Scoring classique (0-120)

```
score = 100 (base full match) ou 85/75/60 (partial matches)
      + capacité bonus (max +20)
      + proximité itinéraire (max +20)
      + disponibilité transporteur (max +15)
      + timing départ (max +8)
```

### Scoring de préférence (0-100)

```
score = 50 (base)
      + 25 (si ville préférée)
      + 30 (si route préférée)
      - 50 (si ville exclue)
      + rating transporteur (max +15)
      + capacité excellente (max +10)
```

### Scoring final (blended)

```
final_score = classique_score * 0.7 + preference_score * 0.3
```

### Poids personnalisables

```
weight_total = scoreWeightDistance 
             + scoreWeightCapacity 
             + scoreWeightTiming 
             + scoreWeightEarnings

Normalized weights utilisés pour scorer chaque aspect.
```

---

## ⚙️ Configuration recommandée

### Pour starter (couriers débutants)

```json
{
  "autoAssignEnabled": true,
  "autoAssignSchedule": "DAILY_8AM",
  "maxDailyMissions": 5,
  "maxActiveParallel": 2,
  "acceptsCOD": true,
  "acceptsPriority": false,
  "acceptsBulk": false,
  "scoreWeightDistance": 40,
  "scoreWeightCapacity": 30,
  "scoreWeightTiming": 15,
  "scoreWeightEarnings": 15
}
```

### Pour les pros (transporteurs validés)

```json
{
  "autoAssignEnabled": true,
  "autoAssignSchedule": "DAILY_8AM",
  "maxDailyMissions": 50,
  "maxActiveParallel": 15,
  "maxWeightKg": 80,
  "acceptsCOD": true,
  "acceptsPriority": true,
  "acceptsBulk": true,
  "preferredCities": ["Alger", "Blida", "Oran"],
  "scoreWeightDistance": 25,
  "scoreWeightCapacity": 30,
  "scoreWeightTiming": 20,
  "scoreWeightEarnings": 25
}
```

---

## 🔍 Validations et garde-fous

### Avant d'assigner un colis

✅ **Vérifications de sécurité**
- [ ] Transporteur a auto-assign = true
- [ ] Colis compatible avec acceptsCOD, acceptsPriority
- [ ] Poids ≤ maxWeightKg
- [ ] Missions actives < maxActiveParallel
- [ ] Missions aujourd'hui < maxDailyMissions
- [ ] Ville non dans excludedCities
- [ ] Statut colis ∈ [PAID_RELAY, DEPOSITED_RELAY]

### Limits avec fallback

```javascript
available_slots = min(
  maxActiveParallel - activeMissions,  // Capacité parallèle
  maxDailyMissions - todayCount,       // Limite quotidienne
  requested_limit
)
```

---

## 📈 Cas d'usage

### Use Case 1: Routing automatique sans intervention admin

```
Client publie colis
  ↓
POST /api/matching { colisId, usePreferences: true }
  ↓
Système teste transporteurs avec auto-assign
  ↓
Assigne au premier compatible
  ↓
Notification transporteur
```

### Use Case 2: Batch quotidien

```
Cron: 8AM chaque jour
  ↓
Pour N colis non assignés:
  ↓
PUT /api/transporters/auto-assign { limit: 50 }
  ↓
Distribue jusqu'à capacités max
  ↓
Slack notification admins: "145 colis assignés"
```

### Use Case 3: Transporteur pre-qualifie

```
Transporteur:
  - Route Alger-Blida exclusive
  - Max 20 colis/jour
  - N'accepte pas COD
  
Config:
  preferredRoutes: [{villeDepart: "Alger", villeArrivee: "Blida"}]
  scoreWeightDistance: 100 (priorité max)
  acceptsCOD: false
  
Résultat: Ne reçoit que Alger→Blida, jamais COD
```

---

## 🐛 Dépannage

### Problème: Transporteur ne reçoit aucun colis

**Vérifications**
1. `GET /api/transporters/auto-assign` → `enabled = true`?
2. `GET /api/transporters/preferences` → `autoAssignEnabled = true`?
3. Capacité disponible? `todayCount < maxDailyMissions` && `activeCount < maxActiveParallel`?
4. Ville dans excludedCities?
5. Colis de priorité et acceptsPriority = false?

### Problème: Auto-assign très lent

**Solutions**
1. ↓ `limit` dans PUT request (au lieu de 50, essayer 10)
2. ↓ nombre de transporteurs avec auto-assign actif
3. Ajouter un index DB sur `TransporterPreferences(autoAssignEnabled, userId)`

### Problème: Missions assignées à mauvais transporteur

**Causes communes**
1. Poids colis > maxWeightKg (vérifier validation)
2. Préférences en conflit (exclude routes + prefer routes)
3. Scoring poids mal configuration (total = 0)

---

## 🚀 Phase 2: Améliorations futures

- [ ] **Disponibilité en créneau**: availabilityWindows respectable
- [ ] **Scoring ML**: Utiliser successRate + avgRating pour boost
- [ ] **Affinity routes**: Apprendre préférences depuis historique
- [ ] **Batch scheduling**: Cron integré au lieu de PUT manuel
- [ ] **Dashboard analytics**: Taux assignation, répartition géo, etc.

---

## 📞 Support

Pour des questions sur le système d'auto-assign intelligent:
1. Consulter cette doc
2. Vérifier préférences avec GET /api/transporters/preferences
3. Tester avec PUT /api/transporters/auto-assign { limit: 1 }
4. Logs: Vérifier database logs et server console
