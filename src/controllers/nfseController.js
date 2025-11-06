const logger = require('../services/logger');
const { emitirNFSe, consultarNFSe, cancelarNFSe } = require('../services/focusNFSe');
const { buscarPedidoPorId, atualizarPedido } = require('../config/database');
const { validarCPFCNPJ } = require('../services/validator');
const config = require('../../config');

// Passar config.fiscal também
const configFiscal = config.fiscal;

/**
 * Emite NFSe manualmente
 */
async function emitirNFSeManual(req, res) {
  try {
    const dadosPedido = req.body;
    
    logger.focusNFe('emitir_nfse_manual', 'Emissão manual de NFSe solicitada', {
      pedido_id: dadosPedido.pedido_id
    });
    
    // Validar documento
    if (dadosPedido.cpf_cnpj) {
      const documento = validarCPFCNPJ(dadosPedido.cpf_cnpj);
      if (!documento.valido) {
        return res.status(400).json({
          erro: 'Documento inválido',
          detalhes: documento.erro
        });
      }
    }
    
    // Emitir NFSe
    const resultado = await emitirNFSe(dadosPedido, config.emitente, configFiscal);
    
    if (resultado.sucesso && dadosPedido.pedido_id_db) {
      // Atualizar status do pedido
      await atualizarPedido(dadosPedido.pedido_id_db, {
        status: resultado.status === 'autorizado' ? 'emitida' : 'processando'
      });
    }
    
    res.json(resultado);
    
  } catch (error) {
    logger.error('Erro ao emitir NFSe manual', {
      error: error.message
    });
    
    res.status(500).json({
      erro: error.message
    });
  }
}

/**
 * Consulta status de NFSe
 */
async function consultarStatus(req, res) {
  try {
    const { referencia } = req.params;
    
    logger.focusNFe('consultar_status', 'Consulta de status solicitada', {
      referencia
    });
    
    const resultado = await consultarNFSe(referencia);
    res.json(resultado);
    
  } catch (error) {
    logger.error('Erro ao consultar status', {
      error: error.message
    });
    
    res.status(500).json({
      erro: error.message
    });
  }
}

/**
 * Cancela NFSe
 */
async function cancelar(req, res) {
  try {
    const { referencia } = req.params;
    const { justificativa } = req.body;
    
    if (!justificativa) {
      return res.status(400).json({
        erro: 'Justificativa é obrigatória'
      });
    }
    
    logger.focusNFe('cancelar_nfse', 'Cancelamento solicitado', {
      referencia
    });
    
    const resultado = await cancelarNFSe(referencia, justificativa);
    res.json(resultado);
    
  } catch (error) {
    logger.error('Erro ao cancelar NFSe', {
      error: error.message
    });
    
    res.status(500).json({
      erro: error.message
    });
  }
}

module.exports = {
  emitirNFSeManual,
  consultarStatus,
  cancelar
};

