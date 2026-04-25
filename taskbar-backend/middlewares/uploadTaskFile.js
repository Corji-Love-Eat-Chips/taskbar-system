const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const multer = require('multer')
const { taskDir } = require('../services/taskFileService')

const MAX_BYTES = 20 * 1024 * 1024

const ALLOWED_EXT = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.7z',
  '.txt', '.md', '.csv', '.rtf',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.mp4', '.mp3', '.wav',
])

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const id = req.params.id
    const dir = taskDir(id)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    const safeExt = ALLOWED_EXT.has(ext) ? ext : ''
    const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt || '.bin'}`
    cb(null, name)
  },
})

const uploadTaskFile = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    if (ALLOWED_EXT.has(ext)) return cb(null, true)
    cb(new Error(`不支持的文件类型：${ext || '无扩展名'}，请使用常见办公或压缩/图片等格式`))
  },
})

module.exports = { uploadTaskFile, MAX_BYTES, ALLOWED_EXT }
