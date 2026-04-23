const { validationResult } = require('express-validator')
const userService = require('../services/userService')
const { success, created, paginated, fail } = require('../utils/response')
const { asyncHandler } = require('../utils/asyncHandler')

// ─── 查询 ─────────────────────────────────────────────────────────────────────

/** GET /api/users */
const list = asyncHandler(async (req, res) => {
  const { keyword, role, status, page, pageSize } = req.query
  const result = await userService.getUserList({ keyword, role, status, page, pageSize })
  return paginated(res, result.list, result.pagination)
})

/** GET /api/users/:id */
const detail = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(Number(req.params.id))
  if (!user) return fail(res, '用户不存在', 404)
  return success(res, user)
})

// ─── 新增 ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/users  — 管理员直接创建账号
 * POST /api/staff/:id/create-user  — 为指定人员创建账号（复用此 controller）
 */
const create = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400)

  // 来自 staff 路由时 req.params.id 为 staffId
  const staffId = req.params.id ? Number(req.params.id) : req.body.staff_id

  try {
    const { user, plainPassword } = staffId
      ? await userService.createUserForStaff(staffId, req.body)
      : await userService.createUser(req.body)

    return created(res, user, `账号创建成功，初始密码：${plainPassword}`)
  } catch (err) {
    return next(err)
  }
})

// ─── 更新 ─────────────────────────────────────────────────────────────────────

/** PUT /api/users/:id */
const update = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400)

  try {
    const user = await userService.updateUser(Number(req.params.id), req.body)
    return success(res, user, '更新成功')
  } catch (err) {
    return next(err)
  }
})

// ─── 软删除 ───────────────────────────────────────────────────────────────────

/** DELETE /api/users/:id */
const remove = asyncHandler(async (req, res, next) => {
  try {
    await userService.deleteUser(Number(req.params.id), req.currentUser.userId)
    return success(res, null, '账号已禁用')
  } catch (err) {
    return next(err)
  }
})

// ─── 密码管理 ─────────────────────────────────────────────────────────────────

/**
 * PUT /api/users/:id/password  — 管理员重置任意用户密码
 * new_password 可选；不传时自动生成随机密码
 */
const resetPassword = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400)

  try {
    const plain = await userService.resetPassword(
      Number(req.params.id),
      req.body.new_password || null,
    )
    return success(res, { new_password: plain }, '密码重置成功，请将新密码告知用户')
  } catch (err) {
    return next(err)
  }
})

/**
 * PUT /api/users/password  — 当前用户修改自己的密码
 */
const changePassword = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400)

  try {
    await userService.changePassword(
      req.currentUser.userId,
      req.body.old_password,
      req.body.new_password,
    )
    return success(res, null, '密码修改成功，请重新登录')
  } catch (err) {
    return next(err)
  }
})

/** PATCH /api/users/:id/unlock */
const unlock = asyncHandler(async (req, res, next) => {
  try {
    await userService.unlockUser(Number(req.params.id))
    return success(res, null, '账号已解锁')
  } catch (err) {
    return next(err)
  }
})

// 兼容旧调用（staff 路由中 createForStaff 使用 req.params.id）
const createForStaff = create

module.exports = {
  list, detail,
  create, createForStaff,
  update, remove,
  resetPassword, changePassword, unlock,
}
