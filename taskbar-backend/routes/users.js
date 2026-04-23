const { Router } = require('express')
const { body } = require('express-validator')
const ctrl = require('../controllers/userController')
const { requireAuth, requireAdmin } = require('../middlewares/auth')

const router = Router()

// 所有接口需登录
router.use(requireAuth)

// ─── 查询 ─────────────────────────────────────────────────────────────────────

/** GET /api/users */
router.get('/', requireAdmin, ctrl.list)

/** GET /api/users/:id */
router.get('/:id', requireAdmin, ctrl.detail)

// ─── 新增 ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/users
 * 管理员直接建号（可选绑定 staff_id）
 */
router.post(
  '/',
  requireAdmin,
  [
    body('username')
      .trim()
      .notEmpty().withMessage('用户名不能为空')
      .isLength({ min: 3, max: 50 }).withMessage('用户名长度 3-50 字符')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('用户名只能包含字母、数字和下划线'),
    body('role')
      .optional()
      .isIn(['admin', 'teacher', 'leader']).withMessage('角色值无效'),
    body('password')
      .optional({ checkFalsy: true })
      .isLength({ min: 6 }).withMessage('密码至少 6 位'),
    body('staff_id')
      .optional({ nullable: true })
      .isInt({ min: 1 }).withMessage('staff_id 必须为正整数'),
  ],
  ctrl.create,
)

// ─── 密码管理（须在 /:id 系列之前注册，避免 "password" 被当作 id）───────────

/**
 * PUT /api/users/password  — 当前用户修改自己的密码
 */
router.put(
  '/password',
  [
    body('old_password').notEmpty().withMessage('原密码不能为空'),
    body('new_password')
      .notEmpty().withMessage('新密码不能为空')
      .isLength({ min: 6 }).withMessage('新密码至少 6 位'),
  ],
  ctrl.changePassword,
)

// ─── 更新 / 删除 / 解锁 / 重置密码（带 :id）─────────────────────────────────

/** PUT /api/users/:id */
router.put(
  '/:id',
  requireAdmin,
  [
    body('role')
      .optional()
      .isIn(['admin', 'teacher', 'leader']).withMessage('角色值无效'),
    body('status')
      .optional()
      .isIn([0, 1]).withMessage('状态值必须为 0 或 1'),
  ],
  ctrl.update,
)

/** DELETE /api/users/:id  — 软删除（status = 0） */
router.delete('/:id', requireAdmin, ctrl.remove)

/**
 * PUT /api/users/:id/password  — 管理员重置指定用户密码
 * new_password 可选；不传时自动生成随机密码
 */
router.put(
  '/:id/password',
  requireAdmin,
  [
    body('new_password')
      .optional({ checkFalsy: true })
      .isLength({ min: 6 }).withMessage('密码至少 6 位'),
  ],
  ctrl.resetPassword,
)

/** PATCH /api/users/:id/unlock  — 解除登录锁定 */
router.patch('/:id/unlock', requireAdmin, ctrl.unlock)

module.exports = router
