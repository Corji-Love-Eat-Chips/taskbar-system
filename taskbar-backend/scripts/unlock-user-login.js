#!/usr/bin/env node
/**
 * 解除登录锁定：将 login_attempts 清零并清除 lock_until（连续输错密码触发）。
 *
 * 用法（在 taskbar-backend 目录）：
 *   node scripts/unlock-user-login.js T1001
 *
 * 或：
 *   UNLOCK_USERNAME=T1001 node scripts/unlock-user-login.js
 */

require('dotenv').config()
const mysql = require('mysql2/promise')

async function main() {
  const username = (process.argv[2] || process.env.UNLOCK_USERNAME || '').trim()
  if (!username) {
    console.error('请指定用户名，例如：node scripts/unlock-user-login.js T1001')
    process.exit(1)
  }

  const pool = await mysql.createPool({
    host:     process.env.DB_HOST || 'localhost',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME   || 'taskbar_db',
  })

  const [res] = await pool.query(
    `UPDATE users
        SET login_attempts = 0,
            lock_until = NULL
      WHERE username = ?`,
    [username],
  )

  await pool.end()

  if (res.affectedRows === 0) {
    console.error(`[未找到] users 表中没有 username = "${username}" 的记录。`)
    process.exit(1)
  }

  console.log(`[已解锁] "${username}" 的失败次数已清零，锁定已解除，可重新登录。`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
