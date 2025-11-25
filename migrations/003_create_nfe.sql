-- Tabela de NFe (Nota Fiscal Eletrônica de Produto)
CREATE TABLE IF NOT EXISTS nfe (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
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
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_nfe_pedido_id ON nfe(pedido_id);
CREATE INDEX IF NOT EXISTS idx_nfe_referencia ON nfe(referencia);
CREATE INDEX IF NOT EXISTS idx_nfe_status_focus ON nfe(status_focus);
CREATE INDEX IF NOT EXISTS idx_nfe_ambiente ON nfe(ambiente);
CREATE INDEX IF NOT EXISTS idx_nfe_created_at ON nfe(created_at);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_nfe_updated_at BEFORE UPDATE ON nfe
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentário sobre valores válidos
COMMENT ON COLUMN nfe.ambiente IS 'Ambiente da emissão: homologacao ou producao';

