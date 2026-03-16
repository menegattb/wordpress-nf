const express = require('express');
const router = express.Router();
const { buscarPedidos, buscarPedidoPorId, buscarCategorias, testarConexao, sincronizarPedidos } = require('../services/woocommerce');
const { getConfigForTenant } = require('../services/tenantService');

async function getCredentials(req) {
  const tenantId = req.tenant_id || null;
  if (!tenantId) return null;
  const cfg = await getConfigForTenant(tenantId);
  return cfg?.woocommerce?.apiUrl ? cfg.woocommerce : null;
}

/**
 * GET /api/woocommerce/test
 * Testa conexão com WooCommerce
 */
router.get('/test', async (req, res) => {
  try {
    const credentials = await getCredentials(req);
    const resultado = await testarConexao(credentials);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
});

/**
 * GET /api/woocommerce/pedidos
 * Busca pedidos do WooCommerce via API REST
 */
router.get('/pedidos', async (req, res) => {
  try {
    const { status, per_page, page, after, before, mes } = req.query;
    
    const filtros = {};
    if (status) filtros.status = status;
    if (per_page) filtros.per_page = parseInt(per_page);
    if (page) filtros.page = parseInt(page);
    if (after) filtros.after = after;
    if (before) filtros.before = before;
    if (mes) filtros.mes = mes; // Formato: YYYY-MM
    
    const credentials = await getCredentials(req);
    const resultado = await buscarPedidos(filtros, credentials);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
});

/**
 * GET /api/woocommerce/pedidos/:id
 * Busca um pedido específico do WooCommerce
 */
router.get('/pedidos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const credentials = await getCredentials(req);
    const resultado = await buscarPedidoPorId(id, credentials);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
});

/**
 * GET /api/woocommerce/categorias
 * Busca categorias de produtos do WooCommerce
 */
router.get('/categorias', async (req, res) => {
  try {
    const credentials = await getCredentials(req);
    const resultado = await buscarCategorias(credentials);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
});

/**
 * POST /api/woocommerce/sincronizar
 * Sincroniza pedidos do WooCommerce salvando no banco de dados
 */
router.post('/sincronizar', async (req, res) => {
  try {
    const credentials = await getCredentials(req);
    const resultado = await sincronizarPedidos(credentials);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
});

module.exports = router;

