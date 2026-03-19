/**
 * Rotas do painel administrativo (requer login)
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/dashboard', adminController.getDashboard);
router.post('/criar-cliente', adminController.criarCliente);
router.get('/tenant/:id/config', adminController.getClienteConfig);
router.post('/tenant/:id/config', adminController.salvarClienteConfig);
router.post('/tenant/:id/limite-notas', adminController.atualizarLimiteNotas);
router.post('/tenant/:id/excluir', adminController.excluirCliente);

module.exports = router;
