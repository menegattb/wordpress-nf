const express = require('express');
const router = express.Router();
const { listarBackups, listarNotasNFeParaDownload, baixarTodosXmls } = require('../controllers/backupController');

/**
 * GET /api/backups
 * Lista backups de XMLs disponíveis na Focus NFe
 */
router.get('/', listarBackups);

/**
 * GET /api/backups/notas-nfe
 * Lista notas NFe autorizadas para download de XMLs individuais
 */
router.get('/notas-nfe', listarNotasNFeParaDownload);

/**
 * GET /api/backups/baixar-todos-xmls
 * Baixa todos os XMLs das notas NFe autorizadas em um ZIP
 */
router.get('/baixar-todos-xmls', baixarTodosXmls);

module.exports = router;

