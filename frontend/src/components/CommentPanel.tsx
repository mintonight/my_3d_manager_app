import { useEffect, useState } from 'react';
import {
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Popconfirm,
  Space,
  Typography,
  message,
} from 'antd';
import { api, extractError } from '../api';
import type { Comment, User } from '../types';

interface CommentPanelProps {
  pid: number;
  fid: number;
  open: boolean;
  title: string;
  currentUser: User | null;
  onClose: () => void;
  versionId?: number | null;
  highlightCommentId?: number | null;
  notificationId?: number | null;
  onNotificationRead?: () => void;
}

const HIGHLIGHT_PATTERN = /(@[A-Za-z0-9_.\-\u4e00-\u9fff]{2,64})/g;

function renderContent(content: string) {
  const parts = content.split(HIGHLIGHT_PATTERN);
  return parts.map((part, index) =>
    part.startsWith('@') ? (
      <Typography.Text key={`${part}-${index}`} style={{ color: '#0071e3' }}>
        {part}
      </Typography.Text>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

export default function CommentPanel({
  pid,
  fid,
  open,
  title,
  currentUser,
  onClose,
  versionId,
  highlightCommentId,
  notificationId,
  onNotificationRead,
}: CommentPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [readNotificationId, setReadNotificationId] = useState<number | null>(null);
  const [form] = Form.useForm<{ content: string }>();

  const endpoint = versionId
    ? `/projects/${pid}/files/${fid}/versions/${versionId}/comments`
    : `/projects/${pid}/files/${fid}/comments`;

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get<Comment[]>(endpoint);
      setComments(response.data);
    } catch (error) {
      message.error(extractError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, endpoint]);

  useEffect(() => {
    if (!open || !notificationId || readNotificationId === notificationId) return;
    const markRead = async () => {
      try {
        await api.post(`/notifications/${notificationId}/read`);
        setReadNotificationId(notificationId);
        window.dispatchEvent(new Event('notifications:refresh'));
        onNotificationRead?.();
      } catch {
        setReadNotificationId(notificationId);
      }
    };
    void markRead();
  }, [open, notificationId, onNotificationRead, readNotificationId]);

  useEffect(() => {
    if (!open || !highlightCommentId) return;
    const timer = window.setTimeout(() => {
      const node = document.getElementById(`comment-${highlightCommentId}`);
      node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [open, comments, highlightCommentId]);

  const submit = async (values: { content: string }) => {
    setSubmitting(true);
    try {
      await api.post(endpoint, values);
      form.resetFields();
      await load();
      message.success('评论已发布');
    } catch (error) {
      message.error(extractError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const removeComment = async (commentId: number) => {
    try {
      await api.delete(`/projects/${pid}/comments/${commentId}`);
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      message.success('评论已删除');
    } catch (error) {
      message.error(extractError(error));
    }
  };

  return (
    <Drawer
      className="apple-comment-drawer"
      title={title}
      open={open}
      onClose={onClose}
      width={480}
      destroyOnHidden={false}
      styles={{ body: { display: 'flex', flexDirection: 'column', gap: 16 } }}
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item
          name="content"
          label="发表评论"
          rules={[{ required: true, message: '请输入评论内容' }]}
        >
          <Input.TextArea
            rows={4}
            maxLength={2000}
            placeholder="支持 @用户名 提醒当前项目成员"
          />
        </Form.Item>
        <Button className="apple-pill-button" type="primary" htmlType="submit" loading={submitting}>
          发布评论
        </Button>
      </Form>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <List
          loading={loading}
          locale={{ emptyText: <Empty className="apple-empty" description="还没有评论" /> }}
          dataSource={comments}
          renderItem={(comment) => {
            const canDelete = currentUser?.is_admin || currentUser?.id === comment.author_id;
            return (
              <List.Item
                key={comment.id}
                id={`comment-${comment.id}`}
                className={`apple-comment-item ${
                  comment.id === highlightCommentId ? 'apple-comment-item--highlight' : ''
                }`}
                style={{ alignItems: 'flex-start', padding: '14px 0' }}
                actions={
                  canDelete
                    ? [
                        <Popconfirm
                          key="delete"
                          title="删除这条评论？"
                          onConfirm={() => void removeComment(comment.id)}
                          okText="删除"
                          okButtonProps={{ danger: true }}
                          cancelText="取消"
                        >
                          <Button type="link" danger size="small">
                            删除
                          </Button>
                        </Popconfirm>,
                      ]
                    : []
                }
              >
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space wrap>
                    <Typography.Text strong>{comment.author_username}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(comment.created_at).toLocaleString('zh-CN')}
                    </Typography.Text>
                  </Space>
                  <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {renderContent(comment.content)}
                  </Typography.Paragraph>
                </Space>
              </List.Item>
            );
          }}
        />
      </div>
    </Drawer>
  );
}
