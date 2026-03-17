const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Register a new user
exports.register = async (req, res) => {
  const { nom, email, password, role, telephone, siret } = req.body;

  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cet email est déjà utilisé' 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await pool.query(
      `INSERT INTO users (nom, email, password, role, telephone, siret) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, nom, email, role, telephone, created_at`,
      [nom, email, hashedPassword, role, telephone, siret]
    );

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser.rows[0].id, email: newUser.rows[0].email, role: newUser.rows[0].role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: {
        user: newUser.rows[0],
        token
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de l\'inscription',
      error: error.message 
    });
  }
};

// Login user
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }

    const user = userResult.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: {
          id: user.id,
          nom: user.nom,
          email: user.email,
          role: user.role,
          telephone: user.telephone
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la connexion',
      error: error.message 
    });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await pool.query(
      'SELECT id, nom, email, role, telephone, siret, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    res.json({
      success: true,
      data: user.rows[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération du profil',
      error: error.message 
    });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  const { nom, telephone } = req.body;

  try {
    const updatedUser = await pool.query(
      `UPDATE users 
       SET nom = COALESCE($1, nom), telephone = COALESCE($2, telephone), updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, nom, email, role, telephone, siret`,
      [nom, telephone, req.user.id]
    );

    res.json({
      success: true,
      message: 'Profil mis à jour',
      data: updatedUser.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la mise à jour du profil',
      error: error.message 
    });
  }
};
