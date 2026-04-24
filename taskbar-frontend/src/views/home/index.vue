<template>
  <div class="page-home">

    <!-- 欢迎横幅 -->
    <div class="welcome-banner">
      <div class="welcome-text">
        <h2>你好，{{ userStore.userInfo?.staff_name || userStore.username }} 👋</h2>
        <p>欢迎使用工作计划管理平台 · {{ todayStr }}</p>
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
                <el-skeleton-item v-if="statsLoading" variant="text" style="width:48px;height:28px" />
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
                  <el-icon style="margin-left:6px"><Location /></el-icon>
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
import { List, Calendar, Checked, Warning, Clock, Location, Minus } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getDashboardStats, getDashboardHome } from '@/api/dashboard'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()

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
.page-home { display: flex; flex-direction: column; gap: 16px; }

// ── 欢迎横幅 ─────────────────────────────────────────────────────────────────
.welcome-banner {
  background: linear-gradient(135deg, #1e3a5f, #2d6a9f);
  border-radius: 10px;
  padding: 22px 28px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;

  h2 { margin: 0 0 4px; font-size: 20px; }
  p  { margin: 0; font-size: 13px; opacity: .75; }
}

.welcome-actions { display: flex; gap: 10px; flex-shrink: 0; }

// ── 统计卡片 ─────────────────────────────────────────────────────────────────
.stat-row {
  flex-shrink: 0;

  // 四列等宽：列内 flex 撑满，避免内容多少导致卡片视觉宽度不一致
  :deep(.el-col) {
    display: flex;
    margin-bottom: 0;
  }
}

.stat-card {
  border-radius: 10px;
  flex: 1;
  width: 100%;
  min-width: 0;

  :deep(.el-card__body) { padding: 16px; }
}

.stat-inner {
  display: flex;
  align-items: center;
  gap: 14px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  font-size: 22px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-content { flex: 1; min-width: 0; }

.stat-num {
  font-size: 26px;
  font-weight: 700;
  color: $text-primary;
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 2px;
}

.stat-sub {
  font-size: 11px;
  color: $text-disabled;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed $border-lighter;
  min-height: 34px;
  line-height: 1.4;
}

// ── 下方三栏 ─────────────────────────────────────────────────────────────────
.home-panels { flex: 1; }

.panel-card {
  height: 100%;
  border-radius: 10px;

  :deep(.el-card__header) { padding: 12px 16px; }
  :deep(.el-card__body)   { padding: 8px 16px 16px; }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
  display: flex;
  align-items: center;
  gap: 6px;

  .el-icon { color: $primary; }
}

.panel-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: $text-disabled;
}

// ── 任务条目 ─────────────────────────────────────────────────────────────────
.task-item {
  padding: 10px 0;
  border-bottom: 1px solid $border-lighter;

  &:last-child { border-bottom: none; }
}

.task-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.task-name {
  font-size: 13px;
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
  gap: 8px;
}

.task-owner {
  font-size: 12px;
  color: $text-secondary;
  flex-shrink: 0;
  min-width: 40px;
}

.task-progress { flex: 1; }

.task-date {
  font-size: 12px;
  color: $text-secondary;
  flex-shrink: 0;

  &.overdue { color: $danger; }
}

// ── 会议条目 ─────────────────────────────────────────────────────────────────
.meeting-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid $border-lighter;

  &:last-child { border-bottom: none; }
}

.meeting-type-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
  margin-top: 3px;
}

.meeting-info { flex: 1; min-width: 0; }

.meeting-name {
  font-size: 13px;
  color: $text-primary;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.meeting-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: $text-secondary;

  .el-icon { font-size: 12px; }
}

// ── 待办条目 ─────────────────────────────────────────────────────────────────
.todo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid $border-lighter;

  &:last-child { border-bottom: none; }
}

.todo-priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.todo-name {
  flex: 1;
  font-size: 13px;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-deadline {
  font-size: 11px;
  color: $text-secondary;
  flex-shrink: 0;

  &.overdue { color: $danger; }
}
</style>
