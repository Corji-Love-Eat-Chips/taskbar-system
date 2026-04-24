/**
 * reminderService.js
 * 会议提醒定时任务 + 提醒记录管理
 *
 * 数据库依赖（首次运行时自动建表）：
 *
 *   CREATE TABLE IF NOT EXISTS meeting_reminders (
 *     id          INT PRIMARY KEY AUTO_INCREMENT,
 *     meeting_id  INT      NOT NULL,
 *     staff_id    INT      NOT NULL,
 *     remind_at   DATETIME NOT NULL,
 *     sent        TINYINT  NOT NULL DEFAULT 0,
 *     sent_at     DATETIME NULL,
 *     acked       TINYINT  NOT NULL DEFAULT 0,
 *     acked_at    DATETIME NULL,
 *     created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
 *     FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
 *     FOREIGN KEY (staff_id)   REFERENCES staff(staff_id)     ON DELETE CASCADE,
 *     UNIQUE KEY uk_remind_meeting_staff (meeting_id, staff_id)
 *   );
 */

const cron = require('node-cron')
const pool = require('../config/database')

// ── 常量：提醒设置 → 提前分钟数 ──────────────────────────────────────────────
const REMIND_MINUTES = {
  '15min': 15,
  '30min': 30,
  '1hour': 60,
  '1day':  24 * 60,
  'none':  null,
}

// ── 初始化：自动建表 ──────────────────────────────────────────────────────────

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_reminders (
      id          INT PRIMARY KEY AUTO_INCREMENT,
      meeting_id  INT      NOT NULL,
      staff_id    INT      NOT NULL,
      remind_at   DATETIME NOT NULL,
      sent        TINYINT  NOT NULL DEFAULT 0,
      sent_at     DATETIME NULL,
      acked       TINYINT  NOT NULL DEFAULT 0,
      acked_at    DATETIME NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
      FOREIGN KEY (staff_id)   REFERENCES staff(staff_id)     ON DELETE CASCADE,
      UNIQUE KEY uk_remind_meeting_staff (meeting_id, staff_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

// ── 核心：为某场会议（重新）生成提醒记录 ─────────────────────────────────────

/**
 * 当会议被新增或更新时调用，同步更新 meeting_reminders
 * @param {number}   meetingId
 * @param {string}   reminderSetting  '15min' | '30min' | '1hour' | '1day' | 'none'
 * @param {string}   startTime        YYYY-MM-DD HH:mm:ss
 * @param {number[]} staffIds         参会人员 staff_id 列表
 */
async function syncMeetingReminders(meetingId, reminderSetting, startTime, staffIds) {
  const minutes = REMIND_MINUTES[reminderSetting]

  // 先删除该会议的旧提醒
  await pool.query('DELETE FROM meeting_reminders WHERE meeting_id = ?', [meetingId])

  if (!minutes || !staffIds.length) return

  // 计算提醒时间
  const remindAt = new Date(new Date(startTime).getTime() - minutes * 60 * 1000)

  // 已超时不需要插入
  if (remindAt <= new Date()) return

  const values = staffIds.map(sid => [meetingId, sid, remindAt])
  await pool.query(
    `INSERT IGNORE INTO meeting_reminders (meeting_id, staff_id, remind_at)
     VALUES ?`,
    [values],
  )
}

// ── 核心：每分钟 cron 扫描 ───────────────────────────────────────────────────

/**
 * 扫描 remind_at 在当前时间窗口（±1 分钟）内且尚未发送的提醒，
 * 标记为 sent=1，并返回这批记录（供日志 / SSE 扩展）。
 */
async function scanAndMarkDue() {
  const now     = new Date()
  const future  = new Date(now.getTime() + 60 * 1000)  // 提前 1 分钟触发，避免跨分钟遗漏

  const [rows] = await pool.query(
    `SELECT mr.id, mr.meeting_id, mr.staff_id, mr.remind_at,
            m.meeting_name, m.start_time, m.location,
            s.name AS staff_name
       FROM meeting_reminders mr
       JOIN meetings m ON m.meeting_id = mr.meeting_id
       JOIN staff    s ON s.staff_id   = mr.staff_id
      WHERE mr.sent = 0
        AND mr.remind_at <= ?
        AND m.status NOT IN ('cancelled', 'ended')`,
    [future],
  )

  if (!rows.length) return []

  const ids = rows.map(r => r.id)
  await pool.query(
    `UPDATE meeting_reminders
        SET sent = 1, sent_at = NOW()
      WHERE id IN (?)`,
    [ids],
  )

  return rows
}

// ── 查询：某用户待确认的提醒（前端轮询）────────────────────────────────────

/**
 * 返回指定 staffId 的 sent=1 且 acked=0 的提醒列表
 * @param {number} staffId
 */
async function getPendingReminders(staffId) {
  const [rows] = await pool.query(
    `SELECT mr.id, mr.meeting_id, mr.remind_at, mr.sent_at,
            m.meeting_name, m.start_time, m.end_time, m.location,
            m.meeting_type,
            TIMESTAMPDIFF(MINUTE, NOW(), m.start_time) AS minutes_until_start
       FROM meeting_reminders mr
       JOIN meetings m ON m.meeting_id = mr.meeting_id
      WHERE mr.staff_id = ?
        AND mr.sent     = 1
        AND mr.acked    = 0
        AND m.status NOT IN ('cancelled', 'ended')
      ORDER BY mr.remind_at ASC`,
    [staffId],
  )

  return rows.map(r => ({
    id:                   r.id,
    meeting_id:           r.meeting_id,
    type:                 'meeting',
    title:                '会议提醒',
    body:                 buildReminderBody(r),
    meeting_name:         r.meeting_name,
    start_time:           fmtDt(r.start_time),
    end_time:             fmtDt(r.end_time),
    location:             r.location,
    meeting_type:         r.meeting_type,
    minutes_until_start:  r.minutes_until_start,
    sent_at:              fmtDt(r.sent_at),
  }))
}

function buildReminderBody(row) {
  const min = row.minutes_until_start
  let timeStr
  if (min <= 0)       timeStr = '即将开始'
  else if (min < 60)  timeStr = `将在 ${min} 分钟后开始`
  else if (min < 120) timeStr = `将在约 1 小时后开始`
  else                timeStr = `将在约 ${Math.round(min / 60)} 小时后开始`

  return `${row.meeting_name} ${timeStr}${row.location ? `，地点：${row.location}` : ''}`
}

// ── 标记已确认 ───────────────────────────────────────────────────────────────

/**
 * 前端弹出通知后调用，标记该提醒为已确认
 * @param {number} id       meeting_reminders.id
 * @param {number} staffId  用于鉴权，只能标记自己的提醒
 */
async function acknowledgeReminder(id, staffId) {
  const [[row]] = await pool.query(
    'SELECT id FROM meeting_reminders WHERE id = ? AND staff_id = ?',
    [id, staffId],
  )
  if (!row) {
    const { createError } = require('../utils/response')
    throw createError('提醒记录不存在或无权操作', 404)
  }

  await pool.query(
    `UPDATE meeting_reminders SET acked = 1, acked_at = NOW() WHERE id = ?`,
    [id],
  )
}

// ── 批量标记已确认 ────────────────────────────────────────────────────────────
async function acknowledgeAll(staffId) {
  await pool.query(
    `UPDATE meeting_reminders SET acked = 1, acked_at = NOW()
      WHERE staff_id = ? AND acked = 0`,
    [staffId],
  )
}

// ── 工具 ──────────────────────────────────────────────────────────────────────
function fmtDt(d) {
  if (!d) return null
  if (typeof d === 'string') return d.slice(0, 19).replace('T', ' ')
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

// ═══════════════════════════════════════════════════════════════════════════════
// 启动 cron 定时任务
// ═══════════════════════════════════════════════════════════════════════════════

let cronJob = null

/**
 * 启动提醒扫描任务（由 app.js 调用）
 * 每分钟执行一次：* * * * *
 */
async function startReminderCron() {
  try {
    await ensureTable()
    console.log('[reminder] 数据表检查完毕')
  } catch (err) {
    console.error('[reminder] 建表失败，cron 不启动:', err.message)
    return
  }

  cronJob = cron.schedule('* * * * *', async () => {
    try {
      const due = await scanAndMarkDue()
      if (due.length) {
        console.log(`[reminder] 已标记 ${due.length} 条提醒为 sent`)
      }
    } catch (err) {
      console.error('[reminder] cron 执行出错:', err.message)
    }
  })

  console.log('[reminder] 定时任务已启动（每分钟扫描）')
}

/**
 * 停止 cron（测试 / 优雅关闭时使用）
 */
function stopReminderCron() {
  cronJob?.stop()
}

module.exports = {
  startReminderCron,
  stopReminderCron,
  syncMeetingReminders,
  getPendingReminders,
  acknowledgeReminder,
  acknowledgeAll,
}
