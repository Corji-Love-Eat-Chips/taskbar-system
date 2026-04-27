const pool = require('../config/database')
const { createError } = require('../utils/response')
const {
  sheetToRecords,
  parseStaffImportContact,
  normalizeGender,
} = require('../utils/excelImport')

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
            s.status, s.created_at,
            (SELECT u.user_id FROM users u
              WHERE u.staff_id = s.staff_id
              LIMIT 1) AS user_id
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
    `SELECT COUNT(DISTINCT t.task_id) AS cnt FROM tasks t
      WHERE t.status NOT IN ('completed','cancelled')
        AND (
          t.owner_id = ?
          OR EXISTS (SELECT 1 FROM task_co_leads cl WHERE cl.task_id = t.task_id AND cl.staff_id = ?)
          OR EXISTS (SELECT 1 FROM task_auxiliary_owners ax WHERE ax.task_id = t.task_id AND ax.staff_id = ?)
          OR EXISTS (SELECT 1 FROM task_collaborators tc WHERE tc.task_id = t.task_id AND tc.staff_id = ?)
        )`,
    [staffId, staffId, staffId, staffId],
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

// ─── 批量导入（Excel）──────────────────────────────────────────────────────────

const STAFF_REQUIRED_COLS = ['工号', '姓名', '部门']

/**
 * 从 Excel 缓冲导入人员；全部校验通过后一次性写入。默认状态均为在职。
 * @param {Buffer} buffer
 * @returns {Promise<{ ok: true, imported: number } | { ok: false, errors: Array<{ row: number, message: string }> }>}
 */
async function importStaffFromExcelBuffer(buffer) {
  /** @type {Array<{ row: number, message: string }>} */
  const errors = []
  let records
  try {
    records = sheetToRecords(buffer)
  } catch (e) {
    return { ok: false, errors: [{ row: 0, message: `无法读取 Excel：${e.message}` }] }
  }
  if (!records.length) {
    return { ok: false, errors: [{ row: 0, message: '表格中没有数据行' }] }
  }
  const headerKeys = Object.keys(records[0])
  for (const col of STAFF_REQUIRED_COLS) {
    if (!headerKeys.includes(col)) {
      return { ok: false, errors: [{ row: 1, message: `表头缺少必填列「${col}」，请使用第一行作为列名` }] }
    }
  }

  /** @type {Array<{ excelRow: number, staffCode: string, name: string, department: string, position: string|null, gender: string|null, phone: string|null, email: string|null }>} */
  const normalized = []

  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    const excelRow = i + 2
    const staffCode = String(r['工号'] ?? '').trim()
    const name = String(r['姓名'] ?? '').trim()
    const department = String(r['部门'] ?? '').trim()
    const positionRaw = String(r['职位'] ?? '').trim()
    const position = positionRaw || null
    const genderVal = normalizeGender(r['性别'])
    const contact = parseStaffImportContact(r)

    if (!staffCode) errors.push({ row: excelRow, message: '工号不能为空' })
    else if (staffCode.length > 20) errors.push({ row: excelRow, message: '工号最长 20 字符' })

    if (!name) errors.push({ row: excelRow, message: '姓名不能为空' })
    else if (name.length > 50) errors.push({ row: excelRow, message: '姓名最长 50 字符' })

    if (!department) errors.push({ row: excelRow, message: '部门不能为空' })
    else if (department.length > 50) errors.push({ row: excelRow, message: '部门最长 50 字符' })

    if (position && position.length > 50) errors.push({ row: excelRow, message: '职位最长 50 字符' })

    const genderCell = r['性别']
    if (genderCell !== '' && genderCell != null && String(genderCell).trim() && !genderVal) {
      errors.push({ row: excelRow, message: '性别请填写：男 或 女（可留空）' })
    }

    if (contact.error) errors.push({ row: excelRow, message: contact.error })

    normalized.push({
      excelRow,
      staffCode,
      name,
      department,
      position,
      gender: genderVal || null,
      phone: contact.phone,
      email: contact.email,
    })
  }

  const codeToRows = new Map()
  for (const row of normalized) {
    if (!row.staffCode) continue
    if (!codeToRows.has(row.staffCode)) codeToRows.set(row.staffCode, [])
    codeToRows.get(row.staffCode).push(row.excelRow)
  }
  for (const [code, rows] of codeToRows) {
    if (rows.length > 1) {
      for (const excelRow of rows) {
        errors.push({ row: excelRow, message: `表格内工号「${code}」重复，请删除重复行` })
      }
    }
  }

  const uniqueCodes = [...codeToRows.keys()].filter(Boolean)
  if (uniqueCodes.length) {
    const [dbRows] = await pool.query(
      'SELECT staff_code FROM staff WHERE staff_code IN (?)',
      [uniqueCodes],
    )
    const existing = new Set(dbRows.map((x) => x.staff_code))
    for (const row of normalized) {
      if (row.staffCode && existing.has(row.staffCode)) {
        errors.push({
          row: row.excelRow,
          message: `工号「${row.staffCode}」已在系统中存在，无法重复导入`,
        })
      }
    }
  }

  if (errors.length) return { ok: false, errors }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (const row of normalized) {
      await conn.query(
        `INSERT INTO staff (staff_code, name, gender, department, position, phone, email, status)
         VALUES (?,?,?,?,?,?,?,'active')`,
        [row.staffCode, row.name, row.gender, row.department, row.position,
          row.phone, row.email],
      )
    }
    await conn.commit()
    return { ok: true, imported: normalized.length }
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
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
  importStaffFromExcelBuffer,
}
