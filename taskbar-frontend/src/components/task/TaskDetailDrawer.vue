<template>
  <el-dialog
    v-model="visible"
    class="task-detail-dialog"
    width="92%"
    top="4vh"
    align-center
    destroy-on-close
    :close-on-click-modal="false"
    append-to-body
    @closed="emit('update:modelValue', false)"
  >
    <!-- 自定义标题 -->
    <template #header>
      <div class="dialog-header">
        <span class="dialog-title">{{ task?.task_name || '任务详情' }}</span>
        <div v-if="task" class="header-tags">
          <el-tag :type="STATUS_MAP[task.status]?.type ?? 'info'" size="small" effect="light">
            {{ STATUS_MAP[task.status]?.text ?? task.status }}
          </el-tag>
        </div>
      </div>
    </template>

    <!-- 加载骨架 -->
    <div v-if="loading" class="dialog-body">
      <el-skeleton :rows="10" animated />
    </div>

    <!-- 内容 -->
    <div v-else-if="task" class="dialog-body">

      <!-- 基本信息 -->
      <section class="detail-section">
        <div class="section-title">基本信息</div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="任务编号" :span="2">
            <span class="task-no">{{ task.task_no }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="牵头主理人">{{ task.owners_display || task.owner_name || '—' }}</el-descriptions-item>
          <el-descriptions-item label="辅助负责人">{{ task.auxiliary_display || '—' }}</el-descriptions-item>
          <el-descriptions-item label="所属周期">{{ task.period_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="优先级">
            <el-tag :type="PRIORITY_MAP[task.priority]?.type ?? 'info'" size="small" effect="plain">
              {{ PRIORITY_MAP[task.priority]?.text ?? '-' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="任务分类">
            <span
              class="category-dot"
              :style="{ background: getCategoryColor(task.category) }"
            />
            {{ task.category }}
          </el-descriptions-item>
          <el-descriptions-item label="开始日期">{{ task.start_date }}</el-descriptions-item>
          <el-descriptions-item label="截止日期">
            <span :class="dateClass(task.end_date, task.status)">
              {{ task.end_date }}
              <el-icon v-if="isExpiring(task.end_date, task.status)" style="margin-left:4px"><Warning /></el-icon>
            </span>
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <!-- 相关文件（紧接基本信息，便于发现） -->
      <section class="detail-section">
        <TaskFilesPanel
          :task-id="task.task_id"
          :can-manage="canManageTaskFiles"
        />
      </section>

      <!-- 进度 -->
      <section class="detail-section">
        <div class="section-title">完成进度</div>
        <el-progress
          :percentage="task.progress"
          :status="task.progress === 100 ? 'success' : undefined"
          :stroke-width="12"
          class="task-progress"
        />

        <!-- 有权限时显示进度调节 -->
        <div v-if="canUpdateProgress" class="progress-editor">
          <span class="editor-label">调整进度</span>
          <el-slider
            v-model="newProgress"
            :min="0"
            :max="100"
            :step="5"
            show-input
            input-size="small"
            class="progress-slider"
          />
          <el-button
            type="primary"
            size="small"
            :loading="saving"
            :disabled="newProgress === task.progress"
            @click="saveProgress"
          >
            保存
          </el-button>
        </div>
      </section>

      <!-- 协助人 -->
      <section v-if="task.collaborators?.length" class="detail-section">
        <div class="section-title">协助人员</div>
        <div class="tag-list">
          <el-tag
            v-for="c in task.collaborators"
            :key="c.staff_id"
            type="info"
            effect="light"
          >{{ c.name }}</el-tag>
        </div>
      </section>

      <!-- 任务描述 -->
      <section v-if="task.description" class="detail-section">
        <div class="section-title">任务描述</div>
        <p class="text-content">{{ task.description }}</p>
      </section>

      <!-- 备注 -->
      <section v-if="task.remarks" class="detail-section">
        <div class="section-title">备注</div>
        <p class="text-content">{{ task.remarks }}</p>
      </section>

      <!-- 时间戳 -->
      <div class="timestamps">
        <span>创建：{{ fmtDt(task.created_at) }}</span>
        <span>更新：{{ fmtDt(task.updated_at) }}</span>
      </div>
    </div>

    <!-- 空状态 -->
    <el-empty v-else description="加载失败" />

    <!-- 底部按钮 -->
    <template #footer>
      <el-button @click="visible = false">关 闭</el-button>
      <el-button v-if="canEdit" type="primary" @click="handleEdit">
        <el-icon><Edit /></el-icon> 编辑任务
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Warning, Edit } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { getTaskDetail, updateTaskProgress } from '@/api/task'
import { useUserStore } from '@/store/user'
import TaskFilesPanel from './TaskFilesPanel.vue'

// ── Props / Emits ─────────────────────────────────────────────────────────────
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  taskId:     { type: Number,  default: null },
})
const emit = defineEmits(['update:modelValue', 'edit', 'refresh'])

const userStore = useUserStore()

// ── 可见性双向绑定 ─────────────────────────────────────────────────────────────
const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// ── 状态 ──────────────────────────────────────────────────────────────────────
const loading   = ref(false)
const saving    = ref(false)
const task      = ref(null)
const newProgress = ref(0)

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

const CATEGORY_COLORS = {
  '教学工作':    '#5B8DEF',
  '科研工作':    '#722ED1',
  '党建工作':    '#FF4D4F',
  '行政工作':    '#666666',
  '学生工作':    '#52C41A',
  '产业学院工作': '#FA8C16',
  '人事工作':    '#13C2C2',
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────
function getCategoryColor(cat) {
  return CATEGORY_COLORS[cat] ?? '#909399'
}

function fmtDt(dt) {
  return dt ? dayjs(dt).format('YYYY-MM-DD HH:mm') : '-'
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
  if (isOverdue(endDate, status)) return 'date-overdue'
  if (isExpiring(endDate, status)) return 'date-expiring'
  return ''
}

// ── 权限 ──────────────────────────────────────────────────────────────────────
const canEdit = computed(() => userStore.isAdmin || userStore.isLeader)

function teacherIsTaskParticipant(t) {
  const sid = userStore.staffId
  if (sid == null) return false
  if (t.owner_id === sid) return true
  if (t.co_leads?.some((c) => c.staff_id === sid)) return true
  if (t.auxiliary_owners?.some((c) => c.staff_id === sid)) return true
  if (t.collaborators?.some((c) => c.staff_id === sid)) return true
  return false
}

const canUpdateProgress = computed(() => {
  if (!task.value) return false
  if (userStore.isAdmin) return true
  if (userStore.role === 'teacher') {
    return teacherIsTaskParticipant(task.value)
  }
  return false
})

/** 任务附件：管理员/领导/负责人/协助人可上传、删除；全员可读见下方列表（由接口按任务可见性限制） */
const canManageTaskFiles = computed(() => {
  if (!task.value) return false
  if (userStore.isAdmin || userStore.isLeader) return true
  if (userStore.role === 'teacher') {
    return teacherIsTaskParticipant(task.value)
  }
  return false
})

// ── 数据加载 ──────────────────────────────────────────────────────────────────
async function loadTask() {
  if (!props.taskId) return
  loading.value = true
  task.value = null
  try {
    const res = await getTaskDetail(props.taskId)
    task.value = res.data
    newProgress.value = res.data.progress
  } catch {
    task.value = null
  } finally {
    loading.value = false
  }
}

// ── 更新进度 ──────────────────────────────────────────────────────────────────
async function saveProgress() {
  if (!task.value) return
  saving.value = true
  try {
    const res = await updateTaskProgress(task.value.task_id, newProgress.value)
    task.value = res.data
    newProgress.value = res.data.progress
    ElMessage.success('进度已更新')
    emit('refresh')
  } catch {
    // request.js 拦截器统一弹错误
  } finally {
    saving.value = false
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
// ── 居中弹窗：宽屏展示，避免侧栏过窄 ───────────────────────────────────────────
:deep(.task-detail-dialog.el-dialog) {
  max-width: min(1100px, 96vw);
  display: flex;
  flex-direction: column;
  margin: 4vh auto !important;
  max-height: 92vh;
}

:deep(.task-detail-dialog .el-dialog__header) {
  margin: 0;
  padding: 16px 20px;
  border-bottom: 1px solid $border-light;
  flex-shrink: 0;
}

:deep(.task-detail-dialog .el-dialog__body) {
  padding: 0;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

:deep(.task-detail-dialog .el-dialog__footer) {
  padding: 12px 20px;
  border-top: 1px solid $border-light;
  text-align: right;
  flex-shrink: 0;
}

// ── 标题区 ────────────────────────────────────────────────────────────────────
.dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
  padding-right: 28px;

  .dialog-title {
    font-size: 17px;
    font-weight: 600;
    color: $text-primary;
    line-height: 1.4;
    flex: 1;
    min-width: 0;
  }

  .header-tags {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
}

// ── 主体（可滚动）──────────────────────────────────────────────────────────
.dialog-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  max-height: min(78vh, 900px);
}

// ── 分区 ──────────────────────────────────────────────────────────────────────
.detail-section {
  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: $text-secondary;
    margin-bottom: 10px;
    display: flex;
    align-items: center;

    &::before {
      content: '';
      display: inline-block;
      width: 3px;
      height: 14px;
      background: $primary;
      border-radius: 2px;
      margin-right: 8px;
    }
  }
}

// ── descriptions 覆盖 ─────────────────────────────────────────────────────────
:deep(.el-descriptions__label) {
  white-space: nowrap;
  color: $text-secondary;
  width: 80px;
}

.task-no {
  font-family: monospace;
  font-size: 12px;
  color: $text-secondary;
}

// ── 分类圆点 ──────────────────────────────────────────────────────────────────
.category-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

// ── 日期颜色 ──────────────────────────────────────────────────────────────────
.date-expiring {
  color: $warning;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
}
.date-overdue {
  color: $danger;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
}

// ── 进度 ──────────────────────────────────────────────────────────────────────
.task-progress { margin-bottom: 12px; }

.progress-editor {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: $bg-page;
  border-radius: 8px;

  .editor-label {
    font-size: 13px;
    color: $text-secondary;
    white-space: nowrap;
  }

  .progress-slider { flex: 1; }
}

// ── 标签列表 ──────────────────────────────────────────────────────────────────
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

// ── 文本内容 ──────────────────────────────────────────────────────────────────
.text-content {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: $text-regular;
  white-space: pre-wrap;
  background: $bg-page;
  padding: 12px 14px;
  border-radius: 6px;
}

// ── 时间戳 ────────────────────────────────────────────────────────────────────
.timestamps {
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: $text-disabled;
  padding-top: 4px;
  border-top: 1px dashed $border-lighter;
}
</style>
