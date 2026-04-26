<template>
  <el-aside :width="collapsed ? '64px' : '220px'" class="sidebar">

    <!-- ── Logo 区 ────────────────────────────────────────────────────────── -->
    <div class="sidebar-logo" :class="{ 'sidebar-logo--collapsed': collapsed }">
      <transition name="logo-fade" mode="out-in">
        <span v-if="!collapsed" key="full" class="logo-full">
          <span class="logo-dot">●</span> 工作计划管理平台
        </span>
        <span v-else key="mini" class="logo-mini">工</span>
      </transition>
    </div>

    <!-- ── 导航菜单 ──────────────────────────────────────────────────────── -->
    <el-scrollbar class="sidebar-scrollbar">
      <el-menu
        :default-active="activeMenu"
        :collapse="collapsed"
        :collapse-transition="false"
        router
        class="sidebar-menu"
      >
        <!-- 普通菜单组 -->
        <el-menu-item-group v-if="!collapsed" title="导航">
          <template #title><span class="group-title">导航</span></template>
        </el-menu-item-group>

        <el-menu-item
          v-for="item in commonMenus"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>

        <!-- 管理员菜单组（仅 admin 可见）-->
        <template v-if="userStore.isAdmin">
          <div v-if="!collapsed" class="menu-divider" />
          <el-menu-item-group v-if="!collapsed">
            <template #title><span class="group-title">管理</span></template>
          </el-menu-item-group>

          <el-menu-item
            v-for="item in adminMenus"
            :key="item.path"
            :index="item.path"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <template #title>{{ item.title }}</template>
          </el-menu-item>
        </template>
      </el-menu>
    </el-scrollbar>

    <!-- ── 底部折叠按钮 ────────────────────────────────────────────────────── -->
    <div class="sidebar-footer" @click="toggleCollapse">
      <el-icon class="collapse-icon">
        <component :is="collapsed ? DArrowRight : DArrowLeft" />
      </el-icon>
      <span v-if="!collapsed" class="collapse-text">收起菜单</span>
    </div>
  </el-aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  HomeFilled, List, Calendar, Checked,
  UserFilled, Setting,
  DArrowLeft, DArrowRight,
} from '@element-plus/icons-vue'
import { useUserStore } from '@/store/user'
import { useAppStore } from '@/store/app'

const route     = useRoute()
const userStore = useUserStore()
const appStore  = useAppStore()

const collapsed = computed(() => appStore.sidebarCollapsed)
function toggleCollapse() { appStore.toggleSidebar() }

// 当前激活菜单：取路径第一段
const activeMenu = computed(() => {
  const seg = route.path.split('/')[1]
  return seg ? `/${seg}` : '/home'
})

const commonMenus = [
  { path: '/home',     title: '首页',   icon: HomeFilled },
  { path: '/tasks',    title: '任务管理', icon: List      },
  { path: '/meetings', title: '会议管理', icon: Calendar  },
  { path: '/todos',    title: '我的待办', icon: Checked   },
]

const adminMenus = [
  { path: '/staff', title: '人员管理', icon: UserFilled },
  { path: '/users', title: '账号管理', icon: Setting   },
]
</script>

<style lang="scss" scoped>
// ── 与 app/Sidebar.tsx 一致：#2D5A8E、白字层级、左侧高亮条 ───────────────────
$sb-bg:          $brand-sidebar;
$sb-hover:       rgba(255, 255, 255, 0.10);
$sb-active:      rgba(255, 255, 255, 0.15);
$sb-active-bar:  #ffffff;
$sb-text:        rgba(255, 255, 255, 0.7);
$sb-text-active: #ffffff;
$sb-group-text:  rgba(255, 255, 255, 0.4);
$header-h:       $header-height;
$footer-h:       48px;

.sidebar {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $sb-bg;
  transition: width 0.25s cubic-bezier(.4, 0, .2, 1);
  overflow: hidden;
  flex-shrink: 0;
}

// ── Logo ────────────────────────────────────────────────────────────────────
.sidebar-logo {
  height: $header-h;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  white-space: nowrap;
  flex-shrink: 0;

  &--collapsed {
    justify-content: center;
    padding: 0;
  }
}

.logo-full {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.logo-dot { color: rgba(255, 255, 255, 0.85); font-size: 10px; }

.logo-mini {
  color: #fff;
  font-size: 22px;
  font-weight: 900;
}

.logo-fade-enter-active,
.logo-fade-leave-active { transition: opacity 0.15s; }
.logo-fade-enter-from,
.logo-fade-leave-to     { opacity: 0; }

// ── 滚动区 ──────────────────────────────────────────────────────────────────
.sidebar-scrollbar {
  flex: 1;
  overflow: hidden;
}

// ── 菜单 ────────────────────────────────────────────────────────────────────
.sidebar-menu {
  border: none !important;
  background: $sb-bg !important;

  // 分组标题
  :deep(.el-menu-item-group__title) {
    padding: 12px 16px 4px !important;
    font-size: 11px !important;
    color: $sb-group-text !important;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  :deep(.el-menu-item) {
    height: 44px;
    line-height: 44px;
    color: $sb-text;
    border-radius: $radius-md;
    margin: 4px 8px;
    width: calc(100% - 16px);

    .el-icon { font-size: 18px; }

    &:hover {
      background: $sb-hover !important;
      color: $sb-text-active;
    }

    &.is-active {
      background: $sb-active !important;
      color: $sb-text-active;
      position: relative;

      &::after {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 20px;
        background: $sb-active-bar;
        border-radius: 0 2px 2px 0;
      }
    }
  }

  // 折叠态下隐藏分组标题区
  &.el-menu--collapse {
    :deep(.el-menu-item) {
      margin: 2px 4px;
      width: calc(100% - 8px);
      justify-content: center;
      padding: 0 !important;

      &::after { display: none; }
    }
  }
}

// ── 分割线 ────────────────────────────────────────────────────────────────
.menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 8px 16px;
}

// ── 底部折叠按钮 ─────────────────────────────────────────────────────────
.sidebar-footer {
  height: $footer-h;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 20px;
  cursor: pointer;
  color: $sb-text;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  transition: background 0.2s;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;

  &:hover {
    background: $sb-hover;
    color: $sb-text-active;
  }
}

.collapse-icon { font-size: 16px; flex-shrink: 0; }
.collapse-text { font-size: 13px; }
</style>
