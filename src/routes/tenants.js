/**
 * Rotas de gerenciamento de tenants (multi-tenant)
 * POST /api/tenants/registrar - Registra novo tenant (requer ADMIN_SECRET)
 * POST /api/tenants/renovar-token - Renova token (requer token atual)
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../services/logger');
const { salvarTenant, buscarTenantPorTokenHash, query } = require('../config/database');
const { hashToken, extractToken } = require('../middleware/tenantAuth');

function generateToken() {
  return 'nf_' + crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware: valida ADMIN_SECRET para registro inicial
 */
function requireAdminSecret(req, res, next) {
  const secret = req.headers['x-admin-secret'] || req.body?.admin_secret || req.query?.admin_secret;
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    logger.warn('ADMIN_SECRET não configurado - registro de tenants desabilitado');
    return res.status(503).json({
      sucesso: false,
      erro: 'Registro de tenants não configurado',
      mensagem: 'Configure ADMIN_SECRET no servidor'
    });
  }

  if (!secret || secret !== expected) {
    return res.status(401).json({
      sucesso: false,
      erro: 'Não autorizado',
      mensagem: 'ADMIN_SECRET inválido'
    });
  }

  next();
}

/**
 * POST /api/tenants/registrar
 * Registra novo tenant. Requer ADMIN_SECRET.
 * Body: { nome?, site_url? }
 */
router.post('/registrar', requireAdminSecret, async (req, res) => {
  try {
    const { nome, site_url } = req.body || {};

    const token = generateToken();
    const tokenHash = hashToken(token);

    const tenant = await salvarTenant({
      token_hash: tokenHash,
      nome: nome || '',
      site_url: site_url || ''
    });

    logger.info('Novo tenant registrado', {
      tenant_id: tenant.id,
      nome: tenant.nome,
      site_url: tenant.site_url
    });

    res.status(201).json({
      sucesso: true,
      mensagem: 'Tenant registrado. Guarde o token - ele não será exibido novamente.',
      dados: {
        tenant_id: tenant.id,
        nome: tenant.nome,
        site_url: tenant.site_url,
        token,
        token_preview: token.substring(0, 12) + '...'
      }
    });
  } catch (error) {
    logger.error('Erro ao registrar tenant', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
});

/**
 * POST /api/tenants/renovar-token
 * Gera novo token para tenant existente. Requer token atual.
 * Body: { nome?, site_url? } (opcional - atualiza dados)
 */
router.post('/renovar-token', async (req, res) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        sucesso: false,
        erro: 'Token não fornecido',
        mensagem: 'Envie o token atual em Authorization: Bearer <token> ou X-Tenant-Token'
      });
    }

    const tokenHash = hashToken(token);
    const tenant = await buscarTenantPorTokenHash(tokenHash);

    if (!tenant) {
      return res.status(401).json({
        sucesso: false,
        erro: 'Token inválido',
        mensagem: 'O token fornecido não é válido'
      });
    }

    const { nome, site_url } = req.body || {};
    const newToken = generateToken();
    const newTokenHash = hashToken(newToken);

    // Atualizar token do tenant
    await query(
      'UPDATE tenants SET token_hash = $1, nome = COALESCE($2, nome), site_url = COALESCE($3, site_url), updated_at = NOW() WHERE id = $4',
      [newTokenHash, nome || null, site_url || null, tenant.id]
    );

    logger.info('Token do tenant renovado', {
      tenant_id: tenant.id
    });

    res.json({
      sucesso: true,
      mensagem: 'Token renovado. Guarde o novo token - o anterior foi invalidado.',
      dados: {
        tenant_id: tenant.id,
        token: newToken,
        token_preview: newToken.substring(0, 12) + '...'
      }
    });
  } catch (error) {
    logger.error('Erro ao renovar token', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
});

module.exports = router;
