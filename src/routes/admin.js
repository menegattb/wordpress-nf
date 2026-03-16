/**
 * Rotas do painel administrativo (requer login)
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Rota protegida por requireAuth no server.js (mount)
router.get('/dashboard', adminController.getDashboard);

module.exports = router;
