/**
 * useReminder.js
 * 会议提醒 Composable
 *
 * 职责：
 *  1. 轮询后端 /api/reminders/pending（每 30 秒）
 *  2. 通过 Web Notification API 弹出系统通知
 *  3. 弹出后调用 /api/reminders/:id/acknowledged 标记已读
 *  4. 同时在页面内通过 ElNotification 显示兜底提醒（无论是否授权）
 *
 * 使用方式（在 App.vue 或根布局组件中调用一次）：
 *   import { useReminder } from '@/composables/useReminder'
 *   const { start, stop, pendingCount } = useReminder()
 *   onMounted(start)
 *   onUnmounted(stop)
 */

import { ref } from 'vue'
import { ElNotification } from 'element-plus'
import { useUserStore } from '@/store/user'
import { getPendingReminders, acknowledgeReminder } from '@/api/reminder'

// ── 轮询间隔（毫秒） ─────────────────────────────────────────────────────────
const POLL_INTERVAL = 30_000   // 30 秒

// 会议类型颜色（与日历视图保持一致）
const TYPE_COLOR = {
  all:        '#5B8DEF',
  department: '#67C23A',
  party:      '#F56C6C',
  teaching:   '#E6A23C',
  other:      '#909399',
}

const TYPE_LABEL = {
  all:        '全体会议',
  department: '部门会议',
  party:      '党务会议',
  teaching:   '教学会议',
  other:      '其他会议',
}

export function useReminder() {
  const pendingCount = ref(0)
  const pendingList  = ref([])
  let   timerId      = null
  let   notifPermission = 'default'

  // ── 请求浏览器通知权限 ─────────────────────────────────────────────────────
  async function requestNotificationPermission() {
    if (!('Notification' in window)) return 'unsupported'
    if (Notification.permission === 'granted') return 'granted'
    if (Notification.permission === 'denied')  return 'denied'
    const result = await Notification.requestPermission()
    return result
  }

  // ── 弹出系统通知 ───────────────────────────────────────────────────────────
  function fireNativeNotification(item) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    try {
      const n = new Notification(item.title, {
        body:  item.body,
        icon:  '/favicon.ico',
        tag:   `meeting-${item.meeting_id}`,  // 同一会议只弹一次
        requireInteraction: false,
      })
      // 点击通知跳转到会议页面
      n.onclick = () => {
        window.focus()
        n.close()
      }
    } catch {
      // 静默失败
    }
  }

  // ── 弹出页内 ElNotification（无论是否有系统通知权限均显示） ─────────────
  function firePageNotification(item) {
    const color = TYPE_COLOR[item.meeting_type] ?? '#5B8DEF'
    const label = TYPE_LABEL[item.meeting_type] ?? '会议'

    const msgHtml = `
      <div style="line-height:1.6;font-size:13px;">
        <div style="color:#303133;font-weight:500;margin-bottom:4px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;
                       background:${color};margin-right:6px;vertical-align:middle;"></span>
          ${escapeHtml(item.meeting_name)}
        </div>
        <div style="color:#606266;">${escapeHtml(item.body)}</div>
        ${item.location
          ? `<div style="color:#909399;font-size:12px;margin-top:4px;">📍 ${escapeHtml(item.location)}</div>`
          : ''}
      </div>`

    ElNotification({
      title:                    `${item.title} · ${label}`,
      message:                  msgHtml,
      dangerouslyUseHTMLString: true,
      type:                     'warning',
      duration:                 8000,
      position:                 'top-right',
      customClass:              'meeting-reminder-notice',
    })
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // ── 核心轮询逻辑 ──────────────────────────────────────────────────────────
  async function poll() {
    // 未登录不轮询
    const store = useUserStore()
    if (!store.isLoggedIn || !store.staffId) return

    try {
      const res  = await getPendingReminders()
      const list = res.data?.list ?? []

      pendingList.value  = list
      pendingCount.value = list.length

      for (const item of list) {
        // 先标记，避免重复弹出
        acknowledgeReminder(item.id).catch(() => null)
        // 弹出通知
        fireNativeNotification(item)
        firePageNotification(item)
      }
    } catch {
      // 网络错误静默处理
    }
  }

  // ── 启动轮询 ──────────────────────────────────────────────────────────────
  async function start() {
    notifPermission = await requestNotificationPermission()

    // 立即执行一次
    await poll()

    // 定时循环
    timerId = setInterval(poll, POLL_INTERVAL)
  }

  // ── 停止轮询 ──────────────────────────────────────────────────────────────
  function stop() {
    if (timerId) {
      clearInterval(timerId)
      timerId = null
    }
  }

  return {
    start,
    stop,
    pendingCount,
    pendingList,
    /** 手动触发一次 */
    refresh: poll,
  }
}
