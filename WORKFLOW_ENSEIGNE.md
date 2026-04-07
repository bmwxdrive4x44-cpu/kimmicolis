# Modèle Logistique Enseigne - Documentation Officielle

**Date**: 5 avril 2026  
**Version**: 1.0  
**Périmètre**: Flux SwiftColis for Professional Shops (Enseignes)

## Vue d'ensemble

Le modèle d'enseigne SwiftColis repose sur une séparation stricte entre **paiement digital**, **dépôt logistique**, et **orchestration de transport** par la plateforme.

### Principes fondamentaux

1. **Paiement 100% en ligne**
   - Aucun encaissement au relais
   - Méthodes autorisées: CIB, Edahabia, BaridiMob, Stripe, Virement bancaire
   - Confirmation requise via webhook PSP
   - Condition obligatoire pour activer le traitement logistique

2. **Relais comme point logistique**
   - Rôle: dépôt/décollage de colis
   - Pas de service financier
   - Intégration avec système de statuts de disponibilité (imprimante, suspension, etc.)

3. **Dispatch orchestré**
   - Deux modes: standard (au relais) et volume (relais ou directement l'enseigne)
   - Assignation transporteur dynamique basée sur:
     - Disponibilité colis (PAID + DEPOSITED_RELAY)
     - Volume et règles métier
     - Préférences transporteur (auto-assign)

---

## Flux de traitement complet

### État 1 : Création (CREATED)
```
- Enseigne crée colis manuellement ou via CSV
- Statut: CREATED
- Hors circuit logistique
- Action requise: paiement en ligne
```

### État 2 : Paiement digital (PAID)
```
- Enseigne crée intention de paiement via /api/enseignes/payments?
- PSP traite le paiement (CIB, Edahabia, etc.)
- Webhook PSP confirme → statut: PAID
- Colis entre dans le circuit logistique
- Action requise: dépôt au relais
```

### État 3 : Dépôt logistique (DEPOSITED_RELAY)
```
- Enseigne dépose physiquement au relais de départ
- Statut: DEPOSITED_RELAY
- Relais n'encaisse rien (paiement déjà effectué)
- Statut d'imprimante relais peut être READY, BROKEN, OUT_OF_PAPER, NOT_EQUIPPED
- Action: dispatch transporteur se déclenche (standard ou volume)
```

### État 4 : Reçu relais (RECU_RELAIS)
```
- Transporteur avoir confirmé réception physique au relais
- Colis prêt pour enlèvement
```

### États 5-7 : Transport et livraison
```
- EN_TRANSPORT: mission en cours
- ARRIVE_RELAIS_DESTINATION: arrivé au relais d'arrivée
- LIVRE: livré au destinataire final
```

---

## Règles métier - Éligibilité au matching

Un colis enseigne est éligible au matching transporteur si **ET** :

1. **Statut requis**: PAID, DEPOSITED_RELAY ou RECU_RELAIS
2. **Paiement confirmé**: webhook PSP traité
3. **Relais valides**:
   - Statut: APPROVED
   - Opérationnel: != SUSPENDU
4. **Ligne active**: trajet direct ou indirect entre villes

**Important**: Aucun colis en CREATED ne peut être matché, même s'il a une ligne active.

---

## Méthodes de paiement

### Autorisées pour enseigne
- **CIB** (Algérie)
- **Edahabia** (Algérie)
- **BaridiMob** (Algérie)
- **Stripe** (test/production)
- **Virement bancaire**

### Interdites pour enseigne
- **CASH_RELAY**: Paiement au relais ❌
- Toute transaction sans confirmation webhook PSP

---

## Endpoints enseigne clés

### GET `/api/enseignes/payments`
Récupère colis en attente de paiement (statut CREATED).

### PUT `/api/enseignes/payments`
Crée des intentions de paiement en lot.
- Paramètre: `paymentMethod` (rejette CASH_RELAY)
- Paramètre: `batchReference` (obligatoire, min 6 chars)
- Réponse: intents de paiement PENDING

### POST `/api/enseignes/imports`
Import bulk de colis avec assignation auto (si PAID).
- Statut créé initial: CREATED
- Matching déclenché si PAID
- Messages clairs sur blocages paiement

---

## Dashboard enseigne - Cycle métier

**Page /dashboard/enseigne** guide l'enseigne par étapes:

1. **Créer** (onglet "Imports" ou création manuelle)
2. **Régler en ligne** (onglet "Paiements")
3. **Déposer au relais** (point logistique, zéro encaissement)
4. **Suivre** la collecte et transport (onglet "Suivi colis")

Métriques affichées:
- _À préparer_ (CREATED colis)
- _Prêts à assigner_ (PAID + logistique)
- _En transport_ (missions actives)
- _Livrés_ (LIVRE)

---

## Statuts de colis enseigne visibles en UI

| Statut DB | Label UI | Couleur | Signification |
|-----------|----------|--------|---------------|
| CREATED | Créé | gris | Création termin., paiement manquant |
| PAID | Payé en ligne | ambre | Paiement digital confirmé |
| DEPOSITED_RELAY | Déposé au relais | orange | Prêt pour enlèvement transport |
| EN_TRANSPORT | En transport | bleu | Mission transporteur en cours |
| ARRIVE_RELAIS_DESTINATION | Arrivé relais dest. | cyan | À la relais destination |
| LIVRE | Livré | vert | Livraison finalisée |
| ANNULÉ | Annulé | rouge | Colis annulé |

---

## Sécurité et conformité

### Paiement
- Signatures webhook vérifiées (HMAC-SHA256)
- Pas de statut PAID sans confirmation PSP
- Batch reference obligatoire pour traçabilité

### Multitenancy
- Enseigne ne peut gérer que ses propres colis
- Admin peut auditer/gérer n'importe quel enseigne
- Logs d'actions traçés (actionLog)

### Relais
- Pas de révision des montants colis
- Statut de disponibilité (imprimante) auto-reporté
- Aucun accès aux données financières client

---

## Tests et validation

### E2E smoke tests
Fichier: `tests/e2e/enseigne-payment-workflow.spec.ts`

Valide:
- Création compte enseigne
- Absence CASH_RELAY en UI et API
- Descriptions de workflow actualisées
- Éligibilité matching post-paiement

Lancer:
```bash
npm run test:e2e -- enseigne-payment-workflow.spec.ts
```

### Audit manuel
1. Accès `/dashboard/enseigne` en tant qu'enseigne
2. Vérifier onglet "Paiements": pas "Espèces relais"
3. Créer 3 colis via import CSV
4. Passer paiement en ligne
5. Vérifier statut PAID et assignation transporteur

---

## Migration depuis ancien modèle (si applicable)

Si le système avait des colis PAID_RELAY hérités:
1. Aucun nouveau colis PAID_RELAY créé
2. Colis existants restent PAID_RELAY (backward compat)
3. Dashboard et API priorisent PAID pour flux enseigne

---

## Contacts et escalade

- **Questions métier**: Équipe product @swiftcolis
- **Issues API paiement**: Intégration PSP / webhook
- **Issues relais**: Opérations / suspensions

---

**Dernière mise à jour**: 5 avril 2026  
**Responsable**: Architecture logistique enseigne
