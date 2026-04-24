<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? '编辑会议' : '新增会议'"
    width="700px"
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="emit('update:visible', $event)"
    @closed="handleClosed"
  >
    <div v-if="detailLoading" class="form-loading">
      <el-skeleton :rows="8" animated />
    </div>

    <el-form
      v-else
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="90px"
      class="meeting-form"
    >
      <!-- 会议名称 -->
      <el-form-item label="会议名称" prop="meeting_name">
        <el-input
          v-model="form.meeting_name"
          placeholder="请输入会议名称"
          maxlength="100"
          show-word-limit
          clearable
        />
      </el-form-item>

      <el-row :gutter="16">
        <!-- 会议类型 -->
        <el-col :span="12">
          <el-form-item label="会议类型" prop="meeting_type">
            <el-select v-model="form.meeting_type" placeholder="请选择类型" class="full-width">
              <el-option
                v-for="t in MEETING_TYPES"
                :key="t.value"
                :label="t.label"
                :value="t.value"
              >
                <span class="type-dot" :style="{ background: t.color }" />
                {{ t.label }}
              </el-option>
            </el-select>
          </el-form-item>
        </el-col>

        <!-- 主持人 -->
        <el-col :span="12">
          <el-form-item label="主持人" prop="host_id">
            <el-select
              v-model="form.host_id"
              placeholder="请选择主持人"
              filterable
              class="full-width"
            >
              <el-option
                v-for="s in staffList"
                :key="s.staff_id"
                :label="s.name"
                :value="s.staff_id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <!-- 开始时间 -->
        <el-col :span="12">
          <el-form-item label="开始时间" prop="start_time">
            <el-date-picker
              v-model="form.start_time"
              type="datetime"
              placeholder="选择开始时间"
              format="YYYY-MM-DD HH:mm"
              value-format="YYYY-MM-DD HH:mm:ss"
              :disabled-date="disablePast"
              class="full-width"
            />
          </el-form-item>
        </el-col>

        <!-- 结束时间 -->
        <el-col :span="12">
          <el-form-item label="结束时间" prop="end_time">
            <el-date-picker
              v-model="form.end_time"
              type="datetime"
              placeholder="选择结束时间"
              format="YYYY-MM-DD HH:mm"
              value-format="YYYY-MM-DD HH:mm:ss"
              :disabled-date="disableBeforeStart"
              class="full-width"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <!-- 会议地点 -->
        <el-col :span="12">
          <el-form-item label="会议地点" prop="location">
            <el-input
              v-model="form.location"
              placeholder="请输入会议地点"
              maxlength="100"
              clearable
            />
          </el-form-item>
        </el-col>

        <!-- 提醒设置 -->
        <el-col :span="12">
          <el-form-item label="提前提醒">
            <el-select v-model="form.reminder_setting" class="full-width">
              <el-option label="不提醒"    value="none"  />
              <el-option label="提前 15 分钟" value="15min" />
              <el-option label="提前 30 分钟" value="30min" />
              <el-option label="提前 1 小时" value="1hour" />
              <el-option label="提前 1 天"  value="1day"  />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 参会人员 -->
      <el-form-item label="参会人员" prop="participant_ids">
        <el-select
          v-model="form.participant_ids"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="至少选择一位参会人员"
          class="full-width"
        >
          <el-option-group label="全部人员">
            <el-option
              v-for="s in staffList"
              :key="s.staff_id"
              :label="s.name"
              :value="s.staff_id"
            >
              <span>{{ s.name }}</span>
              <span v-if="s.department" class="opt-dept">{{ s.department }}</span>
            </el-option>
          </el-option-group>
        </el-select>
        <div v-if="form.participant_ids.length" class="participant-count">
          已选 {{ form.participant_ids.length }} 人
        </div>
      </el-form-item>

      <!-- 会议议题 -->
      <el-form-item label="会议议题">
        <el-input
          v-model="form.agenda"
          type="textarea"
          :rows="4"
          placeholder="请输入会议议题（可选）"
          maxlength="1000"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取 消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ isEdit ? '保 存' : '创 建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { getStaffList } from '@/api/staff'
import { getMeetingDetail, createMeeting, updateMeeting } from '@/api/meeting'

// ── Props / Emits ─────────────────────────────────────────────────────────────
const props = defineProps({
  visible:   { type: Boolean, default: false },
  meetingId: { type: Number,  default: null  },
  /** 从日历点击日期新增时预填开始时间 */
  initDate:  { type: String,  default: null  },
})
const emit = defineEmits(['update:visible', 'success'])

const isEdit = computed(() => !!props.meetingId)

// ── 会议类型配置 ──────────────────────────────────────────────────────────────
const MEETING_TYPES = [
  { value: 'all',        label: '全体会议', color: '#5B8DEF' },
  { value: 'department', label: '部门会议', color: '#67C23A' },
  { value: 'party',      label: '党务会议', color: '#F56C6C' },
  { value: 'teaching',   label: '教学会议', color: '#E6A23C' },
  { value: 'other',      label: '其他',     color: '#909399' },
]

// ── 人员列表 ──────────────────────────────────────────────────────────────────
const staffList = ref([])

async function loadStaff() {
  try {
    const res = await getStaffList({ page: 1, page_size: 200 })
    staffList.value = res.data?.list ?? []
  } catch {
    staffList.value = []
  }
}

// ── 表单 ──────────────────────────────────────────────────────────────────────
const formRef       = ref(null)
const submitting    = ref(false)
const detailLoading = ref(false)

function defaultForm() {
  return {
    meeting_name:     '',
    meeting_type:     'all',
    host_id:          null,
    start_time:       null,
    end_time:         null,
    location:         '',
    reminder_setting: '30min',
    participant_ids:  [],
    agenda:           '',
  }
}

const form = reactive(defaultForm())

const rules = {
  meeting_name: [
    { required: true, message: '请输入会议名称', trigger: 'blur' },
    { max: 100,       message: '不超过 100 字',  trigger: 'blur' },
  ],
  meeting_type: [{ required: true, message: '请选择会议类型', trigger: 'change' }],
  host_id:      [{ required: true, message: '请选择主持人',   trigger: 'change' }],
  start_time:   [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  end_time: [
    { required: true, message: '请选择结束时间', trigger: 'change' },
    {
      validator: (_, val, cb) => {
        if (val && form.start_time && !dayjs(val).isAfter(dayjs(form.start_time))) {
          cb(new Error('结束时间必须晚于开始时间'))
        } else {
          cb()
        }
      },
      trigger: 'change',
    },
  ],
  location: [{ required: true, message: '请输入会议地点', trigger: 'blur' }],
  participant_ids: [
    {
      validator: (_, val, cb) => {
        if (!Array.isArray(val) || val.length === 0) {
          cb(new Error('请至少选择一位参会人员'))
        } else {
          cb()
        }
      },
      trigger: 'change',
    },
  ],
}

// ── 日期禁用 ──────────────────────────────────────────────────────────────────
function disablePast(date) {
  return date < new Date(new Date().setHours(0, 0, 0, 0))
}
function disableBeforeStart(date) {
  if (!form.start_time) return disablePast(date)
  return date < dayjs(form.start_time).startOf('day').toDate()
}

// ── 加载编辑数据 ──────────────────────────────────────────────────────────────
async function loadDetail(id) {
  detailLoading.value = true
  try {
    const res = await getMeetingDetail(id)
    const m   = res.data
    Object.assign(form, {
      meeting_name:     m.meeting_name,
      meeting_type:     m.meeting_type,
      host_id:          m.host_id,
      start_time:       m.start_time,
      end_time:         m.end_time,
      location:         m.location,
      reminder_setting: m.reminder_setting ?? '30min',
      participant_ids:  (m.participants ?? []).map(p => p.staff_id),
      agenda:           m.agenda ?? '',
    })
  } catch {
    // 错误由 request.js 统一弹出
  } finally {
    detailLoading.value = false
  }
}

// ── 提交 ──────────────────────────────────────────────────────────────────────
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload = {
      meeting_name:     form.meeting_name.trim(),
      meeting_type:     form.meeting_type,
      host_id:          form.host_id,
      start_time:       form.start_time,
      end_time:         form.end_time,
      location:         form.location.trim(),
      reminder_setting: form.reminder_setting,
      participant_ids:  form.participant_ids,
      agenda:           form.agenda || null,
    }

    if (isEdit.value) {
      await updateMeeting(props.meetingId, payload)
      ElMessage.success('会议已更新')
    } else {
      await createMeeting(payload)
      ElMessage.success('会议已创建')
    }
    emit('success')
    emit('update:visible', false)
  } catch {
    // request.js 统一处理
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
    if (!staffList.value.length) loadStaff()
    if (props.meetingId) {
      loadDetail(props.meetingId)
    } else {
      Object.assign(form, defaultForm())
      // 从日历点击日期预填
      if (props.initDate) {
        form.start_time = `${props.initDate} 09:00:00`
        form.end_time   = `${props.initDate} 10:00:00`
      }
    }
  },
)
</script>

<style lang="scss" scoped>
.meeting-form { padding: 4px 0; }

.full-width { width: 100%; }

.form-loading { padding: 12px 0; }

.type-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.opt-dept {
  float: right;
  font-size: 12px;
  color: $text-secondary;
  line-height: 34px;
}

.participant-count {
  margin-top: 6px;
  font-size: 12px;
  color: $text-secondary;
}
</style>
