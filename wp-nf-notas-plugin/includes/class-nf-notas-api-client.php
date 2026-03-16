<?php
/**
 * NF Notas API Client - Cliente HTTP para a API SaaS
 */

if (!defined('ABSPATH')) {
    exit;
}

class NF_Notas_Api_Client {

    private $base_url;
    private $token;
    private $settings;

    public function __construct() {
        $this->settings = NF_Notas_Settings::get_instance();
        $this->base_url = rtrim($this->settings->get_api_url(), '/');
        $this->token = $this->settings->get_api_token();
    }

    /**
     * Faz requisição GET
     */
    public function get($endpoint, $args = array()) {
        return $this->request($endpoint, array_merge($args, array('method' => 'GET')));
    }

    /**
     * Faz requisição POST
     */
    public function post($endpoint, $body = array(), $args = array()) {
        return $this->request($endpoint, array_merge($args, array(
            'method' => 'POST',
            'body' => is_array($body) ? wp_json_encode($body) : $body
        )));
    }

    /**
     * Faz requisição PUT
     */
    public function put($endpoint, $body = array(), $args = array()) {
        return $this->request($endpoint, array_merge($args, array(
            'method' => 'PUT',
            'body' => is_array($body) ? wp_json_encode($body) : $body
        )));
    }

    /**
     * Faz requisição DELETE
     */
    public function delete($endpoint, $body = array(), $args = array()) {
        return $this->request($endpoint, array_merge($args, array(
            'method' => 'DELETE',
            'body' => is_array($body) ? wp_json_encode($body) : $body
        )));
    }

    /**
     * Requisição genérica
     */
    public function request($endpoint, $args = array()) {
        if (empty($this->base_url)) {
            return array(
                'sucesso' => false,
                'erro' => 'URL da API não configurada'
            );
        }

        if (empty($this->token)) {
            return array(
                'sucesso' => false,
                'erro' => 'Token da API não configurado'
            );
        }

        $url = $this->base_url . '/' . ltrim($endpoint, '/');
        $defaults = array(
            'timeout' => 30,
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $this->token
            )
        );

        $args = wp_parse_args($args, $defaults);
        if (!isset($args['headers']['Authorization'])) {
            $args['headers']['Authorization'] = 'Bearer ' . $this->token;
        }

        $response = wp_remote_request($url, $args);
        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (is_wp_error($response)) {
            return array(
                'sucesso' => false,
                'erro' => $response->get_error_message()
            );
        }

        if ($code === 401) {
            return array(
                'sucesso' => false,
                'erro' => 'Token inválido ou expirado',
                'codigo' => 401
            );
        }

        if ($code >= 400) {
            $erro = is_array($data) ? ($data['erro'] ?? $data['mensagem'] ?? 'Erro na requisição') : 'Erro na requisição';
            return array(
                'sucesso' => false,
                'erro' => $erro,
                'codigo' => $code,
                'dados' => $data
            );
        }

        return is_array($data) ? $data : array('sucesso' => true, 'dados' => $data);
    }
}
