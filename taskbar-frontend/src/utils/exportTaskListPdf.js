/**
 * 任务列表 → PDF（iframe 内用系统字体排版，再 rasterize，避免主文档离屏节点被 html2canvas 画成空白）
 *
 * html2canvas / jsPDF 使用动态 import，避免与任务页同块加载；依赖变更时减少 Vite 预构建缓存错乱。
 */

function escapeHtml(text) {
  if (text == null || text === '') return ''
  const div = document.createElement('div')
  div.textContent = String(text)
  return div.innerHTML
}

function buildTableRows(tasks, statusMap, priorityMap) {
  return tasks
    .map((row) => {
      const statusText = statusMap[row.status]?.text ?? row.status ?? '—'
      const priorityText = priorityMap[row.priority]?.text ?? '—'
      return `<tr>
      <td>${escapeHtml(row.task_name)}</td>
      <td>${escapeHtml(row.owner_name || '—')}</td>
      <td>${escapeHtml(row.end_date || '—')}</td>
      <td>${escapeHtml(statusText)}</td>
      <td>${escapeHtml(String(row.progress ?? 0))}%</td>
      <td>${escapeHtml(row.category || '—')}</td>
      <td>${escapeHtml(priorityText)}</td>
    </tr>`
    })
    .join('')
}

function buildDocumentHtml(tasks, meta, statusMap, priorityMap) {
  const metaLine = `导出时间：${escapeHtml(meta.exportedAt)} · 第 ${meta.page} / ${meta.totalPages} 页 · 本页 ${meta.pageRows} 条 · 共 ${meta.totalRows} 条`
  const rows = buildTableRows(tasks, statusMap, priorityMap)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 16px 20px;
    background: #fff;
    color: #1f2937;
    font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans SC", system-ui, sans-serif;
    font-size: 12px;
    line-height: 1.45;
  }
  h1 { font-size: 18px; margin: 0 0 8px; font-weight: 700; }
  .meta { font-size: 11px; color: #6b7280; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; word-break: break-word; }
  th { background: #f3f4f6; font-weight: 600; font-size: 11px; }
  th:nth-child(1), td:nth-child(1) { width: 22%; }
  th:nth-child(2), td:nth-child(2) { width: 9%; }
  th:nth-child(3), td:nth-child(3) { width: 10%; }
  th:nth-child(4), td:nth-child(4) { width: 9%; }
  th:nth-child(5), td:nth-child(5) { width: 8%; }
  th:nth-child(6), td:nth-child(6) { width: 12%; }
  th:nth-child(7), td:nth-child(7) { width: 8%; }
</style></head><body>
  <h1>任务列表</h1>
  <div class="meta">${metaLine}</div>
  <table>
    <thead><tr>
      <th>任务名称</th><th>负责人</th><th>截止日期</th><th>状态</th><th>进度</th><th>分类</th><th>优先级</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`
}

/**
 * @param {object} opt
 * @param {Array} opt.tasks
 * @param {{ exportedAt: string, page: number, totalPages: number, pageRows: number, totalRows: number }} opt.meta
 * @param {Record<string, { text?: string }>} opt.statusMap
 * @param {Record<string, { text?: string }>} opt.priorityMap
 * @param {string} opt.filename
 */
export async function exportTaskListPdf(opt) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const { tasks, meta, statusMap, priorityMap, filename } = opt
  const html = buildDocumentHtml(tasks, meta, statusMap, priorityMap)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'task-pdf-export')
  iframe.setAttribute('aria-hidden', 'true')
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-4000px',
    top: '0',
    width: '1100px',
    minHeight: '400px',
    border: 'none',
    opacity: '1',
    pointerEvents: 'none',
  })
  document.body.appendChild(iframe)

  const idoc = iframe.contentDocument
  idoc.open()
  idoc.write(html)
  idoc.close()

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      /* ignore */
    }
  }
  await new Promise((r) => setTimeout(r, 80))

  const body = idoc.body
  const canvas = await html2canvas(body, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    allowTaint: true,
    logging: false,
    width: body.scrollWidth,
    height: body.scrollHeight,
    windowWidth: body.scrollWidth,
    windowHeight: body.scrollHeight,
    x: 0,
    y: 0,
  })

  document.body.removeChild(iframe)

  const imgData = canvas.toDataURL('image/png', 1.0)
  const margin = 8
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidth = pageWidth - margin * 2
  const contentHeight = pageHeight - margin * 2

  const props = pdf.getImageProperties(imgData)
  const imgPdfHeight = (props.height * contentWidth) / props.width

  if (imgPdfHeight <= contentHeight + 0.5) {
    pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, imgPdfHeight)
  } else {
    const slicePx = Math.max(1, Math.floor((contentHeight / imgPdfHeight) * canvas.height))
    let sy = 0
    let first = true
    while (sy < canvas.height) {
      const sh = Math.min(slicePx, canvas.height - sy)
      const slice = document.createElement('canvas')
      slice.width = canvas.width
      slice.height = sh
      const ctx = slice.getContext('2d')
      ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh)
      const url = slice.toDataURL('image/png')
      const sliceH_mm = (sh / canvas.height) * imgPdfHeight
      if (!first) pdf.addPage()
      first = false
      pdf.addImage(url, 'PNG', margin, margin, contentWidth, sliceH_mm)
      sy += sh
    }
  }

  pdf.save(filename)
}
