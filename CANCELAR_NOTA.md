# Como Cancelar a Nota Fiscal

## Informações da Nota

- **Chave NFe:** `26251151581345000117550010000000011106473566`
- **Número:** 1
- **Série:** 1
- **Ambiente:** Produção (tpAmb: 1)
- **Status:** Autorizado
- **Data de Emissão:** 2025-11-17T21:00:00-03:00
- **Data de Autorização:** 2025-11-18T16:06:57-03:00

## Método 1: Usando o Script Shell

```bash
./cancelar_nota_por_chave.sh 26251151581345000117550010000000011106473566 "Nota emitida por engano, necessário cancelamento" producao
```

## Método 2: Usando cURL Diretamente

```bash
curl -X DELETE "http://localhost:3000/api/nfse/cancelar-por-chave/26251151581345000117550010000000011106473566" \
  -H "Content-Type: application/json" \
  -d '{
    "justificativa": "Nota emitida por engano, necessário cancelamento",
    "ambiente": "producao"
  }'
```

## Método 3: Usando a Interface Web

1. Acesse a aba "Buscas Notas Enviadas"
2. Busque pela chave da nota: `26251151581345000117550010000000011106473566`
3. Clique no botão "Cancelar" da nota
4. Informe a justificativa (mínimo 15 caracteres)
5. Confirme o cancelamento

## Requisitos

- **Justificativa:** Mínimo 15 caracteres, máximo 255 caracteres
- **Ambiente:** `producao` (já que a nota é de produção)
- **Prazo:** A nota pode ser cancelada em até 24 horas após a emissão

## O que o Sistema Faz

1. Busca a nota pela chave no banco local
2. Se não encontrar, busca na Focus NFe (produção e homologação)
3. Obtém a referência da nota
4. Cancela a nota usando a referência encontrada
5. Atualiza o status no banco local

## Exemplo de Resposta de Sucesso

```json
{
  "sucesso": true,
  "referencia": "PED-123",
  "chave_nfe": "26251151581345000117550010000000011106473566",
  "referencia_encontrada": "PED-123",
  "ambiente_utilizado": "producao",
  "status": "cancelado",
  "status_sefaz": "135",
  "mensagem_sefaz": "Evento registrado e vinculado a NF-e",
  "caminho_xml_cancelamento": "/arquivos_development/.../cancelamento.xml"
}
```

## Exemplo de Resposta de Erro

```json
{
  "sucesso": false,
  "erro": "Nota com chave 26251151581345000117550010000000011106473566 não encontrada no banco local nem na Focus NFe"
}
```

## Importante

⚠️ **Atenção:** Certifique-se de que:
- O servidor está rodando
- O token de produção está configurado no `.env` (`FOCUS_NFE_TOKEN_PRODUCAO`)
- A justificativa tem pelo menos 15 caracteres
- A nota ainda está dentro do prazo de cancelamento (24 horas)

