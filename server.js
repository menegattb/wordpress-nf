require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session');
const logger = require('./src/services/logger');

// Importar rotas
const authRoutes = require('./src/routes/auth');
const webhookRoutes = require('./src/routes/webhook');
const nfseRoutes = require('./src/routes/nfse');
const pedidoRoutes = require('./src/routes/pedidos');
const woocommerceRoutes = require('./src/routes/woocommerce');
const configRoutes = require('./src/routes/config');
const backupRoutes = require('./src/routes/backups');
const excelRoutes = require('./src/routes/excel');
const tenantRoutes = require('./src/routes/tenants');
const stripeRoutes = require('./src/routes/stripe');
const adminRoutes = require('./src/routes/admin');

// Importar middleware de autenticação
const { requireAuth, checkAuth } = require('./src/middleware/auth');
const { optionalTenantAuth, requireTenantAuth } = require('./src/middleware/tenantAuth');
const { apiRateLimiter, webhookRateLimiter, tenantRateLimiter } = require('./src/middleware/rateLimit');

const app = express();

// Executar migrations automaticamente no startup (apenas se houver banco)
(async () => {
  try {
    const { migrate, carregarConfiguracoesFocus } = require('./src/config/database');
    await migrate();
    // Carregar configurações do Focus NFe do banco após migrations
    await carregarConfiguracoesFocus();
  } catch (error) {
    console.log('⚠ Erro ao executar migrations no startup:', error.message);
  }
})();

// Trust proxy (Vercel, nginx, etc.) - necessário para cookies secure e req.ip corretos
app.set('trust proxy', 1);

// Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());

// Stripe webhook PRECISA do body raw para verificar assinatura - antes de express.json
const stripeController = require('./src/controllers/stripeController');
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeController.handleWebhook);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configurar sessões (cookie-session = funciona em Vercel serverless, sessão no cookie)
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
// IMPORTANTE: SESSION_SECRET deve estar definido na Vercel (Settings > Environment Variables)
// Sem isso, cada cold start usa chave diferente e o login não persiste
const sessionSecret = process.env.SESSION_SECRET || (() => {
  if (isVercel || isProduction) {
    console.error('⚠️ SESSION_SECRET não configurado! Configure em Vercel > Settings > Environment Variables');
  }
  return 'fallback-' + Date.now();
})();

app.use(cookieSession({
  name: 'mj-notas.sid',
  keys: [sessionSecret],
  maxAge: 24 * 60 * 60 * 1000, // 24 horas
  secure: isVercel || isProduction,
  httpOnly: true,
  sameSite: 'lax',
  path: '/'
}));

// Middleware para verificar autenticação (não bloqueia, apenas adiciona info) - LOGIN DESABILITADO
// app.use(checkAuth);

// Servir arquivos estáticos da pasta public (exceto login.html - LOGIN DESABILITADO)
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    // Bloquear acesso ao login.html
    if (path.endsWith('login.html')) {
      res.setHeader('Cache-Control', 'no-cache');
      // Redirecionar para raiz se tentar acessar login.html
    }
  }
}));

// Bloquear acesso direto ao login.html - LOGIN DESABILITADO
app.get('/login.html', (req, res) => {
  res.redirect('/');
});
app.get('/login', (req, res) => {
  res.redirect('/');
});

// Middleware de logging (sem console.log, apenas salva nos arquivos)
app.use((req, res, next) => {
  // Log apenas nos arquivos, não no console
  logger.info(`${req.method} ${req.path}`, {
    service: 'server',
    action: 'request',
    method: req.method,
    path: req.path,
    ip: req.ip,
    query: req.query,
    body: req.method === 'POST' ? req.body : undefined
  });
  next();
});

// Rotas públicas (não requerem autenticação)
app.use('/api/auth', authRoutes);
app.use('/api/webhook', webhookRateLimiter, webhookRoutes); // Webhooks públicos
app.use('/api/tenants', tenantRateLimiter, tenantRoutes); // Registrar/renovar token (ADMIN_SECRET ou token)
// Stripe: só ativar se configurado (modelo manual não usa checkout)
if (process.env.STRIPE_SECRET_KEY) {
  app.use('/api/stripe', tenantRateLimiter, stripeRoutes);
}

// Rotas com tenant (optionalTenantAuth: injeta req.tenant_id quando token presente)
app.use('/api/nfse', apiRateLimiter, optionalTenantAuth, nfseRoutes);
app.use('/api/pedidos', apiRateLimiter, optionalTenantAuth, pedidoRoutes);
app.use('/api/woocommerce', apiRateLimiter, optionalTenantAuth, woocommerceRoutes);
app.use('/api/config', apiRateLimiter, optionalTenantAuth, configRoutes);
app.use('/api/backups', apiRateLimiter, optionalTenantAuth, backupRoutes);
app.use('/api/excel', apiRateLimiter, optionalTenantAuth, excelRoutes);

// Rotas admin (requerem login)
app.use('/api/admin', requireAuth, adminRoutes);

// Função auxiliar para ler ambiente do .env
function lerAmbienteDoEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const ambienteMatch = envContent.match(/^FOCUS_NFE_AMBIENTE=(.+)$/m);
    if (ambienteMatch) {
      return ambienteMatch[1].trim();
    }
  }
  return process.env.FOCUS_NFE_AMBIENTE || 'homologacao';
}

// Rota de health check
app.get('/health', async (req, res) => {
  const ambiente = lerAmbienteDoEnv();

  // Verificar conexão com banco
  let dbStatus = 'desconectado';
  let dbInfo = {};
  let tabelas = [];

  try {
    const { sql } = require('@vercel/postgres');
    const result = await sql`SELECT NOW() as time, current_database() as db`;
    dbStatus = 'conectado';
    dbInfo = {
      database: result.rows[0]?.db,
      time: result.rows[0]?.time
    };

    // Listar tabelas existentes
    const tabelasResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    tabelas = tabelasResult.rows.map(r => r.table_name);
  } catch (err) {
    dbStatus = 'erro: ' + err.message;
  }

  res.json({
    status: 'ok',
    ambiente: ambiente,
    timestamp: new Date().toISOString(),
    banco: {
      status: dbStatus,
      ...dbInfo,
      tabelas: tabelas,
      variaveis: {
        POSTGRES_URL: process.env.POSTGRES_URL ? '✓ configurado' : '✗ não configurado',
        POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL ? '✓ configurado' : '✗ não configurado'
      }
    }
  });
});

// Rota para executar migrations (protegida) - LOGIN DESABILITADO
app.post('/api/migrate', async (req, res) => { // requireAuth comentado
  try {
    const { migrate } = require('./src/config/database');
    await migrate();
    res.json({
      status: 'ok',
      mensagem: 'Migrations executadas com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'erro',
      mensagem: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota de login - servir página de login - LOGIN DESABILITADO
// app.get('/login', (req, res) => {
//   // Se já estiver autenticado, redirecionar para home
//   if (req.session && req.session.authenticated) {
//     return res.redirect('/');
//   }
//   res.sendFile(path.join(__dirname, 'public', 'login.html'));
// });

// Rota raiz - servir index.html do front-end (protegida) - LOGIN DESABILITADO
app.get('/', (req, res) => { // requireAuth comentado
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Landing e obrigado (páginas estáticas)
app.get('/landing', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});
app.get('/obrigado', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'obrigado.html'));
});

// Admin: login e dashboard (requer autenticação para dashboard)
app.get('/admin/login', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});
app.get('/admin', (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.redirect('/admin/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});
app.get('/admin/', (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.redirect('/admin/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Middleware de erro
app.use((err, req, res, next) => {
  logger.error('Erro no servidor', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.status || 500).json({
    erro: err.message || 'Erro interno do servidor'
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

// Executar migrations na inicialização (apenas em desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  const { migrate } = require('./src/config/database');
  migrate().catch(err => {
    // Não é crítico se não houver banco configurado
    if (!err.message.includes('missing_connection_string')) {
      logger.error('Erro ao executar migrations', { error: err.message });
    }
  });
}

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
  logger.error('Erro não capturado', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
  logger.error('Promise rejeitada não tratada', { error: reason });
});

// Na Vercel (serverless), não usar app.listen - apenas exportar o app
if (!isVercel) {
  try {
    app.listen(PORT, () => {
      logger.info(`Servidor iniciado na porta ${PORT}`, {
        service: 'server',
        action: 'startup',
        port: PORT,
        ambiente: process.env.FOCUS_NFE_AMBIENTE || 'homologacao'
      });

      console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📊 Ambiente: ${process.env.FOCUS_NFE_AMBIENTE || 'homologacao'}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      console.log(`📡 Webhook WooCommerce: http://localhost:${PORT}/api/webhook/woocommerce`);
      console.log(`🔔 Webhook Focus NFe: http://localhost:${PORT}/api/webhook/focus-nfe`);
      console.log(`🧾 API NFSe: http://localhost:${PORT}/api/nfse`);
      console.log(`💻 Front-end: http://localhost:${PORT}\n`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    logger.error('Erro ao iniciar servidor', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

module.exports = app;

