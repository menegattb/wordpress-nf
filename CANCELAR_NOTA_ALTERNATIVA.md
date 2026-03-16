# Alternativa: Cancelar Nota pela Referência

Como a busca pela chave não encontrou a nota (provavelmente porque a listagem da Focus NFe não está retornando resultados), você pode cancelar diretamente pela **referência** se souber qual é.

## Como descobrir a referência?

A referência geralmente é algo como:
- `PED-123`
- `PED-TEST-1234567890`
- Ou qualquer identificador que você usou ao emitir a nota

## Cancelar pela Referência

### Opção 1: cURL

```bash
curl -X DELETE "http://localhost:3000/api/nfse/cancelar/PED-123" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo_nota": "nfe",
    "justificativa": "Nota emitida por engano, necessário cancelamento",
    "ambiente": "producao"
  }'
```

**Substitua `PED-123` pela referência real da sua nota.**

### Opção 2: Verificar nos Logs

1. Verifique os logs do servidor quando a nota foi emitida
2. Procure por mensagens como "NFe emitida" ou "referencia"
3. A referência estará nos logs

### Opção 3: Verificar no Banco de Dados

Se você tem acesso ao banco de dados:

```sql
SELECT referencia, chave_nfe, status_focus, ambiente 
FROM nfe 
WHERE chave_nfe = 'CHAVE_NFE_EXEMPLO';
```

### Opção 4: Verificar na Interface Web

1. Acesse a aba "Buscas Notas Enviadas"
2. Busque pela chave: `CHAVE_NFE_EXEMPLO`
3. Se a nota aparecer, você verá a referência na coluna "Referência"
4. Use essa referência para cancelar

## Script Alternativo

Crie um arquivo `cancelar_por_referencia.sh`:

```bash
#!/bin/bash

REFERENCIA="${1}"
JUSTIFICATIVA="${2}"
AMBIENTE="${3:-producao}"

if [ -z "$REFERENCIA" ] || [ -z "$JUSTIFICATIVA" ]; then
    echo "Uso: $0 <referencia> <justificativa> [ambiente]"
    exit 1
fi

curl -X DELETE "http://localhost:3000/api/nfse/cancelar/$REFERENCIA" \
  -H "Content-Type: application/json" \
  -d "{
    \"tipo_nota\": \"nfe\",
    \"justificativa\": \"$JUSTIFICATIVA\",
    \"ambiente\": \"$AMBIENTE\"
  }"
```

Uso:
```bash
chmod +x cancelar_por_referencia.sh
./cancelar_por_referencia.sh PED-123 "Nota emitida por engano" producao
```

## Por que a busca por chave não funcionou?

A busca por chave tenta:
1. Buscar no banco local ✅
2. Buscar na Focus NFe listando todas as notas ❌ (pode estar falhando)

O problema é que a listagem de todas as notas da Focus NFe pode não estar funcionando corretamente (o mesmo problema que estávamos investigando antes).

## Solução Temporária

Use a referência diretamente. Se você não souber a referência:
1. Verifique os logs do servidor
2. Verifique o banco de dados
3. Ou entre em contato com o suporte da Focus NFe para obter a referência pela chave

