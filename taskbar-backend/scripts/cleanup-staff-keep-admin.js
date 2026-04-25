#!/usr/bin/env node
/**
 * 人员表：物理删除除「系统管理员所绑定人员」外的所有 staff 行。
 * 系统管理员 = users 中 LOWER(username) = 'admin' 且必须存在 staff_id。
 *
 * 会按外键依赖顺序先清空：待办/共享、任务协助、任务、会议提醒（若存在表）、会议，
 * 再删除其余 staff。users.staff_id 对非保留行由 ON DELETE SET NULL 置空。
 *
 * 仅建议用于开发/测试库；生产环境请先备份。
 *
 * 用法（在 taskbar-backend 目录）：
 *   node scripts/cleanup-staff-keep-admin.js
 * 或： DB_NAME=taskbar_db node scripts/cleanup-staff-keep-admin.js
 *
 * 建议与账号清理一起使用（先删多余账号，再清人员，或只保留 admin 后执行本脚本）：
 *   npm run db:cleanup-users && npm run db:cleanup-staff
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

  const conn = await pool.getConnection()
  try {
    const [[{ cnt: before }]] = await conn.query('SELECT COUNT(*) AS cnt FROM staff')

    const [admins] = await conn.query(
      'SELECT user_id, username, staff_id FROM users WHERE LOWER(TRIM(username)) = ?',
      [ADMIN_USERNAME],
    )
    if (!admins.length) {
      console.error('[错误] 未找到用户名 admin 的账号，已中止。')
      process.exit(1)
    }
    const keepStaffId = admins[0].staff_id
    if (keepStaffId == null) {
      console.error('[错误] admin 未绑定 staff_id，无法确定保留哪一条人员记录，已中止。')
      process.exit(1)
    }

    await conn.beginTransaction()

    await conn.query('DELETE FROM todos')
    await conn.query('DELETE FROM task_collaborators')
    await conn.query('DELETE FROM tasks')

    try {
      await conn.query('DELETE FROM meeting_reminders')
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e
    }

    await conn.query('DELETE FROM meetings')

    const [del] = await conn.query('DELETE FROM staff WHERE staff_id <> ?', [keepStaffId])
    const [[{ cnt: after }]] = await conn.query('SELECT COUNT(*) AS cnt FROM staff')

    await conn.commit()

    console.log(
      `[完成] 保留 admin 绑定 staff_id=${keepStaffId}。删除前: ${before} 人，删除: ${del.affectedRows} 人，当前: ${after} 人。`,
    )
  } catch (e) {
    try {
      await conn.rollback()
    } catch {
      // ignore
    }
    throw e
  } finally {
    conn.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
