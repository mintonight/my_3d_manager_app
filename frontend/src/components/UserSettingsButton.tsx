import { useEffect, useState } from 'react';
import { LogoutOutlined, ProjectOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Divider, Form, Input, Modal, Select, Space, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
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
  const { user, updateSettings, logout } = useAuth();
  const { isZh, languageLabel, themeLabel } = useI18n();
  const nav = useNavigate();
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
        account: '账号',
        navigation: '导航',
        preferences: '偏好',
        actions: '操作',
        admin: '管理员',
        allProjects: '全部项目',
        myProjects: '我的项目',
        logout: '退出登录',
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
        account: 'Account',
        navigation: 'Navigation',
        preferences: 'Preferences',
        actions: 'Actions',
        admin: 'Admin',
        allProjects: 'All Projects',
        myProjects: 'My Projects',
        logout: 'Sign Out',
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

  const goToProjects = () => {
    setOpen(false);
    nav('/projects');
  };

  const onLogout = () => {
    setOpen(false);
    logout();
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
        {/* 账号 / Account */}
        <Typography.Text type="secondary" strong style={{ fontSize: 12 }}>
          {text.account}
        </Typography.Text>
        <div style={{ margin: '8px 0 4px' }}>
          <Space size={8} wrap align="center">
            <Typography.Text strong>{user.username}</Typography.Text>
            <Typography.Text type="secondary">{user.email}</Typography.Text>
            {user.is_admin && <Typography.Text type="warning">{text.admin}</Typography.Text>}
          </Space>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        {/* 导航 / Navigation */}
        <Typography.Text type="secondary" strong style={{ fontSize: 12 }}>
          {text.navigation}
        </Typography.Text>
        <div style={{ margin: '8px 0 4px' }}>
          <Button
            block
            icon={<ProjectOutlined />}
            className="apple-pill-button"
            onClick={goToProjects}
          >
            {user.is_admin ? text.allProjects : text.myProjects}
          </Button>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        {/* 偏好 / Preferences */}
        <Typography.Text type="secondary" strong style={{ fontSize: 12 }}>
          {text.preferences}
        </Typography.Text>
        <Form form={form} layout="vertical" onFinish={submit} style={{ marginTop: 8 }}>
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
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {text.edrawingsHint}
          </Typography.Text>
        </Form>

        <Divider style={{ margin: '16px 0' }} />

        {/* 操作 / Actions */}
        <Button block danger icon={<LogoutOutlined />} className="apple-pill-button" onClick={onLogout}>
          {text.logout}
        </Button>
      </Modal>
    </>
  );
}
