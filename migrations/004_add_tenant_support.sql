-- Migration 004: Suporte Multi-Tenant para API SaaS
-- Cada cliente (WordPress) é um tenant com seu próprio token e configurações

-- Tabela de tenants (clientes)
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  nome TEXT,
  site_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ativo BOOLEAN DEFAULT true
);

-- Adicionar tenant_id nas tabelas existentes (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pedidos' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE pedidos ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'nfse' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE nfse ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'nfe' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE nfe ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'logs' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE logs ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
  END IF;
END $$;

-- Tabela de configurações por tenant (substitui config global)
CREATE TABLE IF NOT EXISTS tenant_config (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  valor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_tenant_config_tenant ON tenant_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_tenant ON pedidos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nfse_tenant ON nfse(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nfe_tenant ON nfe(tenant_id);
CREATE INDEX IF NOT EXISTS idx_logs_tenant ON logs(tenant_id);
