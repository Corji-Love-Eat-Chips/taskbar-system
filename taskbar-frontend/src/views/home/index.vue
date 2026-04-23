<template>
  <div class="page-home">
    <el-row :gutter="20">
      <el-col :span="24">
        <div class="welcome-banner">
          <div class="welcome-text">
            <h2>你好，{{ userStore.userInfo?.staff_name || userStore.username }} 👋</h2>
            <p>欢迎使用学院工作任务栏系统</p>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="stat-row">
      <el-col :xs="12" :sm="6" v-for="stat in stats" :key="stat.label">
        <el-card class="stat-card" shadow="never">
          <el-icon class="stat-icon" :style="{ color: stat.color }">
            <component :is="stat.icon" />
          </el-icon>
          <div class="stat-num">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { List, Calendar, Checked, Warning } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()

const stats = [
  { label: '进行中任务', value: '--', icon: List,     color: '#409eff' },
  { label: '本周会议',   value: '--', icon: Calendar, color: '#67c23a' },
  { label: '待完成待办', value: '--', icon: Checked,  color: '#e6a23c' },
  { label: '即将逾期',   value: '--', icon: Warning,  color: '#f56c6c' },
]
</script>

<style lang="scss" scoped>
.page-home { padding: 0; }

.welcome-banner {
  background: linear-gradient(135deg, #1e3a5f, #2d6a9f);
  border-radius: 10px;
  padding: 28px 32px;
  margin-bottom: 20px;
  color: #fff;

  h2 { margin: 0 0 6px; font-size: 22px; }
  p  { margin: 0; font-size: 14px; opacity: .8; }
}

.stat-row { margin-bottom: 20px; }

.stat-card {
  text-align: center;
  padding: 12px 0;
  border-radius: 10px;

  .stat-icon { font-size: 32px; margin-bottom: 8px; }
  .stat-num  { font-size: 28px; font-weight: 700; color: #303133; }
  .stat-label{ font-size: 13px; color: #909399; margin-top: 4px; }
}
</style>
