<?php
/**
 * NF Notas Settings - WP Options para URL da API e token
 * Token armazenado criptografado com wp_salt (Fase 5.3)
 */

if (!defined('ABSPATH')) {
    exit;
}

class NF_Notas_Settings {

    const OPTION_API_URL = 'nf_notas_api_url';
    const OPTION_API_TOKEN = 'nf_notas_api_token';
    const ENCRYPT_PREFIX = 'nf_notas_enc:';

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Obtém chave de criptografia derivada do wp_salt
     */
    private function get_encryption_key() {
        return hash('sha256', wp_salt('auth'), true);
    }

    /**
     * Criptografa token com AES-256-CBC
     */
    private function encrypt_token($plain) {
        if (!extension_loaded('openssl')) {
            return $plain;
        }
        $key = $this->get_encryption_key();
        $iv = openssl_random_pseudo_bytes(16);
        $encrypted = openssl_encrypt($plain, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
        if ($encrypted === false) {
            return $plain;
        }
        return base64_encode($iv . $encrypted);
    }

    /**
     * Descriptografa token
     */
    private function decrypt_token($cipher) {
        if (!extension_loaded('openssl')) {
            return $cipher;
        }
        $raw = base64_decode($cipher, true);
        if ($raw === false || strlen($raw) < 16) {
            return $cipher;
        }
        $key = $this->get_encryption_key();
        $iv = substr($raw, 0, 16);
        $encrypted = substr($raw, 16);
        $decrypted = openssl_decrypt($encrypted, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
        return ($decrypted !== false) ? $decrypted : $cipher;
    }

    /**
     * Obtém URL base da API
     */
    public function get_api_url() {
        $url = get_option(self::OPTION_API_URL, '');
        return is_string($url) ? trim($url) : '';
    }

    /**
     * Define URL base da API
     */
    public function set_api_url($url) {
        $url = esc_url_raw(trim($url));
        update_option(self::OPTION_API_URL, $url);
        return $url;
    }

    /**
     * Obtém token da API (descriptografado se estiver armazenado criptografado)
     */
    public function get_api_token() {
        $stored = get_option(self::OPTION_API_TOKEN, '');
        if (!is_string($stored)) {
            return '';
        }
        $stored = trim($stored);
        if (strpos($stored, self::ENCRYPT_PREFIX) === 0) {
            return $this->decrypt_token(substr($stored, strlen(self::ENCRYPT_PREFIX)));
        }
        return $stored; // Legacy: token em claro
    }

    /**
     * Define token da API (criptografado com wp_salt)
     */
    public function set_api_token($token) {
        $token = sanitize_text_field(trim($token));
        $encrypted = $this->encrypt_token($token);
        update_option(self::OPTION_API_TOKEN, self::ENCRYPT_PREFIX . $encrypted);
        return $token;
    }

    /**
     * Verifica se plugin está configurado (URL e token)
     */
    public function is_configured() {
        return !empty($this->get_api_url()) && !empty($this->get_api_token());
    }
}
