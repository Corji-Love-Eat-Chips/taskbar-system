const mysql = require('mysql2/promise')

function createPool() {
  return mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'taskbar_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
    timezone: '+08:00',
  })
}

const pool = createPool()

/**
 * 应用启动时主动检测数据库连通性，失败则打印警告（不终止进程）
 */
async function testConnection() {
  let conn
  try {
    conn = await pool.getConnection()
    await conn.query('SELECT 1')
    console.log(`[DB] 连接成功：${process.env.DB_NAME || 'taskbar_db'}@${process.env.DB_HOST || 'localhost'}`)
  } catch (err) {
    console.error('[DB] 连接失败：', err.message)
    console.error('      请检查 .env 中 DB_* 配置及 MySQL 服务状态')
  } finally {
    if (conn) conn.release()
  }
}

module.exports = pool
module.exports.testConnection = testConnection
