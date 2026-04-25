<template>
  <section v-if="taskId" class="task-files">
    <div class="section-title">
      <span>相关文件</span>
      <el-upload
        v-if="canManage"
        :show-file-list="false"
        :disabled="uploading"
        :http-request="onHttpUpload"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.txt,.md,.csv,.png,.jpg,.jpeg,.gif"
      >
        <el-button type="primary" size="small" :loading="uploading">
          <el-icon class="el-icon--left"><Upload /></el-icon>
          上传文件
        </el-button>
      </el-upload>
    </div>

    <el-skeleton v-if="loading" :rows="3" animated />
    <el-empty
      v-else-if="!list.length"
      description="暂无文件"
      :image-size="64"
    />
    <!-- 卡片行：右侧固定操作，无需横向滚动即可点「下载」 -->
    <ul v-else class="file-list">
      <li v-for="row in list" :key="row.file_id" class="file-row">
        <div class="file-info">
          <div class="file-name" :title="row.original_name">{{ row.original_name }}</div>
          <div class="file-meta">
            <span>{{ formatSize(row.size_bytes) }}</span>
            <span class="dot">·</span>
            <span>{{ fmtDt(row.created_at) }}</span>
            <span class="dot">·</span>
            <span>{{ row.uploader_name || '—' }}</span>
          </div>
        </div>
        <div class="file-actions">
          <el-button
            type="primary"
            size="small"
            :loading="downloadingId === row.file_id"
            @click="onDownload(row)"
          >
            下载
          </el-button>
          <el-button
            v-if="canManage"
            type="danger"
            size="small"
            plain
            @click="onDelete(row)"
          >
            删除
          </el-button>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { getTaskFiles, uploadTaskFile, deleteTaskFile, downloadTaskFileBlob } from '@/api/task'

const props = defineProps({
  taskId: { type: Number, default: null },
  /** 可上传/删除：管理员、领导、负责人、协助人 */
  canManage: { type: Boolean, default: false },
})

const list = ref([])
const loading = ref(false)
const uploading = ref(false)
const downloadingId = ref(null)

function fmtDt(dt) {
  return dt ? dayjs(dt).format('MM-DD HH:mm') : '—'
}

function formatSize(n) {
  if (n == null || n === 0) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  let v = n
  let i = 0
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${u[i]}`
}

async function load() {
  if (!props.taskId) return
  loading.value = true
  try {
    const res = await getTaskFiles(props.taskId)
    list.value = res.data || []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

async function onHttpUpload({ file }) {
  uploading.value = true
  try {
    await uploadTaskFile(props.taskId, file)
    ElMessage.success('上传成功')
    await load()
  } catch {
    // 全局已提示
  } finally {
    uploading.value = false
  }
}

async function onDownload(row) {
  downloadingId.value = row.file_id
  try {
    const blob = await downloadTaskFileBlob(props.taskId, row.file_id)
    const isJson =
      typeof blob === 'object' &&
      blob.type &&
      (blob.type.includes('json') || blob.type.includes('application/json'))
    if (isJson) {
      const t = await blob.text()
      let msg = '下载失败'
      try {
        const j = JSON.parse(t)
        if (j.message) msg = j.message
      } catch { /* 忽略 */ }
      ElMessage.error(msg)
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = row.original_name || 'download'
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    // 全局已提示
  } finally {
    downloadingId.value = null
  }
}

function onDelete(row) {
  ElMessageBox.confirm(
    `确定删除「${row.original_name}」？`,
    '删除文件',
    { type: 'warning' },
  )
    .then(async () => {
      await deleteTaskFile(props.taskId, row.file_id)
      ElMessage.success('已删除')
      await load()
    })
    .catch(() => {})
}

watch(
  () => props.taskId,
  (id) => {
    if (id) load()
  },
  { immediate: true },
)
</script>

<style lang="scss" scoped>
.task-files {
  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: $text-secondary;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;

    &::before {
      content: '';
      display: inline-block;
      width: 3px;
      height: 14px;
      background: $primary;
      border-radius: 2px;
      margin-right: 8px;
    }

    & > span {
      display: flex;
      align-items: center;
    }
  }
}

.file-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-bg-color);
}

.file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  min-width: 0;

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: stretch;

    .file-actions {
      justify-content: flex-end;
    }
  }
}

.file-info {
  min-width: 0;
  flex: 1;
}

.file-name {
  font-size: 14px;
  color: $text-primary;
  line-height: 1.4;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.file-meta {
  margin-top: 4px;
  font-size: 12px;
  color: $text-secondary;

  .dot {
    margin: 0 4px;
    opacity: 0.6;
  }
}

.file-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
}
</style>
