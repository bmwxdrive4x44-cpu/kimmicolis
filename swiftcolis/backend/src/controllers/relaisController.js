const pool = require('../config/database');

// Register as a relay point
exports.registerRelais = async (req, res) => {
  const { 
    nom_commerce, 
    adresse, 
    ville, 
    wilaya, 
    latitude, 
    longitude,
    commission_petit,
    commission_moyen,
    commission_gros
  } = req.body;

  try {
    // Check if user already has a relay
    const existingRelais = await pool.query(
      'SELECT * FROM relais WHERE user_id = $1',
      [req.user.id]
    );

    if (existingRelais.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous avez déjà une demande de relais en cours' 
      });
    }

    // Create relay point
    const newRelais = await pool.query(
      `INSERT INTO relais (
        user_id, nom_commerce, adresse, ville, wilaya, 
        latitude, longitude, commission_petit, commission_moyen, commission_gros
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        req.user.id, nom_commerce, adresse, ville, wilaya,
        latitude, longitude,
        commission_petit || 200,
        commission_moyen || 400,
        commission_gros || 600
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Demande d\'inscription comme relais envoyée. En attente de validation par l\'administrateur.',
      data: newRelais.rows[0]
    });
  } catch (error) {
    console.error('Register relais error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de l\'inscription comme relais',
      error: error.message 
    });
  }
};

// Get relay profile
exports.getRelaisProfile = async (req, res) => {
  try {
    const relais = await pool.query(
      'SELECT * FROM relais WHERE user_id = $1',
      [req.user.id]
    );

    if (relais.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Profil relais non trouvé' 
      });
    }

    res.json({
      success: true,
      data: relais.rows[0]
    });
  } catch (error) {
    console.error('Get relais profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération du profil relais',
      error: error.message 
    });
  }
};

// Scan QR code to receive package
exports.scanQRReception = async (req, res) => {
  const { colis_id, qr_code } = req.body;

  try {
    // Verify package exists and belongs to this relay
    const colis = await pool.query(
      `SELECT c.* FROM colis c
       JOIN relais r ON c.relais_depart_id = r.id OR c.relais_arrivee_id = r.id
       WHERE c.id = $1 AND r.user_id = $2`,
      [colis_id, req.user.id]
    );

    if (colis.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Colis non trouvé ou non associé à ce relais' 
      });
    }

    const colisData = colis.rows[0];

    // Update status to received at relay
    const updatedColis = await pool.query(
      `UPDATE colis 
       SET statut = 'reçu_relais',
           tracking_history = array_append(tracking_history, $1::jsonb)
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify({
        statut: 'reçu_relais',
        date: new Date().toISOString(),
        description: 'Colis reçu au point relais',
        scanned_by: req.user.id,
        relais_id: req.user.id
      }), colis_id]
    );

    // Emit WebSocket event
    if (req.app.get('io')) {
      req.app.get('io').to(`colis_${colis_id}`).emit('status_update', {
        colis_id,
        statut: 'reçu_relais',
        date: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Colis réceptionné avec succès',
      data: updatedColis.rows[0]
    });
  } catch (error) {
    console.error('Scan QR reception error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la réception du colis',
      error: error.message 
    });
  }
};

// Scan QR code to deliver package to client
exports.scanQRLivraison = async (req, res) => {
  const { colis_id, qr_code } = req.body;

  try {
    // Verify package exists and is at this relay
    const colis = await pool.query(
      `SELECT c.* FROM colis c
       JOIN relais r ON c.relais_arrivee_id = r.id
       WHERE c.id = $1 AND r.user_id = $2 AND c.statut = 'arrivé_relais_destination'`,
      [colis_id, req.user.id]
    );

    if (colis.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Colis non trouvé ou pas prêt pour livraison' 
      });
    }

    // Update status to delivered
    const updatedColis = await pool.query(
      `UPDATE colis 
       SET statut = 'livré',
           date_livraison = CURRENT_TIMESTAMP,
           tracking_history = array_append(tracking_history, $1::jsonb)
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify({
        statut: 'livré',
        date: new Date().toISOString(),
        description: 'Colis livré au client',
        scanned_by: req.user.id,
        relais_id: req.user.id
      }), colis_id]
    );

    // Emit WebSocket event
    if (req.app.get('io')) {
      req.app.get('io').to(`colis_${colis_id}`).emit('status_update', {
        colis_id,
        statut: 'livré',
        date: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Colis livré avec succès',
      data: updatedColis.rows[0]
    });
  } catch (error) {
    console.error('Scan QR livraison error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la livraison du colis',
      error: error.message 
    });
  }
};

// Get all packages at this relay
exports.getRelaisColis = async (req, res) => {
  try {
    const colis = await pool.query(
      `SELECT c.*, u.nom as client_nom, u.email as client_email
       FROM colis c
       JOIN users u ON c.client_id = u.id
       WHERE (c.relais_depart_id IN (SELECT id FROM relais WHERE user_id = $1)
              OR c.relais_arrivee_id IN (SELECT id FROM relais WHERE user_id = $1))
         AND c.statut NOT IN ('livré', 'annulé')
       ORDER BY c.date_creation DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: colis.rows
    });
  } catch (error) {
    console.error('Get relais colis error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des colis',
      error: error.message 
    });
  }
};
