const pool = require('../config/database');

// Create a new route/trip
exports.createTrajet = async (req, res) => {
  const { 
    ville_depart, 
    ville_arrivee, 
    villes_etapes, 
    date_depart, 
    places_colis,
    vehicule_type
  } = req.body;

  try {
    const newTrajet = await pool.query(
      `INSERT INTO trajets_transporteurs (
        transporteur_id, ville_depart, ville_arrivee, villes_etapes,
        date_depart, places_colis, places_disponibles, vehicule_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        req.user.id, ville_depart, ville_arrivee, villes_etapes || [],
        date_depart, places_colis || 10, places_colis || 10, vehicule_type
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Trajet créé avec succès',
      data: newTrajet.rows[0]
    });
  } catch (error) {
    console.error('Create trajet error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la création du trajet',
      error: error.message 
    });
  }
};

// Get all routes for current transporter
exports.getTransporteurTrajets = async (req, res) => {
  try {
    const trajets = await pool.query(
      'SELECT * FROM trajets_transporteurs WHERE transporteur_id = $1 ORDER BY date_depart DESC',
      [req.user.id]
    );

    res.json({
      success: true,
      data: trajets.rows
    });
  } catch (error) {
    console.error('Get transporteur trajets error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des trajets',
      error: error.message 
    });
  }
};

// Get available packages for this route (matching algorithm)
exports.getColisDisponibles = async (req, res) => {
  const { trajet_id } = req.params;

  try {
    // Verify trajectory belongs to transporter
    const trajet = await pool.query(
      'SELECT * FROM trajets_transporteurs WHERE id = $1 AND transporteur_id = $2',
      [trajet_id, req.user.id]
    );

    if (trajet.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Trajet non trouvé' 
      });
    }

    const trajetData = trajet.rows[0];

    // Find compatible packages using matching algorithm
    const compatibleColis = await pool.query(
      `SELECT c.*, 
              rd.nom_commerce as relais_depart_nom,
              rd.adresse as adresse_depart,
              ra.nom_commerce as relais_arrivee_nom,
              ra.adresse as adresse_arrivee
       FROM colis c
       LEFT JOIN relais rd ON c.relais_depart_id = rd.id
       LEFT JOIN relais ra ON c.relais_arrivee_id = ra.id
       WHERE c.statut = 'reçu_relais'
         AND (c.ville_depart = $1 OR c.ville_depart = ANY($2::text[]))
         AND (c.ville_arrivee = $3 OR c.ville_arrivee = ANY($2::text[]))
         AND c.id NOT IN (SELECT colis_id FROM missions WHERE statut IN ('assignee', 'acceptee', 'en_cours'))
       LIMIT $4`,
      [
        trajetData.ville_depart,
        trajetData.villes_etapes || [],
        trajetData.ville_arrivee,
        trajetData.places_disponibles
      ]
    );

    res.json({
      success: true,
      data: {
        trajet: trajetData,
        colis_compatibles: compatibleColis.rows
      }
    });
  } catch (error) {
    console.error('Get colis disponibles error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des colis disponibles',
      error: error.message 
    });
  }
};

// Accept a package mission
exports.accepterMission = async (req, res) => {
  const { colis_id, trajet_id } = req.body;

  try {
    // Verify trajectory
    const trajet = await pool.query(
      'SELECT * FROM trajets_transporteurs WHERE id = $1 AND transporteur_id = $2',
      [trajet_id, req.user.id]
    );

    if (trajet.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Trajet non trouvé' 
      });
    }

    // Check if package is available
    const colis = await pool.query(
      'SELECT * FROM colis WHERE id = $1 AND statut = \'reçu_relais\'',
      [colis_id]
    );

    if (colis.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Colis non disponible' 
      });
    }

    // Create mission
    const mission = await pool.query(
      `INSERT INTO missions (colis_id, transporteur_id, trajet_id, statut, date_acceptation)
       VALUES ($1, $2, $3, 'acceptee', CURRENT_TIMESTAMP)
       RETURNING *`,
      [colis_id, req.user.id, trajet_id]
    );

    // Update package status
    await pool.query(
      `UPDATE colis 
       SET statut = 'en_transport',
           tracking_history = array_append(tracking_history, $1::jsonb)
       WHERE id = $2`,
      [JSON.stringify({
        statut: 'en_transport',
        date: new Date().toISOString(),
        description: 'Colis pris en charge par le transporteur',
        transporteur_id: req.user.id
      }), colis_id]
    );

    // Update available places in trajectory
    await pool.query(
      'UPDATE trajets_transporteurs SET places_disponibles = places_disponibles - 1 WHERE id = $1',
      [trajet_id]
    );

    // Emit WebSocket event
    if (req.app.get('io')) {
      req.app.get('io').to(`colis_${colis_id}`).emit('status_update', {
        colis_id,
        statut: 'en_transport',
        date: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Mission acceptée avec succès',
      data: mission.rows[0]
    });
  } catch (error) {
    console.error('Accepter mission error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de l\'acceptation de la mission',
      error: error.message 
    });
  }
};

// Deliver package to destination relay
exports.livrerColis = async (req, res) => {
  const { colis_id } = req.body;

  try {
    // Verify mission exists
    const mission = await pool.query(
      'SELECT * FROM missions WHERE colis_id = $1 AND transporteur_id = $2 AND statut = \'acceptee\'',
      [colis_id, req.user.id]
    );

    if (mission.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Mission non trouvée' 
      });
    }

    // Update package status
    const updatedColis = await pool.query(
      `UPDATE colis 
       SET statut = 'arrivé_relais_destination',
           tracking_history = array_append(tracking_history, $1::jsonb)
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify({
        statut: 'arrivé_relais_destination',
        date: new Date().toISOString(),
        description: 'Colis arrivé au point relais de destination',
        transporteur_id: req.user.id
      }), colis_id]
    );

    // Update mission status
    await pool.query(
      `UPDATE missions SET statut = 'livree', date_livraison = CURRENT_TIMESTAMP WHERE colis_id = $1`,
      [colis_id]
    );

    // Emit WebSocket event
    if (req.app.get('io')) {
      req.app.get('io').to(`colis_${colis_id}`).emit('status_update', {
        colis_id,
        statut: 'arrivé_relais_destination',
        date: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Colis livré au point relais de destination',
      data: updatedColis.rows[0]
    });
  } catch (error) {
    console.error('Livrer colis error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la livraison du colis',
      error: error.message 
    });
  }
};

// Get transporter earnings/stats
exports.getTransporteurStats = async (req, res) => {
  try {
    // Get total missions
    const missionsResult = await pool.query(
      `SELECT COUNT(*) as total_missions,
              SUM(CASE WHEN statut = 'livree' THEN 1 ELSE 0 END) as missions_livrees,
              SUM(CASE WHEN statut IN ('assignee', 'acceptee', 'en_cours') THEN 1 ELSE 0 END) as missions_en_cours
       FROM missions WHERE transporteur_id = $1`,
      [req.user.id]
    );

    // Get total earnings
    const earningsResult = await pool.query(
      `SELECT COALESCE(SUM(c.net_transporteur), 0) as gains_total
       FROM missions m
       JOIN colis c ON m.colis_id = c.id
       WHERE m.transporteur_id = $1 AND m.statut = 'livree'`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        missions: missionsResult.rows[0],
        gains: earningsResult.rows[0]
      }
    });
  } catch (error) {
    console.error('Get transporteur stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message 
    });
  }
};

// Create a tour (multiple packages grouped)
exports.creerTournee = async (req, res) => {
  const { 
    ville_depart, 
    ville_arrivee, 
    villes_etapes, 
    date_depart,
    colis_ids
  } = req.body;

  try {
    const newTournee = await pool.query(
      `INSERT INTO tournees (
        transporteur_id, ville_depart, ville_arrivee, villes_etapes,
        date_depart, colis_ids, statut
      ) VALUES ($1, $2, $3, $4, $5, $6, 'planifiee')
      RETURNING *`,
      [
        req.user.id, ville_depart, ville_arrivee, villes_etapes || [],
        date_depart, colis_ids || []
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Tournée créée avec succès',
      data: newTournee.rows[0]
    });
  } catch (error) {
    console.error('Creer tournee error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la création de la tournée',
      error: error.message 
    });
  }
};
