/**
 * routes/dashboard.js
 * 仪表盘聚合接口  /api/dashboard/*
 */
const { Router } = require('express')
const { asyncHandler } = require('../utils/asyncHandler')
const { requireAuth } = require('../middlewares/auth')
const { success } = require('../utils/response')
const pool = require('../config/database')

const router = Router()
router.use(requireAuth)

// ─── GET /api/dashboard/stats  统计卡片数据 ───────────────────────────────────
router.get('/stats', asyncHandler(async (req, res) => {
  const { role, staffId } = req.currentUser

  const isAdmin = role === 'admin' || role === 'leader'

  // 任务统计
  let taskRows
  if (isAdmin) {
    ;[[taskRows]] = await pool.query(`
      SELECT
        COUNT(*)                                               AS total,
        SUM(status = 'in_progress')                           AS in_progress,
        SUM(status = 'completed')                             AS completed,
        SUM(status IN ('pending','in_progress') AND end_date < CURDATE()) AS overdue
      FROM tasks
      WHERE status != 'cancelled'
    `)
  } else {
    ;[[taskRows]] = await pool.query(`
      SELECT
        COUNT(DISTINCT t.task_id)                                           AS total,
        SUM(t.status = 'in_progress')                                       AS in_progress,
        SUM(t.status = 'completed')                                         AS completed,
        SUM(t.status IN ('pending','in_progress') AND t.end_date < CURDATE()) AS overdue
      FROM tasks t
      WHERE t.status != 'cancelled'
        AND (
          t.owner_id = ?
          OR EXISTS (SELECT 1 FROM task_co_leads cl WHERE cl.task_id = t.task_id AND cl.staff_id = ?)
          OR EXISTS (SELECT 1 FROM task_auxiliary_owners ax WHERE ax.task_id = t.task_id AND ax.staff_id = ?)
          OR EXISTS (
            SELECT 1 FROM task_collaborators tc
             WHERE tc.task_id = t.task_id AND tc.staff_id = ?
          )
        )
    `, [staffId, staffId, staffId, staffId])
  }

  // 待办统计（只看自己）
  const [[todoRows]] = await pool.query(`
    SELECT
      COUNT(*)              AS total,
      SUM(status = 0)       AS pending,
      SUM(status = 1)       AS done
    FROM todos
    WHERE executor_id = ?
  `, [staffId])

  // 本周会议数
  const [[meetingRows]] = await pool.query(`
    SELECT COUNT(*) AS week_count
    FROM meetings
    WHERE YEARWEEK(start_time, 1) = YEARWEEK(NOW(), 1)
      AND status != 'cancelled'
      AND (
        host_id = ?
        OR EXISTS (
          SELECT 1 FROM meeting_participants mp
           WHERE mp.meeting_id = meetings.meeting_id AND mp.staff_id = ?
        )
      )
  `, [staffId, staffId])

  success(res, {
    tasks: {
      total:       Number(taskRows.total       ?? 0),
      in_progress: Number(taskRows.in_progress ?? 0),
      completed:   Number(taskRows.completed   ?? 0),
      overdue:     Number(taskRows.overdue     ?? 0),
    },
    todos: {
      total:   Number(todoRows.total   ?? 0),
      pending: Number(todoRows.pending ?? 0),
      done:    Number(todoRows.done    ?? 0),
    },
    meetings: {
      week_count: Number(meetingRows.week_count ?? 0),
    },
  })
}))

// ─── GET /api/dashboard/home  首页聚合（stats + 近期任务 + 近期会议）─────────
router.get('/home', asyncHandler(async (req, res) => {
  const { role, staffId } = req.currentUser
  const isAdmin = role === 'admin' || role === 'leader'

  // ── 近期进行中任务（最多5条，按截止日期升序）──────────────────────────────
  let recentTasks
  if (isAdmin) {
    ;[recentTasks] = await pool.query(`
      SELECT t.task_id, t.task_no, t.task_name, t.end_date,
             t.status, t.progress, t.priority,
             s.name AS owner_name
        FROM tasks t
        LEFT JOIN staff s ON s.staff_id = t.owner_id
       WHERE t.status IN ('pending','in_progress')
       ORDER BY t.end_date ASC
       LIMIT 5
    `)
  } else {
    ;[recentTasks] = await pool.query(`
      SELECT DISTINCT t.task_id, t.task_no, t.task_name, t.end_date,
             t.status, t.progress, t.priority,
             s.name AS owner_name
        FROM tasks t
        LEFT JOIN staff s ON s.staff_id = t.owner_id
       WHERE t.status IN ('pending','in_progress')
         AND (
           t.owner_id = ?
           OR EXISTS (SELECT 1 FROM task_co_leads cl WHERE cl.task_id = t.task_id AND cl.staff_id = ?)
           OR EXISTS (SELECT 1 FROM task_auxiliary_owners ax WHERE ax.task_id = t.task_id AND ax.staff_id = ?)
           OR EXISTS (
             SELECT 1 FROM task_collaborators tc
              WHERE tc.task_id = t.task_id AND tc.staff_id = ?
           )
         )
       ORDER BY t.end_date ASC
       LIMIT 5
    `, [staffId, staffId, staffId, staffId])
  }

  // ── 即将开始的会议（最多3条）────────────────────────────────────────────────
  const [upcomingMeetings] = await pool.query(`
    SELECT m.meeting_id, m.meeting_no, m.meeting_name,
           m.start_time, m.end_time, m.location, m.meeting_type, m.status,
           s.name AS host_name
      FROM meetings m
      LEFT JOIN staff s ON s.staff_id = m.host_id
     WHERE m.start_time >= NOW()
       AND m.status = 'upcoming'
       AND (
         m.host_id = ?
         OR EXISTS (
           SELECT 1 FROM meeting_participants mp
            WHERE mp.meeting_id = m.meeting_id AND mp.staff_id = ?
         )
       )
     ORDER BY m.start_time ASC
     LIMIT 3
  `, [staffId, staffId])

  // ── 未完成待办（最多5条，按优先级+截止时间排序）────────────────────────────
  const [pendingTodos] = await pool.query(`
    SELECT td.todo_id, td.todo_name, td.priority, td.deadline,
           t.task_name
      FROM todos td
      LEFT JOIN tasks t ON t.task_id = td.task_id
     WHERE td.executor_id = ?
       AND td.status = 0
     ORDER BY
       FIELD(td.priority,'urgent','important','normal','low'),
       td.deadline ASC
     LIMIT 5
  `, [staffId])

  const fmtDate = d => d
    ? (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10))
    : null
  const fmtDt = d => d
    ? (typeof d === 'string' ? d.slice(0, 19).replace('T', ' ') : d.toISOString().slice(0, 19).replace('T', ' '))
    : null

  success(res, {
    recent_tasks: recentTasks.map(r => ({
      ...r,
      end_date: fmtDate(r.end_date),
    })),
    upcoming_meetings: upcomingMeetings.map(m => ({
      ...m,
      start_time: fmtDt(m.start_time),
      end_time:   fmtDt(m.end_time),
    })),
    pending_todos: pendingTodos.map(td => ({
      ...td,
      deadline: fmtDt(td.deadline),
    })),
  })
}))

module.exports = router
