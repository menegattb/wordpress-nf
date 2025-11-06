const logger = require('../services/logger');
const { listarPedidos, buscarPedidoPorId, listarNFSe } = require('../config/database');

/**
 * Lista pedidos
 */
async function listar(req, res) {
  try {
    const { limite = 50, offset = 0, status, origem } = req.query;
    
    const pedidos = await listarPedidos({
      limite: parseInt(limite),
      offset: parseInt(offset),
      status,
      origem
    });
    
    res.json(pedidos);
    
  } catch (error) {
    logger.error('Erro ao listar pedidos', {
      error: error.message
    });
    
    res.status(500).json({
      erro: error.message
    });
  }
}

/**
 * Busca pedido por ID
 */
async function buscarPorId(req, res) {
  try {
    const { id } = req.params;
    
    const pedido = await buscarPedidoPorId(id);
    
    if (!pedido) {
      return res.status(404).json({
        erro: 'Pedido não encontrado'
      });
    }
    
    res.json(pedido);
    
  } catch (error) {
    logger.error('Erro ao buscar pedido', {
      error: error.message
    });
    
    res.status(500).json({
      erro: error.message
    });
  }
}

/**
 * Lista NFSe
 */
async function listarNFSeRoute(req, res) {
  try {
    const { limite = 50, offset = 0, status_focus, pedido_id } = req.query;
    
    const nfse = await listarNFSe({
      limite: parseInt(limite),
      offset: parseInt(offset),
      status_focus,
      pedido_id: pedido_id ? parseInt(pedido_id) : undefined
    });
    
    res.json(nfse);
    
  } catch (error) {
    logger.error('Erro ao listar NFSe', {
      error: error.message
    });
    
    res.status(500).json({
      erro: error.message
    });
  }
}

module.exports = {
  listar,
  buscarPorId,
  listarNFSe: listarNFSeRoute
};

