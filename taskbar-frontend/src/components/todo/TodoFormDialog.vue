<template>
  <el-dialog
    :model-value="visible"
    :title="taskId ? `新增待办 — ${taskName}` : '新增待办'"
    width="520px"
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="emit('update:visible', $event)"
    @closed="handleClosed"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="80px"
      class="todo-form"
    >
      <!-- 待办名称 -->
      <el-form-item label="待办名称" prop="todo_name">
        <el-input
          v-model="form.todo_name"
          placeholder="请输入待办名称"
          maxlength="100"
          show-word-limit
          clearable
          autofocus
        />
      </el-form-item>

      <!-- 关联任务（taskId 传入时锁定） -->
      <el-form-item label="关联任务">
        <el-select
          v-model="form.task_id"
          placeholder="可选关联任务"
          filterable
          clearable
          class="full-width"
          :disabled="!!taskId"
        >
          <el-option
            v-for="t in taskOptions"
            :key="t.task_id"
            :label="t.task_name"
            :value="t.task_id"
          >
            <span>{{ t.task_name }}</span>
            <span class="opt-secondary">{{ t.owner_name }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <!-- 优先级 -->
      <el-form-item label="优先级" prop="priority">
        <el-radio-group v-model="form.priority" class="priority-group">
          <el-radio-button value="urgent">
            <span class="priority-label urgent">紧急</span>
          </el-radio-button>
          <el-radio-button value="important">
            <span class="priority-label important">重要</span>
          </el-radio-button>
          <el-radio-button value="normal">
            <span class="priority-label normal">一般</span>
          </el-radio-button>
          <el-radio-button value="low">
            <span class="priority-label low">较低</span>
          </el-radio-button>
        </el-radio-group>
      </el-form-item>

      <!-- 截止时间 -->
      <el-form-item label="截止时间">
        <el-date-picker
          v-model="form.deadline"
          type="datetime"
          placeholder="选择截止时间（可选）"
          format="YYYY-MM-DD HH:mm"
          value-format="YYYY-MM-DD HH:mm:ss"
          :disabled-date="disablePastDate"
          class="full-width"
        />
      </el-form-item>

      <!-- 备注 -->
      <el-form-item label="备注">
        <el-input
          v-model="form.remarks"
          type="textarea"
          :rows="3"
          placeholder="其他说明（可选）"
          maxlength="200"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取 消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        创 建
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createTodo } from '@/api/todo'
import { getTaskList } from '@/api/task'

// ── Props / Emits ─────────────────────────────────────────────────────────────
const props = defineProps({
  visible:         { type: Boolean, default: false },
  /** 传入时自动关联到该任务，并锁定选择器 */
  taskId:          { type: Number,  default: null },
  taskName:        { type: String,  default: '' },
  /** 打开时预选的优先级 */
  initialPriority: { type: String,  default: 'normal' },
})
const emit = defineEmits(['update:visible', 'success'])

// ── 关联任务下拉 ──────────────────────────────────────────────────────────────
const taskOptions = ref([])

async function loadTasks() {
  try {
    // 只拉取用于下拉的轻量列表（不分页，取前100条）
    const res = await getTaskList({ page: 1, page_size: 100 })
    taskOptions.value = res.data?.list ?? []
  } catch {
    taskOptions.value = []
  }
}

// ── 表单 ──────────────────────────────────────────────────────────────────────
const formRef    = ref(null)
const submitting = ref(false)

const defaultForm = () => ({
  todo_name: '',
  task_id:   null,
  priority:  'normal',
  deadline:  null,
  remarks:   '',
})

const form = reactive(defaultForm())

const rules = {
  todo_name: [
    { required: true, message: '请输入待办名称', trigger: 'blur' },
    { max: 100,       message: '待办名称不超过 100 字', trigger: 'blur' },
  ],
  priority: [
    { required: true, message: '请选择优先级', trigger: 'change' },
  ],
}

// 禁止选择过去日期
function disablePastDate(date) {
  return date < new Date(new Date().setHours(0, 0, 0, 0))
}

// ── 提交 ──────────────────────────────────────────────────────────────────────
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await createTodo({
      todo_name: form.todo_name.trim(),
      task_id:   form.task_id   || null,
      priority:  form.priority,
      deadline:  form.deadline  || null,
      remarks:   form.remarks   || null,
    })
    ElMessage.success('待办已创建')
    emit('success', form.task_id)
    emit('update:visible', false)
  } catch {
    // request.js 统一弹错
  } finally {
    submitting.value = false
  }
}

// ── 关闭重置 ──────────────────────────────────────────────────────────────────
function handleClosed() {
  formRef.value?.resetFields()
  Object.assign(form, defaultForm())
}

// ── 监听打开 ──────────────────────────────────────────────────────────────────
watch(
  () => props.visible,
  (open) => {
    if (!open) return
    if (!taskOptions.value.length) loadTasks()
    // 锁定关联任务 + 应用预选优先级
    form.task_id  = props.taskId          ?? null
    form.priority = props.initialPriority ?? 'normal'
  },
)
</script>

<style lang="scss" scoped>
.todo-form { padding: 4px 0; }

.full-width { width: 100%; }

.opt-secondary {
  float: right;
  font-size: 12px;
  color: $text-secondary;
  line-height: 34px;
}

// ── 优先级按钮颜色 ────────────────────────────────────────────────────────────
.priority-group {
  :deep(.el-radio-button__inner) {
    padding: 7px 18px;
    font-size: 13px;
  }
}

.priority-label {
  font-size: 13px;

  &.urgent    { color: #f56c6c; }
  &.important { color: #e6a23c; }
  &.normal    { color: $text-regular; }
  &.low       { color: $text-secondary; }
}

// 选中后各按钮背景色
.priority-group :deep(.el-radio-button) {
  &:nth-child(1) .el-radio-button__original-radio:checked + .el-radio-button__inner {
    background: #f56c6c; border-color: #f56c6c;
    box-shadow: -1px 0 0 0 #f56c6c; color: #fff;
    .priority-label { color: #fff; }
  }
  &:nth-child(2) .el-radio-button__original-radio:checked + .el-radio-button__inner {
    background: #e6a23c; border-color: #e6a23c;
    box-shadow: -1px 0 0 0 #e6a23c; color: #fff;
    .priority-label { color: #fff; }
  }
  &:nth-child(3) .el-radio-button__original-radio:checked + .el-radio-button__inner {
    background: $primary; border-color: $primary;
    box-shadow: -1px 0 0 0 $primary; color: #fff;
    .priority-label { color: #fff; }
  }
  &:nth-child(4) .el-radio-button__original-radio:checked + .el-radio-button__inner {
    background: #909399; border-color: #909399;
    box-shadow: -1px 0 0 0 #909399; color: #fff;
    .priority-label { color: #fff; }
  }
}
</style>
