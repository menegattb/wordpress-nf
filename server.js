require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const logger = require('./src/services/logger');

// Importar rotas
const webhookRoutes = require('./src/routes/webhook');
const nfseRoutes = require('./src/routes/nfse');
const pedidoRoutes = require('./src/routes/pedidos');
const woocommerceRoutes = require('./src/routes/woocommerce');
const configRoutes = require('./src/routes/config');

const app = express();

// Executar migrations automaticamente no startup (apenas se houver banco)
(async () => {
  try {
    const { migrate } = require('./src/config/database');
    await migrate();
  } catch (error) {
    console.log('⚠ Erro ao executar migrations no startup:', error.message);
  }
})();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

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

// Rotas
app.use('/api/webhook', webhookRoutes);
app.use('/api/nfse', nfseRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/woocommerce', woocommerceRoutes);
app.use('/api/config', configRoutes);

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
  
  try {
    const { sql } = require('@vercel/postgres');
    const result = await sql`SELECT NOW() as time, current_database() as db`;
    dbStatus = 'conectado';
    dbInfo = {
      database: result.rows[0]?.db,
      time: result.rows[0]?.time
    };
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
      variaveis: {
        POSTGRES_URL: process.env.POSTGRES_URL ? '✓ configurado' : '✗ não configurado',
        POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL ? '✓ configurado' : '✗ não configurado'
      }
    }
  });
});

// Rota para executar migrations (protegida)
app.post('/api/migrate', async (req, res) => {
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

// Rota raiz - servir index.html do front-end
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

module.exports = app;

