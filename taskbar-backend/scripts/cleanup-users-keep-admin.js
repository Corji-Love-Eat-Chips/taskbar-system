#!/usr/bin/env node
/**
 * 从 users 表物理删除除系统管理员（username = admin，不区分大小写）外的所有登录账号。
 * 不删除 staff；任务/会议中 created_by 会按外键置为 NULL（见 init_taskbar_db.sql）。
 *
 * 用法（在 taskbar-backend 目录）：
 *   node scripts/cleanup-users-keep-admin.js
 * 或指定库（覆盖 .env）：
 *   DB_NAME=taskbar_db node scripts/cleanup-users-keep-admin.js
 */

require('dotenv').config()
const mysql = require('mysql2/promise')

const ADMIN_USERNAME = 'admin'

async function main() {
  const pool = await mysql.createPool({
    host:     process.env.DB_HOST || 'localhost',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME   || 'taskbar_db',
  })

  const [[{ cnt: before }]] = await pool.query('SELECT COUNT(*) AS cnt FROM users')
  const [admins] = await pool.query(
    'SELECT user_id, username, role FROM users WHERE LOWER(TRIM(username)) = ?',
    [ADMIN_USERNAME],
  )
  if (!admins.length) {
    console.error('[错误] 未找到用户名 admin 的账号，已中止（避免误删全部用户）。')
    process.exit(1)
  }
  if (admins.length > 1) {
    console.warn('[提示] 存在多个 admin 大小写/空格变体，将只保留其中一条的删除逻辑请手工检查。')
  }

  const [res] = await pool.query('DELETE FROM users WHERE LOWER(TRIM(username)) <> ?', [ADMIN_USERNAME])
  const [[{ cnt: after }]] = await pool.query('SELECT COUNT(*) AS cnt FROM users')

  await pool.end()

  console.log(`[完成] 删除前: ${before} 个账号，删除: ${res.affectedRows} 个，当前剩余: ${after} 个（应为 1 个 admin）`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
