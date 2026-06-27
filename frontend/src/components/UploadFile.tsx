import { useState } from 'react';
import { Button, Input, Modal, Upload, message } from 'antd';
import { FolderOpenOutlined, UploadOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload';
import { api, extractError } from '../api';
import { useI18n } from '../i18n';
import { pollStepDerivative } from './stepPoll';

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
  const { isZh, formatNumber } = useI18n();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<RcFile[]>([]);
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isFolder = mode === 'folder';
  const text = isZh
    ? {
        chooseFolderFirst: '请先选择文件夹',
        chooseFileFirst: '请先选择文件',
        uploadedCount: (count: number) => `已上传 ${formatNumber(count)} 个文件`,
        committed: '新版本已提交',
        uploaded: '文件已上传',
        uploadFolder: '上传文件夹',
        commitNewVersion: '提交新版本',
        uploadNewFile: '上传新文件',
        submit: '提交',
        cancel: '取消',
        chooseFolder: '选择文件夹',
        chooseFile: '选择文件',
        folderSummary: (count: number) =>
          `共选中 ${formatNumber(count)} 个文件。已有同名文件会按新版本提交。`,
        commitMessagePlaceholder: '提交说明，可选',
        stepReady: (name: string) => `${name} 已转换为 STEP，可预览`,
      }
    : {
        chooseFolderFirst: 'Please choose a folder first',
        chooseFileFirst: 'Please choose a file first',
        uploadedCount: (count: number) => `Uploaded ${formatNumber(count)} files`,
        committed: 'New version committed',
        uploaded: 'File uploaded',
        uploadFolder: 'Upload Folder',
        commitNewVersion: 'Commit New Version',
        uploadNewFile: 'Upload New File',
        submit: 'Submit',
        cancel: 'Cancel',
        chooseFolder: 'Choose Folder',
        chooseFile: 'Choose File',
        folderSummary: (count: number) =>
          `${formatNumber(count)} files selected. Existing files with the same name will be committed as new versions.`,
        commitMessagePlaceholder: 'Commit message (optional)',
        stepReady: (name: string) => `${name} converted to STEP, ready to preview`,
      };

  const reset = () => {
    setFiles([]);
    setMsg('');
  };

  const submit = async () => {
    if (files.length === 0) {
      message.warning(isFolder ? text.chooseFolderFirst : text.chooseFileFirst);
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
        message.success(text.uploadedCount(count));
        // Watch each uploaded file for STEP conversion completion.
        if (Array.isArray(response.data)) {
          response.data.forEach((f: { id: number; name: string; current_version_id: number | null }) => {
            if (f.current_version_id) {
              pollStepDerivative({
                pid,
                fid: f.id,
                vid: f.current_version_id,
                filename: f.name,
                onDone: (name) => message.success(text.stepReady(name)),
              });
            }
          });
        }
      } else {
        message.success(fid ? text.committed : text.uploaded);
        const data = response.data as { id?: number; current_version_id?: number | null };
        // New upload returns FileOut (with id + current_version_id);
        // new version returns FileVersionOut (with id only, fid already known).
        const watchFid = fid ?? data.id;
        const watchVid = fid ? data.id : data.current_version_id;
        if (watchFid && watchVid && files[0]) {
          pollStepDerivative({
            pid,
            fid: watchFid,
            vid: watchVid,
            filename: relPath(files[0]),
            onDone: (name) => message.success(text.stepReady(name)),
          });
        }
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
        title={isFolder ? text.uploadFolder : fid ? text.commitNewVersion : text.uploadNewFile}
        open={open}
        onCancel={() => {
          setOpen(false);
          reset();
        }}
        onOk={() => void submit()}
        okText={text.submit}
        cancelText={text.cancel}
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
          <Button
            className="apple-pill-button apple-outline-button"
            icon={isFolder ? <FolderOpenOutlined /> : <UploadOutlined />}
          >
            {isFolder ? text.chooseFolder : text.chooseFile}
          </Button>
        </Upload>
        {isFolder && files.length > 0 && (
          <div style={{ marginTop: 8, color: 'var(--ln-preview-note)', fontSize: 12 }}>
            {text.folderSummary(files.length)}
          </div>
        )}
        <Input.TextArea
          rows={3}
          placeholder={text.commitMessagePlaceholder}
          value={msg}
          onChange={(event) => setMsg(event.target.value)}
          style={{ marginTop: 12 }}
          maxLength={512}
        />
      </Modal>
    </>
  );
}
