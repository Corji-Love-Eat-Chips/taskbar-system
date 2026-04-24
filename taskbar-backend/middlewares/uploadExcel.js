const multer = require('multer')

const storage = multer.memoryStorage()

/**
 * 内存接收 Excel（.xlsx / .xls），字段名 file
 */
const uploadExcel = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls)$/i.test(file.originalname)
    cb(null, ok)
  },
})

module.exports = { uploadExcel }
