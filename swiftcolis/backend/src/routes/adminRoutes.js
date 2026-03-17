const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, authorize } = require('../middleware/auth');

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(authorize('admin'));

// User management
router.get('/users', adminController.getAllUsers);
router.delete('/users/:user_id', adminController.deleteUser);

// Relay management
router.get('/relais', adminController.getAllRelais);
router.put('/relais/validate', adminController.validateRelais);

// Transport lines management
router.get('/lignes', adminController.getLignes);
router.post('/lignes', adminController.createLigne);
router.put('/lignes/tarifs', adminController.updateLigneTarifs);

// Platform statistics
router.get('/stats', adminController.getStats);

// Package monitoring
router.get('/colis', adminController.getAllColis);

// Commission settings
router.put('/commission', adminController.updateCommission);

module.exports = router;
