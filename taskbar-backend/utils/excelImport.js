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
function normalizeHeaderKeysRow(row) {
  const o = {}
  for (const [k, v] of Object.entries(row)) {
    const key = String(k).trim()
    if (key) o[key] = v
  }
  return o
}

function isNonEmptyDataRow(o) {
  return Object.values(o).some((v) => v !== '' && v != null)
}

function sheetToRecords(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const name = wb.SheetNames[0]
  if (!name) return []
  const sheet = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  return rows
    .map((row) => normalizeHeaderKeysRow(row))
    .filter(isNonEmptyDataRow)
}

/**
 * 任务导入：首列可能为顶部说明，表头行为「任务名称」「负责人工号」起始行。
 * @returns {{ records: Array<Record<string, unknown>>, dataStartExcelRow: number, headerExcelRow: number }}
 */
function taskImportSheetToRecords(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const name = wb.SheetNames[0]
  if (!name) return { records: [], dataStartExcelRow: 2, headerExcelRow: 1 }
  const sheet = wb.Sheets[name]
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const headerIdx = findTaskImportHeaderRowIndex(aoa)
  if (headerIdx === -1) {
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    const records = rows
      .map((row) => normalizeHeaderKeysRow(row))
      .filter(isNonEmptyDataRow)
    return { records, dataStartExcelRow: 2, headerExcelRow: 1 }
  }
  const headers = (aoa[headerIdx] || []).map((c) => String(c).trim())
  const records = []
  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] || []
    const o = {}
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c]
      if (!key) continue
      o[key] = row[c]
    }
    if (isNonEmptyDataRow(o)) records.push(o)
  }
  const headerExcelRow = headerIdx + 1
  const dataStartExcelRow = headerIdx + 2
  return { records, dataStartExcelRow, headerExcelRow }
}

function findTaskImportHeaderRowIndex(aoa) {
  for (let i = 0; i < aoa.length; i++) {
    const row = aoa[i]
    if (!row || !row.length) continue
    const c0 = String(row[0]).trim()
    const c1 = String(row[1] ?? '').trim()
    const c4 = String(row[4] ?? '').trim()
    if (c0 === '任务名称' && c1 === '负责人工号' && c4 === '周期名称') return i
  }
  for (let i = 0; i < aoa.length; i++) {
    const row = aoa[i]
    if (!row || !row.length) continue
    if (String(row[0]).trim() === '任务名称' && String(row[1] ?? '').trim() === '负责人工号') {
      return i
    }
  }
  return -1
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

const STAFF_PHONE_HEADER_KEYS = ['手机', '电话', '手机号', '移动电话']
const STAFF_EMAIL_HEADER_KEYS = ['邮箱', '电子邮件', 'email', 'Email']

/**
 * 将单元格值转为可校验的字符串（处理 Excel 将手机号存为 number）
 * @param {unknown} v
 * @returns {string}
 */
function cellToDisplayString(v) {
  if (v == null || v === '') return ''
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (Math.abs(v) >= 1e9 && Math.abs(v) < 1e12) return String(Math.round(v))
    return String(v)
  }
  let s = String(v).trim()
  if (/^\d+\.0$/.test(s)) s = s.slice(0, -2)
  return s
}

/**
 * 人员导入：支持「联系方式」单列，或「手机」+「邮箱」两列（与常见模板/用户表一致）
 * @param {Record<string, unknown>} row
 * @returns {{ phone: string|null, email: string|null, error: string|null }}
 */
function parseStaffImportContact(row) {
  const r = row && typeof row === 'object' ? row : {}
  let phoneRaw
  for (const k of STAFF_PHONE_HEADER_KEYS) {
    if (k in r && r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
      phoneRaw = r[k]
      break
    }
  }
  let emailRaw
  for (const k of STAFF_EMAIL_HEADER_KEYS) {
    if (k in r && r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
      emailRaw = r[k]
      break
    }
  }
  const hasSplit = phoneRaw !== undefined || emailRaw !== undefined
  if (hasSplit) {
    const emailStr = emailRaw !== undefined ? cellToDisplayString(emailRaw) : ''
    const phoneStr = phoneRaw !== undefined ? cellToDisplayString(phoneRaw).replace(/\s/g, '') : ''
    let phone = null
    if (phoneStr) {
      if (!CN_PHONE.test(phoneStr)) {
        return { phone: null, email: null, error: `手机号格式不正确：${phoneStr}（需大陆 11 位手机号）` }
      }
      phone = phoneStr
    }
    let email = null
    if (emailStr) {
      if (!EMAIL_RE.test(emailStr)) {
        return { phone: null, email: null, error: `邮箱格式不正确：${emailStr}` }
      }
      email = emailStr
    }
    return { phone, email, error: null }
  }
  return parseContact(r['联系方式'])
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
  taskImportSheetToRecords,
  cellToYMD,
  parseContact,
  parseStaffImportContact,
  normalizeGender,
  normalizePriority,
  splitStaffCodes,
  CN_PHONE,
  EMAIL_RE,
}
