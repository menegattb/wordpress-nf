/**
 * Middleware de autenticação
 * Verifica se o usuário está autenticado através da sessão
 */

/**
 * Middleware para proteger rotas que requerem autenticação
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  
  // Se for requisição de API, retornar JSON
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({
      sucesso: false,
      erro: 'Não autenticado',
      mensagem: 'Você precisa estar autenticado para acessar este recurso'
    });
  }
  
  // Caso contrário, redirecionar para login
  return res.redirect('/login');
}

/**
 * Middleware para verificar autenticação (não bloqueia, apenas adiciona info)
 */
function checkAuth(req, res, next) {
  req.isAuthenticated = !!(req.session && req.session.authenticated);
  next();
}

module.exports = {
  requireAuth,
  checkAuth
};

