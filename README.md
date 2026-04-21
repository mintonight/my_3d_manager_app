# 追光几何-Lite

「机械设计的 GitLab」MVP —— 机械图纸版本管理与协作的 Web 平台。

## 能力一览

### 文件与版本

- **版本管理**（类 Git）：上传图纸、提交新版本（附 commit message）、查看版本链、下载任意版本、一键回滚
- **文件夹批量上传**：一次上传整个文件夹，保留相对路径；重复路径自动作为新版本提交（类似 `git add .`）
- **项目整包下载**：一键把项目所有文件的当前版本打包成 ZIP，目录结构保留
- **内容寻址存储**：二进制内容按 SHA256 存放，自动去重；版本不可变

### 浏览与搜索

- **文件列表排序**（类 Windows 资源管理器）：点击列头切换升/降序
  - 文件名：本地化自然排序（`file10.txt` 排在 `file2.txt` 后）
  - 当前版本：数值比较
  - 创建时间：默认降序
- **项目内搜索**：在当前项目里按文件名模糊搜索，防抖 250ms
- **全局搜索**：跨项目搜索项目名与文件名

### 在线预览

全部在浏览器内完成，不经第三方服务：

- **通用预览引擎**：接入 [jit-viewer](https://github.com/jitOffice/jit-viewer-sdk)
  - **办公文档**：PDF、Word（.docx）、Excel（.xlsx/.xls）、PowerPoint（.pptx/.ppt）、OFD、CSV
  - **文本与代码**：TXT、Markdown、JSON、XML、YAML、LOG、HTML，以及 JS/TS/PY/Go/Rust/Java/C/C++ 等常见源码高亮
  - **图片**：PNG、JPG、SVG、GIF、WebP、BMP、ICO
  - **音视频**：MP4/WebM/MOV、MP3/WAV/FLAC 等
  - **3D 模型**：STL、OBJ、GLTF、GLB
  - **2D CAD**：DXF
- **STEP / STP**：由 [occt-import-js](https://github.com/kovacsv/occt-import-js)（OCCT 编译到 WebAssembly）+ three.js 处理
- **SolidWorks 缩略图提取**：对 `.sldprt` / `.sldasm` / `.slddrw`，后端用 `olefile` + `Pillow` 遍历 OLE Compound File 流，提取嵌入的 PNG / JPEG / DIB 预览图返回给浏览器
- 预览器按需懒加载，不预览就不下载对应 JS/WASM

### 协作

- **项目成员与角色**：owner / editor / viewer，细粒度权限
- **评论系统**：文件级与版本级评论，支持 `@用户名` 提醒当前项目成员
- **通知中心**：被 @ 的用户收到通知铃提醒；点击跳转到对应评论并自动标记已读
- **管理员视角**：管理员可见并管理所有项目

### 界面

- **Linear 风格亮色主题**：Inter Variable + OpenType `cv01`/`ss03` 字形变体，510 签名字重，品牌 Indigo `#5e6ad2`
- **中文界面**：基于 Ant Design 5 + zh-CN 本地化

## 目录结构

```
zhihu_article/
├── article.md                 # 原始产品文档（参考）
├── DESIGN-linear.app.md       # 当前采用的亮色主题设计说明
├── backend/                   # FastAPI + SQLAlchemy + SQLite（uv 管理）
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py / schemas.py / database.py / config.py
│   │   ├── security.py / deps.py / storage.py
│   │   ├── preview.py         # SolidWorks / OLE 缩略图提取
│   │   └── routers/{auth,projects,files,comments,notifications,search}.py
│   ├── pyproject.toml
│   ├── uv.lock
│   └── data/                  # 运行时：app.db + blobs/
└── frontend/                  # React 18 + Vite + TS + Ant Design 5
    └── src/
        ├── pages/{Login,Projects,ProjectDetail,FileHistory}.tsx
        ├── components/
        │   ├── Layout.tsx
        │   ├── UploadFile.tsx
        │   ├── MemberPanel.tsx
        │   ├── CommentPanel.tsx
        │   ├── GlobalSearch.tsx
        │   ├── NotificationBell.tsx
        │   └── FilePreview/
        │       ├── index.tsx              # 按扩展名分发 + 懒加载
        │       ├── PreviewModal.tsx
        │       ├── utils.ts               # 格式识别
        │       ├── JitViewerPreview.tsx   # jit-viewer 通用预览
        │       ├── StepPreview.tsx        # STEP/STP 专用
        │       ├── SolidWorksPreview.tsx  # 拉取后端缩略图 PNG
        │       └── UnsupportedPreview.tsx
        ├── theme.ts                       # Ant Design token 定制
        └── styles.css                     # Linear 风格全局样式
```

## 快速开始

### 前置依赖

- **uv**（Python 包管理器）：<https://docs.astral.sh/uv/getting-started/installation/>
  - Windows PowerShell：`powershell -c "irm https://astral.sh/uv/install.ps1 | iex"`
  - macOS / Linux：`curl -LsSf https://astral.sh/uv.sh | sh`
- **Node.js** ≥ 18

### 后端

```bash
cd backend
uv sync                                  # 首次运行：自动创建 .venv 并按 uv.lock 安装
uv run uvicorn app.main:app --reload     # 启动，默认 :8000
```

> `uv sync` 会根据 `pyproject.toml` / `uv.lock` 一键搞定环境。
>
> 固定 Python 版本：`uv python install 3.12 && uv sync --python 3.12`。
>
> 单独激活虚拟环境：`source .venv/Scripts/activate`（Windows Git Bash）或 `source .venv/bin/activate`（macOS/Linux）。

Swagger UI：<http://localhost:8000/docs>

#### 管理依赖

```bash
uv add 包名           # 添加运行时依赖
uv add --dev 包名     # 添加开发依赖
uv remove 包名        # 移除依赖
uv lock --upgrade     # 升级所有依赖到最新兼容版本
```

#### 部署

```bash
uv sync --frozen --no-dev        # 严格按 lock 文件装，拒绝更新、不装 dev 依赖
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

访问：<http://localhost:5173>

Vite 会把 `/api/*` 请求代理到后端 `http://127.0.0.1:8000`。

## 端到端体验路径

1. 打开 <http://localhost:5173>，注册用户 `alice`
2. 退出再注册 `bob`
3. 用 `alice` 登录，新建项目 `齿轮箱设计`
4. 进入项目，在「成员」tab 把 `bob` 加为编辑者
5. 回到「文件」tab，点「上传新文件」传一个图纸，commit message 填「首版」
6. 或点「上传文件夹」一次传入整个目录（会保留 `assembly/parts/gear.step` 这类相对路径）
7. 在文件列表点列头按文件名 / 版本 / 时间任意排序；在搜索框筛选文件
8. 对任意文件点「预览」，在浏览器内直接看 PDF / 图片 / STEP 3D / Office 文档
9. 对某条文件或版本发评论，`@bob` 会触发通知
10. 退出，改用 `bob` 登录，点右上角通知铃，跳转到对应评论
11. `bob` 对已有文件「提交新版本」2-3 次，或重新「上传文件夹」
12. 点击文件名进入「版本历史」页面——完整版本 timeline
13. 对某个早期版本点「回滚到此版本」，当前版本指针跳回去
14. 「下载当前版本」= 你回滚到的那个版本的内容

## 权限矩阵

| 操作                           | owner | editor | viewer | admin |
|--------------------------------|:-----:|:------:|:------:|:-----:|
| 查看、下载、预览、评论         |   ✅  |   ✅   |   ✅   |  ✅   |
| 上传、提交新版本、回滚         |   ✅  |   ✅   |   ❌   |  ✅   |
| 管理成员                       |   ✅  |   ❌   |   ❌   |  ✅   |
| 删除文件 / 删除项目            |   ✅  |   ❌   |   ❌   |  ✅   |
| 跨项目查看所有项目             |   ❌  |   ❌   |   ❌   |  ✅   |

## 存储机制

文件内容放在 `backend/data/blobs/<sha256[:2]>/<sha256[2:]>`，数据库只存引用。

- **天然去重**：同一份图纸即使被不同项目/文件引用，磁盘上也只存一份
- **版本不可变**：blob 文件以哈希命名，不会被覆盖——回滚只是改数据库里的「当前版本指针」，老版本永远能找回来
- **易扩展**：未来换成 S3/MinIO 只需改 `app/storage.py` 一个文件

## SolidWorks 预览原理

SolidWorks 原生文件（`.sldprt` / `.sldasm` / `.slddrw`）是 Microsoft Compound Document (OLE2) 容器，内部会嵌入 PNG / JPEG / DIB 格式的缩略图流。后端 `app/preview.py` 按以下顺序尝试提取：

1. 遍历含 `preview` / `thumbnail` / `bitmap` 关键字的 stream，搜索 PNG/JPEG magic bytes
2. 把裸 DIB（Windows 位图）补上 BMP 文件头，用 Pillow 解码为 PNG
3. 扫描所有 stream 里的 PNG/JPEG
4. 从 `\x05SummaryInformation` property set 读取 thumbnail 字段
5. 全文件 raw scan 作为兜底

若文件保存时关闭了「保存缩略图」选项，或为极简模式，则无法提取，前端会提示用户另存为 STEP / STL 用于在线预览。

## 技术栈

- **后端**：Python 3.11+ · FastAPI 0.115 · SQLAlchemy 2.0 · SQLite · JWT (HS256) · bcrypt · olefile · Pillow
- **前端**：React 18 · Vite 5 · TypeScript 5 · React Router 6 · Ant Design 5 · Axios · three.js · occt-import-js · jit-viewer
- **存储**：本地文件系统 + SHA256 内容寻址

## 后续可迭代

- 版本间可视化 diff（3D 对比）
- 分支（branch）、合并请求
- 活动时间线、项目概览仪表盘
- 对象存储（S3/MinIO）、PostgreSQL、Docker 部署
- 更多 CAD 闭源格式支持（Inventor / CATIA / NX）
