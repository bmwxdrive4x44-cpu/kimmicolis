# SwiftColis - Plateforme de Livraison Inter-Wilayas

Plateforme de livraison de colis inter-wilayas en Algérie avec gestion des transporteurs, points relais et clients.

## 🚀 Fonctionnalités

- **4 rôles utilisateur**: Client, Transporteur, Point Relais, Admin
- **Multi-langue**: Français, Arabe, Anglais, Espagnol
- **Création de colis** avec calcul automatique des prix
- **Suivi en temps réel** des colis
- **Gestion des lignes de transport**
- **Dashboard administrateur** complet

## 🛠 Stack Technique

- **Frontend**: Next.js 16, React, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Base de données**: PostgreSQL (Neon, Supabase, etc.)
- **ORM**: Prisma
- **Authentification**: NextAuth.js
- **i18n**: next-intl

## 📋 Prérequis

- Node.js 18+
- npm ou bun
- Une base PostgreSQL (Neon, Supabase, etc.)

## 🚀 Installation Locale

```bash
# Cloner le repo
git clone https://github.com/bmwxdrive4x44-cpu/kimmicolis.git
cd kimmicolis

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env

# Pour le développement local, vous pouvez utiliser SQLite
# Modifier DATABASE_URL dans .env:
# DATABASE_URL="file:./dev.db"

# Générer le client Prisma
npx prisma generate

# Créer la base de données et les tables
npx prisma db push

# Peupler avec des données de test
curl http://localhost:3000/api/seed

# Lancer le serveur de développement
npm run dev
```

## 🔐 Identifiants de Test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@swiftcolis.dz | admin123 |
| Client | client@demo.dz | client123 |
| Transporteur | transport@demo.dz | transport123 |
| Point Relais | relais@demo.dz | relais123 |

## 🌐 Déploiement sur Vercel

### 1. Créer une base PostgreSQL gratuite

**Option A: Neon (recommandé)**
1. Allez sur https://neon.tech
2. Créez un compte gratuit
3. Créez un nouveau projet
4. Copiez l'URL de connexion

**Option B: Supabase**
1. Allez sur https://supabase.com
2. Créez un projet
3. Copiez l'URL de connexion depuis Settings > Database

### 2. Importer dans Vercel

1. Allez sur https://vercel.com/new
2. Importez le repo `bmwxdrive4x44-cpu/kimmicolis`
3. Configurez les variables d'environnement:

| Variable | Valeur |
|----------|--------|
| `DATABASE_URL` | URL PostgreSQL (Neon/Supabase) |
| `NEXTAUTH_SECRET` | Générez avec: `openssl rand -base64 32` |

### 3. Initialiser la base de données

Après le déploiement, allez sur:
```
https://votre-app.vercel.app/api/seed
```

Cela créera les utilisateurs de test et les lignes de transport.

## 📁 Structure du Projet

```
src/
├── app/                    # App Router Next.js
│   ├── [locale]/          # Routes internationalisées
│   │   ├── auth/          # Authentification
│   │   ├── dashboard/     # Dashboards par rôle
│   │   └── page.tsx       # Page d'accueil
│   └── api/               # API Routes
│       ├── auth/          # NextAuth
│       ├── seed/          # Initialisation DB
│       ├── parcels/       # Gestion colis
│       └── ...
├── components/            # Composants React
│   ├── ui/               # Composants shadcn/ui
│   ├── layout/           # Header, Footer
│   └── dashboard/        # Composants dashboard
├── lib/                   # Utilitaires
├── messages/              # Fichiers de traduction (FR, AR, EN, ES)
└── i18n/                  # Configuration i18n
```

## 📝 Scripts Disponibles

```bash
npm run dev        # Serveur de développement
npm run build      # Build production
npm run start      # Serveur production
npm run lint       # Linting
npx prisma studio  # Interface base de données
```

## 🌍 Langues Supportées

- 🇫🇷 Français (par défaut)
- 🇩🇿 Arabe
- 🇬🇧 Anglais
- 🇪🇸 Espagnol

## 📄 Licence

MIT
