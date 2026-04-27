/**
 * taskService.js
 * 任务管理业务逻辑
 *
 * 涉及表：tasks、task_collaborators、task_co_leads、task_auxiliary_owners、staff、periods
 */

const pool = require('../config/database')
const { createError } = require('../utils/response')
const {
  TASK_CATEGORIES,
  sheetToRecords,
  cellToYMD,
  normalizePriority,
  splitStaffCodes,
} = require('../utils/excelImport')

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return null
  if (typeof d === 'string') return d.slice(0, 10)
  return d.toISOString().slice(0, 10)
}

/**
 * 生成任务编号  RW-YYYYMMDD-NNN
 * 取当天已有最大序号 +1，三位补零
 */
async function genTaskNo(conn) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `RW-${today}-`
  const [[row]] = await conn.query(
    `SELECT task_no FROM tasks
      WHERE task_no LIKE ? ORDER BY task_no DESC LIMIT 1`,
    [`${prefix}%`],
  )
  const seq = row ? parseInt(row.task_no.split('-')[2], 10) + 1 : 1
  return `${prefix}${String(seq).padStart(3, '0')}`
}

/** 格式化任务行（日期 → 字符串） */
function fmtTask(row) {
  return {
    ...row,
    start_date: fmtDate(row.start_date),
    end_date:   fmtDate(row.end_date),
  }
}

// ─── 查询协助人（内部公用）────────────────────────────────────────────────────
async function fetchCollaborators(taskId) {
  const [rows] = await pool.query(
    `SELECT tc.staff_id, s.name
       FROM task_collaborators tc
       JOIN staff s ON s.staff_id = tc.staff_id
      WHERE tc.task_id = ?
      ORDER BY tc.id ASC`,
    [taskId],
  )
  return rows
}

function normalizeStaffIdArray(arr) {
  if (!Array.isArray(arr)) return []
  return [...new Set(arr.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
}

/** 主负责人、其他牵头、辅助负责人、协助人四者互斥 */
function assertResponsibleStaffDisjoint(ownerId, coLeadIds, auxIds, collabIds) {
  const owner = Number(ownerId)
  if (!Number.isInteger(owner) || owner < 1) return
  const co = normalizeStaffIdArray(coLeadIds)
  const aux = normalizeStaffIdArray(auxIds)
  const collab = normalizeStaffIdArray(collabIds)
  if (co.some((id) => id === owner)) {
    throw createError('其他牵头主理人不能包含主负责人', 400)
  }
  const leadSet = new Set([owner, ...co])
  for (const a of aux) {
    if (leadSet.has(a)) throw createError('辅助负责人不能与牵头主理人重复', 400)
  }
  const allLead = new Set([...leadSet, ...aux])
  for (const c of collab) {
    if (allLead.has(c)) throw createError('协助人员不能与负责人或辅助负责人重复', 400)
  }
}

async function fetchCoLeads(taskId) {
  const [rows] = await pool.query(
    `SELECT cl.staff_id, s.name
       FROM task_co_leads cl
       JOIN staff s ON s.staff_id = cl.staff_id
      WHERE cl.task_id = ?
      ORDER BY cl.sort_order ASC, cl.id ASC`,
    [taskId],
  )
  return rows
}

async function fetchAuxiliaryOwners(taskId) {
  const [rows] = await pool.query(
    `SELECT ax.staff_id, s.name
       FROM task_auxiliary_owners ax
       JOIN staff s ON s.staff_id = ax.staff_id
      WHERE ax.task_id = ?
      ORDER BY ax.sort_order ASC, ax.id ASC`,
    [taskId],
  )
  return rows
}

async function _setCoLeads(conn, taskId, staffIds) {
  const unique = normalizeStaffIdArray(staffIds)
  if (!unique.length) return
  const rows = unique.map((sid, i) => [taskId, sid, i])
  await conn.query(
    'INSERT INTO task_co_leads (task_id, staff_id, sort_order) VALUES ?',
    [rows],
  )
}

async function _setAuxiliaryOwners(conn, taskId, staffIds) {
  const unique = normalizeStaffIdArray(staffIds)
  if (!unique.length) return
  const rows = unique.map((sid, i) => [taskId, sid, i])
  await conn.query(
    'INSERT INTO task_auxiliary_owners (task_id, staff_id, sort_order) VALUES ?',
    [rows],
  )
}

// ─── 一、任务列表 ─────────────────────────────────────────────────────────────

/**
 * 分页查询任务列表，含协助人
 *
 * 权限（viewer）：
 * - admin / leader：查看全部任务
 * - teacher：仅本人负责或本人为协助人的任务
 *
 * @param {{
 *   period_id?: number,
 *   owner_id?: number,
 *   category?: string,
 *   status?: string,
 *   keyword?: string,
 *   page?: number,
 *   pageSize?: number,
 *   sort_by?: string,    // 白名单字段，见 SORT_COLUMNS
 *   sort_order?: 'asc' | 'desc',
 *   viewer?: { role: string, staffId: number|null }
 * }} params
 */
const SORT_COLUMNS = {
  period_name: 'p.period_name',
  task_name: 't.task_name',
  owner_name: 's.name',
  end_date: 't.end_date',
  start_date: 't.start_date',
  status: 't.status',
  progress: 't.progress',
  category: 't.category',
  task_id: 't.task_id',
}

function buildTaskListOrderBy(sort_by, sort_order) {
  const dir = sort_order === 'asc' ? 'ASC' : 'DESC'
  if (sort_by === 'priority') {
    return `ORDER BY FIELD(t.priority, 'low', 'medium', 'high') ${dir}, t.task_id DESC`
  }
  const col = SORT_COLUMNS[sort_by]
  if (!col) return 'ORDER BY t.task_id DESC'
  return `ORDER BY ${col} ${dir}, t.task_id DESC`
}

async function getTaskList({
  period_id, owner_id, category, status, keyword,
  page = 1, pageSize = 20,
  sort_by, sort_order,
  viewer = null,
} = {}) {
  const offset = (Number(page) - 1) * Number(pageSize)
  const cond = []; const vals = []

  // ── 角色可见范围（教师：主负责人 / 其他牵头 / 辅助负责人 / 协助人）──────────
  if (viewer && viewer.role === 'teacher') {
    const sid = viewer.staffId
    if (!sid) {
      cond.push('1 = 0')
    } else {
      cond.push(`(
        t.owner_id = ?
        OR EXISTS (SELECT 1 FROM task_co_leads cl WHERE cl.task_id = t.task_id AND cl.staff_id = ?)
        OR EXISTS (SELECT 1 FROM task_auxiliary_owners ax WHERE ax.task_id = t.task_id AND ax.staff_id = ?)
        OR EXISTS (
          SELECT 1 FROM task_collaborators tc
          WHERE tc.task_id = t.task_id AND tc.staff_id = ?
        )
      )`)
      vals.push(sid, sid, sid, sid)
    }
  }
  // admin / leader / 未传 viewer：不加额外条件（由路由层保证已登录）

  if (period_id) { cond.push('t.period_id = ?');        vals.push(Number(period_id)) }
  if (owner_id) {
    const oid = Number(owner_id)
    cond.push(`(
      t.owner_id = ?
      OR EXISTS (SELECT 1 FROM task_co_leads cl WHERE cl.task_id = t.task_id AND cl.staff_id = ?)
      OR EXISTS (SELECT 1 FROM task_auxiliary_owners ax WHERE ax.task_id = t.task_id AND ax.staff_id = ?)
    )`)
    vals.push(oid, oid, oid)
  }
  if (category)  { cond.push('t.category = ?');          vals.push(category) }
  if (status)    { cond.push('t.status = ?');             vals.push(status) }
  if (keyword)   { cond.push('t.task_name LIKE ?');       vals.push(`%${keyword}%`) }

  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : ''
  const orderSql = buildTaskListOrderBy(sort_by, sort_order)

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM tasks t ${where}`, vals,
  )

  const [rows] = await pool.query(
    `SELECT t.task_id, t.task_no, t.task_name,
            t.period_id, p.period_name,
            t.owner_id,  s.name AS owner_name,
            t.priority, t.category, t.status,
            t.progress, t.start_date, t.end_date, t.remarks,
            t.created_at, t.updated_at
       FROM tasks t
       LEFT JOIN periods p ON p.period_id = t.period_id
       LEFT JOIN staff   s ON s.staff_id  = t.owner_id
      ${where}
      ${orderSql}
      LIMIT ? OFFSET ?`,
    [...vals, Number(pageSize), offset],
  )

  // 批量查协助人 / 其他牵头 / 辅助负责人（IN 一次，避免 N+1）
  const taskIds = rows.map(r => r.task_id)
  let collabMap = {}
  let coLeadMap = {}
  let auxMap = {}
  if (taskIds.length) {
    const [collabs] = await pool.query(
      `SELECT tc.task_id, tc.staff_id, s.name
         FROM task_collaborators tc
         JOIN staff s ON s.staff_id = tc.staff_id
        WHERE tc.task_id IN (?)`,
      [taskIds],
    )
    for (const c of collabs) {
      if (!collabMap[c.task_id]) collabMap[c.task_id] = []
      collabMap[c.task_id].push({ staff_id: c.staff_id, name: c.name })
    }
    const [coLeads] = await pool.query(
      `SELECT cl.task_id, cl.staff_id, s.name
         FROM task_co_leads cl
         JOIN staff s ON s.staff_id = cl.staff_id
        WHERE cl.task_id IN (?)
        ORDER BY cl.task_id ASC, cl.sort_order ASC, cl.id ASC`,
      [taskIds],
    )
    for (const c of coLeads) {
      if (!coLeadMap[c.task_id]) coLeadMap[c.task_id] = []
      coLeadMap[c.task_id].push({ staff_id: c.staff_id, name: c.name })
    }
    const [auxRows] = await pool.query(
      `SELECT ax.task_id, ax.staff_id, s.name
         FROM task_auxiliary_owners ax
         JOIN staff s ON s.staff_id = ax.staff_id
        WHERE ax.task_id IN (?)
        ORDER BY ax.task_id ASC, ax.sort_order ASC, ax.id ASC`,
      [taskIds],
    )
    for (const a of auxRows) {
      if (!auxMap[a.task_id]) auxMap[a.task_id] = []
      auxMap[a.task_id].push({ staff_id: a.staff_id, name: a.name })
    }
  }

  const list = rows.map((r) => {
    const coList = coLeadMap[r.task_id] ?? []
    const auxList = auxMap[r.task_id] ?? []
    const collabList = collabMap[r.task_id] ?? []
    const leadNames = [r.owner_name, ...coList.map((x) => x.name)].filter(Boolean)
    const helperSeen = new Set()
    const helperLabels = []
    for (const x of [...auxList, ...collabList]) {
      if (!helperSeen.has(x.staff_id)) {
        helperSeen.add(x.staff_id)
        helperLabels.push(x.name)
      }
    }
    return {
      ...fmtTask(r),
      collaborators: collabList,
      co_leads: coList,
      auxiliary_owners: auxList,
      owners_display: leadNames.join('、') || '—',
      auxiliary_display: auxList.length ? auxList.map((x) => x.name).join('、') : '—',
      helpers_display: helperLabels.length ? helperLabels.join('、') : '—',
    }
  })

  return {
    list,
    pagination: {
      page:        Number(page),
      page_size:   Number(pageSize),
      total,
    },
  }
}

// ─── 二、任务详情 ─────────────────────────────────────────────────────────────

/**
 * 获取单个任务详情（含协助人）
 * @param {number} id  task_id
 */
async function getTaskById(id) {
  const [[row]] = await pool.query(
    `SELECT t.task_id, t.task_no, t.task_name,
            t.period_id, p.period_name,
            t.owner_id,  s.name AS owner_name,
            t.description, t.priority, t.category,
            t.status, t.progress,
            t.start_date, t.end_date, t.remarks,
            t.created_by, t.created_at, t.updated_at
       FROM tasks t
       LEFT JOIN periods p ON p.period_id = t.period_id
       LEFT JOIN staff   s ON s.staff_id  = t.owner_id
      WHERE t.task_id = ?`,
    [id],
  )
  if (!row) return null

  const [collaborators, co_leads, auxiliary_owners] = await Promise.all([
    fetchCollaborators(id),
    fetchCoLeads(id),
    fetchAuxiliaryOwners(id),
  ])
  const leadNames = [row.owner_name, ...co_leads.map((x) => x.name)].filter(Boolean)
  const helperSeen = new Set()
  const helperLabels = []
  for (const x of [...auxiliary_owners, ...collaborators]) {
    if (!helperSeen.has(x.staff_id)) {
      helperSeen.add(x.staff_id)
      helperLabels.push(x.name)
    }
  }
  return {
    ...fmtTask(row),
    collaborators,
    co_leads,
    auxiliary_owners,
    owners_display: leadNames.join('、') || '—',
    auxiliary_display: auxiliary_owners.length
      ? auxiliary_owners.map((x) => x.name).join('、')
      : '—',
    helpers_display: helperLabels.length ? helperLabels.join('、') : '—',
  }
}

// ─── 三、新增任务 ─────────────────────────────────────────────────────────────

/**
 * 新增任务（含协助人），事务操作
 * @param {{
 *   task_name: string,
 *   period_id?: number,
 *   owner_id: number,
 *   collaborator_ids?: number[],
 *   description?: string,
 *   priority?: string,
 *   category: string,
 *   start_date: string,
 *   end_date: string,
 *   remarks?: string
 * }} data
 * @param {number} createdBy  操作人 user_id
 */
async function createTask(data, createdBy) {
  const {
    task_name, period_id, owner_id, collaborator_ids = [],
    co_lead_ids = [], auxiliary_owner_ids = [],
    description, priority = 'medium', category,
    start_date, end_date, remarks,
  } = data

  if (new Date(start_date) > new Date(end_date)) {
    throw createError('开始日期不能晚于结束日期', 400)
  }

  const co = normalizeStaffIdArray(co_lead_ids)
  const aux = normalizeStaffIdArray(auxiliary_owner_ids)
  const collab = normalizeStaffIdArray(collaborator_ids)
  assertResponsibleStaffDisjoint(owner_id, co, aux, collab)

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const task_no = await genTaskNo(conn)

    const [result] = await conn.query(
      `INSERT INTO tasks
         (task_no, task_name, period_id, owner_id, description,
          priority, category, start_date, end_date, remarks, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [task_no, task_name.trim(), period_id || null, owner_id,
       description || null, priority, category,
       start_date, end_date, remarks || null, createdBy],
    )

    const taskId = result.insertId

    if (co.length) await _setCoLeads(conn, taskId, co)
    if (aux.length) await _setAuxiliaryOwners(conn, taskId, aux)
    if (collab.length) await _setCollaborators(conn, taskId, collab)

    await conn.commit()
    return getTaskById(taskId)
  } catch (e) {
    await conn.rollback(); throw e
  } finally {
    conn.release()
  }
}

// ─── 四、更新任务 ─────────────────────────────────────────────────────────────

/**
 * 更新任务（支持部分更新；collaborator_ids 传入则整体替换）
 * @param {number} id
 * @param {object} data
 */
async function updateTask(id, data) {
  const existing = await getTaskById(id)
  if (!existing) throw createError('任务不存在', 404)

  const nextOwner = data.owner_id !== undefined ? data.owner_id : existing.owner_id
  const nextCo = data.co_lead_ids !== undefined
    ? normalizeStaffIdArray(data.co_lead_ids)
    : (existing.co_leads || []).map((c) => c.staff_id)
  const nextAux = data.auxiliary_owner_ids !== undefined
    ? normalizeStaffIdArray(data.auxiliary_owner_ids)
    : (existing.auxiliary_owners || []).map((c) => c.staff_id)
  const nextCollab = data.collaborator_ids !== undefined
    ? normalizeStaffIdArray(data.collaborator_ids)
    : (existing.collaborators || []).map((c) => c.staff_id)
  assertResponsibleStaffDisjoint(nextOwner, nextCo, nextAux, nextCollab)

  // 校验进度范围
  if (data.progress != null) {
    const p = Number(data.progress)
    if (p < 0 || p > 100) throw createError('进度必须在 0-100 之间', 400)
  }

  // 日期合法性
  const sd = data.start_date ?? existing.start_date
  const ed = data.end_date   ?? existing.end_date
  if (new Date(sd) > new Date(ed)) {
    throw createError('开始日期不能晚于结束日期', 400)
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 动态拼 SET
    const sets = []; const vals = []
    const fields = ['task_name','period_id','owner_id','description',
                    'priority','category','status','progress',
                    'start_date','end_date','remarks']
    for (const f of fields) {
      if (data[f] !== undefined) {
        sets.push(`${f} = ?`)
        vals.push(data[f] === '' ? null : data[f])
      }
    }
    if (sets.length) {
      vals.push(id)
      await conn.query(`UPDATE tasks SET ${sets.join(', ')} WHERE task_id = ?`, vals)
    }

    // 协助人整体替换
    if (data.collaborator_ids !== undefined) {
      await conn.query('DELETE FROM task_collaborators WHERE task_id = ?', [id])
      if (nextCollab.length) await _setCollaborators(conn, id, nextCollab)
    }

    if (data.co_lead_ids !== undefined) {
      await conn.query('DELETE FROM task_co_leads WHERE task_id = ?', [id])
      if (nextCo.length) await _setCoLeads(conn, id, nextCo)
    }

    if (data.auxiliary_owner_ids !== undefined) {
      await conn.query('DELETE FROM task_auxiliary_owners WHERE task_id = ?', [id])
      if (nextAux.length) await _setAuxiliaryOwners(conn, id, nextAux)
    }

    await conn.commit()
    return getTaskById(id)
  } catch (e) {
    await conn.rollback(); throw e
  } finally {
    conn.release()
  }
}

// ─── 五、更新进度（轻量） ──────────────────────────────────────────────────────

async function updateTaskProgress(id, progress) {
  const p = Number(progress)
  if (p < 0 || p > 100) throw createError('进度必须在 0-100 之间', 400)

  const [[row]] = await pool.query(
    'SELECT task_id FROM tasks WHERE task_id = ?', [id],
  )
  if (!row) throw createError('任务不存在', 404)

  // 进度到 100 自动置为已完成
  const newStatus = p === 100 ? 'completed' : undefined
  const sql = newStatus
    ? 'UPDATE tasks SET progress = ?, status = ? WHERE task_id = ?'
    : 'UPDATE tasks SET progress = ? WHERE task_id = ?'
  const params = newStatus ? [p, newStatus, id] : [p, id]

  await pool.query(sql, params)
  return getTaskById(id)
}

// ─── 六、删除任务 ─────────────────────────────────────────────────────────────

/**
 * 删除任务（物理删除；级联删除协助人由 FK ON DELETE CASCADE 保证）
 * 已完成/取消任务可删，进行中任务也允许删（由调用方权限控制）
 */
async function deleteTask(id) {
  const [[row]] = await pool.query(
    'SELECT task_id, status FROM tasks WHERE task_id = ?', [id],
  )
  if (!row) throw createError('任务不存在', 404)

  // 检查是否有关联待办
  const [[{ cnt }]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM todos WHERE task_id = ? AND status = 0`, [id],
  )
  if (cnt > 0) {
    throw createError(`该任务下有 ${cnt} 条未完成待办，请先处理后再删除`, 400)
  }

  const taskFileService = require('./taskFileService')
  await taskFileService.purgeTaskFileStorageForTask(id)

  await pool.query('DELETE FROM tasks WHERE task_id = ?', [id])
}

// ─── 七、协助人子资源 ─────────────────────────────────────────────────────────

async function getCollaborators(taskId) {
  const [[task]] = await pool.query(
    'SELECT task_id FROM tasks WHERE task_id = ?', [taskId],
  )
  if (!task) throw createError('任务不存在', 404)
  return fetchCollaborators(taskId)
}

async function addCollaborator(taskId, staffId) {
  const [[task]] = await pool.query(
    'SELECT task_id FROM tasks WHERE task_id = ?', [taskId],
  )
  if (!task) throw createError('任务不存在', 404)

  const [[staff]] = await pool.query(
    'SELECT staff_id FROM staff WHERE staff_id = ?', [staffId],
  )
  if (!staff) throw createError('人员不存在', 404)

  // INSERT IGNORE 避免重复主键报错
  await pool.query(
    `INSERT IGNORE INTO task_collaborators (task_id, staff_id) VALUES (?,?)`,
    [taskId, staffId],
  )
  return fetchCollaborators(taskId)
}

async function removeCollaborator(taskId, staffId) {
  const [[task]] = await pool.query(
    'SELECT task_id FROM tasks WHERE task_id = ?', [taskId],
  )
  if (!task) throw createError('任务不存在', 404)

  await pool.query(
    'DELETE FROM task_collaborators WHERE task_id = ? AND staff_id = ?',
    [taskId, staffId],
  )
}

// ─── 私有：批量写入协助人 ──────────────────────────────────────────────────────
async function _setCollaborators(conn, taskId, staffIds) {
  const unique = [...new Set(staffIds.map(Number))]
  const rows   = unique.map(sid => [taskId, sid])
  await conn.query(
    'INSERT IGNORE INTO task_collaborators (task_id, staff_id) VALUES ?',
    [rows],
  )
}

// ─── 批量导入（Excel）──────────────────────────────────────────────────────────

const TASK_IMPORT_REQUIRED = ['任务名称', '负责人工号', '任务分类', '开始日期', '截止日期']

function isValidYMD(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T12:00:00`)
  return !Number.isNaN(d.getTime())
}

/**
 * @param {Buffer} buffer
 * @param {number} createdByUserId
 */
async function importTasksFromExcelBuffer(buffer, createdByUserId) {
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
  for (const col of TASK_IMPORT_REQUIRED) {
    if (!headerKeys.includes(col)) {
      return { ok: false, errors: [{ row: 1, message: `表头缺少必填列「${col}」` }] }
    }
  }

  const [staffRows] = await pool.query(
    'SELECT staff_id, staff_code FROM staff WHERE status = ?',
    ['active'],
  )
  const codeToId = new Map(staffRows.map((s) => [String(s.staff_code).trim(), s.staff_id]))

  const [periodRows] = await pool.query('SELECT period_id, period_name FROM periods')
  const periodNameToId = new Map(
    periodRows.map((p) => [String(p.period_name).trim(), p.period_id]),
  )

  const [existingTasks] = await pool.query('SELECT task_name FROM tasks')
  const existingNames = new Set(existingTasks.map((t) => String(t.task_name).trim()))

  /** @type {Array<{
   * excelRow: number, task_name: string, owner_id: number, period_id: number|null,
   * category: string, start_date: string, end_date: string, priority: string,
   * description: string|null, remarks: string|null, collaborator_ids: number[]
   * }>} */
  const normalized = []

  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    const excelRow = i + 2
    const taskName = String(r['任务名称'] ?? '').trim()
    const ownerCodes = splitStaffCodes(r['负责人工号'])
    const periodName = String(r['周期名称'] ?? '').trim()
    const category = String(r['任务分类'] ?? '').trim()
    const startRaw = r['开始日期']
    const endRaw = r['截止日期']
    const start_date = cellToYMD(startRaw)
    const end_date = cellToYMD(endRaw)
    const priCell = String(r['优先级'] ?? '').trim()
    const description = String(r['任务描述'] ?? '').trim() || null
    const remarks = String(r['备注'] ?? '').trim() || null
    const collabCodes = splitStaffCodes(r['协助人工号'])
    const coLeadCodes = headerKeys.includes('其他牵头工号')
      ? splitStaffCodes(r['其他牵头工号'])
      : []
    const auxCodes = headerKeys.includes('辅助负责人工号')
      ? splitStaffCodes(r['辅助负责人工号'])
      : []

    if (!taskName) errors.push({ row: excelRow, message: '任务名称不能为空' })
    else if (taskName.length > 100) errors.push({ row: excelRow, message: '任务名称最长 100 字' })

    if (!ownerCodes.length) {
      errors.push({ row: excelRow, message: '负责人工号不能为空（可填多个，用逗号或分号等分隔）' })
    } else {
      for (const cc of ownerCodes) {
        if (!codeToId.has(cc)) {
          errors.push({ row: excelRow, message: `负责人工号「${cc}」不存在或不是在职人员` })
        }
      }
    }

    let period_id = null
    if (periodName) {
      if (!periodNameToId.has(periodName)) {
        errors.push({ row: excelRow, message: `周期名称「${periodName}」在系统中不存在` })
      } else {
        period_id = periodNameToId.get(periodName)
      }
    }

    if (!category) errors.push({ row: excelRow, message: '任务分类不能为空' })
    else if (!TASK_CATEGORIES.includes(category)) {
      errors.push({
        row: excelRow,
        message: `任务分类须为以下之一：${TASK_CATEGORIES.join('、')}`,
      })
    }

    if (!start_date) errors.push({ row: excelRow, message: '开始日期不能为空或格式无效' })
    else if (!isValidYMD(start_date)) errors.push({ row: excelRow, message: `开始日期无效：${start_date}` })

    if (!end_date) errors.push({ row: excelRow, message: '截止日期不能为空或格式无效' })
    else if (!isValidYMD(end_date)) errors.push({ row: excelRow, message: `截止日期无效：${end_date}` })

    if (start_date && end_date && isValidYMD(start_date) && isValidYMD(end_date)) {
      if (new Date(start_date) > new Date(end_date)) {
        errors.push({ row: excelRow, message: '开始日期不能晚于截止日期' })
      }
    }

    let priority = 'medium'
    if (priCell) {
      const p = normalizePriority(r['优先级'])
      if (p == null) {
        errors.push({ row: excelRow, message: '优先级请填：高 / 中 / 低，或留空（默认中）' })
      } else {
        priority = p
      }
    }

    const owner_id = ownerCodes.length ? (codeToId.get(ownerCodes[0]) || 0) : 0
    const co_from_owner_cell = ownerCodes.slice(1).map((cc) => codeToId.get(cc)).filter(Boolean)
    const co_lead_ids = []
    for (const cc of coLeadCodes) {
      if (!codeToId.has(cc)) {
        errors.push({ row: excelRow, message: `其他牵头工号「${cc}」不存在或不是在职人员` })
      } else {
        co_lead_ids.push(codeToId.get(cc))
      }
    }
    const co_unique = [...new Set([...co_from_owner_cell, ...co_lead_ids])].filter((id) => id !== owner_id)
    const dupInOwner = new Set(ownerCodes.slice(1))
    if (ownerCodes.length > 1 && dupInOwner.has(ownerCodes[0])) {
      errors.push({ row: excelRow, message: '负责人工号列表中主负责人（第一项）不能重复出现在后续工号中' })
    }

    const auxiliary_owner_ids = []
    for (const cc of auxCodes) {
      if (!codeToId.has(cc)) {
        errors.push({ row: excelRow, message: `辅助负责人工号「${cc}」不存在或不是在职人员` })
      } else {
        auxiliary_owner_ids.push(codeToId.get(cc))
      }
    }
    const aux_unique = [...new Set(auxiliary_owner_ids)]
    const leadSet = new Set([owner_id, ...co_unique])
    for (const sid of aux_unique) {
      if (leadSet.has(sid)) {
        errors.push({ row: excelRow, message: '辅助负责人不能与牵头主理人重复' })
        break
      }
    }

    const collaborator_ids = []
    const auxSet = new Set(aux_unique)
    for (const cc of collabCodes) {
      if (!codeToId.has(cc)) {
        errors.push({ row: excelRow, message: `协助人工号「${cc}」不存在或不是在职人员` })
      } else {
        const sid = codeToId.get(cc)
        if (leadSet.has(sid)) {
          errors.push({ row: excelRow, message: `协助人工号「${cc}」不能与牵头主理人重复` })
        } else if (auxSet.has(sid)) {
          errors.push({ row: excelRow, message: `协助人工号「${cc}」不能与辅助负责人重复` })
        } else {
          collaborator_ids.push(sid)
        }
      }
    }

    try {
      assertResponsibleStaffDisjoint(owner_id, co_unique, aux_unique, collaborator_ids)
    } catch (e) {
      errors.push({ row: excelRow, message: e.message })
    }

    normalized.push({
      excelRow,
      task_name: taskName,
      owner_id,
      period_id,
      category,
      start_date,
      end_date,
      priority,
      description,
      remarks,
      co_lead_ids: co_unique,
      auxiliary_owner_ids: aux_unique,
      collaborator_ids,
    })
  }

  const nameToRows = new Map()
  for (const row of normalized) {
    if (!row.task_name) continue
    if (!nameToRows.has(row.task_name)) nameToRows.set(row.task_name, [])
    nameToRows.get(row.task_name).push(row.excelRow)
  }
  for (const [tname, rows] of nameToRows) {
    if (rows.length > 1) {
      for (const excelRow of rows) {
        errors.push({ row: excelRow, message: `表格内任务名称重复：「${tname}」` })
      }
    }
  }

  for (const row of normalized) {
    if (row.task_name && existingNames.has(row.task_name)) {
      errors.push({
        row: row.excelRow,
        message: `任务名称「${row.task_name}」已在系统中存在，不能重复导入`,
      })
    }
  }

  if (errors.length) return { ok: false, errors }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (const row of normalized) {
      const task_no = await genTaskNo(conn)
      const [result] = await conn.query(
        `INSERT INTO tasks
           (task_no, task_name, period_id, owner_id, description,
            priority, category, start_date, end_date, remarks, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [task_no, row.task_name, row.period_id || null, row.owner_id,
          row.description, row.priority, row.category,
          row.start_date, row.end_date, row.remarks, createdByUserId],
      )
      const taskId = result.insertId
      if (row.co_lead_ids.length) await _setCoLeads(conn, taskId, row.co_lead_ids)
      if (row.auxiliary_owner_ids.length) {
        await _setAuxiliaryOwners(conn, taskId, row.auxiliary_owner_ids)
      }
      if (row.collaborator_ids.length) {
        await _setCollaborators(conn, taskId, row.collaborator_ids)
      }
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
  getTaskList,
  getTaskById,
  createTask,
  updateTask,
  updateTaskProgress,
  deleteTask,
  getCollaborators,
  addCollaborator,
  removeCollaborator,
  importTasksFromExcelBuffer,
}
