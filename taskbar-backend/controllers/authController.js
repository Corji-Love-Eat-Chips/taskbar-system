const { validationResult } = require('express-validator')
const authService = require('../services/authService')
const { getSessionOptions, getSessionCookieClearOptions } = require('../config/session')
const { success, fail } = require('../utils/response')
const { asyncHandler } = require('../utils/asyncHandler')

/**
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res, next) => {
  // ── 1. 入参校验 ─────────────────────────────────────────────────────────────
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return fail(res, errors.array()[0].msg, 400)
  }

  const { username, password } = req.body

  // ── 2. 业务逻辑 ─────────────────────────────────────────────────────────────
  let userData
  try {
    userData = await authService.login(username, password)
  } catch (err) {
    return next(err)    // 交由 errorHandler 统一返回
  }

  // ── 3. 写入 Session ──────────────────────────────────────────────────────────
  req.session.userId  = userData.user_id
  req.session.role    = userData.role
  req.session.staffId = userData.staff_id

  return success(res, userData, '登录成功')
})

/**
 * POST /api/auth/logout
 * 1. 销毁服务端 Session
 * 2. 清除浏览器 Session Cookie（属性须与 express-session 一致）
 */
const logout = asyncHandler(async (req, res) => {
  const cookieName = getSessionOptions().name || 'taskbar.sid'
  const clearOpts = getSessionCookieClearOptions()

  const finish = () => {
    res.clearCookie(cookieName, clearOpts)
    return success(res, null, '登出成功')
  }

  if (!req.session) {
    return finish()
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('[logout] session destroy error:', err)
    }
    return finish()
  })
})

/**
 * GET /api/auth/current
 * 返回当前登录用户信息（Session 中有效时）
 */
const current = asyncHandler(async (req, res) => {
  if (!req.session || !req.session.userId) {
    return fail(res, '未登录或会话已过期', 401)
  }
  return success(res, {
    user_id: req.session.userId,
    role:    req.session.role,
    staff_id: req.session.staffId,
  })
})

module.exports = { login, logout, current }
