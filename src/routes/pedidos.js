const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');

/**
 * GET /api/pedidos
 * Lista pedidos
 */
router.get('/', pedidoController.listar);

/**
 * GET /api/pedidos/nfse/listar
 * Lista NFSe (deve vir antes de /:id para evitar conflito)
 */
router.get('/nfse/listar', pedidoController.listarNFSe);

/**
 * GET /api/pedidos/notas/listar
 * Lista todas as notas (NFSe e NFe) combinadas
 */
router.get('/notas/listar', pedidoController.listarTodasNotas);

/**
 * POST /api/pedidos/notas/sincronizar
 * Sincroniza todas as notas da Focus NFe com o banco local
 */
router.post('/notas/sincronizar', pedidoController.sincronizarNotas);

/**
 * GET /api/pedidos/logs
 * Lista logs relacionados a pedidos
 */
router.get('/logs', pedidoController.listarLogsPedidos);

/**
 * PUT /api/pedidos/:id/status
 * Atualiza status de um pedido (deve vir antes de /:id)
 */
router.put('/:id/status', pedidoController.atualizarStatus);

/**
 * GET /api/pedidos/banco
 * Lista pedidos salvos no banco local
 */
router.get('/banco', pedidoController.listarPedidosBanco);

/**
 * POST /api/pedidos/sincronizar-woocommerce
 * Sincroniza pedidos do WooCommerce para o banco local
 */
router.post('/sincronizar-woocommerce', pedidoController.sincronizarPedidosWooCommerce);

/**
 * GET /api/pedidos/:id
 * Busca pedido por ID
 */
router.get('/:id', pedidoController.buscarPorId);

module.exports = router;

