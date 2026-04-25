const { fail } = require('../utils/response')
const { getTaskParticipation, userCanAccessTask } = require('../services/taskAccessService')

/**
 * 已登录，且能「看到」该任务者（同任务列表：负责人/协助人/管理员/领导）
 */
async function requireTaskFileAccess(req, res, next) {
  const taskId = Number(req.params.id)
  if (!Number.isInteger(taskId) || taskId < 1) {
    return fail(res, '任务ID无效', 422)
  }
  try {
    const ctx = await getTaskParticipation(taskId)
    if (!ctx) return fail(res, '任务不存在', 404)
    if (!userCanAccessTask(req.currentUser, ctx)) return fail(res, '权限不足', 403)
    req._taskFileCtx = ctx
    return next()
  } catch (e) {
    return next(e)
  }
}

module.exports = { requireTaskFileAccess }
