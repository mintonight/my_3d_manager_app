import { useEffect, useState } from 'react';
import { Button, Divider, Empty, Input, Popover, Space, Spin, Tag, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { SearchResult } from '../types';

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ projects: [], files: [] });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults({ projects: [], files: [] });
      setLoading(false);
      setOpen(false);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.get<SearchResult>('/search', { params: { q: trimmed } });
        setResults(response.data);
        setOpen(true);
      } catch {
        setResults({ projects: [], files: [] });
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const total = results.projects.length + results.files.length;

  const content = (
    <div style={{ width: 420, maxHeight: 420, overflowY: 'auto' }}>
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : total === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配结果" />
      ) : (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {results.projects.length > 0 && (
            <div>
              <Typography.Text type="secondary">项目</Typography.Text>
              <div style={{ marginTop: 8 }}>
                {results.projects.map((project) => (
                  <Button
                    key={`project-${project.id}`}
                    type="text"
                    block
                    className="apple-search-item"
                    style={{ height: 'auto', textAlign: 'left', padding: '8px 12px' }}
                    onClick={() => {
                      close();
                      navigate(`/projects/${project.id}`);
                    }}
                  >
                    <Space direction="vertical" size={2} style={{ width: '100%', alignItems: 'flex-start' }}>
                      <Space wrap>
                        <Typography.Text strong>{project.name}</Typography.Text>
                        <Tag>{project.my_role}</Tag>
                      </Space>
                      {project.description && (
                        <Typography.Text type="secondary" ellipsis style={{ maxWidth: 360 }}>
                          {project.description}
                        </Typography.Text>
                      )}
                    </Space>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {results.projects.length > 0 && results.files.length > 0 && <Divider style={{ margin: '4px 0' }} />}

          {results.files.length > 0 && (
            <div>
              <Typography.Text type="secondary">文件</Typography.Text>
              <div style={{ marginTop: 8 }}>
                {results.files.map((file) => (
                  <Button
                    key={`file-${file.project_id}-${file.id}`}
                    type="text"
                    block
                    className="apple-search-item"
                    style={{ height: 'auto', textAlign: 'left', padding: '8px 12px' }}
                    onClick={() => {
                      close();
                      navigate(`/projects/${file.project_id}/files/${file.id}`);
                    }}
                  >
                    <Space direction="vertical" size={2} style={{ width: '100%', alignItems: 'flex-start' }}>
                      <Typography.Text strong>{file.name}</Typography.Text>
                      <Typography.Text type="secondary">
                        {file.project_name}
                        {file.current_version_no ? ` · v${file.current_version_no}` : ''}
                      </Typography.Text>
                    </Space>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </Space>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={Boolean(query.trim()) && open}
      onOpenChange={(nextOpen) => setOpen(nextOpen)}
      placement="bottom"
      overlayClassName="apple-search-popover"
    >
      <Input
        className="apple-search-input"
        allowClear
        value={query}
        prefix={<SearchOutlined />}
        placeholder="搜索项目或文件"
        style={{ width: 360, maxWidth: '100%' }}
        onFocus={() => {
          if (query.trim()) setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          if (event.target.value.trim()) setOpen(true);
        }}
      />
    </Popover>
  );
}
