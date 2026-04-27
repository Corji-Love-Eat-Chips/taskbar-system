<template>
  <div class="page-tasks">

    <!-- ── 工具栏 ──────────────────────────────────────────────────────────── -->
    <div class="toolbar">
      <div class="filters">
        <!-- 学期（筛选周次列表；清空=全部学期，周次下拉按学期分组） -->
        <el-select
          v-model="filters.semester"
          placeholder="全部学期"
          clearable
          filterable
          class="filter-item filter-semester"
        >
          <el-option
            v-for="opt in semesterOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>

        <!-- 周次 / 周期 -->
        <PeriodSelect
          v-model="filters.period_id"
          :semester-filter="filters.semester || ''"
          placeholder="全部周期"
          :clearable="true"
          :auto-select-current="false"
          class="filter-item filter-period"
        />

        <!-- 分类 -->
        <el-select
          v-model="filters.category"
          placeholder="全部分类"
          clearable
          class="filter-item"
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

        <!-- 状态 -->
        <el-select
          v-model="filters.status"
          placeholder="全部状态"
          clearable
          class="filter-item"
        >
          <el-option label="待开始" value="pending" />
          <el-option label="进行中" value="in_progress" />
          <el-option label="已完成" value="completed" />
          <el-option label="已延期" value="delayed" />
          <el-option label="已取消" value="cancelled" />
        </el-select>

        <!-- 负责人 -->
        <el-select
          v-model="filters.owner_id"
          placeholder="全部负责人"
          clearable
          filterable
          class="filter-item filter-owner"
        >
          <el-option
            v-for="s in staffOptions"
            :key="s.staff_id"
            :label="s.name"
            :value="s.staff_id"
          >
            <span>{{ s.name }}</span>
            <span class="owner-opt-dept">{{ s.department }}</span>
          </el-option>
        </el-select>

        <!-- 搜索 -->
        <el-input
          v-model="filters.keyword"
          placeholder="搜索任务名称…"
          clearable
          class="filter-item filter-search"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <!-- 右侧操作区 -->
      <div class="toolbar-actions">
        <el-button @click="handleRefresh">
          <el-icon><Refresh /></el-icon>
        </el-button>
        <el-button :loading="exportPdfLoading" @click="handleExportPdf">
          <el-icon><Document /></el-icon> 导出 PDF
        </el-button>
        <el-button
          v-if="userStore.isAdmin || userStore.isLeader"
          @click="downloadTaskImportTemplate"
        >
          <el-icon><Download /></el-icon> 下载空模板
        </el-button>
        <el-upload
          v-if="userStore.isAdmin || userStore.isLeader"
          :show-file-list="false"
          accept=".xlsx,.xls"
          :http-request="handleImportTasks"
        >
          <el-button>
            <el-icon><Upload /></el-icon> 批量导入
          </el-button>
        </el-upload>
        <el-button type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon> 新增任务
        </el-button>
      </div>
    </div>

    <!-- ── 任务表格 ──────────────────────────────────────────────────────────── -->
    <el-card shadow="never" class="table-card">
      <el-table
        v-loading="loading"
        :data="taskList"
        row-key="task_id"
        stripe
        border
        :empty-text="loading ? '加载中…' : '暂无任务数据'"
        style="width: 100%"
        @sort-change="onSortChange"
        @header-dragend="onHeaderDragEnd"
      >
        <!-- 任务名称：点击查看详情 -->
        <el-table-column
          label="任务名称"
          prop="task_name"
          column-key="task_name"
          sortable="custom"
          resizable
          :width="colWidths.task_name"
          :min-width="120"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span class="task-name-link" @click="handleViewDetail(row)">
              {{ row.task_name }}
            </span>
          </template>
        </el-table-column>

        <!-- 负责人 -->
        <el-table-column
          label="负责人"
          prop="owner_name"
          column-key="owner_name"
          sortable="custom"
          resizable
          :width="colWidths.owner_name"
          :min-width="72"
          align="center"
        />

        <!-- 截止日期 -->
        <el-table-column
          label="截止日期"
          prop="end_date"
          column-key="end_date"
          sortable="custom"
          resizable
          :width="colWidths.end_date"
          :min-width="96"
          align="center"
        >
          <template #default="{ row }">
            <div :class="['date-cell', dateClass(row.end_date, row.status)]">
              {{ row.end_date }}
              <el-tooltip
                v-if="isExpiring(row.end_date, row.status)"
                content="即将到期"
                placement="top"
              >
                <el-icon class="warn-icon"><Warning /></el-icon>
              </el-tooltip>
              <el-tooltip
                v-else-if="isOverdue(row.end_date, row.status)"
                content="已超期"
                placement="top"
              >
                <el-icon class="warn-icon"><CircleCloseFilled /></el-icon>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>

        <!-- 状态 -->
        <el-table-column
          label="状态"
          prop="status"
          column-key="status"
          sortable="custom"
          resizable
          :width="colWidths.status"
          :min-width="72"
          align="center"
        >
          <template #default="{ row }">
            <el-tag
              :type="STATUS_MAP[row.status]?.type ?? 'info'"
              size="small"
              effect="light"
            >
              {{ STATUS_MAP[row.status]?.text ?? row.status }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 进度 -->
        <el-table-column
          label="进度"
          prop="progress"
          column-key="progress"
          sortable="custom"
          resizable
          :width="colWidths.progress"
          :min-width="100"
        >
          <template #default="{ row }">
            <div class="progress-cell">
              <el-progress
                :percentage="row.progress"
                :stroke-width="6"
                :status="row.progress === 100 ? 'success' : undefined"
                :show-text="false"
              />
              <span class="progress-num">{{ row.progress }}%</span>
            </div>
          </template>
        </el-table-column>

        <!-- 分类 -->
        <el-table-column
          label="分类"
          prop="category"
          column-key="category"
          sortable="custom"
          resizable
          :width="colWidths.category"
          :min-width="88"
          align="center"
        >
          <template #default="{ row }">
            <span class="category-tag" :style="categoryTagStyle(row.category)">
              {{ row.category }}
            </span>
          </template>
        </el-table-column>

        <!-- 优先级 -->
        <el-table-column
          label="优先级"
          prop="priority"
          column-key="priority"
          sortable="custom"
          resizable
          :width="colWidths.priority"
          :min-width="64"
          align="center"
        >
          <template #default="{ row }">
            <el-tag
              :type="PRIORITY_MAP[row.priority]?.type ?? 'info'"
              size="small"
              effect="plain"
            >
              {{ PRIORITY_MAP[row.priority]?.text ?? '-' }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 操作 -->
        <el-table-column
          label="操作"
          column-key="actions"
          resizable
          :width="colWidths.actions"
          :min-width="160"
          align="center"
          fixed="right"
        >
          <template #default="{ row }">
            <!-- 管理员 / 领导 -->
            <template v-if="userStore.isAdmin || userStore.isLeader">
              <el-button link type="primary" size="small" @click="handleViewDetail(row)">
                详情
              </el-button>
              <span class="op-dot" aria-hidden="true">·</span>
              <el-button link type="primary" size="small" @click="handleEdit(row)">
                编辑
              </el-button>
              <el-divider direction="vertical" />
              <el-button link type="danger" size="small" @click="handleDelete(row)">
                删除
              </el-button>
            </template>

            <!-- 教师（本人负责 / 协助）：在详情抽屉里更新进度 -->
            <template v-else>
              <el-button link type="primary" size="small" @click="handleViewDetail(row)">
                查看
              </el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- ── 详情抽屉 ───────────────────────────────────────────────────────────── -->
    <TaskDetailDrawer
      v-model="detailVisible"
      :task-id="detailTaskId"
      @edit="handleEditFromDrawer"
      @refresh="loadTasks"
    />

    <!-- ── 新增/编辑弹窗 ──────────────────────────────────────────────────────── -->
    <TaskFormDialog
      v-model="formVisible"
      :task-id="formTaskData?.task_id ?? null"
      @success="handleFormSuccess"
    />
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import {
  Search, Refresh, Plus, Upload, Download, Warning,
  CircleCloseFilled, Document,
} from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useDebounceFn } from '@vueuse/core'
import dayjs from 'dayjs'
import { getTaskList, deleteTask, importTasks } from '@/api/task'
import { getStaffAll } from '@/api/staff'
import { getPeriodList } from '@/api/period'
import { useUserStore } from '@/store/user'
import PeriodSelect    from '@/components/common/PeriodSelect.vue'
import TaskDetailDrawer from '@/components/task/TaskDetailDrawer.vue'
import TaskFormDialog   from '@/components/task/TaskFormDialog.vue'
import { downloadTaskImportTemplate } from '@/utils/importTemplates'
import { exportTaskListPdf } from '@/utils/exportTaskListPdf'

const userStore = useUserStore()

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

const CATEGORY_COLOR_MAP = Object.fromEntries(CATEGORIES.map(c => [c.name, c.color]))

// ── 表格列宽（localStorage）──────────────────────────────────────────────────
const COL_WIDTH_STORAGE_KEY = 'taskbar_tasks_col_widths'
const COL_WIDTH_DEFAULTS = {
  task_name:  220,
  owner_name: 90,
  end_date:   120,
  status:     95,
  progress:   140,
  category:   120,
  priority:   80,
  actions:    200,
}

function loadColWidths() {
  try {
    const raw = localStorage.getItem(COL_WIDTH_STORAGE_KEY)
    if (!raw) return { ...COL_WIDTH_DEFAULTS }
    const o = JSON.parse(raw)
    const out = { ...COL_WIDTH_DEFAULTS }
    for (const k of Object.keys(out)) {
      const n = Number(o[k])
      if (Number.isFinite(n) && n >= 56) out[k] = Math.round(n)
    }
    return out
  } catch {
    return { ...COL_WIDTH_DEFAULTS }
  }
}

const colWidths = reactive(loadColWidths())

function persistColWidths() {
  try {
    localStorage.setItem(COL_WIDTH_STORAGE_KEY, JSON.stringify({ ...colWidths }))
  } catch {
    /* ignore */
  }
}

function onHeaderDragEnd(newWidth, _oldWidth, column) {
  const key = column.columnKey
  if (key && key in colWidths && Number.isFinite(Number(newWidth))) {
    colWidths[key] = Math.max(56, Math.round(Number(newWidth)))
    persistColWidths()
  }
}

// ── 排序（后端，请求参数在 loadTasks 中带上）──────────────────────────────────
const sortBy = ref('task_id')
const sortOrder = ref('desc')

// ── 列表状态 ──────────────────────────────────────────────────────────────────
const loading  = ref(false)
const taskList = ref([])

const pagination = reactive({
  page:     1,
  pageSize: 20,
  total:    0,
})

const filters = reactive({
  semester:  '',
  period_id: null,
  category:  '',
  status:    '',
  owner_id:  null,
  keyword:   '',
})

const staffOptions = ref([])

const exportPdfLoading = ref(false)

async function loadStaffOptions() {
  try {
    const res = await getStaffAll()
    staffOptions.value = res.data ?? []
  } catch {
    staffOptions.value = []
  }
}

/**
 * 学期下拉：value 与 periods.semester 一致；
 * label 附带该学期全部周次的最小开始日～最大结束日
 */
const semesterOptions = ref([])

async function loadSemesterOptions() {
  try {
    const res = await getPeriodList()
    const list = res.data ?? []
    const map = new Map()
    for (const p of list) {
      if (!p.semester) continue
      const cur = map.get(p.semester)
      if (!cur) {
        map.set(p.semester, { min: p.start_date, max: p.end_date })
      } else {
        if (p.start_date < cur.min) cur.min = p.start_date
        if (p.end_date > cur.max) cur.max = p.end_date
      }
    }
    semesterOptions.value = [...map.entries()]
      .map(([semester, { min, max }]) => ({
        value: semester,
        label: `${semester}（${min}～${max}）`,
        sortKey: min,
      }))
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
  } catch {
    semesterOptions.value = []
  }
}

onMounted(() => {
  loadSemesterOptions()
  loadStaffOptions()
})

// ── 加载数据 ──────────────────────────────────────────────────────────────────
async function loadTasks() {
  loading.value = true
  try {
    const params = {
      page:        pagination.page,
      page_size:   pagination.pageSize,
      sort_by:     sortBy.value,
      sort_order:  sortOrder.value,
    }
    if (filters.period_id) params.period_id = filters.period_id
    if (filters.category)  params.category  = filters.category
    if (filters.status)    params.status    = filters.status
    if (filters.owner_id)   params.owner_id  = filters.owner_id
    if (filters.keyword)   params.keyword   = filters.keyword.trim()

    const res = await getTaskList(params)
    taskList.value       = res.data.list        ?? []
    pagination.total     = res.data.pagination?.total ?? 0
  } catch {
    taskList.value = []
  } finally {
    loading.value = false
  }
}

function onSortChange({ prop, order }) {
  if (!prop || !order) {
    sortBy.value    = 'task_id'
    sortOrder.value = 'desc'
  } else {
    sortBy.value    = prop
    sortOrder.value = order === 'ascending' ? 'asc' : 'desc'
  }
  pagination.page = 1
  loadTasks()
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────
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

function categoryTagStyle(cat) {
  const color = CATEGORY_COLOR_MAP[cat] ?? '#909399'
  return {
    backgroundColor: color + '18',
    color,
    borderColor:     color + '50',
  }
}

// ── 监听筛选变化 ──────────────────────────────────────────────────────────────
// 下拉筛选：立即刷新
watch(
  () => [filters.period_id, filters.category, filters.status, filters.owner_id],
  () => {
    pagination.page = 1
    loadTasks()
  },
)

// 关键词：防抖 400ms
const debouncedSearch = useDebounceFn(() => {
  pagination.page = 1
  loadTasks()
}, 400)

watch(() => filters.keyword, debouncedSearch)

// ── 分页事件 ──────────────────────────────────────────────────────────────────
function handlePageChange(page) {
  pagination.page = page
  loadTasks()
}

function handleSizeChange(size) {
  pagination.pageSize = size
  pagination.page = 1
  loadTasks()
}

function handleRefresh() {
  loadSemesterOptions()
  loadStaffOptions()
  loadTasks()
}

async function handleExportPdf() {
  if (!taskList.value.length) {
    ElMessage.warning('当前页没有任务，无法导出')
    return
  }
  exportPdfLoading.value = true
  try {
    const total = pagination.total
    const size = pagination.pageSize || 20
    const totalPages = Math.max(1, Math.ceil(total / size) || 1)
    await exportTaskListPdf({
      tasks: taskList.value,
      meta: {
        exportedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        page: pagination.page,
        totalPages,
        pageRows: taskList.value.length,
        totalRows: total,
      },
      statusMap: STATUS_MAP,
      priorityMap: PRIORITY_MAP,
      filename: `任务列表_第${pagination.page}页_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`,
    })
    ElMessage.success('PDF 已开始下载')
  } catch (e) {
    console.error(e)
    ElMessage.error('导出失败，请稍后重试')
  } finally {
    exportPdfLoading.value = false
  }
}

function showTaskImportErrors(err) {
  const d = err?.response?.data
  const list = d?.data?.errors
  if (Array.isArray(list) && list.length) {
    ElMessageBox.alert(
      list.map((x) => `第 ${x.row} 行：${x.message}`).join('\n'),
      '导入失败',
      { type: 'error', confirmButtonText: '知道了' },
    )
    return true
  }
  return false
}

async function handleImportTasks({ file }) {
  try {
    const res = await importTasks(file)
    ElMessage.success(res.message || '导入成功')
    pagination.page = 1
    loadTasks()
  } catch (e) {
    if (!showTaskImportErrors(e)) {
      /* 已由 request 拦截器提示 */
    }
  }
}

// ── 详情抽屉 ──────────────────────────────────────────────────────────────────
const detailVisible = ref(false)
const detailTaskId  = ref(null)

function handleViewDetail(row) {
  detailTaskId.value  = row.task_id
  detailVisible.value = true
}

// ── 新增 / 编辑弹窗 ───────────────────────────────────────────────────────────
const formVisible  = ref(false)
const formTaskData = ref(null)

function handleCreate() {
  formTaskData.value = null
  formVisible.value  = true
}

function handleEdit(row) {
  formTaskData.value = row
  formVisible.value  = true
}

/** 从详情抽屉触发的编辑（传入完整 task 对象，包含 collaborators） */
function handleEditFromDrawer(task) {
  formTaskData.value = task
  formVisible.value  = true
}

function handleFormSuccess() {
  pagination.page = 1
  loadTasks()
}

// ── 删除 ──────────────────────────────────────────────────────────────────────
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除任务「${row.task_name}」？此操作不可撤销。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText:  '取消',
        type:              'warning',
        confirmButtonClass: 'el-button--danger',
      },
    )
    await deleteTask(row.task_id)
    ElMessage.success('任务已删除')
    // 如果当前页只有一条记录且不是第一页，回退一页
    if (taskList.value.length === 1 && pagination.page > 1) {
      pagination.page -= 1
    }
    loadTasks()
  } catch (e) {
    // 用户取消或请求拦截器已弹错，不处理
    if (e !== 'cancel') { /* 已由 request.js 处理 */ }
  }
}

// 首次进入：周期默认不自动选中，直接按当前筛选加载
loadTasks()
</script>

<style lang="scss" scoped>
.page-tasks {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

// ── 工具栏 ────────────────────────────────────────────────────────────────────
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  background: $bg-card;
  padding: 14px 18px;
  border-radius: $radius-md;
  border: 1px solid $border-light;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.04);
}

.filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex: 1;
}

.filter-item {
  width: 140px;
}

.filter-semester {
  width: min(380px, 100%);
  min-width: 220px;
}

.filter-period {
  width: 200px;
}

.filter-owner {
  width: 150px;
}

.filter-search {
  width: 200px;
}

.owner-opt-dept {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

// ── 表格卡片 ──────────────────────────────────────────────────────────────────
.table-card {
  border-radius: $radius-md;

  :deep(.el-card__body) { padding: 0; }
}

// ── 任务名称链接 ──────────────────────────────────────────────────────────────
.task-name-link {
  color: $primary;
  cursor: pointer;
  font-weight: 500;
  transition: opacity 0.15s;

  &:hover { opacity: 0.75; text-decoration: underline; }
}

// ── 日期单元格 ────────────────────────────────────────────────────────────────
.date-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;

  &.expiring {
    color: $warning;
    font-weight: 500;
  }

  &.overdue {
    color: $danger;
    font-weight: 500;
  }

  .warn-icon { font-size: 14px; }
}

// ── 进度单元格 ────────────────────────────────────────────────────────────────
.progress-cell {
  display: flex;
  align-items: center;
  gap: 8px;

  :deep(.el-progress) { flex: 1; }

  .progress-num {
    font-size: 12px;
    color: $text-secondary;
    width: 32px;
    text-align: right;
    flex-shrink: 0;
  }
}

.op-dot {
  color: $text-secondary;
  user-select: none;
  padding: 0 1px;
  font-size: 12px;
}

// ── 分类标签 ──────────────────────────────────────────────────────────────────
.category-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  border: 1px solid;
  line-height: 20px;
}

// ── 分类下拉圆点 ──────────────────────────────────────────────────────────────
.category-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
  vertical-align: middle;
}

// ── 分页 ──────────────────────────────────────────────────────────────────────
.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding: 14px 16px;
  border-top: 1px solid $border-lighter;
}
</style>
