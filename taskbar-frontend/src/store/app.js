import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const SIDEBAR_KEY = 'taskbar_sidebar_collapsed'

export const useAppStore = defineStore('app', () => {
  // ── 侧边栏 ────────────────────────────────────────────────────────────────
  const sidebarCollapsed = ref(
    localStorage.getItem(SIDEBAR_KEY) === 'true',
  )

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value)
  }

  function setSidebarCollapsed(val) {
    sidebarCollapsed.value = val
    localStorage.setItem(SIDEBAR_KEY, val)
  }

  // ── 全局 loading ──────────────────────────────────────────────────────────
  const globalLoading = ref(false)

  function setLoading(val) {
    globalLoading.value = val
  }

  // ── 页面标题（面包屑等组件使用）──────────────────────────────────────────
  const pageTitle = ref('')

  function setPageTitle(title) {
    pageTitle.value = title
    document.title = title
      ? `${title} - 工作计划管理平台`
      : '工作计划管理平台'
  }

  return {
    sidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
    globalLoading,
    setLoading,
    pageTitle,
    setPageTitle,
  }
})
