const express = require('express');
const router = express.Router();
const logger = require('../services/logger');
const { comparePassword, isValidHash } = require('../utils/password');

/**
 * GET /api/auth/status
 * Verifica status de autenticação
 */
router.get('/status', (req, res) => {
  const isAuthenticated = !!(req.session && req.session.authenticated);
  
  res.json({
    sucesso: true,
    autenticado: isAuthenticated,
    usuario: isAuthenticated ? req.session.usuario : null
  });
});

/**
 * POST /api/auth/login
 * Realiza login do usuário
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validação básica
    if (!username || !password) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Usuário e senha são obrigatórios'
      });
    }
    
    // Obter credenciais do ambiente
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    
    // Verificar se hash está configurado
    if (!adminPasswordHash) {
      logger.error('ADMIN_PASSWORD_HASH não configurado', {
        service: 'auth',
        action: 'login'
      });
      
      return res.status(500).json({
        sucesso: false,
        erro: 'Configuração de autenticação não encontrada',
        mensagem: 'O sistema não está configurado corretamente. Entre em contato com o administrador.'
      });
    }
    
    // Validar formato do hash
    if (!isValidHash(adminPasswordHash)) {
      logger.error('ADMIN_PASSWORD_HASH inválido', {
        service: 'auth',
        action: 'login'
      });
      
      return res.status(500).json({
        sucesso: false,
        erro: 'Configuração de autenticação inválida',
        mensagem: 'O hash da senha está em formato inválido.'
      });
    }
    
    // Verificar usuário
    if (username !== adminUsername) {
      logger.warn('Tentativa de login com usuário inválido', {
        service: 'auth',
        action: 'login',
        username: username,
        ip: req.ip
      });
      
      return res.status(401).json({
        sucesso: false,
        erro: 'Credenciais inválidas'
      });
    }
    
    // Verificar senha
    const passwordMatch = await comparePassword(password, adminPasswordHash);
    
    if (!passwordMatch) {
      logger.warn('Tentativa de login com senha inválida', {
        service: 'auth',
        action: 'login',
        username: username,
        ip: req.ip
      });
      
      return res.status(401).json({
        sucesso: false,
        erro: 'Credenciais inválidas'
      });
    }
    
    // Criar sessão
    req.session.authenticated = true;
    req.session.usuario = username;
    req.session.loginTime = new Date().toISOString();
    
    // Salvar sessão antes de enviar resposta
    req.session.save((err) => {
      if (err) {
        logger.error('Erro ao salvar sessão', {
          service: 'auth',
          action: 'login',
          error: err.message
        });
      }
    });
    
    logger.info('Login realizado com sucesso', {
      service: 'auth',
      action: 'login',
      username: username,
      ip: req.ip,
      sessionId: req.sessionID
    });
    
    res.json({
      sucesso: true,
      mensagem: 'Login realizado com sucesso',
      usuario: username
    });
    
  } catch (error) {
    logger.error('Erro ao realizar login', {
      service: 'auth',
      action: 'login',
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao realizar login',
      mensagem: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Realiza logout do usuário
 */
router.post('/logout', (req, res) => {
  const username = req.session?.usuario;
  
  // Destruir sessão
  req.session.destroy((err) => {
    if (err) {
      logger.error('Erro ao destruir sessão', {
        service: 'auth',
        action: 'logout',
        error: err.message
      });
      
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro ao realizar logout'
      });
    }
    
    logger.info('Logout realizado com sucesso', {
      service: 'auth',
      action: 'logout',
      username: username,
      ip: req.ip
    });
    
    res.json({
      sucesso: true,
      mensagem: 'Logout realizado com sucesso'
    });
  });
});

module.exports = router;

