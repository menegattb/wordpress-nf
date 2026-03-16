-- Adicionar coluna ambiente na tabela nfse
ALTER TABLE nfse ADD COLUMN IF NOT EXISTS ambiente TEXT;

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_nfse_ambiente ON nfse(ambiente);
CREATE INDEX IF NOT EXISTS idx_nfse_created_at ON nfse(created_at);

-- Comentário sobre valores válidos
COMMENT ON COLUMN nfse.ambiente IS 'Ambiente da emissão: homologacao ou producao';

