<template>
  <el-drawer
    v-model="visible"
    direction="rtl"
    size="440px"
    :before-close="() => (visible = false)"
    destroy-on-close
    class="meeting-drawer"
  >
    <!-- 自定义标题 -->
    <template #header>
      <div class="drawer-header">
        <div class="header-main">
          <span
            v-if="meeting"
            class="type-badge"
            :style="{ background: typeColor(meeting.meeting_type) }"
          >{{ typeLabel(meeting.meeting_type) }}</span>
          <span class="drawer-title">{{ meeting?.meeting_name || '会议详情' }}</span>
        </div>
        <el-tag
          v-if="meeting"
          :type="STATUS_MAP[meeting.status]?.type ?? 'info'"
          size="small"
          effect="light"
        >
          {{ STATUS_MAP[meeting.status]?.label ?? meeting.status }}
        </el-tag>
      </div>
    </template>

    <!-- 加载中 -->
    <div v-if="loading" class="drawer-body">
      <el-skeleton :rows="10" animated />
    </div>

    <!-- 内容 -->
    <div v-else-if="meeting" class="drawer-body">

      <!-- ── 基本信息 ────────────────────────────────────────────────────── -->
      <section class="detail-section">
        <div class="section-title">基本信息</div>
        <el-descriptions :column="2" border size="small" class="info-desc">
          <el-descriptions-item label="会议编号" :span="2">
            <span class="mono">{{ meeting.meeting_no }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="主持人" :span="2">
            <el-icon class="inline-icon"><UserFilled /></el-icon>
            {{ meeting.host_name }}
          </el-descriptions-item>
          <el-descriptions-item label="开始时间">
            {{ fmtDt(meeting.start_time) }}
          </el-descriptions-item>
          <el-descriptions-item label="结束时间">
            {{ fmtDt(meeting.end_time) }}
          </el-descriptions-item>
          <el-descriptions-item label="会议地点" :span="2">
            <el-icon class="inline-icon"><Location /></el-icon>
            {{ meeting.location }}
          </el-descriptions-item>
          <el-descriptions-item label="提醒设置" :span="2">
            {{ REMINDER_MAP[meeting.reminder_setting] ?? meeting.reminder_setting }}
          </el-descriptions-item>
          <el-descriptions-item v-if="meeting.agenda" label="会议议题" :span="2">
            <p class="pre-text">{{ meeting.agenda }}</p>
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <!-- ── 参会人员 ────────────────────────────────────────────────────── -->
      <section class="detail-section">
        <div class="section-title">
          参会人员
          <span class="participant-stats">
            {{ confirmedCount }} / {{ meeting.participants?.length ?? 0 }} 已确认
          </span>
        </div>
        <div class="participant-list">
          <div
            v-for="p in meeting.participants"
            :key="p.staff_id"
            class="participant-item"
          >
            <el-avatar :size="32" class="p-avatar">
              {{ p.name?.[0] ?? '?' }}
            </el-avatar>
            <span class="p-name">{{ p.name }}</span>
            <el-tag
              :type="CONFIRM_MAP[p.confirmed]?.type ?? 'info'"
              size="small"
              effect="plain"
              class="p-status"
            >
              {{ CONFIRM_MAP[p.confirmed]?.label ?? '未知' }}
            </el-tag>
          </div>
          <div v-if="!meeting.participants?.length" class="empty-participants">
            暂无参会人员
          </div>
        </div>
      </section>

      <!-- ── 会议纪要（如有） ────────────────────────────────────────────── -->
      <section v-if="meeting.minutes" class="detail-section">
        <div class="section-title">会议纪要</div>
        <p class="pre-text minutes-text">{{ meeting.minutes }}</p>
      </section>

      <!-- ── 时间戳 ──────────────────────────────────────────────────────── -->
      <div class="timestamps">
        创建于 {{ fmtDt(meeting.created_at) }}
      </div>
    </div>

    <!-- 加载失败 -->
    <el-empty v-else description="加载失败，请重试" />

    <!-- 底部操作 -->
    <template #footer>
      <div class="drawer-footer">
        <!-- 确认参会（仅参会名单中的用户可操作）-->
        <template v-if="canConfirm">
          <el-button
            v-if="myConfirmed !== 1"
            type="success"
            :loading="confirming"
            @click="handleConfirm(1)"
          >
            <el-icon><CircleCheck /></el-icon> 确认参会
          </el-button>
          <el-button
            v-if="myConfirmed !== 2"
            type="danger"
            plain
            :loading="confirming"
            @click="handleConfirm(2)"
          >
            <el-icon><CircleClose /></el-icon> 拒绝参会
          </el-button>
        </template>

        <div class="footer-right">
          <el-button @click="visible = false">关 闭</el-button>
          <el-button v-if="canEdit" type="primary" @click="handleEdit">
            <el-icon><Edit /></el-icon> 编 辑
          </el-button>
        </div>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  UserFilled, Location, CircleCheck, CircleClose, Edit,
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getMeetingDetail, confirmAttendance } from '@/api/meeting'
import { useUserStore } from '@/store/user'

// ── Props / Emits ─────────────────────────────────────────────────────────────
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  meetingId:  { type: Number,  default: null  },
})
const emit = defineEmits(['update:modelValue', 'edit', 'refresh'])

const userStore = useUserStore()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// ── 数据 ──────────────────────────────────────────────────────────────────────
const loading   = ref(false)
const confirming = ref(false)
const meeting   = ref(null)

// ── 常量映射 ──────────────────────────────────────────────────────────────────
const MEETING_TYPES = [
  { value: 'all',        label: '全体会议', color: '#5B8DEF' },
  { value: 'department', label: '部门会议', color: '#67C23A' },
  { value: 'party',      label: '党务会议', color: '#F56C6C' },
  { value: 'teaching',   label: '教学会议', color: '#E6A23C' },
  { value: 'other',      label: '其他',     color: '#909399' },
]

const STATUS_MAP = {
  upcoming:  { type: 'primary', label: '即将开始' },
  ongoing:   { type: 'success', label: '进行中'   },
  ended:     { type: 'info',    label: '已结束'   },
  cancelled: { type: 'danger',  label: '已取消'   },
}

const REMIND_MAP_ALIAS = 'REMINDER_MAP'
const REMINDER_MAP = {
  none:   '不提醒',
  '15min': '提前 15 分钟',
  '30min': '提前 30 分钟',
  '1hour': '提前 1 小时',
  '1day':  '提前 1 天',
}

const CONFIRM_MAP = {
  null:      { type: 'info',    label: '待确认' },
  undefined: { type: 'info',    label: '待确认' },
  0:         { type: 'warning', label: '未确认' },
  1:         { type: 'success', label: '已确认' },
  2:         { type: 'danger',  label: '已拒绝' },
}

function typeColor(type) {
  return MEETING_TYPES.find(t => t.value === type)?.color ?? '#909399'
}
function typeLabel(type) {
  return MEETING_TYPES.find(t => t.value === type)?.label ?? type
}
function fmtDt(dt) {
  if (!dt) return '—'
  return dayjs(dt).format('YYYY-MM-DD HH:mm')
}

// ── 计算属性 ──────────────────────────────────────────────────────────────────
const confirmedCount = computed(() =>
  (meeting.value?.participants ?? []).filter(p => p.confirmed === 1).length,
)

/** 当前用户是否在参会名单中 */
const myParticipant = computed(() => {
  if (!userStore.staffId || !meeting.value?.participants) return null
  return meeting.value.participants.find(p => p.staff_id === userStore.staffId) ?? null
})

const myConfirmed = computed(() => myParticipant.value?.confirmed ?? null)

/** 是否可以确认参会（在名单中 且 会议未结束） */
const canConfirm = computed(() =>
  !!myParticipant.value &&
  meeting.value?.status !== 'ended' &&
  meeting.value?.status !== 'cancelled',
)

const canEdit = computed(() => userStore.isAdmin || userStore.isLeader)

// ── 加载详情 ──────────────────────────────────────────────────────────────────
async function loadDetail() {
  if (!props.meetingId) return
  loading.value = true
  meeting.value = null
  try {
    const res = await getMeetingDetail(props.meetingId)
    meeting.value = res.data
  } catch {
    // request.js 弹错
  } finally {
    loading.value = false
  }
}

// ── 确认参会 ──────────────────────────────────────────────────────────────────
async function handleConfirm(status) {
  confirming.value = true
  try {
    const res = await confirmAttendance(props.meetingId, status)
    meeting.value = res.data
    ElMessage.success(status === 1 ? '已确认参会' : '已拒绝参会')
    emit('refresh')
  } catch {
    // request.js 弹错
  } finally {
    confirming.value = false
  }
}

// ── 编辑 ──────────────────────────────────────────────────────────────────────
function handleEdit() {
  emit('edit', meeting.value)
  visible.value = false
}

// ── 监听打开 ──────────────────────────────────────────────────────────────────
watch(
  [() => props.modelValue, () => props.meetingId],
  ([open, id]) => {
    if (open && id) loadDetail()
  },
  { immediate: true },
)
</script>

<style lang="scss" scoped>
// ── Drawer 头部 ───────────────────────────────────────────────────────────────
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.type-badge {
  flex-shrink: 0;
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #fff;
  white-space: nowrap;
}

.drawer-title {
  font-size: 15px;
  font-weight: 600;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// ── Drawer 主体 ───────────────────────────────────────────────────────────────
.drawer-body {
  padding: 0 4px;
}

.detail-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: $text-secondary;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.participant-stats {
  font-size: 11px;
  font-weight: 400;
  color: $text-disabled;
}

.info-desc {
  :deep(.el-descriptions__label) {
    width: 90px;
    color: $text-secondary;
    font-size: 12px;
  }
  :deep(.el-descriptions__content) {
    font-size: 13px;
    color: $text-primary;
  }
}

.inline-icon {
  font-size: 13px;
  vertical-align: -2px;
  margin-right: 4px;
  color: $text-secondary;
}

.mono { font-family: 'Courier New', monospace; font-size: 12px; }

.pre-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.6;
  color: $text-regular;
}

.minutes-text {
  background: $bg-page;
  border-radius: 6px;
  padding: 10px 12px;
}

// ── 参会人员列表 ──────────────────────────────────────────────────────────────
.participant-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.participant-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: $bg-page;
  border-radius: 8px;
}

.p-avatar {
  flex-shrink: 0;
  background: $primary;
  color: #fff;
  font-size: 13px;
}

.p-name {
  flex: 1;
  font-size: 13px;
  color: $text-primary;
}

.p-status { flex-shrink: 0; }

.empty-participants {
  font-size: 13px;
  color: $text-disabled;
  padding: 8px 0;
}

// ── 时间戳 ────────────────────────────────────────────────────────────────────
.timestamps {
  font-size: 11px;
  color: $text-disabled;
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px dashed $border-lighter;
}

// ── 底部 ──────────────────────────────────────────────────────────────────────
.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.footer-right {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>
