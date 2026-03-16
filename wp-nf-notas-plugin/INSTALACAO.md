# Instalação do Plugin NF Notas

## Requisitos

- WordPress 5.0+
- WooCommerce (opcional, para webhook automático)
- PHP 7.4+
- API WP-Notas deployada e acessível

## Instalação

1. Copie a pasta `wp-nf-notas-plugin` para `wp-content/plugins/`
2. Ative o plugin em **Plugins > Plugins instalados**
3. Acesse **NF Notas** no menu lateral do WordPress

## Configuração

### 1. URL da API e Token

1. Acesse **NF Notas > Token API**
2. Informe a **URL da API** (ex: `https://api.seudominio.com`)
3. Para obter um token:
   - **Primeira vez**: use "Registrar tenant" com o ADMIN_SECRET da API
   - **Já tem token**: use "Renovar token" para gerar um novo
4. Salve as configurações

### 2. Webhook WooCommerce

Para emissão automática de notas quando um pedido é concluído:

1. No WooCommerce, vá em **Configurações > Avançado > Webhooks**
2. Clique em **Adicionar webhook**
3. **URL de entrega**: use a URL exibida em NF Notas > Token API:
   ```
   https://seu-site.com/wp-json/nf-notas/v1/webhook/woocommerce
   ```
4. **Evento**: Order updated (ou Order created)
5. **Tópico**: Order updated
6. Salve o webhook

O plugin receberá o webhook e encaminhará para a API com seu token automaticamente.

### 3. Configurações Focus NFe

1. Acesse **NF Notas > Config Focus**
2. Selecione o ambiente (Homologação ou Produção)
3. Informe os tokens da Focus NFe
4. Salve

As configurações são armazenadas na API por tenant.

## Fluxo de dados

```
WooCommerce --> Plugin (recebe webhook) --> API (com X-Tenant-Token)
Plugin Admin --> API (com Bearer token)
```

## Solução de problemas

- **Erro 401**: Token inválido. Renove o token em Token API.
- **Erro 503 no webhook**: Plugin não configurado. Configure URL e token.
- **Notas não aparecem**: Verifique se a API está acessível e o token está correto.
