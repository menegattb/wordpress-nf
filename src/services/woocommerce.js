const axios = require('axios');
const config = require('../../config');
const logger = require('./logger');

/**
 * Cliente para API REST do WooCommerce
 */
function createWooCommerceClient() {
  const { url, apiUrl, consumerKey, consumerSecret } = config.woocommerce;
  
  return axios.create({
    baseURL: apiUrl,
    auth: {
      username: consumerKey,
      password: consumerSecret
    },
    timeout: 30000
  });
}

/**
 * Busca pedidos do WooCommerce via API REST
 */
async function buscarPedidos(filtros = {}) {
  const api = createWooCommerceClient();
  
  try {
    logger.info('Buscando pedidos do WooCommerce via API REST', {
      service: 'woocommerce',
      action: 'buscar_pedidos',
      filtros
    });
    
    const params = {
      ...filtros,
      per_page: filtros.per_page || 50,
      page: filtros.page || 1
    };
    
    const response = await api.get('/orders', { params });
    
    logger.info('Pedidos encontrados via API REST', {
      service: 'woocommerce',
      action: 'buscar_pedidos',
      total: response.data.length
    });
    
    return {
      sucesso: true,
      pedidos: response.data,
      total: response.data.length,
      headers: response.headers
    };
    
  } catch (error) {
    logger.error('Erro ao buscar pedidos do WooCommerce', {
      service: 'woocommerce',
      action: 'buscar_pedidos',
      error: error.message,
      status: error.response?.status
    });
    
    return {
      sucesso: false,
      erro: error.response?.data || error.message
    };
  }
}

/**
 * Busca um pedido específico por ID
 */
async function buscarPedidoPorId(orderId) {
  const api = createWooCommerceClient();
  
  try {
    logger.info('Buscando pedido do WooCommerce', {
      service: 'woocommerce',
      action: 'buscar_pedido',
      order_id: orderId
    });
    
    const response = await api.get(`/orders/${orderId}`);
    
    logger.info('Pedido encontrado via API REST', {
      service: 'woocommerce',
      action: 'buscar_pedido',
      order_id: orderId
    });
    
    return {
      sucesso: true,
      pedido: response.data
    };
    
  } catch (error) {
    logger.error('Erro ao buscar pedido do WooCommerce', {
      service: 'woocommerce',
      action: 'buscar_pedido',
      order_id: orderId,
      error: error.message
    });
    
    return {
      sucesso: false,
      erro: error.response?.data || error.message
    };
  }
}

/**
 * Testa a conexão com a API do WooCommerce
 */
async function testarConexao() {
  const api = createWooCommerceClient();
  
  try {
    logger.info('Testando conexão com WooCommerce', {
      service: 'woocommerce',
      action: 'testar_conexao'
    });
    
    const response = await api.get('/orders', { params: { per_page: 1 } });
    
    logger.info('Conexão com WooCommerce OK', {
      service: 'woocommerce',
      action: 'testar_conexao',
      status: response.status
    });
    
    return {
      sucesso: true,
      mensagem: 'Conexão estabelecida com sucesso',
      status: response.status,
      total_pedidos: response.headers['x-wp-total'] || 'N/A'
    };
    
  } catch (error) {
    logger.error('Erro ao testar conexão com WooCommerce', {
      service: 'woocommerce',
      action: 'testar_conexao',
      error: error.message,
      status: error.response?.status
    });
    
    return {
      sucesso: false,
      erro: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

module.exports = {
  buscarPedidos,
  buscarPedidoPorId,
  testarConexao
};

