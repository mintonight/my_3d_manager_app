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
import { useI18n } from '../i18n';
import type { Member, Role } from '../types';

const ROLE_COLOR: Record<string, string> = {
  owner: 'red',
  editor: 'blue',
  viewer: 'default',
};

interface Props {
  pid: number;
  myRole: Role;
}

export default function MemberPanel({ pid, myRole }: Props) {
  const { isZh, roleLabel } = useI18n();
  const [rows, setRows] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();
  const canManage = myRole === 'owner';

  const text = isZh
    ? {
        usernameRequired: '输入用户名',
        usernamePlaceholder: '用户名',
        addMember: '添加成员',
        added: (username: string) => `已添加成员 ${username}`,
        roleUpdated: '角色已更新',
        removed: '成员已移除',
        username: '用户名',
        email: '邮箱',
        role: '角色',
        actions: '操作',
        removeConfirm: '确定移除这个成员？',
        remove: '移除',
        cancel: '取消',
        noAction: '-',
      }
    : {
        usernameRequired: 'Enter a username',
        usernamePlaceholder: 'Username',
        addMember: 'Add Member',
        added: (username: string) => `Added member ${username}`,
        roleUpdated: 'Role updated',
        removed: 'Member removed',
        username: 'Username',
        email: 'Email',
        role: 'Role',
        actions: 'Actions',
        removeConfirm: 'Remove this member?',
        remove: 'Remove',
        cancel: 'Cancel',
        noAction: '-',
      };

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
      message.success(text.added(values.username));
      form.resetFields();
      await load();
    } catch (error) {
      message.error(extractError(error));
    }
  };

  const changeRole = async (uid: number, role: Role) => {
    try {
      await api.patch(`/projects/${pid}/members/${uid}`, { role });
      message.success(text.roleUpdated);
      await load();
    } catch (error) {
      message.error(extractError(error));
    }
  };

  const remove = async (uid: number) => {
    try {
      await api.delete(`/projects/${pid}/members/${uid}`);
      message.success(text.removed);
      await load();
    } catch (error) {
      message.error(extractError(error));
    }
  };

  return (
    <div>
      {canManage && (
        <Form form={form} layout="inline" onFinish={add} style={{ marginBottom: 20, rowGap: 12 }}>
          <Form.Item name="username" rules={[{ required: true, message: text.usernameRequired }]}>
            <Input placeholder={text.usernamePlaceholder} style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="role" initialValue="viewer">
            <Select style={{ width: 140 }}>
              <Select.Option value="viewer">{roleLabel('viewer')}</Select.Option>
              <Select.Option value="editor">{roleLabel('editor')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button className="apple-pill-button" type="primary" htmlType="submit">
              {text.addMember}
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
          { title: text.username, dataIndex: 'username' },
          { title: text.email, dataIndex: 'email' },
          {
            title: text.role,
            dataIndex: 'role',
            render: (role: Role) => <Tag color={ROLE_COLOR[role]}>{roleLabel(role)}</Tag>,
          },
          {
            title: text.actions,
            render: (_: unknown, row: Member) =>
              canManage && row.role !== 'owner' ? (
                <Space wrap>
                  <Select
                    size="small"
                    value={row.role}
                    style={{ width: 110 }}
                    onChange={(value) => void changeRole(row.user_id, value as Role)}
                    options={[
                      { value: 'viewer', label: roleLabel('viewer') },
                      { value: 'editor', label: roleLabel('editor') },
                    ]}
                  />
                  <Popconfirm
                    title={text.removeConfirm}
                    onConfirm={() => void remove(row.user_id)}
                    okText={text.remove}
                    cancelText={text.cancel}
                  >
                    <Button size="small" danger>
                      {text.remove}
                    </Button>
                  </Popconfirm>
                </Space>
              ) : (
                <Typography.Text type="secondary">{text.noAction}</Typography.Text>
              ),
          },
        ]}
      />
    </div>
  );
}
