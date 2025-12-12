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

// Tentar conectar ao banco
try {
  if (process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL) {
    sql = require('@vercel/postgres').sql;
    hasDatabase = true;
    console.log('✓ Banco de dados Vercel Postgres configurado');
  } else {
    console.log('⚠ Banco de dados não configurado - usando armazenamento em memória');
    // Carregar dados do arquivo se não houver banco
    loadStorageFromFile();
  }
} catch (error) {
  console.log('⚠ Erro ao carregar @vercel/postgres - usando armazenamento em memória');
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
    
    console.log('✓ Todas as migrations executadas com sucesso');
  } catch (error) {
    console.error('Erro ao executar migrations:', error.message);
    throw error;
  }
}

/**
 * Salva um pedido
 */
async function salvarPedido(pedido) {
  const { pedido_id, origem, dados_pedido, status } = pedido;
  
  if (hasDatabase) {
    const result = await query(
      `INSERT INTO pedidos (pedido_id, origem, dados_pedido, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (pedido_id) 
       DO UPDATE SET dados_pedido = $3, status = $4, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [pedido_id, origem || 'woocommerce', JSON.stringify(dados_pedido), status || 'pendente']
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
 */
async function buscarPedidoPorPedidoId(pedido_id) {
  if (hasDatabase) {
    const result = await query(
      'SELECT * FROM pedidos WHERE pedido_id = $1',
      [pedido_id]
    );
    
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
    
    return result.rows[0];
  } else {
    const index = memoryStorage.pedidos.findIndex(p => p.id === parseInt(id));
    if (index >= 0) {
      memoryStorage.pedidos[index] = {
        ...memoryStorage.pedidos[index],
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
 */
async function listarPedidos(filtros = {}) {
  const { limite = 1000, offset = 0, status, origem } = filtros; // Aumentar limite padrão para 1000
  
  if (hasDatabase) {
    let whereClause = [];
    let params = [];
    let paramCount = 1;
    
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
    ambiente
  } = nfse;
  
  if (hasDatabase) {
    try {
      const result = await query(
        `INSERT INTO nfse (pedido_id, referencia, chave_nfse, status_focus, status_sefaz, mensagem_sefaz, caminho_xml, caminho_pdf, dados_completos, ambiente)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (referencia) DO UPDATE SET
           chave_nfse = $3,
           status_focus = $4,
           status_sefaz = $5,
           mensagem_sefaz = $6,
           caminho_xml = $7,
           caminho_pdf = $8,
           dados_completos = $9,
           ambiente = $10,
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
          ambiente || null
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
            `INSERT INTO nfse (pedido_id, referencia, chave_nfse, status_focus, status_sefaz, mensagem_sefaz, caminho_xml, caminho_pdf, dados_completos, ambiente)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (referencia) DO UPDATE SET
               chave_nfse = $3,
               status_focus = $4,
               status_sefaz = $5,
               mensagem_sefaz = $6,
               caminho_xml = $7,
               caminho_pdf = $8,
               dados_completos = $9,
               ambiente = $10,
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
              ambiente || null
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
  let { limite = 50, offset = 0, status_focus, pedido_id, data_inicio, data_fim, ambiente, chave } = filtros;
  
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
      `SELECT n.*, p.pedido_id as pedido_externo
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
        
        // Log para debug (apenas primeira linha)
        if (index === 0) {
          console.log('Debug NFSe - Tipo dados_completos:', tipoOriginal, 'Tipo após processamento:', typeof row.dados_completos);
          if (row.dados_completos && typeof row.dados_completos === 'object') {
            console.log('Debug NFSe - Chaves disponíveis:', Object.keys(row.dados_completos).slice(0, 10));
            console.log('Debug NFSe - Tem tomador?', !!row.dados_completos.tomador);
            console.log('Debug NFSe - Tem servico?', !!row.dados_completos.servico);
          }
        }
      } else {
        // Log se dados_completos estiver vazio
        if (index === 0) {
          console.warn('Debug NFSe - dados_completos está vazio/null para primeira nota');
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
    let nfse = [...memoryStorage.nfse];
    
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
      saveStorageToFile();
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
  
  if (hasDatabase) {
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
}

/**
 * Lista logs
 */
async function listarLogs(filtros = {}) {
  const { limite = 100, offset = 0, level, pedido_id, service } = filtros;
  
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
    
    const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
    
    params.push(limite, offset);
    
    const result = await query(
      `SELECT * FROM logs ${where} ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );
    
    return result.rows;
  } else {
    // Armazenamento em memória
    let logs = [...memoryStorage.logs];
    
    if (level) {
      logs = logs.filter(l => l.level === level);
    }
    
    if (pedido_id) {
      logs = logs.filter(l => l.pedido_id === pedido_id);
    }
    
    if (service) {
      logs = logs.filter(l => l.service === service);
    }
    
    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return logs.slice(offset, offset + limite);
  }
}

/**
 * Salva uma NFe
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
    ambiente
  } = nfe;
  
  if (hasDatabase) {
    try {
      const result = await query(
        `INSERT INTO nfe (pedido_id, referencia, chave_nfe, status_focus, status_sefaz, mensagem_sefaz, caminho_xml_nota_fiscal, caminho_danfe, dados_completos, ambiente)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (referencia) DO UPDATE SET
           chave_nfe = $3,
           status_focus = $4,
           status_sefaz = $5,
           mensagem_sefaz = $6,
           caminho_xml_nota_fiscal = $7,
           caminho_danfe = $8,
           dados_completos = $9,
           ambiente = $10,
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
          ambiente || null
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
            `INSERT INTO nfe (pedido_id, referencia, chave_nfe, status_focus, status_sefaz, mensagem_sefaz, caminho_xml_nota_fiscal, caminho_danfe, dados_completos, ambiente)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (referencia) DO UPDATE SET
               chave_nfe = $3,
               status_focus = $4,
               status_sefaz = $5,
               mensagem_sefaz = $6,
               caminho_xml_nota_fiscal = $7,
               caminho_danfe = $8,
               dados_completos = $9,
               ambiente = $10,
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
              ambiente || null
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
  let { limite = 50, offset = 0, status_focus, pedido_id, data_inicio, data_fim, ambiente, chave } = filtros;
  
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
      `SELECT n.*, p.pedido_id as pedido_externo
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
  listarNFe,
  atualizarNFe,
  salvarLog,
  listarLogs,
  hasDatabase: () => hasDatabase,
  memoryStorage: () => memoryStorage // Para debug/inspeção
};

