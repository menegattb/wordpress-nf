const fs = require('fs');
const path = require('path');

// Caminho do arquivo de persistência
const STORAGE_FILE = path.join(__dirname, '../../data/storage.json');

// Verificar se há conexão com banco de dados
let sql = null;
let hasDatabase = false;
let memoryStorage = {
  pedidos: [],
  nfse: [],
  nfe: [],
  logs: []
};

/**
 * Carrega dados do arquivo de persistência
 */
function loadStorageFromFile() {
  try {
    // Criar diretório se não existir
    const dataDir = path.dirname(STORAGE_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      memoryStorage = {
        pedidos: parsed.pedidos || [],
        nfse: parsed.nfse || [],
        nfe: parsed.nfe || [],
        logs: parsed.logs || []
      };
      console.log('✓ Dados carregados do arquivo de persistência');
    }
  } catch (error) {
    console.log('⚠ Erro ao carregar dados do arquivo, usando armazenamento vazio:', error.message);
    memoryStorage = {
      pedidos: [],
      nfse: [],
      nfe: [],
      logs: []
    };
  }
}

/**
 * Salva dados no arquivo de persistência
 */
function saveStorageToFile() {
  try {
    // Criar diretório se não existir
    const dataDir = path.dirname(STORAGE_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(STORAGE_FILE, JSON.stringify(memoryStorage, null, 2), 'utf8');
  } catch (error) {
    console.error('⚠ Erro ao salvar dados no arquivo:', error.message);
  }
}

// Criar template tag sql compatível com @vercel/postgres usando pg Pool
function createSqlTag(pool) {
  const tag = function(strings, ...values) {
    const text = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''), '');
    return pool.query(text, values);
  };
  tag.query = (text, params) => pool.query(text, params || []);
  return tag;
}

// Tentar conectar ao banco
try {
  const connString = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (connString) {
    const { Pool } = require('pg');
    const finalConnString = connString.includes('sslmode=require') && !connString.includes('uselibpqcompat')
      ? connString + '&uselibpqcompat=true'
      : connString;
    const pool = new Pool({
      connectionString: finalConnString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000
    });
    sql = createSqlTag(pool);
    hasDatabase = true;
    console.log('✓ Banco de dados Postgres configurado');
  } else {
    console.log('⚠ Banco de dados não configurado - usando armazenamento em memória');
    loadStorageFromFile();
  }
} catch (error) {
  console.log('⚠ Erro ao carregar pg - usando armazenamento em memória:', error.message);
  hasDatabase = false;
  // Carregar dados do arquivo se não houver banco
  loadStorageFromFile();
}

/**
 * Executa uma query SQL (se houver banco) ou retorna vazio
 */
async function query(text, params = []) {
  if (!hasDatabase || !sql) {
    return { rows: [] };
  }

  try {
    const result = await sql.query(text, params);
    return result;
  } catch (error) {
    // Não usar logger aqui para evitar dependência circular
    console.error('Erro ao executar query:', error.message);
    throw error;
  }
}

/**
 * Executa migrations - SQL inline para funcionar na Vercel
 */
async function migrate() {
  if (!hasDatabase || !sql) {
    console.log('⚠ Banco de dados não configurado - migrations ignoradas (usando memória)');
    return;
  }

  try {
    console.log('Iniciando migrations...');

    // Criar tabela pedidos
    console.log('Criando tabela pedidos...');
    await sql`
      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        pedido_id TEXT UNIQUE NOT NULL,
        origem TEXT NOT NULL DEFAULT 'woocommerce',
        dados_pedido JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Criar tabela nfse
    console.log('Criando tabela nfse...');
    await sql`
      CREATE TABLE IF NOT EXISTS nfse (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER,
        pedido_wc_id TEXT,
        referencia TEXT NOT NULL UNIQUE,
        chave_nfse TEXT,
        status_focus TEXT,
        status_sefaz TEXT,
        mensagem_sefaz TEXT,
        caminho_xml TEXT,
        caminho_pdf TEXT,
        dados_completos JSONB,
        ambiente TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Criar tabela nfe
    console.log('Criando tabela nfe...');
    await sql`
      CREATE TABLE IF NOT EXISTS nfe (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER,
        pedido_wc_id TEXT,
        referencia TEXT NOT NULL UNIQUE,
        chave_nfe TEXT,
        status_focus TEXT,
        status_sefaz TEXT,
        mensagem_sefaz TEXT,
        caminho_xml_nota_fiscal TEXT,
        caminho_danfe TEXT,
        dados_completos JSONB,
        ambiente TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Criar tabela logs
    console.log('Criando tabela logs...');
    await sql`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        level TEXT NOT NULL,
        service TEXT,
        action TEXT,
        pedido_id TEXT,
        referencia TEXT,
        message TEXT NOT NULL,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Criar tabela configuracoes
    console.log('Criando tabela configuracoes...');
    await sql`
      CREATE TABLE IF NOT EXISTS configuracoes (
        chave TEXT PRIMARY KEY,
        valor TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Criar índices
    console.log('Criando índices...');
    const indices = [
      'CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status)',
      'CREATE INDEX IF NOT EXISTS idx_pedidos_pedido_id ON pedidos(pedido_id)',
      'CREATE INDEX IF NOT EXISTS idx_nfse_pedido_id ON nfse(pedido_id)',
      'CREATE INDEX IF NOT EXISTS idx_nfse_referencia ON nfse(referencia)',
      'CREATE INDEX IF NOT EXISTS idx_nfse_status_focus ON nfse(status_focus)',
      'CREATE INDEX IF NOT EXISTS idx_nfe_pedido_id ON nfe(pedido_id)',
      'CREATE INDEX IF NOT EXISTS idx_nfe_referencia ON nfe(referencia)',
      'CREATE INDEX IF NOT EXISTS idx_nfe_status_focus ON nfe(status_focus)',
      'CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)',
      'CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_logs_pedido_id ON logs(pedido_id)'
    ];

    for (const idx of indices) {
      try {
        await sql.query(idx);
      } catch (e) {
        // Ignorar erros de índice já existente
      }
    }

    // Migration 004: Suporte Multi-Tenant
    console.log('Executando migration 004 (multi-tenant)...');
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS tenants (
          id SERIAL PRIMARY KEY,
          token_hash TEXT UNIQUE NOT NULL,
          nome TEXT,
          site_url TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          ativo BOOLEAN DEFAULT true
        )
      `;

      const alterStatements = [
        'ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)',
        'ALTER TABLE nfse ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)',
        'ALTER TABLE nfe ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)',
        'ALTER TABLE logs ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)'
      ];
      for (const stmt of alterStatements) {
        try {
          await sql.query(stmt);
        } catch (e) {
          if (!e.message?.includes('already exists')) throw e;
        }
      }

      await sql`
        CREATE TABLE IF NOT EXISTS tenant_config (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          chave TEXT NOT NULL,
          valor TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(tenant_id, chave)
        )
      `;

      const tenantIndices = [
        'CREATE INDEX IF NOT EXISTS idx_tenant_config_tenant ON tenant_config(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_pedidos_tenant ON pedidos(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_nfse_tenant ON nfse(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_nfe_tenant ON nfe(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_logs_tenant ON logs(tenant_id)'
      ];
      for (const idx of tenantIndices) {
        try {
          await sql.query(idx);
        } catch (e) {
          // Ignorar se já existir
        }
      }
      console.log('✓ Migration 004 (multi-tenant) executada');
    } catch (e) {
      console.warn('Aviso na migration 004:', e.message);
    }

    // Migration 005: Assinaturas e uso mensal (SaaS)
    console.log('Executando migration 005 (subscriptions)...');
    try {
      await sql.query('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email TEXT');
      await sql.query('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT');

      await sql`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          stripe_customer_id TEXT,
          stripe_subscription_id TEXT UNIQUE,
          plano TEXT NOT NULL DEFAULT 'basico',
          status TEXT NOT NULL DEFAULT 'ativa',
          notas_incluidas INTEGER NOT NULL DEFAULT 100,
          periodo_inicio TIMESTAMPTZ NOT NULL,
          periodo_fim TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS usage_monthly (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          ano INTEGER NOT NULL,
          mes INTEGER NOT NULL,
          notas_emitidas INTEGER NOT NULL DEFAULT 0,
          notas_extras_cobradas INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(tenant_id, ano, mes)
        )
      `;

      const subIndices = [
        'CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id)',
        'CREATE INDEX IF NOT EXISTS idx_usage_monthly_tenant ON usage_monthly(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_usage_monthly_periodo ON usage_monthly(tenant_id, ano, mes)'
      ];
      for (const idx of subIndices) {
        try {
          await sql.query(idx);
        } catch (e) {
          // Ignorar se já existir
        }
      }
      console.log('✓ Migration 005 (subscriptions) executada');
    } catch (e) {
      console.warn('Aviso na migration 005:', e.message);
    }

    // Migration 006: webhook_id para tenants
    console.log('Executando migration 006 (webhook_id)...');
    try {
      await sql.query('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS webhook_id TEXT UNIQUE');
      console.log('✓ Migration 006 (webhook_id) executada');
    } catch (e) {
      console.warn('Aviso na migration 006:', e.message);
    }

    console.log('✓ Todas as migrations executadas com sucesso');
  } catch (error) {
    console.error('Erro ao executar migrations:', error.message);
    throw error;
  }
}

/**
 * Salva um pedido
 * @param {Object} pedido - { pedido_id, origem, dados_pedido, status, tenant_id? }
 */
async function salvarPedido(pedido) {
  const { pedido_id, origem, dados_pedido, status, tenant_id } = pedido;

  if (hasDatabase) {
    const result = await query(
      `INSERT INTO pedidos (pedido_id, origem, dados_pedido, status, tenant_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (pedido_id) 
       DO UPDATE SET
         dados_pedido = $3,
         status = CASE
           -- Mantém status da nota quando o upsert vem só para sincronizar status do Woo
           WHEN pedidos.status IN ('pendente', 'processando', 'emitida', 'erro', 'cancelada')
            AND $4 IN ('pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed')
           THEN pedidos.status
           ELSE $4
         END,
         tenant_id = COALESCE($5, pedidos.tenant_id),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [pedido_id, origem || 'woocommerce', JSON.stringify(dados_pedido), status || 'pendente', tenant_id || null]
    );

    return result.rows[0];
  } else {
    // Armazenamento em memória
    const existingIndex = memoryStorage.pedidos.findIndex(p => p.pedido_id === pedido_id);
    const now = new Date().toISOString();

    const pedidoData = {
      id: existingIndex >= 0 ? memoryStorage.pedidos[existingIndex].id : memoryStorage.pedidos.length + 1,
      pedido_id,
      origem: origem || 'woocommerce',
      dados_pedido,
      status: status || 'pendente',
      tenant_id: tenant_id || null,
      created_at: existingIndex >= 0 ? memoryStorage.pedidos[existingIndex].created_at : now,
      updated_at: now
    };

    if (existingIndex >= 0) {
      memoryStorage.pedidos[existingIndex] = pedidoData;
    } else {
      memoryStorage.pedidos.push(pedidoData);
    }

    // Salvar no arquivo
    saveStorageToFile();

    return pedidoData;
  }
}

/**
 * Busca pedido por ID
 */
async function buscarPedidoPorId(id) {
  if (hasDatabase) {
    const result = await query(
      'SELECT * FROM pedidos WHERE id = $1',
      [id]
    );

    return result.rows[0];
  } else {
    return memoryStorage.pedidos.find(p => p.id === parseInt(id)) || null;
  }
}

/**
 * Busca pedido por pedido_id
 * @param {string} pedido_id - ID do pedido WooCommerce
 * @param {number|null} tenant_id - Opcional: filtra por tenant
 */
async function buscarPedidoPorPedidoId(pedido_id, tenant_id = null) {
  if (hasDatabase) {
    let sqlText = 'SELECT * FROM pedidos WHERE pedido_id = $1';
    const params = [pedido_id];
    if (tenant_id != null) {
      sqlText += ' AND (tenant_id = $2 OR tenant_id IS NULL)';
      params.push(tenant_id);
    }
    const result = await query(sqlText, params);
    return result.rows[0];
  } else {
    return memoryStorage.pedidos.find(p => p.pedido_id === pedido_id) || null;
  }
}

/**
 * Atualiza status do pedido
 */
async function atualizarPedido(id, atualizacoes) {
  if (hasDatabase) {
    const campos = [];
    const valores = [];
    let paramCount = 1;

    Object.keys(atualizacoes).forEach(key => {
      if (atualizacoes[key] !== undefined) {
        campos.push(`${key} = $${paramCount}`);
        if (typeof atualizacoes[key] === 'object') {
          valores.push(JSON.stringify(atualizacoes[key]));
        } else {
          valores.push(atualizacoes[key]);
        }
        paramCount++;
      }
    });

    if (campos.length === 0) {
      return null;
    }

    valores.push(id);

    const result = await query(
      `UPDATE pedidos SET ${campos.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      valores
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Garantir que dados_pedido seja parseado se for string JSON
    const pedidoAtualizado = result.rows[0];
    if (pedidoAtualizado.dados_pedido && typeof pedidoAtualizado.dados_pedido === 'string') {
      try {
        pedidoAtualizado.dados_pedido = JSON.parse(pedidoAtualizado.dados_pedido);
      } catch (e) {
        // Se não conseguir parsear, manter como string
      }
    }

    return pedidoAtualizado;
  } else {
    const index = memoryStorage.pedidos.findIndex(p => p.id === parseInt(id));
    if (index >= 0) {
      const pedidoExistente = memoryStorage.pedidos[index];
      
      // Fazer merge correto dos dados_pedido se for objeto
      if (atualizacoes.dados_pedido && pedidoExistente.dados_pedido) {
        if (typeof pedidoExistente.dados_pedido === 'string') {
          try {
            pedidoExistente.dados_pedido = JSON.parse(pedidoExistente.dados_pedido);
          } catch (e) {
            pedidoExistente.dados_pedido = {};
          }
        }
        atualizacoes.dados_pedido = {
          ...pedidoExistente.dados_pedido,
          ...atualizacoes.dados_pedido
        };
      }
      
      memoryStorage.pedidos[index] = {
        ...pedidoExistente,
        ...atualizacoes,
        updated_at: new Date().toISOString()
      };
      // Salvar no arquivo
      saveStorageToFile();
      return memoryStorage.pedidos[index];
    }
    return null;
  }
}

/**
 * Lista pedidos com filtros
 * @param {Object} filtros - { limite, offset, status, origem, tenant_id? }
 */
async function listarPedidos(filtros = {}) {
  const { limite = 1000, offset = 0, status, origem, tenant_id } = filtros;

  if (hasDatabase) {
    let whereClause = [];
    let params = [];
    let paramCount = 1;

    if (tenant_id != null) {
      whereClause.push(`(tenant_id = $${paramCount} OR tenant_id IS NULL)`);
      params.push(tenant_id);
      paramCount++;
    }

    if (status) {
      whereClause.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (origem) {
      whereClause.push(`origem = $${paramCount}`);
      params.push(origem);
      paramCount++;
    }

    const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    params.push(limite, offset);

    const result = await query(
      `SELECT * FROM pedidos ${where} ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    return result.rows;
  } else {
    // Armazenamento em memória
    let pedidos = [...memoryStorage.pedidos];

    if (tenant_id != null) {
      pedidos = pedidos.filter(p => p.tenant_id == null || p.tenant_id === tenant_id);
    }

    if (status) {
      pedidos = pedidos.filter(p => p.status === status);
    }

    if (origem) {
      pedidos = pedidos.filter(p => p.origem === origem);
    }

    pedidos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return pedidos.slice(offset, offset + limite);
  }
}

/**
 * Salva uma NFSe
 * @param {Object} nfse - Inclui tenant_id opcional
 */
async function salvarNFSe(nfse) {
  const {
    pedido_id,
    referencia,
    chave_nfse,
    status_focus,
    status_sefaz,
    mensagem_sefaz,
    caminho_xml,
    caminho_pdf,
    dados_completos,
    ambiente,
    tenant_id
  } = nfse;

  if (hasDatabase) {
    try {
      const dadosCompletosJson = dados_completos ? JSON.stringify(dados_completos) : null;

      const result = await query(
        `INSERT INTO nfse (pedido_id, referencia, chave_nfse, status_focus, status_sefaz, mensagem_sefaz, caminho_xml, caminho_pdf, dados_completos, ambiente, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (referencia) DO UPDATE SET
           chave_nfse = $3,
           status_focus = $4,
           status_sefaz = $5,
           mensagem_sefaz = $6,
           caminho_xml = $7,
           caminho_pdf = $8,
           dados_completos = $9,
           ambiente = $10,
           tenant_id = COALESCE($11, nfse.tenant_id),
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          pedido_id,
          referencia,
          chave_nfse,
          status_focus,
          status_sefaz,
          mensagem_sefaz,
          caminho_xml,
          caminho_pdf,
          dadosCompletosJson,
          ambiente || null,
          tenant_id || null
        ]
      );

      return result.rows[0];
    } catch (error) {
      // Se a tabela não existir, tentar criar executando migrations
      if (error.message && error.message.includes('does not exist')) {
        console.log('⚠ Tabela nfse não encontrada, executando migrations...');
        try {
          await migrate();
          // Tentar novamente após migrations
          const result = await query(
            `INSERT INTO nfse (pedido_id, referencia, chave_nfse, status_focus, status_sefaz, mensagem_sefaz, caminho_xml, caminho_pdf, dados_completos, ambiente, tenant_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (referencia) DO UPDATE SET
               chave_nfse = $3,
               status_focus = $4,
               status_sefaz = $5,
               mensagem_sefaz = $6,
               caminho_xml = $7,
               caminho_pdf = $8,
               dados_completos = $9,
               ambiente = $10,
               tenant_id = COALESCE($11, nfse.tenant_id),
               updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [
              pedido_id,
              referencia,
              chave_nfse,
              status_focus,
              status_sefaz,
              mensagem_sefaz,
              caminho_xml,
              caminho_pdf,
              dados_completos ? JSON.stringify(dados_completos) : null,
              ambiente || null,
              tenant_id || null
            ]
          );
          return result.rows[0];
        } catch (retryError) {
          console.error('Erro ao executar migrations e salvar NFSe:', retryError.message);
          throw retryError;
        }
      }
      throw error;
    }
  } else {
    // Armazenamento em memória
    const existingIndex = memoryStorage.nfse.findIndex(n => n.referencia === referencia);
    const now = new Date().toISOString();

    const nfseData = {
      id: existingIndex >= 0 ? memoryStorage.nfse[existingIndex].id : memoryStorage.nfse.length + 1,
      pedido_id,
      referencia,
      chave_nfse,
      status_focus,
      status_sefaz,
      mensagem_sefaz,
      caminho_xml,
      caminho_pdf,
      dados_completos,
      ambiente: ambiente || null,
      tenant_id: tenant_id || null,
      created_at: existingIndex >= 0 ? memoryStorage.nfse[existingIndex].created_at : now,
      updated_at: now
    };

    if (existingIndex >= 0) {
      memoryStorage.nfse[existingIndex] = nfseData;
    } else {
      memoryStorage.nfse.push(nfseData);
    }

    // Salvar no arquivo
    saveStorageToFile();

    return nfseData;
  }
}

/**
 * Busca NFSe por referência
 */
async function buscarNFSePorReferencia(referencia) {
  if (hasDatabase) {
    const result = await query(
      'SELECT * FROM nfse WHERE referencia = $1',
      [referencia]
    );

    return result.rows[0];
  } else {
    return memoryStorage.nfse.find(n => n.referencia === referencia) || null;
  }
}

/**
 * Lista NFSe com filtros
 */
async function listarNFSe(filtros = {}) {
  let { limite = 50, offset = 0, status_focus, pedido_id, data_inicio, data_fim, ambiente, chave, tenant_id } = filtros;

  // Validações
  limite = Math.min(Math.max(parseInt(limite) || 50, 1), 200); // Entre 1 e 200
  offset = Math.max(parseInt(offset) || 0, 0); // Não negativo

  // Validar formato de datas (YYYY-MM-DD)
  if (data_inicio && !/^\d{4}-\d{2}-\d{2}$/.test(data_inicio)) {
    throw new Error('Formato de data_inicio inválido. Use YYYY-MM-DD');
  }
  if (data_fim && !/^\d{4}-\d{2}-\d{2}$/.test(data_fim)) {
    throw new Error('Formato de data_fim inválido. Use YYYY-MM-DD');
  }

  // Validar ambiente
  if (ambiente && !['homologacao', 'producao'].includes(ambiente)) {
    throw new Error('Ambiente inválido. Deve ser "homologacao" ou "producao"');
  }

  if (hasDatabase) {
    let whereClause = [];
    let params = [];
    let paramCount = 1;

    if (status_focus) {
      whereClause.push(`n.status_focus = $${paramCount}`);
      params.push(status_focus);
      paramCount++;
    }

    if (pedido_id) {
      whereClause.push(`n.pedido_id = $${paramCount}`);
      params.push(pedido_id);
      paramCount++;
    }

    if (ambiente) {
      whereClause.push(`n.ambiente = $${paramCount}`);
      params.push(ambiente);
      paramCount++;
    }

    if (data_inicio) {
      whereClause.push(`DATE(n.created_at) >= $${paramCount}`);
      params.push(data_inicio);
      paramCount++;
    }

    if (data_fim) {
      whereClause.push(`DATE(n.created_at) <= $${paramCount}`);
      params.push(data_fim);
      paramCount++;
    }

    if (chave) {
      whereClause.push(`(n.chave_nfse LIKE $${paramCount} OR n.dados_completos->>'chave_nfse' LIKE $${paramCount + 1})`);
      params.push(`%${chave}%`, `%${chave}%`);
      paramCount += 2;
    }

    const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    // Query para contar total (usando LEFT JOIN para não perder NFSe sem pedido)
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM nfse n
       LEFT JOIN pedidos p ON n.pedido_id = p.id
       ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Query para buscar dados (usando LEFT JOIN para não perder NFSe sem pedido)
    const paramsQuery = [...params];
    paramsQuery.push(limite, offset);
    const result = await query(
      `SELECT n.*, p.pedido_id as pedido_externo, p.dados_pedido
       FROM nfse n
       LEFT JOIN pedidos p ON n.pedido_id = p.id

       ${where}
       ORDER BY n.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      paramsQuery
    );

    // Parsear dados_completos se for string JSON
    // No Vercel Postgres, JSONB pode vir como objeto ou string dependendo da versão
    const dadosParseados = result.rows.map((row, index) => {
      if (row.dados_completos) {
        const tipoOriginal = typeof row.dados_completos;

        // Se for string, tentar parsear
        if (tipoOriginal === 'string') {
          try {
            row.dados_completos = JSON.parse(row.dados_completos);
          } catch (e) {
            // Se não conseguir parsear, manter como está
            console.warn(`Erro ao parsear dados_completos (NFSe) - linha ${index}:`, e.message);
          }
        }
        // Se já for objeto, manter como está (Vercel Postgres retorna JSONB como objeto)

        // Log para debug (apenas primeira linha e se dados_completos estiver vazio)
        if (index === 0 || !row.dados_completos || (typeof row.dados_completos === 'object' && Object.keys(row.dados_completos).length === 0)) {
          console.log(`🔍 [LISTAR NFSe] Nota ${index + 1}:`, {
            referencia: row.referencia,
            ambiente: row.ambiente,
            tipo_dados_completos_original: tipoOriginal,
            tipo_apos_processamento: typeof row.dados_completos,
            tem_dados_completos: !!row.dados_completos,
            chaves_disponiveis: row.dados_completos && typeof row.dados_completos === 'object' ? Object.keys(row.dados_completos).slice(0, 10) : [],
            tem_tomador: row.dados_completos?.tomador ? true : false,
            tem_servico: row.dados_completos?.servico ? true : false,
            valor_servicos: row.dados_completos?.servico?.valor_servicos,
            tomador_razao_social: row.dados_completos?.tomador?.razao_social
          });
        }
      } else {
        // Log se dados_completos estiver vazio
        console.warn(`⚠️ [LISTAR NFSe] Nota ${index + 1} (${row.referencia}) - dados_completos está vazio/null`);
      }
      return row;
    });

    return {
      dados: dadosParseados,
      total: total,
      limite: limite,
      offset: offset
    };
  } else {
    // Armazenamento em memória
    let nfse = [...memoryStorage.nfse];

    if (tenant_id != null) {
      nfse = nfse.filter(n => n.tenant_id == null || n.tenant_id === tenant_id);
    }

    if (status_focus) {
      nfse = nfse.filter(n => n.status_focus === status_focus);
    }

    if (pedido_id) {
      nfse = nfse.filter(n => n.pedido_id === parseInt(pedido_id));
    }

    if (ambiente) {
      nfse = nfse.filter(n => n.ambiente === ambiente);
    }

    if (data_inicio) {
      const dataInicio = new Date(data_inicio);
      nfse = nfse.filter(n => {
        const dataNF = new Date(n.created_at);
        return dataNF >= dataInicio;
      });
    }

    if (data_fim) {
      const dataFim = new Date(data_fim);
      dataFim.setHours(23, 59, 59, 999); // Incluir todo o dia
      nfse = nfse.filter(n => {
        const dataNF = new Date(n.created_at);
        return dataNF <= dataFim;
      });
    }

    if (chave) {
      nfse = nfse.filter(n => {
        const chaveNota = n.chave_nfse || (n.dados_completos && n.dados_completos.chave_nfse);
        return chaveNota && chaveNota.includes(chave);
      });
    }

    nfse.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = nfse.length;
    const dados = nfse.slice(offset, offset + limite).map(n => {
      const pedido = memoryStorage.pedidos.find(p => p.id === n.pedido_id);
      return {
        ...n,
        pedido_externo: pedido ? pedido.pedido_id : null
      };
    });

    return {
      dados: dados,
      total: total,
      limite: limite,
      offset: offset
    };
  }
}

/**
 * Atualiza NFSe
 */
async function atualizarNFSe(referencia, atualizacoes) {
  if (hasDatabase) {
    const campos = [];
    const valores = [];
    let paramCount = 1;

    Object.keys(atualizacoes).forEach(key => {
      if (atualizacoes[key] !== undefined) {
        campos.push(`${key} = $${paramCount}`);
        if (typeof atualizacoes[key] === 'object') {
          valores.push(JSON.stringify(atualizacoes[key]));
        } else {
          valores.push(atualizacoes[key]);
        }
        paramCount++;
      }
    });

    if (campos.length === 0) {
      return null;
    }

    valores.push(referencia);

    const result = await query(
      `UPDATE nfse SET ${campos.join(', ')} WHERE referencia = $${paramCount} RETURNING *`,
      valores
    );

    return result.rows[0];
  } else {
    const index = memoryStorage.nfse.findIndex(n => n.referencia === referencia);
    if (index >= 0) {
      memoryStorage.nfse[index] = {
        ...memoryStorage.nfse[index],
        ...atualizacoes,
        updated_at: new Date().toISOString()
      };
      // Salvar no arquivo
      // saveStorageToFile(); // Desabilitado para evitar restart do nodemon ao atualizar status
      return memoryStorage.nfse[index];
    }
    return null;
  }
}

/**
 * Salva um log
 */
async function salvarLog(log) {
  const { level, service, action, pedido_id, referencia, message, data } = log;

  try {
    if (hasDatabase && sql) {
      await query(
        `INSERT INTO logs (level, service, action, pedido_id, referencia, message, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          level,
          service,
          action,
          pedido_id,
          referencia,
          message,
          data ? JSON.stringify(data) : null
        ]
      );
    } else {
      // Armazenamento em memória (limitado a 1000 logs)
      memoryStorage.logs.push({
        ...log,
        id: memoryStorage.logs.length + 1,
        created_at: new Date().toISOString()
      });

      // Manter apenas os últimos 1000 logs
      if (memoryStorage.logs.length > 1000) {
        memoryStorage.logs.shift();
      }
    }
  } catch (error) {
    // Ignorar erros ao salvar log - não deve quebrar a aplicação
    // Não usar logger aqui para evitar recursão infinita
    console.error('Erro ao salvar log (ignorado):', error.message);
  }
}

/**
 * Lista logs
 */
async function listarLogs(filtros = {}) {
  const { limite = 100, offset = 0, level, pedido_id, service, referencia, mes } = filtros;

  if (hasDatabase) {
    let whereClause = [];
    let params = [];
    let paramCount = 1;

    if (level) {
      whereClause.push(`level = $${paramCount}`);
      params.push(level);
      paramCount++;
    }

    if (pedido_id) {
      whereClause.push(`pedido_id = $${paramCount}`);
      params.push(pedido_id);
      paramCount++;
    }

    if (service) {
      whereClause.push(`service = $${paramCount}`);
      params.push(service);
      paramCount++;
    }

    if (referencia) {
      whereClause.push(`(referencia = $${paramCount} OR message ILIKE $${paramCount + 1} OR data::text ILIKE $${paramCount + 1})`);
      params.push(referencia, `%${referencia}%`);
      paramCount += 2;
    }

    if (mes) {
      const [ano, mesNum] = mes.split('-');
      const dataInicio = new Date(Date.UTC(parseInt(ano), parseInt(mesNum) - 1, 1, 0, 0, 0, 0));
      const dataFim = new Date(Date.UTC(parseInt(ano), parseInt(mesNum), 0, 23, 59, 59, 999));
      whereClause.push(`created_at >= $${paramCount} AND created_at <= $${paramCount + 1}`);
      params.push(dataInicio.toISOString(), dataFim.toISOString());
      paramCount += 2;
    }

    const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    params.push(limite, offset);

    const result = await query(
      `SELECT * FROM logs ${where} ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    return result.rows;
  } else {
    let logs = [...memoryStorage.logs];

    if (level) logs = logs.filter(l => l.level === level);
    if (pedido_id) logs = logs.filter(l => l.pedido_id === pedido_id);
    if (service) logs = logs.filter(l => l.service === service);

    if (referencia) {
      logs = logs.filter(l =>
        l.referencia === referencia ||
        (l.message && l.message.includes(referencia)) ||
        (l.data && JSON.stringify(l.data).includes(referencia))
      );
    }

    if (mes) {
      const [ano, mesNum] = mes.split('-');
      const dataInicio = new Date(Date.UTC(parseInt(ano), parseInt(mesNum) - 1, 1, 0, 0, 0, 0));
      const dataFim = new Date(Date.UTC(parseInt(ano), parseInt(mesNum), 0, 23, 59, 59, 999));
      logs = logs.filter(log => {
        if (!log.created_at) return false;
        const dataLog = new Date(log.created_at);
        return dataLog >= dataInicio && dataLog <= dataFim;
      });
    }

    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return logs.slice(offset, offset + limite);
  }
}

/**
 * Salva uma NFe
 * @param {Object} nfe - Inclui tenant_id opcional
 */
async function salvarNFe(nfe) {
  const {
    pedido_id,
    referencia,
    chave_nfe,
    status_focus,
    status_sefaz,
    mensagem_sefaz,
    caminho_xml_nota_fiscal,
    caminho_danfe,
    dados_completos,
    ambiente,
    tenant_id
  } = nfe;

  if (hasDatabase) {
    try {
      const result = await query(
        `INSERT INTO nfe (pedido_id, referencia, chave_nfe, status_focus, status_sefaz, mensagem_sefaz, caminho_xml_nota_fiscal, caminho_danfe, dados_completos, ambiente, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (referencia) DO UPDATE SET
           chave_nfe = $3,
           status_focus = $4,
           status_sefaz = $5,
           mensagem_sefaz = $6,
           caminho_xml_nota_fiscal = $7,
           caminho_danfe = $8,
           dados_completos = $9,
           ambiente = $10,
           tenant_id = COALESCE($11, nfe.tenant_id),
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          pedido_id,
          referencia,
          chave_nfe,
          status_focus,
          status_sefaz,
          mensagem_sefaz,
          caminho_xml_nota_fiscal,
          caminho_danfe,
          dados_completos ? JSON.stringify(dados_completos) : null,
          ambiente || null,
          tenant_id || null
        ]
      );

      return result.rows[0];
    } catch (error) {
      // Se a tabela não existir, tentar criar executando migrations
      if (error.message && error.message.includes('does not exist')) {
        console.log('⚠ Tabela nfe não encontrada, executando migrations...');
        try {
          await migrate();
          // Tentar novamente após migrations
          const result = await query(
            `INSERT INTO nfe (pedido_id, referencia, chave_nfe, status_focus, status_sefaz, mensagem_sefaz, caminho_xml_nota_fiscal, caminho_danfe, dados_completos, ambiente, tenant_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (referencia) DO UPDATE SET
               chave_nfe = $3,
               status_focus = $4,
               status_sefaz = $5,
               mensagem_sefaz = $6,
               caminho_xml_nota_fiscal = $7,
               caminho_danfe = $8,
               dados_completos = $9,
               ambiente = $10,
               tenant_id = COALESCE($11, nfe.tenant_id),
               updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [
              pedido_id,
              referencia,
              chave_nfe,
              status_focus,
              status_sefaz,
              mensagem_sefaz,
              caminho_xml_nota_fiscal,
              caminho_danfe,
              dados_completos ? JSON.stringify(dados_completos) : null,
              ambiente || null,
              tenant_id || null
            ]
          );
          return result.rows[0];
        } catch (retryError) {
          console.error('Erro ao executar migrations e salvar NFe:', retryError.message);
          throw retryError;
        }
      }
      throw error;
    }
  } else {
    // Armazenamento em memória
    const existingIndex = memoryStorage.nfe.findIndex(n => n.referencia === referencia);
    const now = new Date().toISOString();

    const nfeData = {
      id: existingIndex >= 0 ? memoryStorage.nfe[existingIndex].id : memoryStorage.nfe.length + 1,
      pedido_id,
      referencia,
      chave_nfe,
      status_focus,
      status_sefaz,
      mensagem_sefaz,
      caminho_xml_nota_fiscal,
      caminho_danfe,
      dados_completos,
      ambiente: ambiente || null,
      tenant_id: tenant_id || null,
      created_at: existingIndex >= 0 ? memoryStorage.nfe[existingIndex].created_at : now,
      updated_at: now
    };

    if (existingIndex >= 0) {
      memoryStorage.nfe[existingIndex] = nfeData;
    } else {
      memoryStorage.nfe.push(nfeData);
    }

    // Salvar no arquivo
    saveStorageToFile();

    return nfeData;
  }
}

/**
 * Busca NFe por referência
 */
async function buscarNFePorReferencia(referencia) {
  if (hasDatabase) {
    const result = await query(
      'SELECT * FROM nfe WHERE referencia = $1',
      [referencia]
    );

    return result.rows[0];
  } else {
    return memoryStorage.nfe.find(n => n.referencia === referencia) || null;
  }
}

/**
 * Busca NFe por chave
 */
async function buscarNFePorChave(chave_nfe) {
  if (hasDatabase) {
    const result = await query(
      'SELECT * FROM nfe WHERE chave_nfe = $1',
      [chave_nfe]
    );

    return result.rows[0];
  } else {
    return memoryStorage.nfe.find(n => n.chave_nfe === chave_nfe) || null;
  }
}

/**
 * Lista NFe com filtros
 */
async function listarNFe(filtros = {}) {
  let { limite = 50, offset = 0, status_focus, pedido_id, data_inicio, data_fim, ambiente, chave, tenant_id } = filtros;

  // Validações
  limite = Math.min(Math.max(parseInt(limite) || 50, 1), 200); // Entre 1 e 200
  offset = Math.max(parseInt(offset) || 0, 0); // Não negativo

  // Validar formato de datas (YYYY-MM-DD)
  if (data_inicio && !/^\d{4}-\d{2}-\d{2}$/.test(data_inicio)) {
    throw new Error('Formato de data_inicio inválido. Use YYYY-MM-DD');
  }
  if (data_fim && !/^\d{4}-\d{2}-\d{2}$/.test(data_fim)) {
    throw new Error('Formato de data_fim inválido. Use YYYY-MM-DD');
  }

  // Validar ambiente
  if (ambiente && !['homologacao', 'producao'].includes(ambiente)) {
    throw new Error('Ambiente inválido. Deve ser "homologacao" ou "producao"');
  }

  if (hasDatabase) {
    let whereClause = [];
    let params = [];
    let paramCount = 1;

    if (tenant_id != null) {
      whereClause.push(`(n.tenant_id = $${paramCount} OR n.tenant_id IS NULL)`);
      params.push(tenant_id);
      paramCount++;
    }

    if (status_focus) {
      whereClause.push(`n.status_focus = $${paramCount}`);
      params.push(status_focus);
      paramCount++;
    }

    if (pedido_id) {
      whereClause.push(`n.pedido_id = $${paramCount}`);
      params.push(pedido_id);
      paramCount++;
    }

    if (ambiente) {
      whereClause.push(`n.ambiente = $${paramCount}`);
      params.push(ambiente);
      paramCount++;
    }

    if (data_inicio) {
      whereClause.push(`DATE(n.created_at) >= $${paramCount}`);
      params.push(data_inicio);
      paramCount++;
    }

    if (data_fim) {
      whereClause.push(`DATE(n.created_at) <= $${paramCount}`);
      params.push(data_fim);
      paramCount++;
    }

    if (chave) {
      whereClause.push(`(n.chave_nfe LIKE $${paramCount} OR n.dados_completos->>'chave_nfe' LIKE $${paramCount + 1})`);
      params.push(`%${chave}%`, `%${chave}%`);
      paramCount += 2;
    }

    const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    // Query para contar total (usando LEFT JOIN para não perder NFe sem pedido)
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM nfe n
       LEFT JOIN pedidos p ON n.pedido_id = p.id
       ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Query para buscar dados (usando LEFT JOIN para não perder NFe sem pedido)
    const paramsQuery = [...params];
    paramsQuery.push(limite, offset);
    const result = await query(
      `SELECT n.*, p.pedido_id as pedido_externo, p.dados_pedido
       FROM nfe n
       LEFT JOIN pedidos p ON n.pedido_id = p.id

       ${where}
       ORDER BY n.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      paramsQuery
    );

    // Parsear dados_completos se for string JSON
    // No Vercel Postgres, JSONB pode vir como objeto ou string dependendo da versão
    const dadosParseados = result.rows.map((row, index) => {
      if (row.dados_completos) {
        const tipoOriginal = typeof row.dados_completos;

        // Se for string, tentar parsear
        if (tipoOriginal === 'string') {
          try {
            row.dados_completos = JSON.parse(row.dados_completos);
          } catch (e) {
            // Se não conseguir parsear, manter como está
            console.warn(`Erro ao parsear dados_completos (NFe) - linha ${index}:`, e.message);
          }
        }
        // Se já for objeto, manter como está (Vercel Postgres retorna JSONB como objeto)

        // Log para debug (apenas primeira linha)
        if (index === 0) {
          console.log('Debug NFe - Tipo dados_completos:', tipoOriginal, 'Tipo após processamento:', typeof row.dados_completos);
          if (row.dados_completos && typeof row.dados_completos === 'object') {
            console.log('Debug NFe - Chaves disponíveis:', Object.keys(row.dados_completos).slice(0, 10));
            console.log('Debug NFe - Tem destinatario?', !!row.dados_completos.destinatario);
            console.log('Debug NFe - Tem valor_total?', !!row.dados_completos.valor_total);
          }
        }
      } else {
        // Log se dados_completos estiver vazio
        if (index === 0) {
          console.warn('Debug NFe - dados_completos está vazio/null para primeira nota');
        }
      }
      return row;
    });

    return {
      dados: dadosParseados,
      total: total,
      limite: limite,
      offset: offset
    };
  } else {
    // Armazenamento em memória
    let nfe = [...memoryStorage.nfe];

    if (tenant_id != null) {
      nfe = nfe.filter(n => n.tenant_id == null || n.tenant_id === tenant_id);
    }

    if (status_focus) {
      nfe = nfe.filter(n => n.status_focus === status_focus);
    }

    if (pedido_id) {
      nfe = nfe.filter(n => n.pedido_id === parseInt(pedido_id));
    }

    if (ambiente) {
      nfe = nfe.filter(n => n.ambiente === ambiente);
    }

    if (data_inicio) {
      const dataInicio = new Date(data_inicio);
      nfe = nfe.filter(n => {
        const dataNF = new Date(n.created_at);
        return dataNF >= dataInicio;
      });
    }

    if (data_fim) {
      const dataFim = new Date(data_fim);
      dataFim.setHours(23, 59, 59, 999); // Incluir todo o dia
      nfe = nfe.filter(n => {
        const dataNF = new Date(n.created_at);
        return dataNF <= dataFim;
      });
    }

    if (chave) {
      nfe = nfe.filter(n => {
        const chaveNota = n.chave_nfe || (n.dados_completos && n.dados_completos.chave_nfe);
        return chaveNota && chaveNota.includes(chave);
      });
    }

    nfe.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = nfe.length;
    const dados = nfe.slice(offset, offset + limite).map(n => {
      const pedido = memoryStorage.pedidos.find(p => p.id === n.pedido_id);
      return {
        ...n,
        pedido_externo: pedido ? pedido.pedido_id : null
      };
    });

    return {
      dados: dados,
      total: total,
      limite: limite,
      offset: offset
    };
  }
}

/**
 * Atualiza NFe
 */
async function atualizarNFe(referencia, atualizacoes) {
  if (hasDatabase) {
    const campos = [];
    const valores = [];
    let paramCount = 1;

    Object.keys(atualizacoes).forEach(key => {
      if (atualizacoes[key] !== undefined) {
        campos.push(`${key} = $${paramCount}`);
        if (typeof atualizacoes[key] === 'object') {
          valores.push(JSON.stringify(atualizacoes[key]));
        } else {
          valores.push(atualizacoes[key]);
        }
        paramCount++;
      }
    });

    if (campos.length === 0) {
      return null;
    }

    valores.push(referencia);

    const result = await query(
      `UPDATE nfe SET ${campos.join(', ')} WHERE referencia = $${paramCount} RETURNING *`,
      valores
    );

    return result.rows[0];
  } else {
    const index = memoryStorage.nfe.findIndex(n => n.referencia === referencia);
    if (index >= 0) {
      memoryStorage.nfe[index] = {
        ...memoryStorage.nfe[index],
        ...atualizacoes,
        updated_at: new Date().toISOString()
      };
      // Salvar no arquivo
      saveStorageToFile();
      return memoryStorage.nfe[index];
    }
    return null;
  }
}

/**
 * Salva uma configuração no banco
 */
async function salvarConfiguracao(chave, valor) {
  if (!hasDatabase || !sql) {
    return false;
  }

  try {
    await sql`
      INSERT INTO configuracoes (chave, valor, updated_at)
      VALUES (${chave}, ${valor}, CURRENT_TIMESTAMP)
      ON CONFLICT (chave) 
      DO UPDATE SET valor = ${valor}, updated_at = CURRENT_TIMESTAMP
    `;
    return true;
  } catch (error) {
    console.error('Erro ao salvar configuração:', error.message);
    return false;
  }
}

/**
 * Busca uma configuração do banco
 */
async function buscarConfiguracao(chave) {
  if (!hasDatabase || !sql) {
    return null;
  }

  try {
    const result = await sql`
      SELECT valor FROM configuracoes WHERE chave = ${chave}
    `;
    return result.rows.length > 0 ? result.rows[0].valor : null;
  } catch (error) {
    console.error('Erro ao buscar configuração:', error.message);
    return null;
  }
}

/**
 * Carrega todas as configurações do Focus NFe do banco e atualiza process.env
 */
async function carregarConfiguracoesFocus() {
  if (!hasDatabase || !sql) {
    return;
  }

  try {
    const ambiente = await buscarConfiguracao('FOCUS_NFE_AMBIENTE');
    const tokenHomologacao = await buscarConfiguracao('FOCUS_NFE_TOKEN_HOMOLOGACAO');
    const tokenProducao = await buscarConfiguracao('FOCUS_NFE_TOKEN_PRODUCAO');

    if (ambiente) {
      process.env.FOCUS_NFE_AMBIENTE = ambiente;
    }
    if (tokenHomologacao) {
      process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO = tokenHomologacao;
    }
    if (tokenProducao) {
      process.env.FOCUS_NFE_TOKEN_PRODUCAO = tokenProducao;
    }

    if (ambiente || tokenHomologacao || tokenProducao) {
      console.log('✓ Configurações do Focus NFe carregadas do banco de dados');
    }
  } catch (error) {
    console.error('Erro ao carregar configurações do Focus NFe:', error.message);
  }
}

/**
 * Busca tenant por hash do token
 */
async function buscarTenantPorTokenHash(tokenHash) {
  if (!hasDatabase || !sql) {
    return null;
  }

  try {
    const result = await sql`
      SELECT id, nome, site_url, ativo
      FROM tenants
      WHERE token_hash = ${tokenHash} AND ativo = true
    `;
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Erro ao buscar tenant:', error.message);
    return null;
  }
}

/**
 * Cria um novo tenant
 */
async function salvarTenant(dados) {
  if (!hasDatabase || !sql) {
    return null;
  }

  try {
    const { token_hash, nome, site_url, email, stripe_customer_id, webhook_id } = dados;
    const result = await sql`
      INSERT INTO tenants (token_hash, nome, site_url, email, stripe_customer_id, webhook_id)
      VALUES (${token_hash}, ${nome || ''}, ${site_url || ''}, ${email || null}, ${stripe_customer_id || null}, ${webhook_id || null})
      RETURNING id, nome, site_url, email, webhook_id, created_at
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Erro ao salvar tenant:', error.message);
    throw error;
  }
}

/**
 * Busca assinatura ativa de um tenant
 */
async function buscarAssinaturaAtiva(tenantId) {
  if (!hasDatabase || !sql) {
    return null;
  }
  try {
    const result = await sql`
      SELECT * FROM subscriptions
      WHERE tenant_id = ${tenantId} AND status = 'ativa' AND periodo_fim > NOW()
      ORDER BY periodo_fim DESC
      LIMIT 1
    `;
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Erro ao buscar assinatura:', error.message);
    return null;
  }
}

/**
 * Cria ou atualiza assinatura
 */
async function salvarSubscription(dados) {
  if (!hasDatabase || !sql) {
    return null;
  }
  try {
    const result = await sql`
      INSERT INTO subscriptions (tenant_id, stripe_customer_id, stripe_subscription_id, plano, status, notas_incluidas, periodo_inicio, periodo_fim)
      VALUES (${dados.tenant_id}, ${dados.stripe_customer_id || null}, ${dados.stripe_subscription_id || null}, ${dados.plano || 'basico'}, ${dados.status || 'ativa'}, ${dados.notas_incluidas || 100}, ${dados.periodo_inicio}, ${dados.periodo_fim})
      RETURNING *
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Erro ao salvar subscription:', error.message);
    throw error;
  }
}

/**
 * Obtém ou cria registro de uso mensal
 */
async function getOrCreateUsageMonthly(tenantId, ano, mes) {
  if (!hasDatabase || !sql) {
    return { notas_emitidas: 0, notas_extras_cobradas: 0 };
  }
  try {
    const result = await sql`
      INSERT INTO usage_monthly (tenant_id, ano, mes, notas_emitidas, notas_extras_cobradas)
      VALUES (${tenantId}, ${ano}, ${mes}, 0, 0)
      ON CONFLICT (tenant_id, ano, mes)
      DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Erro ao getOrCreateUsageMonthly:', error.message);
    return { notas_emitidas: 0, notas_extras_cobradas: 0 };
  }
}

/**
 * Incrementa contador de notas emitidas no mês
 */
async function incrementarNotasEmitidas(tenantId) {
  if (!hasDatabase || !sql) {
    return;
  }
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;
  try {
    await sql`
      INSERT INTO usage_monthly (tenant_id, ano, mes, notas_emitidas, notas_extras_cobradas)
      VALUES (${tenantId}, ${ano}, ${mes}, 1, 0)
      ON CONFLICT (tenant_id, ano, mes)
      DO UPDATE SET notas_emitidas = usage_monthly.notas_emitidas + 1, updated_at = CURRENT_TIMESTAMP
    `;
  } catch (error) {
    console.error('Erro ao incrementar notas:', error.message);
  }
}

/**
 * Busca configuração de um tenant
 */
async function buscarConfiguracaoTenant(tenantId, chave) {
  if (!hasDatabase || !sql) {
    return null;
  }

  try {
    const result = await sql`
      SELECT valor FROM tenant_config
      WHERE tenant_id = ${tenantId} AND chave = ${chave}
    `;
    return result.rows.length > 0 ? result.rows[0].valor : null;
  } catch (error) {
    console.error('Erro ao buscar config tenant:', error.message);
    return null;
  }
}

/**
 * Salva configuração de um tenant
 */
async function salvarConfiguracaoTenant(tenantId, chave, valor) {
  if (!hasDatabase || !sql) {
    return false;
  }

  try {
    await sql`
      INSERT INTO tenant_config (tenant_id, chave, valor, updated_at)
      VALUES (${tenantId}, ${chave}, ${valor}, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, chave)
      DO UPDATE SET valor = ${valor}, updated_at = CURRENT_TIMESTAMP
    `;
    return true;
  } catch (error) {
    console.error('Erro ao salvar config tenant:', error.message);
    return false;
  }
}

/**
 * Busca tenant pelo webhook_id (usado na URL do webhook WooCommerce)
 */
async function buscarTenantPorWebhookId(webhookId) {
  if (!hasDatabase || !sql) {
    return null;
  }

  try {
    const result = await sql`
      SELECT id, nome, site_url, webhook_id, ativo
      FROM tenants
      WHERE webhook_id = ${webhookId} AND ativo = true
    `;
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Erro ao buscar tenant por webhook_id:', error.message);
    return null;
  }
}

/**
 * Lista todos os tenants com uso mensal e status de assinatura (para dashboard admin)
 */
async function listarTenantsComUso() {
  if (!hasDatabase || !sql) {
    return [];
  }
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  try {
    const result = await query(
      `      SELECT 
        t.id,
        t.nome,
        t.site_url,
        t.email,
        t.webhook_id,
        t.created_at,
        COALESCE(u.notas_emitidas, 0) AS notas_mes_atual,
        s.status AS status_assinatura,
        s.plano,
        s.periodo_inicio,
        s.periodo_fim,
        s.notas_incluidas
      FROM tenants t
      LEFT JOIN usage_monthly u ON u.tenant_id = t.id AND u.ano = $1 AND u.mes = $2
      LEFT JOIN (
        SELECT DISTINCT ON (tenant_id) tenant_id, status, plano, periodo_inicio, periodo_fim, notas_incluidas
        FROM subscriptions
        ORDER BY tenant_id, periodo_fim DESC
      ) s ON s.tenant_id = t.id
      WHERE t.ativo = true
      ORDER BY t.nome ASC`,
      [ano, mes]
    );
    return result.rows || [];
  } catch (error) {
    console.error('Erro ao listar tenants com uso:', error.message);
    return [];
  }
}

/**
 * Lista todas as configurações de um tenant
 */
async function listarConfiguracoesTenant(tenantId) {
  if (!hasDatabase || !sql) {
    return {};
  }

  try {
    const result = await sql`
      SELECT chave, valor FROM tenant_config WHERE tenant_id = ${tenantId}
    `;
    const config = {};
    for (const row of result.rows) {
      config[row.chave] = row.valor;
    }
    return config;
  } catch (error) {
    console.error('Erro ao listar config tenant:', error.message);
    return {};
  }
}

// Carregar configurações do Focus NFe ao iniciar (se houver banco)
if (hasDatabase) {
  // Aguardar um pouco para garantir que o banco está pronto
  setTimeout(() => {
    carregarConfiguracoesFocus().catch(err => {
      console.warn('Erro ao carregar configurações iniciais:', err.message);
    });
  }, 1000);
}

module.exports = {
  query,
  migrate,
  salvarPedido,
  buscarPedidoPorId,
  buscarPedidoPorPedidoId,
  atualizarPedido,
  listarPedidos,
  salvarNFSe,
  buscarNFSePorReferencia,
  listarNFSe,
  atualizarNFSe,
  salvarNFe,
  buscarNFePorReferencia,
  buscarNFePorChave,
  salvarConfiguracao,
  buscarConfiguracao,
  carregarConfiguracoesFocus,
  buscarTenantPorTokenHash,
  buscarTenantPorWebhookId,
  salvarTenant,
  buscarAssinaturaAtiva,
  salvarSubscription,
  getOrCreateUsageMonthly,
  incrementarNotasEmitidas,
  buscarConfiguracaoTenant,
  salvarConfiguracaoTenant,
  listarConfiguracoesTenant,
  listarTenantsComUso,
  listarNFe,
  atualizarNFe,
  salvarLog,
  listarLogs,
  hasDatabase: () => hasDatabase,
  memoryStorage: () => memoryStorage // Para debug/inspeção
};

