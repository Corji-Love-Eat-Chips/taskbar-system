/**
 * 生成并下载批量导入用 Excel 模板（表头与后端解析一致）
 */
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

// 与后端 staffService.importStaffFromExcelBuffer 一致：支持「手机」「邮箱」分列，也兼容仅填「联系方式」
const STAFF_HEADERS = ['工号', '姓名', '性别', '部门', '职位', '手机', '邮箱', '状态']

// 多人工号列（负责人、其他牵头、辅助负责人、协助人）：单元格内可用英文逗号、中文逗号、分号或空格分隔，如 23166,23167 或 23166；23167
const TASK_HEADERS = [
  '任务名称',
  '负责人工号',
  '其他牵头工号',
  '辅助负责人工号',
  '周期名称',
  '任务分类',
  '开始日期',
  '截止日期',
  '优先级',
  '任务描述',
  '协助人工号',
  '备注',
]

const LIST_SHEET = '_import_lists'
const HEADER_ROW = 9
const FIRST_DATA_ROW = HEADER_ROW + 1
const LAST_DATA_ROW = 2000

function downloadSheet(headers, sheetName, fileName) {
  const ws = XLSX.utils.aoa_to_sheet([headers])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    fileName,
  )
}

export function downloadStaffImportTemplate() {
  downloadSheet(STAFF_HEADERS, '人员导入', '人员批量导入模板.xlsx')
}

/**
 * 任务导入模板：首屏说明 + 表头行 + 周期/分类下拉（数据来自当前系统周期列表与固定分类枚举）。
 */
export async function downloadTaskImportTemplate() {
  const [{ default: ExcelJS }, { getPeriodList }, { TASK_IMPORT_CATEGORY_NAMES }] = await Promise.all([
    import('exceljs'),
    import('@/api/period.js'),
    import('@/constants/taskImportMeta.js'),
  ])

  let periodNames = []
  try {
    const res = await getPeriodList()
    const list = res?.data
    if (Array.isArray(list)) {
      periodNames = [
        ...new Set(list.map((p) => String(p.period_name ?? '').trim()).filter(Boolean)),
      ]
    }
  } catch {
    periodNames = []
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Taskbar'

  const main = workbook.addWorksheet('任务导入', {
    views: [{ state: 'frozen', ySplit: HEADER_ROW, activeCell: `A${FIRST_DATA_ROW}`, showGridLines: true }],
  })

  const guide = workbook.addWorksheet('填写说明')

  const listSheet = workbook.addWorksheet(LIST_SHEET, { state: 'veryHidden' })
  periodNames.forEach((name, i) => {
    listSheet.getCell(i + 1, 1).value = name
  })
  TASK_IMPORT_CATEGORY_NAMES.forEach((name, i) => {
    listSheet.getCell(i + 1, 2).value = name
  })

  const noteLines = [
    '【填写说明】详细示例与列说明请打开本文件工作表「填写说明」。请勿删除或改动下方表头行。',
    '「周期名称」「任务分类」列已设置下拉，请从列表中选择（须与系统一致）。若周期下拉为空，请先在系统中维护周期。',
    '工号多人：英文逗号、中文逗号、分号或空格分隔；负责人列第一项为主负责人。',
    '日期请用 YYYY-MM-DD；优先级填：高 / 中 / 低，或留空（默认中）。',
  ]
  noteLines.forEach((text, idx) => {
    const r = idx + 1
    main.mergeCells(`A${r}:L${r}`)
    const cell = main.getCell(`A${r}`)
    cell.value = text
    cell.alignment = { wrapText: true, vertical: 'middle' }
  })

  main.getRow(8).height = 6

  TASK_HEADERS.forEach((h, i) => {
    const cell = main.getCell(HEADER_ROW, i + 1)
    cell.value = h
    cell.font = { bold: true }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE7EEF7' },
    }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
  })

  const widths = [22, 14, 14, 14, 14, 12, 12, 12, 8, 28, 14, 18]
  widths.forEach((w, i) => {
    main.getColumn(i + 1).width = w
  })

  const periodRange =
    periodNames.length > 0
      ? `'${LIST_SHEET}'!$A$1:$A$${periodNames.length}`
      : null
  const categoryRange = `'${LIST_SHEET}'!$B$1:$B$${TASK_IMPORT_CATEGORY_NAMES.length}`

  if (periodRange) {
    main.dataValidations.add(`E${FIRST_DATA_ROW}:E${LAST_DATA_ROW}`, {
      type: 'list',
      allowBlank: true,
      formulae: [periodRange],
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: '周期名称',
      error: '请从下拉列表中选择系统中已存在的周期名称，或留空。',
    })
  }

  main.dataValidations.add(`F${FIRST_DATA_ROW}:F${LAST_DATA_ROW}`, {
    type: 'list',
    allowBlank: false,
    formulae: [categoryRange],
    showErrorMessage: true,
    errorTitle: '任务分类',
    error: '请从下拉列表中选择分类（与系统预设一致）。',
  })

  guide.mergeCells('A1:H1')
  guide.getCell('A1').value = '任务批量导入 · 填写示例与注意事项'
  guide.getCell('A1').font = { bold: true, size: 14 }
  guide.getCell('A1').alignment = { vertical: 'middle' }

  const guideBody = [
    '一、注意事项',
    '1. 数据请填写在「任务导入」表中表头行的下方；表头行及上方说明勿删改。',
    '2. 任务名称、负责人工号、任务分类、开始日期、截止日期为必填项（周期名称可留空，以系统校验为准）。',
    '3. 负责人工号、其他牵头工号、辅助负责人工号、协助人工号均须为系统内在职人员工号。',
    '4. 若需新增周期或调整分类主数据，请在系统中维护后再导出模板或手动输入与系统完全一致的名称。',
    '',
    '二、填写示例（对应「任务导入」表各列顺序）',
    '以下为一行示例，导入前请在「任务导入」表中按实际数据填写，勿将本段整段粘贴到一格内。',
    '',
    `任务名称：学工例会材料准备`,
    `负责人工号：23166（多人示例：23166,23167 — 前者为主负责人）`,
    `其他牵头工号：可留空`,
    `辅助负责人工号：可留空`,
    `周期名称：从下拉选，如「第6周」（须与系统周期名称一致）`,
    `任务分类：从下拉选，如「行政工作」`,
    `开始日期：2026-04-30`,
    `截止日期：2026-05-01`,
    `优先级：中（或 高 / 低，可留空默认中）`,
    `任务描述：可留空`,
    `协助人工号：可留空或多人工号用逗号分隔`,
    `备注：可留空`,
  ].join('\n')

  guide.mergeCells('A2:H32')
  const g2 = guide.getCell('A2')
  g2.value = guideBody
  g2.alignment = { wrapText: true, vertical: 'top' }
  guide.getColumn(1).width = 22
  for (let c = 2; c <= 8; c++) guide.getColumn(c).width = 14

  const buf = await workbook.xlsx.writeBuffer()
  saveAs(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    '任务批量导入模板.xlsx',
  )
}
