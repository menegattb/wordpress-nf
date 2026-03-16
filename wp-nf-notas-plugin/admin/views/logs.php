<?php
if (!defined('ABSPATH')) exit;
$api = new NF_Notas_Api_Client();
$result = $api->get('api/config/logs?limite=100');
$logs = isset($result['logs']) ? $result['logs'] : (isset($result['dados']) ? $result['dados'] : array());
?>
<div class="wrap nf-notas-wrap">
    <h1><?php esc_html_e('Logs', 'nf-notas'); ?></h1>

    <?php if (isset($result['erro'])): ?>
    <div class="notice notice-error">
        <p><?php echo esc_html($result['erro']); ?></p>
    </div>
    <?php elseif (empty($logs)): ?>
    <div class="content-section">
        <p><?php esc_html_e('Nenhum log encontrado.', 'nf-notas'); ?></p>
    </div>
    <?php else: ?>
    <div class="table-container">
        <table class="table">
            <thead>
                <tr>
                    <th><?php esc_html_e('Data', 'nf-notas'); ?></th>
                    <th><?php esc_html_e('Nível', 'nf-notas'); ?></th>
                    <th><?php esc_html_e('Mensagem', 'nf-notas'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($logs as $log):
                    $msg = is_array($log) ? ($log['message'] ?? $log['msg'] ?? json_encode($log)) : $log;
                    $level = is_array($log) ? ($log['level'] ?? $log['nivel'] ?? '') : '';
                    $date = is_array($log) ? ($log['timestamp'] ?? $log['created_at'] ?? $log['date'] ?? '') : '';
                ?>
                <tr>
                    <td><?php echo esc_html($date); ?></td>
                    <td><?php echo esc_html($level); ?></td>
                    <td><?php echo esc_html(is_string($msg) ? $msg : json_encode($msg)); ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
</div>
