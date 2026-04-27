/**
 * 生成并下载批量导入用空 Excel 模板（表头与后端解析一致）
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

export function downloadTaskImportTemplate() {
  downloadSheet(TASK_HEADERS, '任务导入', '任务批量导入模板.xlsx')
}
