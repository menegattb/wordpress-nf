const express = require('express');
const router = express.Router();
const config = require('../../config');
const logger = require('../services/logger');

/**
 * GET /api/config/emitente
 * Retorna dados do emitente/prestador
 */
router.get('/emitente', (req, res) => {
  try {
    res.json({
      sucesso: true,
      dados: {
        cnpj: config.emitente.cnpj,
        inscricao_municipal: config.emitente.inscricao_municipal,
        razao_social: config.emitente.razao_social,
        codigo_municipio: config.emitente.codigo_municipio,
        email: config.emitente.email || '',
        telefone: config.emitente.telefone || '',
        optante_simples_nacional: config.emitente.optante_simples_nacional
      }
    });
  } catch (error) {
    logger.error('Erro ao buscar dados do emitente', {
      error: error.message
    });
    
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
});

/**
 * GET /api/config/focus
 * Retorna configurações do Focus NFe (ambiente e tokens mascarados)
 */
router.get('/focus', (req, res) => {
  try {
    const ambiente = config.focusNFe.ambiente || 'homologacao';
    const tokenAtual = ambiente === 'producao'
      ? (process.env.FOCUS_NFE_TOKEN_PRODUCAO || '')
      : (process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO || config.focusNFe.token || '');
    
    res.json({
      sucesso: true,
      dados: {
        ambiente: ambiente,
        token_homologacao: process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO || config.focusNFe.token || '4tn92XZHfM22uOfhtmbhb3dMvLk48ymA',
        token_producao: process.env.FOCUS_NFE_TOKEN_PRODUCAO || '',
        token_atual_preview: tokenAtual ? tokenAtual.substring(0, 10) + '...' : 'Não configurado'
      }
    });
  } catch (error) {
    logger.error('Erro ao buscar configurações do Focus NFe', {
      error: error.message
    });
    
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
});

/**
 * GET /api/config/woocommerce
 * Retorna configurações do WooCommerce
 */
router.get('/woocommerce', (req, res) => {
  try {
    res.json({
      sucesso: true,
      dados: {
        url: config.woocommerce.url || '',
        api_url: config.woocommerce.apiUrl || '',
        consumer_key: config.woocommerce.consumerKey || '',
        consumer_secret: config.woocommerce.consumerSecret || '',
        consumer_key_preview: config.woocommerce.consumerKey ? config.woocommerce.consumerKey.substring(0, 10) + '...' : 'Não configurado',
        consumer_secret_preview: config.woocommerce.consumerSecret ? config.woocommerce.consumerSecret.substring(0, 10) + '...' : 'Não configurado'
      }
    });
  } catch (error) {
    logger.error('Erro ao buscar configurações do WooCommerce', {
      error: error.message
    });
    
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
});

module.exports = router;

