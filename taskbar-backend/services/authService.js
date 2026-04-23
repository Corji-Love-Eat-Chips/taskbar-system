const pool = require('../config/database')
const { verifyPassword } = require('../utils/crypto')
const { createError } = require('../utils/response')

const MAX_ATTEMPTS = 5          // 最大连续失败次数
const LOCK_MINUTES = 30         // 锁定时长（分钟）

/**
 * 根据用户名查询完整用户行（含关联人员姓名）
 * @param {string} username
 * @returns {Promise<object|null>}
 */
async function findUserByUsername(username) {
  const [rows] = await pool.query(
    `SELECT u.user_id, u.username, u.password, u.role,
            u.staff_id, u.status, u.login_attempts, u.lock_until,
            s.name AS staff_name
       FROM users u
       LEFT JOIN staff s ON s.staff_id = u.staff_id
      WHERE u.username = ?
      LIMIT 1`,
    [username],
  )
  return rows[0] || null
}

/**
 * 记录一次登录失败：累加次数，达到阈值则锁定
 * @param {number} userId
 * @param {number} currentAttempts 当前已有的失败次数（+1 后写库）
 */
async function recordLoginFailure(userId, currentAttempts) {
  const nextAttempts = currentAttempts + 1
  if (nextAttempts >= MAX_ATTEMPTS) {
    const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
    await pool.query(
      'UPDATE users SET login_attempts = ?, lock_until = ? WHERE user_id = ?',
      [nextAttempts, lockUntil, userId],
    )
  } else {
    await pool.query(
      'UPDATE users SET login_attempts = ? WHERE user_id = ?',
      [nextAttempts, userId],
    )
  }
}

/**
 * 登录成功后重置失败计数、更新最后登录时间
 * @param {number} userId
 */
async function recordLoginSuccess(userId) {
  await pool.query(
    'UPDATE users SET login_attempts = 0, lock_until = NULL, last_login = NOW() WHERE user_id = ?',
    [userId],
  )
}

/**
 * 登录核心逻辑
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{user_id, username, role, staff_id, staff_name}>}
 * @throws HTTP Error（由 createError 生成，交给 errorHandler 处理）
 */
async function login(username, password) {
  // ── 1. 查询用户 ────────────────────────────────────────────────────────────
  const user = await findUserByUsername(username)
  if (!user) {
    // 用户不存在时与密码错误返回相同提示，防止枚举
    throw createError('用户名或密码错误', 401)
  }

  // ── 2. 检查账号状态 ────────────────────────────────────────────────────────
  if (user.status === 0) {
    throw createError('账号已被禁用，请联系管理员', 403)
  }

  // ── 3. 检查锁定状态 ────────────────────────────────────────────────────────
  if (user.lock_until && new Date(user.lock_until) > new Date()) {
    const remaining = Math.ceil(
      (new Date(user.lock_until) - new Date()) / 60000,
    )
    throw createError(
      `账号已被锁定，请 ${remaining} 分钟后重试（连续失败 ${MAX_ATTEMPTS} 次）`,
      423,
    )
  }

  // ── 4. 验证密码 ────────────────────────────────────────────────────────────
  const passwordMatch = await verifyPassword(password, user.password)
  if (!passwordMatch) {
    await recordLoginFailure(user.user_id, user.login_attempts || 0)

    const afterAttempts = (user.login_attempts || 0) + 1
    const left = MAX_ATTEMPTS - afterAttempts
    const hint =
      left > 0
        ? `，还可尝试 ${left} 次`
        : `，账号已被锁定 ${LOCK_MINUTES} 分钟`
    throw createError(`用户名或密码错误${hint}`, 401)
  }

  // ── 5. 登录成功 ────────────────────────────────────────────────────────────
  await recordLoginSuccess(user.user_id)

  return {
    user_id: user.user_id,
    username: user.username,
    role: user.role,
    staff_id: user.staff_id,
    staff_name: user.staff_name || null,
  }
}

module.exports = { login }
