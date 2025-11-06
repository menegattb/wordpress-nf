const logger = require('../services/logger');
const { mapearWooCommerceParaPedido } = require('../utils/mapeador');
const { salvarPedido, buscarPedidoPorPedidoId, atualizarPedido } = require('../config/database');
const { emitirNFSe } = require('../services/focusNFSe');
const config = require('../../config');

// Passar config.fiscal também
const configFiscal = config.fiscal;

/**
 * Processa webhook do WooCommerce
 */
async function processarWebhook(req, res) {
  try {
    const pedidoWC = req.body;
    
    logger.webhook('Webhook recebido do WooCommerce', {
      pedido_id: pedidoWC.id || pedidoWC.number,
      status: pedidoWC.status,
      payload: pedidoWC
    });
    
    // Validar estrutura básica
    if (!pedidoWC.id && !pedidoWC.number) {
      logger.webhook('Webhook inválido: sem ID de pedido', {
        payload: pedidoWC
      });
      return res.status(400).json({
        erro: 'Pedido inválido: ID não encontrado'
      });
    }
    
    // Processar apenas pedidos concluídos ou em processamento
    const statusValidos = ['completed', 'processing'];
    if (!statusValidos.includes(pedidoWC.status)) {
      logger.webhook('Pedido não processado: status inválido', {
        pedido_id: pedidoWC.id || pedidoWC.number,
        status: pedidoWC.status
      });
      return res.status(200).json({
        mensagem: 'Pedido não processado (status não é completed/processing)',
        pedido_id: pedidoWC.id || pedidoWC.number,
        status: pedidoWC.status
      });
    }
    
    // Mapear dados do WooCommerce
    logger.webhook('Mapeando dados do WooCommerce', {
      pedido_id: pedidoWC.id || pedidoWC.number
    });
    
    const dadosPedido = mapearWooCommerceParaPedido(pedidoWC);
    
    logger.webhook('Dados mapeados com sucesso', {
      pedido_id: dadosPedido.pedido_id,
      cliente: dadosPedido.nome,
      total: dadosPedido.valor_total
    });
    
    // Verificar se pedido já existe
    const pedidoExistente = await buscarPedidoPorPedidoId(dadosPedido.pedido_id);
    
    if (pedidoExistente) {
      logger.webhook('Pedido já existe, atualizando', {
        pedido_id: dadosPedido.pedido_id,
        id_db: pedidoExistente.id
      });
      
      // Atualizar dados
      await atualizarPedido(pedidoExistente.id, {
        dados_pedido: dadosPedido,
        status: 'pendente' // Resetar para pendente se recebido novamente
      });
      
      // Se já existe NFSe, não emitir novamente
      if (pedidoExistente.status === 'emitida' || pedidoExistente.status === 'processando') {
        logger.webhook('Pedido já possui NFSe emitida ou em processamento', {
          pedido_id: dadosPedido.pedido_id,
          status: pedidoExistente.status
        });
        return res.status(200).json({
          mensagem: 'Pedido já processado',
          pedido_id: dadosPedido.pedido_id,
          status: pedidoExistente.status
        });
      }
      
      dadosPedido.pedido_id_db = pedidoExistente.id;
    } else {
      // Salvar pedido no banco
      logger.webhook('Salvando pedido no banco de dados', {
        pedido_id: dadosPedido.pedido_id
      });
      
      const pedidoSalvo = await salvarPedido({
        pedido_id: dadosPedido.pedido_id,
        origem: 'woocommerce',
        dados_pedido: dadosPedido,
        status: 'pendente'
      });
      
      dadosPedido.pedido_id_db = pedidoSalvo.id;
      
      logger.webhook('Pedido salvo no banco de dados', {
        pedido_id: dadosPedido.pedido_id,
        id_db: pedidoSalvo.id
      });
    }
    
    // Emitir NFSe (assíncrono - não bloqueia resposta)
    logger.webhook('Iniciando emissão de NFSe (assíncrono)', {
      pedido_id: dadosPedido.pedido_id
    });
    
    emitirNFSe(dadosPedido, config.emitente, configFiscal)
      .then(resultado => {
        if (resultado.sucesso) {
          logger.webhook('NFSe emitida com sucesso', {
            pedido_id: dadosPedido.pedido_id,
            referencia: resultado.referencia,
            status: resultado.status
          });
          
          // Atualizar status do pedido
          atualizarPedido(dadosPedido.pedido_id_db, {
            status: resultado.status === 'autorizado' ? 'emitida' : 'processando'
          }).catch(err => {
            logger.error('Erro ao atualizar status do pedido', {
              pedido_id: dadosPedido.pedido_id,
              error: err.message
            });
          });
        } else {
          logger.webhook('Erro ao emitir NFSe', {
            pedido_id: dadosPedido.pedido_id,
            erro: resultado.erro
          });
          
          // Atualizar status do pedido para erro
          atualizarPedido(dadosPedido.pedido_id_db, {
            status: 'erro'
          }).catch(err => {
            logger.error('Erro ao atualizar status do pedido', {
              pedido_id: dadosPedido.pedido_id,
              error: err.message
            });
          });
        }
      })
      .catch(err => {
        logger.error('Erro ao processar emissão de NFSe', {
          pedido_id: dadosPedido.pedido_id,
          error: err.message
        });
        
        // Atualizar status do pedido para erro
        atualizarPedido(dadosPedido.pedido_id_db, {
          status: 'erro'
        }).catch(dbErr => {
          logger.error('Erro ao atualizar status do pedido', {
            pedido_id: dadosPedido.pedido_id,
            error: dbErr.message
          });
        });
      });
    
    // Retornar resposta imediata
    res.status(200).json({
      mensagem: 'Pedido recebido e processamento iniciado',
      pedido_id: dadosPedido.pedido_id,
      status: 'processando'
    });
    
  } catch (error) {
    logger.error('Erro ao processar webhook', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      erro: 'Erro ao processar webhook',
      mensagem: error.message
    });
  }
}

module.exports = {
  processarWebhook
};

