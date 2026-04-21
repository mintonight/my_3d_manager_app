import { Alert, Typography } from 'antd';
import type { PreviewProps } from './index';
import { getExt } from './utils';

const PROPRIETARY_HINT: Record<string, string> = {
  sldprt: 'SolidWorks 零件文件为闭源格式，浏览器无法直接预览。建议导出为 STEP / STL 后上传预览版本。',
  sldasm: 'SolidWorks 装配体文件为闭源格式，浏览器无法直接预览。建议导出为 STEP / STL 后上传预览版本。',
  slddrw: 'SolidWorks 工程图文件为闭源格式，建议导出为 PDF / DXF 后上传预览版本。',
  ipt: 'Inventor 零件文件为闭源格式。建议导出为 STEP / STL 后上传预览版本。',
  iam: 'Inventor 装配体文件为闭源格式。建议导出为 STEP / STL 后上传预览版本。',
  catpart: 'CATIA 零件文件为闭源格式。建议导出为 STEP 后上传预览版本。',
  prt: 'NX / ProE / Creo 的 .prt 为闭源格式，建议导出为 STEP 后上传预览版本。',
  dwg: 'AutoCAD .dwg 为闭源二进制格式，建议另存为 .dxf 或打印为 PDF 后上传预览版本。',
  doc: '.doc 为旧版 Word 二进制格式，建议另存为 .docx 后上传预览版本。',
};

export default function UnsupportedPreview({ filename }: PreviewProps) {
  const ext = getExt(filename);
  const hint = PROPRIETARY_HINT[ext];
  return (
    <div style={{ padding: 40 }}>
      <Alert
        type="warning"
        showIcon
        message={`当前格式 .${ext || '(无后缀)'} 暂不支持在线预览`}
        description={
          <div>
            <Typography.Paragraph style={{ marginTop: 8, marginBottom: 8 }}>
              {hint ??
                '该格式尚未接入浏览器预览引擎。您可以下载文件后用本地软件打开。'}
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
              已支持：
              图片（PNG/JPG/SVG/GIF/WebP/BMP）、
              PDF、Word（.docx）、Excel（.xlsx/.xls）、PowerPoint（.pptx/.ppt）、OFD、
              文本与代码（TXT/MD/JSON/CSV/XML/YAML/源码）、
              HTML、音视频、
              3D 模型（STL/OBJ/GLTF/GLB/STEP/STP）、
              2D CAD（DXF）
            </Typography.Paragraph>
          </div>
        }
      />
    </div>
  );
}
