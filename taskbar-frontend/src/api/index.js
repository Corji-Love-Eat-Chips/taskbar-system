/**
 * API 统一出口
 *
 * 用法（按模块导入，按需使用）：
 *   import { getTaskList, createTask } from '@/api/task'
 *
 * 或整体导入命名空间：
 *   import * as UserApi   from '@/api/user'
 *   import * as StaffApi  from '@/api/staff'
 *   import * as TaskApi   from '@/api/task'
 *   import * as MeetingApi from '@/api/meeting'
 *   import * as TodoApi   from '@/api/todo'
 *   import * as PeriodApi from '@/api/period'
 *   import * as DashApi   from '@/api/dashboard'
 */

// ── 用户认证 & 账号管理 ────────────────────────────────────────────────────
export {
  login,
  logout,
  getCurrentUser,
  getUserList,
  getUserDetail,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  changePassword,
  unlockUser,
} from './user'

// ── 人员管理 ──────────────────────────────────────────────────────────────
export {
  getStaffList,
  getStaffAll,
  getStaffDetail,
  createStaff,
  updateStaff,
  deleteStaff,
  createUserForStaff,
} from './staff'

// ── 任务管理 ──────────────────────────────────────────────────────────────
export {
  getTaskList,
  getTaskDetail,
  createTask,
  updateTask,
  deleteTask,
  updateTaskProgress,
  importTasks,
  exportTasks,
  getTaskCollaborators,
  addTaskCollaborator,
  removeTaskCollaborator,
} from './task'

// ── 会议管理 ──────────────────────────────────────────────────────────────
export {
  getMeetingList,
  getMeetingDetail,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  confirmAttendance,
  getMyMeetings,
  getMeetingCalendar,
} from './meeting'

// ── 待办管理 ──────────────────────────────────────────────────────────────
export {
  getMyTodoList,
  getSharedTodoList,
  getTodoDetail,
  createTodo,
  updateTodo,
  deleteTodo,
  toggleTodo,
  shareTodo,
  unshareTodo,
} from './todo'

// ── 周期管理 ──────────────────────────────────────────────────────────────
export {
  getPeriodList,
  getPeriodDetail,
  createPeriod,
  copyPeriodTasks,
} from './period'

// ── 仪表盘 & 通知 ─────────────────────────────────────────────────────────
export {
  getDashboardStats,
  getDashboardHome,
  getPendingReminders,
  acknowledgeReminder,
  getNotificationPermission,
  updateNotificationPermission,
} from './dashboard'
