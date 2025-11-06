const logger = require('../services/logger');
const { emitirNFSe, consultarNFSe, cancelarNFSe } = require('../services/focusNFSe');
const { buscarPedidoPorId, atualizarPedido } = require('../config/database');
const { validarCPFCNPJ } = require('../services/validator');
const { buscarPedidoPorId: buscarPedidoWC } = require('../services/woocommerce');
const { mapearWooCommerceParaPedido } = require('../utils/mapeador');
const config = require('../../config');

// Passar config.fiscal também
const configFiscal = config.fiscal;

/**
 * Emite NFSe em lote para múltiplos pedidos
 */
async function emitirNFSeLote(req, res) {
  try {
    const { pedido_ids, tipo_nf } = req.body;
    
    if (!pedido_ids || !Array.isArray(pedido_ids) || pedido_ids.length === 0) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Lista de pedido_ids é obrigatória'
      });
    }
    
    logger.info('Iniciando emissão em lote de NFSe', {
      total: pedido_ids.length,
      tipo_nf: tipo_nf || 'servico'
    });
    
    const resultados = [];
    let sucesso = 0;
    let erros = 0;
    
    for (let i = 0; i < pedido_ids.length; i++) {
      const pedidoId = pedido_ids[i];
      
      try {
        logger.info(`Processando pedido ${i + 1}/${pedido_ids.length}`, {
          pedido_id: pedidoId
        });
        
        // Buscar pedido do WooCommerce
        const resultadoWC = await buscarPedidoWC(pedidoId);
        
        if (!resultadoWC.sucesso) {
          resultados.push({
            pedido_id: pedidoId,
            sucesso: false,
            erro: resultadoWC.erro || 'Erro ao buscar pedido'
          });
          erros++;
          continue;
        }
        
        // Mapear para formato interno
        const pedidoMapeado = mapearWooCommerceParaPedido(resultadoWC.pedido);
        
        // Emitir NFSe
        const resultadoNFSe = await emitirNFSe(pedidoMapeado, config.emitente, configFiscal);
        
        if (resultadoNFSe.sucesso) {
          resultados.push({
            pedido_id: pedidoId,
            sucesso: true,
            referencia: resultadoNFSe.referencia,
            nfse_numero: resultadoNFSe.numero || null,
            status: resultadoNFSe.status
          });
          sucesso++;
        } else {
          resultados.push({
            pedido_id: pedidoId,
            sucesso: false,
            erro: resultadoNFSe.erro || 'Erro ao emitir NFSe'
          });
          erros++;
        }
        
      } catch (error) {
        logger.error(`Erro ao processar pedido ${pedidoId}`, {
          pedido_id: pedidoId,
          error: error.message
        });
        
        resultados.push({
          pedido_id: pedidoId,
          sucesso: false,
          erro: error.message
        });
        erros++;
      }
    }
    
    logger.info('Emissão em lote concluída', {
      total: pedido_ids.length,
      sucesso,
      erros
    });
    
    res.json({
      sucesso: true,
      total: pedido_ids.length,
      processados: resultados.length,
      sucesso: sucesso,
      erros: erros,
      resultados: resultados
    });
    
  } catch (error) {
    logger.error('Erro ao emitir NFSe em lote', {
      error: error.message
    });
    
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
}

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
  cancelar,
  emitirNFSeLote
};

