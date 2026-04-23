const { validationResult } = require('express-validator')
const staffService = require('../services/staffService')
const userService  = require('../services/userService')
const { success, created, paginated, fail } = require('../utils/response')
const { asyncHandler } = require('../utils/asyncHandler')

// ─── 查询 ─────────────────────────────────────────────────────────────────────

/** GET /api/staff */
const list = asyncHandler(async (req, res) => {
  const { name, department, status, page, pageSize } = req.query
  const result = await staffService.getStaffList({ name, department, status, page, pageSize })
  return paginated(res, result.list, result.pagination)
})

/** GET /api/staff/all  下拉选项（不分页） */
const listAll = asyncHandler(async (req, res) => {
  const data = await staffService.getActiveStaffAll()
  return success(res, data)
})

/** GET /api/staff/:id */
const detail = asyncHandler(async (req, res) => {
  const staff = await staffService.getStaffById(Number(req.params.id))
  if (!staff) return fail(res, '人员不存在', 404)
  return success(res, staff)
})

// ─── 新增 ─────────────────────────────────────────────────────────────────────

/** POST /api/staff */
const create = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400)

  try {
    const staff = await staffService.createStaff(req.body)
    return created(res, staff, '人员创建成功')
  } catch (err) {
    return next(err)
  }
})

// ─── 更新 ─────────────────────────────────────────────────────────────────────

/** PUT /api/staff/:id */
const update = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400)

  try {
    const updated = await staffService.updateStaff(Number(req.params.id), req.body)
    return success(res, updated, '更新成功')
  } catch (err) {
    return next(err)
  }
})

// ─── 删除 ─────────────────────────────────────────────────────────────────────

/**
 * DELETE /api/staff/:id
 * 软删除：status = left，同时禁用关联账号
 * 有未完成任务或待开/进行中会议时拒绝
 */
const remove = asyncHandler(async (req, res, next) => {
  try {
    await staffService.deleteStaff(Number(req.params.id))
    return success(res, null, '人员已标记为离职，关联账号已禁用')
  } catch (err) {
    return next(err)
  }
})

// ─── 创建账号 ─────────────────────────────────────────────────────────────────

/**
 * POST /api/staff/:id/create-user
 * 为指定人员创建登录账号
 */
const createUser = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400)

  const staffId = Number(req.params.id)
  const staff = await staffService.getStaffById(staffId)
  if (!staff) return fail(res, '人员不存在', 404)
  if (staff.status === 'left') return fail(res, '离职人员不能创建账号', 400)

  try {
    const { user, plainPassword } = await userService.createUserForStaff(staffId, req.body)
    return created(res, {
      ...user,
      initial_password: plainPassword,
    }, `账号创建成功，请将初始密码告知用户：${plainPassword}`)
  } catch (err) {
    return next(err)
  }
})

module.exports = { list, listAll, detail, create, update, remove, createUser }
