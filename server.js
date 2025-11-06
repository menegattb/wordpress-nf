require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./src/services/logger');

// Importar rotas
const webhookRoutes = require('./src/routes/webhook');
const nfseRoutes = require('./src/routes/nfse');
const pedidoRoutes = require('./src/routes/pedidos');
const woocommerceRoutes = require('./src/routes/woocommerce');
const configRoutes = require('./src/routes/config');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de logging
app.use((req, res, next) => {
  // Log no console para debug
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    ip: req.ip,
    query: req.query,
    body: req.method === 'POST' ? JSON.stringify(req.body).substring(0, 200) : undefined
  });
  
  logger.info(`${req.method} ${req.path}`, {
    service: 'server',
    action: 'request',
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  next();
});

// Rotas
app.use('/api/webhook', webhookRoutes);
app.use('/api/nfse', nfseRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/woocommerce', woocommerceRoutes);
app.use('/api/config', configRoutes);

// Rota de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    ambiente: process.env.FOCUS_NFE_AMBIENTE || 'homologacao',
    timestamp: new Date().toISOString()
  });
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
    console.log(`📡 Webhook: http://localhost:${PORT}/api/webhook/woocommerce`);
    console.log(`🧾 API NFSe: http://localhost:${PORT}/api/nfse`);
    console.log(`💻 Front-end: http://localhost:${PORT}\n`);
  });
} catch (error) {
  console.error('❌ Erro ao iniciar servidor:', error);
  logger.error('Erro ao iniciar servidor', { error: error.message, stack: error.stack });
  process.exit(1);
}

module.exports = app;

