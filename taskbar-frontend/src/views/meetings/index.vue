<template>
  <div class="page-meetings">

    <!-- ══ 顶部工具栏 ════════════════════════════════════════════════════════ -->
    <div class="meetings-toolbar">
      <div class="toolbar-left">
        <!-- 视图切换 -->
        <el-radio-group v-model="currentView" size="small" @change="switchView">
          <el-radio-button value="dayGridMonth">月视图</el-radio-button>
          <el-radio-button value="timeGridWeek">周视图</el-radio-button>
          <el-radio-button value="timeGridDay">日视图</el-radio-button>
        </el-radio-group>

        <!-- 类型筛选 -->
        <el-select
          v-model="typeFilter"
          placeholder="全部类型"
          clearable
          size="small"
          style="width: 130px"
          @change="reloadEvents"
        >
          <el-option
            v-for="t in MEETING_TYPES"
            :key="t.value"
            :value="t.value"
          >
            <span class="type-dot" :style="{ background: t.color }" />
            {{ t.label }}
          </el-option>
        </el-select>
      </div>

      <div class="toolbar-right">
        <el-button size="small" @click="goToday">
          <el-icon><Calendar /></el-icon> 今天
        </el-button>
        <el-button
          v-if="userStore.isAdmin || userStore.isLeader"
          type="primary"
          size="small"
          @click="openCreate(null)"
        >
          <el-icon><Plus /></el-icon> 新增会议
        </el-button>
      </div>
    </div>

    <!-- ══ 图例 ══════════════════════════════════════════════════════════════ -->
    <div class="legend-bar">
      <div
        v-for="t in MEETING_TYPES"
        :key="t.value"
        class="legend-item"
        :class="{ dimmed: typeFilter && typeFilter !== t.value }"
        @click="toggleTypeFilter(t.value)"
      >
        <span class="legend-dot" :style="{ background: t.color }" />
        <span>{{ t.label }}</span>
      </div>
    </div>

    <!-- ══ FullCalendar ══════════════════════════════════════════════════════ -->
    <div class="calendar-wrap">
      <FullCalendar
        ref="calendarRef"
        :options="calendarOptions"
        class="full-calendar"
      />
    </div>

    <!-- ══ 会议详情侧滑 ══════════════════════════════════════════════════════ -->
    <MeetingDetailDrawer
      v-model="drawerVisible"
      :meeting-id="drawerMeetingId"
      @edit="handleEditFromDrawer"
      @refresh="reloadEvents"
    />

    <!-- ══ 新增 / 编辑弹窗 ══════════════════════════════════════════════════ -->
    <MeetingFormDialog
      v-model:visible="formVisible"
      :meeting-id="formMeetingId"
      :init-date="formInitDate"
      @success="handleFormSuccess"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick } from 'vue'
import { Calendar, Plus } from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import dayjs from 'dayjs'

// FullCalendar
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin   from '@fullcalendar/daygrid'
import timeGridPlugin  from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import zhCnLocale from '@fullcalendar/core/locales/zh-cn'

import { getMeetingCalendar, deleteMeeting } from '@/api/meeting'
import { useUserStore } from '@/store/user'
import MeetingDetailDrawer from '@/components/meeting/MeetingDetailDrawer.vue'
import MeetingFormDialog   from '@/components/meeting/MeetingFormDialog.vue'

const userStore = useUserStore()

// ═══════════════════════════════════════════════════════════════════════════════
// 一、常量
// ═══════════════════════════════════════════════════════════════════════════════

const MEETING_TYPES = [
  { value: 'all',        label: '全体会议', color: '#5B8DEF' },
  { value: 'department', label: '部门会议', color: '#67C23A' },
  { value: 'party',      label: '党务会议', color: '#F56C6C' },
  { value: 'teaching',   label: '教学会议', color: '#E6A23C' },
  { value: 'other',      label: '其他',     color: '#909399' },
]

const TYPE_COLOR_MAP = Object.fromEntries(MEETING_TYPES.map(t => [t.value, t.color]))

const STATUS_TEXT = {
  upcoming:  '即将开始',
  ongoing:   '进行中',
  ended:     '已结束',
  cancelled: '已取消',
}

// ═══════════════════════════════════════════════════════════════════════════════
// 二、状态
// ═══════════════════════════════════════════════════════════════════════════════

const calendarRef   = ref(null)
const currentView   = ref('dayGridMonth')
const typeFilter    = ref('')

// ─── 详情侧滑 ─────────────────────────────────────────────────────────────────
const drawerVisible   = ref(false)
const drawerMeetingId = ref(null)

// ─── 表单弹窗 ─────────────────────────────────────────────────────────────────
const formVisible   = ref(false)
const formMeetingId = ref(null)
const formInitDate  = ref(null)

// ═══════════════════════════════════════════════════════════════════════════════
// 三、FullCalendar 配置
// ═══════════════════════════════════════════════════════════════════════════════

const calendarOptions = reactive({
  plugins:     [dayGridPlugin, timeGridPlugin, interactionPlugin],
  locale:      zhCnLocale,
  initialView: 'dayGridMonth',
  height:      'auto',

  // 头部工具栏（隐藏内置 toolbar，用自定义 toolbar 控制）
  headerToolbar: {
    left:   'prev,next',
    center: 'title',
    right:  '',
  },

  // 按钮文本
  buttonText: {
    today: '今天',
    month: '月',
    week:  '周',
    day:   '日',
  },

  // 时间轴设置
  slotMinTime:    '07:00:00',
  slotMaxTime:    '22:00:00',
  slotDuration:   '00:30:00',
  slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },

  // 月视图最大显示条数
  dayMaxEvents: 3,

  // 周末显示
  weekends: true,

  // 事件数据来源（动态加载）
  events: fetchCalendarEvents,

  // 点击事件
  eventClick: handleEventClick,

  // 点击日期新增（仅管理员/领导）
  dateClick: handleDateClick,

  // 事件渲染回调
  eventDidMount: renderEventTooltip,

  // 周视图：时间格式
  eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },

  // 月视图：不显示周数
  weekNumbers: false,

  // 月视图事件高度
  eventMinHeight: 20,
})

// ─── 动态加载日历事件 ─────────────────────────────────────────────────────────
async function fetchCalendarEvents(info, successCallback, failureCallback) {
  try {
    const params = {
      start_date: dayjs(info.start).format('YYYY-MM-DD'),
      end_date:   dayjs(info.end).format('YYYY-MM-DD'),
    }
    const res    = await getMeetingCalendar(params)
    const list   = res.data?.list ?? []

    let events = list.map(m => ({
      id:              String(m.meeting_id),
      title:           m.meeting_name,
      start:           m.start_time,
      end:             m.end_time,
      color:           TYPE_COLOR_MAP[m.meeting_type] ?? '#909399',
      textColor:       '#fff',
      extendedProps:   {
        meeting_id:   m.meeting_id,
        meeting_type: m.meeting_type,
        location:     m.location,
        host_name:    m.host_name,
        status:       m.status,
      },
    }))

    // 应用类型筛选
    if (typeFilter.value) {
      events = events.filter(e => e.extendedProps.meeting_type === typeFilter.value)
    }

    successCallback(events)
  } catch (err) {
    failureCallback(err)
  }
}

// ─── 点击事件 → 打开详情 ──────────────────────────────────────────────────────
function handleEventClick({ event }) {
  const meetingId = event.extendedProps?.meeting_id
  if (!meetingId) return
  drawerMeetingId.value = meetingId
  drawerVisible.value   = true
}

// ─── 点击日期 → 新增会议 ──────────────────────────────────────────────────────
function handleDateClick({ dateStr }) {
  if (!userStore.isAdmin && !userStore.isLeader) return
  openCreate(dateStr)
}

// ─── 事件 Tooltip ─────────────────────────────────────────────────────────────
function renderEventTooltip({ el, event }) {
  const { location, host_name, status } = event.extendedProps ?? {}
  const lines = [
    host_name  ? `主持人：${host_name}` : null,
    location   ? `地点：${location}`  : null,
    status     ? `状态：${STATUS_TEXT[status] ?? status}` : null,
  ].filter(Boolean)

  if (lines.length) {
    el.setAttribute('title', lines.join('\n'))
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 四、交互操作
// ═══════════════════════════════════════════════════════════════════════════════

function switchView(view) {
  calendarRef.value?.getApi().changeView(view)
}

function goToday() {
  calendarRef.value?.getApi().today()
  // 切回月视图
  currentView.value = 'dayGridMonth'
  calendarRef.value?.getApi().changeView('dayGridMonth')
}

function reloadEvents() {
  calendarRef.value?.getApi().refetchEvents()
}

function toggleTypeFilter(type) {
  typeFilter.value = typeFilter.value === type ? '' : type
  reloadEvents()
}

// ── 新增 ──────────────────────────────────────────────────────────────────────
function openCreate(date) {
  formMeetingId.value = null
  formInitDate.value  = date
  formVisible.value   = true
}

// ── 编辑（从 Drawer） ─────────────────────────────────────────────────────────
function handleEditFromDrawer(meeting) {
  formMeetingId.value = meeting.meeting_id
  formInitDate.value  = null
  formVisible.value   = true
}

// ── 表单成功回调 ──────────────────────────────────────────────────────────────
function handleFormSuccess() {
  reloadEvents()
}
</script>

<style lang="scss" scoped>
// ── 页面布局 ──────────────────────────────────────────────────────────────────
.page-meetings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

// ── 工具栏 ────────────────────────────────────────────────────────────────────
.meetings-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $bg-card;
  border-radius: 10px;
  padding: 12px 16px;
  border: 1px solid $border-light;
  flex-wrap: wrap;
  gap: 10px;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.type-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

// ── 图例 ──────────────────────────────────────────────────────────────────────
.legend-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: $bg-card;
  border-radius: 8px;
  border: 1px solid $border-light;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: $text-secondary;
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s;

  &:hover   { color: $text-primary; }
  &.dimmed  { opacity: 0.35; }
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

// ── 日历容器 ──────────────────────────────────────────────────────────────────
.calendar-wrap {
  background: $bg-card;
  border-radius: 10px;
  border: 1px solid $border-light;
  padding: 16px;
  overflow: hidden;
}

// FullCalendar 全局样式覆盖（:deep 穿透 scoped）
.full-calendar {
  :deep(.fc) {
    font-family: inherit;
    font-size: 13px;
  }

  // 头部导航
  :deep(.fc-toolbar-title) {
    font-size: 16px;
    font-weight: 600;
    color: $text-primary;
  }

  :deep(.fc-button) {
    background: $bg-page;
    border-color: $border-base;
    color: $text-regular;
    font-size: 12px;
    padding: 5px 12px;
    box-shadow: none;

    &:hover { background: $border-lighter; }

    &.fc-button-active,
    &:active {
      background: $primary !important;
      border-color: $primary !important;
      color: #fff !important;
    }
  }

  :deep(.fc-button-primary:not(:disabled):active),
  :deep(.fc-button-primary:not(:disabled).fc-button-active) {
    background: $primary;
    border-color: $primary;
    color: #fff;
  }

  // 表头（周几）
  :deep(.fc-col-header-cell) {
    background: $bg-page;
    font-weight: 600;
    font-size: 12px;
    color: $text-secondary;
    padding: 8px 0;
  }

  // 日期格子
  :deep(.fc-daygrid-day) {
    &:hover { background: #fafbff; }
  }

  :deep(.fc-day-today) {
    background: #f0f5ff !important;
    .fc-daygrid-day-number { color: $primary; font-weight: 700; }
  }

  :deep(.fc-daygrid-day-number) {
    font-size: 13px;
    color: $text-primary;
    padding: 4px 8px;
  }

  // 事件卡片
  :deep(.fc-event) {
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    padding: 1px 5px;
    transition: filter 0.15s;

    &:hover { filter: brightness(0.9); }
  }

  :deep(.fc-daygrid-event-dot) { display: none; }

  // 时间轴
  :deep(.fc-timegrid-slot-label) {
    font-size: 11px;
    color: $text-secondary;
  }

  :deep(.fc-timegrid-event) {
    border-radius: 5px;
    padding: 2px 4px;

    .fc-event-title { font-size: 12px; font-weight: 500; }
    .fc-event-time  { font-size: 11px; opacity: 0.85; }
  }

  // "更多" 弹出框
  :deep(.fc-popover) {
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    border: 1px solid $border-light;
  }

  :deep(.fc-popover-header) {
    background: $bg-page;
    font-size: 13px;
    font-weight: 600;
    color: $text-primary;
  }
}
</style>
