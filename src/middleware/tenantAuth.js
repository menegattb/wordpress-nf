/**
 * Middleware de autenticação por token (multi-tenant)
 * Valida Bearer token ou X-Tenant-Token e injeta tenant_id na requisição
 */

const crypto = require('crypto');
const { buscarTenantPorTokenHash } = require('../config/database');
const logger = require('../services/logger');

/**
 * Gera hash SHA-256 do token para comparação com o banco
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Extrai o token da requisição (Authorization Bearer ou X-Tenant-Token)
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const tenantToken = req.headers['x-tenant-token'];
  if (tenantToken) {
    return tenantToken.trim();
  }
  return null;
}

/**
 * Middleware que exige token válido de tenant
 * Define req.tenant_id e req.tenant
 */
async function requireTenantAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    logger.warn('Requisição sem token de tenant', {
      path: req.path,
      method: req.method
    });
    return res.status(401).json({
      sucesso: false,
      erro: 'Token de autenticação não fornecido',
      mensagem: 'Envie o token no header Authorization: Bearer <token> ou X-Tenant-Token'
    });
  }

  const tokenHash = hashToken(token);
  const tenant = await buscarTenantPorTokenHash(tokenHash);

  if (!tenant) {
    logger.warn('Token de tenant inválido ou inativo', {
      path: req.path,
      tokenPreview: token.substring(0, 8) + '...'
    });
    return res.status(401).json({
      sucesso: false,
      erro: 'Token inválido',
      mensagem: 'O token fornecido não é válido ou o tenant está inativo'
    });
  }

  req.tenant_id = tenant.id;
  req.tenant = tenant;
  next();
}

/**
 * Middleware opcional: se houver token, valida e injeta tenant_id
 * Se não houver token, continua (para rotas que aceitam ambos)
 */
async function optionalTenantAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  const tokenHash = hashToken(token);
  const tenant = await buscarTenantPorTokenHash(tokenHash);

  if (tenant) {
    req.tenant_id = tenant.id;
    req.tenant = tenant;
  }

  next();
}

module.exports = {
  requireTenantAuth,
  optionalTenantAuth,
  extractToken,
  hashToken
};
