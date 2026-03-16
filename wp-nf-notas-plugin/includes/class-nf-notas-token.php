<?php
/**
 * NF Notas Token - Registro e renovação de token via API
 */

if (!defined('ABSPATH')) {
    exit;
}

class NF_Notas_Token {

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
    }

    /**
     * Registra novo tenant na API. Requer ADMIN_SECRET.
     *
     * @param string $admin_secret ADMIN_SECRET da API
     * @param string $nome Nome do tenant
     * @param string $site_url URL do site WordPress
     * @return array { sucesso, token?, erro? }
     */
    public function registrar_tenant($admin_secret, $nome = '', $site_url = '') {
        $api_url = $this->settings->get_api_url();
        if (empty($api_url)) {
            return array('sucesso' => false, 'erro' => 'URL da API não configurada');
        }

        $url = rtrim($api_url, '/') . '/api/tenants/registrar';
        $body = array(
            'nome' => sanitize_text_field($nome),
            'site_url' => esc_url_raw($site_url)
        );

        $response = wp_remote_post($url, array(
            'timeout' => 30,
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-Admin-Secret' => $admin_secret
            ),
            'body' => wp_json_encode($body)
        ));

        return $this->parse_token_response($response, $url);
    }

    /**
     * Renova token do tenant. Requer token atual.
     *
     * @param string $token_atual Token atual do tenant
     * @param string $nome Nome (opcional, para atualizar)
     * @param string $site_url URL do site (opcional, para atualizar)
     * @return array { sucesso, token?, erro? }
     */
    public function renovar_token($token_atual, $nome = '', $site_url = '') {
        $api_url = $this->settings->get_api_url();
        if (empty($api_url)) {
            return array('sucesso' => false, 'erro' => 'URL da API não configurada');
        }

        $url = rtrim($api_url, '/') . '/api/tenants/renovar-token';
        $body = array();
        if (!empty($nome)) {
            $body['nome'] = sanitize_text_field($nome);
        }
        if (!empty($site_url)) {
            $body['site_url'] = esc_url_raw($site_url);
        }

        $response = wp_remote_post($url, array(
            'timeout' => 30,
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $token_atual
            ),
            'body' => wp_json_encode($body)
        ));

        return $this->parse_token_response($response, $url);
    }

    private function parse_token_response($response, $url) {
        if (is_wp_error($response)) {
            return array('sucesso' => false, 'erro' => $response->get_error_message());
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if ($code >= 400) {
            $erro = is_array($data) ? ($data['erro'] ?? $data['mensagem'] ?? 'Erro na requisição') : 'Erro na requisição';
            return array('sucesso' => false, 'erro' => $erro, 'codigo' => $code);
        }

        if (!is_array($data) || empty($data['dados']['token'])) {
            return array('sucesso' => false, 'erro' => 'Resposta inválida da API');
        }

        $token = $data['dados']['token'];
        $this->settings->set_api_token($token);

        return array(
            'sucesso' => true,
            'token' => $token,
            'tenant_id' => $data['dados']['tenant_id'] ?? null
        );
    }
}
