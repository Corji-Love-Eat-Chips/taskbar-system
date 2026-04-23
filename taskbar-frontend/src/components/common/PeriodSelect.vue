<template>
  <el-select
    :model-value="modelValue"
    :placeholder="placeholder"
    :clearable="clearable"
    :loading="loading"
    :disabled="disabled"
    filterable
    class="period-select"
    @update:model-value="handleChange"
    @clear="handleClear"
  >
    <!-- 加载中占位 -->
    <template v-if="loading">
      <el-option disabled value="" label="加载中…" />
    </template>

    <!-- 无数据占位 -->
    <template v-else-if="!grouped.length">
      <el-option disabled value="" label="暂无周期数据" />
    </template>

    <!-- 按学期分组 -->
    <template v-else>
      <el-option-group
        v-for="group in grouped"
        :key="group.semester"
        :label="group.semester"
      >
        <el-option
          v-for="p in group.periods"
          :key="p.period_id"
          :value="p.period_id"
          :label="p.period_name"
        >
          <div class="period-option">
            <span class="period-name">
              <!-- 当前周期打标记 -->
              <el-tag
                v-if="p.period_id === currentPeriodId"
                size="small"
                type="success"
                effect="light"
                class="current-tag"
              >当前</el-tag>
              {{ p.period_name }}
            </span>
            <span class="period-date">
              {{ p.start_date }} ~ {{ p.end_date }}
            </span>
          </div>
        </el-option>
      </el-option-group>
    </template>
  </el-select>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getPeriodList } from '@/api/period'

// ── Props ─────────────────────────────────────────────────────────────────────
const props = defineProps({
  /** 绑定值：选中的 period_id（v-model） */
  modelValue: {
    type: Number,
    default: null,
  },
  /** 占位文字 */
  placeholder: {
    type: String,
    default: '请选择周期',
  },
  /** 是否可清除 */
  clearable: {
    type: Boolean,
    default: true,
  },
  /** 是否禁用 */
  disabled: {
    type: Boolean,
    default: false,
  },
  /**
   * 是否在挂载时自动选中当前周期
   * （仅当 modelValue 为空时生效）
   */
  autoSelectCurrent: {
    type: Boolean,
    default: true,
  },
})

// ── Emits ─────────────────────────────────────────────────────────────────────
const emit = defineEmits(['update:modelValue', 'change'])

// ── 内部状态 ──────────────────────────────────────────────────────────────────
const loading = ref(false)
/** 原始周期列表（按 sort_order 排好序） */
const periods = ref([])

// ── 当前周期判断 ──────────────────────────────────────────────────────────────
/** 今天日期字符串 YYYY-MM-DD */
const today = new Date().toISOString().slice(0, 10)

/**
 * 当前周期 ID：start_date <= today <= end_date 的第一条
 * 若今天不在任何周期内，则取最近一个已结束周期（距今最近的 end_date）
 */
const currentPeriodId = computed(() => {
  if (!periods.value.length) return null

  // 精确命中
  const exact = periods.value.find(
    p => p.start_date <= today && p.end_date >= today,
  )
  if (exact) return exact.period_id

  // 最近结束的周期（end_date < today，取最大 end_date）
  const past = periods.value
    .filter(p => p.end_date < today)
    .sort((a, b) => b.end_date.localeCompare(a.end_date))
  if (past.length) return past[0].period_id

  // 最近将要开始的周期
  const future = periods.value
    .filter(p => p.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  return future.length ? future[0].period_id : null
})

// ── 分组逻辑 ──────────────────────────────────────────────────────────────────
/**
 * 将平铺列表按 semester 分组，维持原有排序
 * 无 semester 的条目归入"其他"组
 */
const grouped = computed(() => {
  const map = new Map()
  for (const p of periods.value) {
    const key = p.semester || '其他'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(p)
  }
  return Array.from(map.entries()).map(([semester, list]) => ({
    semester,
    periods: list,
  }))
})

// ── 数据加载 ──────────────────────────────────────────────────────────────────
async function loadPeriods() {
  loading.value = true
  try {
    const res = await getPeriodList()
    periods.value = res.data ?? []
  } catch {
    periods.value = []
  } finally {
    loading.value = false
  }
}

// ── 自动选中当前周期 ──────────────────────────────────────────────────────────
/**
 * 数据加载完成后，若 modelValue 为空且 autoSelectCurrent=true，
 * 则自动选中当前周期并向父组件同步
 */
watch(currentPeriodId, (id) => {
  if (props.autoSelectCurrent && props.modelValue == null && id != null) {
    emit('update:modelValue', id)
    emit('change', id, findPeriod(id))
  }
})

// ── 事件处理 ──────────────────────────────────────────────────────────────────
function handleChange(val) {
  emit('update:modelValue', val)
  emit('change', val, findPeriod(val))
}

function handleClear() {
  emit('update:modelValue', null)
  emit('change', null, null)
}

function findPeriod(id) {
  return periods.value.find(p => p.period_id === id) ?? null
}

// ── 生命周期 ──────────────────────────────────────────────────────────────────
onMounted(loadPeriods)

// ── 暴露供父组件调用 ──────────────────────────────────────────────────────────
defineExpose({ reload: loadPeriods, currentPeriodId })
</script>

<style lang="scss" scoped>
.period-select {
  width: 100%;
  min-width: 200px;
}

// ── 选项内容布局 ─────────────────────────────────────────────────────────────
.period-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.period-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: $text-primary;
  flex-shrink: 0;
}

.current-tag {
  font-size: 11px;
  padding: 0 4px;
  height: 18px;
  line-height: 18px;
}

.period-date {
  font-size: 12px;
  color: $text-secondary;
  white-space: nowrap;
}

// ── 分组标题 ──────────────────────────────────────────────────────────────────
:deep(.el-select-group__title) {
  font-size: 12px;
  font-weight: 600;
  color: $text-secondary;
  padding-left: 12px;
}

// ── 当前周期选项高亮底色 ──────────────────────────────────────────────────────
:deep(.el-select-dropdown__item) {
  height: auto;
  padding: 8px 12px;
  line-height: 1.4;
}
</style>
