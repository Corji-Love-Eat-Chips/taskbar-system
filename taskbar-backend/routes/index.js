const { Router } = require('express')
const pool = require('../config/database')
const { asyncHandler } = require('../utils/asyncHandler')
const { success, fail } = require('../utils/response')

const authRoutes    = require('./auth')
const staffRoutes   = require('./staff')
const userRoutes    = require('./users')
const periodRoutes  = require('./periods')
const taskRoutes    = require('./tasks')

const router = Router()

// ─── 健康检查 ─────────────────────────────────────────────────────────────────
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    try {
      await pool.query('SELECT 1')
    } catch (err) {
      console.error('[health] database check failed:', err.message)
      return fail(res, '数据库不可用', 503)
    }
    return success(res, {
      service: 'taskbar-backend',
      env: process.env.NODE_ENV || 'development',
      database: 'connected',
    })
  }),
)

// ─── 子路由 ───────────────────────────────────────────────────────────────────
router.use('/auth',    authRoutes)
router.use('/staff',   staffRoutes)
router.use('/users',   userRoutes)
router.use('/periods', periodRoutes)
router.use('/tasks',   taskRoutes)

module.exports = router
