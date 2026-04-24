/**
 * routes/reminders.js
 * 提醒接口  /api/reminders/*
 */

const { Router } = require('express')
const { param } = require('express-validator')
const ctrl = require('../controllers/reminderController')
const { requireAuth } = require('../middlewares/auth')
const { asyncHandler } = require('../utils/asyncHandler')

const router = Router()

router.use(requireAuth)

/** 获取当前用户待弹通知（前端每 30 秒轮询） */
router.get('/pending', asyncHandler(ctrl.pending))

/** 一键全部已读 */
router.post(
  '/acknowledge-all',
  asyncHandler(ctrl.acknowledgeAll),
)

/** 单条标记已读 */
router.post(
  '/:id/acknowledged',
  [param('id').isInt({ min: 1 }).withMessage('ID 必须为正整数')],
  asyncHandler(ctrl.acknowledged),
)

module.exports = router
