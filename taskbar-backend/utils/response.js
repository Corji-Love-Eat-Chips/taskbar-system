/**
 * 统一响应格式工具
 *
 * 成功：{ code: 200, message: 'ok', data: <any> }
 * 分页：{ code: 200, message: 'ok', data: { list, pagination } }
 * 失败：{ code: <4xx|5xx>, message: <string> }
 */

/**
 * 成功响应
 * @param {import('express').Response} res
 * @param {*} data
 * @param {string} [message]
 * @param {number} [status=200]
 */
function success(res, data = null, message = 'ok', status = 200) {
  return res.status(status).json({ code: status, message, data })
}

/**
 * 创建成功（201）
 */
function created(res, data = null, message = '创建成功') {
  return success(res, data, message, 201)
}

/**
 * 分页列表响应
 * @param {import('express').Response} res
 * @param {Array} list
 * @param {{ total: number, page: number, page_size?: number, pageSize?: number }} pagination
 * @param {string} [message]
 */
function paginated(res, list, pagination, message = 'ok') {
  return res.status(200).json({
    code: 200,
    message,
    data: { list, pagination },
  })
}

/**
 * 失败响应（不抛错时用；需要被 errorHandler 捕获的场景请 throw 或 next(err)）
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} [status=400]
 * @param {*} [data]
 */
function fail(res, message = '操作失败', status = 400, data = null) {
  const body = { code: status, message }
  if (data !== null) body.data = data
  return res.status(status).json(body)
}

/**
 * 创建一个带 HTTP 状态码的 Error（供 next(err) 使用）
 * @param {string} message
 * @param {number} [status=500]
 */
function createError(message, status = 500) {
  const err = new Error(message)
  err.status = status
  return err
}

module.exports = { success, created, paginated, fail, createError }
