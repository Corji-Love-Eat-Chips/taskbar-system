const { Router } = require('express')
const { body, query } = require('express-validator')
const ctrl = require('../controllers/staffController')
const { requireAuth, requireAdmin } = require('../middlewares/auth')
const { uploadExcel } = require('../middlewares/uploadExcel')

const router = Router()

// 所有人员接口需登录
router.use(requireAuth)

// ─── 固定路径（须在 /:id 系列之前注册）────────────────────────────────────────

/** GET /api/staff/all  下拉选项 */
router.get('/all', ctrl.listAll)

/** POST /api/staff/import  批量导入 Excel */
router.post('/import', requireAdmin, uploadExcel.single('file'), ctrl.importExcel)

// ─── 列表 / 详情 ──────────────────────────────────────────────────────────────

/** GET /api/staff */
router.get('/', ctrl.list)

/** GET /api/staff/:id */
router.get('/:id', ctrl.detail)

// ─── 新增 ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/staff  — 仅管理员
 */
router.post(
  '/',
  requireAdmin,
  [
    body('staffCode')
      .trim().notEmpty().withMessage('工号不能为空')
      .isLength({ max: 20 }).withMessage('工号最长 20 字符'),
    body('name')
      .trim().notEmpty().withMessage('姓名不能为空')
      .isLength({ max: 50 }).withMessage('姓名最长 50 字符'),
    body('department')
      .trim().notEmpty().withMessage('部门不能为空')
      .isLength({ max: 50 }).withMessage('部门最长 50 字符'),
    body('gender')
      .optional({ checkFalsy: true })
      .isIn(['male', 'female']).withMessage('性别值无效（male/female）'),
    body('position')
      .optional({ checkFalsy: true })
      .isLength({ max: 50 }).withMessage('职位最长 50 字符'),
    body('phone')
      .optional({ checkFalsy: true })
      .isMobilePhone('zh-CN').withMessage('手机号格式不正确'),
    body('email')
      .optional({ checkFalsy: true })
      .isEmail().withMessage('邮箱格式不正确'),
  ],
  ctrl.create,
)

// ─── 更新 ─────────────────────────────────────────────────────────────────────

/**
 * PUT /api/staff/:id  — 仅管理员
 */
router.put(
  '/:id',
  requireAdmin,
  [
    body('name')
      .optional()
      .trim().notEmpty().withMessage('姓名不能为空')
      .isLength({ max: 50 }).withMessage('姓名最长 50 字符'),
    body('department')
      .optional()
      .trim().notEmpty().withMessage('部门不能为空')
      .isLength({ max: 50 }).withMessage('部门最长 50 字符'),
    body('gender')
      .optional({ checkFalsy: true })
      .isIn(['male', 'female']).withMessage('性别值无效（male/female）'),
    body('position')
      .optional({ checkFalsy: true })
      .isLength({ max: 50 }).withMessage('职位最长 50 字符'),
    body('phone')
      .optional({ checkFalsy: true })
      .isMobilePhone('zh-CN').withMessage('手机号格式不正确'),
    body('email')
      .optional({ checkFalsy: true })
      .isEmail().withMessage('邮箱格式不正确'),
    body('status')
      .optional()
      .isIn(['active', 'disabled', 'left']).withMessage('状态值无效（active/disabled/left）'),
  ],
  ctrl.update,
)

// ─── 删除 ─────────────────────────────────────────────────────────────────────

/**
 * DELETE /api/staff/:id  — 仅管理员（软删除）
 * 有未完成任务或即将召开/进行中会议时返回 400
 */
router.delete('/:id', requireAdmin, ctrl.remove)

// ─── 创建账号 ─────────────────────────────────────────────────────────────────

/**
 * POST /api/staff/:id/create-user  — 仅管理员
 */
router.post(
  '/:id/create-user',
  requireAdmin,
  [
    body('username')
      .trim().notEmpty().withMessage('用户名不能为空')
      .isLength({ min: 3, max: 50 }).withMessage('用户名长度 3-50 字符')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('用户名只能包含字母、数字和下划线'),
    body('role')
      .optional()
      .isIn(['admin', 'teacher', 'leader']).withMessage('角色值无效'),
    body('password')
      .optional({ checkFalsy: true })
      .isLength({ min: 6 }).withMessage('密码至少 6 位'),
  ],
  ctrl.createUser,
)

module.exports = router
