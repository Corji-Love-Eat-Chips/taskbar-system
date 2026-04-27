<template>
  <el-header class="app-header" :height="HEADER_H + 'px'">

    <!-- ── 左侧：系统标题 ──────────────────────────────────────────────────── -->
    <div class="header-left">
      <h1 class="system-title">工作计划管理平台</h1>
    </div>

    <!-- ── 右侧工具栏 ──────────────────────────────────────────────────────── -->
    <div class="header-right">

      <!-- 消息通知 -->
      <el-tooltip content="消息通知" placement="bottom">
        <el-badge
          :value="noticeBadgeValue"
          :hidden="!noticeBadgeValue"
          :max="99"
          class="notice-badge"
        >
          <el-button
            circle
            text
            class="icon-btn"
            @click="toggleNoticePanel"
          >
            <el-icon :size="20"><Bell /></el-icon>
          </el-button>
        </el-badge>
      </el-tooltip>

      <!-- 全屏切换 -->
      <el-tooltip :content="isFullscreen ? '退出全屏' : '全屏'" placement="bottom">
        <el-button circle text class="icon-btn" @click="toggleFullscreen">
          <el-icon :size="18">
            <component :is="isFullscreen ? SemiSelect : FullScreen" />
          </el-icon>
        </el-button>
      </el-tooltip>

      <!-- 分割线 -->
      <el-divider direction="vertical" class="header-divider" />

      <!-- 用户下拉 -->
      <el-dropdown trigger="click" @command="handleCommand">
        <div class="user-trigger">
          <el-avatar :size="34" class="user-avatar">
            {{ avatarLetter }}
          </el-avatar>
          <div class="user-meta" v-if="!isNarrow">
            <span class="user-display">{{ displayName }}</span>
            <span class="user-role">{{ roleLabel }}</span>
          </div>
          <el-icon class="caret"><CaretBottom /></el-icon>
        </div>

        <template #dropdown>
          <el-dropdown-menu>
            <div class="dropdown-header">
              <el-avatar :size="40" class="dh-avatar">{{ avatarLetter }}</el-avatar>
              <div>
                <div class="dh-name">{{ displayName }}</div>
                <div class="dh-role">{{ roleLabel }}</div>
              </div>
            </div>
            <el-divider style="margin: 4px 0" />
            <el-dropdown-item command="profile" :icon="User">个人信息</el-dropdown-item>
            <el-dropdown-item command="password" :icon="Lock">修改密码</el-dropdown-item>
            <el-divider style="margin: 4px 0" />
            <el-dropdown-item command="logout" :icon="SwitchButton" class="logout-item">
              退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- ── 通知面板（抽屉式）─────────────────────────────────────────────── -->
    <el-drawer
      v-model="noticePanelVisible"
      title="消息通知"
      direction="rtl"
      size="360px"
    >
      <el-empty v-if="notices.length === 0" description="暂无消息" />
      <el-timeline v-else>
        <el-timeline-item
          v-for="n in notices"
          :key="n.id"
          :timestamp="n.time"
          placement="top"
        >
          {{ n.content }}
        </el-timeline-item>
      </el-timeline>
    </el-drawer>

    <!-- 修改密码 -->
    <el-dialog
      v-model="passwordDialogVisible"
      title="修改密码"
      width="420px"
      destroy-on-close
      :close-on-click-modal="false"
      @closed="resetPasswordForm"
    >
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="96px"
        @submit.prevent
      >
        <el-form-item label="原密码" prop="old_password">
          <el-input
            v-model="passwordForm.old_password"
            type="password"
            show-password
            autocomplete="current-password"
            placeholder="请输入当前登录密码"
          />
        </el-form-item>
        <el-form-item label="新密码" prop="new_password">
          <el-input
            v-model="passwordForm.new_password"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="至少 6 位"
          />
        </el-form-item>
        <el-form-item label="确认新密码" prop="new_password_confirm">
          <el-input
            v-model="passwordForm.new_password_confirm"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="再次输入新密码"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="passwordSubmitting" @click="submitPasswordChange">
          确定
        </el-button>
      </template>
    </el-dialog>

  </el-header>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import {
  Bell, FullScreen, SemiSelect,
  User, Lock, SwitchButton, CaretBottom,
} from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useUserStore } from '@/store/user'
import { changePassword as apiChangePassword } from '@/api/user'

// ── 常量 ──────────────────────────────────────────────────────────────────
const HEADER_H = 56

const router    = useRouter()
const userStore = useUserStore()

// ── 用户信息派生 ───────────────────────────────────────────────────────────
const displayName = computed(
  () => userStore.userInfo?.staff_name || userStore.username || '未知用户',
)
const avatarLetter = computed(
  () => (userStore.userInfo?.staff_name || userStore.username || '?').charAt(0).toUpperCase(),
)
const roleLabel = computed(() => {
  const map = { admin: '管理员', teacher: '教师', leader: '系部领导' }
  return map[userStore.role] ?? userStore.role ?? ''
})

const noticeBadgeValue = computed(() => {
  const n = Number(unreadCount.value)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return Math.min(Math.floor(n), 99)
})

// ── 窄屏判断（可换为 useWindowSize）────────────────────────────────────────
const isNarrow = ref(false)

// ── 全屏 ──────────────────────────────────────────────────────────────────
const isFullscreen = ref(false)
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
    isFullscreen.value = true
  } else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

// ── 消息通知 ──────────────────────────────────────────────────────────────
const noticePanelVisible = ref(false)
const unreadCount = ref(0)
// 占位数据，后续替换为真实接口
const notices = ref([])

function toggleNoticePanel() {
  noticePanelVisible.value = !noticePanelVisible.value
  unreadCount.value = 0   // 打开即标记已读
}

// ── 修改密码 ────────────────────────────────────────────────────────────────
const passwordDialogVisible = ref(false)
const passwordSubmitting = ref(false)
const passwordFormRef = ref(null)
const passwordForm = reactive({
  old_password: '',
  new_password: '',
  new_password_confirm: '',
})

function resetPasswordForm() {
  passwordForm.old_password = ''
  passwordForm.new_password = ''
  passwordForm.new_password_confirm = ''
  passwordFormRef.value?.resetFields?.()
}

const passwordRules = {
  old_password: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码至少 6 位', trigger: 'blur' },
  ],
  new_password_confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, val, cb) => {
        if (val !== passwordForm.new_password) cb(new Error('两次输入的新密码不一致'))
        else cb()
      },
      trigger: 'blur',
    },
  ],
}

async function submitPasswordChange() {
  const form = passwordFormRef.value
  if (!form) return
  try {
    await form.validate()
  } catch {
    return
  }
  passwordSubmitting.value = true
  try {
    const res = await apiChangePassword({
      old_password: passwordForm.old_password,
      new_password: passwordForm.new_password,
    })
    ElMessage.success(res.message || '密码修改成功，请重新登录')
    passwordDialogVisible.value = false
    await userStore.logout()
    router.push('/login')
  } catch {
    /* 错误信息由 request 拦截器或业务码提示 */
  } finally {
    passwordSubmitting.value = false
  }
}

// ── 下拉菜单命令 ──────────────────────────────────────────────────────────
async function handleCommand(cmd) {
  if (cmd === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '退出确认', {
        type: 'warning',
        confirmButtonText: '确定退出',
        cancelButtonText: '取消',
      })
      await userStore.logout()
      router.push('/login')
    } catch {
      // 用户取消，不处理
    }
    return
  }
  if (cmd === 'profile') {
    // TODO: 打开个人信息弹窗
    return
  }
  if (cmd === 'password') {
    resetPasswordForm()
    passwordDialogVisible.value = true
  }
}
</script>

<style lang="scss" scoped>
$header-h: $header-height;

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: $header-h !important;
  padding: 0 24px;
  background: $bg-card;
  border-bottom: 1px solid $border-light;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  flex-shrink: 0;
  z-index: 100;
}

// ── 左侧标题 ────────────────────────────────────────────────────────────────
.header-left { display: flex; align-items: center; }

.system-title {
  font-size: 18px;
  font-weight: 600;
  color: $text-primary;
  margin: 0;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

// ── 右侧 ────────────────────────────────────────────────────────────────────
.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon-btn {
  color: $text-secondary;
  &:hover {
    color: $primary;
    background: rgba($brand-sidebar, 0.08) !important;
  }
}

.notice-badge {
  :deep(.el-badge__content) { font-size: 11px; }
}

.header-divider {
  height: 20px;
  margin: 0 8px;
}

// ── 用户区 ──────────────────────────────────────────────────────────────────
.user-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 4px 10px 4px 4px;
  border-radius: 8px;
  transition: background 0.2s;

  &:hover { background: #f5f7fa; }
}

.user-avatar {
  background: $brand-accent;
  font-size: 15px;
  font-weight: 600;
  flex-shrink: 0;
}

.user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.user-display {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
}

.user-role {
  font-size: 11px;
  color: $text-secondary;
}

.caret {
  font-size: 12px;
  color: #909399;
}

// ── 下拉菜单头部 ─────────────────────────────────────────────────────────────
.dropdown-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px 8px;
}

.dh-avatar {
  background: $brand-accent;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
}

.dh-name {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
}

.dh-role {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 2px;
}

.logout-item { color: #f56c6c !important; }
</style>
