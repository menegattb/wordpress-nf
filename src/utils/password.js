const bcrypt = require('bcryptjs');

/**
 * Gera hash de uma senha
 * @param {string} password - Senha em texto plano
 * @returns {Promise<string>} Hash da senha
 */
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Compara senha em texto plano com hash
 * @param {string} password - Senha em texto plano
 * @param {string} hash - Hash da senha
 * @returns {Promise<boolean>} true se a senha corresponde ao hash
 */
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Valida se uma string é um hash bcrypt válido
 * @param {string} hash - Hash a validar
 * @returns {boolean} true se for um hash válido
 */
function isValidHash(hash) {
  // Hash bcrypt começa com $2a$, $2b$, $2x$ ou $2y$ seguido de salt e hash
  return /^\$2[axyb]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash);
}

module.exports = {
  hashPassword,
  comparePassword,
  isValidHash
};

