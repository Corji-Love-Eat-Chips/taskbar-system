import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as apiLogin, logout as apiLogout, getCurrentUser as fetchCurrentUser } from '@/api/user'

export const useUserStore = defineStore('user', () => {
  // ── 状态 ──────────────────────────────────────────────────────────────────
  /** @type {import('vue').Ref<{user_id,username,role,staff_id,staff_name}|null>} */
  const userInfo = ref(null)
  /** 是否已完成登录态初始化（用于路由守卫等待） */
  const initialized = ref(false)

  // ── 计算 ──────────────────────────────────────────────────────────────────
  const isLoggedIn = computed(() => !!userInfo.value)
  const isAdmin    = computed(() => userInfo.value?.role === 'admin')
  const isLeader   = computed(() => userInfo.value?.role === 'leader')
  const role       = computed(() => userInfo.value?.role ?? null)
  const staffId    = computed(() => userInfo.value?.staff_id ?? null)
  const username   = computed(() => userInfo.value?.username ?? '')

  // ── 动作 ──────────────────────────────────────────────────────────────────

  /**
   * 登录：调用后端接口，将返回的用户信息存入 store
   */
  async function login(credentials) {
    const res = await apiLogin(credentials)
    userInfo.value = res.data
    return res
  }

  /**
   * 登出：调用后端接口，清空本地状态
   */
  async function logout() {
    try {
      await apiLogout()
    } catch {
      // 即便接口失败也清空本地状态
    }
    userInfo.value = null
  }

  /**
   * 应用启动时通过 Session 恢复用户信息（Cookie 未过期时有效）
   * 路由守卫中等待此方法完成再做跳转判断
   */
  async function fetchUser() {
    try {
      const res = await fetchCurrentUser()
      userInfo.value = res.data
    } catch {
      userInfo.value = null
    } finally {
      initialized.value = true
    }
  }

  /** 直接设置用户信息（例如登录成功后手动注入） */
  function setUserInfo(info) {
    userInfo.value = info
  }

  return {
    userInfo,
    initialized,
    isLoggedIn,
    isAdmin,
    isLeader,
    role,
    staffId,
    username,
    login,
    logout,
    fetchUser,
    setUserInfo,
  }
})
