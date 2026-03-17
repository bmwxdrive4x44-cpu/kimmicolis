const express = require('express');
const router = express.Router();
const relaisController = require('../controllers/relaisController');
const { authMiddleware, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Relay registration (for clients who want to become relay points)
router.post('/register', authorize('client'), relaisController.registerRelais);
router.get('/profil', authorize('relais'), relaisController.getRelaisProfile);

// QR Code scanning for relay operations
router.post('/scan/reception', authorize('relais'), relaisController.scanQRReception);
router.post('/scan/livraison', authorize('relais'), relaisController.scanQRLivraison);

// Get packages at this relay
router.get('/colis', authorize('relais'), relaisController.getRelaisColis);

module.exports = router;
