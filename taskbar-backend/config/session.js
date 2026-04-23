const session = require('express-session')

/**
 * @returns {import('express-session').SessionOptions}
 */
function getSessionOptions() {
  const maxAge = Number(process.env.SESSION_MAX_AGE) || 86400000
  const secure =
    process.env.SESSION_COOKIE_SECURE === 'true' ||
    process.env.NODE_ENV === 'production'

  return {
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'taskbar.sid',
    cookie: {
      maxAge,
      httpOnly: true,
      secure,
      sameSite: 'lax',
    },
  }
}

function createSessionMiddleware() {
  return session(getSessionOptions())
}

/**
 * 与 express-session 写入的 Set-Cookie 一致，供登出时 clearCookie 使用
 * @returns {{ path: string, httpOnly: boolean, secure: boolean, sameSite: 'lax'|'strict'|'none' }}
 */
function getSessionCookieClearOptions() {
  const opts = getSessionOptions()
  const c = opts.cookie || {}
  return {
    path: '/',
    httpOnly: c.httpOnly !== false,
    secure: !!c.secure,
    sameSite: c.sameSite || 'lax',
  }
}

module.exports = {
  getSessionOptions,
  createSessionMiddleware,
  getSessionCookieClearOptions,
}
