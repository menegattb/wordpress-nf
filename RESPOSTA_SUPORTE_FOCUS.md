# Resposta Esperada do Suporte da Focus NFe

Olá,

Obrigado por entrar em contato. Vamos esclarecer o funcionamento da API de listagem de notas.

## Formato da Resposta

A API retorna um **objeto indexado por referência**, onde cada chave é a referência da nota e o valor são os dados da nota. Exemplo:

```json
{
  "PED-123": {
    "ref": "PED-123",
    "status": "autorizado",
    "status_sefaz": "100",
    "chave_nfe": "3521...",
    "data_emissao": "2025-11-18T17:13:00-03:00",
    ...
  },
  "PED-456": {
    "ref": "PED-456",
    "status": "processando_autorizacao",
    ...
  }
}
```

## Paginação

A paginação funciona com os parâmetros:
- `limite`: Número de notas por página (padrão: 50, máximo: 100)
- `offset`: Número de notas a pular (padrão: 0)

**Importante:** Quando não há mais notas, a API retorna um objeto vazio `{}`, não um array vazio.

## Parâmetros Opcionais

Você pode filtrar usando:
- `data_inicio`: Data inicial (formato: YYYY-MM-DD)
- `data_fim`: Data final (formato: YYYY-MM-DD)
- `status`: Status da nota (ex: `autorizado`, `processando_autorizacao`, `cancelado`)

## Exemplo de Requisição Completa

```bash
GET https://api.focusnfe.com.br/v2/nfe.json?limite=100&offset=0&data_inicio=2025-01-01&data_fim=2025-12-31
Authorization: Basic {seu_token}:
```

## Diferenças entre Ambientes

- **Homologação:** Retorna apenas notas de teste
- **Produção:** Retorna apenas notas de produção
- **Não há endpoint único** que retorne ambos os ambientes - você precisa fazer duas requisições separadas

## Rate Limiting

A API tem limite de **100 requisições por minuto por token**. Se você ultrapassar, receberá HTTP 429 (Too Many Requests).

## Verificação de Autenticação

Para verificar se sua autenticação está funcionando, teste com uma nota específica:
```bash
GET https://api.focusnfe.com.br/v2/nfe/{referencia}.json
```

Se retornar 200 ou 404, a autenticação está OK. Se retornar 401, o token está inválido.

## Solução para seu Caso

Baseado na sua descrição, recomendamos:

1. **Verificar o formato da resposta:** Certifique-se de processar o objeto indexado corretamente
2. **Fazer requisições separadas:** Uma para homologação, outra para produção
3. **Tratar objeto vazio:** Quando `response.data === {}`, significa que não há mais notas
4. **Adicionar logs:** Verifique o que está sendo retornado exatamente

## Exemplo de Código Corrigido

```javascript
async function listarTodasNFe(filtros = {}) {
  const api = createApiClient();
  let todasNotas = [];
  let offset = 0;
  const limitePorPagina = 100;
  let temMaisNotas = true;
  
  while (temMaisNotas) {
    const params = new URLSearchParams();
    params.append('limite', limitePorPagina.toString());
    params.append('offset', offset.toString());
    if (filtros.data_inicio) params.append('data_inicio', filtros.data_inicio);
    if (filtros.data_fim) params.append('data_fim', filtros.data_fim);
    if (filtros.status) params.append('status', filtros.status);
    
    const response = await api.get(`/nfe.json?${params.toString()}`);
    
    // A resposta é um objeto indexado por referência
    const notasObjeto = response.data || {};
    const chaves = Object.keys(notasObjeto);
    
    // Se não há chaves, não há mais notas
    if (chaves.length === 0) {
      temMaisNotas = false;
      break;
    }
    
    // Converter objeto em array
    const notasPagina = chaves.map(ref => ({
      ...notasObjeto[ref],
      referencia: ref,
      ref: ref
    }));
    
    todasNotas = todasNotas.concat(notasPagina);
    
    // Se retornou menos que o limite, não há mais notas
    if (chaves.length < limitePorPagina) {
      temMaisNotas = false;
    } else {
      offset += limitePorPagina;
    }
  }
  
  return { sucesso: true, notas: todasNotas };
}
```

## Próximos Passos

1. Teste a requisição manualmente com `curl` ou Postman
2. Verifique os logs do servidor para ver a resposta exata
3. Se ainda não funcionar, envie:
   - URL exata da requisição
   - Headers enviados
   - Resposta completa (status code e body)
   - Token (mascarado, apenas primeiros 10 caracteres)

Atenciosamente,
Equipe de Suporte Focus NFe

---

**Nota:** Esta é uma resposta simulada baseada em padrões comuns de APIs REST. A resposta real do suporte pode variar.

