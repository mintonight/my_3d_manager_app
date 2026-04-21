import { useEffect, useState } from 'react';
import { SettingOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Select, Space, Typography, message } from 'antd';
import { extractError } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import type { UiLanguage, UiTheme } from '../types';

interface FormValues {
  ui_language: UiLanguage;
  ui_theme: UiTheme;
  edrawings_exe_path: string;
}

export default function UserSettingsButton() {
  const { user, updateSettings } = useAuth();
  const { isZh, languageLabel, themeLabel } = useI18n();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (!open || !user) return;
    form.setFieldsValue({
      ui_language: user.ui_language,
      ui_theme: user.ui_theme,
      edrawings_exe_path: user.edrawings_exe_path ?? '',
    });
  }, [form, open, user]);

  if (!user) return null;

  const text = isZh
    ? {
        ariaLabel: '设置',
        title: '个人设置',
        save: '保存',
        cancel: '取消',
        language: '界面语言',
        theme: '界面主题',
        edrawingsPath: 'eDrawings 路径',
        edrawingsHint: '留空时使用服务端默认路径。分布式部署时可为每个用户单独配置。',
        pathPlaceholder: '例如 C:\\Program Files\\SOLIDWORKS Corp\\eDrawings\\eDrawings.exe',
        saveSuccess: '设置已保存',
      }
    : {
        ariaLabel: 'Settings',
        title: 'User Settings',
        save: 'Save',
        cancel: 'Cancel',
        language: 'Language',
        theme: 'Theme',
        edrawingsPath: 'eDrawings Path',
        edrawingsHint:
          'Leave empty to use the server default path. In distributed deployments each user can keep a different local path.',
        pathPlaceholder: 'For example C:\\Program Files\\SOLIDWORKS Corp\\eDrawings\\eDrawings.exe',
        saveSuccess: 'Settings saved',
      };

  const submit = async (values: FormValues) => {
    setSaving(true);
    try {
      await updateSettings({
        ui_language: values.ui_language,
        ui_theme: values.ui_theme,
        edrawings_exe_path: values.edrawings_exe_path.trim() || null,
      });
      message.success(text.saveSuccess);
      setOpen(false);
    } catch (error) {
      message.error(extractError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        className="apple-settings-button"
        aria-label={text.ariaLabel}
        title={text.ariaLabel}
        icon={<SettingOutlined />}
        onClick={() => setOpen(true)}
      />
      <Modal
        title={text.title}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText={text.save}
        cancelText={text.cancel}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="ui_language" label={text.language} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'zh-CN', label: languageLabel('zh-CN') },
                { value: 'en-US', label: languageLabel('en-US') },
              ]}
            />
          </Form.Item>
          <Form.Item name="ui_theme" label={text.theme} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'light', label: themeLabel('light') },
                { value: 'dark', label: themeLabel('dark') },
              ]}
            />
          </Form.Item>
          <Form.Item name="edrawings_exe_path" label={text.edrawingsPath}>
            <Input placeholder={text.pathPlaceholder} />
          </Form.Item>
          <Space direction="vertical" size={2}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {text.edrawingsHint}
            </Typography.Text>
          </Space>
        </Form>
      </Modal>
    </>
  );
}
