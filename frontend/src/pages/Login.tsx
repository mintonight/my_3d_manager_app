import { useState } from 'react';
import { Button, Card, Form, Input, Tabs, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api, extractError } from '../api';
import { useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
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
      message.success('注册成功，正在登录');
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
          <p className="apple-hero__eyebrow">Versioned mechanical workspace</p>
          <Typography.Title className="apple-hero__title">
            追光几何
          </Typography.Title>
          <Typography.Paragraph className="apple-hero__subtitle">
            文件版本、在线预览、项目协作和过程资产沉淀，被收束到一个更安静的界面里。
          </Typography.Paragraph>
        </section>

        <Card className="apple-surface apple-auth__panel" bordered={false}>
          <Typography.Title level={3} className="apple-section-title">
            登录
          </Typography.Title>
          <Typography.Paragraph className="apple-section-subtitle" style={{ marginTop: 8, marginBottom: 24 }}>
            使用你的账号进入当前工作区。
          </Typography.Paragraph>
          <Tabs
            defaultActiveKey="login"
            items={[
              {
                key: 'login',
                label: '登录',
                children: (
                  <Form layout="vertical" onFinish={handleLogin} disabled={loading}>
                    <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
                      <Input autoFocus />
                    </Form.Item>
                    <Form.Item name="password" label="密码" rules={[{ required: true }]}>
                      <Input.Password />
                    </Form.Item>
                    <Button className="apple-pill-button" type="primary" htmlType="submit" block loading={loading}>
                      登录
                    </Button>
                  </Form>
                ),
              },
              {
                key: 'register',
                label: '注册',
                children: (
                  <Form layout="vertical" onFinish={handleRegister} disabled={loading}>
                    <Form.Item
                      name="username"
                      label="用户名"
                      rules={[{ required: true, min: 2, max: 64 }]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      name="email"
                      label="邮箱"
                      rules={[{ required: true, type: 'email' }]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      name="password"
                      label="密码"
                      rules={[{ required: true, min: 6 }]}
                    >
                      <Input.Password />
                    </Form.Item>
                    <Button className="apple-pill-button" type="primary" htmlType="submit" block loading={loading}>
                      注册并登录
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
