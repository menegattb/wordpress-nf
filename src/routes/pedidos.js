const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');

/**
 * GET /api/pedidos
 * Lista pedidos
 */
router.get('/', pedidoController.listar);

/**
 * GET /api/pedidos/:id
 * Busca pedido por ID
 */
router.get('/:id', pedidoController.buscarPorId);

/**
 * GET /api/pedidos/nfse/listar
 * Lista NFSe
 */
router.get('/nfse/listar', pedidoController.listarNFSe);

module.exports = router;

