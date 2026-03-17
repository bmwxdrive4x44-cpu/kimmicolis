const express = require('express');
const router = express.Router();
const transporteurController = require('../controllers/transporteurController');
const { authMiddleware, authorize } = require('../middleware/auth');

// All routes require authentication and transporter role
router.use(authMiddleware);
router.use(authorize('transporteur'));

// Route management
router.post('/trajets', transporteurController.createTrajet);
router.get('/trajets', transporteurController.getTransporteurTrajets);

// Get available packages for a specific route
router.get('/trajets/:trajet_id/colis', transporteurController.getColisDisponibles);

// Mission management
router.post('/missions/accepter', transporteurController.accepterMission);
router.post('/missions/livrer', transporteurController.livrerColis);

// Tour management
router.post('/tournees', transporteurController.creerTournee);

// Statistics and earnings
router.get('/stats', transporteurController.getTransporteurStats);

module.exports = router;
