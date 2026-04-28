# 追光文档管理 复刻版
致敬追光几何，几年前用的一个好软件，可惜好像停更了
「机械设计的 GitLab」MVP：面向机械图纸和过程文件的版本管理、在线预览与协作平台。

## 已实现功能

### 账号与权限

- 用户注册、登录、JWT 鉴权和当前用户信息获取。
- 启动时自动创建默认超级管理员。
- 支持用户设置：界面语言、亮色/暗色主题、本机 eDrawings 可执行文件路径。
- 项目角色分为 `owner`、`editor`、`viewer`，超级管理员拥有全局管理权限。

### 项目管理

- 创建、查看、删除项目。
- 项目成员管理：添加成员、调整角色、移除成员。
- 普通用户只看到自己参与的项目；超级管理员可查看和管理所有项目。
- 项目内文件搜索和全局项目/文件搜索。

### 文件与版本

- 上传单个文件并生成初始版本。
- 上传整个文件夹，保留相对路径；同路径文件会自动提交为新版本。
- 对已有文件提交新版本，记录提交说明、作者、版本号和创建时间。
- 查看文件版本时间线。
- 回滚到历史版本。
- 下载任意文件版本。
- 下载项目整包 ZIP，保留当前版本的目录结构。
- 文件内容按 SHA256 内容寻址存储，天然去重，版本内容不可变。

### 下载审计通知

- 用户下载单个文件版本时，会通知该项目所有成员和所有超级管理员。
- 用户下载项目整包时，会通知该项目所有成员和所有超级管理员。
- 下载通知进入现有通知中心，可标记已读。
- 非项目成员不会收到该项目的下载通知，超级管理员会额外收到全局审计通知。

### 文件预览

- 通用文件预览接入 `jit-viewer`：
  - PDF、Word、Excel、PowerPoint、OFD、CSV。
  - TXT、Markdown、JSON、XML、YAML、LOG、HTML 和常见源码文件。
  - PNG、JPG、SVG、GIF、WebP、BMP、ICO。
  - MP4、WebM、MOV、MP3、WAV、FLAC 等音视频。
  - STL、OBJ、GLTF、GLB 和 DXF。
- STEP / STP 文件使用 `occt-import-js` 和 three.js 在浏览器中渲染 3D 模型。
- SolidWorks 原生文件（`.sldprt` / `.sldasm` / `.slddrw`）不再提取内嵌缩略图，预览页直接提供两个入口：
  - 使用本机 eDrawings 打开当前版本。
  - 使用嘉立创在线预览打开当前版本。
- 预览模块按需懒加载，不进入预览时不下载对应 JS/WASM。

### 评论与通知

- 文件级评论和版本级评论。
- `@提醒成员` 与评论正文分离，使用项目成员下拉多选。
- 被 @ 的用户会收到通知铃提醒。
- 点击评论通知后跳转到对应评论并标记已读。
- 通知中心同时展示评论提醒和下载审计通知。

### 备份与恢复

- 超级管理员可导出所有项目当前文件，生成项目备份 ZIP。
- 超级管理员可导出完整数据备份 ZIP，包含：
  - 用户、项目、项目成员。
  - 文件、全部文件版本和 blob。
  - 评论、@ 提醒、评论通知、下载通知。
  - 用户界面偏好和 eDrawings 路径设置。
- 超级管理员可导入完整数据备份，覆盖当前数据库记录和 blob 文件。

### 界面

- React + Ant Design 界面。
- 中英文界面切换。
- 亮色/暗色主题。
- Linear 风格全局样式。
- 文件列表支持按文件名、当前版本、创建时间排序。

## 权限矩阵

| 操作 | owner | editor | viewer | admin |
| --- | :---: | :---: | :---: | :---: |
| 查看项目、文件、版本 | ✅ | ✅ | ✅ | ✅ |
| 搜索、预览、下载、评论 | ✅ | ✅ | ✅ | ✅ |
| 上传文件、上传文件夹 | ✅ | ✅ | ❌ | ✅ |
| 提交新版本、回滚版本 | ✅ | ✅ | ❌ | ✅ |
| 管理项目成员 | ✅ | ❌ | ❌ | ✅ |
| 删除文件、删除项目 | ✅ | ❌ | ❌ | ✅ |
| 查看和管理所有项目 | ❌ | ❌ | ❌ | ✅ |
| 项目备份、数据导出、数据恢复 | ❌ | ❌ | ❌ | ✅ |

## 技术栈

### 后端

- Python 3.11+
- FastAPI
- SQLAlchemy 2
- SQLite
- Pydantic v2
- JWT 鉴权（`python-jose`）
- 密码哈希（`passlib` / `bcrypt`）
- 本地文件系统 + SHA256 内容寻址存储
- ZIP 流式打包
- `httpx` 代理嘉立创在线预览
- `subprocess` 调用本机 eDrawings

### 前端

- React 18
- TypeScript
- Vite
- React Router
- Ant Design 5
- Axios / fetch
- three.js
- `occt-import-js`
- `jit-viewer`

## 目录结构

```text
zhihu_article/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── bootstrap.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── deps.py
│   │   ├── models.py
│   │   ├── notification_events.py
│   │   ├── preview.py
│   │   ├── schemas.py
│   │   ├── security.py
│   │   ├── storage.py
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── comments.py
│   │       ├── files.py
│   │       ├── notifications.py
│   │       ├── projects.py
│   │       └── search.py
│   ├── pyproject.toml
│   └── uv.lock
└── frontend/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── api.ts
        ├── auth.tsx
        ├── i18n.tsx
        ├── main.tsx
        ├── preferences.ts
        ├── theme.ts
        ├── types.ts
        ├── pages/
        └── components/
```

## 快速开始

### 前置依赖

- uv：Python 包管理器。
- Node.js 18+。

### 启动后端

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

默认地址：<http://localhost:8000>

Swagger UI：<http://localhost:8000/docs>

局域网访问时监听所有网卡：

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

默认地址：<http://localhost:5173>

Vite 会把 `/api/*` 请求代理到 `http://127.0.0.1:8000`。

### 常用命令

```bash
# 后端
cd backend
uv sync
uv run uvicorn app.main:app --reload

# 前端
cd frontend
npm install
npm run dev
npm run build
```

## 默认超级管理员

默认配置会创建：

- 用户名：`superadmin`
- 邮箱：`superadmin@example.com`
- 密码：`superadmin`

可通过环境变量覆盖：

- `ZGG_ADMIN_USERNAME`
- `ZGG_ADMIN_EMAIL`
- `ZGG_ADMIN_PASSWORD`

## 关键接口

### 鉴权

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me/settings`

### 项目

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{pid}`
- `DELETE /api/projects/{pid}`
- `GET /api/projects/{pid}/download`

### 成员

- `GET /api/projects/{pid}/members`
- `POST /api/projects/{pid}/members`
- `PATCH /api/projects/{pid}/members/{uid}`
- `DELETE /api/projects/{pid}/members/{uid}`

### 文件

- `GET /api/projects/{pid}/files`
- `POST /api/projects/{pid}/files`
- `POST /api/projects/{pid}/files/folder`
- `POST /api/projects/{pid}/files/{fid}/commit`
- `GET /api/projects/{pid}/files/{fid}/versions`
- `GET /api/projects/{pid}/files/{fid}/versions/{vid}/download`
- `POST /api/projects/{pid}/files/{fid}/rollback/{vid}`
- `DELETE /api/projects/{pid}/files/{fid}`

### SolidWorks 预览入口

- `POST /api/projects/{pid}/files/{fid}/versions/{vid}/edrawings-open`
- `POST /api/projects/{pid}/files/{fid}/versions/{vid}/jlc-preview`

### 评论与通知

- `GET /api/projects/{pid}/files/{fid}/comments`
- `POST /api/projects/{pid}/files/{fid}/comments`
- `GET /api/projects/{pid}/files/{fid}/versions/{vid}/comments`
- `POST /api/projects/{pid}/files/{fid}/versions/{vid}/comments`
- `DELETE /api/projects/{pid}/comments/{comment_id}`
- `GET /api/notifications`
- `POST /api/notifications/{notification_id}/read`

### 备份

- `GET /api/projects/backup/all`
- `GET /api/projects/backup/data/export`
- `POST /api/projects/backup/data/import`

## 端到端体验路径

1. 打开 <http://localhost:5173>，注册 `alice`。
2. 退出后注册 `bob`。
3. 用 `alice` 创建项目。
4. 在成员面板把 `bob` 加为 `editor` 或 `viewer`。
5. 上传单个文件或上传整个文件夹。
6. 提交 2-3 个新版本，进入版本历史查看时间线。
7. 下载单个版本或项目整包，项目成员和超级管理员会收到下载通知。
8. 给文件或版本发表评论，并 @ 项目成员。
9. 使用通知铃跳转到评论或查看下载审计通知。
10. 对 STEP / STP 文件直接浏览器预览；对 SolidWorks 文件选择 eDrawings 或嘉立创在线预览。
11. 用超级管理员登录，查看所有项目并执行项目备份、数据导出或数据恢复。

## 存储机制

文件内容存放在：

```text
backend/data/blobs/<sha256[:2]>/<sha256[2:]>
```

数据库只保存文件元数据和 blob 引用。

- 同一份内容只存一份。
- 版本内容不会被覆盖。
- 回滚只更新当前版本指针。
- 未来切换到 S3 / MinIO 时，主要改动点在 `app/storage.py`。

## SolidWorks 预览说明

SolidWorks 原生文件属于闭源格式，浏览器不能直接稳定渲染。当前策略是不做缩略图提取，用户在预览页主动选择：

- **本机 eDrawings：** 后端把当前版本文件准备到缓存目录，并调用配置的 eDrawings 可执行文件打开。
- **嘉立创在线预览：** 后端通过 `httpx` 把当前版本原文件上传到嘉立创 3D Viewer，并返回在线预览地址。

注意事项：

- 嘉立创在线预览会把文件上传到第三方服务，适合作为用户主动选择的可选能力。
- 嘉立创接口限制单文件不超过 100 MB。
- 本机 eDrawings 依赖服务端运行环境能访问对应可执行文件路径。

## 后续可迭代

- 版本间 3D diff。
- 活动时间线和项目概览仪表盘。
- PostgreSQL、对象存储和 Docker 部署。
- 更完整的 CAD 闭源格式支持。
