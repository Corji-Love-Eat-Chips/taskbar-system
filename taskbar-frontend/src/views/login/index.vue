<template>
  <div class="login-page">

    <!-- ══════════════════════════════════════════════════════════════════════
         左侧品牌区（小屏隐藏）
    ═══════════════════════════════════════════════════════════════════════ -->
    <div class="login-brand">
      <!-- 装饰圆圈 -->
      <div class="brand-circle brand-circle--lg" />
      <div class="brand-circle brand-circle--sm" />

      <!-- 内容 -->
      <div class="brand-content">
        <div class="brand-icon-wrap">
          <el-icon :size="56" color="#fff"><Grid /></el-icon>
        </div>
        <h1 class="brand-title">工作计划管理平台</h1>
        <p class="brand-subtitle">Work Plan Management Platform</p>
        <ul class="brand-features">
          <li><el-icon><CircleCheck /></el-icon> 任务全流程跟踪管理</li>
          <li><el-icon><CircleCheck /></el-icon> 会议安排与提醒通知</li>
          <li><el-icon><CircleCheck /></el-icon> 个人待办高效协作</li>
          <li><el-icon><CircleCheck /></el-icon> 多角色权限灵活配置</li>
        </ul>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════
         右侧登录表单
    ═══════════════════════════════════════════════════════════════════════ -->
    <div class="login-form-wrap">
      <div class="login-card">

        <!-- 卡片头部 -->
        <div class="card-header">
          <h2 class="card-title">欢迎登录</h2>
          <p class="card-desc">请使用您的账号和密码登录系统</p>
        </div>

        <!-- 登录表单 -->
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          size="large"
          class="login-form"
          @keyup.enter="handleSubmit"
        >
          <!-- 用户名 -->
          <el-form-item prop="username" class="form-item">
            <label class="field-label">用户名</label>
            <el-input
              v-model="form.username"
              placeholder="请输入用户名"
              :prefix-icon="User"
              clearable
              autocomplete="username"
              :disabled="loading"
            />
          </el-form-item>

          <!-- 密码 -->
          <el-form-item prop="password" class="form-item">
            <label class="field-label">密码</label>
            <el-input
              ref="pwdInputRef"
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              :prefix-icon="Lock"
              show-password
              autocomplete="current-password"
              :disabled="loading"
            />
          </el-form-item>

          <!-- 记住密码 -->
          <div class="form-extra">
            <el-checkbox v-model="rememberMe">记住用户名</el-checkbox>
          </div>

          <!-- 错误提示 -->
          <transition name="error-fade">
            <el-alert
              v-if="errorMsg"
              :title="errorMsg"
              type="error"
              show-icon
              :closable="false"
              class="error-alert"
            />
          </transition>

          <!-- 登录按钮 -->
          <el-form-item class="form-item form-item--btn">
            <el-button
              type="primary"
              class="login-btn"
              :loading="loading"
              @click="handleSubmit"
            >
              <span v-if="!loading">登 录</span>
              <span v-else>登录中…</span>
            </el-button>
          </el-form-item>
        </el-form>

        <!-- 卡片底部版权 -->
        <p class="card-footer">© 2026 工作计划管理平台</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { User, Lock, Grid, CircleCheck } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/user'

const REMEMBER_KEY = 'taskbar_remember_username'

const router    = useRouter()
const route     = useRoute()
const userStore = useUserStore()

// ── refs ──────────────────────────────────────────────────────────────────
const formRef    = ref(null)
const pwdInputRef = ref(null)
const loading    = ref(false)
const errorMsg   = ref('')
const rememberMe = ref(false)

const form = reactive({ username: '', password: '' })

// ── 表单校验规则 ───────────────────────────────────────────────────────────
const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 32, message: '用户名长度为 2~32 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码不能少于 6 位', trigger: 'blur' },
  ],
}

// ── 记住用户名：初始化 ────────────────────────────────────────────────────
onMounted(() => {
  const saved = localStorage.getItem(REMEMBER_KEY)
  if (saved) {
    form.username = saved
    rememberMe.value = true
  }
})

// ── 登录逻辑 ──────────────────────────────────────────────────────────────
async function handleSubmit() {
  errorMsg.value = ''

  // 表单校验
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true

  try {
    // 记住用户名处理
    if (rememberMe.value) {
      localStorage.setItem(REMEMBER_KEY, form.username)
    } else {
      localStorage.removeItem(REMEMBER_KEY)
    }

    await userStore.login({ username: form.username, password: form.password })

    // 登录成功 → 跳转（支持 redirect 参数）
    const redirect = route.query.redirect
    router.push(typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/home')

  } catch (err) {
    // 显示后端返回的错误文案
    errorMsg.value = err?.response?.data?.message || err?.message || '用户名或密码错误'
    // 密码错误时清空密码输入框并聚焦
    form.password = ''
    await nextTick()
    pwdInputRef.value?.focus?.()
  } finally {
    loading.value = false
  }
}

// nextTick 需要从 vue 导入
import { nextTick } from 'vue'
</script>

<style lang="scss" scoped>
// ── 整体容器 ─────────────────────────────────────────────────────────────────
.login-page {
  display: flex;
  min-height: 100vh;
  overflow: hidden;
}

// ════════════════════════════════════════════════════════════════════════════
// 左侧品牌区
// ════════════════════════════════════════════════════════════════════════════
.login-brand {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, $brand-sidebar 0%, #1e4974 38%, $brand-accent 100%);
  overflow: hidden;
  padding: 60px 48px;

  // 小屏（< 900px）隐藏左侧
  @media (max-width: 900px) { display: none; }
}

// 装饰圆圈
.brand-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
  pointer-events: none;

  &--lg {
    width: 460px;
    height: 460px;
    bottom: -120px;
    right: -120px;
  }

  &--sm {
    width: 240px;
    height: 240px;
    top: -60px;
    left: -60px;
  }
}

.brand-content {
  position: relative;
  z-index: 1;
  text-align: center;
  color: #fff;
}

.brand-icon-wrap {
  width: 100px;
  height: 100px;
  margin: 0 auto 28px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-title {
  font-size: 28px;
  font-weight: 800;
  margin: 0 0 10px;
  letter-spacing: 1px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.brand-subtitle {
  font-size: 14px;
  opacity: 0.75;
  margin: 0 0 40px;
  letter-spacing: 2px;
}

.brand-features {
  list-style: none;
  margin: 0;
  padding: 0;
  text-align: left;
  display: inline-block;

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    padding: 8px 0;
    opacity: 0.92;

    .el-icon {
      color: rgba(255, 255, 255, 0.9);
      font-size: 17px;
      flex-shrink: 0;
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 右侧表单区
// ════════════════════════════════════════════════════════════════════════════
.login-form-wrap {
  width: 480px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $bg-page;
  padding: 40px 24px;

  // 小屏时撑满全宽
  @media (max-width: 900px) {
    width: 100%;
    background: linear-gradient(145deg, $brand-sidebar 0%, #1e4974 38%, $brand-accent 100%);
  }
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: $bg-card;
  border-radius: $radius-md;
  padding: 40px 36px 32px;
  border: 1px solid $border-lighter;
  box-shadow: 0 8px 40px rgb(45 90 142 / 0.12);

  @media (max-width: 900px) {
    box-shadow: 0 20px 60px rgb(0 0 0 / 0.22);
  }
}

// 卡片头部
.card-header { margin-bottom: 32px; }

.card-title {
  font-size: 24px;
  font-weight: 700;
  color: $text-primary;
  margin: 0 0 8px;
}

.card-desc {
  font-size: 14px;
  color: $text-secondary;
  margin: 0;
}

// 表单项
.login-form {
  .el-form-item { margin-bottom: 0; }
}

.form-item {
  display: flex;
  flex-direction: column;
  margin-bottom: 20px !important;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: $text-regular;
  margin-bottom: 6px;
  display: block;
}

// 记住密码行
.form-extra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;

  :deep(.el-checkbox__label) {
    font-size: 13px;
    color: $text-regular;
  }
}

// 错误提示
.error-alert {
  margin-bottom: 16px;
  border-radius: $radius-sm;
}

.error-fade-enter-active,
.error-fade-leave-active { transition: opacity 0.25s, transform 0.25s; }
.error-fade-enter-from,
.error-fade-leave-to     { opacity: 0; transform: translateY(-6px); }

// 登录按钮
.form-item--btn { margin-bottom: 0 !important; }

.login-btn {
  width: 100%;
  height: 46px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 6px;
  border-radius: $radius-sm;
  background: linear-gradient(90deg, $brand-sidebar, $brand-accent);
  border: none;
  transition: opacity 0.2s, box-shadow 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.94;
    box-shadow: 0 8px 24px rgb(45 90 142 / 0.35);
  }
}

// 卡片底部版权
.card-footer {
  text-align: center;
  font-size: 12px;
  color: $text-disabled;
  margin: 24px 0 0;
}
</style>
