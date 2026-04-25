const { ValidationError } = require('express-validator')

/**
 * 统一错误处理（4 个参数，Express 识别为错误中间件，必须置于所有路由之后）
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err)
  }

  if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ code: 400, message: '文件超过大小限制（单文件最大 20MB）' })
  }
  if (err.message && /不支持的文件类型/.test(err.message)) {
    return res.status(400).json({ code: 400, message: err.message })
  }

  // express-validator 的校验错误集合（通过 createError 抛出时会挂 errors 数组）
  if (err.isValidationError && Array.isArray(err.errors)) {
    return res.status(422).json({
      code: 422,
      message: '参数校验失败',
      errors: err.errors,
    })
  }

  const status = err.status || err.statusCode || 500
  const message = err.message || '服务器内部错误'

  // 生产环境 5xx 只打印，不把堆栈传给客户端
  if (process.env.NODE_ENV !== 'production') {
    if (err.stack) console.error(err.stack)
  } else if (status >= 500) {
    console.error(`[${new Date().toISOString()}] ${status} ${req.method} ${req.originalUrl}\n`, err)
  }

  const body = { code: status, message }
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    body.stack = err.stack
  }
  return res.status(status).json(body)
}

module.exports = { errorHandler }
