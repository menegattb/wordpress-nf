/**
 * Rotas do painel administrativo (requer login)
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Rota protegida por requireAuth no server.js (mount)
router.get('/dashboard', adminController.getDashboard);
router.post('/criar-cliente', adminController.criarCliente);

module.exports = router;
