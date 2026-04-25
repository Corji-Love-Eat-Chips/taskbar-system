/**
 * 任务资源访问：与任务列表可见范围一致
 * - admin / leader：全部任务
 * - teacher：本人负责或协助人
 */
const pool = require('../config/database')

/**
 * @param {number} taskId
 * @returns {Promise<{ task_id: number, owner_id: number, collabIds: number[] }|null>}
 */
async function getTaskParticipation(taskId) {
  const [[task]] = await pool.query(
    'SELECT task_id, owner_id FROM tasks WHERE task_id = ?',
    [taskId],
  )
  if (!task) return null
  const [collabs] = await pool.query(
    'SELECT staff_id FROM task_collaborators WHERE task_id = ?',
    [taskId],
  )
  return {
    task_id: task.task_id,
    owner_id: task.owner_id,
    collabIds: collabs.map((c) => c.staff_id),
  }
}

/**
 * @param {{ role: string, staffId: number|null }} user  req.currentUser
 * @param {{ owner_id: number, collabIds: number[] }} ctx
 */
function userCanAccessTask(user, ctx) {
  if (!ctx) return false
  if (user.role === 'admin' || user.role === 'leader') return true
  if (user.role === 'teacher') {
    const sid = user.staffId
    if (sid == null) return false
    if (ctx.owner_id === sid) return true
    return ctx.collabIds.includes(sid)
  }
  return false
}

module.exports = {
  getTaskParticipation,
  userCanAccessTask,
}
