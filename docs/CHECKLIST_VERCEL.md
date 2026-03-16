# Checklist de Configuração na Vercel

## ✅ Variáveis de Ambiente Necessárias

Verifique se TODAS estas variáveis estão configuradas na Vercel:

### 1. Autenticação (OBRIGATÓRIAS)

- [ ] **ADMIN_USERNAME**
  - Valor: `admin`
  - Ambientes: Production, Preview, Development

- [ ] **ADMIN_PASSWORD_HASH**
  - Valor: gere com `npm run generate-password-hash`
  - Ambientes: Production, Preview, Development

- [ ] **SESSION_SECRET**
  - Valor: Uma chave aleatória forte (ex: `openssl rand -base64 32`)
  - Ambientes: Production, Preview, Development
  - ⚠️ Use uma chave diferente para cada ambiente se possível

### 2. Banco de Dados (OBRIGATÓRIO para multi-tenant)

- [ ] **POSTGRES_URL**
- [ ] **POSTGRES_PRISMA_URL**
- [ ] **POSTGRES_URL_NON_POOLING**
  - Crie um banco Vercel Postgres no painel e vincule ao projeto

### 2.1 Multi-tenant SaaS (para registro de novos tenants)

- [ ] **ADMIN_SECRET**
  - Chave secreta para `POST /api/tenants/registrar`
  - Gere com: `openssl rand -base64 32`
  - O plugin WordPress usa essa chave na primeira configuração

### 3. Focus NFe

- [ ] **FOCUS_NFE_AMBIENTE** (homologacao ou producao)
- [ ] **FOCUS_NFE_TOKEN_HOMOLOGACAO**
- [ ] **FOCUS_NFE_TOKEN_PRODUCAO** (se ambiente = producao)

### 4. WooCommerce

- [ ] **WOOCOMMERCE_URL**
- [ ] **WOOCOMMERCE_API_URL**
- [ ] **WOOCOMMERCE_CONSUMER_KEY**
- [ ] **WOOCOMMERCE_CONSUMER_SECRET**

## Como Verificar

1. Acesse: https://vercel.com/dashboard
2. Seu projeto → **Settings** → **Environment Variables**
3. Verifique se todas as variáveis acima estão listadas
4. Verifique se estão aplicadas aos ambientes corretos

## Após Configurar

1. **Salve** as variáveis
2. Faça um **novo deploy** ou aguarde o próximo automático
3. Teste o login (se configurado):
   - Usuário: conforme ADMIN_USERNAME
   - Senha: conforme hash em ADMIN_PASSWORD_HASH

## Gerar SESSION_SECRET

Se ainda não configurou o SESSION_SECRET, gere uma chave segura:

```bash
openssl rand -base64 32
```

Ou use um gerador online de chaves aleatórias.

## Troubleshooting

### Erro: "Configuração de autenticação não encontrada"
- Verifique se `ADMIN_PASSWORD_HASH` está configurado
- Verifique se fez deploy após adicionar a variável
- Verifique se selecionou o ambiente correto (Production)

### Login não funciona
- Verifique se todas as 3 variáveis de autenticação estão configuradas
- Verifique se o hash está completo (deve começar com `$2b$10$`)
- Verifique os logs da Vercel para mais detalhes

