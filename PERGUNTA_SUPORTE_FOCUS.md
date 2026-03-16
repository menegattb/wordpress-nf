# Pergunta para o Suporte da Focus NFe

## Contexto do Problema

Estamos desenvolvendo uma integração com a API da Focus NFe para listar todas as notas fiscais (NFe e NFSe) de ambos os ambientes (homologação e produção). O sistema está conseguindo emitir e consultar notas individuais, mas **não está retornando resultados ao listar todas as notas** através dos endpoints `/v2/nfe.json` e `/v2/nfse.json`.

## O que foi implementado

### 1. **Paginação Automática**
Implementamos um sistema de paginação que:
- Faz requisições sequenciais com `offset` e `limite` (100 notas por página)
- Continua buscando até não haver mais notas (quando retorna menos que o limite)
- Processa diferentes formatos de resposta (array direto, objeto com propriedade `notas`, ou objeto indexado por referência)

**Código de exemplo:**
```javascript
// Busca com paginação
const url = `/nfe.json?limite=100&offset=0`;
const response = await api.get(url);
```

### 2. **Busca em Múltiplos Ambientes**
O sistema busca simultaneamente em:
- Focus NFe Homologação (NFSe e NFe)
- Focus NFe Produção (NFSe e NFe)
- Banco de dados local

### 3. **Autenticação**
Utilizamos Basic Auth com o token como username:
```javascript
auth: {
  username: token,  // Token obtido do painel
  password: ''
}
```

### 4. **Tratamento de Respostas**
O código processa três formatos possíveis de resposta:
1. Array direto: `[{ref: "...", ...}, ...]`
2. Objeto com propriedade: `{notas: [...]}`
3. Objeto indexado: `{ref1: {...}, ref2: {...}}`

## Comportamento Atual

- ✅ **Funciona:** Emissão de notas (`POST /v2/nfe?ref=...`)
- ✅ **Funciona:** Consulta individual (`GET /v2/nfe/{ref}.json`)
- ✅ **Funciona:** Cancelamento (`DELETE /v2/nfe/{ref}.json`)
- ❌ **NÃO funciona:** Listagem de todas as notas (`GET /v2/nfe.json` ou `/v2/nfse.json`)

## O que observamos

1. **A requisição é feita corretamente** (verificamos nos logs)
2. **A autenticação está funcionando** (outras operações funcionam)
3. **A resposta chega**, mas parece estar vazia ou em formato inesperado
4. **Não há erros HTTP** (status 200), mas também não há dados

## Pergunta Chave para o Suporte

**"Ao fazer uma requisição GET para `/v2/nfe.json` ou `/v2/nfse.json` com autenticação Basic Auth válida, qual é o formato exato da resposta esperada? A API retorna:**

1. **Um array direto de notas?** Exemplo: `[{ref: "PED-123", status: "autorizado", ...}, ...]`
2. **Um objeto com uma propriedade específica?** Exemplo: `{notas: [...], total: 100}`
3. **Um objeto indexado por referência?** Exemplo: `{"PED-123": {...}, "PED-456": {...}}`
4. **Outro formato?**

**Além disso:**
- A paginação com `offset` e `limite` está funcionando corretamente?
- Existe algum parâmetro obrigatório que precisa ser enviado além da autenticação?
- Há alguma limitação de rate limiting que possa estar bloqueando as requisições?
- A listagem de todas as notas funciona de forma diferente entre homologação e produção?

**Informações adicionais:**
- Ambiente: Homologação e Produção
- Método de autenticação: Basic Auth (token como username)
- Headers: `Content-Type: application/json`
- Parâmetros testados: `limite`, `offset`, `data_inicio`, `data_fim`, `status`

## Exemplo de Requisição que Estamos Fazendo

```bash
GET https://api.focusnfe.com.br/v2/nfe.json?limite=100&offset=0
Authorization: Basic {token}:
Content-Type: application/json
```

**Resposta esperada vs. Resposta recebida:**
- Esperamos: Array ou objeto com lista de notas
- Recebemos: (precisamos confirmar o formato exato com o suporte)

---./cancelar_por_referencia.sh PED-123 "Nota emitida por engano, necessário cancelamento" producao

**Contato para suporte:**
- Email: suporte@focusnfe.com.br
- Documentação: https://doc.focusnfe.com.br


