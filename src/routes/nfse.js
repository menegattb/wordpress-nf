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

/**
 * POST /api/nfse/emitir-teste
 * Emite NF de teste (serviço ou produto) com dados de teste variados
 */
router.post('/emitir-teste', nfseController.emitirTeste);

/**
 * GET /api/nfse/buscar
 * Busca notas na Focus NFe e banco local
 */
router.get('/buscar', nfseController.buscarNotas);

/**
 * DELETE /api/nfse/cancelar/:referencia
 * Cancela uma nota (NFe ou NFSe) - requer tipo_nota no body
 */
router.delete('/cancelar/:referencia', nfseController.cancelarNota);

/**
 * DELETE /api/nfse/cancelar-por-chave/:chave_nfe
 * Cancela uma NFe por chave (busca a referência automaticamente) - requer justificativa no body
 */
router.delete('/cancelar-por-chave/:chave_nfe', nfseController.cancelarNotaPorChave);

module.exports = router;

