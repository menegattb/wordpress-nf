const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const webhookFocusController = require('../controllers/webhookFocusController');
const { optionalTenantAuth } = require('../middleware/tenantAuth');

/**
 * POST /api/webhook/woocommerce
 * Recebe webhook do WooCommerce (plugin encaminha com X-Tenant-Token)
 */
router.post('/woocommerce', optionalTenantAuth, webhookController.processarWebhook);

/**
 * POST /api/webhook/focus-nfe
 * Recebe webhook da Focus NFe (notificações de notas)
 */
router.post('/focus-nfe', webhookController.processarWebhookFocusNFe);

/**
 * GET /api/webhook/focus/listar
 * Lista todos os webhooks cadastrados
 */
router.get('/focus/listar', webhookFocusController.listar);

/**
 * POST /api/webhook/focus/criar
 * Cria um webhook na Focus NFe
 */
router.post('/focus/criar', webhookFocusController.criar);

/**
 * POST /api/webhook/focus/reenviar/:referencia
 * Reenvia notificação para uma nota específica
 */
router.post('/focus/reenviar/:referencia', webhookFocusController.reenviar);

/**
 * GET /api/webhook/focus/:hookId
 * Consulta um webhook específico
 */
router.get('/focus/:hookId', webhookFocusController.consultar);

/**
 * DELETE /api/webhook/focus/:hookId
 * Deleta um webhook
 */
router.delete('/focus/:hookId', webhookFocusController.deletar);

module.exports = router;

