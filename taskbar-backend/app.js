require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const morgan = require('morgan')

const db = require('./config/database')
const { createSessionMiddleware } = require('./config/session')
const { errorHandler } = require('./middlewares/errorHandler')
const { fail } = require('./utils/response')
const apiRoutes = require('./routes')

const app = express()
const PORT = Number(process.env.PORT) || 3000

// ─── 信任代理（Nginx 反代时 Session Cookie 的 secure 能正常工作）────────────
app.set('trust proxy', 1)

// ─── 安全头 ──────────────────────────────────────────────────────────────────
app.use(helmet())

// ─── CORS ────────────────────────────────────────────────────────────────────
// CORS_ORIGIN：前端来源，多个用逗号分隔；留空或未设置则动态允许（开发便利）
const rawOrigin = process.env.CORS_ORIGIN || ''
const corsOrigin = rawOrigin
  ? rawOrigin.split(',').map((o) => o.trim()).filter(Boolean)
  : true   // true = 回显请求来源，仅用于开发

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)

// ─── 响应压缩 ─────────────────────────────────────────────────────────────────
app.use(compression())

// ─── HTTP 日志 ────────────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// ─── 请求体解析 ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

// ─── Session ──────────────────────────────────────────────────────────────────
app.use(createSessionMiddleware())

// ─── 业务路由 ─────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes)

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  fail(res, `路由不存在：${req.method} ${req.originalUrl}`, 404)
})

// ─── 统一错误处理（必须在所有路由后）─────────────────────────────────────────
app.use(errorHandler)

// ─── 启动服务 + 数据库预检 ───────────────────────────────────────────────────
const server = app.listen(PORT, async () => {
  console.log(`taskbar-backend  →  http://localhost:${PORT}`)
  await db.testConnection()
})

// ─── 会议提醒等定时任务（启用后取消注释）────────────────────────────────────
// if (process.env.ENABLE_CRON === 'true') {
//   const cron = require('node-cron')
//   cron.schedule('*/5 * * * *', () => { /* 扫描待提醒会议 */ })
// }

module.exports = { app, server }
