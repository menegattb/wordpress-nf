<?php
/**
 * Plugin Name: NF Notas - Integração Focus NFe
 * Plugin URI: https://github.com/your-repo/wp-nf-notas-plugin
 * Description: Integra WooCommerce com a API SaaS de emissão de NFSe/NFe. Recebe webhooks do WooCommerce e encaminha para a API com token por tenant.
 * Version: 1.0.0
 * Author: WP-Notas
 * Author URI: https://github.com/your-repo
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: nf-notas
 * Requires at least: 5.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('NF_NOTAS_VERSION', '1.0.0');
define('NF_NOTAS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('NF_NOTAS_PLUGIN_URL', plugin_dir_url(__FILE__));
define('NF_NOTAS_PLUGIN_BASENAME', plugin_basename(__FILE__));

require_once NF_NOTAS_PLUGIN_DIR . 'includes/class-nf-notas-settings.php';
require_once NF_NOTAS_PLUGIN_DIR . 'includes/class-nf-notas-api-client.php';
require_once NF_NOTAS_PLUGIN_DIR . 'includes/class-nf-notas-token.php';
require_once NF_NOTAS_PLUGIN_DIR . 'includes/class-nf-notas-admin.php';
require_once NF_NOTAS_PLUGIN_DIR . 'includes/class-nf-notas-webhook.php';

function nf_notas_init() {
    NF_Notas_Admin::get_instance();
    NF_Notas_Webhook::get_instance();
}
add_action('plugins_loaded', 'nf_notas_init');

register_activation_hook(__FILE__, function () {
    if (!get_option('nf_notas_api_url')) {
        update_option('nf_notas_api_url', '');
    }
    if (!get_option('nf_notas_api_token')) {
        update_option('nf_notas_api_token', '');
    }
});
