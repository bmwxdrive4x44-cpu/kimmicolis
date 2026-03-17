# SwiftColis - Plateforme de Transport de Colis Inter-wilayas Algérie

## 📦 Présentation

SwiftColis est une plateforme logistique complète pour le transport de colis entre les wilayas d'Algérie, similaire à Relais Colis/Mondial Relay.

### Fonctionnalités principales

- **Clients** : Créer et suivre des colis, choisir points relais départ/arrivée
- **Transporteurs** : Publier des trajets, accepter des missions, gérer les tournées
- **Points Relais** : Scanner QR codes, recevoir/remettre des colis
- **Administrateur** : Gérer utilisateurs, valider relais, configurer tarifs, statistiques

## 🏗️ Architecture Technique

### Backend
- **Node.js + Express** : API REST
- **PostgreSQL** : Base de données
- **Socket.IO** : Suivi en temps réel
- **JWT** : Authentification
- **QR Code** : Génération et scan

### Frontend Web
- **React + Vite** : Framework UI
- **Tailwind CSS** : Styling
- **React Router** : Navigation
- **Socket.IO Client** : Temps réel
- **Axios** : Requêtes HTTP

### Application Mobile (à venir)
- **React Native** : iOS & Android

## 📁 Structure du Projet

```
swiftcolis/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js      # Configuration PostgreSQL
│   │   │   └── schema.sql       # Schéma DB complet
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── colisController.js
│   │   │   ├── relaisController.js
│   │   │   ├── transporteurController.js
│   │   │   └── adminController.js
│   │   ├── middleware/
│   │   │   └── auth.js          # JWT & autorisation
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── colisRoutes.js
│   │   │   ├── relaisRoutes.js
│   │   │   ├── transporteurRoutes.js
│   │   │   └── adminRoutes.js
│   │   └── server.js            # Point d'entrée + WebSocket
│   ├── uploads/
│   ├── .env
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── api/                 # Appels API
    │   ├── context/             # Contextes (Auth, Socket)
    │   ├── dashboard/           # Dashboards par rôle
    │   │   ├── client/
    │   │   ├── transporteur/
    │   │   ├── relais/
    │   │   └── admin/
    │   ├── pages/               # Pages publiques
    │   ├── components/          # Composants réutilisables
    │   ├── App.jsx
    │   └── main.jsx
    ├── public/
    └── package.json
```

## 🚀 Installation et Démarrage

### Prérequis
- Node.js >= 18
- PostgreSQL >= 14
- npm ou yarn

### 1. Backend

```bash
cd backend

# Installer les dépendances
npm install

# Configurer la base de données
createdb swiftcolis
psql -d swiftcolis -f src/config/schema.sql

# Copier et configurer .env
cp .env.example .env
# Modifier avec vos credentials DB

# Démarrer le serveur
npm run dev
```

Le serveur démarre sur `http://localhost:5000`

### 2. Frontend

```bash
cd frontend

# Installer les dépendances
npm install

# Démarrer l'application
npm run dev
```

L'application démarre sur `http://localhost:3000`

## 📊 Modèle Économique

- **Prix client** = Tarif ligne + Format colis
- **Commission plateforme** = 15% du prix
- **Commission relais** = 200-600 DZD selon format
- **Net transporteur** = Prix - Commission plateforme - Commission relais

### Tarifs par format
- **Petit** (< 5kg) : 800 DZD
- **Moyen** (5-15kg) : 1500 DZD
- **Gros** (> 15kg) : 2500 DZD

## 🔄 Workflow Colis

1. Client crée un colis → QR code généré
2. Dépôt au relais départ → Scan QR → Statut: `reçu_relais`
3. Matching automatique avec transporteur
4. Transporteur accepte → Statut: `en_transport`
5. Livraison au relais destination → Statut: `arrivé_relais_destination`
6. Client récupère → Statut: `livré`

## 🔐 Rôles et Permissions

| Rôle | Permissions |
|------|-------------|
| Client | Créer colis, suivre, historique |
| Transporteur | Publier trajets, accepter missions, scan QR |
| Relais | Scan QR, réception/remise colis |
| Admin | Gestion complète, validation, stats |

## 📱 API Endpoints Principaux

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/profile` - Profil utilisateur

### Colis
- `POST /api/colis` - Créer un colis
- `GET /api/colis/my-colis` - Mes colis
- `GET /api/colis/:id` - Détails colis
- `GET /api/colis/:id/tracking` - Suivi temps réel

### Relais
- `POST /api/relais/register` - Devenir relais
- `GET /api/relais` - Liste des relais
- `POST /api/relais/scan` - Scanner QR code

### Transporteur
- `POST /api/transporteur/trajets` - Publier trajet
- `GET /api/transporteur/missions-disponibles` - Missions
- `POST /api/transporteur/missions/accepter` - Accepter mission

### Admin
- `GET /api/admin/stats` - Statistiques
- `GET /api/admin/users` - Utilisateurs
- `PATCH /api/admin/relais/:id/validate` - Valider relais

## 🌍 Wilayas Couvertes

Alger, Oran, Constantine, Annaba, Blida, Béjaïa, Sétif, Tlemcen, Tizi Ouzou, Batna, Mostaganem, Tiaret, Tébessa, Biskra, Ouargla

## 📞 Contact

- Email: contact@swiftcolis.dz
- Site: https://swiftcolis.dz

---

© 2024 SwiftColis - Tous droits réservés
