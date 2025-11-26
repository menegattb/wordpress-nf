const express = require('express');
const router = express.Router();
const config = require('../../config');
const logger = require('../services/logger');
const { testarConexao } = require('../services/focusNFSe');
const fs = require('fs');
const path = require('path');

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
router.get('/focus', (req, res) => {
  try {
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
    let ambiente = 'homologacao';
    let tokenHomologacao = '';
    let tokenProducao = '';
    
    if (isVercel) {
      // Na Vercel: sempre usar process.env
      ambiente = process.env.FOCUS_NFE_AMBIENTE || 'homologacao';
      tokenHomologacao = process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO || '';
      tokenProducao = process.env.FOCUS_NFE_TOKEN_PRODUCAO || '';
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
        tokenHomologacao = process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO || config.focusNFe.token || '4tn92XZHfM22uOfhtmbhb3dMvLk48ymA';
      }
      if (!tokenProducao) {
        tokenProducao = process.env.FOCUS_NFE_TOKEN_PRODUCAO || '';
      }
    }
    
    // Garantir valores padrão se vazios
    if (!tokenHomologacao) {
      tokenHomologacao = '4tn92XZHfM22uOfhtmbhb3dMvLk48ymA';
    }
    
    const tokenAtual = ambiente === 'producao' ? tokenProducao : tokenHomologacao;
    
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
    const resultado = await testarConexao();
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

/**
 * POST /api/config/focus
 * Salva configurações do Focus NFe
 * Na Vercel: apenas atualiza process.env temporariamente (não persiste)
 * Em desenvolvimento: salva no arquivo .env
 */
router.post('/focus', (req, res) => {
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
    
    // Detectar se está rodando na Vercel
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
    
    if (isVercel) {
      // Verificar se os tokens já estão configurados no ambiente ANTES de atualizar
      const tokenHomologacaoJaConfigurado = !!process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO;
      const tokenProducaoJaConfigurado = !!process.env.FOCUS_NFE_TOKEN_PRODUCAO;
      const tokensJaConfigurados = tokenHomologacaoJaConfigurado && (ambiente === 'homologacao' || tokenProducaoJaConfigurado);
      
      // Na Vercel: apenas atualizar process.env temporariamente
      // As variáveis devem ser configuradas no dashboard da Vercel para persistir
      process.env.FOCUS_NFE_AMBIENTE = ambiente;
      if (token_homologacao) {
        process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO = token_homologacao;
      }
      if (token_producao) {
        process.env.FOCUS_NFE_TOKEN_PRODUCAO = token_producao;
      }
      
      logger.info('Configurações do Focus NFe atualizadas temporariamente (Vercel)', {
        ambiente,
        token_homologacao_preview: token_homologacao ? token_homologacao.substring(0, 10) + '...' : 'Não fornecido',
        token_producao_preview: token_producao ? token_producao.substring(0, 10) + '...' : 'Não fornecido',
        has_token_homologacao: !!token_homologacao,
        has_token_producao: !!token_producao,
        tokens_ja_configurados_no_ambiente: tokensJaConfigurados,
        aviso: 'Configuração temporária - configure no dashboard Vercel para persistir'
      });
      
      let mensagem = '';
      let instrucoes = [];
      
      if (tokensJaConfigurados) {
        // Tokens já configurados - só precisa mudar o ambiente
        mensagem = `✅ Configuração temporária aplicada! Como os tokens já estão configurados no dashboard da Vercel, você só precisa atualizar a variável FOCUS_NFE_AMBIENTE para "${ambiente}" no dashboard para persistir.`;
        instrucoes = [
          '1. Acesse: https://vercel.com/seu-projeto/settings/environment-variables',
          `2. Encontre a variável FOCUS_NFE_AMBIENTE e altere para: ${ambiente}`,
          '3. Salve e aguarde o próximo deploy automático (ou faça um redeploy manual)',
          '',
          '💡 Dica: A mudança na interface funciona temporariamente, mas só persiste após atualizar no dashboard.'
        ];
      } else {
        // Tokens não configurados - precisa configurar tudo
        mensagem = '⚠️ Configuração temporária aplicada. Para persistir, configure as variáveis no dashboard da Vercel:';
        instrucoes = [
          '1. Acesse: https://vercel.com/seu-projeto/settings/environment-variables',
          `2. Adicione/atualize: FOCUS_NFE_AMBIENTE = ${ambiente}`,
          token_homologacao ? '3. Adicione/atualize: FOCUS_NFE_TOKEN_HOMOLOGACAO = [seu token]' : '',
          token_producao ? '4. Adicione/atualize: FOCUS_NFE_TOKEN_PRODUCAO = [seu token]' : '',
          '5. Salve e aguarde o próximo deploy automático'
        ].filter(Boolean);
      }
      
      return res.json({
        sucesso: true,
        mensagem: mensagem,
        aviso: 'Na Vercel, as variáveis devem ser configuradas no dashboard para persistir após o deploy.',
        instrucoes: instrucoes,
        dados: {
          ambiente,
          token_homologacao_preview: token_homologacao ? token_homologacao.substring(0, 10) + '...' : null,
          token_producao_preview: token_producao ? token_producao.substring(0, 10) + '...' : null,
          temporario: true,
          tokens_ja_configurados: tokensJaConfigurados
        }
      });
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
FOCUS_NFE_CNPJ=51581345000117
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

