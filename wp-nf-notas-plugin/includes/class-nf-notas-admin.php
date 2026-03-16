<?php
/**
 * NF Notas Admin - Menu e páginas do plugin
 */

if (!defined('ABSPATH')) {
    exit;
}

class NF_Notas_Admin {

    private static $instance = null;
    const MENU_SLUG = 'nf-notas';

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function __construct() {
        add_action('admin_menu', array($this, 'add_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_assets'));
        add_action('admin_notices', array($this, 'maybe_show_limite_atingido_notice'));
    }

    /**
     * Exibe aviso quando limite de notas foi atingido (402 do webhook)
     */
    public function maybe_show_limite_atingido_notice() {
        $screen = get_current_screen();
        if (!$screen || strpos($screen->id, 'nf-notas') === false) {
            return;
        }

        $info = get_transient('nf_notas_limite_atingido');
        if (!$info || !is_array($info)) {
            return;
        }

        $mensagem = esc_html($info['mensagem'] ?? 'Limite de notas atingido.');
        $upgrade_url = esc_url($info['upgrade_url'] ?? '');
        $usado = isset($info['usado']) ? (int) $info['usado'] : null;
        $limite = isset($info['limite']) ? (int) $info['limite'] : null;

        $detalhe = '';
        if ($usado !== null && $limite !== null) {
            $detalhe = sprintf(' (%d/%d notas este mês)', $usado, $limite);
        }

        echo '<div class="notice notice-warning is-dismissible"><p><strong>NF Notas:</strong> ';
        echo esc_html($mensagem) . esc_html($detalhe);
        if ($upgrade_url) {
            echo ' <a href="' . $upgrade_url . '" target="_blank" rel="noopener" class="button button-primary" style="margin-left: 8px;">Fazer upgrade</a>';
        }
        echo '</p></div>';
    }

    public function add_menu() {
        add_menu_page(
            __('NF Notas', 'nf-notas'),
            __('NF Notas', 'nf-notas'),
            'manage_options',
            self::MENU_SLUG,
            array($this, 'render_dashboard'),
            'dashicons-media-spreadsheet',
            30
        );

        add_submenu_page(self::MENU_SLUG, __('Dashboard', 'nf-notas'), __('Dashboard', 'nf-notas'), 'manage_options', self::MENU_SLUG, array($this, 'render_dashboard'));
        add_submenu_page(self::MENU_SLUG, __('Notas', 'nf-notas'), __('Notas', 'nf-notas'), 'manage_options', 'nf-notas-notas', array($this, 'render_notas'));
        add_submenu_page(self::MENU_SLUG, __('Pedidos', 'nf-notas'), __('Pedidos', 'nf-notas'), 'manage_options', 'nf-notas-pedidos', array($this, 'render_pedidos'));
        add_submenu_page(self::MENU_SLUG, __('Config Focus', 'nf-notas'), __('Config Focus', 'nf-notas'), 'manage_options', 'nf-notas-config-focus', array($this, 'render_config_focus'));
        add_submenu_page(self::MENU_SLUG, __('Config Emitente', 'nf-notas'), __('Config Emitente', 'nf-notas'), 'manage_options', 'nf-notas-config-emitente', array($this, 'render_config_emitente'));
        add_submenu_page(self::MENU_SLUG, __('Config WooCommerce', 'nf-notas'), __('Config WooCommerce', 'nf-notas'), 'manage_options', 'nf-notas-config-woocommerce', array($this, 'render_config_woocommerce'));
        add_submenu_page(self::MENU_SLUG, __('Token API', 'nf-notas'), __('Token API', 'nf-notas'), 'manage_options', 'nf-notas-config-token', array($this, 'render_config_token'));
        add_submenu_page(self::MENU_SLUG, __('Logs', 'nf-notas'), __('Logs', 'nf-notas'), 'manage_options', 'nf-notas-logs', array($this, 'render_logs'));
    }

    public function enqueue_assets($hook) {
        $pages = array(
            'toplevel_page_nf-notas',
            'nf-notas_page_nf-notas-notas',
            'nf-notas_page_nf-notas-pedidos',
            'nf-notas_page_nf-notas-config-focus',
            'nf-notas_page_nf-notas-config-emitente',
            'nf-notas_page_nf-notas-config-woocommerce',
            'nf-notas_page_nf-notas-config-token',
            'nf-notas_page_nf-notas-logs'
        );

        if (!in_array($hook, $pages)) {
            return;
        }

        wp_enqueue_style('nf-notas-admin', NF_NOTAS_PLUGIN_URL . 'admin/css/admin.css', array(), NF_NOTAS_VERSION);
        wp_enqueue_script('nf-notas-api', NF_NOTAS_PLUGIN_URL . 'admin/js/api.js', array(), NF_NOTAS_VERSION, true);

        $settings = NF_Notas_Settings::get_instance();
        wp_localize_script('nf-notas-api', 'nfNotasConfig', array(
            'apiUrl' => $settings->get_api_url(),
            'token' => $settings->get_api_token(),
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('nf_notas_admin')
        ));
    }

    private function load_view($view, $data = array()) {
        extract($data);
        $path = NF_NOTAS_PLUGIN_DIR . 'admin/views/' . $view . '.php';
        if (file_exists($path)) {
            include $path;
        } else {
            echo '<p>View não encontrada: ' . esc_html($view) . '</p>';
        }
    }

    public function render_dashboard() {
        $this->load_view('dashboard');
    }

    public function render_notas() {
        $this->load_view('notas-list');
    }

    public function render_pedidos() {
        $this->load_view('pedidos-list');
    }

    public function render_config_focus() {
        $this->load_view('config-focus');
    }

    public function render_config_emitente() {
        $this->load_view('config-emitente');
    }

    public function render_config_woocommerce() {
        $this->load_view('config-woocommerce');
    }

    public function render_config_token() {
        $this->load_view('config-token');
    }

    public function render_logs() {
        $this->load_view('logs');
    }
}
