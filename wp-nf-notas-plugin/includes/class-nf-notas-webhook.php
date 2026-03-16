<?php
/**
 * NF Notas Webhook - Receiver para webhooks do WooCommerce, encaminha para API SaaS
 */

if (!defined('ABSPATH')) {
    exit;
}

class NF_Notas_Webhook {

    private static $instance = null;
    private $settings;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function __construct() {
        $this->settings = NF_Notas_Settings::get_instance();
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    public function register_routes() {
        register_rest_route('nf-notas/v1', '/webhook/woocommerce', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_woocommerce_webhook'),
            'permission_callback' => '__return_true'
        ));
    }

    /**
     * Recebe webhook do WooCommerce e encaminha para a API com X-Tenant-Token
     */
    public function handle_woocommerce_webhook($request) {
        $token = $this->settings->get_api_token();
        $api_url = $this->settings->get_api_url();

        if (empty($token) || empty($api_url)) {
            return new WP_REST_Response(array(
                'erro' => 'Plugin não configurado. Configure URL da API e token em NF Notas > Token API.'
            ), 503);
        }

        $body = $request->get_body();
        $url = rtrim($api_url, '/') . '/api/webhook/woocommerce';

        $response = wp_remote_post($url, array(
            'timeout' => 30,
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-Tenant-Token' => $token,
                'Authorization' => 'Bearer ' . $token
            ),
            'body' => $body
        ));

        $code = wp_remote_retrieve_response_code($response);
        $resp_body = wp_remote_retrieve_body($response);
        $data = json_decode($resp_body, true);

        if (is_wp_error($response)) {
            return new WP_REST_Response(array(
                'erro' => $response->get_error_message()
            ), 500);
        }

        return new WP_REST_Response($data ?: array(), $code >= 200 && $code < 300 ? 200 : $code);
    }
}
