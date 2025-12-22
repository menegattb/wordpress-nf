const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Detectar se está rodando na Vercel (serverless)
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

// Tentar importar database, mas permitir falha (para scripts isolados)
let salvarLog = null;
try {
  // Usar require dinâmico dentro de função ou verificar se módulo existe
  const db = require('../config/database');
  if (db && typeof db.salvarLog === 'function') {
    salvarLog = db.salvarLog;
  } else {
    console.warn('⚠️ Logger: db.salvarLog não é uma função. Logs não serão salvos no banco.');
  }
} catch (error) {
  console.warn('⚠️ Logger: Erro ao importar database. Logs não serão salvos no banco.', error.message);
}

// Formato customizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Formato para console (mais legível)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service, action, pedido_id, referencia, ...meta }) => {
    let log = `${timestamp} [${level}]`;

    if (service) log += ` [${service}]`;
    if (action) log += ` [${action}]`;
    if (pedido_id) log += ` [Pedido: ${pedido_id}]`;
    if (referencia) log += ` [Ref: ${referencia}]`;

    log += ` - ${message}`;

    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    return log;
  })
);

// Configuração de transports
const transports = [
  // Console - sempre usar
  new winston.transports.Console({
    format: consoleFormat,
    // Alterado para 'debug' no ambiente local para mostrar todos os passos da emissão como solicitado
    level: process.env.LOG_LEVEL || (isVercel ? 'info' : 'debug')
  })
];

// Adicionar file transports apenas se NÃO estiver na Vercel
if (!isVercel) {
  const DailyRotateFile = require('winston-daily-rotate-file');
  const logsDir = path.join(process.cwd(), 'logs');

  // Criar diretório de logs se não existir
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Arquivo de erro
  transports.push(new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '14d'
  }));

  // Arquivo geral
  transports.push(new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '14d'
  }));
}

// Configuração do logger
const loggerConfig = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  transports
};

// Adicionar exception/rejection handlers apenas se NÃO estiver na Vercel
if (!isVercel) {
  const logsDir = path.join(process.cwd(), 'logs');
  loggerConfig.exceptionHandlers = [
    new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') })
  ];
  loggerConfig.rejectionHandlers = [
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') })
  ];
}

// Criar logger
const logger = winston.createLogger(loggerConfig);

/**
 * Log helper que também salva no banco de dados
 */
async function logToDatabase(level, message, meta = {}) {
  const logEntry = {
    level: level.toUpperCase(),
    service: meta.service,
    action: meta.action,
    pedido_id: meta.pedido_id,
    referencia: meta.referencia,
    message,
    data: meta.data || meta
  };

  // Salva no banco de forma assíncrona (não bloqueia)
  if (salvarLog) {
    salvarLog(logEntry).catch(err => {
      // Se falhar ao salvar no banco, apenas loga no arquivo
      // Evitar recursão infinita - não usar logger.error aqui
      console.error('Erro ao salvar log no banco:', err.message);
    });
  }
}

/**
 * Logger com métodos customizados
 */
const customLogger = {
  /**
   * Log de informação
   */
  info: (message, meta = {}) => {
    logger.info(message, meta);
    logToDatabase('info', message, meta);
  },

  /**
   * Log de aviso
   */
  warn: (message, meta = {}) => {
    logger.warn(message, meta);
    logToDatabase('warn', message, meta);
  },

  /**
   * Log de erro
   */
  error: (message, meta = {}) => {
    logger.error(message, meta);
    logToDatabase('error', message, meta);
  },

  /**
   * Log de debug
   */
  debug: (message, meta = {}) => {
    logger.debug(message, meta);
    if (process.env.NODE_ENV !== 'production') {
      logToDatabase('debug', message, meta);
    }
  },

  /**
   * Log específico para webhook
   */
  webhook: (message, meta = {}) => {
    customLogger.info(message, {
      service: 'webhook',
      action: 'recebido',
      ...meta
    });
  },

  /**
   * Log específico para Focus NFe
   */
  focusNFe: (action, message, meta = {}) => {
    customLogger.info(message, {
      service: 'focusNFe',
      action,
      ...meta
    });
  },

  /**
   * Log específico para validação
   */
  validation: (message, meta = {}) => {
    customLogger.info(message, {
      service: 'validator',
      action: 'validacao',
      ...meta
    });
  },

  /**
   * Log específico para mapeamento
   */
  mapping: (message, meta = {}) => {
    customLogger.info(message, {
      service: 'mapeador',
      action: 'mapeamento',
      ...meta
    });
  },

  /**
   * Log específico para CEP service
   */
  cep: (message, meta = {}) => {
    customLogger.info(message, {
      service: 'cepService',
      ...meta
    });
  }
};

module.exports = customLogger;

