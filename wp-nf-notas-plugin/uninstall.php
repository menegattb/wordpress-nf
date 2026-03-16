<?php
/**
 * Uninstall NF Notas Plugin
 * Remove options when plugin is deleted
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_option('nf_notas_api_url');
delete_option('nf_notas_api_token');
