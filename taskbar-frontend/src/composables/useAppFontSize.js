/**
 * 全局界面字号：小 / 中 / 大
 *
 * Element Plus 在 :root 上把 --el-font-size-* 等写成固定 px，仅改 html { font-size }
 * 不会生效，必须在 documentElement 上按比例重写这些变量。
 */
import { ref, computed } from 'vue'

export const FONT_SIZE_ORDER = ['sm', 'md', 'lg']

const STORAGE_KEY = 'taskbar_app_font_size'

/** 相对设计基准 16px 的缩放（html 根字号：小 15 / 中 17 / 大 19，整体比初版各提高一档） */
const SCALE = { sm: 15 / 16, md: 17 / 16, lg: 19 / 16 }

/** html 根字号（rem 基准），与 Element 变量缩放配套 */
const HTML_PX = { sm: 15, md: 17, lg: 19 }

/**
 * 与 element-plus/dist/index.css :root 默认值对应（单位 px），按档位整体缩放
 */
const EL_VARS_PX = {
  '--el-font-size-extra-large':           20,
  '--el-font-size-large':                 18,
  '--el-font-size-medium':                16,
  '--el-font-size-base':                  14,
  '--el-font-size-small':                 13,
  '--el-font-size-extra-small':           12,
  '--el-font-line-height-primary':        24,
  '--el-component-size-large':            40,
  '--el-component-size':                  32,
  '--el-component-size-small':            24,
  '--el-checkbox-font-size':              14,
  '--el-select-input-font-size':          14,
  '--el-pagination-font-size':            14,
  '--el-pagination-font-size-small':      12,
  '--el-notification-title-font-size':    16,
  '--el-alert-title-font-size':           14,
  '--el-alert-description-font-size':     14,
  '--el-alert-close-font-size':           16,
  '--el-alert-close-customed-font-size':  14,
  '--el-alert-title-with-description-font-size': 16,
  '--el-collapse-header-font-size':       13,
  '--el-collapse-content-font-size':      13,
  '--el-tag-font-size':                   12,
  '--el-badge-font-size':                 12,
  '--el-anchor-font-size':                12,
  '--el-result-title-font-size':          20,
  '--el-result-icon-font-size':           64,
  '--el-tour-font-size':                  14,
  '--el-tour-title-font-size':            16,
  '--el-messagebox-error-font-size':      12,
  '--el-carousel-arrow-font-size':        12,
  '--el-input-tag-font-size':             12,
  '--el-message-close-size':              16,
  '--el-popover-title-font-size':         16,
}

function toPx(n) {
  const v = Math.round(n * 100) / 100
  return `${v}px`
}

export function readFontSize() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && FONT_SIZE_ORDER.includes(v)) return v
  } catch (_) { /* ignore */ }
  return 'md'
}

export function applyFontSize(size) {
  if (typeof document === 'undefined') return
  if (!FONT_SIZE_ORDER.includes(size)) size = 'md'

  const scale = SCALE[size]
  const el = document.documentElement
  el.dataset.fontSize = size
  el.style.fontSize = toPx(HTML_PX[size])

  for (const [prop, basePx] of Object.entries(EL_VARS_PX)) {
    el.style.setProperty(prop, toPx(basePx * scale))
  }
}

export function writeFontSize(size) {
  applyFontSize(size)
  try {
    localStorage.setItem(STORAGE_KEY, size)
  } catch (_) { /* ignore */ }
}

const fontSize = ref(readFontSize())

/**
 * @returns {{ fontSize: import('vue').Ref<string>, setFontSize: (s: string) => void, slideIndex: import('vue').ComputedRef<number> }}
 */
export function useAppFontSize() {
  function setFontSize(s) {
    if (!FONT_SIZE_ORDER.includes(s)) return
    fontSize.value = s
    writeFontSize(s)
  }

  const slideIndex = computed(() => FONT_SIZE_ORDER.indexOf(fontSize.value))

  return {
    fontSize,
    setFontSize,
    slideIndex,
  }
}
