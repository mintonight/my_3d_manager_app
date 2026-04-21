import { useEffect, useState } from 'react';
import {
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Popconfirm,
  Select,
  Space,
  Typography,
  message,
} from 'antd';
import { api, extractError } from '../api';
import { useI18n } from '../i18n';
import type { Comment, Member, User } from '../types';

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
      <Typography.Text key={`${part}-${index}`} style={{ color: 'var(--ln-link-mention)' }}>
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
  const { isZh, formatDateTime } = useI18n();
  const [comments, setComments] = useState<Comment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [readNotificationId, setReadNotificationId] = useState<number | null>(null);
  const [form] = Form.useForm<{ content: string; mentioned_user_ids?: number[] }>();

  const text = isZh
    ? {
        published: '评论已发布',
        removed: '评论已删除',
        publishComment: '发表评论',
        contentRequired: '请输入评论内容',
        contentPlaceholder: '输入评论内容',
        mentions: '@提醒成员',
        mentionsPlaceholder: '选择当前项目成员，可单选或多选',
        submit: '发布评论',
        empty: '还没有评论',
        deleteConfirm: '删除这条评论？',
        delete: '删除',
        cancel: '取消',
      }
    : {
        published: 'Comment posted',
        removed: 'Comment deleted',
        publishComment: 'Post Comment',
        contentRequired: 'Please enter a comment',
        contentPlaceholder: 'Enter your comment',
        mentions: '@Mention members',
        mentionsPlaceholder: 'Choose current project members',
        submit: 'Post Comment',
        empty: 'No comments yet',
        deleteConfirm: 'Delete this comment?',
        delete: 'Delete',
        cancel: 'Cancel',
      };

  const endpoint = versionId
    ? `/projects/${pid}/files/${fid}/versions/${versionId}/comments`
    : `/projects/${pid}/files/${fid}/comments`;

  const load = async () => {
    setLoading(true);
    try {
      const [commentResponse, memberResponse] = await Promise.all([
        api.get<Comment[]>(endpoint),
        api.get<Member[]>(`/projects/${pid}/members`),
      ]);
      setComments(commentResponse.data);
      setMembers(memberResponse.data);
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

  const submit = async (values: { content: string; mentioned_user_ids?: number[] }) => {
    setSubmitting(true);
    try {
      await api.post(endpoint, values);
      form.resetFields();
      await load();
      message.success(text.published);
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
      message.success(text.removed);
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
          label={text.publishComment}
          rules={[{ required: true, message: text.contentRequired }]}
        >
          <Input.TextArea rows={4} maxLength={2000} placeholder={text.contentPlaceholder} />
        </Form.Item>
        <Form.Item name="mentioned_user_ids" label={text.mentions}>
          <Select
            mode="multiple"
            allowClear
            placeholder={text.mentionsPlaceholder}
            optionFilterProp="label"
            options={members.map((member) => ({
              value: member.user_id,
              label: member.username,
            }))}
          />
        </Form.Item>
        <Button className="apple-pill-button" type="primary" htmlType="submit" loading={submitting}>
          {text.submit}
        </Button>
      </Form>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <List
          loading={loading}
          locale={{ emptyText: <Empty className="apple-empty" description={text.empty} /> }}
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
                          title={text.deleteConfirm}
                          onConfirm={() => void removeComment(comment.id)}
                          okText={text.delete}
                          okButtonProps={{ danger: true }}
                          cancelText={text.cancel}
                        >
                          <Button type="link" danger size="small">
                            {text.delete}
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
                      {formatDateTime(comment.created_at)}
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
