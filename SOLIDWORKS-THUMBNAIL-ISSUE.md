# SolidWorks 文件缩略图提取 - 问题整理

## 需求

从 SolidWorks 文件（`.sldprt` / `.sldasm` / `.slddrw`）中提取嵌入的预览缩略图，返回给前端浏览器显示（因浏览器无法直接渲染 SolidWorks 原生格式）。后端是 Python FastAPI。

## 已尝试方案及失败情况

### 方案 1：olefile 扫描 OLE streams 找 PNG/JPEG magic

```python
import olefile, io
ole = olefile.OleFileIO(io.BytesIO(data))
for stream_path in ole.listdir(streams=True, storages=False):
    content = ole.openstream(stream_path).read()
    # 搜索 b"\x89PNG\r\n\x1a\n" 或 b"\xff\xd8\xff"
```

**结果**：未找到任何 PNG/JPEG magic bytes。

### 方案 2：扩展覆盖 DIB/BMP + Pillow 解码 + SummaryInformation thumbnail

加入：

- Pillow 解码 Windows DIB（裸位图，无 BMP 文件头）→ 补 14 字节 `BITMAPFILEHEADER` 再转 PNG
- 多偏移尝试（skip 0/4/8/12/16 字节 preamble）
- `ole.get_metadata().thumbnail`（标准 OLE `\x05SummaryInformation` property set）
- 遍历 **所有** stream（不限于 name 包含 preview/thumbnail/bitmap 的）
- 全文件 raw scan 兜底

**结果**：仍然提取不到。

## 环境

- Python 3.11, FastAPI
- 依赖：`olefile>=0.47`, `pillow>=10.4`
- SolidWorks 文件版本未知（用户未告知）

## 关键疑问

1. 该 SolidWorks 文件是否真的保存了缩略图？（用户保存时可能关闭了"保存缩略图"选项）
2. 新版 SolidWorks（>=2020？）的缩略图是否换了存储位置 / 加密 / 压缩？
3. 是否存在 `PreviewPNG` 但内容被 zlib/deflate 压缩过，需要先解压？
4. 是否需要解析 SolidWorks 特有的二进制容器（而非纯 OLE）？

## 期望的替代思路

- **FreeCAD Python API**（`Import` 模块读 sldprt）—— 但 FreeCAD 对 SolidWorks 原生格式支持有限
- **eDrawings COM API** —— 仅 Windows + 需安装 eDrawings Viewer
- **商业 SDK**：如 **HOOPS Exchange**、**CAD Exchanger**、**Datakit**
- **ODA SDK**（Open Design Alliance）—— 提供 `SolidWorks SDK` 可读 sldprt 并导出缩略图
- **已有开源项目**：参考 `sldprt-extractor`、`solidworks-thumb` 之类的实现

## 测试代码（诊断用）

可让用户运行以下脚本查看 SolidWorks 文件的实际 stream 结构：

```python
import olefile, sys

ole = olefile.OleFileIO(sys.argv[1])
for path in ole.listdir(streams=True, storages=True):
    joined = "/".join(path)
    try:
        size = ole.get_size(path)
    except Exception:
        size = "?"
    print(f"{size:>12}  {joined}")
ole.close()
```

这能输出文件的完整 stream 层级和每个 stream 的字节数，是定位缩略图位置的关键第一步。

## 当前实现位置

- 后端提取逻辑：`backend/app/preview.py`
- API 端点：`backend/app/routers/files.py` 的 `GET /api/projects/{pid}/files/{fid}/versions/{vid}/thumbnail`
- 前端组件：`frontend/src/components/FilePreview/SolidWorksPreview.tsx`
