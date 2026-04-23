import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/store/user'

// ── 路由表 ─────────────────────────────────────────────────────────────────
const routes = [
  // ── 登录页（无需认证）────────────────────────────────────────────────────
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', requiresAuth: false },
  },

  // ── 主布局（需要认证）────────────────────────────────────────────────────
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/views/layout/index.vue'),
    redirect: '/home',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'home',
        name: 'Home',
        component: () => import('@/views/home/index.vue'),
        meta: { title: '首页', requiresAuth: true, icon: 'HomeFilled' },
      },
      {
        path: 'tasks',
        name: 'Tasks',
        component: () => import('@/views/tasks/index.vue'),
        meta: { title: '任务管理', requiresAuth: true, icon: 'List' },
      },
      {
        path: 'meetings',
        name: 'Meetings',
        component: () => import('@/views/meetings/index.vue'),
        meta: { title: '会议管理', requiresAuth: true, icon: 'Calendar' },
      },
      {
        path: 'todos',
        name: 'Todos',
        component: () => import('@/views/todos/index.vue'),
        meta: { title: '我的待办', requiresAuth: true, icon: 'Checked' },
      },
      // ── 管理员专属路由 ───────────────────────────────────────────────────
      {
        path: 'staff',
        name: 'Staff',
        component: () => import('@/views/staff/index.vue'),
        meta: { title: '人员管理', requiresAuth: true, icon: 'UserFilled', roles: ['admin'] },
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/users/index.vue'),
        meta: { title: '账号管理', requiresAuth: true, icon: 'Setting', roles: ['admin'] },
      },
    ],
  },

  // ── 兜底 404 ─────────────────────────────────────────────────────────────
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    redirect: '/home',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

// ── 路由守卫 ───────────────────────────────────────────────────────────────

/**
 * 全局前置守卫
 * 策略：
 * 1. 首次访问时，等待 userStore.fetchUser() 完成（恢复 Session）
 * 2. 访问需认证路由且未登录 → 重定向 /login
 * 3. 已登录访问 /login → 重定向 /home
 */
router.beforeEach(async (to) => {
  const userStore = useUserStore()

  // 首次加载：通过 /api/auth/current 恢复用户登录态
  if (!userStore.initialized) {
    await userStore.fetchUser()
  }

  const requiresAuth = to.matched.some((r) => r.meta?.requiresAuth !== false)

  if (requiresAuth && !userStore.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (to.path === '/login' && userStore.isLoggedIn) {
    return { path: '/home' }
  }

  // 角色权限：meta.roles 存在时校验
  const requiredRoles = to.meta?.roles
  if (requiredRoles && !requiredRoles.includes(userStore.role)) {
    return { path: '/home' }
  }
})

// ── 后置守卫：更新页面标题 ─────────────────────────────────────────────────
router.afterEach((to) => {
  const title = to.meta?.title
  document.title = title
    ? `${title} - 学院工作任务栏系统`
    : '学院工作任务栏系统'
})

export default router
