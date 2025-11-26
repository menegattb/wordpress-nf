# Análise do WSDL de Ipojuca/PE - NFSe

## Informações do WSDL

O suporte da Focus NFe forneceu o WSDL do município de Ipojuca/PE, que mostra a estrutura SOAP esperada pela prefeitura.

**URL Base:** `https://www2.tinus.com.br:443/csp/testeipo/`

## Serviços Disponíveis

1. **RecepcionarLoteRps** - Enviar lote de RPS
2. **ConsultarLoteRps** - Consultar lote por protocolo
3. **ConsultarSituacaoLoteRps** - Consultar situação do lote
4. **ConsultarNfsePorRps** - Consultar NFSe por RPS
5. **ConsultarNfse** - Consultar NFSe
6. **CancelarNfse** - Cancelar NFSe

## Estrutura do Prestador (tcIdentificacaoPrestador)

Conforme o WSDL:

```xml
<complexType name="tcIdentificacaoPrestador">
  <sequence>
    <element name="Cnpj" type="tsCnpj"/> <!-- OBRIGATÓRIO: 14 caracteres -->
    <element minOccurs="0" name="InscricaoMunicipal" type="tsInscricaoMunicipal"/> <!-- OPCIONAL: 1-15 caracteres -->
  </sequence>
</complexType>
```

### Campos Obrigatórios:
- ✅ **Cnpj**: Obrigatório, exatamente 14 caracteres
- ⚠️ **InscricaoMunicipal**: Opcional (minOccurs="0"), mas pode ser necessário dependendo da configuração

## Observações Importantes

### 1. Inscrição Municipal

O WSDL mostra que `InscricaoMunicipal` é **opcional** (`minOccurs="0"`), mas:

- Alguns municípios exigem mesmo sendo opcional no schema
- A Focus NFe pode exigir baseado na configuração do CNPJ
- O erro E138 pode estar relacionado à falta de inscrição municipal

### 2. Código do Município

O código correto é **2607208** (Ipojuca/PE), que já foi corrigido no código.

### 3. Estrutura do Lote

O município usa o padrão ABRASF com:
- Lote de RPS (não nota individual)
- Protocolo de recebimento
- Consulta por protocolo

A Focus NFe abstrai isso, mas pode haver requisitos específicos.

## Possíveis Causas do Erro E138

### 1. Inscrição Municipal Não Enviada

Mesmo sendo opcional no schema, o município pode exigir:
- Verifique se `PRESTADOR_IM` está configurado
- Valor atual: `032.392-6`
- Pode precisar ser enviado mesmo que opcional

### 2. CNPJ Não Autorizado no Município

O CNPJ precisa estar:
- ✅ Cadastrado na Focus NFe
- ✅ Autorizado para NFSe
- ✅ **Autorizado especificamente para Ipojuca/PE**
- ✅ Com inscrição municipal vinculada (se exigida)

### 3. Configuração na Prefeitura

O CNPJ pode precisar estar cadastrado diretamente na prefeitura de Ipojuca, não apenas na Focus NFe.

## Recomendações

### 1. Verificar Inscrição Municipal

No painel da Focus NFe:
1. Verifique se o CNPJ `51581345000117` tem a inscrição municipal `032.392-6` cadastrada
2. Verifique se está vinculada ao município `2607208` (Ipojuca/PE)

### 2. Verificar Autorização Municipal

1. Entre em contato com a prefeitura de Ipojuca
2. Verifique se o CNPJ está autorizado para emitir NFSe
3. Confirme se a inscrição municipal está ativa

### 3. Enviar Inscrição Municipal

Mesmo sendo opcional, tente enviar a inscrição municipal no payload:

```json
{
  "prestador": {
    "cnpj": "51581345000117",
    "codigo_municipio": "2607208",
    "inscricao_municipal": "032.392-6"  // Adicionar mesmo sendo opcional
  }
}
```

## Próximos Passos

1. ✅ Verificar se inscrição municipal está sendo enviada
2. ✅ Verificar configuração na Focus NFe
3. ⚠️ Contatar prefeitura de Ipojuca se necessário
4. ⚠️ Verificar se CNPJ está autorizado no município

## Referências

- WSDL fornecido pelo suporte Focus NFe
- Padrão ABRASF para NFSe
- Município: Ipojuca/PE (Código IBGE: 2607208)

