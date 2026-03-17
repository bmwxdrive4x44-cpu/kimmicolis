-- SwiftColis Database Schema
-- PostgreSQL Database for Logistics Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('client', 'transporteur', 'relais', 'admin')),
    telephone VARCHAR(20),
    siret VARCHAR(50),
    google_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relay Points Table
CREATE TABLE IF NOT EXISTS relais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    nom_commerce VARCHAR(255) NOT NULL,
    adresse TEXT NOT NULL,
    ville VARCHAR(100) NOT NULL,
    wilaya VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    photos TEXT[],
    commission_petit DECIMAL(10, 2) DEFAULT 200,
    commission_moyen DECIMAL(10, 2) DEFAULT 400,
    commission_gros DECIMAL(10, 2) DEFAULT 600,
    statut_validation VARCHAR(50) DEFAULT 'en_attente' CHECK (statut_validation IN ('en_attente', 'valide', 'refuse')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transport Lines Table
CREATE TABLE IF NOT EXISTS lignes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ville_depart VARCHAR(100) NOT NULL,
    ville_arrivee VARCHAR(100) NOT NULL,
    tarif_petit DECIMAL(10, 2) NOT NULL DEFAULT 500,
    tarif_moyen DECIMAL(10, 2) NOT NULL DEFAULT 800,
    tarif_gros DECIMAL(10, 2) NOT NULL DEFAULT 1200,
    distance_km INTEGER,
    duree_estimee INTEGER,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Packages Table
CREATE TABLE IF NOT EXISTS colis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    relais_depart_id UUID REFERENCES relais(id),
    relais_arrivee_id UUID REFERENCES relais(id),
    ville_depart VARCHAR(100) NOT NULL,
    ville_arrivee VARCHAR(100) NOT NULL,
    format VARCHAR(50) NOT NULL CHECK (format IN ('petit', 'moyen', 'gros')),
    poids DECIMAL(10, 2),
    dimensions VARCHAR(100),
    description TEXT,
    prix_client DECIMAL(10, 2) NOT NULL,
    commission_plateforme DECIMAL(10, 2),
    commission_relais DECIMAL(10, 2),
    net_transporteur DECIMAL(10, 2),
    statut VARCHAR(50) DEFAULT 'cree' CHECK (statut IN ('cree', 'reçu_relais', 'en_transport', 'arrivé_relais_destination', 'livré', 'annulé')),
    qr_code VARCHAR(500) UNIQUE,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_livraison TIMESTAMP,
    tracking_history JSONB[] DEFAULT ARRAY[]::JSONB[]
);

-- Transporter Routes Table
CREATE TABLE IF NOT EXISTS trajets_transporteurs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transporteur_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ville_depart VARCHAR(100) NOT NULL,
    ville_arrivee VARCHAR(100) NOT NULL,
    villes_etapes TEXT[],
    date_depart TIMESTAMP NOT NULL,
    places_colis INTEGER NOT NULL DEFAULT 10,
    places_disponibles INTEGER NOT NULL DEFAULT 10,
    statut VARCHAR(50) DEFAULT 'planifie' CHECK (statut IN ('planifie', 'en_cours', 'termine', 'annule')),
    vehicule_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Missions Table (Link between packages and transporters)
CREATE TABLE IF NOT EXISTS missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    colis_id UUID REFERENCES colis(id) ON DELETE CASCADE,
    transporteur_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trajet_id UUID REFERENCES trajets_transporteurs(id) ON DELETE CASCADE,
    statut VARCHAR(50) DEFAULT 'assignee' CHECK (statut IN ('assignee', 'acceptee', 'en_cours', 'livree', 'annulee')),
    date_acceptation TIMESTAMP,
    date_livraison TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tours Table (Multiple packages grouped for a transporter)
CREATE TABLE IF NOT EXISTS tournees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transporteur_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ville_depart VARCHAR(100) NOT NULL,
    ville_arrivee VARCHAR(100) NOT NULL,
    villes_etapes TEXT[],
    date_depart TIMESTAMP NOT NULL,
    statut VARCHAR(50) DEFAULT 'planifiee' CHECK (statut IN ('planifiee', 'en_cours', 'terminee', 'annulee')),
    colis_ids UUID[],
    gains_total DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    titre VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    lu BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews Table
CREATE TABLE IF NOT EXISTS avis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auteur_id UUID REFERENCES users(id) ON DELETE CASCADE,
    cible_id UUID REFERENCES users(id) ON DELETE CASCADE,
    note INTEGER CHECK (note >= 1 AND note <= 5),
    commentaire TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_relais_ville ON relais(ville);
CREATE INDEX IF NOT EXISTS idx_relais_statut ON relais(statut_validation);
CREATE INDEX IF NOT EXISTS idx_lignes_villes ON lignes(ville_depart, ville_arrivee);
CREATE INDEX IF NOT EXISTS idx_colis_client ON colis(client_id);
CREATE INDEX IF NOT EXISTS idx_colis_statut ON colis(statut);
CREATE INDEX IF NOT EXISTS idx_colis_villes ON colis(ville_depart, ville_arrivee);
CREATE INDEX IF NOT EXISTS idx_trajets_transporteur ON trajets_transporteurs(transporteur_id);
CREATE INDEX IF NOT EXISTS idx_trajets_villes ON trajets_transporteurs(ville_depart, ville_arrivee);
CREATE INDEX IF NOT EXISTS idx_missions_colis ON missions(colis_id);
CREATE INDEX IF NOT EXISTS idx_missions_transporteur ON missions(transporteur_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- Insert sample data for Algerian Wilayas lines
INSERT INTO lignes (ville_depart, ville_arrivee, tarif_petit, tarif_moyen, tarif_gros, distance_km, duree_estimee) VALUES
('Alger', 'Oran', 800, 1200, 1800, 430, 360),
('Alger', 'Constantine', 700, 1000, 1500, 400, 300),
('Alger', 'Annaba', 900, 1300, 1900, 530, 420),
('Alger', 'Blida', 300, 500, 700, 50, 60),
('Alger', 'Tizi Ouzou', 400, 600, 900, 100, 90),
('Oran', 'Alger', 800, 1200, 1800, 430, 360),
('Oran', 'Tlemcen', 400, 600, 900, 140, 120),
('Constantine', 'Alger', 700, 1000, 1500, 400, 300),
('Constantine', 'Annaba', 300, 500, 700, 90, 90),
('Blida', 'Alger', 300, 500, 700, 50, 60)
ON CONFLICT DO NOTHING;
