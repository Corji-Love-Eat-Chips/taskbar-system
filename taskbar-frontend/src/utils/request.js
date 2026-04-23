import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import router from '@/router'

// ── Axios 实例 ──────────────────────────────────────────────────────────────
const service = axios.create({
  baseURL: '/api',          // Vite 开发代理转发到 http://localhost:3000/api
  timeout: 10000,
  withCredentials: true,    // 携带 Session Cookie
})

// ── 请求拦截器 ──────────────────────────────────────────────────────────────
service.interceptors.request.use(
  (config) => {
    // Session 认证无需手动附加 Token
    // 如后续改为 JWT，在此处注入：config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error),
)

// ── 响应拦截器 ──────────────────────────────────────────────────────────────

/** 防止 401 弹窗重复出现 */
let _401Handling = false

service.interceptors.response.use(
  (response) => {
    const res = response.data

    // 后端统一响应格式：{ code, message, data }
    // code 非 2xx 视为业务失败
    if (res.code !== undefined && res.code !== 200 && res.code !== 201) {
      ElMessage({
        message: res.message || '操作失败',
        type: 'error',
        duration: 3000,
      })
      return Promise.reject(new Error(res.message || '操作失败'))
    }

    return res   // 返回完整响应体，让调用层按需取 .data / .message
  },
  async (error) => {
    const status  = error.response?.status
    const message = error.response?.data?.message || error.message || '请求失败'

    // ── 401 未登录 / Session 过期 ──────────────────────────────────────────
    if (status === 401) {
      if (!_401Handling) {
        _401Handling = true
        ElMessageBox.alert(
          '登录已过期，请重新登录',
          '会话超时',
          { confirmButtonText: '去登录', type: 'warning' },
        ).finally(() => {
          _401Handling = false
          // 清空 Pinia 中的用户信息并跳转（避免循环依赖，用动态 import）
          import('@/store/user').then(({ useUserStore }) => {
            const userStore = useUserStore()
            userStore.setUserInfo(null)
          })
          router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
        })
      }
      return Promise.reject(error)
    }

    // ── 403 无权限 ────────────────────────────────────────────────────────
    if (status === 403) {
      ElMessage.error('权限不足，无法执行此操作')
      return Promise.reject(error)
    }

    // ── 404 ───────────────────────────────────────────────────────────────
    if (status === 404) {
      ElMessage.error('请求的资源不存在')
      return Promise.reject(error)
    }

    // ── 500 / 其他服务端错误 ──────────────────────────────────────────────
    if (status >= 500) {
      ElMessage.error('服务器异常，请稍后重试')
      return Promise.reject(error)
    }

    // ── 网络错误 / 超时 ───────────────────────────────────────────────────
    if (!error.response) {
      ElMessage.error('网络连接失败，请检查网络设置')
      return Promise.reject(error)
    }

    // ── 其余 4xx ──────────────────────────────────────────────────────────
    ElMessage.error(message)
    return Promise.reject(error)
  },
)

export default service
