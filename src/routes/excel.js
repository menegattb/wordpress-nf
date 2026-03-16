const express = require('express');
const router = express.Router();
const excelController = require('../controllers/excelController');

router.get('/pedidos', excelController.listar);
router.post('/sincronizar', excelController.sincronizar);
router.post('/emitir', excelController.emitir);
router.post('/importar-nubank', excelController.importarNubank);
router.post('/remover-nubank', excelController.removerNubank);
router.post('/cancelar', excelController.cancelar);
router.post('/status-manual', excelController.statusManual);
router.get('/status/:pedido_id', excelController.atualizarStatus);
router.put('/pedidos/:pedido_id/endereco', excelController.atualizarEndereco);

module.exports = router;
