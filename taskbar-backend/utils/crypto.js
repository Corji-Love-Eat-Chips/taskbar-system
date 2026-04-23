const bcrypt = require('bcryptjs')

const SALT_ROUNDS = 10

/**
 * 生成密码哈希
 * @param {string} plainText
 * @returns {Promise<string>}
 */
async function hashPassword(plainText) {
  return bcrypt.hash(plainText, SALT_ROUNDS)
}

/**
 * 校验密码
 * @param {string} plainText  明文
 * @param {string} hash       存储的哈希
 * @returns {Promise<boolean>}
 */
async function verifyPassword(plainText, hash) {
  return bcrypt.compare(plainText, hash)
}

module.exports = { hashPassword, verifyPassword }
