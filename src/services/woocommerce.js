const axios = require('axios');
const config = require('../../config');
const logger = require('./logger');

/**
 * Cliente para API REST do WooCommerce
 * @param {Object} credentials - Opcional: { apiUrl, consumerKey, consumerSecret } para multi-tenant
 */
function createWooCommerceClient(credentials = null) {
  const { apiUrl, consumerKey, consumerSecret } = credentials || config.woocommerce;

  if (!apiUrl || !consumerKey || !consumerSecret) {
    throw new Error('Credenciais WooCommerce incompletas (apiUrl, consumerKey, consumerSecret)');
  }

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
 * @param {Object} credentials - Opcional: { apiUrl, consumerKey, consumerSecret } para multi-tenant
 */
async function buscarPedidos(filtros = {}, credentials = null) {
  const api = createWooCommerceClient(credentials);
  
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
      const resultadoProdutos = await buscarProdutosPorCategorias(filtros.categorias, credentials);
      
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
 * @param {Object} credentials - Opcional: { apiUrl, consumerKey, consumerSecret } para multi-tenant
 */
async function buscarPedidoPorId(orderId, credentials = null) {
  const api = createWooCommerceClient(credentials);
  
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
 * Atualiza endereço de um pedido no WooCommerce
 * @param {Object} credentials - Opcional: { apiUrl, consumerKey, consumerSecret } para multi-tenant
 */
async function atualizarEnderecoPedido(orderId, endereco, cpf_cnpj, credentials = null) {
  const api = createWooCommerceClient(credentials);

  try {
    logger.info('Atualizando endereço do pedido no WooCommerce', {
      service: 'woocommerce',
      action: 'atualizar_endereco',
      order_id: orderId
    });

    // Buscar pedido atual para preservar outros dados
    const pedidoAtual = await buscarPedidoPorId(orderId, credentials);
    
    if (!pedidoAtual.sucesso || !pedidoAtual.pedido) {
      throw new Error('Pedido não encontrado no WooCommerce');
    }
    
    const pedido = pedidoAtual.pedido;
    
    // Detectar se é endereço internacional
    const paisUpper = String(endereco.pais || '').toUpperCase().trim();
    const isInternacional = paisUpper !== 'BR' && 
                           paisUpper !== 'BRASIL' && 
                           paisUpper !== '' &&
                           paisUpper !== 'BRAZIL';
    
    // Converter país para código ISO se necessário
    let countryCode = 'BR';
    if (isInternacional) {
      // Tentar converter nome do país para código ISO
      const paisMap = {
        'ESTADOS UNIDOS': 'US',
        'UNITED STATES': 'US',
        'USA': 'US',
        'PORTUGAL': 'PT',
        'ESPANHA': 'ES',
        'SPAIN': 'ES',
        'FRANÇA': 'FR',
        'FRANCE': 'FR',
        'ALEMANHA': 'DE',
        'GERMANY': 'DE',
        'ITALIA': 'IT',
        'ITALY': 'IT',
        'REINO UNIDO': 'GB',
        'UNITED KINGDOM': 'GB',
        'UK': 'GB',
        'CANADÁ': 'CA',
        'CANADA': 'CA',
        'ARGENTINA': 'AR',
        'CHILE': 'CL',
        'URUGUAI': 'UY',
        'PARAGUAI': 'PY'
      };
      
      countryCode = paisMap[paisUpper] || (endereco.pais && endereco.pais.length === 2 ? endereco.pais.toUpperCase() : 'US');
    }
    
    // Preparar dados de billing e shipping para atualização
    const billingData = {
      first_name: pedido.billing?.first_name || '',
      last_name: pedido.billing?.last_name || '',
      company: pedido.billing?.company || '',
      address_1: endereco.rua || pedido.billing?.address_1 || '',
      address_2: endereco.complemento || pedido.billing?.address_2 || '',
      city: endereco.cidade || endereco.nome_cidade_ext || pedido.billing?.city || '',
      state: endereco.estado || endereco.regiao_ext || pedido.billing?.state || '',
      postcode: endereco.cep || endereco.cep_ext || pedido.billing?.postcode || '',
      country: countryCode,
      email: pedido.billing?.email || '',
      phone: pedido.billing?.phone || ''
    };
    
    const shippingData = {
      first_name: pedido.shipping?.first_name || pedido.billing?.first_name || '',
      last_name: pedido.shipping?.last_name || pedido.billing?.last_name || '',
      company: pedido.shipping?.company || pedido.billing?.company || '',
      address_1: endereco.rua || pedido.shipping?.address_1 || '',
      address_2: endereco.complemento || pedido.shipping?.address_2 || '',
      city: endereco.cidade || endereco.nome_cidade_ext || pedido.shipping?.city || '',
      state: endereco.estado || endereco.regiao_ext || pedido.shipping?.state || '',
      postcode: endereco.cep || endereco.cep_ext || pedido.shipping?.postcode || '',
      country: countryCode
    };
    
    // Preparar dados para atualização
    const updateData = {
      billing: billingData,
      shipping: shippingData
    };
    
    // Adicionar meta_data para CPF/CNPJ se fornecido
    if (cpf_cnpj) {
      const cpfCnpjLimpo = cpf_cnpj.replace(/\D/g, '');
      updateData.meta_data = pedido.meta_data || [];
      
      // Remover CPF/CNPJ existente se houver
      updateData.meta_data = updateData.meta_data.filter(meta => 
        meta.key !== '_billing_cpf' && 
        meta.key !== '_billing_cnpj' && 
        meta.key !== '_billing_cpf_cnpj'
      );
      
      // Adicionar novo CPF/CNPJ
      if (cpfCnpjLimpo.length === 11) {
        updateData.meta_data.push({
          key: '_billing_cpf',
          value: cpfCnpjLimpo
        });
      } else if (cpfCnpjLimpo.length === 14) {
        updateData.meta_data.push({
          key: '_billing_cnpj',
          value: cpfCnpjLimpo
        });
      }
    }
    
    // Atualizar pedido no WooCommerce
    const response = await api.put(`/orders/${orderId}`, updateData);
    
    logger.info('Endereço atualizado no WooCommerce', {
      service: 'woocommerce',
      action: 'atualizar_endereco',
      order_id: orderId,
      cidade: endereco.cidade || endereco.nome_cidade_ext
    });
    
    return {
      sucesso: true,
      pedido: response.data
    };
    
  } catch (error) {
    logger.error('Erro ao atualizar endereço no WooCommerce', {
      service: 'woocommerce',
      action: 'atualizar_endereco',
      order_id: orderId,
      error: error.message,
      response: error.response?.data
    });
    
    return {
      sucesso: false,
      erro: error.response?.data || error.message
    };
  }
}

/**
 * Busca categorias de produtos do WooCommerce
 * @param {Object} credentials - Opcional: { apiUrl, consumerKey, consumerSecret } para multi-tenant
 */
async function buscarCategorias(credentials = null) {
  const api = createWooCommerceClient(credentials);
  
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
 * @param {Object} credentials - Opcional: { apiUrl, consumerKey, consumerSecret } para multi-tenant
 */
async function buscarProdutosPorCategorias(categoriaIds, credentials = null) {
  const api = createWooCommerceClient(credentials);
  
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
 * @param {Object} credentials - Opcional: { apiUrl, consumerKey, consumerSecret } para multi-tenant
 */
async function testarConexao(credentials = null) {
  const api = createWooCommerceClient(credentials);
  
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

/**
 * Sincroniza pedidos do WooCommerce salvando no banco de dados
 * @param {Object} credentials - Opcional: { apiUrl, consumerKey, consumerSecret } para multi-tenant
 */
async function sincronizarPedidos(credentials = null) {
  const logger = require('./logger');
  const { salvarPedido } = require('../config/database');
  const { mapearWooCommerceParaPedido } = require('../utils/mapeador');
  
  logger.info('Iniciando sincronização de pedidos do WooCommerce', {
    service: 'woocommerce',
    action: 'sincronizar_pedidos'
  });
  
  try {
    let todosPedidos = [];
    let page = 1;
    let totalPages = 1;
    let pedidosSalvos = 0;
    let pedidosAtualizados = 0;
    let erros = 0;
    
    // Buscar primeira página para obter total de páginas
    const primeiraPagina = await buscarPedidos({
      per_page: 100,
      page: 1,
      orderby: 'date',
      order: 'desc'
    }, credentials);
    
    const pedidos = primeiraPagina.pedidos || [];
    todosPedidos = pedidos;
    totalPages = parseInt(primeiraPagina.total_pages || 1);
    
    logger.info('Buscando pedidos do WooCommerce', {
      service: 'woocommerce',
      action: 'sincronizar_pedidos',
      total_pages: totalPages,
      primeira_pagina: pedidos.length
    });
    
    // Buscar páginas restantes
    for (page = 2; page <= totalPages; page++) {
      const pagina = await buscarPedidos({
        per_page: 100,
        page: page,
        orderby: 'date',
        order: 'desc'
      }, credentials);
      
      const paginaPedidos = pagina.pedidos || [];
      todosPedidos = todosPedidos.concat(paginaPedidos);
    }
    
    logger.info(`Total de ${todosPedidos.length} pedidos encontrados. Iniciando salvamento no banco...`, {
      service: 'woocommerce',
      action: 'sincronizar_pedidos'
    });
    
    // Salvar cada pedido no banco
    for (const pedidoWC of todosPedidos) {
      try {
        // Mapear pedido WooCommerce para formato interno
        const dadosPedido = mapearWooCommerceParaPedido(pedidoWC);
        
        // Determinar status baseado no status do WooCommerce
        let status = 'pendente';
        if (pedidoWC.status === 'completed') {
          status = 'pendente'; // Pendente de emissão de NFSe
        } else if (pedidoWC.status === 'processing') {
          status = 'processando';
        } else if (pedidoWC.status === 'cancelled') {
          status = 'cancelado';
        }
        
        // Salvar no banco (usando ON CONFLICT para atualizar se já existir)
        await salvarPedido({
          pedido_id: dadosPedido.pedido_id,
          origem: 'woocommerce',
          dados_pedido: dadosPedido,
          status: status
        });
        
        // Verificar se foi inserção ou atualização (não temos como saber diretamente, então assumimos atualização se já existir)
        pedidosSalvos++;
        
      } catch (error) {
        erros++;
        logger.error('Erro ao salvar pedido durante sincronização', {
          service: 'woocommerce',
          action: 'sincronizar_pedidos',
          pedido_id: pedidoWC.id || pedidoWC.number,
          error: error.message
        });
      }
    }
    
    logger.info('Sincronização de pedidos concluída', {
      service: 'woocommerce',
      action: 'sincronizar_pedidos',
      total_pedidos: todosPedidos.length,
      pedidos_salvos: pedidosSalvos,
      erros: erros
    });
    
    return {
      sucesso: true,
      mensagem: `Sincronização concluída: ${pedidosSalvos} pedidos processados`,
      total_pedidos: todosPedidos.length,
      pedidos_salvos: pedidosSalvos,
      pedidos_atualizados: pedidosAtualizados,
      erros: erros
    };
    
  } catch (error) {
    logger.error('Erro ao sincronizar pedidos do WooCommerce', {
      service: 'woocommerce',
      action: 'sincronizar_pedidos',
      error: error.message
    });
    
    return {
      sucesso: false,
      erro: error.message,
      mensagem: `Erro ao sincronizar pedidos: ${error.message}`
    };
  }
}

module.exports = {
  buscarPedidos,
  buscarPedidoPorId,
  atualizarEnderecoPedido,
  buscarCategorias,
  buscarProdutosPorCategorias,
  testarConexao,
  sincronizarPedidos
};

