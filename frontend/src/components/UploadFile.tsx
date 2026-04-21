import { useState } from 'react';
import { Button, Input, Modal, Upload, message } from 'antd';
import { FolderOpenOutlined, UploadOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload';
import { api, extractError } from '../api';

type Mode = 'file' | 'folder';

interface Props {
  pid: number;
  fid?: number;
  mode?: Mode;
  buttonText: string;
  onDone: () => void;
}

function relPath(file: RcFile): string {
  const raw = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || '';
  if (!raw) return file.name;
  const slash = raw.indexOf('/');
  return slash === -1 ? raw : raw.slice(slash + 1);
}

export default function UploadFile({ pid, fid, mode = 'file', buttonText, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<RcFile[]>([]);
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isFolder = mode === 'folder';

  const reset = () => {
    setFiles([]);
    setMsg('');
  };

  const submit = async () => {
    if (files.length === 0) {
      message.warning(isFolder ? '请先选择文件夹' : '请先选择文件');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    let url: string;

    if (isFolder) {
      files.forEach((file) => {
        formData.append('uploads', file, file.name);
        formData.append('paths', relPath(file));
      });
      formData.append('commit_message', msg);
      url = `/projects/${pid}/files/folder`;
    } else {
      formData.append('upload', files[0], files[0].name);
      formData.append('commit_message', msg);
      url = fid ? `/projects/${pid}/files/${fid}/commit` : `/projects/${pid}/files`;
    }

    try {
      const response = await api.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (isFolder) {
        const count = Array.isArray(response.data) ? response.data.length : files.length;
        message.success(`已上传 ${count} 个文件`);
      } else {
        message.success(fid ? '新版本已提交' : '文件已上传');
      }
      setOpen(false);
      reset();
      onDone();
    } catch (error) {
      message.error(extractError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        className="apple-pill-button"
        type="primary"
        icon={isFolder ? <FolderOpenOutlined /> : <UploadOutlined />}
        onClick={() => setOpen(true)}
      >
        {buttonText}
      </Button>
      <Modal
        title={isFolder ? '上传文件夹' : fid ? '提交新版本' : '上传新文件'}
        open={open}
        onCancel={() => {
          setOpen(false);
          reset();
        }}
        onOk={() => void submit()}
        okText="提交"
        cancelText="取消"
        confirmLoading={submitting}
        width={isFolder ? 600 : 520}
      >
        <Upload
          directory={isFolder}
          multiple={isFolder}
          beforeUpload={(currentFile, fileList) => {
            setFiles(isFolder ? (fileList as RcFile[]) : [(fileList[0] ?? currentFile) as RcFile]);
            return false;
          }}
          onRemove={(file) => {
            setFiles((current) => current.filter((item) => item.uid !== file.uid));
          }}
          fileList={files.map((file) => ({
            uid: file.uid,
            name: relPath(file),
            status: 'done' as const,
            size: file.size,
          }))}
          maxCount={isFolder ? undefined : 1}
        >
          <Button className="apple-pill-button apple-outline-button" icon={isFolder ? <FolderOpenOutlined /> : <UploadOutlined />}>
            {isFolder ? '选择文件夹' : '选择文件'}
          </Button>
        </Upload>
        {isFolder && files.length > 0 && (
          <div style={{ marginTop: 8, color: '#6e6e73', fontSize: 12 }}>
            共选中 {files.length} 个文件。已有同名文件会按新版本提交。
          </div>
        )}
        <Input.TextArea
          rows={3}
          placeholder={isFolder ? '提交说明，可选' : '提交说明，可选'}
          value={msg}
          onChange={(event) => setMsg(event.target.value)}
          style={{ marginTop: 12 }}
          maxLength={512}
        />
      </Modal>
    </>
  );
}
