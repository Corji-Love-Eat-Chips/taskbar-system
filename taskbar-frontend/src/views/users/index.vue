<template>
  <div class="page-users">

    <!-- ── 工具栏 ──────────────────────────────────────────────────────── -->
    <div class="toolbar">
      <div class="filters">
        <el-input
          v-model="filters.keyword"
          placeholder="搜索用户名…"
          clearable
          style="width:180px"
          @input="debouncedLoad"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>

        <el-select
          v-model="filters.role"
          placeholder="全部角色"
          clearable
          style="width:120px"
          @change="loadUsers"
        >
          <el-option label="管理员" value="admin" />
          <el-option label="领导" value="leader" />
          <el-option label="教师" value="teacher" />
        </el-select>

        <el-select
          v-model="filters.status"
          placeholder="全部状态"
          clearable
          style="width:120px"
          @change="loadUsers"
        >
          <el-option label="正常" :value="1" />
          <el-option label="已禁用" :value="0" />
        </el-select>
      </div>

      <div class="toolbar-actions">
        <el-button :loading="loading" circle @click="loadUsers">
          <el-icon><Refresh /></el-icon>
        </el-button>
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon> 新增账号
        </el-button>
      </div>
    </div>

    <!-- ── 表格 ──────────────────────────────────────────────────────────── -->
    <el-card shadow="never" class="table-card">
      <el-table :data="list" :loading="loading" stripe row-key="user_id" style="width:100%">
        <el-table-column label="用户名" prop="username" width="140" />
        <el-table-column label="关联人员" min-width="120">
          <template #default="{ row }">
            {{ row.staff_name || '—' }}
            <span v-if="row.staff_name && row.department" class="text-secondary text-sm">
              · {{ row.department }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="ROLE_MAP[row.role]?.type ?? 'info'" size="small" effect="light">
              {{ ROLE_MAP[row.role]?.text ?? row.role }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small" effect="light">
              {{ row.status === 1 ? '正常' : '已禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="登录失败次数" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.login_fail_count >= 5" type="danger" size="small">
              {{ row.login_fail_count }} 次（已锁定）
            </el-tag>
            <span v-else class="text-secondary">{{ row.login_fail_count ?? 0 }} 次</span>
          </template>
        </el-table-column>
        <el-table-column label="最后登录" min-width="140">
          <template #default="{ row }">{{ row.last_login_at ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="140">
          <template #default="{ row }">{{ fmtDt(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-divider direction="vertical" />
            <el-button link type="warning" size="small" @click="handleResetPwd(row)">
              重置密码
            </el-button>
            <el-divider direction="vertical" />
            <el-button
              v-if="row.login_fail_count >= 5"
              link type="success" size="small"
              @click="handleUnlock(row)"
            >解锁</el-button>
            <el-button
              v-else
              link type="danger" size="small"
              :disabled="row.user_id === currentUserId"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="loadUsers"
          @size-change="() => { page = 1; loadUsers() }"
        />
      </div>
    </el-card>

    <!-- ── 新增 / 编辑弹窗 ─────────────────────────────────────────────── -->
    <el-dialog
      v-model="formVisible"
      :title="formData.user_id ? '编辑账号' : '新增账号'"
      width="480px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="80px"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="formData.username"
            :disabled="!!formData.user_id"
            placeholder="登录用户名（唯一）"
            clearable
          />
        </el-form-item>

        <el-form-item v-if="!formData.user_id" label="初始密码" prop="password">
          <el-input
            v-model="formData.password"
            type="password"
            show-password
            placeholder="不填则随机生成"
            clearable
          />
        </el-form-item>

        <el-form-item label="角色" prop="role">
          <el-select v-model="formData.role" style="width:100%">
            <el-option label="管理员" value="admin" />
            <el-option label="领导" value="leader" />
            <el-option label="普通教师" value="teacher" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="!formData.user_id" label="关联人员">
          <el-select
            v-model="formData.staff_id"
            filterable
            clearable
            placeholder="可选，绑定到人员档案"
            style="width:100%"
          >
            <el-option
              v-for="s in staffOptions"
              :key="s.staff_id"
              :label="`${s.name}（${s.department}）`"
              :value="s.staff_id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取 消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitUser">
          {{ formData.user_id ? '保 存' : '创 建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- ── 重置密码结果 ────────────────────────────────────────────────── -->
    <el-dialog v-model="pwdVisible" title="密码已重置" width="360px">
      <div class="pwd-result">
        <el-icon class="pwd-icon" color="#67c23a"><CircleCheckFilled /></el-icon>
        <p>新密码：<strong class="pwd-text">{{ newPwd }}</strong></p>
        <p class="text-secondary">请及时将新密码告知用户。</p>
      </div>
      <template #footer>
        <el-button type="primary" @click="pwdVisible = false">确 定</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, CircleCheckFilled } from '@element-plus/icons-vue'
import { useDebounceFn } from '@vueuse/core'
import dayjs from 'dayjs'
import { getUserList, createUser, updateUser, resetPassword, unlockUser } from '@/api/user'
import { getStaffAll } from '@/api/staff'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const currentUserId = computed(() => userStore.userInfo?.user_id)

// ── 常量 ──────────────────────────────────────────────────────────────────────
const ROLE_MAP = {
  admin:   { text: '管理员', type: 'danger'  },
  leader:  { text: '领导',   type: 'warning' },
  teacher: { text: '教师',   type: 'primary' },
}

function fmtDt(d) {
  if (!d) return '—'
  return dayjs(d).format('YYYY-MM-DD HH:mm')
}

// ── 列表 ──────────────────────────────────────────────────────────────────────
const loading  = ref(false)
const list     = ref([])
const page     = ref(1)
const pageSize = ref(20)
const total    = ref(0)
const filters  = reactive({ keyword: '', role: '', status: '' })

async function loadUsers() {
  loading.value = true
  try {
    const res = await getUserList({
      keyword:  filters.keyword  || undefined,
      role:     filters.role     || undefined,
      status:   filters.status   !== '' ? filters.status : undefined,
      page:     page.value,
      pageSize: pageSize.value,
    })
    list.value  = res.data?.list ?? []
    total.value = res.data?.pagination?.total ?? 0
  } catch {
    //
  } finally {
    loading.value = false
  }
}

const debouncedLoad = useDebounceFn(() => { page.value = 1; loadUsers() }, 400)

// ── 人员下拉（新增时用）────────────────────────────────────────────────────────
const staffOptions = ref([])
async function loadStaffOptions() {
  try {
    const res = await getStaffAll()
    staffOptions.value = res.data ?? []
  } catch {
    staffOptions.value = []
  }
}

// ── 新增 / 编辑 ───────────────────────────────────────────────────────────────
const formVisible = ref(false)
const submitting  = ref(false)
const formRef     = ref(null)

const defaultForm = () => ({
  user_id: null, username: '', password: '',
  role: 'teacher', staff_id: null,
})
const formData  = reactive(defaultForm())
const formRules = {
  username: [{ required: true, message: '用户名不能为空', trigger: 'blur' }],
  role:     [{ required: true, message: '请选择角色',     trigger: 'change' }],
}

function openCreate() {
  Object.assign(formData, defaultForm())
  if (!staffOptions.value.length) loadStaffOptions()
  formVisible.value = true
}
function openEdit(row) {
  Object.assign(formData, { user_id: row.user_id, username: row.username, role: row.role, password: '', staff_id: row.staff_id ?? null })
  formVisible.value = true
}
function resetForm() {
  formRef.value?.resetFields()
  Object.assign(formData, defaultForm())
}

async function handleSubmitUser() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    if (formData.user_id) {
      await updateUser(formData.user_id, { role: formData.role })
      ElMessage.success('账号已更新')
    } else {
      const payload = {
        username: formData.username,
        role:     formData.role,
        staff_id: formData.staff_id || null,
      }
      if (formData.password) payload.password = formData.password
      const res = await createUser(payload)
      // 后端在 message 里附带初始密码
      ElMessage({
        message: res.message ?? '账号已创建',
        type: 'success',
        duration: 6000,
      })
    }
    formVisible.value = false
    loadUsers()
  } catch {
    //
  } finally {
    submitting.value = false
  }
}

// ── 禁用 / 启用 ───────────────────────────────────────────────────────────────
async function handleToggleStatus(row) {
  const action = row.status === 1 ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定${action}账号「${row.username}」？`, `${action}确认`, {
      type: 'warning',
      confirmButtonText: action,
    })
    await updateUser(row.user_id, { status: row.status === 1 ? 0 : 1 })
    ElMessage.success(`已${action}`)
    loadUsers()
  } catch (e) {
    if (e === 'cancel') return
  }
}

// ── 解锁 ──────────────────────────────────────────────────────────────────────
async function handleUnlock(row) {
  try {
    await unlockUser(row.user_id)
    ElMessage.success('账号已解锁')
    loadUsers()
  } catch {
    //
  }
}

// ── 重置密码 ──────────────────────────────────────────────────────────────────
const pwdVisible = ref(false)
const newPwd     = ref('')

async function handleResetPwd(row) {
  try {
    await ElMessageBox.confirm(`确定重置「${row.username}」的密码？`, '重置密码', {
      type: 'warning',
      confirmButtonText: '重置',
    })
    const res = await resetPassword(row.user_id)
    newPwd.value    = res.data?.newPassword ?? '请联系管理员'
    pwdVisible.value = true
  } catch (e) {
    if (e === 'cancel') return
  }
}

onMounted(loadUsers)
</script>

<style lang="scss" scoped>
.page-users { display: flex; flex-direction: column; gap: 16px; }

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $bg-card;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid $border-light;
  flex-wrap: wrap;
  gap: 10px;
}

.filters, .toolbar-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.table-card {
  border-radius: 10px;
  :deep(.el-card__body) { padding: 0; }
}

.pagination-wrap {
  padding: 14px 16px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid $border-lighter;
}

.text-secondary { color: $text-secondary; }
.text-sm        { font-size: 12px; }

.pwd-result {
  text-align: center;
  padding: 8px 0;

  .pwd-icon { font-size: 40px; margin-bottom: 12px; }
  .pwd-text {
    font-size: 18px;
    color: $primary;
    letter-spacing: 1px;
    font-family: monospace;
  }
}
</style>
