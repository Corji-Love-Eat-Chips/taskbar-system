/**
 * todoService.js
 * 待办事项业务逻辑
 *
 * 涉及表：todos、tasks、staff、users
 */

const pool = require('../config/database')
const { createError } = require('../utils/response')

// ─── 工具 ─────────────────────────────────────────────────────────────────────

/**
 * 将数据库行格式化为对外字段
 *  - 日期字段保留字符串
 *  - status 保持数字（0/1）
 */
function fmtTodo(row) {
  return {
    todo_id:       row.todo_id,
    todo_name:     row.todo_name,
    task_id:       row.task_id,
    task_name:     row.task_name    ?? null,   // JOIN 带出
    executor_id:   row.executor_id,
    executor_name: row.executor_name ?? null,
    priority:      row.priority,
    status:        row.status,                  // 0 | 1
    deadline:      row.deadline     ? fmtDt(row.deadline)      : null,
    reminder_time: row.reminder_time ? fmtDt(row.reminder_time) : null,
    completed_at:  row.completed_at  ? fmtDt(row.completed_at)  : null,
    remarks:       row.remarks       ?? null,
    sort_order:    row.sort_order    ?? 0,
    created_at:    fmtDt(row.created_at),
    updated_at:    fmtDt(row.updated_at),
  }
}

function fmtDt(d) {
  if (!d) return null
  if (typeof d === 'string') return d.slice(0, 19).replace('T', ' ')
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

// ─── 一、待办列表 ─────────────────────────────────────────────────────────────

/**
 * 查询待办列表（分页）
 *
 * 权限：
 *  - admin：可查所有人的待办
 *  - teacher / leader：只能查自己（executor_id = staffId）的待办
 *
 * @param {{
 *   task_id?:   number,
 *   status?:    0 | 1,
 *   priority?:  string,
 *   page?:      number,
 *   pageSize?:  number,
 *   viewer: { role: string, staffId: number|null }
 * }} params
 */
async function getTodoList({
  task_id, status, priority,
  page = 1, pageSize = 20,
  viewer,
} = {}) {
  const offset = (Number(page) - 1) * Number(pageSize)
  const cond = []; const vals = []

  // ── 权限过滤 ──────────────────────────────────────────────────────────────
  if (viewer.role !== 'admin') {
    if (!viewer.staffId) {
      // 无关联 staff，返回空
      return { list: [], pagination: { page: Number(page), page_size: Number(pageSize), total: 0 } }
    }
    cond.push('td.executor_id = ?')
    vals.push(viewer.staffId)
  }

  // ── 业务筛选 ──────────────────────────────────────────────────────────────
  if (task_id != null)  { cond.push('td.task_id = ?');   vals.push(Number(task_id)) }
  if (status  != null)  { cond.push('td.status  = ?');   vals.push(Number(status)) }
  if (priority)         { cond.push('td.priority = ?');  vals.push(priority) }

  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : ''

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM todos td ${where}`, vals,
  )

  const [rows] = await pool.query(
    `SELECT td.*,
            t.task_name,
            s.name AS executor_name
       FROM todos td
       LEFT JOIN tasks t ON t.task_id = td.task_id
       LEFT JOIN staff s ON s.staff_id = td.executor_id
      ${where}
      ORDER BY td.status ASC, td.sort_order ASC, td.created_at DESC
      LIMIT ? OFFSET ?`,
    [...vals, Number(pageSize), offset],
  )

  return {
    list: rows.map(fmtTodo),
    pagination: {
      page:      Number(page),
      page_size: Number(pageSize),
      total,
    },
  }
}

// ─── 二、待办详情 ─────────────────────────────────────────────────────────────

/**
 * 获取单条待办详情
 * @param {number} id  todo_id
 * @returns {object|null}
 */
async function getTodoById(id) {
  const [[row]] = await pool.query(
    `SELECT td.*,
            t.task_name,
            s.name AS executor_name
       FROM todos td
       LEFT JOIN tasks t ON t.task_id = td.task_id
       LEFT JOIN staff s ON s.staff_id = td.executor_id
      WHERE td.todo_id = ?`,
    [id],
  )
  return row ? fmtTodo(row) : null
}

// ─── 三、新增待办 ─────────────────────────────────────────────────────────────

/**
 * 新增待办
 * - executor_id 固定为当前登录用户对应的 staffId
 * - 若传 task_id，校验任务存在且用户有权操作（负责人/协助人/管理员）
 *
 * @param {{
 *   todo_name:     string,
 *   task_id?:      number,
 *   priority?:     string,
 *   deadline?:     string,
 *   reminder_time?: string,
 *   remarks?:      string,
 *   sort_order?:   number
 * }} data
 * @param {{ staffId: number, userId: number, role: string }} operator
 */
async function createTodo(data, operator) {
  const { todo_name, task_id, priority = 'normal',
          deadline, reminder_time, remarks, sort_order = 0 } = data

  if (!operator.staffId) {
    throw createError('当前账号未关联人员信息，无法创建待办', 403)
  }

  // 若关联任务，校验任务存在
  if (task_id != null) {
    const [[task]] = await pool.query(
      'SELECT task_id FROM tasks WHERE task_id = ?', [task_id],
    )
    if (!task) throw createError('关联的任务不存在', 404)
  }

  const [result] = await pool.query(
    `INSERT INTO todos
       (todo_name, task_id, executor_id, priority,
        status, deadline, reminder_time, remarks, sort_order)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    [
      todo_name.trim(),
      task_id  || null,
      operator.staffId,
      priority,
      deadline      || null,
      reminder_time || null,
      remarks       || null,
      sort_order,
    ],
  )

  return getTodoById(result.insertId)
}

// ─── 四、更新待办 ─────────────────────────────────────────────────────────────

/**
 * 更新待办（支持部分更新）
 * 权限：管理员 OR 本人（executor_id）
 *
 * @param {number} id
 * @param {object} data
 * @param {{ staffId: number, role: string }} operator
 */
async function updateTodo(id, data, operator) {
  const existing = await getTodoById(id)
  if (!existing) throw createError('待办不存在', 404)

  // 权限校验
  if (operator.role !== 'admin' && existing.executor_id !== operator.staffId) {
    throw createError('无权修改他人的待办', 403)
  }

  const sets = []; const vals = []
  const updatableFields = [
    'todo_name', 'task_id', 'priority',
    'deadline', 'reminder_time', 'remarks', 'sort_order',
  ]

  for (const f of updatableFields) {
    if (data[f] !== undefined) {
      sets.push(`${f} = ?`)
      vals.push(data[f] === '' ? null : data[f])
    }
  }

  if (!sets.length) return existing   // 无需更新

  vals.push(id)
  await pool.query(`UPDATE todos SET ${sets.join(', ')} WHERE todo_id = ?`, vals)
  return getTodoById(id)
}

// ─── 五、删除待办 ─────────────────────────────────────────────────────────────

/**
 * 删除待办
 * 权限：管理员 OR 本人（executor_id）
 *
 * @param {number} id
 * @param {{ staffId: number, role: string }} operator
 */
async function deleteTodo(id, operator) {
  const existing = await getTodoById(id)
  if (!existing) throw createError('待办不存在', 404)

  if (operator.role !== 'admin' && existing.executor_id !== operator.staffId) {
    throw createError('无权删除他人的待办', 403)
  }

  await pool.query('DELETE FROM todos WHERE todo_id = ?', [id])
}

// ─── 六、完成待办 ─────────────────────────────────────────────────────────────

/**
 * 将待办标记为已完成（status = 1，记录 completed_at）
 * 权限：管理员 OR 本人
 *
 * @param {number} id
 * @param {{ staffId: number, role: string }} operator
 */
async function completeTodo(id, operator) {
  const existing = await getTodoById(id)
  if (!existing) throw createError('待办不存在', 404)

  if (operator.role !== 'admin' && existing.executor_id !== operator.staffId) {
    throw createError('无权操作他人的待办', 403)
  }

  if (existing.status === 1) return existing   // 已经是完成状态，幂等返回

  await pool.query(
    'UPDATE todos SET status = 1, completed_at = NOW() WHERE todo_id = ?',
    [id],
  )
  return getTodoById(id)
}

// ─── 七、取消完成 ─────────────────────────────────────────────────────────────

/**
 * 将待办状态回退为未完成（status = 0，清空 completed_at）
 * 权限：管理员 OR 本人
 *
 * @param {number} id
 * @param {{ staffId: number, role: string }} operator
 */
async function uncompleteTodo(id, operator) {
  const existing = await getTodoById(id)
  if (!existing) throw createError('待办不存在', 404)

  if (operator.role !== 'admin' && existing.executor_id !== operator.staffId) {
    throw createError('无权操作他人的待办', 403)
  }

  if (existing.status === 0) return existing   // 已经是未完成，幂等返回

  await pool.query(
    'UPDATE todos SET status = 0, completed_at = NULL WHERE todo_id = ?',
    [id],
  )
  return getTodoById(id)
}

// ─── 八、toggle（兼容前端 PATCH /toggle 接口）────────────────────────────────

/**
 * 根据传入的目标 status 切换完成状态（兼容前端 toggleTodo API）
 * @param {number} id
 * @param {0 | 1} targetStatus
 * @param {{ staffId: number, role: string }} operator
 */
async function toggleTodo(id, targetStatus, operator) {
  return targetStatus === 1
    ? completeTodo(id, operator)
    : uncompleteTodo(id, operator)
}

// ─── 导出 ─────────────────────────────────────────────────────────────────────
module.exports = {
  getTodoList,
  getTodoById,
  createTodo,
  updateTodo,
  deleteTodo,
  completeTodo,
  uncompleteTodo,
  toggleTodo,
}
