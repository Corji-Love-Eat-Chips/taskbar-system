/**
 * taskService.js
 * 任务管理业务逻辑
 *
 * 涉及表：tasks、task_collaborators、staff、periods
 */

const pool = require('../config/database')
const { createError } = require('../utils/response')

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
 *   viewer?: { role: string, staffId: number|null }
 * }} params
 */
async function getTaskList({
  period_id, owner_id, category, status, keyword,
  page = 1, pageSize = 20,
  viewer = null,
} = {}) {
  const offset = (Number(page) - 1) * Number(pageSize)
  const cond = []; const vals = []

  // ── 角色可见范围（教师：负责人 OR 协助人）────────────────────────────────
  if (viewer && viewer.role === 'teacher') {
    const sid = viewer.staffId
    if (!sid) {
      cond.push('1 = 0')
    } else {
      cond.push(`(
        t.owner_id = ?
        OR EXISTS (
          SELECT 1 FROM task_collaborators tc
          WHERE tc.task_id = t.task_id AND tc.staff_id = ?
        )
      )`)
      vals.push(sid, sid)
    }
  }
  // admin / leader / 未传 viewer：不加额外条件（由路由层保证已登录）

  if (period_id) { cond.push('t.period_id = ?');        vals.push(Number(period_id)) }
  if (owner_id)  { cond.push('t.owner_id = ?');          vals.push(Number(owner_id)) }
  if (category)  { cond.push('t.category = ?');          vals.push(category) }
  if (status)    { cond.push('t.status = ?');             vals.push(status) }
  if (keyword)   { cond.push('t.task_name LIKE ?');       vals.push(`%${keyword}%`) }

  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : ''

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
      ORDER BY t.task_id DESC
      LIMIT ? OFFSET ?`,
    [...vals, Number(pageSize), offset],
  )

  // 批量查协助人（IN 一次查完，避免 N+1）
  const taskIds = rows.map(r => r.task_id)
  let collabMap = {}
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
  }

  const list = rows.map(r => ({
    ...fmtTask(r),
    collaborators: collabMap[r.task_id] ?? [],
  }))

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

  const collaborators = await fetchCollaborators(id)
  return { ...fmtTask(row), collaborators }
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
    description, priority = 'medium', category,
    start_date, end_date, remarks,
  } = data

  if (new Date(start_date) > new Date(end_date)) {
    throw createError('开始日期不能晚于结束日期', 400)
  }

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

    // 写入协助人
    if (collaborator_ids.length) {
      await _setCollaborators(conn, taskId, collaborator_ids)
    }

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
      if (data.collaborator_ids.length) {
        await _setCollaborators(conn, id, data.collaborator_ids)
      }
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
}
