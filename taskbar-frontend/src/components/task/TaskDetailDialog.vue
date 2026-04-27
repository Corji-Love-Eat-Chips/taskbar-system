<template>
  <el-dialog
    v-model="visible"
    :title="task?.task_name || '任务详情'"
    width="780px"
    destroy-on-close
    :close-on-click-modal="false"
    class="task-detail-dialog"
    @closed="emit('update:modelValue', false)"
  >
    <!-- ── 标题插槽：追加 Tag ────────────────────────────────────────────── -->
    <template #header="{ titleId, titleClass }">
      <div class="dialog-header">
        <span :id="titleId" :class="titleClass" class="dialog-title">
          {{ task?.task_name || '任务详情' }}
        </span>
        <div v-if="task" class="header-badges">
          <el-tag
            :type="STATUS_MAP[task.status]?.type ?? 'info'"
            size="small"
            effect="light"
          >
            {{ STATUS_MAP[task.status]?.text ?? task.status }}
          </el-tag>
          <el-tag
            :type="PRIORITY_MAP[task.priority]?.type ?? 'info'"
            size="small"
            effect="plain"
          >
            {{ PRIORITY_MAP[task.priority]?.text ?? '-' }} 优先级
          </el-tag>
        </div>
      </div>
    </template>

    <!-- ── 主体内容 ─────────────────────────────────────────────────────── -->
    <div v-loading="loading" class="dialog-body">

      <!-- 空 / 加载失败 -->
      <el-empty v-if="!loading && !task" description="加载任务信息失败" />

      <template v-else-if="task">

        <!-- ① 基本信息 -->
        <div class="block-title">基本信息</div>
        <el-descriptions :column="4" border size="small" class="info-desc">

          <el-descriptions-item label="任务编号" :span="2">
            <span class="mono">{{ task.task_no }}</span>
          </el-descriptions-item>

          <el-descriptions-item label="所属周期" :span="2">
            {{ task.period_name || '—' }}
          </el-descriptions-item>

          <el-descriptions-item label="牵头主理人" :span="2">
            <el-icon class="inline-icon"><User /></el-icon>
            {{ task.owners_display || task.owner_name || '—' }}
          </el-descriptions-item>

          <el-descriptions-item label="辅助负责人" :span="2">
            {{ task.auxiliary_display || '—' }}
          </el-descriptions-item>

          <el-descriptions-item label="任务分类" :span="2">
            <span class="category-dot" :style="{ background: getCategoryColor(task.category) }" />
            {{ task.category }}
          </el-descriptions-item>

          <el-descriptions-item label="开始日期" :span="2">
            {{ task.start_date }}
          </el-descriptions-item>

          <el-descriptions-item label="截止日期" :span="2">
            <span :class="['date-val', dateClass(task.end_date, task.status)]">
              {{ task.end_date }}
              <el-icon v-if="isExpiring(task.end_date, task.status)" class="inline-icon">
                <Warning />
              </el-icon>
              <el-icon v-else-if="isOverdue(task.end_date, task.status)" class="inline-icon">
                <CircleCloseFilled />
              </el-icon>
            </span>
          </el-descriptions-item>

          <!-- 进度：跨 4 列，内嵌进度条 -->
          <el-descriptions-item label="完成进度" :span="4">
            <div class="progress-row">
              <el-progress
                :percentage="task.progress"
                :stroke-width="8"
                :status="task.progress === 100 ? 'success' : undefined"
                class="inline-progress"
              />
            </div>
          </el-descriptions-item>

          <!-- 协助人 -->
          <el-descriptions-item label="协助人员" :span="4">
            <template v-if="task.collaborators?.length">
              <el-tag
                v-for="c in task.collaborators"
                :key="c.staff_id"
                type="info"
                effect="light"
                size="small"
                class="collab-tag"
              >
                {{ c.name }}
              </el-tag>
            </template>
            <span v-else class="empty-val">—</span>
          </el-descriptions-item>

          <!-- 任务描述 -->
          <el-descriptions-item label="任务描述" :span="4">
            <p v-if="task.description" class="pre-text">{{ task.description }}</p>
            <span v-else class="empty-val">—</span>
          </el-descriptions-item>

          <!-- 备注 -->
          <el-descriptions-item label="备注" :span="4">
            <p v-if="task.remarks" class="pre-text">{{ task.remarks }}</p>
            <span v-else class="empty-val">—</span>
          </el-descriptions-item>

          <!-- 创建时间 -->
          <el-descriptions-item label="创建时间" :span="2">
            {{ fmtDt(task.created_at) }}
          </el-descriptions-item>

          <el-descriptions-item label="最后更新" :span="2">
            {{ fmtDt(task.updated_at) }}
          </el-descriptions-item>

        </el-descriptions>

        <!-- ② 关联待办 -->
        <div class="block-title" style="margin-top: 20px;">
          关联待办
          <span class="todo-count">
            {{ todoList.length ? `${doneCount} / ${todoList.length} 已完成` : '' }}
          </span>
        </div>

        <div v-if="todoLoading" class="todo-loading">
          <el-skeleton :rows="2" animated />
        </div>

        <template v-else-if="todoList.length">
          <ul class="todo-list">
            <li
              v-for="todo in todoList"
              :key="todo.todo_id"
              class="todo-item"
              :class="{ done: todo.status === 1 }"
            >
              <!-- 完成状态图标 -->
              <el-icon class="todo-status-icon" :class="todo.status === 1 ? 'is-done' : 'is-pending'">
                <component :is="todo.status === 1 ? CircleCheckFilled : Circle" />
              </el-icon>

              <!-- 待办名称 -->
              <span class="todo-name">{{ todo.todo_name }}</span>

              <!-- 右侧：优先级 + 截止日期 -->
              <div class="todo-meta">
                <el-tag
                  v-if="todo.priority"
                  :type="TODO_PRIORITY_MAP[todo.priority]?.type ?? 'info'"
                  size="small"
                  effect="plain"
                  class="todo-priority"
                >
                  {{ TODO_PRIORITY_MAP[todo.priority]?.text ?? todo.priority }}
                </el-tag>
                <span v-if="todo.deadline" class="todo-deadline">
                  {{ fmtDeadline(todo.deadline) }}
                </span>
              </div>
            </li>
          </ul>
        </template>

        <el-empty
          v-else
          :image-size="60"
          description="暂无关联待办"
          class="todo-empty"
        />

      </template>
    </div>

    <!-- ── 底部按钮 ─────────────────────────────────────────────────────── -->
    <template #footer>
      <el-button @click="visible = false">关 闭</el-button>
      <el-button
        v-if="canEdit"
        type="primary"
        @click="handleEdit"
      >
        <el-icon><Edit /></el-icon> 编辑任务
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import {
  User, Warning, CircleCloseFilled,
  CircleCheckFilled, Circle, Edit,
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getTaskDetail } from '@/api/task'
import { getMyTodoList } from '@/api/todo'
import { useUserStore } from '@/store/user'

// ── Props / Emits ─────────────────────────────────────────────────────────────
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  taskId:     { type: Number,  default: null },
})
const emit = defineEmits(['update:modelValue', 'edit'])

const userStore = useUserStore()

// ── 可见性 ────────────────────────────────────────────────────────────────────
const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// ── 状态 ──────────────────────────────────────────────────────────────────────
const loading     = ref(false)
const todoLoading = ref(false)
const task        = ref(null)
const todoList    = ref([])

// ── 常量映射 ──────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  pending:     { text: '待开始', type: 'info' },
  in_progress: { text: '进行中', type: '' },
  completed:   { text: '已完成', type: 'success' },
  delayed:     { text: '已延期', type: 'danger' },
  cancelled:   { text: '已取消', type: 'info' },
}

const PRIORITY_MAP = {
  high:   { text: '高', type: 'danger' },
  medium: { text: '中', type: 'warning' },
  low:    { text: '低', type: 'info' },
}

const TODO_PRIORITY_MAP = {
  urgent:    { text: '紧急', type: 'danger' },
  important: { text: '重要', type: 'warning' },
  normal:    { text: '一般', type: '' },
  low:       { text: '低',   type: 'info' },
}

const CATEGORY_COLORS = {
  '教学工作':    '#5B8DEF',
  '科研工作':    '#722ED1',
  '党建工作':    '#FF4D4F',
  '行政工作':    '#666666',
  '学生工作':    '#52C41A',
  '产业学院工作': '#FA8C16',
  '人事工作':    '#13C2C2',
}

// ── 计算属性 ──────────────────────────────────────────────────────────────────
const canEdit = computed(() => userStore.isAdmin || userStore.isLeader)

const doneCount = computed(() => todoList.value.filter(t => t.status === 1).length)

// ── 工具函数 ──────────────────────────────────────────────────────────────────
function getCategoryColor(cat) {
  return CATEGORY_COLORS[cat] ?? '#909399'
}

function fmtDt(dt) {
  return dt ? dayjs(dt).format('YYYY-MM-DD HH:mm') : '—'
}

function fmtDeadline(dt) {
  if (!dt) return ''
  return dayjs(dt).format('MM-DD HH:mm')
}

function isExpiring(endDate, status) {
  if (!endDate || ['completed', 'cancelled'].includes(status)) return false
  const diff = dayjs(endDate).diff(dayjs().startOf('day'), 'day')
  return diff >= 0 && diff <= 3
}

function isOverdue(endDate, status) {
  if (!endDate || ['completed', 'cancelled'].includes(status)) return false
  return dayjs(endDate).isBefore(dayjs().startOf('day'), 'day')
}

function dateClass(endDate, status) {
  if (isOverdue(endDate, status))  return 'overdue'
  if (isExpiring(endDate, status)) return 'expiring'
  return ''
}

// ── 数据加载 ──────────────────────────────────────────────────────────────────
async function loadTask() {
  if (!props.taskId) return
  loading.value = true
  task.value    = null
  todoList.value = []
  try {
    const res = await getTaskDetail(props.taskId)
    task.value = res.data
  } catch {
    task.value = null
  } finally {
    loading.value = false
  }

  // 加载关联待办（不阻塞主内容展示）
  loadTodos()
}

async function loadTodos() {
  if (!props.taskId) return
  todoLoading.value = true
  try {
    // 拉取当前用户在该任务下的待办（含已完成）
    const res = await getMyTodoList({ task_id: props.taskId, page: 1, pageSize: 50 })
    todoList.value = res.data?.list ?? []
    // 未完成在前，已完成在后；同组内按优先级排
    const order = { urgent: 0, important: 1, normal: 2, low: 3 }
    todoList.value.sort((a, b) => {
      if (a.status !== b.status) return a.status - b.status
      return (order[a.priority] ?? 9) - (order[b.priority] ?? 9)
    })
  } catch {
    todoList.value = []
  } finally {
    todoLoading.value = false
  }
}

// ── 编辑 ──────────────────────────────────────────────────────────────────────
function handleEdit() {
  emit('edit', task.value)
  visible.value = false
}

// ── 监听 ──────────────────────────────────────────────────────────────────────
watch(
  [() => props.modelValue, () => props.taskId],
  ([open, id]) => {
    if (open && id) loadTask()
  },
  { immediate: true },
)
</script>

<style lang="scss" scoped>
// ── 对话框覆盖 ────────────────────────────────────────────────────────────────
:deep(.el-dialog__header) {
  padding: 16px 20px 14px;
  border-bottom: 1px solid $border-light;
  margin-right: 0;
}
:deep(.el-dialog__body)   { padding: 20px; max-height: 72vh; overflow-y: auto; }
:deep(.el-dialog__footer) { padding: 12px 20px; border-top: 1px solid $border-light; }

// ── 标题行 ────────────────────────────────────────────────────────────────────
.dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: $text-primary;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-badges {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

// ── 主体 ──────────────────────────────────────────────────────────────────────
.dialog-body {
  min-height: 120px;
}

// ── 区块标题 ──────────────────────────────────────────────────────────────────
.block-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: $text-secondary;
  margin-bottom: 10px;

  &::before {
    content: '';
    display: inline-block;
    width: 3px;
    height: 14px;
    background: $primary;
    border-radius: 2px;
  }

  .todo-count {
    font-size: 12px;
    font-weight: 400;
    color: $text-disabled;
    margin-left: 4px;
  }
}

// ── Descriptions ──────────────────────────────────────────────────────────────
.info-desc {
  :deep(.el-descriptions__label) {
    width: 88px;
    white-space: nowrap;
    color: $text-secondary;
    font-size: 13px;
  }

  :deep(.el-descriptions__content) {
    font-size: 13px;
    color: $text-primary;
    vertical-align: middle;
  }
}

// 任务编号等宽字体
.mono {
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  color: $text-secondary;
}

// 分类圆点
.category-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

// 行内图标
.inline-icon {
  vertical-align: -2px;
  margin-right: 4px;
  font-size: 14px;
}

// 日期颜色
.date-val {
  display: inline-flex;
  align-items: center;
  gap: 4px;

  &.expiring { color: $warning; font-weight: 500; }
  &.overdue  { color: $danger;  font-weight: 500; }
}

// 进度行
.progress-row {
  display: flex;
  align-items: center;
  gap: 10px;

  .inline-progress { flex: 1; max-width: 420px; }
}

// 协助人标签
.collab-tag { margin-right: 6px; margin-bottom: 4px; }

// 空值占位
.empty-val { color: $text-disabled; }

// 描述中的长文本
.pre-text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.7;
  color: $text-regular;
}

// ── 待办列表 ──────────────────────────────────────────────────────────────────
.todo-loading { padding: 8px 0; }

.todo-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid $border-light;
  border-radius: 6px;
  overflow: hidden;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid $border-lighter;
  transition: background 0.15s;

  &:last-child { border-bottom: none; }
  &:hover      { background: $bg-page; }

  &.done .todo-name {
    color: $text-disabled;
    text-decoration: line-through;
  }
}

.todo-status-icon {
  font-size: 16px;
  flex-shrink: 0;

  &.is-done    { color: $success; }
  &.is-pending { color: $border-base; }
}

.todo-name {
  flex: 1;
  font-size: 13px;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.todo-priority { font-size: 11px; }

.todo-deadline {
  font-size: 12px;
  color: $text-secondary;
  white-space: nowrap;
}

.todo-empty {
  padding: 16px 0;
  border: 1px dashed $border-light;
  border-radius: 6px;
}
</style>
