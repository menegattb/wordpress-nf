const logger = require('../services/logger');
const { criarWebhook, listarWebhooks, consultarWebhook, deletarWebhook, reenviarNotificacao } = require('../services/focusWebhooks');

/**
 * Cria um webhook na Focus NFe
 */
async function criar(req, res) {
  try {
    const { event, url, cnpj, cpf, authorization, authorization_header, ambiente } = req.body;
    
    if (!event || !url) {
      return res.status(400).json({
        erro: 'Campos obrigatórios: event, url'
      });
    }
    
    const resultado = await criarWebhook({
      event,
      url,
      cnpj,
      cpf,
      authorization,
      authorization_header
    }, ambiente);
    
    if (resultado.sucesso) {
      res.json(resultado);
    } else {
      res.status(resultado.erro_status || 500).json(resultado);
    }
  } catch (error) {
    logger.error('Erro ao criar webhook', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      erro: 'Erro ao criar webhook',
      mensagem: error.message
    });
  }
}

/**
 * Lista todos os webhooks
 */
async function listar(req, res) {
  try {
    const { ambiente } = req.query;
    
    const resultado = await listarWebhooks(ambiente);
    
    if (resultado.sucesso) {
      res.json(resultado);
    } else {
      res.status(resultado.erro_status || 500).json(resultado);
    }
  } catch (error) {
    logger.error('Erro ao listar webhooks', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      erro: 'Erro ao listar webhooks',
      mensagem: error.message
    });
  }
}

/**
 * Consulta um webhook específico
 */
async function consultar(req, res) {
  try {
    const { hookId } = req.params;
    const { ambiente } = req.query;
    
    const resultado = await consultarWebhook(hookId, ambiente);
    
    if (resultado.sucesso) {
      res.json(resultado);
    } else {
      res.status(resultado.erro_status || 500).json(resultado);
    }
  } catch (error) {
    logger.error('Erro ao consultar webhook', {
      hookId: req.params.hookId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      erro: 'Erro ao consultar webhook',
      mensagem: error.message
    });
  }
}

/**
 * Deleta um webhook
 */
async function deletar(req, res) {
  try {
    const { hookId } = req.params;
    const { ambiente } = req.query;
    
    const resultado = await deletarWebhook(hookId, ambiente);
    
    if (resultado.sucesso) {
      res.json(resultado);
    } else {
      res.status(resultado.erro_status || 500).json(resultado);
    }
  } catch (error) {
    logger.error('Erro ao deletar webhook', {
      hookId: req.params.hookId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      erro: 'Erro ao deletar webhook',
      mensagem: error.message
    });
  }
}

/**
 * Reenvia notificação para uma nota específica
 */
async function reenviar(req, res) {
  try {
    const { referencia } = req.params;
    const { tipo_nota, ambiente } = req.body;
    
    if (!tipo_nota) {
      return res.status(400).json({
        erro: 'Campo obrigatório: tipo_nota (nfe, nfse, etc)'
      });
    }
    
    const resultado = await reenviarNotificacao(referencia, tipo_nota, ambiente);
    
    if (resultado.sucesso) {
      res.json(resultado);
    } else {
      res.status(resultado.erro_status || 500).json(resultado);
    }
  } catch (error) {
    logger.error('Erro ao reenviar notificação', {
      referencia: req.params.referencia,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      erro: 'Erro ao reenviar notificação',
      mensagem: error.message
    });
  }
}

module.exports = {
  criar,
  listar,
  consultar,
  deletar,
  reenviar
};

