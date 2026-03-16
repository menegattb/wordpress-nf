# WordPress NF - Aplicação Intermediária de Emissão de NFSe

Aplicação Node.js para integração entre WooCommerce e Focus NFe para emissão automática de Notas Fiscais de Serviço Eletrônicas (NFSe).

## 🚀 Funcionalidades

- ✅ Recebimento de webhooks do WooCommerce
- ✅ Emissão automática de NFSe via API Focus NFe
- ✅ Validação rigorosa de CPF/CNPJ e campos obrigatórios
- ✅ Sistema de logs estruturado em cada etapa
- ✅ CLI interativa para gestão de notas
- ✅ Banco de dados Vercel Postgres para rastreamento
- ✅ Suporte a homologação e produção

## 📋 Pré-requisitos

- Node.js 18+ 
- Conta no Focus NFe (token de acesso)
- Vercel Postgres (configurado no Vercel)
- WooCommerce configurado com webhook

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/menegattb/wordpress-nf.git
cd wordpress-nf
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

Copie o arquivo `env.example` para `.env` e preencha com suas credenciais:

```bash
cp env.example .env
```

Configure no `.env`:
- **Focus NFe:** token de homologação/produção (obtido no painel focusnfe.com.br)
- **Prestador:** CNPJ, inscrição municipal, razão social
- **WooCommerce:** URL da loja e chaves da API (se usar)
- **Vercel Postgres:** URLs do banco (se usar Vercel)

4. Execute as migrations:
```bash
npm run migrate
```

## 🚀 Uso

### Iniciar servidor

```bash
npm start
```

Em desenvolvimento com auto-reload:
```bash
npm run dev
```

### CLI Interativa

```bash
npm run cli
```

A CLI oferece:
- Configuração de ambiente (Homologação/Produção)
- Seleção de tipo de nota (NFSe/NFe)
- Listagem de notas
- Envio manual para Focus NFe
- Verificação de status

## 📡 Endpoints da API

### Webhook WooCommerce
```
POST /api/webhook/woocommerce
```

Recebe webhooks do WooCommerce e processa automaticamente.

### Emitir NFSe Manualmente
```
POST /api/nfse/emitir
Content-Type: application/json

{
  "pedido_id": "123",
  "data_emissao": "2025-01-15",
  "cpf_cnpj": "12345678900",
  "nome": "João Silva",
  "servicos": [...],
  ...
}
```

### Consultar Status
```
GET /api/nfse/consulta/:referencia
```

### Cancelar NFSe
```
DELETE /api/nfse/:referencia
Content-Type: application/json

{
  "justificativa": "Cancelamento solicitado pelo cliente"
}
```

### Listar Pedidos
```
GET /api/pedidos?limite=50&offset=0&status=pendente
```

### Health Check
```
GET /health
```

## 🔗 Configuração do WooCommerce

No painel do WooCommerce:

1. Vá em **WooCommerce > Configurações > Avançado > Webhooks**
2. Clique em **Adicionar webhook**
3. Configure:
   - **Nome**: Pedido Concluído
   - **Status**: Ativo
   - **Tópico**: Pedido concluído
   - **URL de Entrega**: `https://seu-dominio.com/api/webhook/woocommerce`
   - **Segredo**: (opcional, configure no .env)

## 🔔 Configuração de Webhooks da Focus NFe

O sistema agora suporta webhooks da Focus NFe para receber notificações automáticas quando notas são emitidas, autorizadas, canceladas, etc.

### Endpoint de Recebimento

O endpoint que recebe as notificações da Focus NFe é:
```
POST /api/webhook/focus-nfe
```

### Configurar Webhooks na Focus NFe

#### Via API (Recomendado)

1. Obtenha a URL do webhook:
```bash
GET /api/config/webhook-url
```

2. Crie o webhook para NFe:
```bash
POST /api/webhook/focus/criar
Content-Type: application/json

{
  "event": "nfe",
  "url": "https://seu-dominio.com/api/webhook/focus-nfe",
  "ambiente": "homologacao"
}
```

3. Crie o webhook para NFSe:
```bash
POST /api/webhook/focus/criar
Content-Type: application/json

{
  "event": "nfse",
  "url": "https://seu-dominio.com/api/webhook/focus-nfe",
  "ambiente": "homologacao"
}
```

#### Eventos Disponíveis

- `nfe` - Notificações de NFe (produtos)
- `nfse` - Notificações de NFSe (serviços)
- `nfsen` - Notificações de NFSe Nacional
- `cte` - Notificações de CTe
- `mdfe` - Notificações de MDFe
- `nfcom` - Notificações de NFCom

### Gerenciar Webhooks

**Listar todos os webhooks:**
```bash
GET /api/webhook/focus/listar?ambiente=homologacao
```

**Consultar um webhook específico:**
```bash
GET /api/webhook/focus/:hookId?ambiente=homologacao
```

**Deletar um webhook:**
```bash
DELETE /api/webhook/focus/:hookId?ambiente=homologacao
```

**Reenviar notificação para uma nota:**
```bash
POST /api/webhook/focus/reenviar/:referencia
Content-Type: application/json

{
  "tipo_nota": "nfe",
  "ambiente": "homologacao"
}
```

### Vantagens dos Webhooks

- ✅ **Sem polling**: Não precisa consultar constantemente o status das notas
- ✅ **Tempo real**: Recebe notificações imediatamente quando há mudanças
- ✅ **Eficiente**: Reduz chamadas à API da Focus NFe
- ✅ **Automático**: As notas são salvas/atualizadas automaticamente no banco local

### Importante

- A URL do webhook deve ser **publicamente acessível** (não funciona com `localhost`)
- Para desenvolvimento local, use ferramentas como [ngrok](https://ngrok.com/) para expor seu servidor
- Em produção, certifique-se de que a URL está correta e acessível
- A Focus NFe tentará reenviar notificações em caso de falha (1 min, 30 min, 1h, 3h, 24h)

## 🗄️ Estrutura do Banco de Dados

### Tabela `pedidos`
- Armazena pedidos recebidos do WooCommerce
- Status: `pendente`, `processando`, `emitida`, `erro`

### Tabela `nfse`
- Rastreamento de emissões NFSe
- Status: `processando_autorizacao`, `autorizado`, `erro_autorizacao`, `cancelado`

### Tabela `logs`
- Logs estruturados de todas as operações

## 📝 Logs

Os logs são salvos em:
- Console (formato colorido)
- Arquivo: `logs/combined-YYYY-MM-DD.log`
- Erros: `logs/error-YYYY-MM-DD.log`
- Banco de dados: tabela `logs`

Níveis de log:
- `INFO` - Operações normais
- `WARN` - Avisos
- `ERROR` - Erros
- `DEBUG` - Detalhes técnicos

## 🚢 Deploy no Vercel

1. Conecte o repositório no Vercel
2. Configure as variáveis de ambiente no painel
3. Configure o Vercel Postgres
4. Deploy automático a cada push

O arquivo `vercel.json` já está configurado.

## 📚 Documentação Focus NFe

Consulte a documentação completa em: https://focusnfe.com.br/doc/

## ⚠️ Importante

- Sempre teste primeiro em **homologação**
- Certifique-se de que todos os campos obrigatórios estão configurados
- A emissão é **assíncrona** - sempre consulte o status após envio
- Mantenha backups do banco de dados

## 📄 Licença

MIT

