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
          :auto-select-current="true"
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
        <el-button
          v-if="userStore.isAdmin || userStore.isLeader"
          type="primary"
          @click="handleCreate"
        >
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
        :empty-text="loading ? '加载中…' : '暂无任务数据'"
        style="width: 100%"
      >
        <!-- 任务名称：点击查看详情 -->
        <el-table-column label="任务名称" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="task-name-link" @click="handleViewDetail(row)">
              {{ row.task_name }}
            </span>
          </template>
        </el-table-column>

        <!-- 负责人 -->
        <el-table-column label="负责人" prop="owner_name" width="90" align="center" />

        <!-- 截止日期 -->
        <el-table-column label="截止日期" width="120" align="center">
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
        <el-table-column label="状态" width="95" align="center">
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
        <el-table-column label="进度" width="140">
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
        <el-table-column label="分类" width="120" align="center">
          <template #default="{ row }">
            <span class="category-tag" :style="categoryTagStyle(row.category)">
              {{ row.category }}
            </span>
          </template>
        </el-table-column>

        <!-- 优先级 -->
        <el-table-column label="优先级" width="80" align="center">
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
        <el-table-column label="操作" width="140" align="center" fixed="right">
          <template #default="{ row }">
            <!-- 管理员 / 领导 -->
            <template v-if="userStore.isAdmin || userStore.isLeader">
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
  Search, Refresh, Plus, Warning,
  CircleCloseFilled,
} from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useDebounceFn } from '@vueuse/core'
import dayjs from 'dayjs'
import { getTaskList, deleteTask } from '@/api/task'
import { getStaffAll } from '@/api/staff'
import { getPeriodList } from '@/api/period'
import { useUserStore } from '@/store/user'
import PeriodSelect    from '@/components/common/PeriodSelect.vue'
import TaskDetailDrawer from '@/components/task/TaskDetailDrawer.vue'
import TaskFormDialog   from '@/components/task/TaskFormDialog.vue'

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
      page:      pagination.page,
      page_size: pagination.pageSize,
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

// 首次进入：period_id 由 PeriodSelect 异步写入后会触发上方 watch
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
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px solid $border-light;
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
  border-radius: 8px;

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
