/**
 * Middleware de impersonação: admin autenticado pode visualizar dados de um tenant
 * específico enviando o header X-Admin-Tenant com o ID do tenant.
 */
function adminTenantImpersonate(req, res, next) {
  const adminTenantId = req.headers['x-admin-tenant'];

  if (adminTenantId && req.session && req.session.authenticated) {
    const parsed = parseInt(adminTenantId, 10);
    if (!isNaN(parsed)) {
      req.tenant_id = parsed;
    }
  }

  next();
}

module.exports = { adminTenantImpersonate };
