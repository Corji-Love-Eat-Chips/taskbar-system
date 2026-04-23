/**
 * 执行 sql 目录下指定脚本（默认：init_taskbar_db.sql → 库名 taskbar_db）
 * 用法：
 *   npm run db:init
 *   node scripts/init-db.js init.sql
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

async function main() {
  const sqlFile = process.argv[2] || 'init_taskbar_db.sql'
  const sqlPath = path.join(__dirname, '..', 'sql', sqlFile)

  if (!fs.existsSync(sqlPath)) {
    console.error('找不到 SQL 文件:', sqlPath)
    process.exit(1)
  }

  const sql = fs.readFileSync(sqlPath, 'utf8')

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  })

  try {
    await conn.query(sql)
    console.log('数据库初始化完成：', sqlFile)
  } finally {
    await conn.end()
  }
}

main().catch((err) => {
  console.error('初始化失败:', err.message)
  process.exit(1)
})
