const { ValidationError } = require('express-validator')

/**
 * 统一错误处理（4 个参数，Express 识别为错误中间件，必须置于所有路由之后）
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
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
