import { Alert, Typography } from 'antd';
import { useI18n } from '../../i18n';
import type { PreviewProps } from './index';
import { getExt } from './utils';

export default function UnsupportedPreview({ filename }: PreviewProps) {
  const { isZh } = useI18n();
  const ext = getExt(filename);

  const proprietaryHint = isZh
    ? {
        sldprt: 'SolidWorks 零件文件为闭源格式，建议导出为 STEP / STL 后上传预览版本。',
        sldasm: 'SolidWorks 装配体文件为闭源格式，建议导出为 STEP / STL 后上传预览版本。',
        slddrw: 'SolidWorks 工程图文件为闭源格式，建议导出为 PDF / DXF 后上传预览版本。',
        ipt: 'Inventor 零件文件为闭源格式，建议导出为 STEP / STL 后上传预览版本。',
        iam: 'Inventor 装配体文件为闭源格式，建议导出为 STEP / STL 后上传预览版本。',
        catpart: 'CATIA 零件文件为闭源格式，建议导出为 STEP 后上传预览版本。',
        prt: 'NX / ProE / Creo 的 .prt 为闭源格式，建议导出为 STEP 后上传预览版本。',
        dwg: 'AutoCAD .dwg 为闭源二进制格式，建议另存为 .dxf 或打印为 PDF 后上传预览版本。',
        doc: '.doc 为旧版 Word 二进制格式，建议另存为 .docx 后上传预览版本。',
      }
    : {
        sldprt: 'SolidWorks part files are proprietary. Export to STEP / STL and upload a preview version.',
        sldasm: 'SolidWorks assembly files are proprietary. Export to STEP / STL and upload a preview version.',
        slddrw: 'SolidWorks drawings are proprietary. Export to PDF / DXF and upload a preview version.',
        ipt: 'Inventor part files are proprietary. Export to STEP / STL and upload a preview version.',
        iam: 'Inventor assembly files are proprietary. Export to STEP / STL and upload a preview version.',
        catpart: 'CATIA part files are proprietary. Export to STEP and upload a preview version.',
        prt: 'NX / ProE / Creo .prt files are proprietary. Export to STEP and upload a preview version.',
        dwg: 'AutoCAD .dwg is a proprietary binary format. Save as .dxf or print to PDF for preview.',
        doc: 'Legacy .doc is a binary Word format. Save as .docx and upload a preview version.',
      };

  const text = isZh
    ? {
        title: `当前格式 .${ext || '(无后缀)'} 暂不支持在线预览`,
        fallback:
          '该格式尚未接入浏览器预览引擎。您可以下载文件后用本地软件打开。',
        supported:
          '已支持：图片（PNG/JPG/SVG/GIF/WebP/BMP）、PDF、Word（.docx）、Excel（.xlsx/.xls）、PowerPoint（.pptx/.ppt）、OFD、文本与代码（TXT/MD/JSON/CSV/XML/YAML/源代码）、HTML、音视频、3D 模型（STL/OBJ/GLTF/GLB/STEP/STP）、2D CAD（DXF）。',
      }
    : {
        title: `Online preview is not available for .${ext || '(no extension)'}`,
        fallback:
          'This format is not connected to a browser preview engine yet. Download the file and open it with local software.',
        supported:
          'Supported today: images (PNG/JPG/SVG/GIF/WebP/BMP), PDF, Word (.docx), Excel (.xlsx/.xls), PowerPoint (.pptx/.ppt), OFD, text and code (TXT/MD/JSON/CSV/XML/YAML/source code), HTML, audio/video, 3D models (STL/OBJ/GLTF/GLB/STEP/STP), and 2D CAD (DXF).',
      };

  const hint = proprietaryHint[ext as keyof typeof proprietaryHint];

  return (
    <div style={{ padding: 40 }}>
      <Alert
        type="warning"
        showIcon
        message={text.title}
        description={
          <div>
            <Typography.Paragraph style={{ marginTop: 8, marginBottom: 8 }}>
              {hint ?? text.fallback}
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
              {text.supported}
            </Typography.Paragraph>
          </div>
        }
      />
    </div>
  );
}
