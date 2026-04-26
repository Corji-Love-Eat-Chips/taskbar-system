<template>
  <div class="page-todos">

    <!-- ══ 左侧：我的任务列表 ════════════════════════════════════════════════ -->
    <aside class="task-panel">
      <div class="panel-header">
        <span class="panel-title">我的任务</span>
        <el-tooltip content="刷新" placement="top">
          <el-button text circle :loading="taskLoading" @click="loadMyTasks">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </el-tooltip>
      </div>

      <!-- 搜索 -->
      <div class="task-search">
        <el-input
          v-model="taskKeyword"
          placeholder="搜索任务…"
          clearable
          size="small"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>

      <!-- 任务列表骨架 -->
      <el-skeleton v-if="taskLoading" :rows="5" animated class="task-skeleton" />

      <!-- 按状态分组 -->
      <el-scrollbar v-else class="task-scroll">
        <div
          v-for="group in filteredTaskGroups"
          :key="group.status"
          class="task-group"
        >
          <div
            class="task-group__header"
            @click="toggleGroup(group.status)"
          >
            <el-icon class="collapse-icon" :class="{ rotated: !collapsedGroups.has(group.status) }">
              <ArrowRight />
            </el-icon>
            <span class="group-label">{{ group.label }}</span>
            <el-badge :value="group.tasks.length" type="info" class="group-badge" />
          </div>

          <transition name="slide-down">
            <div v-show="!collapsedGroups.has(group.status)" class="task-group__body">
              <div
                v-for="task in group.tasks"
                :key="task.task_id"
                class="task-item"
                :class="{ active: selectedTaskId === task.task_id }"
                @click="selectTask(task)"
              >
                <div class="task-item__name">{{ task.task_name }}</div>
                <div class="task-item__meta">
                  <el-progress
                    :percentage="task.progress"
                    :stroke-width="4"
                    :show-text="false"
                    :status="task.progress === 100 ? 'success' : undefined"
                    class="task-progress-mini"
                  />
                  <span class="task-progress-text">{{ task.progress }}%</span>
                </div>
              </div>
            </div>
          </transition>
        </div>

        <el-empty
          v-if="!taskLoading && !filteredTaskGroups.length"
          class="task-panel-empty"
          description="暂无相关任务"
        />
      </el-scrollbar>

      <!-- 纯个人待办入口 -->
      <div
        class="task-item personal-entry"
        :class="{ active: selectedTaskId === 0 }"
        @click="selectPersonal"
      >
        <el-icon><Star /></el-icon>
        <span>个人待办（无任务关联）</span>
      </div>
    </aside>

    <!-- ══ 右侧：待办列表 ════════════════════════════════════════════════════ -->
    <main class="todo-panel">

      <!-- 右侧顶部工具栏 -->
      <div class="todo-toolbar">
        <div class="toolbar-left">
          <span class="todo-title">
            {{ selectedTaskName || '全部待办' }}
          </span>
          <el-tag v-if="todoStats.total" type="info" size="small" effect="plain">
            {{ todoStats.done }} / {{ todoStats.total }} 已完成
          </el-tag>
        </div>
        <div class="toolbar-right">
          <!-- 状态筛选 -->
          <el-radio-group v-model="statusFilter" size="small" @change="applyFilter">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="pending">未完成</el-radio-button>
            <el-radio-button value="done">已完成</el-radio-button>
          </el-radio-group>

          <!-- 优先级筛选 -->
          <el-select
            v-model="priorityFilter"
            placeholder="全部优先级"
            clearable
            size="small"
            class="todo-priority-select"
            @change="applyFilter"
          >
            <el-option label="紧急" value="urgent" />
            <el-option label="重要" value="important" />
            <el-option label="一般" value="normal" />
            <el-option label="较低" value="low" />
          </el-select>

          <el-button type="primary" size="small" @click="openAddTodo">
            <el-icon><Plus /></el-icon> 新增待办
          </el-button>
        </div>
      </div>

      <!-- 待办内容区 -->
      <el-scrollbar class="todo-scroll">
        <div v-if="todoLoading" class="todo-loading-wrap">
          <el-skeleton :rows="6" animated />
        </div>

        <template v-else>
          <!-- 按优先级分组 -->
          <div
            v-for="group in todoGroups"
            :key="group.priority"
            class="todo-group"
          >
            <div class="todo-group__header" :style="{ borderLeftColor: group.color }">
              <span class="group-icon" :style="{ color: group.color }">●</span>
              <span class="group-name">{{ group.label }}</span>
              <span class="group-count">{{ group.items.length }}</span>
            </div>

            <!-- 可拖拽列表 -->
            <draggable
              v-model="group.items"
              :group="{ name: 'todos', pull: true, put: true }"
              item-key="todo_id"
              handle=".drag-handle"
              animation="200"
              ghost-class="todo-ghost"
              @end="handleDragEnd(group)"
            >
              <template #item="{ element: todo }">
                <div
                  class="todo-item"
                  :class="{ 'is-done': todo.status === 1 }"
                >
                  <!-- 拖拽把手 -->
                  <el-icon class="drag-handle">
                    <Grid />
                  </el-icon>

                  <!-- 复选框 -->
                  <el-checkbox
                    :model-value="todo.status === 1"
                    @change="(val) => handleToggle(todo, val)"
                  />

                  <!-- 名称 + 截止 -->
                  <div class="todo-content">
                    <span class="todo-name">{{ todo.todo_name }}</span>
                    <span
                      v-if="todo.deadline"
                      class="todo-deadline"
                      :class="{ overdue: isDeadlineOverdue(todo) }"
                    >
                      <el-icon><Clock /></el-icon>
                      {{ fmtDeadline(todo.deadline) }}
                    </span>
                  </div>

                  <!-- 操作 -->
                  <div class="todo-actions">
                    <el-tooltip content="删除" placement="top">
                      <el-button
                        link
                        type="danger"
                        size="small"
                        @click="handleDelete(todo)"
                      >
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </el-tooltip>
                  </div>
                </div>
              </template>
            </draggable>

            <!-- 分组内快速新增 -->
            <div
              class="todo-add-inline"
              @click="openAddTodoWithPriority(group.priority)"
            >
              <el-icon><Plus /></el-icon>
              <span>添加{{ group.label }}待办</span>
            </div>
          </div>

          <!-- 无数据 -->
          <el-empty
            v-if="!todoGroups.length && !todoLoading"
            description="暂无待办，点击右上角新增"
            class="todo-empty"
          />
        </template>
      </el-scrollbar>
    </main>

    <!-- ══ 新增待办弹窗 ═══════════════════════════════════════════════════════ -->
    <TodoFormDialog
      v-model:visible="formVisible"
      :task-id="formTaskId"
      :task-name="formTaskName"
      :initial-priority="formInitialPriority"
      @success="handleFormSuccess"
    />
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue'
import {
  Refresh, Search, ArrowRight, Star, Plus, Grid,
  Clock, Delete,
} from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import draggable from 'vuedraggable'
import dayjs from 'dayjs'
import { getTaskList } from '@/api/task'
import { getMyTodoList, toggleTodo, deleteTodo, updateTodo } from '@/api/todo'
import { useUserStore } from '@/store/user'
import TodoFormDialog from '@/components/todo/TodoFormDialog.vue'

const userStore = useUserStore()

// ═══════════════════════════════════════════════════════════════════════════════
// 一、左侧：我的任务
// ═══════════════════════════════════════════════════════════════════════════════

const taskLoading   = ref(false)
const myTasks       = ref([])
const taskKeyword   = ref('')
const collapsedGroups = reactive(new Set())

// 任务状态分组配置
const TASK_STATUS_GROUPS = [
  { status: 'in_progress', label: '进行中' },
  { status: 'pending',     label: '待开始' },
  { status: 'delayed',     label: '已延期' },
  { status: 'completed',   label: '已完成' },
  { status: 'cancelled',   label: '已取消' },
]

async function loadMyTasks() {
  taskLoading.value = true
  try {
    // 只拉取当前用户负责的任务
    const params = {
      owner_id:  userStore.staffId,
      page:      1,
      page_size: 200,
    }
    const res = await getTaskList(params)
    myTasks.value = res.data?.list ?? []
  } catch {
    myTasks.value = []
  } finally {
    taskLoading.value = false
  }
}

// 过滤 + 按状态分组
const filteredTaskGroups = computed(() => {
  const kw = taskKeyword.value.trim().toLowerCase()
  const tasks = kw
    ? myTasks.value.filter(t => t.task_name.toLowerCase().includes(kw))
    : myTasks.value

  return TASK_STATUS_GROUPS
    .map(g => ({
      ...g,
      tasks: tasks.filter(t => t.status === g.status),
    }))
    .filter(g => g.tasks.length > 0)
})

function toggleGroup(status) {
  if (collapsedGroups.has(status)) {
    collapsedGroups.delete(status)
  } else {
    collapsedGroups.add(status)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 二、右侧：待办列表
// ═══════════════════════════════════════════════════════════════════════════════

const todoLoading     = ref(false)
const allTodos        = ref([])
const selectedTaskId  = ref(null)   // null=全部, 0=个人
const selectedTask    = ref(null)

const statusFilter   = ref('all')  // 'all' | 'pending' | 'done'
const priorityFilter = ref('')

const selectedTaskName = computed(() => {
  if (selectedTaskId.value === 0) return '个人待办'
  if (selectedTask.value)         return selectedTask.value.task_name
  return ''
})

// 待办统计
const todoStats = computed(() => ({
  total: allTodos.value.length,
  done:  allTodos.value.filter(t => t.status === 1).length,
}))

// 优先级分组配置
const PRIORITY_GROUPS = [
  { priority: 'urgent',    label: '紧急',  color: '#f56c6c' },
  { priority: 'important', label: '重要',  color: '#e6a23c' },
  { priority: 'normal',    label: '一般',  color: '#409eff' },
  { priority: 'low',       label: '较低',  color: '#909399' },
]

// 经过筛选后按优先级分组（排列：未完成在前，已完成在后）
const todoGroups = computed(() => {
  let items = [...allTodos.value]

  if (statusFilter.value === 'pending') {
    items = items.filter(t => t.status === 0)
  } else if (statusFilter.value === 'done') {
    items = items.filter(t => t.status === 1)
  }
  if (priorityFilter.value) {
    items = items.filter(t => t.priority === priorityFilter.value)
  }

  return PRIORITY_GROUPS
    .map(g => ({
      ...g,
      items: items.filter(t => t.priority === g.priority),
    }))
    .filter(g => g.items.length > 0)
})

async function loadTodos() {
  todoLoading.value = true
  try {
    const params = { page: 1, pageSize: 200 }
    if (selectedTaskId.value === 0) {
      // 纯个人待办：task_id 为空（后端需支持 task_id=null 筛选，
      // 暂用不传 task_id 拉全量，前端过滤）
      params.pageSize = 200
    } else if (selectedTaskId.value != null) {
      params.task_id = selectedTaskId.value
    }
    const res = await getMyTodoList(params)
    let list = res.data?.list ?? []

    // 个人待办：过滤出无任务关联的条目
    if (selectedTaskId.value === 0) {
      list = list.filter(t => !t.task_id)
    }
    allTodos.value = list
  } catch {
    allTodos.value = []
  } finally {
    todoLoading.value = false
  }
}

function selectTask(task) {
  selectedTaskId.value = task.task_id
  selectedTask.value   = task
  loadTodos()
}

function selectPersonal() {
  selectedTaskId.value = 0
  selectedTask.value   = null
  loadTodos()
}

function applyFilter() {
  // 筛选条件变化时重新整理（不需要重新请求，客户端过滤）
}

// ─── 勾选 / 取消勾选 ─────────────────────────────────────────────────────────
async function handleToggle(todo, checked) {
  const targetStatus = checked ? 1 : 0
  // 乐观更新
  const idx = allTodos.value.findIndex(t => t.todo_id === todo.todo_id)
  if (idx !== -1) allTodos.value[idx].status = targetStatus

  try {
    await toggleTodo(todo.todo_id, targetStatus)
    // 如果当前任务关联了任务，尝试刷新左侧进度（可选）
  } catch {
    // 回滚
    if (idx !== -1) allTodos.value[idx].status = todo.status
  }
}

// ─── 删除待办 ─────────────────────────────────────────────────────────────────
async function handleDelete(todo) {
  try {
    await ElMessageBox.confirm(
      `确定删除待办「${todo.todo_name}」？`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
    await deleteTodo(todo.todo_id)
    allTodos.value = allTodos.value.filter(t => t.todo_id !== todo.todo_id)
    ElMessage.success('待办已删除')
  } catch (e) {
    if (e === 'cancel') return
  }
}

// ─── 拖拽排序 ─────────────────────────────────────────────────────────────────
async function handleDragEnd(group) {
  // 将当前组顺序写入数据库（逐条更新 sort_order）
  const updates = group.items.map((todo, idx) =>
    updateTodo(todo.todo_id, { sort_order: idx }).catch(() => null),
  )
  await Promise.allSettled(updates)
}

// ═══════════════════════════════════════════════════════════════════════════════
// 三、新增弹窗
// ═══════════════════════════════════════════════════════════════════════════════

const formVisible         = ref(false)
const formTaskId          = ref(null)
const formTaskName        = ref('')
const formInitialPriority = ref('normal')

function openAddTodo() {
  formTaskId.value          = selectedTaskId.value || null
  formTaskName.value        = selectedTask.value?.task_name ?? ''
  formInitialPriority.value = 'normal'
  formVisible.value         = true
}

function openAddTodoWithPriority(priority) {
  formTaskId.value          = selectedTaskId.value || null
  formTaskName.value        = selectedTask.value?.task_name ?? ''
  formInitialPriority.value = priority
  formVisible.value         = true
}

function handleFormSuccess() {
  loadTodos()
}

// ═══════════════════════════════════════════════════════════════════════════════
// 四、工具函数
// ═══════════════════════════════════════════════════════════════════════════════

function fmtDeadline(dt) {
  if (!dt) return ''
  const d = dayjs(dt)
  return d.format(d.year() === dayjs().year() ? 'MM-DD HH:mm' : 'YYYY-MM-DD HH:mm')
}

function isDeadlineOverdue(todo) {
  if (!todo.deadline || todo.status === 1) return false
  return dayjs(todo.deadline).isBefore(dayjs())
}

// ═══════════════════════════════════════════════════════════════════════════════
// 五、初始化
// ═══════════════════════════════════════════════════════════════════════════════
loadMyTasks()
loadTodos()   // 初始加载全部待办
</script>

<style lang="scss" scoped>
// 字号随 html rem 基准缩放（与全局小/中/大一致）

.todo-priority-select {
  width: 8.125rem;
}

// ── 页面双栏布局 ──────────────────────────────────────────────────────────────
.page-todos {
  display: flex;
  gap: 1rem;
  height: calc(100vh - 7.75rem);
  min-height: 31.25rem;
}

// ══════════════════════════════════════════════════════════════════════════════
// 左侧任务面板
// ══════════════════════════════════════════════════════════════════════════════
.task-panel {
  width: 16.25rem;
  flex-shrink: 0;
  background: $bg-card;
  border-radius: $radius-md;
  border: 1px solid $border-light;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-panel-empty {
  :deep(.el-empty__image) {
    width: 3.75rem;
    height: 3.75rem;
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem 0.625rem;
  border-bottom: 1px solid $border-lighter;

  .panel-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: $text-primary;
  }
}

.task-search {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid $border-lighter;
}

.task-skeleton { padding: 0.75rem; }

.task-scroll {
  flex: 1;
  overflow: hidden;
}

// ── 任务分组 ──────────────────────────────────────────────────────────────────
.task-group { padding-bottom: 0.25rem; }

.task-group__header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.75rem;
  cursor: pointer;
  user-select: none;
  color: $text-secondary;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.025rem;

  &:hover { background: $bg-page; }

  .collapse-icon {
    font-size: 0.75rem;
    transition: transform 0.2s;
    &.rotated { transform: rotate(90deg); }
  }

  .group-label { flex: 1; }

  .group-badge {
    :deep(.el-badge__content) {
      background: $border-base;
      color: $text-secondary;
      font-size: 0.6875rem;
      min-width: 1.125rem;
      height: 1.125rem;
      line-height: 1.125rem;
    }
  }
}

.task-group__body { padding: 0 0.5rem 0.25rem; }

// ── 任务条目 ──────────────────────────────────────────────────────────────────
.task-item {
  padding: 0.5rem 0.625rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.15s;

  &:hover    { background: $bg-page; }
  &.active   { background: $brand-surface; }

  .task-item__name {
    font-size: 0.8125rem;
    color: $text-primary;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 0.3125rem;
  }

  .task-item__meta {
    display: flex;
    align-items: center;
    gap: 0.375rem;

    .task-progress-mini { flex: 1; }
    .task-progress-text { font-size: 0.6875rem; color: $text-secondary; flex-shrink: 0; }
  }
}

// 个人待办入口
.personal-entry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid $border-lighter;
  font-size: 0.8125rem;
  color: $text-regular;
  flex-shrink: 0;

  &:hover { background: $bg-page; }
  &.active { background: $brand-surface; color: $primary; }
}

// 分组折叠动画
.slide-down-enter-active,
.slide-down-leave-active { transition: all 0.2s ease; overflow: hidden; }
.slide-down-enter-from,
.slide-down-leave-to     { max-height: 0; opacity: 0; }
.slide-down-enter-to,
.slide-down-leave-from   { max-height: 37.5rem; opacity: 1; }

// ══════════════════════════════════════════════════════════════════════════════
// 右侧待办面板
// ══════════════════════════════════════════════════════════════════════════════
.todo-panel {
  flex: 1;
  background: $bg-card;
  border-radius: $radius-md;
  border: 1px solid $border-light;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

// ── 工具栏 ────────────────────────────────────────────────────────────────────
.todo-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid $border-lighter;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex: 1;
  min-width: 0;

  .todo-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: $text-primary;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-shrink: 0;
}

// ── 待办内容区 ────────────────────────────────────────────────────────────────
.todo-scroll { flex: 1; }

.todo-loading-wrap { padding: 1.25rem; }

.todo-empty {
  padding: 2.5rem 0;

  :deep(.el-empty__image) {
    width: 5rem;
    height: 5rem;
  }
}

// ── 优先级分组 ────────────────────────────────────────────────────────────────
.todo-group {
  margin: 0.75rem 1rem;
  border: 1px solid $border-lighter;
  border-radius: 0.5rem;
  overflow: hidden;
}

.todo-group__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  background: $bg-page;
  border-left: 0.25rem solid;
  font-size: 0.75rem;
  font-weight: 600;
  color: $text-secondary;

  .group-icon { font-size: 0.5rem; }
  .group-name { flex: 1; }
  .group-count {
    font-size: 0.6875rem;
    background: $border-base;
    color: $text-secondary;
    border-radius: 0.625rem;
    padding: 0.0625rem 0.4375rem;
  }
}

// ── 待办条目 ──────────────────────────────────────────────────────────────────
.todo-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.875rem;
  border-bottom: 1px solid $border-lighter;
  transition: background 0.15s;

  &:last-of-type { border-bottom: none; }
  &:hover        { background: $bg-page; }

  &.is-done {
    .todo-name { color: $text-disabled; text-decoration: line-through; }
  }
}

// 拖拽把手
.drag-handle {
  color: $border-base;
  cursor: grab;
  font-size: 1rem;
  flex-shrink: 0;

  &:hover { color: $text-secondary; }
  &:active { cursor: grabbing; }
}

.todo-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.todo-name {
  font-size: 0.8125rem;
  color: $text-primary;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-deadline {
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  font-size: 0.75rem;
  color: $text-secondary;
  white-space: nowrap;
  flex-shrink: 0;

  &.overdue { color: $danger; }

  .el-icon { font-size: 0.75rem; }
}

.todo-actions {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.todo-item:hover .todo-actions { opacity: 1; }

// 拖拽占位样式
.todo-ghost {
  opacity: 0.4;
  background: $brand-surface;
}

// ── 分组内快速新增 ────────────────────────────────────────────────────────────
.todo-add-inline {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  font-size: 0.75rem;
  color: $text-secondary;
  cursor: pointer;
  border-top: 1px dashed $border-lighter;
  transition: all 0.15s;

  &:hover {
    color: $primary;
    background: $bg-page;
  }
}
</style>
