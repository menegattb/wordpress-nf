-- Migration 005: Assinaturas e uso mensal para produto SaaS
-- Planos: R$ X/mês por site, 100 notas incluídas, taxa por nota extra

-- Adicionar colunas em tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Tabela de assinaturas
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
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Uso mensal por tenant
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
);

CREATE INDEX IF NOT EXISTS idx_usage_monthly_tenant ON usage_monthly(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_monthly_periodo ON usage_monthly(tenant_id, ano, mes);
