# Documentação do Banco de Dados

## Visão Geral

O sistema utiliza PostgreSQL (via Vercel Postgres) como banco de dados principal, com fallback para armazenamento em memória quando o banco não está configurado.

## Estrutura das Tabelas

### Tabela `pedidos`

**Propósito:** Armazenar pedidos do WooCommerce recebidos via webhooks e servir como referência para NFSe.

**Campos:**
- `id` (SERIAL PRIMARY KEY) - ID interno do banco
- `pedido_id` (TEXT UNIQUE NOT NULL) - ID do pedido no WooCommerce
- `origem` (TEXT DEFAULT 'woocommerce') - Origem do pedido
- `dados_pedido` (JSONB) - Dados completos do pedido em formato JSON
- `status` (TEXT DEFAULT 'pendente') - Status do pedido
- `created_at`, `updated_at` (TIMESTAMP) - Timestamps de criação e atualização

**Índices:**
- `idx_pedidos_status` - Para filtros por status
- `idx_pedidos_pedido_id` - Para buscas rápidas por ID do WooCommerce

**Estado Atual:**
- ✅ **ATIVA** - Usada para armazenar pedidos recebidos via webhooks
- ⚠️ **NÃO é usada** para sincronização manual de pedidos (frontend busca direto da API)
- ✅ **Usada** como referência na tabela `nfse` (foreign key)

**Decisão de Design:**
- Pedidos são salvos automaticamente quando recebidos via webhook do WooCommerce
- O frontend busca pedidos diretamente da API do WooCommerce (não do banco local)
- Motivo: Evitar inconsistências de status e garantir dados sempre atualizados
- A tabela é mantida para:
  1. Relacionar NFSe com pedidos
  2. Armazenar pedidos recebidos via webhooks
  3. Permitir histórico e auditoria

### Tabela `nfse`

**Propósito:** Armazenar todas as Notas Fiscais de Serviço (NFSe) emitidas.

**Campos:**
- `id` (SERIAL PRIMARY KEY) - ID interno
- `pedido_id` (INTEGER REFERENCES pedidos(id)) - Referência ao pedido (pode ser NULL)
- `referencia` (TEXT UNIQUE NOT NULL) - Referência única da NFSe
- `chave_nfse` (TEXT) - Chave da NFSe quando autorizada
- `status_focus` (TEXT) - Status na API FocusNFe
- `status_sefaz` (TEXT) - Status na SEFAZ
- `mensagem_sefaz` (TEXT) - Mensagem da SEFAZ
- `caminho_xml`, `caminho_pdf` (TEXT) - Caminhos dos arquivos
- `dados_completos` (JSONB) - Dados completos da resposta da API
- `ambiente` (TEXT) - Ambiente de emissão: 'homologacao' ou 'producao' (adicionado na migração 002)
- `created_at`, `updated_at` (TIMESTAMP) - Timestamps

**Índices:**
- `idx_nfse_pedido_id` - Para JOINs com pedidos
- `idx_nfse_referencia` - Para buscas por referência
- `idx_nfse_status_focus` - Para filtros por status
- `idx_nfse_ambiente` - Para filtros por ambiente
- `idx_nfse_created_at` - Para filtros de data

**Estado Atual:**
- ✅ **ATIVA** - Todas as NFSe emitidas são salvas aqui
- ✅ Campo `ambiente` implementado e sendo usado
- ✅ Suporta filtros avançados e paginação

**Relacionamento:**
- Usa LEFT JOIN com `pedidos` para não perder NFSe sem pedido associado
- `pedido_id` pode ser NULL (para NFSe emitidas manualmente ou sem pedido)

### Tabela `logs`

**Propósito:** Armazenar logs do sistema para auditoria e debugging.

**Campos:**
- `id` (SERIAL PRIMARY KEY)
- `level` (TEXT NOT NULL) - Nível do log (INFO, ERROR, WARN, etc.)
- `service` (TEXT) - Serviço que gerou o log
- `action` (TEXT) - Ação que gerou o log
- `pedido_id` (TEXT) - ID do pedido relacionado
- `referencia` (TEXT) - Referência da NFSe relacionada
- `message` (TEXT NOT NULL) - Mensagem do log
- `data` (JSONB) - Dados adicionais em formato JSON
- `created_at` (TIMESTAMP) - Timestamp do log

**Índices:**
- `idx_logs_level` - Para filtros por nível
- `idx_logs_created_at` - Para ordenação e filtros de data
- `idx_logs_pedido_id` - Para buscar logs de um pedido

**Estado Atual:**
- ✅ **ATIVA** - Logs são salvos automaticamente
- ⚠️ Em memória: limitado a 1000 logs (mais antigos são removidos)

## Migrações

### Migration 001: `001_create_pedidos.sql`
- Cria as 3 tabelas principais (pedidos, nfse, logs)
- Cria todos os índices de performance
- Cria função e triggers para atualização automática de `updated_at`

### Migration 002: `002_add_ambiente_nfse.sql`
- Adiciona coluna `ambiente` na tabela `nfse`
- Adiciona índice `idx_nfse_ambiente` para filtros
- Adiciona índice `idx_nfse_created_at` para filtros de data

**Status:** ✅ Aplicada

## Funções CRUD

### Pedidos

- `salvarPedido(pedido)` - Salva ou atualiza pedido (usado por webhooks)
- `buscarPedidoPorId(id)` - Busca por ID interno
- `buscarPedidoPorPedidoId(pedido_id)` - Busca por ID do WooCommerce
- `atualizarPedido(id, atualizacoes)` - Atualiza campos do pedido
- `listarPedidos(filtros)` - Lista com filtros (status, origem, paginação)

### NFSe

- `salvarNFSe(nfse)` - Salva ou atualiza NFSe (inclui campo `ambiente`)
- `buscarNFSePorReferencia(referencia)` - Busca por referência única
- `listarNFSe(filtros)` - Lista com filtros avançados:
  - Filtros: `status_focus`, `pedido_id`, `data_inicio`, `data_fim`, `ambiente`
  - Paginação: `limite` (1-200), `offset`
  - Retorna: `{ dados, total, limite, offset }`
  - Usa LEFT JOIN para não perder NFSe sem pedido
- `atualizarNFSe(referencia, atualizacoes)` - Atualiza campos da NFSe

### Logs

- `salvarLog(log)` - Salva log do sistema
- `listarLogs(filtros)` - Lista com filtros (level, pedido_id, service, paginação)

## Decisões de Design

### Por que pedidos não são sincronizados manualmente?

1. **Inconsistência de Status:** Quando salvos no banco local, havia problemas onde pedidos concluídos apareciam como pendentes
2. **Dados Sempre Atuais:** Buscar direto da API garante dados sempre atualizados
3. **Performance:** Evita necessidade de sincronização constante
4. **Simplicidade:** Frontend não precisa gerenciar estado de sincronização

### Por que manter a tabela `pedidos`?

1. **Webhooks:** Pedidos recebidos via webhook são salvos automaticamente
2. **Relacionamento:** NFSe precisa referenciar pedidos para rastreabilidade
3. **Histórico:** Permite manter histórico mesmo se pedido for deletado no WooCommerce
4. **Auditoria:** Facilita auditoria e rastreamento

### Por que usar LEFT JOIN em `listarNFSe()`?

- NFSe podem ser emitidas sem pedido associado (emissão manual)
- Usar JOIN normal faria perder essas NFSe na listagem
- LEFT JOIN garante que todas as NFSe sejam retornadas, mesmo sem pedido

## Armazenamento em Memória (Fallback)

Quando `POSTGRES_URL` não está configurado:
- Todas as funções CRUD têm versão em memória
- Dados são armazenados em `memoryStorage` (objeto JavaScript)
- Logs são limitados a 1000 itens (mais antigos são removidos)
- Dados são perdidos ao reiniciar o servidor

## Melhorias Implementadas

1. ✅ Campo `ambiente` adicionado na tabela `nfse`
2. ✅ `listarNFSe()` melhorado com filtros avançados e paginação
3. ✅ Validações robustas de parâmetros
4. ✅ LEFT JOIN implementado para não perder NFSe sem pedido
5. ✅ Índices de performance adicionados

## Próximas Melhorias Sugeridas

1. Considerar adicionar campo `deleted_at` para soft delete
2. Adicionar índices compostos para queries frequentes
3. Implementar backup automático
4. Considerar particionamento da tabela `logs` por data

