=== NF Notas - Integração Focus NFe ===

Contributors: wp-notas
Tags: woocommerce, nfse, nfe, focus nfe, notas fiscais
Requires at least: 5.0
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Integra WooCommerce com a API SaaS de emissão de NFSe/NFe. Recebe webhooks do WooCommerce e encaminha para a API com token por tenant.

== Description ==

O plugin NF Notas conecta seu WordPress/WooCommerce à API SaaS WP-Notas para emissão automática de notas fiscais (NFSe e NFe).

* Recebe webhooks do WooCommerce e encaminha para a API
* Dashboard de notas fiscais no admin
* Configurações de Focus NFe, emitente e WooCommerce via API
* Gerenciamento de token de autenticação

== Installation ==

1. Faça upload da pasta wp-nf-notas-plugin para wp-content/plugins/
2. Ative o plugin no menu Plugins do WordPress
3. Acesse NF Notas no menu lateral para configurar
4. Configure a URL da API e gere um token
5. Configure o webhook do WooCommerce para apontar para o endpoint do plugin

== Configuration ==

* URL da API: URL base da API SaaS (ex: https://api.seudominio.com)
* Token: Obtenha via "Gerar token" ou "Renovar token" na página de configuração
* Webhook WooCommerce: Configure para https://seu-site.com/wp-json/nf-notas/v1/webhook/woocommerce

== Changelog ==

= 1.0.0 =
* Versão inicial
* Integração com API SaaS
* Webhook receiver WooCommerce
* Páginas admin (Dashboard, Notas, Pedidos, Config, Logs)
