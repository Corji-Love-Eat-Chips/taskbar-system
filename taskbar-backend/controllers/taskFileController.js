/**
 * 任务附件 API
 */
const path = require('path')
const { success, fail, created } = require('../utils/response')
const { asyncHandler } = require('../utils/asyncHandler')
const { recordFile, listFiles, getFileRecord, deleteFile } = require('../services/taskFileService')

function safeOriginalName(name) {
  const base = path.basename(String(name || 'file'))
  const s = base.replace(/[\\/]/g, '').trim()
  return s.slice(0, 255) || 'file'
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
