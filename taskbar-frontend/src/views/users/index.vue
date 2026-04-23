<template>
  <div class="page-placeholder">
    <el-empty description="账号管理模块（开发中）">
      <template #image>
        <el-icon :size="60" color="#c0c4cc"><Setting /></el-icon>
      </template>
    </el-empty>
  </div>
</template>

<script setup>
import { Setting } from '@element-plus/icons-vue'
</script>

<style lang="scss" scoped>
.page-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 420px;
  background: #fff;
  border-radius: 8px;
}
</style>
