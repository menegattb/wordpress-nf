const express = require('express');
const router = express.Router();
const config = require('../../config');
const logger = require('../services/logger');
const { testarConexao } = require('../services/focusNFSe');
const { salvarConfiguracao, buscarConfiguracao, salvarConfiguracaoTenant, buscarConfiguracaoTenant, carregarConfiguracoesFocus } = require('../config/database');
const { getConfigForTenant } = require('../services/tenantService');
const fs = require('fs');
const path = require('path');

/**
 * GET /api/config/emitente
 * Retorna dados do emitente/prestador (por tenant quando token presente)
 */
router.get('/emitente', async (req, res) => {
  try {
    const cfg = req.tenant_id ? await getConfigForTenant(req.tenant_id) : config;
    res.json({
      sucesso: true,
      dados: {
        cnpj: cfg.emitente.cnpj,
        inscricao_municipal: cfg.emitente.inscricao_municipal,
        razao_social: cfg.emitente.razao_social,
        codigo_municipio: cfg.emitente.codigo_municipio,
        email: cfg.emitente.email || '',
        telefone: cfg.emitente.telefone || '',
        optante_simples_nacional: cfg.emitente.optante_simples_nacional
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
 * GET /api/config/webhook-url
 * Retorna a URL base do webhook para configurar na Focus NFe
 */
router.get('/webhook-url', (req, res) => {
  try {
    // Tentar obter URL base de várias fontes
    let baseUrl = process.env.BASE_URL || process.env.VERCEL_URL;
    
    if (!baseUrl) {
      // Se não houver variável de ambiente, usar a URL da requisição
      const protocol = req.protocol || 'http';
      const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
      baseUrl = `${protocol}://${host}`;
    } else {
      // Garantir que tenha protocolo
      if (!baseUrl.startsWith('http')) {
        baseUrl = `https://${baseUrl}`;
      }
    }
    
    const webhookUrl = `${baseUrl}/api/webhook/focus-nfe`;
    
    res.json({
      sucesso: true,
      webhook_url: webhookUrl,
      base_url: baseUrl,
      ambiente: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Erro ao obter URL do webhook', {
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
 * Na Vercel: lê de process.env
 * Em desenvolvimento: tenta ler do arquivo .env, fallback para process.env
 */
router.get('/focus', async (req, res) => {
  try {
    // Quando tenant_id presente, usar config do tenant
    if (req.tenant_id) {
      const cfg = await getConfigForTenant(req.tenant_id);
      return res.json({
        sucesso: true,
        dados: {
          ambiente: cfg.focusNFe.ambiente,
          token_homologacao: cfg.focusNFe.token || '',
          token_producao: '',
          token_atual_preview: cfg.focusNFe.token ? cfg.focusNFe.token.substring(0, 10) + '...' : 'Não configurado',
          ambiente_atual: 'tenant'
        }
      });
    }

    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
    let ambiente = 'homologacao';
    let tokenHomologacao = '';
    let tokenProducao = '';
    
    // Tentar ler do banco primeiro (funciona em qualquer ambiente)
    let ambienteDoBanco = null;
    let tokenHomologacaoDoBanco = null;
    let tokenProducaoDoBanco = null;
    
    try {
      ambienteDoBanco = await buscarConfiguracao('FOCUS_NFE_AMBIENTE');
      tokenHomologacaoDoBanco = await buscarConfiguracao('FOCUS_NFE_TOKEN_HOMOLOGACAO');
      tokenProducaoDoBanco = await buscarConfiguracao('FOCUS_NFE_TOKEN_PRODUCAO');
      
      logger.info('Configurações lidas do banco', {
        ambienteDoBanco,
        temTokenHomologacao: !!tokenHomologacaoDoBanco,
        temTokenProducao: !!tokenProducaoDoBanco
      });
      
      // Se encontrou no banco, usar esses valores (prioridade máxima)
      if (ambienteDoBanco) {
        ambiente = ambienteDoBanco;
      }
      if (tokenHomologacaoDoBanco) {
        tokenHomologacao = tokenHomologacaoDoBanco;
      }
      if (tokenProducaoDoBanco) {
        tokenProducao = tokenProducaoDoBanco;
      }
    } catch (err) {
      // Ignorar erros ao ler do banco
      logger.warn('Erro ao ler configurações do banco', {
        error: err.message
      });
    }
    
    if (isVercel) {
      // Na Vercel: usar process.env apenas como fallback se não tiver no banco
      if (!ambienteDoBanco) {
        ambiente = process.env.FOCUS_NFE_AMBIENTE || 'homologacao';
      }
      if (!tokenHomologacaoDoBanco) {
        tokenHomologacao = process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO || '';
      }
      if (!tokenProducaoDoBanco) {
        tokenProducao = process.env.FOCUS_NFE_TOKEN_PRODUCAO || '';
      }
    } else {
      // Desenvolvimento: tentar ler do .env primeiro
      const envPath = path.join(process.cwd(), '.env');
      
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        
        // Extrair valores do .env
        const ambienteMatch = envContent.match(/^FOCUS_NFE_AMBIENTE=(.+)$/m);
        const tokenHomologacaoMatch = envContent.match(/^FOCUS_NFE_TOKEN_HOMOLOGACAO=(.+)$/m);
        const tokenProducaoMatch = envContent.match(/^FOCUS_NFE_TOKEN_PRODUCAO=(.+)$/m);
        
        if (ambienteMatch) {
          ambiente = ambienteMatch[1].trim();
        }
        if (tokenHomologacaoMatch) {
          tokenHomologacao = tokenHomologacaoMatch[1].trim();
        }
        if (tokenProducaoMatch) {
          tokenProducao = tokenProducaoMatch[1].trim();
        }
      }
      
      // Fallback para process.env ou config se .env não existir ou valores vazios
      if (!ambiente || ambiente === 'homologacao') {
        ambiente = process.env.FOCUS_NFE_AMBIENTE || config.focusNFe.ambiente || 'homologacao';
      }
      if (!tokenHomologacao) {
        tokenHomologacao = process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO || config.focusNFe.token || '';
      }
      if (!tokenProducao) {
        tokenProducao = process.env.FOCUS_NFE_TOKEN_PRODUCAO || '';
      }
    }
    
    // Garantir valores padrão se vazios
    if (!tokenHomologacao) {
      tokenHomologacao = '';
    }
    
    const tokenAtual = ambiente === 'producao' ? tokenProducao : tokenHomologacao;
    
    logger.info('GET /api/config/focus - Retornando configurações', {
      ambiente,
      ambienteDoBanco,
      isVercel,
      temTokenHomologacao: !!tokenHomologacao,
      temTokenProducao: !!tokenProducao
    });
    
    res.json({
      sucesso: true,
      dados: {
        ambiente: ambiente,
        token_homologacao: tokenHomologacao,
        token_producao: tokenProducao,
        token_atual_preview: tokenAtual ? tokenAtual.substring(0, 10) + '...' : 'Não configurado',
        ambiente_atual: isVercel ? 'vercel' : 'local'
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
 * GET /api/config/focus/test
 * Testa conexão com Focus NFe
 */
router.get('/focus/test', async (req, res) => {
  try {
    const tenantId = req.tenant_id || null;
    const cfg = tenantId ? await getConfigForTenant(tenantId) : null;
    const configFocus = tenantId && cfg?.focusNFe ? { token: cfg.focusNFe.token, ambiente: cfg.focusNFe.ambiente } : null;
    const resultado = await testarConexao(configFocus);
    res.json(resultado);
  } catch (error) {
    logger.error('Erro ao testar conexão Focus NFe', {
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
 * Retorna configurações do WooCommerce (por tenant quando token presente)
 */
router.get('/woocommerce', async (req, res) => {
  try {
    const cfg = req.tenant_id ? await getConfigForTenant(req.tenant_id) : config;
    res.json({
      sucesso: true,
      dados: {
        url: cfg.woocommerce.url || '',
        api_url: cfg.woocommerce.apiUrl || '',
        consumer_key: cfg.woocommerce.consumerKey || '',
        consumer_secret: cfg.woocommerce.consumerSecret || '',
        consumer_key_preview: cfg.woocommerce.consumerKey ? cfg.woocommerce.consumerKey.substring(0, 10) + '...' : 'Não configurado',
        consumer_secret_preview: cfg.woocommerce.consumerSecret ? cfg.woocommerce.consumerSecret.substring(0, 10) + '...' : 'Não configurado'
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

/**
 * POST /api/config/focus
 * Salva configurações do Focus NFe
 * Na Vercel: salva no banco de dados e atualiza process.env
 * Em desenvolvimento: salva no arquivo .env
 */
router.post('/focus', async (req, res) => {
  try {
    const { ambiente, token_homologacao, token_producao } = req.body;
    
    // Validação básica
    if (!ambiente || !['homologacao', 'producao'].includes(ambiente)) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Ambiente inválido. Deve ser "homologacao" ou "producao"'
      });
    }
    
    if (ambiente === 'homologacao' && !token_homologacao) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Token de homologação é obrigatório quando o ambiente é homologação'
      });
    }
    
    if (ambiente === 'producao' && !token_producao) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Token de produção é obrigatório quando o ambiente é produção'
      });
    }

    // Quando tenant_id presente, salvar em tenant_config
    if (req.tenant_id) {
      await salvarConfiguracaoTenant(req.tenant_id, 'FOCUS_NFE_AMBIENTE', ambiente);
      if (token_homologacao) await salvarConfiguracaoTenant(req.tenant_id, 'FOCUS_NFE_TOKEN_HOMOLOGACAO', token_homologacao);
      if (token_producao) await salvarConfiguracaoTenant(req.tenant_id, 'FOCUS_NFE_TOKEN_PRODUCAO', token_producao);
      return res.json({
        sucesso: true,
        mensagem: 'Configurações salvas para o tenant.',
        dados: { ambiente, persistido: true }
      });
    }
    
    // Detectar se está rodando na Vercel
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
    
    if (isVercel) {
      // Na Vercel: salvar no banco de dados (persiste entre invocações)
      try {
        // Salvar no banco
        await salvarConfiguracao('FOCUS_NFE_AMBIENTE', ambiente);
        if (token_homologacao) {
          await salvarConfiguracao('FOCUS_NFE_TOKEN_HOMOLOGACAO', token_homologacao);
        }
        if (token_producao) {
          await salvarConfiguracao('FOCUS_NFE_TOKEN_PRODUCAO', token_producao);
        }
        
        // Atualizar process.env imediatamente
        process.env.FOCUS_NFE_AMBIENTE = ambiente;
        if (token_homologacao) {
          process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO = token_homologacao;
        }
        if (token_producao) {
          process.env.FOCUS_NFE_TOKEN_PRODUCAO = token_producao;
        }
        
        logger.info('Configurações do Focus NFe salvas no banco de dados (Vercel)', {
          ambiente,
          token_homologacao_preview: token_homologacao ? token_homologacao.substring(0, 10) + '...' : 'Não fornecido',
          token_producao_preview: token_producao ? token_producao.substring(0, 10) + '...' : 'Não fornecido',
          has_token_homologacao: !!token_homologacao,
          has_token_producao: !!token_producao
        });
        
        return res.json({
          sucesso: true,
          mensagem: `✅ Configurações salvas com sucesso! Ambiente alterado para "${ambiente}". As mudanças já estão ativas.`,
          dados: {
            ambiente,
            token_homologacao_preview: token_homologacao ? token_homologacao.substring(0, 10) + '...' : null,
            token_producao_preview: token_producao ? token_producao.substring(0, 10) + '...' : null,
            persistido: true
          }
        });
      } catch (dbError) {
        logger.error('Erro ao salvar configurações no banco', {
          error: dbError.message
        });
        
        // Fallback: apenas atualizar process.env temporariamente
        process.env.FOCUS_NFE_AMBIENTE = ambiente;
        if (token_homologacao) {
          process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO = token_homologacao;
        }
        if (token_producao) {
          process.env.FOCUS_NFE_TOKEN_PRODUCAO = token_producao;
        }
        
        return res.json({
          sucesso: true,
          mensagem: '⚠️ Configuração aplicada temporariamente. Erro ao salvar no banco: ' + dbError.message,
          dados: {
            ambiente,
            token_homologacao_preview: token_homologacao ? token_homologacao.substring(0, 10) + '...' : null,
            token_producao_preview: token_producao ? token_producao.substring(0, 10) + '...' : null,
            temporario: true
          }
        });
      }
    }
    
    // Desenvolvimento local: salvar no arquivo .env
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    
    // Ler arquivo .env existente ou criar novo
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    } else {
      // Criar arquivo .env básico se não existir
      envContent = `# Focus NFe - Configurações
FOCUS_NFE_AMBIENTE=homologacao
FOCUS_NFE_TOKEN_HOMOLOGACAO=
FOCUS_NFE_TOKEN_PRODUCAO=
FOCUS_NFE_CNPJ=
`;
    }
    
    // Função auxiliar para atualizar ou adicionar variável
    const atualizarVariavel = (nome, valor) => {
      const regex = new RegExp(`^${nome}=.*$`, 'm');
      if (envContent.match(regex)) {
        envContent = envContent.replace(regex, `${nome}=${valor}`);
      } else {
        // Adicionar no final do arquivo
        envContent += `\n${nome}=${valor}\n`;
      }
    };
    
    // Atualizar variáveis
    atualizarVariavel('FOCUS_NFE_AMBIENTE', ambiente);
    
    if (token_homologacao) {
      atualizarVariavel('FOCUS_NFE_TOKEN_HOMOLOGACAO', token_homologacao);
    }
    
    if (token_producao) {
      atualizarVariavel('FOCUS_NFE_TOKEN_PRODUCAO', token_producao);
    }
    
    // Salvar arquivo .env
    try {
      fs.writeFileSync(envPath, envContent, 'utf8');
      
      // Atualizar process.env para refletir mudanças imediatamente
      process.env.FOCUS_NFE_AMBIENTE = ambiente;
      if (token_homologacao) {
        process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO = token_homologacao;
      }
      if (token_producao) {
        process.env.FOCUS_NFE_TOKEN_PRODUCAO = token_producao;
      }
      
      logger.info('Configurações do Focus NFe salvas no arquivo .env', {
        ambiente,
        token_homologacao_preview: token_homologacao ? token_homologacao.substring(0, 10) + '...' : 'Não fornecido',
        token_producao_preview: token_producao ? token_producao.substring(0, 10) + '...' : 'Não fornecido',
        has_token_homologacao: !!token_homologacao,
        has_token_producao: !!token_producao,
        env_file_path: envPath
      });
      
      return res.json({
        sucesso: true,
        mensagem: 'Configurações salvas com sucesso! As mudanças já estão ativas. Reinicie o servidor para garantir que todas as configurações sejam recarregadas.',
        dados: {
          ambiente,
          token_homologacao_preview: token_homologacao ? token_homologacao.substring(0, 10) + '...' : null,
          token_producao_preview: token_producao ? token_producao.substring(0, 10) + '...' : null
        }
      });
      
    } catch (writeError) {
      logger.error('Erro ao salvar arquivo .env', {
        error: writeError.message,
        env_path: envPath
      });
      
      return res.status(500).json({
        sucesso: false,
        erro: `Erro ao salvar arquivo .env: ${writeError.message}`
      });
    }
    
  } catch (error) {
    logger.error('Erro ao salvar configurações do Focus NFe', {
      error: error.message
    });
    
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
});

/**
 * GET /api/config/auto-emitir
 * Retorna se emissao automatica esta ativa (por tenant ou global)
 */
router.get('/auto-emitir', async (req, res) => {
  try {
    let valor = null;
    if (req.tenant_id) {
      valor = await buscarConfiguracaoTenant(req.tenant_id, 'AUTO_EMITIR');
    }
    if (valor === null) {
      valor = await buscarConfiguracao('AUTO_EMITIR');
    }
    res.json({ sucesso: true, auto_emitir: valor === 'true' || valor === '1' });
  } catch (error) {
    res.json({ sucesso: true, auto_emitir: false });
  }
});

/**
 * POST /api/config/auto-emitir
 * Ativa/desativa emissao automatica
 * Body: { ativo: true/false }
 */
router.post('/auto-emitir', async (req, res) => {
  try {
    const { ativo } = req.body;
    const valor = ativo ? 'true' : 'false';

    if (req.tenant_id) {
      await salvarConfiguracaoTenant(req.tenant_id, 'AUTO_EMITIR', valor);
    } else {
      await salvarConfiguracao('AUTO_EMITIR', valor);
    }

    // Invalidar cache do tenant
    try {
      const { invalidateCache } = require('../services/tenantService');
      if (invalidateCache) invalidateCache(req.tenant_id);
    } catch (e) { /* ok */ }

    logger.info('Emissao automatica ' + (ativo ? 'ativada' : 'desativada'), {
      tenant_id: req.tenant_id || 'global'
    });

    res.json({ sucesso: true, auto_emitir: ativo === true });
  } catch (error) {
    logger.error('Erro ao salvar auto-emitir', { error: error.message });
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

/**
 * GET /api/config/auto-emitir-servico
 * Retorna se emissao automatica de SERVICO esta ativa
 */
router.get('/auto-emitir-servico', async (req, res) => {
  try {
    let valor = null;
    if (req.tenant_id) {
      valor = await buscarConfiguracaoTenant(req.tenant_id, 'AUTO_EMITIR_SERVICO');
    }
    if (valor === null) {
      valor = await buscarConfiguracao('AUTO_EMITIR_SERVICO');
    }
    // Compatibilidade: se não houver config específica de serviço, usar AUTO_EMITIR
    if (valor === null) {
      if (req.tenant_id) valor = await buscarConfiguracaoTenant(req.tenant_id, 'AUTO_EMITIR');
      if (valor === null) valor = await buscarConfiguracao('AUTO_EMITIR');
    }
    res.json({ sucesso: true, auto_emitir: valor === 'true' || valor === '1' });
  } catch (error) {
    res.json({ sucesso: true, auto_emitir: false });
  }
});

/**
 * POST /api/config/auto-emitir-servico
 * Body: { ativo: true/false }
 */
router.post('/auto-emitir-servico', async (req, res) => {
  try {
    const { ativo } = req.body;
    const valor = ativo ? 'true' : 'false';

    if (req.tenant_id) {
      await salvarConfiguracaoTenant(req.tenant_id, 'AUTO_EMITIR_SERVICO', valor);
    } else {
      await salvarConfiguracao('AUTO_EMITIR_SERVICO', valor);
    }

    try {
      const { invalidateCache } = require('../services/tenantService');
      if (invalidateCache) invalidateCache(req.tenant_id);
    } catch (e) { /* ok */ }

    logger.info('Emissao automatica de servico ' + (ativo ? 'ativada' : 'desativada'), {
      tenant_id: req.tenant_id || 'global'
    });
    res.json({ sucesso: true, auto_emitir: ativo === true });
  } catch (error) {
    logger.error('Erro ao salvar auto-emitir-servico', { error: error.message });
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

/**
 * GET /api/config/categorias-produto
 * Retorna lista de categorias que sao de produto (NFe)
 */
router.get('/categorias-produto', async (req, res) => {
  try {
    let valor = null;
    if (req.tenant_id) {
      valor = await buscarConfiguracaoTenant(req.tenant_id, 'CATEGORIAS_PRODUTO');
    }
    if (valor === null) {
      valor = await buscarConfiguracao('CATEGORIAS_PRODUTO');
    }
    let categorias = [];
    const temConfig = valor !== null && valor !== undefined && valor !== '';
    if (temConfig) {
      try { categorias = JSON.parse(valor); } catch (e) { categorias = []; }
    }
    res.json({ sucesso: true, categorias, tem_config: temConfig });
  } catch (error) {
    res.json({ sucesso: true, categorias: [], tem_config: false });
  }
});

/**
 * POST /api/config/categorias-produto
 * Salva lista de categorias de produto
 * Body: { categorias: ["Cat1", "Cat2"] }
 */
router.post('/categorias-produto', async (req, res) => {
  try {
    const { categorias } = req.body;
    if (!Array.isArray(categorias)) {
      return res.status(400).json({ sucesso: false, erro: 'categorias deve ser um array' });
    }
    const valor = JSON.stringify(categorias);

    if (req.tenant_id) {
      await salvarConfiguracaoTenant(req.tenant_id, 'CATEGORIAS_PRODUTO', valor);
    } else {
      await salvarConfiguracao('CATEGORIAS_PRODUTO', valor);
    }

    try {
      const { invalidateCache } = require('../services/tenantService');
      if (invalidateCache) invalidateCache(req.tenant_id);
    } catch (e) { /* ok */ }

    logger.info('Categorias de produto salvas', { tenant_id: req.tenant_id || 'global', categorias });
    res.json({ sucesso: true, categorias });
  } catch (error) {
    logger.error('Erro ao salvar categorias de produto', { error: error.message });
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

/**
 * GET /api/config/categorias-servico
 * Retorna lista de categorias de serviço selecionadas manualmente
 */
router.get('/categorias-servico', async (req, res) => {
  try {
    let valor = null;
    if (req.tenant_id) {
      valor = await buscarConfiguracaoTenant(req.tenant_id, 'CATEGORIAS_SERVICO');
    }
    if (valor === null) {
      valor = await buscarConfiguracao('CATEGORIAS_SERVICO');
    }
    let categorias = [];
    let temConfig = false;
    if (valor !== null && valor !== undefined && valor !== '') {
      temConfig = true;
      try { categorias = JSON.parse(valor); } catch (e) { categorias = []; }
    }
    res.json({ sucesso: true, categorias, tem_config: temConfig });
  } catch (error) {
    res.json({ sucesso: true, categorias: [], tem_config: false });
  }
});

/**
 * POST /api/config/categorias-servico
 * Body: { categorias: ["Cat A", "Cat B", "Sem categoria"] }
 */
router.post('/categorias-servico', async (req, res) => {
  try {
    const { categorias } = req.body;
    if (!Array.isArray(categorias)) {
      return res.status(400).json({ sucesso: false, erro: 'categorias deve ser um array' });
    }
    const valor = JSON.stringify(categorias);

    if (req.tenant_id) {
      await salvarConfiguracaoTenant(req.tenant_id, 'CATEGORIAS_SERVICO', valor);
    } else {
      await salvarConfiguracao('CATEGORIAS_SERVICO', valor);
    }

    try {
      const { invalidateCache } = require('../services/tenantService');
      if (invalidateCache) invalidateCache(req.tenant_id);
    } catch (e) { /* ok */ }

    logger.info('Categorias de serviço salvas', { tenant_id: req.tenant_id || 'global', categorias });
    res.json({ sucesso: true, categorias });
  } catch (error) {
    logger.error('Erro ao salvar categorias de serviço', { error: error.message });
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

/**
 * GET /api/config/google-sheets
 * Retorna configuracao do Google Sheets (por tenant ou global)
 */
router.get('/google-sheets', async (req, res) => {
  try {
    let sheetsId = null;
    let credentials = null;

    if (req.tenant_id) {
      sheetsId = await buscarConfiguracaoTenant(req.tenant_id, 'GOOGLE_SHEETS_ID');
      credentials = await buscarConfiguracaoTenant(req.tenant_id, 'GOOGLE_SHEETS_CREDENTIALS');
    }
    if (sheetsId === null) {
      sheetsId = await buscarConfiguracao('GOOGLE_SHEETS_ID');
    }
    if (credentials === null) {
      credentials = await buscarConfiguracao('GOOGLE_SHEETS_CREDENTIALS');
    }

    // Fallback para .env
    if (!sheetsId) sheetsId = process.env.GOOGLE_SHEETS_ID || '';
    if (!credentials) credentials = process.env.GOOGLE_SHEETS_CREDENTIALS || '';

    let credentialsParsed = null;
    if (credentials) {
      try {
        credentialsParsed = JSON.parse(credentials);
      } catch (e) { /* raw string */ }
    }

    res.json({
      sucesso: true,
      dados: {
        sheets_id: sheetsId,
        tem_credentials: !!credentials && credentials.length > 2,
        client_email: credentialsParsed?.client_email || ''
      }
    });
  } catch (error) {
    logger.error('Erro ao buscar config Google Sheets', { error: error.message });
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

/**
 * POST /api/config/google-sheets
 * Salva configuracao do Google Sheets
 * Body: { sheets_id, credentials_json }
 */
router.post('/google-sheets', async (req, res) => {
  try {
    const { sheets_id, credentials_json } = req.body;

    if (credentials_json) {
      try {
        JSON.parse(credentials_json);
      } catch (e) {
        return res.status(400).json({ sucesso: false, erro: 'JSON de credenciais inválido' });
      }
    }

    if (req.tenant_id) {
      if (sheets_id !== undefined) await salvarConfiguracaoTenant(req.tenant_id, 'GOOGLE_SHEETS_ID', sheets_id);
      if (credentials_json !== undefined) await salvarConfiguracaoTenant(req.tenant_id, 'GOOGLE_SHEETS_CREDENTIALS', credentials_json);
    } else {
      if (sheets_id !== undefined) await salvarConfiguracao('GOOGLE_SHEETS_ID', sheets_id);
      if (credentials_json !== undefined) await salvarConfiguracao('GOOGLE_SHEETS_CREDENTIALS', credentials_json);
    }

    try {
      const { invalidateCache } = require('../services/tenantService');
      if (invalidateCache) invalidateCache(req.tenant_id);
    } catch (e) { /* ok */ }

    // Reinicializar o serviço Google Sheets
    try {
      const googleSheets = require('../services/googleSheets');
      googleSheets.initialized = false;
      if (sheets_id) googleSheets.spreadsheetId = sheets_id;
    } catch (e) { /* ok */ }

    logger.info('Config Google Sheets salva', { tenant_id: req.tenant_id || 'global' });
    res.json({ sucesso: true });
  } catch (error) {
    logger.error('Erro ao salvar config Google Sheets', { error: error.message });
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

/**
 * POST /api/config/google-sheets/testar
 * Testa conexao com Google Sheets
 */
router.post('/google-sheets/testar', async (req, res) => {
  try {
    const googleSheets = require('../services/googleSheets');
    googleSheets.initialized = false;

    let sheetsId = null;
    let credentials = null;

    if (req.tenant_id) {
      sheetsId = await buscarConfiguracaoTenant(req.tenant_id, 'GOOGLE_SHEETS_ID');
      credentials = await buscarConfiguracaoTenant(req.tenant_id, 'GOOGLE_SHEETS_CREDENTIALS');
    }
    if (!sheetsId) sheetsId = await buscarConfiguracao('GOOGLE_SHEETS_ID') || process.env.GOOGLE_SHEETS_ID;
    if (!credentials) credentials = await buscarConfiguracao('GOOGLE_SHEETS_CREDENTIALS') || process.env.GOOGLE_SHEETS_CREDENTIALS;

    if (!sheetsId || !credentials) {
      return res.json({ sucesso: false, erro: 'ID da planilha ou credenciais não configurados' });
    }

    // Temporarily override env for testing
    const oldId = process.env.GOOGLE_SHEETS_ID;
    const oldCred = process.env.GOOGLE_SHEETS_CREDENTIALS;
    process.env.GOOGLE_SHEETS_ID = sheetsId;
    process.env.GOOGLE_SHEETS_CREDENTIALS = credentials;

    try {
      await googleSheets.init();
      process.env.GOOGLE_SHEETS_ID = oldId;
      process.env.GOOGLE_SHEETS_CREDENTIALS = oldCred;
      res.json({ sucesso: true, mensagem: 'Conexão com Google Sheets bem-sucedida!' });
    } catch (initError) {
      process.env.GOOGLE_SHEETS_ID = oldId;
      process.env.GOOGLE_SHEETS_CREDENTIALS = oldCred;
      res.json({ sucesso: false, erro: initError.message });
    }
  } catch (error) {
    logger.error('Erro ao testar Google Sheets', { error: error.message });
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

/**
 * GET /api/config/logs
 * Retorna logs do servidor
 */
router.get('/logs', async (req, res) => {
  try {
    const { limite = 100, nivel } = req.query;
    const { listarLogs } = require('../config/database');
    
    const filtros = {
      limite: parseInt(limite),
      offset: 0
    };
    
    if (nivel) {
      filtros.level = nivel.toUpperCase();
    }
    
    const logs = await listarLogs(filtros);
    
    res.json({
      sucesso: true,
      logs: logs
    });
  } catch (error) {
    logger.error('Erro ao buscar logs do servidor', {
      error: error.message
    });
    
    res.status(500).json({
      sucesso: false,
      erro: error.message
    });
  }
});

module.exports = router;

