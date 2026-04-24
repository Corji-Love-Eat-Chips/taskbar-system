# 工作计划管理平台 · 后端

Node.js 18 + Express 4 + MySQL2。

## 环境变量

复制 `.env.example` 为 `.env`，填写数据库与 `SESSION_SECRET`。默认库名为 **`taskbar_db`**。

## 初始化数据库

确保 MySQL 已启动，且账号可建库。默认脚本会**删除并重建** `taskbar_db` 内业务表，并写入开发用种子数据（周期、人员、分类、管理员账号）。

```bash
npm run db:init
```

等价于执行 `sql/init_taskbar_db.sql`。

历史库名 `taskbar` 的旧脚本：

```bash
npm run db:init:legacy
```

或手动：

```bash
mysql -u root -p < sql/init_taskbar_db.sql
```

仅导入分类、周期、人员与管理员（可与 `init_taskbar_db` 配合或单独执行，注意脚本内注释与唯一键冲突）：

```bash
npm run db:seed
```

## 默认管理员（种子数据）

| 字段   | 值         |
|--------|------------|
| 用户名 | `admin`    |
| 密码   | `admin123` |

登录后请在业务中支持时尽快修改密码。

## 脚本

```bash
npm run dev              # 开发（nodemon）
npm start                # 生产
npm run db:init          # sql/init_taskbar_db.sql
npm run db:init:legacy   # sql/init.sql（库名 taskbar）
npm test
```

健康检查：`GET http://localhost:3000/api/health`（含数据库连通性）。
