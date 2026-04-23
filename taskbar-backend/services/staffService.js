const pool = require('../config/database')
const { createError } = require('../utils/response')

// ─── 查询 ─────────────────────────────────────────────────────────────────────

/**
 * 分页查询人员列表，支持姓名模糊/部门精确/状态筛选
 */
async function getStaffList({ name, department, status, page = 1, pageSize = 20 } = {}) {
  const offset = (Number(page) - 1) * Number(pageSize)
  const cond = []; const params = []

  if (name)       { cond.push('s.name LIKE ?');      params.push(`%${name}%`) }
  if (department) { cond.push('s.department = ?');   params.push(department) }
  if (status)     { cond.push('s.status = ?');       params.push(status) }

  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : ''

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM staff s ${where}`, params,
  )
  const [list] = await pool.query(
    `SELECT s.staff_id, s.staff_code, s.name, s.gender,
            s.department, s.position, s.phone, s.email,
            s.status, s.created_at
       FROM staff s
      ${where}
      ORDER BY s.staff_id ASC
      LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), offset],
  )
  return { list, pagination: { page: Number(page), pageSize: Number(pageSize), total } }
}

/**
 * 全量在职人员（下拉选择，不分页）
 */
async function getActiveStaffAll() {
  const [rows] = await pool.query(
    `SELECT staff_id, staff_code, name, department, position
       FROM staff WHERE status = 'active'
      ORDER BY staff_id ASC`,
  )
  return rows
}

/**
 * 按 ID 查询人员详情（含关联账号摘要）
 */
async function getStaffById(staffId) {
  const [rows] = await pool.query(
    `SELECT s.staff_id, s.staff_code, s.name, s.gender,
            s.department, s.position, s.phone, s.email,
            s.status, s.created_at, s.updated_at,
            u.user_id, u.username, u.role, u.status AS user_status
       FROM staff s
       LEFT JOIN users u ON u.staff_id = s.staff_id
      WHERE s.staff_id = ?
      LIMIT 1`,
    [staffId],
  )
  return rows[0] || null
}

// ─── 新增 ─────────────────────────────────────────────────────────────────────

/**
 * 新增人员
 */
async function createStaff({ staffCode, name, gender, department, position, phone, email }) {
  const [[exists]] = await pool.query(
    'SELECT staff_id FROM staff WHERE staff_code = ?', [staffCode],
  )
  if (exists) throw createError(`工号 "${staffCode}" 已存在`, 409)

  const [result] = await pool.query(
    `INSERT INTO staff (staff_code, name, gender, department, position, phone, email, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
    [staffCode, name, gender || null, department, position || null,
     phone || null, email || null],
  )
  return getStaffById(result.insertId)
}

// ─── 更新 ─────────────────────────────────────────────────────────────────────

/**
 * 更新人员信息（逐字段）
 * - status 变为 left / disabled 时同步禁用关联账号（事务保证）
 */
async function updateStaff(staffId, fields) {
  const staff = await getStaffById(staffId)
  if (!staff) throw createError('人员不存在', 404)

  const allowed = ['name', 'gender', 'department', 'position', 'phone', 'email', 'status']
  const sets = []; const params = []
  for (const key of allowed) {
    if (fields[key] !== undefined) { sets.push(`${key} = ?`); params.push(fields[key]) }
  }
  if (!sets.length) throw createError('未传入可更新的字段', 400)

  const needDisableUser =
    fields.status !== undefined &&
    fields.status !== 'active' &&
    staff.user_id

  if (needDisableUser) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query(`UPDATE staff SET ${sets.join(', ')} WHERE staff_id = ?`, [...params, staffId])
      await conn.query('UPDATE users SET status = 0 WHERE staff_id = ?', [staffId])
      await conn.commit()
    } catch (e) {
      await conn.rollback(); throw e
    } finally { conn.release() }
  } else {
    await pool.query(`UPDATE staff SET ${sets.join(', ')} WHERE staff_id = ?`, [...params, staffId])
  }

  return getStaffById(staffId)
}

// ─── 删除 ─────────────────────────────────────────────────────────────────────

/**
 * 检查是否有关联的有效任务
 * @returns {number} 任务数量
 */
async function countActiveTasks(staffId) {
  const [[{ cnt }]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM tasks
      WHERE owner_id = ?
        AND status NOT IN ('completed','cancelled')`,
    [staffId],
  )
  return cnt
}

/**
 * 检查是否有关联的有效会议（作为主持人或参会人）
 * @returns {number} 会议数量
 */
async function countActiveMeetings(staffId) {
  const [[{ cnt }]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM (
       SELECT m.meeting_id FROM meetings m
        WHERE m.host_id = ? AND m.status IN ('upcoming','ongoing')
        UNION
       SELECT mp.meeting_id FROM meeting_participants mp
         JOIN meetings m ON m.meeting_id = mp.meeting_id
        WHERE mp.staff_id = ? AND m.status IN ('upcoming','ongoing')
     ) t`,
    [staffId, staffId],
  )
  return cnt
}

/**
 * 删除人员（软删除：status = left）
 * - 有未完成任务或即将召开/进行中会议时拒绝
 * - 同步禁用关联账号（事务）
 */
async function deleteStaff(staffId) {
  const staff = await getStaffById(staffId)
  if (!staff) throw createError('人员不存在', 404)

  if (staff.status === 'left') throw createError('该人员已处于离职状态', 400)

  const taskCnt = await countActiveTasks(staffId)
  if (taskCnt > 0) {
    throw createError(
      `该人员仍有 ${taskCnt} 条未完成任务，请先完成或转移后再操作`,
      400,
    )
  }

  const meetingCnt = await countActiveMeetings(staffId)
  if (meetingCnt > 0) {
    throw createError(
      `该人员还有 ${meetingCnt} 场即将召开或进行中的会议，请先处理后再操作`,
      400,
    )
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query("UPDATE staff SET status = 'left' WHERE staff_id = ?", [staffId])
    if (staff.user_id) {
      await conn.query('UPDATE users SET status = 0 WHERE staff_id = ?', [staffId])
    }
    await conn.commit()
  } catch (e) {
    await conn.rollback(); throw e
  } finally { conn.release() }
}

module.exports = {
  getStaffList,
  getActiveStaffAll,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  countActiveTasks,
  countActiveMeetings,
}
