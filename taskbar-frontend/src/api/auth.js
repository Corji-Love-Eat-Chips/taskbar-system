/**
 * auth.js
 * 向后兼容层：从 user.js 重新导出认证相关函数
 *
 * 旧代码 import { login } from '@/api/auth' 无需修改
 */
export { login, logout, getCurrentUser as fetchCurrentUser } from './user'
