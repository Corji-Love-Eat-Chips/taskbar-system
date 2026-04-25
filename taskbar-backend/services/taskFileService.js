/**
 * 任务附件：本地磁盘 uploads/tasks/{task_id}/
 */
const fs = require('fs/promises')
const path = require('path')
const pool = require('../config/database')
const { createError } = require('../utils/response')

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'tasks')

function taskDir(taskId) {
  return path.join(UPLOAD_ROOT, String(taskId))
}

function safeResolveStoredFile(taskId, storedName) {
  const base = path.resolve(taskDir(taskId))
  const name = path.basename(String(storedName))
  const resolved = path.resolve(base, name)
  const rel = path.relative(base, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  return resolved
}

/**
 * 删除某任务目录下所有文件（删任务前调用；DB 行由 ON DELETE CASCADE 清理）
 */
async function purgeTaskFileStorageForTask(taskId) {
  const dir = taskDir(taskId)
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    // 目录不存在等忽略
  }
}

/**
 * @param {number} taskId
 */
async function listFiles(taskId) {
  const [rows] = await pool.query(
    `SELECT f.file_id, f.original_name, f.mime_type, f.size_bytes, f.created_at,
            f.uploaded_by, u.username AS uploader_name
       FROM task_files f
       LEFT JOIN users u ON u.user_id = f.uploaded_by
      WHERE f.task_id = ?
      ORDER BY f.file_id DESC`,
    [taskId],
  )
  return rows
}

/**
 * @param {object} p
 * @param {number} p.taskId
 * @param {string} p.originalName
 * @param {string} p.storedName
 * @param {string|null} p.mimeType
 * @param {number} p.sizeBytes
 * @param {number|null} p.uploadedBy
 */
async function recordFile(p) {
  const [r] = await pool.query(
    `INSERT INTO task_files (task_id, original_name, stored_name, mime_type, size_bytes, uploaded_by)
     VALUES (?,?,?,?,?,?)`,
    [
      p.taskId,
      p.originalName,
      p.storedName,
      p.mimeType || null,
      p.sizeBytes,
      p.uploadedBy,
    ],
  )
  return r.insertId
}

/**
 * @param {number} taskId
 * @param {number} fileId
 * @returns {Promise<{ file_id, stored_name, original_name, absPath: string }|null>}
 */
async function getFileRecord(taskId, fileId) {
  const [rows] = await pool.query(
    `SELECT file_id, task_id, stored_name, original_name, mime_type
       FROM task_files
      WHERE file_id = ? AND task_id = ?`,
    [fileId, taskId],
  )
  const row = rows[0]
  if (!row) return null
  const abs = safeResolveStoredFile(taskId, row.stored_name)
  if (!abs) return null
  return { ...row, absPath: abs }
}

/**
 * 删除单条：数据库 + 磁盘
 */
async function deleteFile(taskId, fileId) {
  const rec = await getFileRecord(taskId, fileId)
  if (!rec) throw createError('文件不存在', 404)

  await pool.query('DELETE FROM task_files WHERE file_id = ? AND task_id = ?', [fileId, taskId])
  try {
    await fs.unlink(rec.absPath)
  } catch {
    // 文件已没则忽略
  }
}

module.exports = {
  UPLOAD_ROOT,
  taskDir,
  safeResolveStoredFile,
  listFiles,
  recordFile,
  getFileRecord,
  deleteFile,
  purgeTaskFileStorageForTask,
}
