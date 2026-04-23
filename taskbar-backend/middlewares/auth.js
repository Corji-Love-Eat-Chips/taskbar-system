const { fail } = require('../utils/response')

/**
 * 要求已登录（Session 中存在 userId）
 * 通过后在 req.currentUser 上注入 { userId, role, staffId }
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    req.currentUser = {
      userId: req.session.userId,
      role: req.session.role,
      staffId: req.session.staffId,
    }
    return next()
  }
  return fail(res, '未登录或会话已过期', 401)
}

/**
 * 要求指定角色（须先经过 requireAuth）
 * @param {...string} roles 允许的角色列表，如 'admin', 'leader'
 * @example router.get('/manage', requireAuth, requireRole('admin'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.currentUser) return fail(res, '未登录或会话已过期', 401)
    if (roles.includes(req.currentUser.role)) return next()
    return fail(res, '权限不足', 403)
  }
}

/**
 * 仅管理员可操作的快捷中间件
 */
const requireAdmin = requireRole('admin')

/**
 * 管理员或领导
 */
const requireAdminOrLeader = requireRole('admin', 'leader')

/**
 * 可选登录：不强制要求，但已登录时注入 currentUser
 */
function optionalAuth(req, res, next) {
  if (req.session && req.session.userId) {
    req.currentUser = {
      userId: req.session.userId,
      role: req.session.role,
      staffId: req.session.staffId,
    }
  }
  next()
}

module.exports = {
  requireAuth,
  requireRole,
  requireAdmin,
  requireAdminOrLeader,
  optionalAuth,
}
