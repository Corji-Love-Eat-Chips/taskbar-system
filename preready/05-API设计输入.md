# 05-API设计输入.md

---

## 一、API设计规范

### 1.1 基础规范

| 项目 | 规范 |
|------|------|
| 基础URL | http://localhost:3000/api |
| 数据格式 | JSON |
| 字符编码 | UTF-8 |
| 认证方式 | Session + Cookie |
| 错误码 | HTTP状态码 + 业务错误码 |

### 1.2 请求规范

| 项目 | 规范 |
|------|------|
| 请求方法 | GET（查询）、POST（新增）、PUT（更新）、DELETE（删除） |
| 请求头 | Content-Type: application/json |
| 分页参数 | page, pageSize |
| 排序参数 | sortBy, sortOrder |

### 1.3 响应规范

```json
// 成功响应
{
  "code": 200,
  "message": "success",
  "data": {}
}

// 分页响应
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 100
    }
  }
}

// 错误响应
{
  "code": 400,
  "message": "错误描述",
  "error": "ERROR_DETAIL"
}
```

### 1.4 错误码定义

| HTTP状态码 | 业务含义 |
|------------|----------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未登录 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

---

## 二、用户认证 API

### 2.1 登录

```
POST /api/auth/login
```

**请求参数：**
```json
{
  "username": "admin",
  "password": "123456"
}
```

**响应示例：**
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "user_id": 1,
    "username": "admin",
    "role": "admin",
    "staff_id": 1,
    "staff_name": "管理员"
  }
}
```

### 2.2 登出

```
POST /api/auth/logout
```

**响应示例：**
```json
{
  "code": 200,
  "message": "登出成功"
}
```

### 2.3 获取当前用户

```
GET /api/auth/current
```

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "user_id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

---

## 三、人员管理 API

### 3.1 人员列表

```
GET /api/staff
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| name | string | 姓名（模糊搜索） |
| department | string | 部门 |
| status | string | 状态 |
| page | int | 页码 |
| pageSize | int | 每页数量 |

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "staff_id": 1,
        "staff_code": "T001",
        "name": "徐洪焱",
        "gender": "male",
        "department": "学院",
        "position": "学院领导",
        "status": "active"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 10,
      "total": 5
    }
  }
}
```

### 3.2 获取人员详情

```
GET /api/staff/:id
```

### 3.3 新增人员

```
POST /api/staff
```

**请求参数：**
```json
{
  "staffCode": "T006",
  "name": "新教师",
  "gender": "male",
  "department": "光电系",
  "position": "讲师",
  "phone": "13800138000",
  "email": "teacher@example.com"
}
```

### 3.4 更新人员

```
PUT /api/staff/:id
```

### 3.5 删除人员

```
DELETE /api/staff/:id
```

### 3.6 创建用户账号

```
POST /api/staff/:id/create-user
```

**请求参数：**
```json
{
  "username": "newteacher",
  "role": "teacher"
}
```

---

## 四、任务管理 API

### 4.1 任务列表

```
GET /api/tasks
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| period_id | int | 周期ID |
| owner_id | int | 负责人ID |
| category | string | 分类 |
| status | string | 状态 |
| keyword | string | 关键词搜索 |
| page | int | 页码 |
| page_size | int | 每页数量 |

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "task_id": 1,
        "task_no": "RW-20260407-001",
        "task_name": "召开学院社会培训工作推进会",
        "period_name": "第6周",
        "owner_name": "徐洪焱",
        "priority": "high",
        "category": "行政工作",
        "status": "in_progress",
        "progress": 60,
        "start_date": "2026-04-07",
        "end_date": "2026-04-10",
        "collaborators": [
          {"staff_id": 3, "name": "赵士银"},
          {"staff_id": 4, "name": "李金宝"}
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 10,
      "total": 20
    }
  }
}
```

### 4.2 获取任务详情

```
GET /api/tasks/:id
```

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "task_id": 1,
    "task_no": "RW-20260407-001",
    "task_name": "召开学院社会培训工作推进会",
    "period_id": 1,
    "period_name": "第6周",
    "owner_id": 1,
    "owner_name": "徐洪焱",
    "description": "召开学院社会培训工作推进会，研究部署下一步培训工作安排。",
    "priority": "high",
    "category": "行政工作",
    "status": "in_progress",
    "progress": 60,
    "start_date": "2026-04-07",
    "end_date": "2026-04-10",
    "remarks": "会议已召开，等待会议纪要整理",
    "collaborators": [
      {"staff_id": 3, "name": "赵士银"},
      {"staff_id": 4, "name": "李金宝"}
    ],
    "created_at": "2026-04-07 10:30:00",
    "updated_at": "2026-04-09 14:20:00"
  }
}
```

### 4.3 新增任务

```
POST /api/tasks
```

**请求参数：**
```json
{
  "task_name": "召开学院社会培训工作推进会",
  "period_id": 1,
  "owner_id": 1,
  "collaborator_ids": [3, 4],
  "description": "召开学院社会培训工作推进会，研究部署下一步培训工作安排。",
  "priority": "high",
  "category": "行政工作",
  "start_date": "2026-04-07",
  "end_date": "2026-04-10",
  "remarks": ""
}
```

### 4.4 更新任务

```
PUT /api/tasks/:id
```

**请求参数：**
```json
{
  "task_name": "...",
  "owner_id": 1,
  "collaborator_ids": [3, 4],
  "priority": "high",
  "status": "in_progress",
  "progress": 60,
  "remarks": ""
}
```

### 4.5 删除任务

```
DELETE /api/tasks/:id
```

### 4.6 更新任务进度

```
PATCH /api/tasks/:id/progress
```

**请求参数：**
```json
{
  "progress": 80
}
```

### 4.7 批量导入任务

```
POST /api/tasks/import
```

**请求参数：** multipart/form-data
| 字段 | 类型 | 说明 |
|------|------|------|
| file | file | Excel文件 |

**响应示例：**
```json
{
  "code": 200,
  "message": "导入成功",
  "data": {
    "success": 18,
    "failed": 2,
    "errors": [
      {"row": 5, "error": "负责人不存在"},
      {"row": 10, "error": "日期格式错误"}
    ]
  }
}
```

### 4.8 导出任务

```
GET /api/tasks/export
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| period_id | int | 周期ID |
| format | string | 格式：xlsx/pdf |

### 4.9 添加任务协助人

```
POST /api/tasks/:id/collaborators
```

**请求参数：**
```json
{
  "staff_id": 3,
  "permission": "edit"
}
```

**说明：** permission可选值：view(查看)、edit(编辑)

**响应示例：**
```json
{
  "code": 200,
  "message": "添加成功"
}
```

### 4.10 移除任务协助人

```
DELETE /api/tasks/:id/collaborators/:staffId
```

**响应示例：**
```json
{
  "code": 200,
  "message": "移除成功"
}
```

### 4.11 获取任务协助人列表

```
GET /api/tasks/:id/collaborators
```

**响应示例：**
```json
{
  "code": 200,
  "data": [
    {"staff_id": 3, "name": "赵士银", "permission": "edit"},
    {"staff_id": 4, "name": "李金宝", "permission": "view"}
  ]
}
```

---

## 五、待办管理 API

### 5.1 我的待办列表

```
GET /api/todos/my
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| status | int | 状态：0未完成1已完成 |
| task_id | int | 关联任务ID |
| page | int | 页码 |
| page_size | int | 每页数量 |

### 5.2 新增待办

```
POST /api/todos
```

**请求参数：**
```json
{
  "todo_name": "准备会议材料",
  "task_id": 1,
  "priority": "urgent",
  "deadline": "2026-04-10 09:00:00",
  "remarks": ""
}
```

**优先级枚举值：**
| 值 | 说明 |
|-----|------|
| urgent | 紧急 |
| important | 重要 |
| normal | 一般 |
| low | 低 |

### 5.3 更新待办

```
PUT /api/todos/:id
```

### 5.4 删除待办

```
DELETE /api/todos/:id
```

### 5.5 勾选完成待办

```
PATCH /api/todos/:id/toggle
```

**请求参数：**
```json
{
  "status": 1
}
```

### 5.6 共享待办

```
POST /api/todos/:id/share
```

**请求参数：**
```json
{
  "share_to_staff_id": 3,
  "permission": "view"
}
```

**响应示例：**
```json
{
  "code": 200,
  "message": "共享成功"
}
```

### 5.7 取消共享

```
DELETE /api/todos/:id/share/:staffId
```

**响应示例：**
```json
{
  "code": 200,
  "message": "取消共享成功"
}
```

### 5.8 获取分享给我的待办

```
GET /api/todos/shared
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| status | int | 状态：0未完成1已完成 |

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "todo_id": 1,
        "todo_name": "准备会议材料",
        "owner_name": "赵士银",
        "priority": "urgent",
        "status": 0,
        "deadline": "2026-04-10 09:00:00"
      }
    ]
  }
}
```

---

## 六、会议管理 API

### 6.1 会议列表

```
GET /api/meetings
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| type | string | 会议类型 |
| status | string | 状态 |
| start_date | string | 开始日期 |
| end_date | string | 结束日期 |
| page | int | 页码 |
| page_size | int | 每页数量 |

### 6.2 获取会议详情

```
GET /api/meetings/:id
```

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "meeting_id": 1,
    "meeting_no": "HY-20260407-001",
    "meeting_name": "学院社会培训工作推进会",
    "meeting_type": "all",
    "host_id": 1,
    "host_name": "徐洪焱",
    "start_time": "2026-04-07 09:00:00",
    "end_time": "2026-04-07 10:30:00",
    "location": "学院会议室A301",
    "agenda": "1. 通报上季度培训工作进展\n2. 讨论下阶段培训计划",
    "reminder_setting": "30min",
    "status": "upcoming",
    "minutes": "",
    "participants": [
      {"staff_id": 1, "name": "徐洪焱", "confirmed": 1},
      {"staff_id": 3, "name": "赵士银", "confirmed": 1},
      {"staff_id": 4, "name": "李金宝", "confirmed": 0}
    ],
    "created_at": "2026-04-05 10:00:00"
  }
}
```

### 6.3 新增会议

```
POST /api/meetings
```

**请求参数：**
```json
{
  "meeting_name": "学院社会培训工作推进会",
  "meeting_type": "all",
  "host_id": 1,
  "start_time": "2026-04-07 09:00:00",
  "end_time": "2026-04-07 10:30:00",
  "location": "学院会议室A301",
  "participant_ids": [1, 3, 4],
  "agenda": "1. 通报上季度培训工作进展\n2. 讨论下阶段培训计划",
  "reminder_setting": "30min"
}
```

### 6.4 更新会议

```
PUT /api/meetings/:id
```

### 6.5 删除会议

```
DELETE /api/meetings/:id
```

### 6.6 确认参会

```
PATCH /api/meetings/:id/confirm
```

**请求参数：**
```json
{
  "confirmed": 1
}
```

### 6.7 获取我的会议

```
GET /api/meetings/my
```

**说明：** 返回当前用户作为参会人员的会议

### 6.8 日历视图数据

```
GET /api/meetings/calendar
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| start_date | string | 开始日期 |
| end_date | string | 结束日期 |

**响应示例：**
```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "title": "学院社会培训工作推进会",
      "start": "2026-04-07 09:00:00",
      "end": "2026-04-07 10:30:00",
      "location": "学院会议室A301",
      "type": "all"
    }
  ]
}
```

---

## 七、周期管理 API

### 7.1 周期列表

```
GET /api/periods
```

### 7.2 新增周期

```
POST /api/periods
```

**请求参数：**
```json
{
  "period_name": "第9周",
  "start_date": "2026-04-27",
  "end_date": "2026-04-30",
  "semester": "2025-2026学年第二学期"
}
```

### 7.3 复制周期任务

```
POST /api/periods/:id/copy
```

**请求参数：**
```json
{
  "target_period_id": 2
}
```

---

## 八、仪表盘 API

### 8.1 统计数据

```
GET /api/dashboard/stats
```

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "totalTasks": 12,
    "pendingTasks": 4,
    "inProgressTasks": 6,
    "completedTasks": 2,
    "upcomingMeetings": 3,
    "myTodos": 5,
    "myCompletedTodos": 2
  }
}
```

### 8.2 首页数据

```
GET /api/dashboard/home
```

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "stats": {
      "totalTasks": 12,
      "completedTasks": 5,
      "inProgressTasks": 6
    },
    "recentTasks": [],
    "upcomingMeetings": []
  }
}
```

---

## 九、数据导入导出 API

### 9.1 导出模板下载

```
GET /api/templates/task-import
```

**说明：** 下载任务导入的Excel模板

### 9.2 任务数据导出

```
GET /api/exports/tasks
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| periodId | int | 周期ID |
| category | string | 分类 |

---

## 十、通知提醒 API

**认证要求：** 需要登录认证（Session）

### 10.1 获取待提醒列表

```
GET /api/reminders/pending
```

**说明：** 前端轮询此接口获取待发送的浏览器通知

**响应示例：**
```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "type": "meeting",
      "title": "会议提醒",
      "body": "学院社会培训工作推进会 将在30分钟后开始",
      "meetingId": 1,
      "startTime": "2026-04-07 09:00:00"
    }
  ]
}
```

### 10.2 标记提醒已发送

```
POST /api/reminders/:id/acknowledged
```

**说明：** 前端发送通知后调用此接口标记提醒已处理

### 10.3 获取通知权限状态

```
GET /api/settings/notification-permission
```

**响应示例：**
```json
{
  "code": 200,
  "data": {
    "granted": true,
    "updatedAt": "2026-04-07 10:00:00"
  }
}
```

### 10.4 更新通知权限状态

```
POST /api/settings/notification-permission
```

**请求参数：**
```json
{
  "granted": true
}
```

---

## 十、通用响应码

| 码 | 常量 | 说明 |
|----|------|------|
| 200 | SUCCESS | 成功 |
| 400 | BAD_REQUEST | 请求参数错误 |
| 401 | UNAUTHORIZED | 未登录 |
| 403 | FORBIDDEN | 无权限 |
| 404 | NOT_FOUND | 资源不存在 |
| 500 | INTERNAL_ERROR | 服务器错误 |

---

## 十一、业务错误码

| 码 | 常量 | 说明 |
|----|------|------|
| 1001 | USERNAME_EXISTS | 用户名已存在 |
| 1002 | USER_LOCKED | 账号已锁定 |
| 1003 | PASSWORD_ERROR | 密码错误 |
| 2001 | STAFF_NOT_FOUND | 人员不存在 |
| 2002 | STAFF_CODE_EXISTS | 工号已存在 |
| 3001 | TASK_NOT_FOUND | 任务不存在 |
| 3002 | TASK_NO_EXISTS | 任务编号已存在 |
| 4001 | TODO_NOT_FOUND | 待办不存在 |
| 5001 | MEETING_NOT_FOUND | 会议不存在 |
| 5002 | MEETING_NO_EXISTS | 会议编号已存在 |
| 6001 | PERIOD_NOT_FOUND | 周期不存在 |
| 6002 | PERIOD_CONFLICT | 周期时间冲突 |

---

**文档信息**

| 项目 | 内容 |
|------|------|
| 文档名称 | 05-API设计输入 |
| 版本 | V1.0 |
| 创建日期 | 2026年4月 |
| 关联文档 | 04-数据库设计输入.md |
