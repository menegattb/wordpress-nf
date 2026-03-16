/**
 * NF Notas App - Lógica auxiliar para páginas do plugin
 * Adaptado do public/js/app.js para WP Admin
 */
(function() {
    'use strict';
    window.NFNotasApp = {
        init: function() {},
        showToast: function(msg, type) {
            type = type || 'info';
            if (typeof jQuery !== 'undefined') {
                jQuery(document).trigger('nf-notas-toast', { message: msg, type: type });
            }
        }
    };
})();
