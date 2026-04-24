# 工作计划管理平台 · 前端

Vue 3 + Vite + Element Plus + Vue Router + Pinia。

## 初始化（已执行时可跳过）

```bash
cd taskbar-frontend
npm install
```

## 脚本

```bash
npm run dev      # 开发 http://localhost:5173
npm run build    # 构建 dist
npm run preview  # 预览构建结果
```

## 环境变量

复制 `.env.example` 为 `.env.development`（或 `.env.local`）并按需修改。开发阶段可将 `VITE_API_BASE_URL` 留空，请求使用 `/api` 前缀走 Vite 代理至 `http://localhost:3000`。

## 目录说明

`src/api`、`src/views`、`src/components`、`src/store`、`src/utils` 与 `preready` 设计文档一致扩展即可。
