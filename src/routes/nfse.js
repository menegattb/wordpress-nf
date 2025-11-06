const express = require('express');
const router = express.Router();
const nfseController = require('../controllers/nfseController');

/**
 * POST /api/nfse/emitir
 * Emite NFSe manualmente
 */
router.post('/emitir', nfseController.emitirNFSeManual);

/**
 * GET /api/nfse/consulta/:referencia
 * Consulta status de uma NFSe
 */
router.get('/consulta/:referencia', nfseController.consultarStatus);

/**
 * DELETE /api/nfse/:referencia
 * Cancela uma NFSe
 */
router.delete('/:referencia', nfseController.cancelar);

/**
 * POST /api/nfse/emitir-lote
 * Emite NFSe em lote para múltiplos pedidos
 */
router.post('/emitir-lote', nfseController.emitirNFSeLote);

module.exports = router;

