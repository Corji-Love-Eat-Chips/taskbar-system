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
      label-width="auto"
      label-position="right"
      class="task-form"
    >
      <!-- ① 任务名称 -->
      <el-form-item label="任务名称" prop="task_name">
        <el-input
          v-model="form.task_name"
          placeholder="请输入任务名称"
          maxlength="100"
          show-word-limit
          clearable
        />
      </el-form-item>

      <!-- ② 负责人 + 所属周期 -->
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="负责人" prop="owner_id">
            <el-select
              v-model="form.owner_id"
              placeholder="请选择负责人"
              filterable
              clearable
              class="full-width"
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
        <el-col :span="12">
          <el-form-item label="所属周期" prop="period_id">
            <PeriodSelect
              v-model="form.period_id"
              :auto-select-current="!isEdit"
              class="full-width"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <!-- ③ 分类 + 开始/截止日期 -->
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="任务分类" prop="category">
            <el-select
              v-model="form.category"
              placeholder="请选择分类"
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
        <el-col :span="12">
          <!-- 占位：日期放下面整行更宽敞 -->
        </el-col>
      </el-row>

      <!-- ④ 开始日期 + 截止日期 -->
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="开始日期" prop="start_date">
            <el-date-picker
              v-model="form.start_date"
              type="date"
              placeholder="选择开始日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              :disabled-date="disableAfterEnd"
              class="full-width"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="截止日期" prop="end_date">
            <el-date-picker
              v-model="form.end_date"
              type="date"
              placeholder="选择截止日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              :disabled-date="disableBeforeStart"
              class="full-width"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <!-- ⑤ 优先级（RadioGroup） -->
      <el-form-item label="优先级" prop="priority">
        <el-radio-group v-model="form.priority" class="priority-group">
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

      <!-- ⑥ 协助人员 -->
      <el-form-item label="协助人员">
        <el-select
          v-model="form.collaborator_ids"
          placeholder="可多选（可选）"
          filterable
          multiple
          :collapse-tags="false"
          class="full-width select-collaborators-multiline"
        >
          <el-option
            v-for="s in collaboratorOptions"
            :key="s.staff_id"
            :label="s.name"
            :value="s.staff_id"
          >
            <span class="opt-name">{{ s.name }}</span>
            <span class="opt-dept">{{ s.department }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <!-- ⑦ 任务描述 -->
      <el-form-item label="任务描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="请描述任务的目标和要求（可选）"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>

      <!-- ⑧ 编辑模式额外字段：状态 + 进度 -->
      <template v-if="isEdit">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="任务状态" prop="status">
              <el-select v-model="form.status" class="full-width">
                <el-option label="待开始" value="pending" />
                <el-option label="进行中" value="in_progress" />
                <el-option label="已完成" value="completed" />
                <el-option label="已延期" value="delayed" />
                <el-option label="已取消" value="cancelled" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="完成进度" prop="progress">
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

      <!-- ⑨ 备注 -->
      <el-form-item label="备注">
        <el-input
          v-model="form.remarks"
          type="textarea"
          :rows="2"
          placeholder="其他说明（可选）"
          maxlength="200"
          show-word-limit
        />
      </el-form-item>
    </el-form>

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

// ── v-model（与父级 v-model 对齐，不能用单独的 visible prop）──────────────────
const modelVisible = defineModel({ type: Boolean, default: false })

// ── Props / Emits ─────────────────────────────────────────────────────────────
const props = defineProps({
  /** 编辑时传入任务 ID，新增时为 null */
  taskId: { type: Number, default: null },
})

const emit = defineEmits(['success'])

// ── 是否编辑模式 ──────────────────────────────────────────────────────────────
const isEdit = computed(() => !!props.taskId)

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

/** 协助人下拉：排除当前已选的负责人 */
const collaboratorOptions = computed(() =>
  staffList.value.filter(s => s.staff_id !== form.owner_id),
)

// ── 表单数据 ──────────────────────────────────────────────────────────────────
const formRef    = ref(null)
const submitting  = ref(false)
const detailLoading = ref(false)

function defaultForm() {
  return {
    task_name:        '',
    owner_id:         null,
    period_id:        null,
    category:         '',
    priority:         'medium',
    start_date:       '',
    end_date:         '',
    collaborator_ids: [],
    description:      '',
    status:           'pending',
    progress:         0,
    remarks:          '',
  }
}

const form = reactive(defaultForm())

// ── 表单校验规则 ──────────────────────────────────────────────────────────────
const rules = {
  task_name: [
    { required: true, message: '请输入任务名称', trigger: 'blur' },
    { max: 100,       message: '任务名称不超过 100 字', trigger: 'blur' },
  ],
  owner_id: [
    { required: true, message: '请选择负责人', trigger: 'change' },
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
  form.owner_id         = task.owner_id     ?? null
  form.period_id        = task.period_id    ?? null
  form.category         = task.category     ?? ''
  form.priority         = task.priority     ?? 'medium'
  form.start_date       = task.start_date   ?? ''
  form.end_date         = task.end_date     ?? ''
  form.collaborator_ids = task.collaborators?.map(c => c.staff_id) ?? []
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
    const payload = {
      task_name:        form.task_name.trim(),
      owner_id:         form.owner_id,
      period_id:        form.period_id   || null,
      category:         form.category,
      priority:         form.priority,
      start_date:       form.start_date,
      end_date:         form.end_date,
      collaborator_ids: form.collaborator_ids,
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
watch(modelVisible, (open) => {
  if (!open) return

  // 每次打开都重新拉取在职人员，避免缓存空列表或数据过期
  loadStaff()

  if (props.taskId) {
    loadTaskForEdit(props.taskId)
  } else {
    Object.assign(form, defaultForm())
  }
})
</script>

<style lang="scss" scoped>
// ── 弹窗：随视口略放大，避免大号字体下标签区过窄 ───────────────────────────────
.task-form-dialog {
  width: min(92vw, 760px) !important;
  max-width: 100%;
}

// ── 表单 ──────────────────────────────────────────────────────────────────────
.task-form {
  padding: 4px 0 0;

  /* label-width=auto 时仍保证标签单行、与控件垂直对齐（含必填星号） */
  :deep(.el-form-item__label) {
    white-space: nowrap;
    line-height: var(--el-component-size);
    height: var(--el-component-size);
    align-items: center;
  }

  :deep(.el-form-item__content) {
    align-items: center;
  }

  /* 多行控件（文本域、多选 select）与标签顶部对齐更自然 */
  :deep(.el-form-item:has(textarea) .el-form-item__label),
  :deep(.el-form-item:has(.select-collaborators-multiline) .el-form-item__label) {
    align-items: flex-start;
    padding-top: calc((var(--el-component-size) - 1em) / 2);
    height: auto;
    line-height: 1.4;
  }

  :deep(.el-form-item:has(textarea) .el-form-item__content),
  :deep(.el-form-item:has(.select-collaborators-multiline) .el-form-item__content) {
    align-items: stretch;
  }
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
.priority-group {
  :deep(.el-radio-button__inner) {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 20px;
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
