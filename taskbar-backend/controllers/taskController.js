/**
 * taskController.js
 * 任务管理 HTTP 处理层
 */

const { validationResult } = require('express-validator')
const taskService = require('../services/taskService')
const { success, created, paginated, fail } = require('../utils/response')
const { asyncHandler } = require('../utils/asyncHandler')

// ── 工具 ──────────────────────────────────────────────────────────────────────
function pickErrors(req, res) {
  const errs = validationResult(req)
  if (!errs.isEmpty()) { fail(res, errs.array()[0].msg, 422); return true }
  return false
}

// ── GET /api/tasks ─────────────────────────────────────────────────────────────
/**
 * 任务列表（分页 + 多条件筛选 + 按角色过滤可见范围）
 *
 * 查询参数兼容 page_size（文档）与 pageSize（驼峰）
 */
async function list(req, res) {
  const { period_id, owner_id, category, status, keyword, page } = req.query
  const page_size = req.query.page_size ?? req.query.pageSize ?? 20

  const result = await taskService.getTaskList({
    period_id,
    owner_id,
    category,
    status,
    keyword,
    page: page ?? 1,
    pageSize: page_size,
    viewer: {
      role:    req.currentUser.role,
      staffId: req.currentUser.staffId,
    },
  })
  return paginated(res, result.list, result.pagination)
}

// ── GET /api/tasks/:id ─────────────────────────────────────────────────────────
async function detail(req, res) {
  const task = await taskService.getTaskById(Number(req.params.id))
  if (!task) return fail(res, '任务不存在', 404)
  return success(res, task)
}

// ── POST /api/tasks ────────────────────────────────────────────────────────────
/**
 * 新增任务
 * 创建人 = 当前登录用户 (req.currentUser.userId)
 */
async function create(req, res) {
  if (pickErrors(req, res)) return
  const task = await taskService.createTask(req.body, req.currentUser.userId)
  return created(res, task, '任务创建成功')
}

// ── PUT /api/tasks/:id ─────────────────────────────────────────────────────────
/**
 * 更新任务
 * 权限：管理员 / 任务负责人 / 任务协助人（含编辑权）
 * 此处鉴权在路由层通过 canEditTask 中间件完成
 */
async function update(req, res) {
  if (pickErrors(req, res)) return
  const task = await taskService.updateTask(Number(req.params.id), req.body)
  return success(res, task, '任务更新成功')
}

// ── PATCH /api/tasks/:id/progress ─────────────────────────────────────────────
/**
 * 仅更新任务进度（轻量操作）
 */
async function updateProgress(req, res) {
  if (pickErrors(req, res)) return
  const task = await taskService.updateTaskProgress(
    Number(req.params.id),
    req.body.progress,
  )
  return success(res, task, '进度更新成功')
}

// ── DELETE /api/tasks/:id ──────────────────────────────────────────────────────
async function remove(req, res) {
  await taskService.deleteTask(Number(req.params.id))
  return success(res, null, '任务已删除')
}

// ── 协助人子资源 ───────────────────────────────────────────────────────────────

/** GET /api/tasks/:id/collaborators */
async function listCollaborators(req, res) {
  const data = await taskService.getCollaborators(Number(req.params.id))
  return success(res, data)
}

/** POST /api/tasks/:id/collaborators */
async function addCollaborator(req, res) {
  if (pickErrors(req, res)) return
  const data = await taskService.addCollaborator(
    Number(req.params.id),
    Number(req.body.staff_id),
  )
  return success(res, data, '协助人添加成功')
}

/** DELETE /api/tasks/:id/collaborators/:staffId */
async function removeCollaborator(req, res) {
  await taskService.removeCollaborator(
    Number(req.params.id),
    Number(req.params.staffId),
  )
  return success(res, null, '协助人已移除')
}

/** POST /api/tasks/import  批量导入 */
const importExcel = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    return fail(res, '请上传有效的 Excel 文件（扩展名 .xlsx / .xls，最大 5MB）', 400)
  }
  const result = await taskService.importTasksFromExcelBuffer(
    req.file.buffer,
    req.currentUser.userId,
  )
  if (!result.ok) {
    return fail(res, '导入未执行，请根据下列提示修正表格后重试', 400, { errors: result.errors })
  }
  return success(res, { imported: result.imported }, `成功导入 ${result.imported} 条任务`)
})

module.exports = {
  list, detail, create, update, updateProgress, remove,
  listCollaborators, addCollaborator, removeCollaborator,
  importExcel,
}
