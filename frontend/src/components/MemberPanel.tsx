import { useEffect, useState } from 'react';
import {
  Button,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { api, extractError } from '../api';
import type { Member, Role } from '../types';

const ROLE_COLOR: Record<string, string> = {
  owner: 'red',
  editor: 'blue',
  viewer: 'default',
};

const ROLE_LABEL: Record<string, string> = {
  owner: '所有者',
  editor: '编辑者',
  viewer: '查看者',
};

interface Props {
  pid: number;
  myRole: Role;
}

export default function MemberPanel({ pid, myRole }: Props) {
  const [rows, setRows] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();
  const canManage = myRole === 'owner';

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get<Member[]>(`/projects/${pid}/members`);
      setRows(response.data);
    } catch (error) {
      message.error(extractError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [pid]);

  const add = async (values: { username: string; role: Role }) => {
    try {
      await api.post(`/projects/${pid}/members`, values);
      message.success(`已添加成员 ${values.username}`);
      form.resetFields();
      await load();
    } catch (error) {
      message.error(extractError(error));
    }
  };

  const changeRole = async (uid: number, role: Role) => {
    try {
      await api.patch(`/projects/${pid}/members/${uid}`, { role });
      message.success('角色已更新');
      await load();
    } catch (error) {
      message.error(extractError(error));
    }
  };

  const remove = async (uid: number) => {
    try {
      await api.delete(`/projects/${pid}/members/${uid}`);
      message.success('成员已移除');
      await load();
    } catch (error) {
      message.error(extractError(error));
    }
  };

  return (
    <div>
      {canManage && (
        <Form form={form} layout="inline" onFinish={add} style={{ marginBottom: 20, rowGap: 12 }}>
          <Form.Item name="username" rules={[{ required: true, message: '输入用户名' }]}>
            <Input placeholder="用户名" style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="role" initialValue="viewer">
            <Select style={{ width: 140 }}>
              <Select.Option value="viewer">查看者</Select.Option>
              <Select.Option value="editor">编辑者</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button className="apple-pill-button" type="primary" htmlType="submit">
              添加成员
            </Button>
          </Form.Item>
        </Form>
      )}

      <Table
        rowKey="user_id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        columns={[
          { title: '用户名', dataIndex: 'username' },
          { title: '邮箱', dataIndex: 'email' },
          {
            title: '角色',
            dataIndex: 'role',
            render: (role: Role) => <Tag color={ROLE_COLOR[role]}>{ROLE_LABEL[role]}</Tag>,
          },
          {
            title: '操作',
            render: (_: unknown, row: Member) =>
              canManage && row.role !== 'owner' ? (
                <Space wrap>
                  <Select
                    size="small"
                    value={row.role}
                    style={{ width: 110 }}
                    onChange={(value) => void changeRole(row.user_id, value as Role)}
                    options={[
                      { value: 'viewer', label: '查看者' },
                      { value: 'editor', label: '编辑者' },
                    ]}
                  />
                  <Popconfirm
                    title="确定移除这个成员？"
                    onConfirm={() => void remove(row.user_id)}
                    okText="移除"
                    cancelText="取消"
                  >
                    <Button size="small" danger>
                      移除
                    </Button>
                  </Popconfirm>
                </Space>
              ) : (
                <Typography.Text type="secondary">-</Typography.Text>
              ),
          },
        ]}
      />
    </div>
  );
}
