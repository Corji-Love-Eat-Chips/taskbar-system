<template>
  <div class="page-staff">

    <!-- ── 工具栏 ──────────────────────────────────────────────────────── -->
    <div class="toolbar">
      <div class="filters">
        <el-input
          v-model="filters.name"
          placeholder="搜索姓名…"
          clearable
          style="width:160px"
          @input="debouncedLoad"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>

        <el-input
          v-model="filters.department"
          placeholder="按部门搜索…"
          clearable
          style="width:160px"
          @input="debouncedLoad"
        >
          <template #prefix><el-icon><OfficeBuilding /></el-icon></template>
        </el-input>

        <el-select
          v-model="filters.status"
          placeholder="全部状态"
          clearable
          style="width:120px"
          @change="loadStaff"
        >
          <el-option label="在职" value="active" />
          <el-option label="已离职" value="left" />
          <el-option label="已禁用" value="disabled" />
        </el-select>
      </div>

      <div class="toolbar-actions">
        <el-button :loading="loading" circle @click="loadStaff">
          <el-icon><Refresh /></el-icon>
        </el-button>
        <el-button
          v-if="userStore.isAdmin"
          @click="downloadStaffImportTemplate"
        >
          <el-icon><Download /></el-icon> 下载空模板
        </el-button>
        <el-upload
          v-if="userStore.isAdmin"
          :show-file-list="false"
          accept=".xlsx,.xls"
          :http-request="handleImportStaff"
        >
          <el-button>
            <el-icon><Upload /></el-icon> 批量导入
          </el-button>
        </el-upload>
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon> 新增人员
        </el-button>
      </div>
    </div>

    <!-- ── 表格 ──────────────────────────────────────────────────────────── -->
    <el-card shadow="never" class="table-card">
      <el-table
        :data="list"
        :loading="loading"
        stripe
        row-key="staff_id"
        style="width:100%"
      >
        <el-table-column label="姓名" prop="name" width="90" />
        <el-table-column label="性别" width="70">
          <template #default="{ row }">
            {{ row.gender === 'male' ? '男' : row.gender === 'female' ? '女' : '—' }}
          </template>
        </el-table-column>
        <el-table-column label="部门" prop="department" min-width="140" />
        <el-table-column label="职位" prop="position" min-width="120" />
        <el-table-column label="联系方式" min-width="130">
          <template #default="{ row }">
            <div v-if="row.phone">{{ row.phone }}</div>
            <div v-if="row.email" class="text-secondary text-sm">{{ row.email }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="STATUS_MAP[row.status]?.type ?? 'info'" size="small" effect="light">
              {{ STATUS_MAP[row.status]?.text ?? row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="账号" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.user_id" type="success" size="small" effect="plain">已创建</el-tag>
            <el-tag v-else type="info" size="small" effect="plain">未创建</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-divider direction="vertical" />
            <el-button
              v-if="!row.user_id"
              link type="success" size="small"
              @click="openCreateUser(row)"
            >创建账号</el-button>
            <el-button
              v-else
              link type="warning" size="small"
              @click="openResetPwd(row)"
            >重置密码</el-button>
            <el-divider direction="vertical" />
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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
          @current-change="loadStaff"
          @size-change="() => { page = 1; loadStaff() }"
        />
      </div>
    </el-card>

    <!-- ── 新增 / 编辑弹窗 ─────────────────────────────────────────────── -->
    <el-dialog
      v-model="formVisible"
      :title="formData.staff_id ? '编辑人员' : '新增人员'"
      width="560px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="80px"
      >
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="工号" prop="staff_code">
              <el-input v-model="formData.staff_code" :disabled="!!formData.staff_id" placeholder="唯一工号" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="formData.name" placeholder="真实姓名" clearable />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="性别">
              <el-radio-group v-model="formData.gender">
                <el-radio value="male">男</el-radio>
                <el-radio value="female">女</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-select v-model="formData.status" style="width:100%">
                <el-option label="在职" value="active" />
                <el-option label="已离职" value="left" />
                <el-option label="已禁用" value="disabled" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="部门" prop="department">
          <el-input v-model="formData.department" placeholder="所在部门" clearable />
        </el-form-item>
        <el-form-item label="职位" prop="position">
          <el-input v-model="formData.position" placeholder="担任职位" clearable />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="手机">
              <el-input v-model="formData.phone" placeholder="联系电话" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱">
              <el-input v-model="formData.email" placeholder="电子邮箱" clearable />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取 消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitStaff">
          {{ formData.staff_id ? '保 存' : '创 建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- ── 创建账号弹窗 ────────────────────────────────────────────────── -->
    <el-dialog
      v-model="userDialogVisible"
      :title="`为「${userTarget?.name}」创建登录账号`"
      width="440px"
      destroy-on-close
    >
      <el-form
        ref="userFormRef"
        :model="userFormData"
        :rules="userFormRules"
        label-width="80px"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="userFormData.username" placeholder="登录用户名" clearable />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="userFormData.role" style="width:100%">
            <el-option label="普通教师" value="teacher" />
            <el-option label="领导" value="leader" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-alert type="info" :closable="false" show-icon>
          初始密码将在创建后显示，请及时转告用户。
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="userDialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="userSubmitting" @click="handleCreateUser">创 建</el-button>
      </template>
    </el-dialog>

    <!-- ── 重置密码结果弹窗 ─────────────────────────────────────────────── -->
    <el-dialog v-model="pwdResultVisible" title="密码已重置" width="360px">
      <div class="pwd-result">
        <el-icon class="pwd-icon" color="#67c23a"><CircleCheckFilled /></el-icon>
        <p>新密码：<strong class="pwd-text">{{ newPwd }}</strong></p>
        <p class="text-secondary">请及时将新密码告知用户。</p>
      </div>
      <template #footer>
        <el-button type="primary" @click="pwdResultVisible = false">确 定</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, OfficeBuilding, Refresh, Plus, Upload, Download, CircleCheckFilled } from '@element-plus/icons-vue'
import { useDebounceFn } from '@vueuse/core'
import {
  getStaffList, createStaff, updateStaff, deleteStaff, createUserForStaff, importStaff,
} from '@/api/staff'
import { resetPassword } from '@/api/user'
import { useUserStore } from '@/store/user'
import { downloadStaffImportTemplate } from '@/utils/importTemplates'

const userStore = useUserStore()

// ── 常量 ──────────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  active:   { text: '在职', type: 'success' },
  left:     { text: '已离职', type: 'info' },
  disabled: { text: '已禁用', type: 'danger' },
}

// ── 列表 ──────────────────────────────────────────────────────────────────────
const loading  = ref(false)
const list     = ref([])
const page     = ref(1)
const pageSize = ref(20)
const total    = ref(0)

const filters = reactive({ name: '', department: '', status: '' })

async function loadStaff() {
  loading.value = true
  try {
    const res = await getStaffList({
      name:       filters.name       || undefined,
      department: filters.department || undefined,
      status:     filters.status     || undefined,
      page:       page.value,
      pageSize:   pageSize.value,
    })
    list.value  = res.data?.list ?? []
    total.value = res.data?.pagination?.total ?? 0
  } catch {
    //
  } finally {
    loading.value = false
  }
}

const debouncedLoad = useDebounceFn(() => { page.value = 1; loadStaff() }, 400)

function showImportErrors(err) {
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

async function handleImportStaff({ file }) {
  try {
    const res = await importStaff(file)
    ElMessage.success(res.message || '导入成功')
    page.value = 1
    loadStaff()
  } catch (e) {
    if (!showImportErrors(e)) {
      /* request 拦截器已提示 */
    }
  }
}

// ── 新增 / 编辑 ───────────────────────────────────────────────────────────────
const formVisible = ref(false)
const submitting  = ref(false)
const formRef     = ref(null)

const defaultForm = () => ({
  staff_id: null, staff_code: '', name: '',
  gender: 'male', department: '', position: '',
  phone: '', email: '', status: 'active',
})
const formData  = reactive(defaultForm())
const formRules = {
  staff_code: [{ required: true, message: '工号不能为空', trigger: 'blur' }],
  name:       [{ required: true, message: '姓名不能为空', trigger: 'blur' }],
  department: [{ required: true, message: '部门不能为空', trigger: 'blur' }],
  position:   [{ required: true, message: '职位不能为空', trigger: 'blur' }],
}

function openCreate() {
  Object.assign(formData, defaultForm())
  formVisible.value = true
}
function openEdit(row) {
  Object.assign(formData, { ...row })
  formVisible.value = true
}
function resetForm() {
  formRef.value?.resetFields()
  Object.assign(formData, defaultForm())
}

async function handleSubmitStaff() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    if (formData.staff_id) {
      await updateStaff(formData.staff_id, formData)
      ElMessage.success('人员信息已更新')
    } else {
      await createStaff(formData)
      ElMessage.success('人员已创建')
    }
    formVisible.value = false
    loadStaff()
  } catch {
    //
  } finally {
    submitting.value = false
  }
}

// ── 删除 ──────────────────────────────────────────────────────────────────────
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除人员「${row.name}」？此操作将其状态标记为离职。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
    await deleteStaff(row.staff_id)
    ElMessage.success('已删除')
    loadStaff()
  } catch (e) {
    if (e === 'cancel') return
  }
}

// ── 创建账号 ──────────────────────────────────────────────────────────────────
const userDialogVisible = ref(false)
const userSubmitting    = ref(false)
const userFormRef       = ref(null)
const userTarget        = ref(null)
const userFormData      = reactive({ username: '', role: 'teacher' })
const userFormRules     = {
  username: [{ required: true, message: '用户名不能为空', trigger: 'blur' }],
  role:     [{ required: true, message: '请选择角色', trigger: 'change' }],
}

function openCreateUser(row) {
  userTarget.value         = row
  userFormData.username    = row.staff_code
  userFormData.role        = 'teacher'
  userDialogVisible.value  = true
}

async function handleCreateUser() {
  const valid = await userFormRef.value?.validate().catch(() => false)
  if (!valid) return
  userSubmitting.value = true
  try {
    const res = await createUserForStaff(userTarget.value.staff_id, {
      username: userFormData.username,
      role:     userFormData.role,
    })
    ElMessage.success(`账号已创建，初始密码：${res.message?.match(/：(.+)$/)?.[1] ?? '请查看提示'}`)
    userDialogVisible.value = false
    loadStaff()
  } catch {
    //
  } finally {
    userSubmitting.value = false
  }
}

// ── 重置密码 ──────────────────────────────────────────────────────────────────
const pwdResultVisible = ref(false)
const newPwd           = ref('')

async function openResetPwd(row) {
  try {
    await ElMessageBox.confirm(
      `确定重置「${row.name}」的登录密码？`,
      '重置密码',
      { type: 'warning', confirmButtonText: '重置', cancelButtonText: '取消' },
    )
    const res = await resetPassword(row.user_id)
    newPwd.value           = res.data?.newPassword ?? '请联系管理员'
    pwdResultVisible.value = true
  } catch (e) {
    if (e === 'cancel') return
  }
}

onMounted(loadStaff)
</script>

<style lang="scss" scoped>
.page-staff { display: flex; flex-direction: column; gap: 16px; }

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $bg-card;
  padding: 14px 18px;
  border-radius: $radius-md;
  border: 1px solid $border-light;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.04);
  flex-wrap: wrap;
  gap: 10px;
}

.filters, .toolbar-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.table-card {
  border-radius: $radius-md;
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
