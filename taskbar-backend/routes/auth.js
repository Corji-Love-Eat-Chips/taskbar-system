const { Router } = require('express')
const { body } = require('express-validator')
const { login, logout, current } = require('../controllers/authController')

const router = Router()

/**
 * 登录参数校验规则
 */
const loginRules = [
  body('username')
    .trim()
    .notEmpty().withMessage('用户名不能为空')
    .isLength({ max: 50 }).withMessage('用户名最长 50 字符'),
  body('password')
    .notEmpty().withMessage('密码不能为空')
    .isLength({ max: 100 }).withMessage('密码最长 100 字符'),
]

// POST /api/auth/login
router.post('/login', loginRules, login)

// POST /api/auth/logout
router.post('/logout', logout)

// GET /api/auth/current
router.get('/current', current)

module.exports = router
