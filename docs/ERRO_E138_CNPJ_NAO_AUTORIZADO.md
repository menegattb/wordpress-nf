# Erro E138: CNPJ não autorizado a realizar o serviço

## Problema

Ao tentar emitir NFSe, você recebe o erro:
```
Código: E138
Mensagem: CNPJ não autorizado a realizar o serviço.
```

## Causas Possíveis

### 1. CNPJ não cadastrado na conta Focus NFe

O CNPJ `SEU_CNPJ` precisa estar cadastrado e autorizado na sua conta da Focus NFe especificamente para emitir NFSe.

**Solução:**
1. Acesse o painel da Focus NFe: https://app.focusnfe.com.br
2. Vá em **Configurações** → **CNPJs**
3. Verifique se o CNPJ `SEU_CNPJ` está cadastrado
4. Verifique se está autorizado para **NFSe** (não apenas NFe)
5. Se não estiver, adicione o CNPJ e solicite autorização para NFSe

### 2. Token não associado ao CNPJ correto

O token usado pode não estar associado ao CNPJ que você está tentando usar.

**Solução:**
1. Verifique qual token está sendo usado (homologação ou produção)
2. No painel da Focus NFe, verifique se o token está associado ao CNPJ correto
3. Se necessário, gere um novo token associado ao CNPJ correto

### 3. Ambiente incorreto (Homologação vs Produção)

O CNPJ pode estar autorizado apenas em um ambiente (homologação ou produção).

**Solução:**
1. Verifique em qual ambiente você está tentando emitir:
   - Homologação: `homologacao.focusnfe.com.br`
   - Produção: `api.focusnfe.com.br`
2. Verifique a variável de ambiente: `FOCUS_NFE_AMBIENTE`
3. Certifique-se de que o CNPJ está autorizado no ambiente correto

### 4. Código do Município Incorreto

O código do município pode estar incorreto. O código correto é `CODIGO_IBGE_MUNICIPIO` (Ipojuca/PE).

**Solução:**
1. Verifique se a variável `PRESTADOR_MUNICIPIO=CODIGO_IBGE_MUNICIPIO` está configurada no `.env`
2. O código foi corrigido no `config.js` para usar `CODIGO_IBGE_MUNICIPIO` como padrão

## Verificações Necessárias

### 1. Verificar configuração atual

No painel da Vercel ou no seu `.env` local, verifique:

```env
# CNPJ do prestador
PRESTADOR_CNPJ=SEU_CNPJ

# Código do município (deve ser CODIGO_IBGE_MUNICIPIO)
PRESTADOR_MUNICIPIO=CODIGO_IBGE_MUNICIPIO

# Ambiente (homologacao ou producao)
FOCUS_NFE_AMBIENTE=homologacao

# Token correto para o ambiente
FOCUS_NFE_TOKEN_HOMOLOGACAO=seu_token_aqui
# ou
FOCUS_NFE_TOKEN_PRODUCAO=seu_token_aqui
```

### 2. Verificar no painel Focus NFe

1. Acesse: https://app.focusnfe.com.br
2. Vá em **Configurações** → **CNPJs**
3. Verifique:
   - ✅ CNPJ `SEU_CNPJ` está cadastrado
   - ✅ Está autorizado para **NFSe**
   - ✅ Está ativo
   - ✅ Está no ambiente correto (homologação/produção)

### 3. Verificar token

1. No painel da Focus NFe, vá em **Configurações** → **Tokens**
2. Verifique:
   - ✅ Token está ativo
   - ✅ Token está associado ao CNPJ correto
   - ✅ Token tem permissão para emitir NFSe

## Solução Rápida

Se você está em **homologação** e o CNPJ não está autorizado:

1. No painel da Focus NFe, adicione o CNPJ `SEU_CNPJ`
2. Solicite autorização para NFSe
3. Aguarde a aprovação (pode levar algumas horas)
4. Tente emitir novamente

## Contato com Suporte Focus NFe

Se o problema persistir após verificar tudo acima:

1. Entre em contato com o suporte da Focus NFe
2. Informe:
   - CNPJ: `SEU_CNPJ`
   - Erro: E138 - CNPJ não autorizado
   - Ambiente: Homologação ou Produção
   - Token usado: (primeiros 10 caracteres)

## Logs para Debug

Para verificar qual CNPJ está sendo enviado, verifique os logs:

```bash
# No servidor, procure por logs que mostram o payload enviado
# O CNPJ deve aparecer como:
prestador: {
  cnpj: "SEU_CNPJ",
  codigo_municipio: "CODIGO_IBGE_MUNICIPIO"
}
```

## Correção Aplicada

O código do município foi corrigido de `2607200` para `CODIGO_IBGE_MUNICIPIO` no arquivo `config.js`.

