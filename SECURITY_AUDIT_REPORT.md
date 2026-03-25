# Rapport d'Audit de Sécurité - Application Next.js KimmiColis

**Date**: 25 Mars 2026  
**Périmètre**: Endpoints API (src/app/api/), Authentification, Validation, RBAC  
**Statut**: ⚠️ **3 Vulnérabilités CRITIQUES détectées**

---

## 📊 Résumé Exécutif

| Catégorie | Trouvé | Status |
|-----------|--------|--------|
| **Endpoints API** | 40+ | Analysés |
| **Vulnérabilités Critiques** | 3 | ⚠️ À corriger |
| **Problèmes Majeurs** | 5 | À adresser |
| **Points Positifs** | 8 | ✅ Bien implémentés |

---

## 🔴 VULNÉRABILITÉS CRITIQUES

### 1. **SQL INJECTION dans `/api/seed` et `/api/admin/reset-relais-status`**

**Fichiers affectés:**
- [src/app/api/seed/route.ts](src/app/api/seed/route.ts#L1)
- [src/app/api/admin/reset-relais-status/route.ts](src/app/api/admin/reset-relais-status/route.ts#L1)

**Problème:**
Utilisation de `$executeRawUnsafe` avec interpolation de chaîne (string interpolation) au lieu de requêtes paramétrées.

```typescript
// ❌ VULNÉRABLE à SQL injection
await db.$executeRawUnsafe(`
  INSERT INTO "User" (id, email, password, name, role, phone, "isActive", "createdAt", "updatedAt")
  VALUES (gen_random_uuid(), 'admin@swiftcolis.dz', '${adminPassword}', ...)
`);

// ❌ Boucle avec injection potentielle
for (const line of lines) {
  await db.$executeRawUnsafe(`
    INSERT INTO "Ligne" (id, "villeDepart", "villeArrivee", ...)
    VALUES (gen_random_uuid(), '${line.depart}', '${line.arrivee}', ...)
  `);
}

// ❌ Réinitialisation sans paramètres
await db.$executeRawUnsafe(`
  UPDATE "Relais" SET status = 'PENDING', "updatedAt" = NOW()
`);
```

**Impact:**
- Accès/modification/suppression de données arbitraires en base de données
- Exfiltration d'informations sensibles (mots de passe, données client)
- Compromission potentielle de toute la base de données

**Solution:**
Utiliser Prisma Client pour les opérations, ou utiliser `$executeRaw` avec requêtes paramétrées:

```typescript
// ✅ SÉCURISÉ avec paramètres
await db.$executeRaw`
  INSERT INTO "User" (id, email, password, name, role, phone, "isActive", "createdAt", "updatedAt")
  VALUES (gen_random_uuid(), ${email}, ${hashedPassword}, ${name}, ${role}, ${phone}, true, NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET password = ${hashedPassword}
`;

// Ou utiliser le Prisma Client standard
await db.ligne.createMany({
  data: lines.map(line => ({
    villeDepart: line.depart,
    villeArrivee: line.arrivee,
    tarifPetit: line.petit,
    // ...
  }))
});
```

**Criticité:** 🔴 **CRITIQUE**

---

### 2. **Endpoints DEBUG Sans Authentification**

**Fichiers affectés:**
- [src/app/api/debug-user/route.ts](src/app/api/debug-user/route.ts) - Expose les données utilisateur
- [src/app/api/debug-users/route.ts](src/app/api/debug-users/route.ts) - Liste tous les utilisateurs
- [src/app/api/debug-session/route.ts](src/app/api/debug-session/route.ts) - Retourne la session actuelle
- [src/app/api/create-test-relais/route.ts](src/app/api/create-test-relais/route.ts) - Crée des utilisateurs test

**Problème - `/api/debug-user`:**
```typescript
// ❌ SANS AUTHENTIFICATION - Exposes user info via query params
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');
  const password = request.nextUrl.searchParams.get('password');  // ⚠️ Password in query!
  
  if (!email) return NextResponse.json({ error: 'Email required' });
  
  const user = await db.user.findFirst({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, name: true, role: true, isActive: true, password: true, ... }
  });
  
  const passwordMatch = password ? await verifyPassword(password, user.password || '') : false;
  return NextResponse.json({
    exists: true,
    user: { id, email, name, role, isActive, hasRelais, relaisStatus },
    passwordMatch,  // ⚠️ Leaks password verification
  });
}
```

**Exposition d'informations:**
- Énumération d'utilisateurs (test d'existance de compte)
- Vérification de mot de passe publique (brute force possible)
- Hash partiels du mot de passe
- Détails du relais associé

**Problème - `/api/debug-users`:**
```typescript
// ❌ SANS AUTHENTIFICATION - Liste TOUS les utilisateurs
const users = await db.$queryRaw`SELECT id, email, name, role, password FROM "User"`;
return NextResponse.json({
  count: safeUsers.length,
  users: safeUsers  // Include password starts!
});
```

**Problème - `/api/debug-session`:**
Pas d'authentification requise - retourne la session actuelle en clair

**Problème - `/api/create-test-relais`:**
```typescript
// ❌ SANS AUTHENTIFICATION - Crée/met à jour des comptes
export async function GET() {
  const user = await db.user.create({
    data: { email: 'creperie@gmail.com', password: hashedPassword, role: 'RELAIS', ... }
  });
  // ❌ Approuve automatiquement le relais
  await db.relais.update({
    where: { userId: user.id },
    data: { status: 'APPROVED' }  // Contourne le workflow d'approbation admin!
  });
}
```

**Impact:**
- Accès anonyme à l'énumération d'utilisateurs
- Attaques par brute-force sur les mots de passe
- Création de comptes test/frauduleux
- Contournement du workflow d'approbation admin

**Criticité:** 🔴 **CRITIQUE**

---

### 3. **Endpoints Sensibles Sans Authentification/RBAC**

**Fichiers affectés:**
- [src/app/api/action-logs/route.ts](src/app/api/action-logs/route.ts) - Logs d'audit publics
- [src/app/api/stats/route.ts](src/app/api/stats/route.ts) - Stats métier publiques
- [src/app/api/wallet/route.ts](src/app/api/wallet/route.ts) - Wallet transporter accessible sans auth
- [src/app/api/relais-cash/route.ts](src/app/api/relais-cash/route.ts) - Pas d'attribution d'accès
- [src/app/api/notifications/route.ts](src/app/api/notifications/route.ts) - Pas d'authentification

**Problème - `/api/action-logs`:**
```typescript
// ❌ SANS AUTHENTIFICATION
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get('entityId');
  const entityType = searchParams.get('entityType');
  const userId = searchParams.get('userId');
  
  const logs = await db.actionLog.findMany({ where: { entityId, entityType, userId } });
  return NextResponse.json(logs);  // Expose tous les logs d'audit!
}
```

**Exposition:**
- Tous les logs d'audit (accès utilisateurs, modifications, actions sensibles)
- Énumération de UserID via recherche
- Historique complet des actions métier

**Problème - `/api/stats`:**
```typescript
// ❌ SANS AUTHENTIFICATION - Stats métier publiques
const usersCount = await db.$queryRaw`SELECT COUNT(*) FROM "User"`;
const parcelsCount = await db.$queryRaw`SELECT COUNT(*) FROM "Colis"`;
const revenueResult = await db.$queryRaw`SELECT SUM("commissionPlateforme") FROM "Colis"`;
const parcelsByCity = await db.$queryRaw`SELECT "villeArrivee", COUNT(*) FROM "Colis" GROUP BY...`;
return NextResponse.json({ usersCount, parcels, revenue, recentParcels, ... });
```

**Exposition:**
- Nombre d'utilisateurs, transporteurs, relais
- Chiffre d'affaires totale (données financières)
- Distribution géographique complète
- Parcels récents avec détails

**Problème - `/api/wallet`:**
```typescript
// ❌ SANS AUTHENTIFICATION - N'importe qui peut voir le wallet d'un transporteur
export async function GET(request: NextRequest) {
  const transporteurId = searchParams.get('transporteurId');  // User ID en param!
  
  const wallet = await db.transporterWallet.upsert({ where: { transporteurId }, ... });
  const missions = await db.mission.findMany({ where: { transporteurId } });
  
  return NextResponse.json({ wallet, missions });  // Expose gains + historique!
}

// ❌ POST sans auth requise
export async function POST(request: NextRequest) {
  const { transporteurId, amount } = body;  // Can request withdrawals for anyone!
  
  if (wallet.availableEarnings < amount) { ... }
  
  const updated = await db.transporterWallet.update({
    where: { transporteurId },
    data: { availableEarnings: { decrement: amount }, totalWithdrawn: { increment: amount } }
  });
}
```

**Problème - `/api/relais-cash`:**
```typescript
// ❌ SANS AUTHENTIFICATION - Access control manquant
export async function GET(request: NextRequest) {
  const relaisId = searchParams.get('relaisId');
  
  const transactions = await db.relaisCash.findMany({ where: { relaisId } });
  return NextResponse.json({ cashCollected, cashReversed, balance, transactions });
  // N'importe qui peut voir la trésorerie d'un relais!
}

// ❌ POST - N'importe qui peut reverser du cash
export async function POST(request: NextRequest) {
  const { relaisId, amount, notes, userId, colisId } = body;
  // userId peut être fourni par le client!
  
  await db.relaisCash.create({ data: { relaisId, colisId, amount, type: 'REVERSED', notes } });
  await db.relais.update({
    where: { id: relaisId },
    data: { cashReversed: { increment: amount } }  // Fraude possible!
  });
}
```

**Efficacité - `/api/notifications`:**
```typescript
// ⚠️ Pas d'authentification, userId en param
export async function GET(request: NextRequest) {
  const userId = searchParams.get('userId');  // N'importe quel userId!
  
  const notifications = await db.notification.findMany({
    where: { userId }  // Accès aux notifications d'autres utilisateurs
  });
}
```

**Impact Global:**
- **Divulgation de données financières**: revenus, gains des transporteurs
- **FRAUD**: Modifications non autorisées de trésorerie
- **Disclosure**: Logs d'audit exposés publiquement
- **Énumération**: Enumération d'utilisateurs et de ressources

**Criticité:** 🔴 **CRITIQUE**

---

## 🟠 PROBLÈMES MAJEURS

### 4. **Endpoints Sensibles Manquent de Rate Limiting**

**Impact:** Les attaques par force brute et DoS ne sont pas protégées

- [src/app/api/test-login/route.ts](src/app/api/test-login/route.ts) - Vérification de mot de passe sans limite
- [src/app/api/users/route.ts](src/app/api/users/route.ts#L50) - POST de création utilisateur sans limite
- [src/app/api/relais/route.ts](src/app/api/relais/route.ts) - POST sans rate limit
- [src/app/api/payments/route.ts](src/app/api/payments/route.ts) - POST de paiement sans limite
- `/api/auth/signin` - NextAuth ne fait pas de rate limiting natif

**Code Rate Limit disponible mais pas utilisé:**
```typescript
// ✅ Existe dans src/lib/ratelimit.ts
export const RATE_LIMIT_PRESETS = {
  strict: { windowMs: 60 * 1000, maxRequests: 5 },    // 5 req/min
  moderate: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 req/min
  relaxed: { windowMs: 60 * 1000, maxRequests: 100 },
  public: { windowMs: 60 * 1000, maxRequests: 300 },
};
export async function checkRateLimit(request, config, userId?) { ... }

// ❌ Mais N'EST JAMAIS UTILISÉ dans les endpoints
```

**Recommandation:**
```typescript
// À ajouter dans les endpoints sensibles
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  const rateCheck = await checkRateLimit(request, RATE_LIMIT_PRESETS.moderate);
  if (rateCheck.limited) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  // ... reste du code
}
```

**Criticité:** 🟠 **MAJEUR**

---

### 5. **Credentials Codés en Dur dans `/api/seed`**

**Fichier:** [src/app/api/seed/route.ts](src/app/api/seed/route.ts#L72)

```typescript
export async function GET() {
  // ❌ Credentials codés en dur
  const adminPassword = await hashPassword('admin123');
  const clientPassword = await hashPassword('client123');
  const transporterPassword = await hashPassword('transport123');
  const relaisPassword = await hashPassword('relais123');
  
  // ... puis retourne les credentials en clair
  return NextResponse.json({
    credentials: {
      admin: { email: 'admin@swiftcolis.dz', password: 'admin123', role: 'ADMIN' },
      client: { email: 'client@demo.dz', password: 'client123', role: 'CLIENT' },
      transporter: { email: 'transport@demo.dz', password: 'transport123', role: 'TRANSPORTER' },
      relais: { email: 'relais@demo.dz', password: 'relais123', role: 'RELAIS' },
    },
  });
}
```

**Problèmes:**
- Accessible en production si pas désactivé
- Retourne les mots de passe en clair
- Permet accès admin direct
- Les mots de passe sont faibles

**Impact:**
- Accès non autorisé à tous les rôles
- Si l'endpoint n'est pas supprimé en prod, compromission complète

**Criticité:** 🟠 **MAJEUR**

---

### 6. **Information Disclosure via `/api/test-login` et `/api/init-db`**

**Fichier:** [src/app/api/test-login/route.ts](src/app/api/test-login/route.ts)

```typescript
export async function POST(request: Request) {
  // ... verification
  const user = users[0];
  
  return NextResponse.json({
    success: true,
    email,
    userFound: true,
    passwordMatch: match,
    storedFormat: user.password.startsWith('$2') ? 'bcrypt' : 'legacy-sha256',  // ⚠️
    storedHash: user.password.substring(0, 20) + '...',  // ⚠️ Expose hash
    user: { id, email, name, role }
  });
}
```

**Exposition:**
- Format de hashage du mot de passe (information for cracking)
- Premières 20 caractères du hash (aide au reverse-engineering)
- Confirmation de l'existence d'utilisateur via response

**Fichier:** [src/app/api/init-db/route.ts](src/app/api/init-db/route.ts)

```typescript
export async function GET() {
  console.log('Initializing database tables with raw SQL...');
  // ❌ Endpoint qui crée les tables - Peut réinitialiser la DB!
  const createTablesSQL = `
    CREATE TABLE IF NOT EXISTS "User" (
    ...
  `;
}
```

**Problème:**
- Accessible en production peut réinitialiser les tables
- Pas d'authentification
- Destructeur potentiellement

**Criticité:** 🟠 **MAJEUR**

---

### 7. **Relais Status APPROVED Auto-Assigné**

**Fichier:** [src/app/api/create-test-relais/route.ts](src/app/api/create-test-relais/route.ts#L50)

```typescript
relais = await db.relais.update({
  where: { userId: user.id },
  data: { status: 'APPROVED' }  // ❌ Approves automatically!
});
```

**Problème:**
- Contourne le workflow d'approbation admin
- Teste utilisateurs peuvent être approuvés directement
- Bypass du processus de vérification

**Workflow correct:**
PENDING → Admin review → APPROVED/REJECTED

**Criticité:** 🟠 **MAJEUR**

---

## 🟡 PROBLÈMES MODÉRÉS

### 8. **Validation d'Entrée Incomplète**

**Fichiers sans validation suffisante:**

- [src/app/api/relais/route.ts](src/app/api/relais/route.ts#L90) - Latitude/Longitude pas validées (float valides?)
- [src/app/api/trajets/route.ts](src/app/api/trajets/route.ts) - villesEtapes JSON parsing sans sanitization
- [src/app/api/missions/route.ts](src/app/api/missions/route.ts) - trajetId peut être null (ne décrémente pas la capacité du trajet)
- [src/app/api/payments/route.ts](src/app/api/payments/route.ts) - Amount pas validé (pourrait être négatif?)

**Exemple - Validation insuffisante:**
```typescript
// ❌ Dans /api/relais/route.ts
const { userId, commerceName, address, ville, latitude, longitude, photos, commerceRegisterNumber } = body;
// latitude/longitude pas validés!

if (!userId || !commerceName || !address || !ville || !rcNumber) {  // Missing lat/long checks
  return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
}

const relais = await db.relais.create({
  data: {
    userId,
    commerceName,
    address,
    ville,
    latitude,  // ❌ Could be string, null, or huge number
    longitude,
    ...
  },
});
```

**Recommandation:**
```typescript
import { z } from 'zod';  // Or similar validation library

const RelaisSchema = z.object({
  userId: z.string().cuid(),
  commerceName: z.string().min(2).max(100),
  address: z.string().min(5).max(255),
  ville: z.string().min(2).max(50),
  latitude: z.number().refine(n => n >= -90 && n <= 90, 'Invalid latitude'),
  longitude: z.number().refine(n => n >= -180 && n <= 180, 'Invalid longitude'),
  photos: z.array(z.string().url()).optional(),
  commerceRegisterNumber: z.string(),
});

const validated = RelaisSchema.parse(body);
```

**Criticité:** 🟡 **MODÉRÉ**

---

### 9. **Manque de Vérification de Propriété d'Entité**

**Exemples:**

1. **[src/app/api/missions/route.ts](src/app/api/missions/route.ts#L6)** - GET missions sans vérifier l'ownership
```typescript
// ❌ Un transporteur peut voir TOUTES les missions du réseau
const missions = await db.mission.findMany({
  where,
  orderBy: { createdAt: 'desc' },
});
```

2. **[src/app/api/trajets/route.ts](src/app/api/trajets/route.ts#L60)** - GET trajets accessible à RELAIS
```typescript
// ⚠️ RELAIS peut voir les trajets de tous les transporteurs?
const trajets = await db.trajet.findMany({
  where: (transporteurId ? { transporteurId } : {}),
});
```

3. **[src/app/api/parcels/route.ts](src/app/api/parcels/route.ts#L87)** - Parcels query manque checks
```typescript
// ✅ Cette partie est correcte:
if (clientId) {
  if (payload.role === 'CLIENT' && clientId !== payload.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  where.clientId = clientId;
}
// ✅ Implémentation correcte de vérification d'ownership
```

**Criticité:** 🟡 **MODÉRÉ**

---

### 10. **Erreurs Système Exposées**

Plusieurs endpoints retournent `error instanceof Error ? error.message : 'Unknown error'` qui peut exposer:
- Stack traces
- Path de base de données
- Configuration système

```typescript
// ❌ Exemple dans src/app/api/relais/[id]/route.ts
catch (error) {
  return NextResponse.json({ 
    error: 'Failed to update relais',
    details: error instanceof Error ? error.message : 'Unknown error'  // ⚠️ Expose errors
  }, { status: 500 });
}
```

**Recommandation:**
```typescript
catch (error) {
  // En développement
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', error);
  }
  
  // En production - message générique
  return NextResponse.json({ 
    error: 'An error occurred',
    // NE PAS exposer les détails
  }, { status: 500 });
}
```

**Criticité:** 🟡 **MODÉRÉ**

---

## ✅ POINTS POSITIFS

### 1. **Authentification NextAuth Bien Implémentée** ✅
- Strategy JWT
- Password hashing avec bcrypt (12 rounds)
- Migration depuis SHA-256 legacy vers bcrypt
- Session validation correct

**Fichier:** [src/lib/auth.ts](src/lib/auth.ts)

### 2. **Middleware RBAC à Niveau Global** ✅
- [src/middleware.ts](src/middleware.ts) protège `/api/admin/*`
- Vérification de rôle ADMIN obligatoire
- Redirection des pages `/dashboard` avec authentification

```typescript
if (pathname.startsWith('/api/admin')) {
  const token = await getToken({ req: request });
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (token.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.next();
}
```

### 3. **Utilisation Sécurisée de Prisma ORM** ✅
- 90%+ des requêtes utilisent Prisma Client (prévient SQL injection)
- Paramètres fortement typés
- Recherches sécurisées

**Exemple positif:**
```typescript
// ✅ SÉCURISÉ - Prisma Client
const relais = await db.relais.findUnique({
  where: { id },
  include: { user: { select: { id: true, name: true } } },
});
```

### 4. **Fonction `requireRole()` RBAC Réutilisable** ✅
**Fichier:** [src/lib/rbac.ts](src/lib/rbac.ts#L54)

Bien implémenté pour la majorité des endpoints:
```typescript
export async function requireRole(request, allowedRoles) {
  const { payload, error } = await verifyJWT(request);
  if (error || !payload) return { success: false, response: 401 };
  if (!allowedRoles.includes(payload.role)) return { success: false, response: 403 };
  return { success: true, payload };
}
```

**Utilisé correctement dans:**
- [src/app/api/relais/[id]/route.ts](src/app/api/relais/[id]/route.ts#L9) - Protection GET/PUT/DELETE
- [src/app/api/missions/route.ts](src/app/api/missions/route.ts#L6) - Protection des missions
- [src/app/api/payments/route.ts](src/app/api/payments/route.ts#L20) - Protection vérifiée

### 5. **Validation du Format RC Algérien** ✅
**Fichier:** [src/lib/validators.ts](src/lib/validators.ts)

```typescript
export function isAlgerianCommerceRegisterNumber(value: string): boolean {
  const normalized = normalizeCommerceRegisterNumber(value).replace(/\s+/g, '');
  // Format: [RC-]WW/NNNNNNNLAA
  return /^(RC[\s\-]*)?\d{2}[\/\-]\d{1,8}[A-Z]\d{2}$/.test(normalized);
}
```

Utilisé dans:
- [src/app/api/users/route.ts](src/app/api/users/route.ts#L80)
- [src/app/api/relais/route.ts](src/app/api/relais/route.ts#L74)
- [src/app/api/transporters/route.ts](src/app/api/transporters/route.ts#L42)

### 6. **Vérification de Propriété Implémentée** ✅
**Fichier:** [src/lib/rbac.ts](src/lib/rbac.ts#L88)

```typescript
export function hasAccess(payload, userId, adminRoles = ['ADMIN']) {
  return payload.id === userId || adminRoles.includes(payload.role);
}
```

**Utilisé correctement dans:**
- [src/app/api/payments/route.ts](src/app/api/payments/route.ts#L35) - Vérification client
- [src/app/api/relais/route.ts](src/app/api/relais/route.ts#L48) - Vérification propriétaire
- [src/app/api/transporters/route.ts](src/app/api/transporters/route.ts#L18) - Vérification utilisateur

### 7. **Rate Limiting Library Disponible** ✅
**Fichier:** [src/lib/ratelimit.ts](src/lib/ratelimit.ts)

Bien implémenté mais **INUTILISÉ** dans les endpoints

### 8. **Admin Endpoints Correctement Protégés** ✅
- [src/app/api/admin/relais/validate/route.ts](src/app/api/admin/relais/validate/route.ts#L10) - Vérification ADMIN
- [src/app/api/admin/transporters/validate/route.ts](src/app/api/admin/transporters/validate/route.ts#L18) - Vérification ADMIN

```typescript
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);  // ✅ Correct
  if (!auth.success) return auth.response;
  // ...
}
```

---

## 📋 TABLEAU DES ENDPOINTS

| Endpoint | Method | Auth | RBAC | Validation | Rate Limit | Sécurisé |
|----------|--------|------|------|-----------|-----------|----------|
| `/api/lignes` | GET | ❌ | ❌ | ✅ | ❌ | ⚠️ |
| `/api/lignes` | POST | ✅ | ✅ (ADMIN) | ✅ | ❌ | ✅ |
| `/api/users` | GET | ✅ | ✅ (ADMIN) | ✅ | ❌ | ✅ |
| `/api/users` | POST | ❌ | ❌ | ✅ | ❌ | ⚠️ |
| `/api/parcels` | GET | ⚠️ | ✅ | ✅ | ❌ | ✅ |
| `/api/parcels` | POST | ✅ | ✅ (CLIENT) | ✅ | ❌ | ✅ |
| `/api/missions` | GET | ✅ | ✅ | ⚠️ | ❌ | ⚠️ |
| `/api/missions` | POST | ✅ | ✅ | ✅ | ❌ | ✅ |
| `/api/missions/{id}` | DELETE | ✅ | ✅ (ADMIN) | ✅ | ❌ | ✅ |
| `/api/relais` | GET | ⚠️ | ⚠️ | ✅ | ❌ | ⚠️ |
| `/api/relais` | POST | ✅ | ✅ | ✅ | ❌ | ✅ |
| `/api/relais/{id}` | GET | ✅ | ✅ | ✅ | ❌ | ✅ |
| `/api/relais/{id}` | PUT | ✅ | ✅ | ⚠️ | ❌ | ✅ |
| `/api/relais/{id}` | DELETE | ✅ | ✅ (ADMIN) | ✅ | ❌ | ✅ |
| `/api/relais-cash` | GET | ❌ | ❌ | ❌ | ❌ | 🔴 |
| `/api/relais-cash` | POST | ❌ | ❌ | ⚠️ | ❌ | 🔴 |
| `/api/payments` | GET | ✅ | ✅ | ✅ | ❌ | ✅ |
| `/api/payments` | POST | ✅ | ✅ (CLIENT) | ✅ | ❌ | ✅ |
| `/api/transporters` | GET | ✅ | ✅ | ✅ | ❌ | ✅ |
| `/api/transporters` | POST | ✅ | ✅ | ✅ | ❌ | ✅ |
| `/api/trajets` | GET | ✅ | ✅ | ⚠️ | ❌ | ⚠️ |
| `/api/trajets` | POST | ✅ | ✅ | ⚠️ | ❌ | ⚠️ |
| `/api/wallet` | GET | ❌ | ❌ | ❌ | ❌ | 🔴 |
| `/api/wallet` | POST | ❌ | ❌ | ⚠️ | ❌ | 🔴 |
| `/api/notifications` | GET | ❌ | ❌ | ❌ | ❌ | 🔴 |
| `/api/notifications` | POST | ❌ | ❌ | ⚠️ | ❌ | 🔴 |
| `/api/action-logs` | GET | ❌ | ❌ | ❌ | ❌ | 🔴 |
| `/api/action-logs` | POST | ❌ | ❌ | ⚠️ | ❌ | 🔴 |
| `/api/stats` | GET | ❌ | ❌ | ❌ | ❌ | 🔴 |
| `/api/debug-user` | GET | ❌ | ❌ | ❌ | ❌ | 🔴 |
| `/api/debug-users` | GET | ❌ | ❌ | ❌ | ❌ | 🔴 |
| `/api/debug-session` | GET | ❌ | ❌ | ❌ | ❌ | 🔴 |
| `/api/seed` | GET | ❌ | ❌ | ❌ | ❌ | 🔴 |
| `/api/init-db` | GET | ❌ | ❌ | ❌ | ❌ | 🔴 |
| `/api/create-test-relais` | GET | ❌ | ❌ | ❌ | ❌ | 🔴 |
| `/api/test-login` | POST | ❌ | ❌ | ⚠️ | ❌ | 🔴 |
| `/api/admin/relais/validate` | POST | ✅ | ✅ (ADMIN) | ✅ | ❌ | ✅ |
| `/api/admin/transporters/validate` | POST | ✅ | ✅ (ADMIN) | ✅ | ❌ | ✅ |
| `/api/admin/reset-relais-status` | GET | ✅ | ✅ (ADMIN) | ❌ | ❌ | 🔴 |

---

## 🛠️ PLANS DE CORRECTION

### Phase 1: CRITIQUE (1-2 jours)

**1. Corriger SQL Injection dans `/api/seed` et `/api/admin/reset-relais-status`**

```typescript
// ❌ Avant - /api/seed/route.ts
await db.$executeRawUnsafe(`
  INSERT INTO "User" (...) VALUES (gen_random_uuid(), '${adminPassword}', ...)
`);

// ✅ Après
await db.$executeRaw`
  INSERT INTO "User" (id, email, password, name, role, phone, "isActive", "createdAt", "updatedAt")
  VALUES (gen_random_uuid(), ${email}, ${hashedPassword}, ${name}, ${role}, ${phone}, true, NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET password = ${hashedPassword}
`;
```

**2. Désactiver/Sécuriser les endpoints DEBUG**

```typescript
// ✅ Ajouter middleware de protection
export async function GET(request: NextRequest) {
  // Seulement en développement local
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;
  
  // ... rest
}
```

**Ou simplement SUPPRIMER les endpoints:**
- ❌ `/api/debug-user`
- ❌ `/api/debug-users`  
- ❌ `/api/debug-session`
- ❌ `/api/create-test-relais` (ou le sécuriser)
- ❌ `/api/seed` (désactiver en prod)
- ❌ `/api/init-db` (désactiver en prod)
- ❌ `/api/test-login` (supprimer)

**3. Sécuriser les endpoints sensibles**

```typescript
// ✅ /api/action-logs
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);  // ← Ajout
  if (!auth.success) return auth.response;
  
  // ... rest reste identique
}

// ✅ /api/stats
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);  // ← Ajout
  if (!auth.success) return auth.response;
  
  // ... rest
}

// ✅ /api/wallet
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);  // ← Ajout
  if (!auth.success) return auth.response;
  
  const { searchParams } = new URL(request.url);
  const transporteurId = searchParams.get('transporteurId');
  
  // ← Ajout: Vérifier que l'utilisateur accède à son propre wallet
  if (auth.payload.role === 'TRANSPORTER' && transporteurId !== auth.payload.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // ... rest
}

// ✅ /api/relais-cash
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['RELAIS', 'ADMIN']);  // ← Ajout
  if (!auth.success) return auth.response;
  
  const relaisId = searchParams.get('relaisId');
  
  // Vérifier propriété
  const relais = await db.relais.findUnique({ where: { id: relaisId } });
  if (auth.payload.role === 'RELAIS' && relais.userId !== auth.payload.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // ... rest
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['RELAIS', 'ADMIN']);  // ← Ajout
  if (!auth.success) return auth.response;
  
  const body = await request.json();
  const { relaisId, amount, notes } = body;
  
  // Vérifier que RELAIS n'effectue de reversal que sur son propre relais
  const relais = await db.relais.findUnique({ where: { id: relaisId } });
  if (auth.payload.role === 'RELAIS' && relais.userId !== auth.payload.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // userId ne doit pas être pris du body client - utiliser auth.payload.id
  // ... rest
}

// ✅ /api/notifications
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['CLIENT', 'RELAIS', 'TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;
  
  const userId = searchParams.get('userId');
  
  // Vérifier que l'utilisateur accède à ses propres notifications
  if (auth.payload.role !== 'ADMIN' && userId !== auth.payload.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // ... rest
}
```

### Phase 2: MAJEUR (2-3 jours)

**4. Ajouter Rate Limiting**

```typescript
// Helper pattern à ajouter dans chaque endpoint sensible
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateCheck = await checkRateLimit(request, RATE_LIMIT_PRESETS.moderate);
  if (rateCheck.limited) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
    );
  }
  
  // ... reste du code
}
```

**Endpoints à rate limiter:**
- POST `/api/users` - strict (5 req/min)
- POST `/api/relais` - moderate (30 req/min)
- POST `/api/transporters` - moderate (30 req/min)
- POST `/api/auth/signin` - strict (5 req/min)
- POST `/api/payments` - moderate (30 req/min)
- `/api/test-login` - strict (5 req/min)

**5. Améliorer Validation d'Entrée**

Ajouter validation avec Zod/TypeScript runtime:

```typescript
import { z } from 'zod';

const CreateRelaisSchema = z.object({
  userId: z.string().cuid(),
  commerceName: z.string().min(2).max(100),
  address: z.string().min(5).max(255),
  ville: z.string().min(2).max(50),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  photos: z.array(z.string().url()).optional(),
  commerceRegisterNumber: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CreateRelaisSchema.parse(body);  // ← Validation typée
    
    // ... rest
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    // ...
  }
}
```

**6. Sécuriser Information Exposure**

- Supprimer détails d'erreur système en production
- Supprimer `/api/test-login` ou le sécuriser
- Supprimer exposition de hash de mot de passe

### Phase 3: MODÉRÉ (1-2 jours)

**7. Ajouter Vérification de Propriété**

Pour les endpoints qui manquent:
- GET `/api/missions` - filtrer par transporteurId
- GET `/api/trajets` - filtrer par rôle et ownership

**8. Nettoyer Endpoints de Test**

Décider et implémenter pour chaque endpoint de test:
- ❌ Supprimer complètement
- 🔒 Sécuriser (auth + local dev only)
- 📝 Déplacer vers `/api/dev/` avec protection

---

## 📊 Résumé des Corrections

| Problème | Priorité | Effort | Files |
|----------|----------|--------|-------|
| SQL Injection | 🔴 CRITIQUE | 2h | 2 |
| Debug endpoints | 🔴 CRITIQUE | 1h | 6 |
| Endpoints sans auth | 🔴 CRITIQUE | 2h | 5 |
| Rate limiting | 🟠 MAJEUR | 4h | 8 |
| Credentials codés | 🟠 MAJEUR | 1h | 1 |
| Validation input | 🟡 MODÉRÉ | 6h | 5 |
| Vérification propriété | 🟡 MODÉRÉ | 3h | 3 |

**Total estimé: 18-20 heures de travail**

---

## ✅ Checklist post-correction

- [ ] SQL Injection éliminée - Utiliser Prisma ou `$executeRaw` avec params
- [ ] Endpoints DEBUG sécurisés ou supprimés
- [ ] Endpoints sensibles ont `requireRole()`
- [ ] Rate limiting appliqué à endpoints sensibles
- [ ] Credentials test retirés du code
- [ ] Validation d'entrée améliorée (Zod)
- [ ] Information disclosure minimisée
- [ ] Tests e2e updated avec nouvelles restrictions
- [ ] Documentation mise à jour (API security docs)
- [ ] Audit de sécurité répété post-changements

---

## 🔍 Commande d'Activation des Corrections

Pour faciliter le suivi, créer un issue GitHub avec ce template:

```markdown
## Security Fix Tracking

### Critical Issues
- [ ] Fix SQL injection in /api/seed
- [ ] Fix SQL injection in /api/admin/reset-relais-status  
- [ ] Remove/secure /api/debug-* endpoints
- [ ] Add auth to /api/action-logs
- [ ] Add auth to /api/stats
- [ ] Add auth to /api/wallet
- [ ] Add auth to /api/relais-cash
- [ ] Add auth to /api/notifications

### Major Issues
- [ ] Remove test credentials from seed response
- [ ] Remove /api/init-db or secure it
- [ ] Remove /api/test-login or secure it
- [ ] Remove auto-approval in /api/create-test-relais

### Medium Issues  
- [ ] Implement rate limiting (8 endpoints)
- [ ] Improve input validation (5 endpoints)
- [ ] Fix ownership checks (3 endpoints)
- [ ] Minimize error messages

### Testing
- [ ] Run OWASP ZAP / Burp Suite
- [ ] Test all endpoints for auth bypass
- [ ] Run existing smoke tests
- [ ] Performance test rate limiting
```

---

**Report généré par**: AI Security Audit  
**Langue**: Français  
**Framework**: Next.js 16 + Prisma + NextAuth  
**Database**: PostgreSQL  

---

Pour des questions ou clarifications sur ces vulnérabilités, consultez les fichiers spécifiques listés avec leurs liens.
