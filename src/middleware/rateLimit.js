/**
 * Rate limiting por token (multi-tenant)
 * Usa hash do token como chave quando presente; IP como fallback (com ipKeyGenerator para IPv6)
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { extractToken, hashToken } = require('./tenantAuth');

/**
 * Rate limit para rotas da API (nfse, pedidos, config, etc.)
 * 100 requisições por minuto por token
 */
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100,
  message: {
    sucesso: false,
    erro: 'Limite de requisições excedido',
    mensagem: 'Tente novamente em alguns segundos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = extractToken(req);
    if (token) {
      return hashToken(token);
    }
    return ipKeyGenerator(req.ip);
  }
});

/**
 * Rate limit para webhooks (X-Tenant-Token ou IP)
 * 60 requisições por minuto - webhooks podem ser mais frequentes em picos
 */
const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    sucesso: false,
    erro: 'Limite de webhooks excedido',
    mensagem: 'Tente novamente em alguns segundos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = extractToken(req);
    if (token) {
      return 'wh:' + hashToken(token);
    }
    return 'wh:' + ipKeyGenerator(req.ip);
  }
});

/**
 * Rate limit para rotas de tenant (registrar, renovar)
 * 10 requisições por minuto por IP (evitar abuso)
 */
const tenantRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    sucesso: false,
    erro: 'Limite de requisições excedido',
    mensagem: 'Tente novamente em alguns segundos'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  apiRateLimiter,
  webhookRateLimiter,
  tenantRateLimiter
};
