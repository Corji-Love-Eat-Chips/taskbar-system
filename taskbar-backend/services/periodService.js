/**
 * periodService.js
 * 周期管理业务逻辑
 *
 * 表结构（periods）：
 *   period_id  INT  PK AUTO_INCREMENT
 *   period_name VARCHAR(50) NOT NULL
 *   start_date  DATE NOT NULL
 *   end_date    DATE NOT NULL
 *   semester    VARCHAR(50) NULL
 *   sort_order  INT DEFAULT 0
 *   created_at  DATETIME
 *   updated_at  DATETIME
 */

const pool = require('../config/database')
const { createError } = require('../utils/response')

// ─────────────────────────────────────────────────────────────────────────────
// 工具：将 DATE 列格式化为 YYYY-MM-DD 字符串
// ─────────────────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return null
  if (typeof d === 'string') return d.slice(0, 10)
  return d.toISOString().slice(0, 10)
}

function formatRow(row) {
  return {
    ...row,
    start_date: fmtDate(row.start_date),
    end_date:   fmtDate(row.end_date),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 一、查询
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 获取周期列表（支持按学期筛选，按 sort_order ASC 排序）
 * @param {{ semester?: string }} params
 * @returns {Promise<Array>}
 */
async function getPeriodList({ semester } = {}) {
  const cond = []; const vals = []

  if (semester) { cond.push('semester = ?'); vals.push(semester) }

  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : ''

  const [rows] = await pool.query(
    `SELECT period_id, period_name, start_date, end_date,
            semester, sort_order, created_at
       FROM periods
      ${where}
      ORDER BY sort_order ASC, period_id ASC`,
    vals,
  )

  return rows.map(formatRow)
}

/**
 * 通过 ID 获取单个周期
 * @param {number} id
 */
async function getPeriodById(id) {
  const [[row]] = await pool.query(
    `SELECT period_id, period_name, start_date, end_date,
            semester, sort_order, created_at, updated_at
       FROM periods WHERE period_id = ?`,
    [id],
  )
  return row ? formatRow(row) : null
}

// ─────────────────────────────────────────────────────────────────────────────
// 二、新增
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 新增周期
 *
 * 规则：
 *  1. period_name 在同一 semester 下不能重复（不同学期允许同名"第6周"）
 *  2. start_date 必须 < end_date
 *  3. sort_order 不传时自动取当前最大值 + 1
 *
 * @param {{
 *   period_name: string,
 *   start_date: string,
 *   end_date: string,
 *   semester?: string,
 *   sort_order?: number
 * }} data
 */
async function createPeriod({ period_name, start_date, end_date, semester, sort_order }) {
  // ① 日期合法性
  if (new Date(start_date) >= new Date(end_date)) {
    throw createError('开始日期必须早于结束日期', 400)
  }

  // ② 同学期内名称唯一
  await _checkNameUnique(period_name, semester)

  // ③ sort_order 自动计算
  const resolvedOrder = sort_order != null
    ? Number(sort_order)
    : await _nextSortOrder(semester)

  const [result] = await pool.query(
    `INSERT INTO periods (period_name, start_date, end_date, semester, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [period_name.trim(), start_date, end_date, semester || null, resolvedOrder],
  )

  return getPeriodById(result.insertId)
}

// ─────────────────────────────────────────────────────────────────────────────
// 三、更新
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 更新周期
 *
 * 允许修改字段：period_name / start_date / end_date / semester / sort_order
 * 只传需要改动的字段，其余保持原值
 *
 * @param {number} id
 * @param {{ period_name?, start_date?, end_date?, semester?, sort_order? }} data
 */
async function updatePeriod(id, data) {
  const existing = await getPeriodById(id)
  if (!existing) throw createError('周期不存在', 404)

  // 合并：未传字段保持数据库原值
  const merged = {
    period_name: data.period_name  != null ? data.period_name.trim() : existing.period_name,
    start_date:  data.start_date   != null ? data.start_date          : existing.start_date,
    end_date:    data.end_date     != null ? data.end_date             : existing.end_date,
    semester:    data.semester     !== undefined ? data.semester       : existing.semester,
    sort_order:  data.sort_order   != null ? Number(data.sort_order)   : existing.sort_order,
  }

  // ① 日期合法性
  if (new Date(merged.start_date) >= new Date(merged.end_date)) {
    throw createError('开始日期必须早于结束日期', 400)
  }

  // ② 名称唯一性（排除自身）
  if (data.period_name != null && data.period_name.trim() !== existing.period_name) {
    await _checkNameUnique(merged.period_name, merged.semester, id)
  }

  await pool.query(
    `UPDATE periods
        SET period_name = ?, start_date = ?, end_date = ?,
            semester = ?, sort_order = ?
      WHERE period_id = ?`,
    [merged.period_name, merged.start_date, merged.end_date,
     merged.semester, merged.sort_order, id],
  )

  return getPeriodById(id)
}

// ─────────────────────────────────────────────────────────────────────────────
// 四、删除
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 删除周期
 *
 * 规则：
 *  - 周期不存在 → 404
 *  - 有关联任务（tasks.period_id 指向该周期）→ 禁止删除
 *
 * @param {number} id
 */
async function deletePeriod(id) {
  const existing = await getPeriodById(id)
  if (!existing) throw createError('周期不存在', 404)

  // 检查关联任务
  const [[{ cnt }]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM tasks WHERE period_id = ?`,
    [id],
  )
  if (cnt > 0) {
    throw createError(`该周期下存在 ${cnt} 条任务，请先迁移或删除任务后再删除周期`, 400)
  }

  await pool.query('DELETE FROM periods WHERE period_id = ?', [id])
}

// ─────────────────────────────────────────────────────────────────────────────
// 私有工具
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 检查同学期内名称是否已被占用
 * @param {string} name
 * @param {string|null} semester
 * @param {number} [excludeId]   更新时排除自身
 */
async function _checkNameUnique(name, semester, excludeId) {
  let sql, vals

  if (semester) {
    sql = 'SELECT period_id FROM periods WHERE period_name = ? AND semester = ?'
    vals = [name.trim(), semester]
  } else {
    // 无学期时，全局检查（兼容历史数据）
    sql = 'SELECT period_id FROM periods WHERE period_name = ? AND semester IS NULL'
    vals = [name.trim()]
  }

  if (excludeId) {
    sql += ' AND period_id != ?'
    vals.push(excludeId)
  }

  const [[dup]] = await pool.query(sql, vals)
  if (dup) throw createError(`周期名称"${name}"在同一学期内已存在`, 400)
}

/**
 * 取同学期现有最大 sort_order + 1 作为新记录的 sort_order
 * @param {string|null} semester
 */
async function _nextSortOrder(semester) {
  let sql, vals
  if (semester) {
    sql = 'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM periods WHERE semester = ?'
    vals = [semester]
  } else {
    sql = 'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM periods'
    vals = []
  }
  const [[{ next }]] = await pool.query(sql, vals)
  return next
}

module.exports = {
  getPeriodList,
  getPeriodById,
  createPeriod,
  updatePeriod,
  deletePeriod,
}
