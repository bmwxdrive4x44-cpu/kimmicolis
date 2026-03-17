const express = require('express');
const router = express.Router();
const colisController = require('../controllers/colisController');
const { authMiddleware, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Client routes
router.post('/', authorize('client', 'admin'), colisController.createColis);
router.get('/mes-colis', authorize('client'), colisController.getClientColis);
router.get('/disponibles', authorize('transporteur'), colisController.getAvailableColis);
router.get('/:id', colisController.getColisDetails);
router.put('/:id/statut', authorize('relais', 'transporteur', 'admin'), colisController.updateColisStatut);

// Matching endpoint
router.post('/match', authorize('transporteur'), colisController.matchColisWithTrajet);

module.exports = router;
