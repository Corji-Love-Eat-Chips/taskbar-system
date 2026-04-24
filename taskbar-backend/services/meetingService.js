/**
 * meetingService.js
 * 会议管理业务逻辑
 *
 * 涉及表：meetings、meeting_participants、staff、users
 */

const pool = require('../config/database')
const { createError } = require('../utils/response')
// 延迟引用（避免循环依赖）
function getReminderService() {
  return require('./reminderService')
}

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function fmtDt(d) {
  if (!d) return null
  if (typeof d === 'string') return d.slice(0, 19).replace('T', ' ')
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * 格式化会议行数据
 */
function fmtMeeting(row) {
  return {
    meeting_id:       row.meeting_id,
    meeting_no:       row.meeting_no,
    meeting_name:     row.meeting_name,
    meeting_type:     row.meeting_type,
    host_id:          row.host_id,
    host_name:        row.host_name        ?? null,
    start_time:       fmtDt(row.start_time),
    end_time:         fmtDt(row.end_time),
    location:         row.location,
    agenda:           row.agenda           ?? null,
    reminder_setting: row.reminder_setting,
    status:           row.status,
    minutes:          row.minutes          ?? null,
    created_by:       row.created_by       ?? null,
    created_at:       fmtDt(row.created_at),
    updated_at:       fmtDt(row.updated_at),
  }
}

/**
 * 生成会议编号  MT-YYYYMMDD-NNN
 * 取当天已有最大序号 +1，三位补零
 */
async function genMeetingNo(conn) {
  const today  = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `MT-${today}-`
  const [[row]] = await conn.query(
    `SELECT meeting_no FROM meetings
      WHERE meeting_no LIKE ? ORDER BY meeting_no DESC LIMIT 1`,
    [`${prefix}%`],
  )
  const seq = row ? parseInt(row.meeting_no.split('-')[2], 10) + 1 : 1
  return `${prefix}${String(seq).padStart(3, '0')}`
}

/**
 * 查询某会议的参会人员列表
 */
async function fetchParticipants(meetingId) {
  const [rows] = await pool.query(
    `SELECT mp.id, mp.staff_id, s.name, mp.confirmed, mp.confirmed_at
       FROM meeting_participants mp
       JOIN staff s ON s.staff_id = mp.staff_id
      WHERE mp.meeting_id = ?
      ORDER BY mp.id ASC`,
    [meetingId],
  )
  return rows.map(r => ({
    id:           r.id,
    staff_id:     r.staff_id,
    name:         r.name,
    confirmed:    r.confirmed,
    confirmed_at: fmtDt(r.confirmed_at),
  }))
}

// ─── 一、会议列表 ─────────────────────────────────────────────────────────────

/**
 * 分页查询会议列表
 *
 * @param {object} opts
 * @param {string} [opts.start_date]    - 开始日期筛选 YYYY-MM-DD
 * @param {string} [opts.end_date]      - 结束日期筛选 YYYY-MM-DD
 * @param {string} [opts.status]        - 状态筛选
 * @param {string} [opts.meeting_type]  - 会议类型筛选
 * @param {string} [opts.keyword]       - 关键词（名称 / 地点）
 * @param {number} [opts.page]
 * @param {number} [opts.page_size]
 * @param {object} [opts.viewer]        - { userId, role, staffId }
 */
async function getMeetingList({
  start_date, end_date, status, meeting_type, keyword,
  page = 1, page_size = 20,
  viewer = {},
} = {}) {
  const conditions = []
  const params     = []

  // 普通用户只能看自己主持或参与的会议
  if (viewer.role && viewer.role !== 'admin') {
    conditions.push(`(
      m.host_id = ?
      OR EXISTS (
        SELECT 1 FROM meeting_participants mp2
         WHERE mp2.meeting_id = m.meeting_id
           AND mp2.staff_id   = ?
      )
    )`)
    params.push(viewer.staffId, viewer.staffId)
  }

  if (start_date) { conditions.push('DATE(m.start_time) >= ?'); params.push(start_date) }
  if (end_date)   { conditions.push('DATE(m.start_time) <= ?'); params.push(end_date)   }
  if (status)     { conditions.push('m.status = ?');            params.push(status)     }
  if (meeting_type) { conditions.push('m.meeting_type = ?');    params.push(meeting_type) }
  if (keyword) {
    conditions.push('(m.meeting_name LIKE ? OR m.location LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM meetings m
      ${where}`,
    params,
  )

  const offset = (page - 1) * page_size
  const [rows] = await pool.query(
    `SELECT m.*,
            s.name AS host_name
       FROM meetings m
       LEFT JOIN staff s ON s.staff_id = m.host_id
      ${where}
      ORDER BY m.start_time DESC
      LIMIT ? OFFSET ?`,
    [...params, Number(page_size), offset],
  )

  // 批量拉取参会人员（仅摘要：姓名+确认状态）
  const meetingIds = rows.map(r => r.meeting_id)
  let participantMap = {}
  if (meetingIds.length) {
    const [pRows] = await pool.query(
      `SELECT mp.meeting_id, mp.staff_id, s.name, mp.confirmed
         FROM meeting_participants mp
         JOIN staff s ON s.staff_id = mp.staff_id
        WHERE mp.meeting_id IN (?)`,
      [meetingIds],
    )
    for (const p of pRows) {
      if (!participantMap[p.meeting_id]) participantMap[p.meeting_id] = []
      participantMap[p.meeting_id].push({ staff_id: p.staff_id, name: p.name, confirmed: p.confirmed })
    }
  }

  const list = rows.map(row => ({
    ...fmtMeeting(row),
    participants: participantMap[row.meeting_id] ?? [],
  }))

  return {
    list,
    pagination: { page: Number(page), page_size: Number(page_size), total },
  }
}

// ─── 二、会议详情 ─────────────────────────────────────────────────────────────

/**
 * 获取单条会议详情（含参会人员完整信息）
 */
async function getMeetingById(id) {
  const [[row]] = await pool.query(
    `SELECT m.*, s.name AS host_name
       FROM meetings m
       LEFT JOIN staff s ON s.staff_id = m.host_id
      WHERE m.meeting_id = ?`,
    [id],
  )
  if (!row) throw createError('会议不存在', 404)

  const participants = await fetchParticipants(id)
  return { ...fmtMeeting(row), participants }
}

// ─── 三、新增会议 ─────────────────────────────────────────────────────────────

/**
 * 新增会议
 *
 * @param {object} data
 * @param {object} operator - { userId, role, staffId }
 */
async function createMeeting(data, operator) {
  const {
    meeting_name, meeting_type, host_id,
    start_time, end_time, location,
    agenda, reminder_setting = '30min',
    participant_ids = [],
  } = data

  // 校验时间
  if (new Date(start_time) >= new Date(end_time)) {
    throw createError('结束时间必须晚于开始时间', 400)
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const meeting_no = await genMeetingNo(conn)

    const [result] = await conn.query(
      `INSERT INTO meetings
         (meeting_no, meeting_name, meeting_type, host_id,
          start_time, end_time, location, agenda, reminder_setting,
          status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'upcoming', ?)`,
      [
        meeting_no, meeting_name, meeting_type, host_id,
        start_time, end_time, location,
        agenda        || null,
        reminder_setting,
        operator.userId,
      ],
    )

    const meetingId = result.insertId

    // 保存参会人员（去重，主持人自动加入并设为已确认）
    const ids = [...new Set([Number(host_id), ...participant_ids.map(Number)])]
    if (ids.length) {
      const values = ids.map(sid => [
        meetingId,
        sid,
        sid === Number(host_id) ? 1 : null,  // 主持人自动确认
        sid === Number(host_id) ? new Date() : null,
      ])
      await conn.query(
        `INSERT INTO meeting_participants
           (meeting_id, staff_id, confirmed, confirmed_at)
         VALUES ?`,
        [values],
      )
    }

    await conn.commit()

    // 事务提交后异步同步提醒（不影响主流程）
    const allIds = [...new Set([Number(host_id), ...participant_ids.map(Number)])]
    getReminderService()
      .syncMeetingReminders(meetingId, reminder_setting, start_time, allIds)
      .catch(err => console.error('[reminder] syncMeetingReminders error:', err.message))

    return getMeetingById(meetingId)
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// ─── 四、更新会议 ─────────────────────────────────────────────────────────────

/**
 * 更新会议基本信息及参会人员
 */
async function updateMeeting(id, data, operator) {
  const [[existing]] = await pool.query(
    'SELECT * FROM meetings WHERE meeting_id = ?', [id],
  )
  if (!existing) throw createError('会议不存在', 404)

  // 权限：只有管理员或创建人可以修改
  if (operator.role !== 'admin' && existing.created_by !== operator.userId) {
    throw createError('无权修改此会议', 403)
  }

  const {
    meeting_name, meeting_type, host_id,
    start_time, end_time, location,
    agenda, reminder_setting, status, minutes,
    participant_ids,
  } = data

  // 时间校验
  const st = start_time || existing.start_time
  const et = end_time   || existing.end_time
  if (new Date(st) >= new Date(et)) {
    throw createError('结束时间必须晚于开始时间', 400)
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 构建 SET 子句（只更新传入的字段）
    const sets   = []
    const values = []
    const fields = {
      meeting_name, meeting_type, host_id,
      start_time, end_time, location,
      agenda, reminder_setting, status, minutes,
    }
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) { sets.push(`${k} = ?`); values.push(v) }
    }

    if (sets.length) {
      await conn.query(
        `UPDATE meetings SET ${sets.join(', ')} WHERE meeting_id = ?`,
        [...values, id],
      )
    }

    // 更新参会人员（先删后增）
    if (Array.isArray(participant_ids)) {
      await conn.query(
        'DELETE FROM meeting_participants WHERE meeting_id = ?', [id],
      )
      const newHostId = host_id ?? existing.host_id
      const ids = [...new Set([Number(newHostId), ...participant_ids.map(Number)])]
      if (ids.length) {
        const vals = ids.map(sid => [
          id, sid,
          sid === Number(newHostId) ? 1 : null,
          sid === Number(newHostId) ? new Date() : null,
        ])
        await conn.query(
          `INSERT INTO meeting_participants
             (meeting_id, staff_id, confirmed, confirmed_at)
           VALUES ?`,
          [vals],
        )
      }
    }

    await conn.commit()

    // 若涉及参会人员或时间/提醒设置变更，重新同步提醒记录
    const needResync = Array.isArray(participant_ids) || start_time || reminder_setting
    if (needResync) {
      // 重新读取最新会议数据用于同步
      const [[updated]] = await pool.query(
        `SELECT m.start_time, m.reminder_setting,
                GROUP_CONCAT(mp.staff_id) AS staff_ids
           FROM meetings m
           LEFT JOIN meeting_participants mp ON mp.meeting_id = m.meeting_id
          WHERE m.meeting_id = ?
          GROUP BY m.meeting_id`,
        [id],
      )
      if (updated) {
        const staffIds = updated.staff_ids
          ? updated.staff_ids.split(',').map(Number)
          : []
        getReminderService()
          .syncMeetingReminders(id, updated.reminder_setting, updated.start_time, staffIds)
          .catch(err => console.error('[reminder] syncMeetingReminders error:', err.message))
      }
    }

    return getMeetingById(id)
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// ─── 五、删除会议 ─────────────────────────────────────────────────────────────

/**
 * 删除会议（管理员或创建人）
 */
async function deleteMeeting(id, operator) {
  const [[existing]] = await pool.query(
    'SELECT * FROM meetings WHERE meeting_id = ?', [id],
  )
  if (!existing) throw createError('会议不存在', 404)

  if (operator.role !== 'admin' && existing.created_by !== operator.userId) {
    throw createError('无权删除此会议', 403)
  }

  // meeting_participants 通过 ON DELETE CASCADE 自动删除
  await pool.query('DELETE FROM meetings WHERE meeting_id = ?', [id])
}

// ─── 六、确认参会 ─────────────────────────────────────────────────────────────

/**
 * 更新当前用户（staff）的参会确认状态
 *
 * @param {number}  meetingId
 * @param {0|1|2}   confirmed  - 0未确认 1确认 2拒绝
 * @param {object}  operator   - { userId, staffId }
 */
async function confirmAttendance(meetingId, confirmed, operator) {
  const [[existing]] = await pool.query(
    'SELECT meeting_id FROM meetings WHERE meeting_id = ?', [meetingId],
  )
  if (!existing) throw createError('会议不存在', 404)

  if (!operator.staffId) throw createError('当前账号未关联员工信息', 400)

  const [[participant]] = await pool.query(
    `SELECT id FROM meeting_participants
      WHERE meeting_id = ? AND staff_id = ?`,
    [meetingId, operator.staffId],
  )
  if (!participant) throw createError('您不在此会议参会名单中', 403)

  await pool.query(
    `UPDATE meeting_participants
        SET confirmed = ?, confirmed_at = NOW()
      WHERE meeting_id = ? AND staff_id = ?`,
    [confirmed, meetingId, operator.staffId],
  )

  return getMeetingById(meetingId)
}

// ─── 七、我的会议 ─────────────────────────────────────────────────────────────

/**
 * 获取当前用户参与的会议列表（按时间倒序）
 */
async function getMyMeetings({ page = 1, page_size = 20, viewer } = {}) {
  if (!viewer?.staffId) {
    return { list: [], pagination: { page: 1, page_size, total: 0 } }
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM meetings m
      WHERE m.host_id = ?
         OR EXISTS (
              SELECT 1 FROM meeting_participants mp
               WHERE mp.meeting_id = m.meeting_id
                 AND mp.staff_id   = ?
            )`,
    [viewer.staffId, viewer.staffId],
  )

  const offset = (page - 1) * page_size
  const [rows] = await pool.query(
    `SELECT m.*, s.name AS host_name
       FROM meetings m
       LEFT JOIN staff s ON s.staff_id = m.host_id
      WHERE m.host_id = ?
         OR EXISTS (
              SELECT 1 FROM meeting_participants mp
               WHERE mp.meeting_id = m.meeting_id
                 AND mp.staff_id   = ?
            )
      ORDER BY m.start_time DESC
      LIMIT ? OFFSET ?`,
    [viewer.staffId, viewer.staffId, Number(page_size), offset],
  )

  const meetingIds = rows.map(r => r.meeting_id)
  let participantMap = {}
  if (meetingIds.length) {
    const [pRows] = await pool.query(
      `SELECT mp.meeting_id, mp.staff_id, s.name, mp.confirmed
         FROM meeting_participants mp
         JOIN staff s ON s.staff_id = mp.staff_id
        WHERE mp.meeting_id IN (?)`,
      [meetingIds],
    )
    for (const p of pRows) {
      if (!participantMap[p.meeting_id]) participantMap[p.meeting_id] = []
      participantMap[p.meeting_id].push({ staff_id: p.staff_id, name: p.name, confirmed: p.confirmed })
    }
  }

  const list = rows.map(row => ({
    ...fmtMeeting(row),
    participants: participantMap[row.meeting_id] ?? [],
  }))

  return { list, pagination: { page: Number(page), page_size: Number(page_size), total } }
}

// ─── 八、日历视图数据 ──────────────────────────────────────────────────────────

/**
 * 返回日期范围内的会议（用于日历渲染）
 */
async function getCalendarMeetings({ start_date, end_date, viewer } = {}) {
  const conditions = []
  const params     = []

  if (viewer?.role && viewer.role !== 'admin') {
    conditions.push(`(
      m.host_id = ?
      OR EXISTS (
        SELECT 1 FROM meeting_participants mp2
         WHERE mp2.meeting_id = m.meeting_id
           AND mp2.staff_id   = ?
      )
    )`)
    params.push(viewer.staffId, viewer.staffId)
  }

  if (start_date) { conditions.push('DATE(m.start_time) >= ?'); params.push(start_date) }
  if (end_date)   { conditions.push('DATE(m.start_time) <= ?'); params.push(end_date)   }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [rows] = await pool.query(
    `SELECT m.meeting_id, m.meeting_no, m.meeting_name, m.meeting_type,
            m.start_time, m.end_time, m.location, m.status,
            s.name AS host_name
       FROM meetings m
       LEFT JOIN staff s ON s.staff_id = m.host_id
      ${where}
      ORDER BY m.start_time ASC`,
    params,
  )

  return rows.map(fmtMeeting)
}

module.exports = {
  getMeetingList,
  getMeetingById,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  confirmAttendance,
  getMyMeetings,
  getCalendarMeetings,
}
