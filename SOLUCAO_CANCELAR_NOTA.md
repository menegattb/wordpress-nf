# Solução para Cancelar a Nota

## Problema Identificado

A nota não está sendo encontrada porque:
1. ❌ Não está no banco local
2. ❌ A listagem da Focus NFe não está retornando resultados (problema conhecido)
3. ❌ Não sabemos a referência da nota (necessária para cancelar)

## Soluções Possíveis

### Opção 1: Verificar Logs do Servidor (RECOMENDADO)

Execute:
```bash
./verificar_logs_servidor.sh
```

Ou verifique manualmente os logs procurando por:
- Mensagens de "CANCELAR POR CHAVE"
- "Resultado da busca no ambiente"
- "total_notas"
- Erros relacionados à busca

### Opção 2: Buscar pela Data na Interface Web

1. Acesse a interface web: `http://localhost:3000`
2. Vá para a aba "Buscas Notas Enviadas"
3. Configure os filtros:
   - **Data Início:** `2025-11-17`
   - **Data Fim:** `2025-11-17`
   - **Tipo de Nota:** `NFe`
   - **Ambiente:** Deixe vazio (buscará em ambos)
4. Clique em "Buscar"
5. Procure a nota com a chave `26251151581345000117550010000000011106473566`
6. Anote a **Referência** da nota
7. Use o script `cancelar_por_referencia.sh` com a referência encontrada

### Opção 3: Tentar Referências Comuns

Baseado na data de emissão (2025-11-17), tente algumas referências comuns:

```bash
# Tentar referências baseadas na data
./cancelar_por_referencia.sh PED-TEST-1763492816611 "Nota emitida por engano" producao
./cancelar_por_referencia.sh PED-6453 "Nota emitida por engano" producao
./cancelar_por_referencia.sh PED-6454 "Nota emitida por engano" producao
```

### Opção 4: Consultar Diretamente na Focus NFe

Se você souber a referência, pode consultar diretamente:

```bash
# Substitua REFERENCIA pela referência real
curl -u "SEU_TOKEN_PRODUCAO:" \
  "https://api.focusnfe.com.br/v2/nfe/REFERENCIA.json?completa=1"
```

Isso retornará os dados da nota, incluindo a chave, confirmando se é a nota correta.

### Opção 5: Usar a API da Focus NFe Diretamente

Se você tiver acesso ao painel da Focus NFe:

1. Acesse o painel: https://app.focusnfe.com.br
2. Vá para "Notas Fiscais" > "NFe"
3. Busque pela chave: `26251151581345000117550010000000011106473566`
4. Anote a referência
5. Use o script `cancelar_por_referencia.sh`

### Opção 6: Cancelar via Painel da Focus NFe

Como última opção, você pode cancelar diretamente pelo painel web da Focus NFe:

1. Acesse: https://app.focusnfe.com.br
2. Vá para "Notas Fiscais" > "NFe"
3. Encontre a nota pela chave
4. Clique em "Cancelar"
5. Informe a justificativa

## Próximos Passos

1. **Execute o script de verificação de logs:**
   ```bash
   ./verificar_logs_servidor.sh
   ```

2. **Verifique os logs do servidor** para entender por que a busca não está retornando resultados

3. **Tente buscar pela data na interface web** para encontrar a referência

4. **Se encontrar a referência**, use:
   ```bash
   ./cancelar_por_referencia.sh REFERENCIA "Nota emitida por engano, necessário cancelamento" producao
   ```

## Informações da Nota

- **Chave NFe:** `26251151581345000117550010000000011106473566`
- **Número:** 1
- **Série:** 1
- **Data de Emissão:** 2025-11-17T21:00:00-03:00
- **Data de Autorização:** 2025-11-18T16:06:57-03:00
- **Ambiente:** Produção
- **Status:** Autorizado

## Importante

⚠️ **Prazo de Cancelamento:** A nota pode ser cancelada em até 24 horas após a emissão. Como foi emitida em 17/11/2025 às 21:00, você tem até 18/11/2025 às 21:00 para cancelar.

