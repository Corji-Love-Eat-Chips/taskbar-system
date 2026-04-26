<template>
  <!--
    整体结构
    ┌──────────────────────────────────────────┐
    │             Header  (56px)               │
    ├───────────┬──────────────────────────────┤
    │           │                              │
    │  Sidebar  │       <router-view>          │
    │ (220px /  │        Main Content          │
    │   64px)   │                              │
    └───────────┴──────────────────────────────┘
  -->
  <div class="app-shell">

    <!-- Header 固定在顶部 -->
    <AppHeader class="app-shell__header" />

    <!-- 下方分为侧边栏 + 主内容区 -->
    <div class="app-shell__body">

      <!-- 侧边栏 -->
      <AppSidebar class="app-shell__sidebar" />

      <!-- 主内容 -->
      <div class="app-shell__main">
        <!-- 面包屑 -->
        <div class="main-breadcrumb">
          <el-breadcrumb separator="›">
            <el-breadcrumb-item :to="{ path: '/home' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentTitle && currentPath !== '/home'">
              {{ currentTitle }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <!-- 路由视图（带切换动画）-->
        <div class="main-content">
          <router-view v-slot="{ Component, route: r }">
            <transition name="page-fade" mode="out-in">
              <component :is="Component" :key="r.path" />
            </transition>
          </router-view>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader  from './Header.vue'
import AppSidebar from './Sidebar.vue'

const route = useRoute()

const currentTitle = computed(() => route.meta?.title ?? '')
const currentPath  = computed(() => route.path)
</script>

<style lang="scss" scoped>
$header-h: $header-height;

// ── 外层容器（与 app 内容区浅灰底一致）──────────────────────────────────────
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: $bg-page;
}

// ── Header 固定高度 ──────────────────────────────────────────────────────────
.app-shell__header {
  flex-shrink: 0;
  height: $header-h;
}

// ── Body：横向排列侧边栏 + 主区 ──────────────────────────────────────────────
.app-shell__body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

// ── 侧边栏：高度撑满 body ────────────────────────────────────────────────────
.app-shell__sidebar {
  flex-shrink: 0;
  height: 100%;
}

// ── 主内容区 ─────────────────────────────────────────────────────────────────
.app-shell__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// 面包屑栏（略抬层次，与内容区区分）
.main-breadcrumb {
  flex-shrink: 0;
  min-height: 46px;
  line-height: 46px;
  padding: 0 22px;
  background: $bg-card;
  border-bottom: 1px solid $border-lighter;
  box-shadow: 0 1px 0 rgb(255 255 255 / 0.8);

  :deep(.el-breadcrumb) {
    line-height: 46px;
    font-size: 13px;
  }
  :deep(.el-breadcrumb__inner) {
    color: $text-secondary;
    font-weight: 500;
  }
  :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
    color: $text-primary;
    font-weight: 600;
  }
  :deep(.el-breadcrumb__separator) { color: $text-disabled; margin: 0 6px; }
}

// 滚动内容区
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

// ── 页面切换动画 ─────────────────────────────────────────────────────────────
.page-fade-enter-active,
.page-fade-leave-active {
  transition:
    opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
