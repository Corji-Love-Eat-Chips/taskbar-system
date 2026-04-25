/**
 * 任务附件 API
 */
const path = require('path')
const { success, fail, created } = require('../utils/response')
const { asyncHandler } = require('../utils/asyncHandler')
const { recordFile, listFiles, getFileRecord, deleteFile } = require('../services/taskFileService')

const CJK = /[\u4e00-\u9fff]/

/**
 * 处理 multipart 文件名：部分环境下 Multer 将 UTF-8 字节误作 latin1，显示成「ç...ª」。
 * 若字符串本身已含正常汉字，则不再二次转码，避免破坏正确 UTF-8。
 */
function safeOriginalName(name) {
  let s = String(name || '')
  if (!s) return 'file'
  if (!CJK.test(s)) {
    try {
      const decoded = Buffer.from(s, 'latin1').toString('utf8')
      if (CJK.test(decoded) && !/�/.test(decoded)) s = decoded
    } catch {
      // keep s
    }
  }
  const base = path.basename(s.replace(/\\/g, '/'))
  const cleaned = base.replace(/[\\/]/g, '').trim()
  return cleaned.slice(0, 255) || 'file'
}

const list = asyncHandler(async (req, res) => {
  const taskId = Number(req.params.id)
  const data = await listFiles(taskId)
  return success(res, data)
})

const upload = asyncHandler(async (req, res) => {
  if (!req.file) {
    return fail(res, '请选择要上传的文件', 400)
  }
  const taskId = Number(req.params.id)
  const orig = safeOriginalName(req.file.originalname)
  const fileId = await recordFile({
    taskId,
    originalName: orig,
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
    uploadedBy: req.currentUser.userId,
  })
  return created(
    res,
    {
      file_id: fileId,
      original_name: orig,
      size_bytes: req.file.size,
      mime_type: req.file.mimetype,
    },
    '上传成功',
  )
})

const download = asyncHandler(async (req, res) => {
  const taskId = Number(req.params.id)
  const fileId = Number(req.params.fileId)
  const rec = await getFileRecord(taskId, fileId)
  if (!rec) return fail(res, '文件不存在', 404)

  await new Promise((resolve, reject) => {
    res.download(rec.absPath, rec.original_name, (err) => {
      if (err) {
        if (!res.headersSent) fail(res, '文件无法读取', 500)
        return reject(err)
      }
      resolve()
    })
  })
})

const remove = asyncHandler(async (req, res) => {
  const taskId = Number(req.params.id)
  const fileId = Number(req.params.fileId)
  await deleteFile(taskId, fileId)
  return success(res, null, '已删除')
})

module.exports = {
  list,
  upload,
  download,
  remove,
}
