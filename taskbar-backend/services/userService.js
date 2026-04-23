const pool = require('../config/database')
const { hashPassword, verifyPassword } = require('../utils/crypto')
const { createError } = require('../utils/response')

const DEFAULT_PASSWORD = 'Welcome@123'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

/**
 * 生成 8 位随机密码（大写+小写+数字）
 */
function generateRandomPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const all = upper + lower + digits
  let pwd = upper[Math.floor(Math.random() * upper.length)]
           + lower[Math.floor(Math.random() * lower.length)]
           + digits[Math.floor(Math.random() * digits.length)]
  for (let i = 0; i < 5; i++) pwd += all[Math.floor(Math.random() * all.length)]
  return pwd.split('').sort(() => Math.random() - 0.5).join('')
}

// ─── 查询 ─────────────────────────────────────────────────────────────────────

async function getUserById(userId) {
  const [rows] = await pool.query(
    `SELECT u.user_id, u.username, u.role, u.status,
            u.login_attempts, u.lock_until, u.last_login,
            u.created_at, u.updated_at,
            s.staff_id, s.name AS staff_name, s.department, s.position
       FROM users u
       LEFT JOIN staff s ON s.staff_id = u.staff_id
      WHERE u.user_id = ?`,
    [userId],
  )
  return rows[0] || null
}

async function getUserList({ keyword, role, status, page = 1, pageSize = 20 } = {}) {
  const offset = (Number(page) - 1) * Number(pageSize)
  const cond = []; const params = []

  if (keyword) { cond.push('u.username LIKE ?'); params.push(`%${keyword}%`) }
  if (role)    { cond.push('u.role = ?');         params.push(role) }
  if (status !== undefined && status !== '') {
    cond.push('u.status = ?'); params.push(status)
  }

  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : ''
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM users u ${where}`, params,
  )
  const [list] = await pool.query(
    `SELECT u.user_id, u.username, u.role, u.status,
            u.login_attempts, u.lock_until, u.last_login, u.created_at,
            s.staff_id, s.name AS staff_name, s.department
       FROM users u
       LEFT JOIN staff s ON s.staff_id = u.staff_id
      ${where}
      ORDER BY u.user_id ASC
      LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), offset],
  )
  return { list, pagination: { page: Number(page), pageSize: Number(pageSize), total } }
}

// ─── 新增用户 ─────────────────────────────────────────────────────────────────

/**
 * 直接创建用户（不一定绑定 staff）
 * @param {{ username, password?, role, staffId? }} opts
 * @returns {{ user: object, plainPassword: string }}  plainPassword 仅首次返回
 */
async function createUser({ username, password, role = 'teacher', staffId }) {
  // 用户名唯一
  const [[exists]] = await pool.query(
    'SELECT user_id FROM users WHERE username = ?', [username],
  )
  if (exists) throw createError(`用户名 "${username}" 已被使用`, 409)

  // staffId 存在时校验人员 & 一人一号
  if (staffId) {
    const [[staff]] = await pool.query(
      'SELECT staff_id FROM staff WHERE staff_id = ? AND status != "left"', [staffId],
    )
    if (!staff) throw createError('关联人员不存在或已离职', 404)

    const [[bound]] = await pool.query(
      'SELECT user_id FROM users WHERE staff_id = ?', [staffId],
    )
    if (bound) throw createError('该人员已有登录账号', 409)
  }

  const plain = password || DEFAULT_PASSWORD
  const hashed = await hashPassword(plain)

  const [result] = await pool.query(
    `INSERT INTO users (username, password, salt, role, staff_id, status)
     VALUES (?, ?, 'bcrypt', ?, ?, 1)`,
    [username, hashed, role, staffId || null],
  )
  const user = await getUserById(result.insertId)
  return { user, plainPassword: plain }
}

/**
 * 为指定人员创建账号（来自 POST /api/staff/:id/create-user）
 */
async function createUserForStaff(staffId, { username, role = 'teacher', password }) {
  return createUser({ username, password, role, staffId })
}

// ─── 更新 ─────────────────────────────────────────────────────────────────────

/**
 * 更新角色 / 状态（不允许改用户名）
 */
async function updateUser(userId, { role, status }) {
  const user = await getUserById(userId)
  if (!user) throw createError('用户不存在', 404)

  // 防止唯一管理员降权
  if (role && role !== 'admin' && user.role === 'admin') {
    const [[{ cnt }]] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin' AND status = 1",
    )
    if (cnt <= 1) throw createError('系统中至少保留一个启用状态的管理员', 400)
  }

  const sets = []; const params = []
  if (role   !== undefined) { sets.push('role = ?');   params.push(role) }
  if (status !== undefined) { sets.push('status = ?'); params.push(status) }
  if (!sets.length) throw createError('未传入可更新的字段', 400)

  await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE user_id = ?`,
    [...params, userId],
  )
  return getUserById(userId)
}

// ─── 软删除 ───────────────────────────────────────────────────────────────────

/**
 * 软删除用户（status = 0）
 * - 不能删除自己
 * - 不能删除唯一管理员
 * - 检查是否有待处理任务
 */
async function deleteUser(userId, operatorId) {
  const user = await getUserById(userId)
  if (!user) throw createError('用户不存在', 404)

  if (userId === operatorId) throw createError('不能删除自己的账号', 400)

  if (user.role === 'admin') {
    const [[{ cnt }]] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin' AND status = 1",
    )
    if (cnt <= 1) throw createError('无法删除唯一的管理员账号', 400)
  }

  // 检查是否是进行中任务的负责人
  if (user.staff_id) {
    const [[{ taskCnt }]] = await pool.query(
      `SELECT COUNT(*) AS taskCnt FROM tasks
        WHERE owner_id = ? AND status IN ('pending','in_progress')`,
      [user.staff_id],
    )
    if (taskCnt > 0) {
      throw createError(
        `该账号关联人员还有 ${taskCnt} 条未完成任务，请先转移负责人后再删除`,
        400,
      )
    }
  }

  await pool.query('UPDATE users SET status = 0 WHERE user_id = ?', [userId])
}

// ─── 密码管理 ─────────────────────────────────────────────────────────────────

/**
 * 管理员重置密码：不需要旧密码，可指定或随机生成
 * @returns {string} 实际生效的明文密码（仅此次返回，请提示用户保存）
 */
async function resetPassword(userId, newPassword) {
  const user = await getUserById(userId)
  if (!user) throw createError('用户不存在', 404)

  const plain = newPassword || generateRandomPassword()
  const hashed = await hashPassword(plain)
  await pool.query(
    'UPDATE users SET password = ?, login_attempts = 0, lock_until = NULL WHERE user_id = ?',
    [hashed, userId],
  )
  return plain
}

/**
 * 用户修改自己的密码：需要验证旧密码
 */
async function changePassword(userId, oldPassword, newPassword) {
  if (oldPassword === newPassword) throw createError('新密码不能与原密码相同', 400)

  const [rows] = await pool.query(
    'SELECT password FROM users WHERE user_id = ? AND status = 1', [userId],
  )
  if (!rows.length) throw createError('用户不存在或已被禁用', 404)

  const match = await verifyPassword(oldPassword, rows[0].password)
  if (!match) throw createError('原密码不正确', 401)

  const hashed = await hashPassword(newPassword)
  await pool.query('UPDATE users SET password = ? WHERE user_id = ?', [hashed, userId])
}

/**
 * 解锁被锁定的账号
 */
async function unlockUser(userId) {
  const user = await getUserById(userId)
  if (!user) throw createError('用户不存在', 404)
  await pool.query(
    'UPDATE users SET login_attempts = 0, lock_until = NULL WHERE user_id = ?',
    [userId],
  )
}

module.exports = {
  getUserList, getUserById,
  createUser, createUserForStaff,
  updateUser, deleteUser,
  resetPassword, changePassword, unlockUser,
  DEFAULT_PASSWORD, generateRandomPassword,
}
