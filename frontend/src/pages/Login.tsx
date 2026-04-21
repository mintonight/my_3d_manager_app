import { useState } from 'react';
import { Button, Card, Form, Input, Tabs, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api, extractError } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';

export default function Login() {
  const { login } = useAuth();
  const { isZh } = useI18n();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  const text = isZh
    ? {
        loginSuccess: '登录成功',
        registerSuccess: '注册成功，正在登录',
        eyebrow: 'Versioned mechanical workspace',
        title: '追光几何',
        subtitle:
          '文件版本、在线预览、项目协作和过程资产沉淀，被收束到一个更安静的界面里。',
        panelTitle: '登录',
        panelSubtitle: '使用你的账号进入当前工作区。',
        loginTab: '登录',
        registerTab: '注册',
        username: '用户名',
        email: '邮箱',
        password: '密码',
        login: '登录',
        registerAndLogin: '注册并登录',
      }
    : {
        loginSuccess: 'Signed in successfully',
        registerSuccess: 'Account created, signing in...',
        eyebrow: 'Versioned mechanical workspace',
        title: 'Zhuiguang Geometry',
        subtitle:
          'File versions, online preview, project collaboration, and process knowledge are brought together in a quieter workspace.',
        panelTitle: 'Sign In',
        panelSubtitle: 'Use your account to enter the current workspace.',
        loginTab: 'Sign In',
        registerTab: 'Register',
        username: 'Username',
        email: 'Email',
        password: 'Password',
        login: 'Sign In',
        registerAndLogin: 'Register and Sign In',
      };

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success(text.loginSuccess);
      nav('/projects');
    } catch (error) {
      message.error(extractError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: {
    username: string;
    email: string;
    password: string;
  }) => {
    setLoading(true);
    try {
      await api.post('/auth/register', values);
      message.success(text.registerSuccess);
      await login(values.username, values.password);
      nav('/projects');
    } catch (error) {
      message.error(extractError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="apple-auth">
      <div className="apple-auth__frame">
        <section className="apple-auth__hero">
          <p className="apple-hero__eyebrow">{text.eyebrow}</p>
          <Typography.Title className="apple-hero__title">{text.title}</Typography.Title>
          <Typography.Paragraph className="apple-hero__subtitle">
            {text.subtitle}
          </Typography.Paragraph>
        </section>

        <Card className="apple-surface apple-auth__panel" bordered={false}>
          <Typography.Title level={3} className="apple-section-title">
            {text.panelTitle}
          </Typography.Title>
          <Typography.Paragraph
            className="apple-section-subtitle"
            style={{ marginTop: 8, marginBottom: 24 }}
          >
            {text.panelSubtitle}
          </Typography.Paragraph>
          <Tabs
            defaultActiveKey="login"
            items={[
              {
                key: 'login',
                label: text.loginTab,
                children: (
                  <Form layout="vertical" onFinish={handleLogin} disabled={loading}>
                    <Form.Item name="username" label={text.username} rules={[{ required: true }]}>
                      <Input autoFocus />
                    </Form.Item>
                    <Form.Item name="password" label={text.password} rules={[{ required: true }]}>
                      <Input.Password />
                    </Form.Item>
                    <Button className="apple-pill-button" type="primary" htmlType="submit" block loading={loading}>
                      {text.login}
                    </Button>
                  </Form>
                ),
              },
              {
                key: 'register',
                label: text.registerTab,
                children: (
                  <Form layout="vertical" onFinish={handleRegister} disabled={loading}>
                    <Form.Item
                      name="username"
                      label={text.username}
                      rules={[{ required: true, min: 2, max: 64 }]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      name="email"
                      label={text.email}
                      rules={[{ required: true, type: 'email' }]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      name="password"
                      label={text.password}
                      rules={[{ required: true, min: 6 }]}
                    >
                      <Input.Password />
                    </Form.Item>
                    <Button className="apple-pill-button" type="primary" htmlType="submit" block loading={loading}>
                      {text.registerAndLogin}
                    </Button>
                  </Form>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
