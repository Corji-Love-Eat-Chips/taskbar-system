/**
 * Excel 批量导入通用解析（xlsx）
 */
const XLSX = require('xlsx')

/** 任务导入允许的分类（与前端任务表单一致） */
const TASK_CATEGORIES = [
  '教学工作', '科研工作', '党建工作', '行政工作',
  '学生工作', '产业学院工作', '人事工作',
]

const CN_PHONE = /^1[3-9]\d{9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * @param {Buffer} buffer
 * @returns {Array<Record<string, unknown>>}
 */
function sheetToRecords(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const name = wb.SheetNames[0]
  if (!name) return []
  const sheet = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  return rows.map((row) => {
    const o = {}
    for (const [k, v] of Object.entries(row)) {
      const key = String(k).trim()
      if (key) o[key] = v
    }
    return o
  }).filter((row) => Object.values(row).some((v) => v !== '' && v != null))
}

/**
 * @param {unknown} v
 * @returns {string} YYYY-MM-DD or ''
 */
function cellToYMD(v) {
  if (v == null || v === '') return ''
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10)
  }
  if (typeof v === 'number') {
    const utc = Math.round((v - 25569) * 86400 * 1000)
    const d = new Date(utc)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  const s = String(v).trim().replace(/\//g, '-')
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) {
    const y = m[1]
    const mo = m[2].padStart(2, '0')
    const da = m[3].padStart(2, '0')
    return `${y}-${mo}-${da}`
  }
  return s.slice(0, 10)
}

/**
 * 联系方式单列：可填手机、邮箱，或用空格/逗号/分号等分隔多个片段
 * @returns {{ phone: string|null, email: string|null, error: string|null }}
 */
function parseContact(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return { phone: null, email: null, error: null }
  const parts = s.split(/[\s,，;；|/\n\r]+/).map((p) => p.trim()).filter(Boolean)
  let phone = null
  let email = null
  for (const p of parts) {
    if (p.includes('@')) {
      if (!EMAIL_RE.test(p)) return { phone: null, email: null, error: `邮箱格式不正确：${p}` }
      if (!email) email = p
      else return { phone: null, email: null, error: '联系方式中仅能填写一个邮箱' }
    } else if (CN_PHONE.test(p)) {
      if (!phone) phone = p
      else if (phone !== p) return { phone: null, email: null, error: '联系方式中仅能填写一个手机号' }
    }
  }
  if (!phone && !email && parts.length === 1) {
    const only = parts[0]
    if (only.includes('@')) {
      if (!EMAIL_RE.test(only)) return { phone: null, email: null, error: `邮箱格式不正确：${only}` }
      email = only
    } else if (CN_PHONE.test(only)) {
      phone = only
    } else {
      return { phone: null, email: null, error: `无法识别联系方式：${only}（请填大陆手机号或邮箱）` }
    }
  }
  if (parts.length && !phone && !email) {
    return { phone: null, email: null, error: '联系方式无法识别（请填大陆 11 位手机号和/或合法邮箱，多个用空格或逗号分隔）' }
  }
  return { phone, email, error: null }
}

function normalizeGender(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return null
  if (['男', 'male', 'm'].includes(s)) return 'male'
  if (['女', 'female', 'f'].includes(s)) return 'female'
  return null
}

function normalizePriority(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s || s === '中' || s === 'medium') return 'medium'
  if (s === '高' || s === 'high') return 'high'
  if (s === '低' || s === 'low') return 'low'
  return null
}

function splitStaffCodes(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return []
  return s.split(/[,，;；\s]+/).map((x) => x.trim()).filter(Boolean)
}

module.exports = {
  TASK_CATEGORIES,
  sheetToRecords,
  cellToYMD,
  parseContact,
  normalizeGender,
  normalizePriority,
  splitStaffCodes,
  CN_PHONE,
  EMAIL_RE,
}
