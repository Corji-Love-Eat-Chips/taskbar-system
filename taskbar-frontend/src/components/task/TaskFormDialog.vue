<template>
  <el-dialog
    v-model="modelVisible"
    :title="isEdit ? '编辑任务' : '新增任务'"
    destroy-on-close
    :close-on-click-modal="false"
    class="task-form-dialog"
    @closed="handleClosed"
  >
    <!-- 加载骨架（编辑时拉取数据中） -->
    <div v-if="detailLoading" class="form-loading">
      <el-skeleton :rows="8" animated />
    </div>

    <el-form
      v-else
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="task-form task-form--relaxed"
    >
      <!-- 基本信息 -->
      <div class="form-section">
        <div class="section-title">基本信息</div>
        <el-form-item label="任务名称" prop="task_name" class="form-item-tight-bottom">
          <el-input
            v-model="form.task_name"
            placeholder="请输入任务名称"
            maxlength="100"
            show-word-limit
            clearable
            size="large"
          />
        </el-form-item>
      </div>

      <!-- 人员与周期 -->
      <div class="form-section">
        <div class="section-title">人员与周期</div>
        <el-row :gutter="24">
          <el-col :xs="24" :md="14">
            <el-form-item prop="lead_owner_ids" class="form-item-tight-bottom">
              <template #label>
                <div class="label-stack">
                  <span>负责人</span>
                  <span class="field-hint">可多选；选中的第一项为主负责人</span>
                </div>
              </template>
              <el-select
                v-model="form.lead_owner_ids"
                placeholder="请选择（至少一人）"
                filterable
                multiple
                :collapse-tags="false"
                class="full-width select-collaborators-multiline"
              >
                <el-option
                  v-for="s in staffList"
                  :key="s.staff_id"
                  :label="s.name"
                  :value="s.staff_id"
                >
                  <span class="opt-name">{{ s.name }}</span>
                  <span class="opt-dept">{{ s.department }}</span>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="10">
            <el-form-item label="所属周期" prop="period_id" class="form-item-tight-bottom">
              <PeriodSelect
                v-model="form.period_id"
                :auto-select-current="!isEdit"
                class="full-width"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item prop="helper_staff_ids" class="form-item-last-in-section">
          <template #label>
            <div class="label-stack">
              <span>协助人员</span>
              <span class="field-hint">可选；不含负责人，保存后为任务协助人</span>
            </div>
          </template>
          <el-select
            v-model="form.helper_staff_ids"
            placeholder="可选，支持多人"
            filterable
            multiple
            :collapse-tags="false"
            class="full-width select-collaborators-multiline"
          >
            <el-option
              v-for="s in helperStaffOptions"
              :key="s.staff_id"
              :label="s.name"
              :value="s.staff_id"
            >
              <span class="opt-name">{{ s.name }}</span>
              <span class="opt-dept">{{ s.department }}</span>
            </el-option>
          </el-select>
        </el-form-item>
      </div>

      <!-- 时间、分类与优先级 -->
      <div class="form-section">
        <div class="section-title">时间、分类与优先级</div>
        <el-row :gutter="24">
          <el-col :xs="24" :sm="24" :md="8">
            <el-form-item label="任务分类" prop="category" class="form-item-tight-bottom">
              <el-select
                v-model="form.category"
                placeholder="请选择"
                clearable
                class="full-width"
              >
                <el-option
                  v-for="cat in CATEGORIES"
                  :key="cat.name"
                  :label="cat.name"
                  :value="cat.name"
                >
                  <span class="category-dot" :style="{ background: cat.color }" />
                  {{ cat.name }}
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="开始日期" prop="start_date" class="form-item-tight-bottom">
              <el-date-picker
                v-model="form.start_date"
                type="date"
                placeholder="开始日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                :disabled-date="disableAfterEnd"
                class="full-width"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :md="8">
            <el-form-item label="截止日期" prop="end_date" class="form-item-tight-bottom">
              <el-date-picker
                v-model="form.end_date"
                type="date"
                placeholder="截止日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                :disabled-date="disableBeforeStart"
                class="full-width"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="优先级" prop="priority" class="form-item-last-in-section">
          <el-radio-group v-model="form.priority" class="priority-group priority-group--spaced">
            <el-radio-button value="high">
              <el-icon class="priority-icon"><CaretTop /></el-icon> 高
            </el-radio-button>
            <el-radio-button value="medium">
              <el-icon class="priority-icon"><Minus /></el-icon> 中
            </el-radio-button>
            <el-radio-button value="low">
              <el-icon class="priority-icon"><CaretBottom /></el-icon> 低
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
      </div>

      <!-- 补充说明 -->
      <div class="form-section">
        <div class="section-title">补充说明</div>
        <el-form-item label="任务描述" prop="description" class="form-item-tight-bottom">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            placeholder="任务目标与要求（可选）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <template v-if="isEdit">
          <el-row :gutter="24">
            <el-col :xs="24" :md="12">
              <el-form-item label="任务状态" prop="status" class="form-item-tight-bottom">
                <el-select v-model="form.status" class="full-width">
                  <el-option label="待开始" value="pending" />
                  <el-option label="进行中" value="in_progress" />
                  <el-option label="已完成" value="completed" />
                  <el-option label="已延期" value="delayed" />
                  <el-option label="已取消" value="cancelled" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-form-item label="完成进度 %" prop="progress" class="form-item-tight-bottom">
                <el-input-number
                  v-model="form.progress"
                  :min="0"
                  :max="100"
                  :step="5"
                  controls-position="right"
                  class="full-width"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </template>

        <el-form-item label="备注" class="form-item-last-in-section">
          <el-input
            v-model="form.remarks"
            type="textarea"
            :rows="3"
            placeholder="其他说明（可选）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </div>
    </el-form>

    <!-- 编辑任务时：与列表/详情中一致，可管理本任务附件 -->
    <div v-if="isEdit && taskId && !detailLoading" class="task-files-outer">
      <TaskFilesPanel
        :task-id="taskId"
        :can-manage="canManageTaskFiles"
      />
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <el-button :disabled="detailLoading" @click="modelVisible = false">
        取 消
      </el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="detailLoading"
        @click="handleSubmit"
      >
        {{ isEdit ? '保 存' : '创 建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CaretTop, Minus, CaretBottom } from '@element-plus/icons-vue'
import PeriodSelect from '@/components/common/PeriodSelect.vue'
import { getTaskDetail, createTask, updateTask } from '@/api/task'
import { getStaffAll } from '@/api/staff'
import { useUserStore } from '@/store/user'
import TaskFilesPanel from '@/components/task/TaskFilesPanel.vue'

// ── v-model（与父级 v-model 对齐，不能用单独的 visible prop）──────────────────
const modelVisible = defineModel({ type: Boolean, default: false })

// ── Props / Emits ─────────────────────────────────────────────────────────────
const props = defineProps({
  /** 编辑时传入任务 ID，新增时为 null */
  taskId: { type: Number, default: null },
})

const emit = defineEmits(['success'])

const userStore = useUserStore()

// ── 是否编辑模式 ──────────────────────────────────────────────────────────────
const isEdit = computed(() => !!props.taskId)

/** 教师新建任务时负责人固定为本人（与后端一致） */
const lockOwnerForTeacher = computed(
  () => !isEdit.value && userStore.role === 'teacher',
)

// ── 常量 ──────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { name: '教学工作',    color: '#5B8DEF' },
  { name: '科研工作',    color: '#722ED1' },
  { name: '党建工作',    color: '#FF4D4F' },
  { name: '行政工作',    color: '#666666' },
  { name: '学生工作',    color: '#52C41A' },
  { name: '产业学院工作', color: '#FA8C16' },
  { name: '人事工作',    color: '#13C2C2' },
]

// ── 人员数据 ──────────────────────────────────────────────────────────────────
const staffList = ref([])

async function loadStaff() {
  try {
    const res = await getStaffAll()
    const rows = res?.data
    staffList.value = Array.isArray(rows) ? rows : []
  } catch {
    staffList.value = []
  }
}

function defaultForm() {
  return {
    task_name:        '',
    lead_owner_ids:   [],
    helper_staff_ids: [],
    period_id:        null,
    category:         '',
    priority:         'medium',
    start_date:       '',
    end_date:         '',
    description:      '',
    status:           'pending',
    progress:         0,
    remarks:          '',
  }
}

const form = reactive(defaultForm())

/** 协助人员候选：排除所有负责人（可多选）已选人员 */
const helperStaffOptions = computed(() => {
  const lead = new Set(form.lead_owner_ids || [])
  return staffList.value.filter((s) => !lead.has(s.staff_id))
})

watch(
  () => [...(form.lead_owner_ids || [])],
  (ids) => {
    let leads = [...ids]
    if (lockOwnerForTeacher.value) {
      const sid = userStore.staffId
      if (sid != null) {
        const rest = leads.filter((id) => id !== sid)
        leads = [sid, ...rest]
      }
    }
    const set = new Set(leads)
    const helperNext = (form.helper_staff_ids || []).filter((i) => !set.has(i))
    if (helperNext.length !== (form.helper_staff_ids || []).length) {
      form.helper_staff_ids = helperNext
    }
    const same =
      leads.length === ids.length && leads.every((v, i) => v === ids[i])
    if (!same) {
      form.lead_owner_ids = leads
    }
  },
  { deep: true },
)

// ── 表单数据 ──────────────────────────────────────────────────────────────────
const formRef    = ref(null)
const submitting  = ref(false)
const detailLoading = ref(false)

/** 与任务详情抽屉一致：管理员/领导/负责人/协助人可上传、删除 */
const canManageTaskFiles = computed(() => {
  if (!isEdit.value) return false
  if (userStore.isAdmin || userStore.isLeader) return true
  if (userStore.role === 'teacher') {
    const sid = userStore.staffId
    if (sid == null) return false
    if ((form.lead_owner_ids || []).includes(sid)) return true
    return (form.helper_staff_ids || []).includes(sid)
  }
  return false
})

// ── 表单校验规则 ──────────────────────────────────────────────────────────────
const rules = {
  task_name: [
    { required: true, message: '请输入任务名称', trigger: 'blur' },
    { max: 100,       message: '任务名称不超过 100 字', trigger: 'blur' },
  ],
  lead_owner_ids: [
    {
      type: 'array',
      required: true,
      message: '请至少选择一名负责人',
      trigger: 'change',
    },
    {
      validator: (_rule, val, callback) => {
        if (!Array.isArray(val) || val.length < 1) {
          callback(new Error('请至少选择一名负责人'))
        } else {
          callback()
        }
      },
      trigger: 'change',
    },
  ],
  category: [
    { required: true, message: '请选择任务分类', trigger: 'change' },
  ],
  start_date: [
    { required: true, message: '请选择开始日期', trigger: 'change' },
  ],
  end_date: [
    { required: true, message: '请选择截止日期', trigger: 'change' },
    {
      validator: (_rule, value, callback) => {
        if (value && form.start_date && value < form.start_date) {
          callback(new Error('截止日期不能早于开始日期'))
        } else {
          callback()
        }
      },
      trigger: 'change',
    },
  ],
  priority: [
    { required: true, message: '请选择优先级', trigger: 'change' },
  ],
}

// ── 日期联动禁用 ──────────────────────────────────────────────────────────────
function disableAfterEnd(date) {
  return form.end_date ? date > new Date(form.end_date) : false
}
function disableBeforeStart(date) {
  return form.start_date ? date < new Date(form.start_date) : false
}

// ── 加载编辑数据 ──────────────────────────────────────────────────────────────
async function loadTaskForEdit(id) {
  detailLoading.value = true
  try {
    const res = await getTaskDetail(id)
    fillForm(res.data)
  } catch {
    ElMessage.error('任务信息加载失败')
    modelVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

function fillForm(task) {
  Object.assign(form, defaultForm())
  if (!task) return
  form.task_name        = task.task_name    ?? ''
  form.period_id        = task.period_id    ?? null
  form.category         = task.category     ?? ''
  form.priority         = task.priority     ?? 'medium'
  form.start_date       = task.start_date   ?? ''
  form.end_date         = task.end_date     ?? ''
  const oid = task.owner_id ?? null
  const coIds = task.co_leads?.map((c) => c.staff_id) ?? []
  form.lead_owner_ids = oid != null ? [oid, ...coIds.filter((id) => id !== oid)] : [...coIds]
  const auxIds = task.auxiliary_owners?.map((c) => c.staff_id) ?? []
  const collIds = task.collaborators?.map((c) => c.staff_id) ?? []
  const seen = new Set()
  form.helper_staff_ids = []
  for (const id of [...auxIds, ...collIds]) {
    if (!seen.has(id)) {
      seen.add(id)
      form.helper_staff_ids.push(id)
    }
  }
  form.description      = task.description  ?? ''
  form.status           = task.status       ?? 'pending'
  form.progress         = task.progress     ?? 0
  form.remarks          = task.remarks      ?? ''
}

// ── 提交 ──────────────────────────────────────────────────────────────────────
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const lead = form.lead_owner_ids || []
    if (!lead.length) {
      ElMessage.warning('请至少选择一名负责人')
      submitting.value = false
      return
    }
    const payload = {
      task_name:        form.task_name.trim(),
      owner_id:         lead[0],
      co_lead_ids:      lead.slice(1),
      collaborator_ids: form.helper_staff_ids || [],
      auxiliary_owner_ids: [],
      period_id:        form.period_id   || null,
      category:         form.category,
      priority:         form.priority,
      start_date:       form.start_date,
      end_date:         form.end_date,
      description:      form.description  || null,
      remarks:          form.remarks      || null,
    }

    if (isEdit.value) {
      payload.status   = form.status
      payload.progress = form.progress
      await updateTask(props.taskId, payload)
      ElMessage.success('任务已更新')
    } else {
      await createTask(payload)
      ElMessage.success('任务已创建')
    }

    emit('success')
    modelVisible.value = false
  } catch {
    // request.js 拦截器已统一弹出错误提示
  } finally {
    submitting.value = false
  }
}

// ── 关闭时重置 ────────────────────────────────────────────────────────────────
function handleClosed() {
  formRef.value?.resetFields()
  Object.assign(form, defaultForm())
}

// ── 监听弹窗打开 ──────────────────────────────────────────────────────────────
watch(modelVisible, async (open) => {
  if (!open) return

  await loadStaff()

  if (props.taskId) {
    await loadTaskForEdit(props.taskId)
  } else {
    Object.assign(form, defaultForm())
    if (userStore.role === 'teacher' && userStore.staffId != null) {
      form.lead_owner_ids = [userStore.staffId]
    }
  }
})
</script>

<style lang="scss" scoped>
// ── 弹窗：加宽 + 正文可滚动，避免一屏塞满 ─────────────────────────────────────
.task-form-dialog {
  width: min(94vw, 920px) !important;
  max-width: 100%;

  :deep(.el-dialog__header) {
    padding: 18px 24px 12px;
    margin-right: 0;
  }

  :deep(.el-dialog__body) {
    padding: 8px 24px 4px;
    max-height: min(78vh, 720px);
    overflow-y: auto;
  }

  :deep(.el-dialog__footer) {
    padding: 16px 24px 20px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}

// ── 表单：标签置顶、分组留白 ─────────────────────────────────────────────────
.task-form--relaxed {
  padding: 0 0 8px;

  :deep(.el-form-item) {
    margin-bottom: 20px;
  }

  :deep(.el-form-item__label) {
    line-height: 1.35;
    height: auto !important;
    padding-bottom: 6px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  :deep(.el-form-item__content) {
    align-items: stretch;
  }

  .form-item-tight-bottom {
    margin-bottom: 16px;
  }

  .form-item-last-in-section {
    margin-bottom: 0;
  }
}

.form-section {
  margin-bottom: 20px;
  padding: 20px 22px 22px;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);

  &:last-of-type {
    margin-bottom: 0;
  }
}

.section-title {
  margin: 0 0 18px;
  padding-bottom: 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: 0.02em;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.label-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}

.field-hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.full-width { width: 100%; }

/* 协助人员：不折叠为 +N，标签可换行；selection 至少一行高度，大字号下占位符不贴顶 */
.select-collaborators-multiline {
  :deep(.el-select__selection) {
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 4px 6px;
    min-height: var(--el-component-size);
    box-sizing: border-box;
  }

  :deep(.el-select__selected-item) {
    flex-shrink: 0;
  }

  :deep(.el-select__wrapper) {
    align-items: center;
    min-height: var(--el-component-size);
    height: auto;
  }
}

.form-loading { padding: 8px 0 4px; }

/* 编辑弹窗内附件区 */
.task-files-outer {
  margin: 16px 24px 0;
  padding: 16px 0 8px;
  border-top: 1px dashed var(--el-border-color-lighter);
  max-height: min(50vh, 400px);
  overflow-y: auto;
}

// ── 选项布局 ──────────────────────────────────────────────────────────────────
.opt-name {
  font-size: var(--el-font-size-base);
  color: $text-primary;
}

.opt-dept {
  float: right;
  font-size: var(--el-font-size-small);
  color: $text-secondary;
  line-height: var(--el-component-size);
}

// ── 分类圆点 ──────────────────────────────────────────────────────────────────
.category-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
  vertical-align: middle;
}

// ── 优先级 RadioGroup ─────────────────────────────────────────────────────────
.priority-group--spaced {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  :deep(.el-radio-button) {
    margin-right: 0;
  }
}

.priority-group {
  :deep(.el-radio-button__inner) {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 10px 22px;
    font-size: var(--el-font-size-base);
  }

  // 高：选中时红色
  :deep(.el-radio-button:first-child .el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background-color: #f56c6c;
    border-color: #f56c6c;
    box-shadow: -1px 0 0 0 #f56c6c;
    color: #fff;
  }

  // 中：选中时橙色
  :deep(.el-radio-button:nth-child(2) .el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background-color: #e6a23c;
    border-color: #e6a23c;
    box-shadow: -1px 0 0 0 #e6a23c;
    color: #fff;
  }

  // 低：选中时灰色
  :deep(.el-radio-button:last-child .el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background-color: #909399;
    border-color: #909399;
    box-shadow: -1px 0 0 0 #909399;
    color: #fff;
  }
}

.priority-icon {
  font-size: var(--el-font-size-small);
  vertical-align: -1px;
}

// ── 进度 InputNumber ──────────────────────────────────────────────────────────
:deep(.el-input-number.full-width) { width: 100%; }
</style>
