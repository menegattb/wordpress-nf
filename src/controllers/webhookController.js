const logger = require('../services/logger');
const { mapearWooCommerceParaPedido } = require('../utils/mapeador');
const { salvarPedido, buscarPedidoPorPedidoId, atualizarPedido, salvarNFSe, atualizarNFSe, buscarNFSePorReferencia, salvarNFe, atualizarNFe, buscarNFePorReferencia } = require('../config/database');
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
    
    // Verificar se é um ping/teste do WooCommerce
    const webhookTopic = req.headers['x-wc-webhook-topic'];
    if (webhookTopic === 'ping' || webhookTopic === 'test' || Object.keys(pedidoWC).length === 0) {
      logger.webhook('Ping/teste recebido do WooCommerce', {
        topic: webhookTopic,
        headers: req.headers
      });
      return res.status(200).json({
        status: 'ok',
        mensagem: 'Webhook configurado com sucesso',
        timestamp: new Date().toISOString()
      });
    }
    
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
      return res.status(200).json({
        status: 'ignorado',
        mensagem: 'Payload sem ID de pedido'
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
    
    // Emitir NFSe (SÍNCRONO - aguarda resultado antes de responder)
    // Necessário para Vercel serverless onde a função termina após resposta
    logger.webhook('Iniciando emissão de NFSe', {
      pedido_id: dadosPedido.pedido_id
    });
    
    try {
      const resultado = await emitirNFSe(dadosPedido, config.emitente, configFiscal);
      
      if (resultado.sucesso) {
        logger.webhook('NFSe emitida com sucesso', {
          pedido_id: dadosPedido.pedido_id,
          referencia: resultado.referencia,
          status: resultado.status
        });
        
        // Atualizar status do pedido
        await atualizarPedido(dadosPedido.pedido_id_db, {
          status: resultado.status === 'autorizado' ? 'emitida' : 'processando'
        });
        
        return res.status(200).json({
          mensagem: 'Pedido processado e NFSe emitida',
          pedido_id: dadosPedido.pedido_id,
          status: resultado.status,
          referencia: resultado.referencia
        });
      } else {
        logger.webhook('Erro ao emitir NFSe', {
          pedido_id: dadosPedido.pedido_id,
          erro: resultado.erro
        });
        
        // Atualizar status do pedido para erro
        await atualizarPedido(dadosPedido.pedido_id_db, {
          status: 'erro'
        });
        
        // Retornar 200 para evitar reenvios do WooCommerce
        return res.status(200).json({
          mensagem: 'Pedido recebido, erro na emissão',
          pedido_id: dadosPedido.pedido_id,
          erro: resultado.erro
        });
      }
    } catch (err) {
      logger.error('Erro ao processar emissão de NFSe', {
        pedido_id: dadosPedido.pedido_id,
        error: err.message
      });
      
      // Atualizar status do pedido para erro
      await atualizarPedido(dadosPedido.pedido_id_db, {
        status: 'erro'
      });
      
      // Retornar 200 para evitar reenvios do WooCommerce
      return res.status(200).json({
        mensagem: 'Pedido recebido, erro no processamento',
        pedido_id: dadosPedido.pedido_id,
        erro: err.message
      });
    }
    
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

/**
 * Processa webhook da Focus NFe (notificações de notas)
 */
async function processarWebhookFocusNFe(req, res) {
  try {
    const dadosNota = req.body;
    
    logger.info('🔔 [WEBHOOK FOCUS] Notificação recebida da Focus NFe', {
      referencia: dadosNota.ref || dadosNota.referencia,
      status: dadosNota.status,
      tipo: dadosNota.chave_nfe ? 'nfe' : (dadosNota.numero_rps ? 'nfse' : 'desconhecido'),
      payload: dadosNota
    });
    
    // Determinar tipo de nota
    let tipoNota = null;
    if (dadosNota.chave_nfe || dadosNota.chave_cte) {
      tipoNota = dadosNota.chave_cte ? 'cte' : 'nfe';
    } else if (dadosNota.numero_rps || dadosNota.cnpj_prestador) {
      tipoNota = 'nfse';
    } else {
      logger.warn('🔔 [WEBHOOK FOCUS] Tipo de nota não identificado', {
        payload: dadosNota
      });
      return res.status(400).json({
        erro: 'Tipo de nota não identificado'
      });
    }
    
    const referencia = dadosNota.ref || dadosNota.referencia;
    if (!referencia) {
      logger.warn('🔔 [WEBHOOK FOCUS] Referência não encontrada', {
        payload: dadosNota
      });
      return res.status(400).json({
        erro: 'Referência não encontrada'
      });
    }
    
    // Determinar ambiente baseado na URL ou dados
    const ambiente = dadosNota.ambiente || (process.env.FOCUS_NFE_AMBIENTE || 'homologacao');
    
    // Adicionar campos específicos por tipo
    if (tipoNota === 'nfe') {
      // Preparar dados da NFe para salvar
      const dadosNFe = {
        referencia,
        chave_nfe: dadosNota.chave_nfe,
        status_focus: dadosNota.status,
        status_sefaz: dadosNota.status_sefaz,
        mensagem_sefaz: dadosNota.mensagem_sefaz,
        caminho_xml_nota_fiscal: dadosNota.caminho_xml_nota_fiscal,
        caminho_danfe: dadosNota.caminho_danfe,
        dados_completos: dadosNota,
        ambiente
      };
      
      // Verificar se já existe
      const nfeExistente = await buscarNFePorReferencia(referencia);
      
      if (nfeExistente) {
        logger.info('🔔 [WEBHOOK FOCUS] NFe já existe, atualizando', {
          referencia,
          status_anterior: nfeExistente.status_focus,
          status_novo: dadosNota.status
        });
        
        await atualizarNFe(referencia, dadosNFe);
      } else {
        logger.info('🔔 [WEBHOOK FOCUS] Salvando nova NFe', {
          referencia,
          status: dadosNota.status
        });
        
        await salvarNFe(dadosNFe);
      }
    } else if (tipoNota === 'nfse') {
      // Preparar dados da NFSe para salvar
      const dadosNFSe = {
        referencia,
        chave_nfse: dadosNota.codigo_verificacao || dadosNota.numero,
        status_focus: dadosNota.status,
        status_sefaz: dadosNota.status_sefaz,
        mensagem_sefaz: dadosNota.mensagem_sefaz,
        caminho_xml: dadosNota.caminho_xml_nota_fsical || dadosNota.caminho_xml_nota_fiscal,
        dados_completos: dadosNota,
        ambiente
      };
      
      // Verificar se já existe
      const nfseExistente = await buscarNFSePorReferencia(referencia);
      
      if (nfseExistente) {
        logger.info('🔔 [WEBHOOK FOCUS] NFSe já existe, atualizando', {
          referencia,
          status_anterior: nfseExistente.status_focus,
          status_novo: dadosNota.status
        });
        
        await atualizarNFSe(referencia, dadosNFSe);
      } else {
        logger.info('🔔 [WEBHOOK FOCUS] Salvando nova NFSe', {
          referencia,
          status: dadosNota.status
        });
        
        await salvarNFSe(dadosNFSe);
      }
    }
    
    logger.info('✅ [WEBHOOK FOCUS] Nota processada com sucesso', {
      referencia,
      tipo: tipoNota,
      status: dadosNota.status
    });
    
    // Retornar resposta 200 para confirmar recebimento
    res.status(200).json({
      mensagem: 'Notificação recebida e processada',
      referencia,
      tipo: tipoNota,
      status: dadosNota.status
    });
    
  } catch (error) {
    logger.error('❌ [WEBHOOK FOCUS] Erro ao processar notificação', {
      error: error.message,
      stack: error.stack,
      payload: req.body
    });
    
    // Retornar 200 mesmo em caso de erro para evitar reenvios desnecessários
    // A Focus NFe tentará reenviar se retornarmos erro, mas se for erro nosso,
    // não queremos que ela continue tentando indefinidamente
    res.status(200).json({
      erro: 'Erro ao processar notificação (mas recebida)',
      mensagem: error.message
    });
  }
}

module.exports = {
  processarWebhook,
  processarWebhookFocusNFe
};

