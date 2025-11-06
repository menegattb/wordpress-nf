const fs = require('fs');
const path = require('path');

// Verificar se há conexão com banco de dados
let sql = null;
let hasDatabase = false;
let memoryStorage = {
  pedidos: [],
  nfse: [],
  logs: []
};

// Tentar conectar ao banco
try {
  if (process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL) {
    sql = require('@vercel/postgres').sql;
    hasDatabase = true;
    console.log('✓ Banco de dados Vercel Postgres configurado');
  } else {
    console.log('⚠ Banco de dados não configurado - usando armazenamento em memória');
  }
} catch (error) {
  console.log('⚠ Erro ao carregar @vercel/postgres - usando armazenamento em memória');
  hasDatabase = false;
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
 * Executa migrations
 */
async function migrate() {
  if (!hasDatabase || !sql) {
    console.log('⚠ Banco de dados não configurado - migrations ignoradas (usando memória)');
    return;
  }
  
  try {
    console.log('Iniciando migrations...');
    
    const migrationPath = path.join(__dirname, '../../migrations/001_create_pedidos.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Executa cada comando separadamente
    const commands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
    
    for (const command of commands) {
      if (command.trim()) {
        try {
          await sql.query(command);
        } catch (error) {
          // Ignora erros de "already exists"
          if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
            throw error;
          }
        }
      }
    }
    
    console.log('✓ Migrations executadas com sucesso');
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
      return memoryStorage.pedidos[index];
    }
    return null;
  }
}

/**
 * Lista pedidos com filtros
 */
async function listarPedidos(filtros = {}) {
  const { limite = 50, offset = 0, status, origem } = filtros;
  
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
    dados_completos
  } = nfse;
  
  if (hasDatabase) {
    const result = await query(
      `INSERT INTO nfse (pedido_id, referencia, chave_nfse, status_focus, status_sefaz, mensagem_sefaz, caminho_xml, caminho_pdf, dados_completos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (referencia) DO UPDATE SET
         chave_nfse = $3,
         status_focus = $4,
         status_sefaz = $5,
         mensagem_sefaz = $6,
         caminho_xml = $7,
         caminho_pdf = $8,
         dados_completos = $9,
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
        dados_completos ? JSON.stringify(dados_completos) : null
      ]
    );
    
    return result.rows[0];
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
      created_at: existingIndex >= 0 ? memoryStorage.nfse[existingIndex].created_at : now,
      updated_at: now
    };
    
    if (existingIndex >= 0) {
      memoryStorage.nfse[existingIndex] = nfseData;
    } else {
      memoryStorage.nfse.push(nfseData);
    }
    
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
  const { limite = 50, offset = 0, status_focus, pedido_id } = filtros;
  
  if (hasDatabase) {
    let whereClause = [];
    let params = [];
    let paramCount = 1;
    
    if (status_focus) {
      whereClause.push(`status_focus = $${paramCount}`);
      params.push(status_focus);
      paramCount++;
    }
    
    if (pedido_id) {
      whereClause.push(`pedido_id = $${paramCount}`);
      params.push(pedido_id);
      paramCount++;
    }
    
    const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
    
    params.push(limite, offset);
    
    const result = await query(
      `SELECT n.*, p.pedido_id as pedido_externo
       FROM nfse n
       JOIN pedidos p ON n.pedido_id = p.id
       ${where}
       ORDER BY n.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );
    
    return result.rows;
  } else {
    // Armazenamento em memória
    let nfse = [...memoryStorage.nfse];
    
    if (status_focus) {
      nfse = nfse.filter(n => n.status_focus === status_focus);
    }
    
    if (pedido_id) {
      nfse = nfse.filter(n => n.pedido_id === parseInt(pedido_id));
    }
    
    nfse.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Adicionar pedido_externo
    return nfse.slice(offset, offset + limite).map(n => {
      const pedido = memoryStorage.pedidos.find(p => p.id === n.pedido_id);
      return {
        ...n,
        pedido_externo: pedido ? pedido.pedido_id : null
      };
    });
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
  salvarLog,
  listarLogs,
  hasDatabase: () => hasDatabase,
  memoryStorage: () => memoryStorage // Para debug/inspeção
};

