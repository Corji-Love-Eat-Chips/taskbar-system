/**
 * 包装 async 路由，统一交给 errorHandler
 * @param {function(import('express').Request, import('express').Response): Promise<void>} fn
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

module.exports = { asyncHandler }
