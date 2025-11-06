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
    
    // Se mes fornecido (formato YYYY-MM), converter para after/before
    if (filtros.mes) {
      const [ano, mes] = filtros.mes.split('-');
      // Criar datas no timezone local e depois converter para UTC
      const dataInicio = new Date(parseInt(ano), parseInt(mes) - 1, 1, 0, 0, 0, 0);
      const dataFim = new Date(parseInt(ano), parseInt(mes), 0, 23, 59, 59, 999);
      
      // WooCommerce espera datas no formato ISO 8601
      params.after = dataInicio.toISOString();
      params.before = dataFim.toISOString();
      
      logger.info('Filtro de data aplicado', {
        mes: filtros.mes,
        after: params.after,
        before: params.before,
        dataInicioLocal: dataInicio.toLocaleString('pt-BR'),
        dataFimLocal: dataFim.toLocaleString('pt-BR')
      });
      
      delete params.mes;
    }
    
    const response = await api.get('/orders', { params });
    
    let pedidos = response.data;
    
    // Filtrar por categorias se fornecido
    if (filtros.categorias && filtros.categorias.length > 0) {
      const resultadoProdutos = await buscarProdutosPorCategorias(filtros.categorias);
      
      if (resultadoProdutos.sucesso && resultadoProdutos.produto_ids.length > 0) {
        const produtoIds = resultadoProdutos.produto_ids;
        pedidos = pedidos.filter(pedido => {
          return pedido.line_items.some(item => produtoIds.includes(item.product_id));
        });
      } else {
        pedidos = [];
      }
    }
    
    // Obter total real dos headers do WooCommerce
    // O header x-wp-total retorna o total de pedidos que correspondem aos filtros aplicados
    // Axios retorna headers em lowercase
    const totalHeader = response.headers['x-wp-total'] || 
                        response.headers['X-WP-Total'] || 
                        (response.headers && typeof response.headers.get === 'function' ? response.headers.get('x-wp-total') : null);
    const totalPages = response.headers['x-wp-totalpages'] || 
                       response.headers['X-WP-TotalPages'] ||
                       (response.headers && typeof response.headers.get === 'function' ? response.headers.get('x-wp-totalpages') : null);
    
    // Se o header não existir, usar o tamanho do array retornado
    // Mas isso pode estar errado se houver paginação
    const totalReal = (totalHeader !== undefined && totalHeader !== null && totalHeader !== '') 
                      ? parseInt(totalHeader, 10) 
                      : pedidos.length;
    
    logger.info('Pedidos encontrados via API REST', {
      service: 'woocommerce',
      action: 'buscar_pedidos',
      filtros: filtros,
      total_header: totalHeader,
      total_real: totalReal,
      total_retornado: pedidos.length,
      total_pages: totalPages,
      headers_keys: Object.keys(response.headers)
    });
    
    return {
      sucesso: true,
      pedidos: pedidos,
      total: totalReal, // Usar total do header (mais preciso)
      total_retornado: pedidos.length, // Quantos foram retornados nesta página
      total_pages: totalPages ? parseInt(totalPages) : 1,
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
 * Busca categorias de produtos do WooCommerce
 */
async function buscarCategorias() {
  const api = createWooCommerceClient();
  
  try {
    logger.info('Buscando categorias do WooCommerce', {
      service: 'woocommerce',
      action: 'buscar_categorias'
    });
    
    const response = await api.get('/products/categories', {
      params: {
        per_page: 100,
        orderby: 'name',
        order: 'asc'
      }
    });
    
    // Verificar se a resposta é JSON válido
    if (typeof response.data === 'string' && response.data.trim().startsWith('<')) {
      logger.error('Resposta HTML recebida ao invés de JSON', {
        service: 'woocommerce',
        action: 'buscar_categorias',
        response_preview: response.data.substring(0, 200)
      });
      return {
        sucesso: false,
        erro: 'Resposta HTML recebida (possível erro de autenticação ou URL incorreta)'
      };
    }
    
    logger.info('Categorias encontradas', {
      service: 'woocommerce',
      action: 'buscar_categorias',
      total: Array.isArray(response.data) ? response.data.length : 0
    });
    
    // Garantir que response.data é um array
    const categorias = Array.isArray(response.data) ? response.data : [];
    
    return {
      sucesso: true,
      categorias: categorias.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        count: cat.count || 0
      }))
    };
    
  } catch (error) {
    logger.error('Erro ao buscar categorias do WooCommerce', {
      service: 'woocommerce',
      action: 'buscar_categorias',
      error: error.message,
      status: error.response?.status,
      response_data: error.response?.data
    });
    
    // Tratar erro de parsing JSON
    let erroMsg = error.message;
    if (error.response?.data && typeof error.response.data === 'string') {
      if (error.response.data.trim().startsWith('<')) {
        erroMsg = 'Resposta HTML recebida (verifique URL da API e credenciais)';
      } else {
        erroMsg = error.response.data;
      }
    } else if (error.response?.data) {
      erroMsg = JSON.stringify(error.response.data);
    }
    
    return {
      sucesso: false,
      erro: erroMsg
    };
  }
}

/**
 * Busca produtos por categoria para filtrar pedidos
 */
async function buscarProdutosPorCategorias(categoriaIds) {
  const api = createWooCommerceClient();
  
  try {
    const produtos = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const response = await api.get('/products', {
        params: {
          category: categoriaIds.join(','),
          per_page: 100,
          page: page
        }
      });
      
      produtos.push(...response.data.map(p => p.id));
      
      if (response.data.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }
    
    return {
      sucesso: true,
      produto_ids: produtos
    };
    
  } catch (error) {
    logger.error('Erro ao buscar produtos por categorias', {
      service: 'woocommerce',
      action: 'buscar_produtos_por_categorias',
      error: error.message
    });
    
    return {
      sucesso: false,
      erro: error.message,
      produto_ids: []
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
  buscarCategorias,
  buscarProdutosPorCategorias,
  testarConexao
};

