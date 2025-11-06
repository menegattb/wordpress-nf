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

Edite o arquivo `.env` com suas credenciais. As configurações oficiais já estão como padrão no código:

```env
# Focus NFe - Configurações Oficiais
FOCUS_NFE_TOKEN_HOMOLOGACAO=4tn92XZHfM22uOfhtmbhb3dMvLk48ymA
FOCUS_NFE_AMBIENTE=homologacao
FOCUS_NFE_CNPJ=51581345000117

# Prestador - Configurações Oficiais
PRESTADOR_CNPJ=51581345000117
PRESTADOR_IM=032.392-6
PRESTADOR_RAZAO=Lungta Psicoterapia Ltda
PRESTADOR_MUNICIPIO=2607208

# Configurações Fiscais - Oficiais
ITEM_LISTA_SERVICO=070101
CODIGO_TRIBUTARIO_MUNICIPIO=101
ALIQUOTA=3
TOMADOR_MUNICIPIO=2607208

# Vercel Postgres (obtido no painel do Vercel)
POSTGRES_URL=postgres://...
POSTGRES_PRISMA_URL=postgres://...
POSTGRES_URL_NON_POOLING=postgres://...
```

**Nota:** As configurações oficiais já estão definidas como padrão no código. Se você não criar o arquivo `.env`, o sistema usará automaticamente:
- Token: `4tn92XZHfM22uOfhtmbhb3dMvLk48ymA`
- CNPJ: `51581345000117`
- IM: `032.392-6`
- Município: `2607208`

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

