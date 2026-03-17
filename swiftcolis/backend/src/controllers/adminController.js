const pool = require('../config/database');

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await pool.query(
      'SELECT id, nom, email, role, telephone, created_at FROM users ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      data: users.rows
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des utilisateurs',
      error: error.message 
    });
  }
};

// Get all relay points with validation status
exports.getAllRelais = async (req, res) => {
  try {
    const relais = await pool.query(
      `SELECT r.*, u.nom as proprietaire_nom, u.email as proprietaire_email
       FROM relais r
       JOIN users u ON r.user_id = u.id
       ORDER BY r.created_at DESC`
    );

    res.json({
      success: true,
      data: relais.rows
    });
  } catch (error) {
    console.error('Get all relais error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des relais',
      error: error.message 
    });
  }
};

// Validate or reject relay registration
exports.validateRelais = async (req, res) => {
  const { relais_id, statut_validation } = req.body;

  if (!['valide', 'refuse'].includes(statut_validation)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Statut invalide. Choisissez: valide ou refuse' 
    });
  }

  try {
    const updatedRelais = await pool.query(
      `UPDATE relais 
       SET statut_validation = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [statut_validation, relais_id]
    );

    if (updatedRelais.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Relais non trouvé' 
      });
    }

    res.json({
      success: true,
      message: `Relais ${statut_validation === 'valide' ? 'validé' : 'refusé'} avec succès`,
      data: updatedRelais.rows[0]
    });
  } catch (error) {
    console.error('Validate relais error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la validation du relais',
      error: error.message 
    });
  }
};

// Get all transport lines
exports.getLignes = async (req, res) => {
  try {
    const lignes = await pool.query(
      'SELECT * FROM lignes ORDER BY ville_depart, ville_arrivee'
    );

    res.json({
      success: true,
      data: lignes.rows
    });
  } catch (error) {
    console.error('Get lignes error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des lignes',
      error: error.message 
    });
  }
};

// Create a new transport line
exports.createLigne = async (req, res) => {
  const { 
    ville_depart, 
    ville_arrivee, 
    tarif_petit, 
    tarif_moyen, 
    tarif_gros,
    distance_km,
    duree_estimee
  } = req.body;

  try {
    const newLigne = await pool.query(
      `INSERT INTO lignes (
        ville_depart, ville_arrivee, tarif_petit, tarif_moyen, tarif_gros,
        distance_km, duree_estimee
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        ville_depart, ville_arrivee, tarif_petit, tarif_moyen, tarif_gros,
        distance_km, duree_estimee
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Ligne créée avec succès',
      data: newLigne.rows[0]
    });
  } catch (error) {
    console.error('Create ligne error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la création de la ligne',
      error: error.message 
    });
  }
};

// Update transport line tariffs
exports.updateLigneTarifs = async (req, res) => {
  const { ligne_id, tarif_petit, tarif_moyen, tarif_gros } = req.body;

  try {
    const updatedLigne = await pool.query(
      `UPDATE lignes 
       SET tarif_petit = COALESCE($1, tarif_petit),
           tarif_moyen = COALESCE($2, tarif_moyen),
           tarif_gros = COALESCE($3, tarif_gros)
       WHERE id = $4
       RETURNING *`,
      [tarif_petit, tarif_moyen, tarif_gros, ligne_id]
    );

    if (updatedLigne.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ligne non trouvée' 
      });
    }

    res.json({
      success: true,
      message: 'Tarifs mis à jour avec succès',
      data: updatedLigne.rows[0]
    });
  } catch (error) {
    console.error('Update ligne tarifs error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la mise à jour des tarifs',
      error: error.message 
    });
  }
};

// Get platform statistics
exports.getStats = async (req, res) => {
  try {
    // Total users by role
    const usersStats = await pool.query(
      `SELECT role, COUNT(*) as count FROM users GROUP BY role`
    );

    // Total packages by status
    const colisStats = await pool.query(
      `SELECT statut, COUNT(*) as count FROM colis GROUP BY statut`
    );

    // Total revenue (platform commissions)
    const revenueStats = await pool.query(
      `SELECT COALESCE(SUM(commission_plateforme), 0) as revenue_total FROM colis WHERE statut != 'annulé'`
    );

    // Packages this month
    const monthlyStats = await pool.query(
      `SELECT COUNT(*) as colis_ce_mois FROM colis 
       WHERE date_creation >= DATE_TRUNC('month', CURRENT_DATE)`
    );

    // Active transporters
    const transporterStats = await pool.query(
      `SELECT COUNT(DISTINCT transporteur_id) as transporteurs_actifs 
       FROM missions 
       WHERE date_acceptation >= NOW() - INTERVAL '30 days'`
    );

    res.json({
      success: true,
      data: {
        utilisateurs: usersStats.rows,
        colis: colisStats.rows,
        revenue: revenueStats.rows[0],
        mensuel: monthlyStats.rows[0],
        transporteurs: transporterStats.rows[0]
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message 
    });
  }
};

// Get all packages (for monitoring)
exports.getAllColis = async (req, res) => {
  try {
    const colis = await pool.query(
      `SELECT c.*, 
              u.nom as client_nom,
              rd.nom_commerce as relais_depart_nom,
              ra.nom_commerce as relais_arrivee_nom
       FROM colis c
       JOIN users u ON c.client_id = u.id
       LEFT JOIN relais rd ON c.relais_depart_id = rd.id
       LEFT JOIN relais ra ON c.relais_arrivee_id = ra.id
       ORDER BY c.date_creation DESC`
    );

    res.json({
      success: true,
      data: colis.rows
    });
  } catch (error) {
    console.error('Get all colis error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des colis',
      error: error.message 
    });
  }
};

// Delete a user (admin only)
exports.deleteUser = async (req, res) => {
  const { user_id } = req.params;

  try {
    await pool.query('DELETE FROM users WHERE id = $1', [user_id]);

    res.json({
      success: true,
      message: 'Utilisateur supprimé avec succès'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la suppression de l\'utilisateur',
      error: error.message 
    });
  }
};

// Update platform commission percentage
exports.updateCommission = async (req, res) => {
  const { commission_percent } = req.body;

  try {
    // In a real app, this would be stored in a settings table
    // For now, we'll just update the environment variable in memory
    process.env.PLATFORM_COMMISSION_PERCENT = commission_percent;

    res.json({
      success: true,
      message: 'Commission plateforme mise à jour',
      data: { commission_percent }
    });
  } catch (error) {
    console.error('Update commission error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la mise à jour de la commission',
      error: error.message 
    });
  }
};
