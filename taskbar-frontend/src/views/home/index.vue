<template>
  <div class="page-home">

    <!-- 欢迎横幅 -->
    <div class="welcome-banner">
      <div class="welcome-text">
        <h2>你好，{{ userStore.userInfo?.staff_name || userStore.username }} 👋</h2>
        <p>欢迎使用工作计划管理平台 · {{ todayStr }}</p>
      </div>
      <div class="welcome-right">
        <!-- 字号：滑动方块分段 -->
        <div class="font-size-control" role="group" aria-label="界面字号">
          <span class="font-size-control__label">
            <el-icon><Operation /></el-icon> 字号
          </span>
          <div class="font-slide" role="tablist" aria-label="小中大">
            <div
              class="font-slide__thumb"
              :style="{ transform: `translateX(${slideIndex * 100}%)` }"
            />
            <button
              v-for="opt in fontOptions"
              :key="opt.value"
              type="button"
              role="tab"
              class="font-slide__btn"
              :class="{ 'is-active': fontSize === opt.value }"
              :aria-selected="fontSize === opt.value"
              @click="setFontSize(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
        <div class="welcome-actions">
          <el-button type="primary" plain size="small" @click="$router.push('/tasks')">
            <el-icon><List /></el-icon> 查看任务
          </el-button>
          <el-button type="success" plain size="small" @click="$router.push('/meetings')">
            <el-icon><Calendar /></el-icon> 会议日历
          </el-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :xs="12" :sm="6" v-for="stat in statCards" :key="stat.key">
        <el-card class="stat-card" shadow="never" :class="{ loading: statsLoading }">
          <div class="stat-inner">
            <el-icon class="stat-icon" :style="{ color: stat.color, background: stat.bg }">
              <component :is="stat.icon" />
            </el-icon>
            <div class="stat-content">
              <div class="stat-num">
                <el-skeleton-item v-if="statsLoading" variant="text" class="stat-num-skeleton" />
                <span v-else>{{ stat.value }}</span>
              </div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>
          <div v-show="!statsLoading" class="stat-sub">
            {{ stat.sub || '\u00a0' }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 三栏：近期任务 / 即将开始的会议 / 待完成待办 -->
    <el-row :gutter="16" class="home-panels">

      <!-- 近期任务 -->
      <el-col :xs="24" :md="10">
        <el-card shadow="never" class="panel-card">
          <template #header>
            <div class="panel-header">
              <span class="panel-title"><el-icon><List /></el-icon> 进行中任务</span>
              <el-button link size="small" @click="$router.push('/tasks')">查看全部</el-button>
            </div>
          </template>
          <el-skeleton :rows="4" animated v-if="homeLoading" />
          <template v-else>
            <div v-if="!recentTasks.length" class="panel-empty">暂无进行中任务</div>
            <div
              v-for="task in recentTasks"
              :key="task.task_id"
              class="task-item"
            >
              <div class="task-item__top">
                <span class="task-name">{{ task.task_name }}</span>
                <el-tag
                  :type="PRIORITY_MAP[task.priority]?.type ?? 'info'"
                  size="small"
                  effect="plain"
                >{{ PRIORITY_MAP[task.priority]?.text ?? '-' }}</el-tag>
              </div>
              <div class="task-item__bottom">
                <span class="task-owner">{{ task.owner_name }}</span>
                <el-progress
                  :percentage="task.progress"
                  :stroke-width="5"
                  :show-text="false"
                  :status="task.progress === 100 ? 'success' : undefined"
                  class="task-progress"
                />
                <span
                  class="task-date"
                  :class="{ overdue: isOverdue(task.end_date, task.status) }"
                >{{ task.end_date }}</span>
              </div>
            </div>
          </template>
        </el-card>
      </el-col>

      <!-- 即将开始的会议 -->
      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="panel-card">
          <template #header>
            <div class="panel-header">
              <span class="panel-title"><el-icon><Calendar /></el-icon> 近期会议</span>
              <el-button link size="small" @click="$router.push('/meetings')">查看全部</el-button>
            </div>
          </template>
          <el-skeleton :rows="4" animated v-if="homeLoading" />
          <template v-else>
            <div v-if="!upcomingMeetings.length" class="panel-empty">近期暂无会议安排</div>
            <div
              v-for="m in upcomingMeetings"
              :key="m.meeting_id"
              class="meeting-item"
            >
              <span
                class="meeting-type-dot"
                :style="{ background: TYPE_COLOR[m.meeting_type] ?? '#909399' }"
              />
              <div class="meeting-info">
                <div class="meeting-name">{{ m.meeting_name }}</div>
                <div class="meeting-meta">
                  <el-icon><Clock /></el-icon>
                  {{ fmtTime(m.start_time) }}
                  <el-icon class="meeting-meta__loc-icon"><Location /></el-icon>
                  {{ m.location }}
                </div>
              </div>
            </div>
          </template>
        </el-card>
      </el-col>

      <!-- 待完成待办 -->
      <el-col :xs="24" :md="6">
        <el-card shadow="never" class="panel-card">
          <template #header>
            <div class="panel-header">
              <span class="panel-title"><el-icon><Checked /></el-icon> 我的待办</span>
              <el-button link size="small" @click="$router.push('/todos')">查看全部</el-button>
            </div>
          </template>
          <el-skeleton :rows="4" animated v-if="homeLoading" />
          <template v-else>
            <div v-if="!pendingTodos.length" class="panel-empty">暂无待完成待办</div>
            <div
              v-for="td in pendingTodos"
              :key="td.todo_id"
              class="todo-item"
            >
              <span
                class="todo-priority-dot"
                :style="{ background: PRIORITY_COLOR[td.priority] ?? '#909399' }"
              />
              <span class="todo-name">{{ td.todo_name }}</span>
              <span
                v-if="td.deadline"
                class="todo-deadline"
                :class="{ overdue: isTodoOverdue(td) }"
              >{{ fmtDate(td.deadline) }}</span>
            </div>
          </template>
        </el-card>
      </el-col>
    </el-row>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { List, Calendar, Checked, Warning, Clock, Location, Minus, Operation } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getDashboardStats, getDashboardHome } from '@/api/dashboard'
import { useUserStore } from '@/store/user'
import { useAppFontSize } from '@/composables/useAppFontSize'

const userStore = useUserStore()

const { fontSize, setFontSize, slideIndex } = useAppFontSize()
const fontOptions = [
  { value: 'sm', label: '小' },
  { value: 'md', label: '中' },
  { value: 'lg', label: '大' },
]

// ── 常量 ──────────────────────────────────────────────────────────────────────
const PRIORITY_MAP = {
  high:   { text: '高', type: 'danger'   },
  medium: { text: '中', type: 'warning'  },
  low:    { text: '低', type: 'info'     },
}

const PRIORITY_COLOR = {
  urgent:    '#f56c6c',
  important: '#e6a23c',
  normal:    '#409eff',
  low:       '#909399',
}

const TYPE_COLOR = {
  all:        '#5B8DEF',
  department: '#67C23A',
  party:      '#F56C6C',
  teaching:   '#E6A23C',
  other:      '#909399',
}

// ── 今天日期 ──────────────────────────────────────────────────────────────────
const todayStr = dayjs().format('YYYY年MM月DD日 dddd')

// ── 统计数据 ──────────────────────────────────────────────────────────────────
const statsLoading = ref(true)
const stats        = ref(null)

const statCards = computed(() => [
  {
    key:   'in_progress',
    label: '进行中任务',
    value: stats.value?.tasks.in_progress ?? '--',
    sub:   stats.value ? `共 ${stats.value.tasks.total} 个任务` : null,
    icon:  List,
    color: '#409eff',
    bg:    '#ecf5ff',
  },
  {
    key:   'week_meeting',
    label: '本周会议',
    value: stats.value?.meetings.week_count ?? '--',
    sub:   stats.value ? '本周教学周内场次' : '',
    icon:  Calendar,
    color: '#67c23a',
    bg:    '#f0f9eb',
  },
  {
    key:   'pending_todo',
    label: '待完成待办',
    value: stats.value?.todos.pending ?? '--',
    sub:   stats.value ? `共 ${stats.value.todos.total} 个待办` : null,
    icon:  Checked,
    color: '#e6a23c',
    bg:    '#fdf6ec',
  },
  {
    key:   'overdue',
    label: '即将逾期',
    value: stats.value?.tasks.overdue ?? '--',
    sub:   stats.value ? '截止日临近未完成任务' : '',
    icon:  Warning,
    color: '#f56c6c',
    bg:    '#fef0f0',
  },
])

// ── 首页聚合数据 ───────────────────────────────────────────────────────────────
const homeLoading     = ref(true)
const recentTasks     = ref([])
const upcomingMeetings = ref([])
const pendingTodos    = ref([])

// ── 工具函数 ──────────────────────────────────────────────────────────────────
function isOverdue(date, status) {
  if (!date || status === 'completed' || status === 'cancelled') return false
  return dayjs(date).isBefore(dayjs(), 'day')
}
function isTodoOverdue(td) {
  if (!td.deadline || td.status === 1) return false
  return dayjs(td.deadline).isBefore(dayjs())
}
function fmtTime(dt) {
  if (!dt) return ''
  const d = dayjs(dt)
  return d.year() === dayjs().year()
    ? d.format('MM-DD HH:mm')
    : d.format('YYYY-MM-DD HH:mm')
}
function fmtDate(dt) {
  if (!dt) return ''
  return dayjs(dt).format('MM-DD')
}

// ── 加载数据 ──────────────────────────────────────────────────────────────────
async function loadStats() {
  statsLoading.value = true
  try {
    const res = await getDashboardStats()
    stats.value = res.data
  } catch {
    // 静默
  } finally {
    statsLoading.value = false
  }
}

async function loadHome() {
  homeLoading.value = true
  try {
    const res = await getDashboardHome()
    recentTasks.value      = res.data?.recent_tasks      ?? []
    upcomingMeetings.value = res.data?.upcoming_meetings ?? []
    pendingTodos.value     = res.data?.pending_todos     ?? []
  } catch {
    // 静默
  } finally {
    homeLoading.value = false
  }
}

onMounted(() => {
  loadStats()
  loadHome()
})
</script>

<style lang="scss" scoped>
// 字号随全局 html 基准（小/中/大）缩放，勿写死 px
.page-home { display: flex; flex-direction: column; gap: 1rem; }

// ── 欢迎横幅 ─────────────────────────────────────────────────────────────────
.welcome-banner {
  background: linear-gradient(135deg, #1e3a5f, #2d6a9f);
  border-radius: 0.625rem;
  padding: 1.375rem 1.75rem;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;

  h2 { margin: 0 0 0.25rem; font-size: 1.25rem; }
  p  { margin: 0; font-size: 0.8125rem; opacity: .75; }
}

.welcome-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.875rem 1rem;
  flex-shrink: 0;
}

.welcome-actions { display: flex; gap: 0.625rem; flex-shrink: 0; }

// ── 首页字号：滑动方块分段 ───────────────────────────────────────────────────
.font-size-control {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.font-size-control__label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
  white-space: nowrap;
  opacity: 0.95;

  .el-icon { font-size: 0.875rem; }
}

.font-slide {
  position: relative;
  display: flex;
  width: 9.75rem;
  height: 2rem;
  padding: 0.1875rem;
  border-radius: 0.625rem;
  background: rgba(0, 0, 0, 0.22);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.font-slide__thumb {
  position: absolute;
  top: 0.1875rem;
  left: 0.1875rem;
  width: calc((100% - 0.375rem) / 3);
  height: calc(100% - 0.375rem);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.5) inset;
  pointer-events: none;
  z-index: 0;
  transition: transform 0.32s cubic-bezier(0.34, 1.2, 0.64, 1);
}

.font-slide__btn {
  position: relative;
  z-index: 1;
  flex: 1;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.65);
  cursor: pointer;
  border-radius: 0.5rem;
  transition: color 0.2s ease;

  &:hover {
    color: rgba(255, 255, 255, 0.92);
  }

  &.is-active {
    color: #1e3a5f;
  }

  &:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.85);
    outline-offset: 2px;
  }
}

// ── 统计卡片 ─────────────────────────────────────────────────────────────────
.stat-row {
  flex-shrink: 0;

  // 四列等宽：列内 flex 撑满，避免内容多少导致卡片视觉宽度不一致
  :deep(.el-col) {
    display: flex;
    margin-bottom: 0;
  }
}

.stat-num-skeleton {
  width: 3rem;
  height: 1.75rem;
}

.stat-card {
  border-radius: 0.625rem;
  flex: 1;
  width: 100%;
  min-width: 0;

  :deep(.el-card__body) { padding: 1rem; }
}

.stat-inner {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.stat-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.625rem;
  font-size: 1.375rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-content { flex: 1; min-width: 0; }

.stat-num {
  font-size: 1.625rem;
  font-weight: 700;
  color: $text-primary;
  line-height: 1.2;
}

.stat-label {
  font-size: 0.75rem;
  color: $text-secondary;
  margin-top: 0.125rem;
}

.stat-sub {
  font-size: 0.6875rem;
  color: $text-disabled;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed $border-lighter;
  min-height: 2.125rem;
  line-height: 1.4;
}

// ── 下方三栏 ─────────────────────────────────────────────────────────────────
.home-panels { flex: 1; }

.panel-card {
  height: 100%;
  border-radius: 0.625rem;

  :deep(.el-card__header) { padding: 0.75rem 1rem; }
  :deep(.el-card__body)   { padding: 0.5rem 1rem 1rem; }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: $text-primary;
  display: flex;
  align-items: center;
  gap: 0.375rem;

  .el-icon { color: $primary; }
}

.panel-empty {
  padding: 1.5rem 0;
  text-align: center;
  font-size: 0.8125rem;
  color: $text-disabled;
}

// ── 任务条目 ─────────────────────────────────────────────────────────────────
.task-item {
  padding: 0.625rem 0;
  border-bottom: 1px solid $border-lighter;

  &:last-child { border-bottom: none; }
}

.task-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.task-name {
  font-size: 0.8125rem;
  color: $text-primary;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.task-item__bottom {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.task-owner {
  font-size: 0.75rem;
  color: $text-secondary;
  flex-shrink: 0;
  min-width: 2.5rem;
}

.task-progress { flex: 1; }

.task-date {
  font-size: 0.75rem;
  color: $text-secondary;
  flex-shrink: 0;

  &.overdue { color: $danger; }
}

// ── 会议条目 ─────────────────────────────────────────────────────────────────
.meeting-item {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.625rem 0;
  border-bottom: 1px solid $border-lighter;

  &:last-child { border-bottom: none; }
}

.meeting-type-dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.1875rem;
  flex-shrink: 0;
  margin-top: 0.1875rem;
}

.meeting-info { flex: 1; min-width: 0; }

.meeting-name {
  font-size: 0.8125rem;
  color: $text-primary;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0.25rem;
}

.meeting-meta {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: $text-secondary;

  .el-icon { font-size: 0.75rem; }

  .meeting-meta__loc-icon { margin-left: 0.375rem; }
}

// ── 待办条目 ─────────────────────────────────────────────────────────────────
.todo-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid $border-lighter;

  &:last-child { border-bottom: none; }
}

.todo-priority-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.todo-name {
  flex: 1;
  font-size: 0.8125rem;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-deadline {
  font-size: 0.6875rem;
  color: $text-secondary;
  flex-shrink: 0;

  &.overdue { color: $danger; }
}
</style>
