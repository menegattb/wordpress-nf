-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  pedido_id TEXT UNIQUE NOT NULL,
  origem TEXT NOT NULL DEFAULT 'woocommerce',
  dados_pedido JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de NFSe
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
);

-- Tabela de logs
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
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_pedido_id ON pedidos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_nfse_pedido_id ON nfse(pedido_id);
CREATE INDEX IF NOT EXISTS idx_nfse_referencia ON nfse(referencia);
CREATE INDEX IF NOT EXISTS idx_nfse_status_focus ON nfse(status_focus);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_pedido_id ON logs(pedido_id);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nfse_updated_at BEFORE UPDATE ON nfse
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

