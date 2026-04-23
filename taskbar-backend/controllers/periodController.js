/**
 * periodController.js
 * 周期管理 HTTP 处理层
 */

const { validationResult } = require('express-validator')
const periodService = require('../services/periodService')
const { success, created, fail } = require('../utils/response')

// ─────────────────────────────────────────────────────────────────────────────
// 工具：统一提取校验错误
// ─────────────────────────────────────────────────────────────────────────────
function pickValidationErrors(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    fail(res, errors.array()[0].msg, 422)
    return true
  }
  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/periods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 获取周期列表
 * 查询参数：semester（可选，按学期筛选）
 */
async function list(req, res) {
  const { semester } = req.query
  const data = await periodService.getPeriodList({ semester })
  return success(res, data)
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/periods/:id
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 获取单个周期详情
 */
async function detail(req, res) {
  const period = await periodService.getPeriodById(Number(req.params.id))
  if (!period) return fail(res, '周期不存在', 404)
  return success(res, period)
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/periods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 新增周期（管理员）
 */
async function create(req, res) {
  if (pickValidationErrors(req, res)) return

  const { period_name, start_date, end_date, semester, sort_order } = req.body
  const period = await periodService.createPeriod({
    period_name, start_date, end_date, semester, sort_order,
  })
  return created(res, period, '周期创建成功')
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/periods/:id
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 更新周期（管理员）
 */
async function update(req, res) {
  if (pickValidationErrors(req, res)) return

  const { period_name, start_date, end_date, semester, sort_order } = req.body
  const period = await periodService.updatePeriod(
    Number(req.params.id),
    { period_name, start_date, end_date, semester, sort_order },
  )
  return success(res, period, '周期更新成功')
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/periods/:id
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 删除周期（管理员）
 */
async function remove(req, res) {
  await periodService.deletePeriod(Number(req.params.id))
  return success(res, null, '周期已删除')
}

module.exports = { list, detail, create, update, remove }
