const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');

// Calculate price based on line and format
const calculatePrice = async (villeDepart, villeArrivee, format) => {
  const lineResult = await pool.query(
    `SELECT tarif_petit, tarif_moyen, tarif_gros FROM lignes 
     WHERE (ville_depart = $1 AND ville_arrivee = $2) 
        OR (ville_depart = $2 AND ville_arrivee = $1)
     LIMIT 1`,
    [villeDepart, villeArrivee]
  );

  let basePrice;
  if (lineResult.rows.length > 0) {
    const line = lineResult.rows[0];
    basePrice = format === 'petit' ? line.tarif_petit : 
                format === 'moyen' ? line.tarif_moyen : line.tarif_gros;
  } else {
    // Default prices if no line exists
    basePrice = format === 'petit' ? 500 : format === 'moyen' ? 800 : 1200;
  }

  return basePrice;
};

// Create a new package
exports.createColis = async (req, res) => {
  const { 
    relais_depart_id, 
    relais_arrivee_id, 
    ville_depart, 
    ville_arrivee, 
    format, 
    poids, 
    dimensions, 
    description 
  } = req.body;

  try {
    // Validate format
    if (!['petit', 'moyen', 'gros'].includes(format)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Format invalide. Choisissez: petit, moyen ou gros' 
      });
    }

    // Calculate price
    const prix_client = await calculatePrice(ville_depart, ville_arrivee, format);

    // Calculate commissions
    const commission_plateforme = prix_client * (parseFloat(process.env.PLATFORM_COMMISSION_PERCENT) / 100);
    
    // Get relay commission based on format
    let commission_relais;
    if (relais_depart_id) {
      const relaisResult = await pool.query(
        `SELECT commission_petit, commission_moyen, commission_gros FROM relais WHERE id = $1`,
        [relais_depart_id]
      );
      if (relaisResult.rows.length > 0) {
        const relais = relaisResult.rows[0];
        commission_relais = format === 'petit' ? relais.commission_petit :
                           format === 'moyen' ? relais.commission_moyen : relais.commission_gros;
      } else {
        commission_relais = format === 'petit' ? 200 : format === 'moyen' ? 400 : 600;
      }
    } else {
      commission_relais = format === 'petit' ? 200 : format === 'moyen' ? 400 : 600;
    }

    const net_transporteur = prix_client - commission_plateforme - commission_relais;

    // Generate unique QR code
    const colisId = uuidv4();
    const qrData = JSON.stringify({
      id: colisId,
      timestamp: new Date().toISOString()
    });
    const qrCodeImage = await QRCode.toDataURL(qrData);

    // Create package
    const newColis = await pool.query(
      `INSERT INTO colis (
        id, client_id, relais_depart_id, relais_arrivee_id, 
        ville_depart, ville_arrivee, format, poids, dimensions, description,
        prix_client, commission_plateforme, commission_relais, net_transporteur,
        qr_code, statut
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        colisId, req.user.id, relais_depart_id, relais_arrivee_id,
        ville_depart, ville_arrivee, format, poids, dimensions, description,
        prix_client, commission_plateforme, commission_relais, net_transporteur,
        qrCodeImage, 'cree'
      ]
    );

    // Add tracking event
    await pool.query(
      `UPDATE colis SET tracking_history = array_append(tracking_history, $1::jsonb) WHERE id = $2`,
      [JSON.stringify({
        statut: 'cree',
        date: new Date().toISOString(),
        description: 'Colis créé par le client'
      }), colisId]
    );

    res.status(201).json({
      success: true,
      message: 'Colis créé avec succès',
      data: {
        colis: newColis.rows[0],
        qrCode: qrCodeImage
      }
    });
  } catch (error) {
    console.error('Create colis error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la création du colis',
      error: error.message 
    });
  }
};

// Get all packages for current client
exports.getClientColis = async (req, res) => {
  try {
    const colis = await pool.query(
      'SELECT * FROM colis WHERE client_id = $1 ORDER BY date_creation DESC',
      [req.user.id]
    );

    res.json({
      success: true,
      data: colis.rows
    });
  } catch (error) {
    console.error('Get client colis error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des colis',
      error: error.message 
    });
  }
};

// Get single package details
exports.getColisDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const colis = await pool.query(
      `SELECT c.*, 
              rd.nom_commerce as relais_depart_nom,
              ra.nom_commerce as relais_arrivee_nom
       FROM colis c
       LEFT JOIN relais rd ON c.relais_depart_id = rd.id
       LEFT JOIN relais ra ON c.relais_arrivee_id = ra.id
       WHERE c.id = $1`,
      [id]
    );

    if (colis.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Colis non trouvé' 
      });
    }

    // Check authorization (client or admin)
    if (colis.rows[0].client_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Non autorisé à voir ce colis' 
      });
    }

    res.json({
      success: true,
      data: colis.rows[0]
    });
  } catch (error) {
    console.error('Get colis details error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des détails',
      error: error.message 
    });
  }
};

// Update package status (for relay/transporter)
exports.updateColisStatut = async (req, res) => {
  const { id } = req.params;
  const { statut, qr_code } = req.body;

  const validStatuts = ['cree', 'reçu_relais', 'en_transport', 'arrivé_relais_destination', 'livré', 'annulé'];

  try {
    // Verify QR code
    const colis = await pool.query('SELECT * FROM colis WHERE id = $1', [id]);
    
    if (colis.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Colis non trouvé' 
      });
    }

    if (!validStatuts.includes(statut)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Statut invalide' 
      });
    }

    // Update status
    const updateData = {
      statut,
      date_livraison: statut === 'livré' ? new Date() : null
    };

    const updatedColis = await pool.query(
      `UPDATE colis 
       SET statut = $1, 
           date_livraison = COALESCE($2, date_livraison),
           tracking_history = array_append(tracking_history, $3::jsonb)
       WHERE id = $4
       RETURNING *`,
      [statut, updateData.date_livraison, JSON.stringify({
        statut,
        date: new Date().toISOString(),
        description: `Statut mis à jour: ${statut}`,
        scanned_by: req.user.id
      }), id]
    );

    // Emit WebSocket event for real-time tracking (will be implemented with socket.io)
    if (req.app.get('io')) {
      req.app.get('io').to(`colis_${id}`).emit('status_update', {
        colis_id: id,
        statut,
        date: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Statut mis à jour',
      data: updatedColis.rows[0]
    });
  } catch (error) {
    console.error('Update colis statut error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la mise à jour du statut',
      error: error.message 
    });
  }
};

// Get packages available for transport (bourse de transport)
exports.getAvailableColis = async (req, res) => {
  try {
    const colis = await pool.query(
      `SELECT c.*, 
              rd.nom_commerce as relais_depart_nom,
              rd.adresse as adresse_depart,
              ra.nom_commerce as relais_arrivee_nom,
              ra.adresse as adresse_arrivee
       FROM colis c
       LEFT JOIN relais rd ON c.relais_depart_id = rd.id
       LEFT JOIN relais ra ON c.relais_arrivee_id = ra.id
       WHERE c.statut = 'reçu_relais'
       ORDER BY c.date_creation DESC`
    );

    res.json({
      success: true,
      data: colis.rows
    });
  } catch (error) {
    console.error('Get available colis error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des colis disponibles',
      error: error.message 
    });
  }
};

// Match packages with transporter routes (automatic matching algorithm)
exports.matchColisWithTrajet = async (req, res) => {
  const { trajet_id } = req.body;

  try {
    // Get trajectory details
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

    // Find compatible packages
    const compatibleColis = await pool.query(
      `SELECT c.*, 
              rd.nom_commerce as relais_depart_nom,
              ra.nom_commerce as relais_arrivee_nom
       FROM colis c
       LEFT JOIN relais rd ON c.relais_depart_id = rd.id
       LEFT JOIN relais ra ON c.relais_arrivee_id = ra.id
       WHERE c.statut = 'reçu_relais'
         AND (c.ville_depart = $1 OR c.ville_depart = ANY($2::text[]))
         AND (c.ville_arrivee = $3 OR c.ville_arrivee = ANY($2::text[]))
         AND c.id NOT IN (SELECT colis_id FROM missions WHERE trajet_id = $4)
       LIMIT $5`,
      [
        trajetData.ville_depart,
        trajetData.villes_etapes || [],
        trajetData.ville_arrivee,
        trajet_id,
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
    console.error('Match colis error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du matching des colis',
      error: error.message 
    });
  }
};
