import React, { useState } from 'react';
import { Button, Table, message, Card, Space, Typography } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import type { ConnectionInfo, QueryResult } from '../types';
import { databaseApi } from '../services/api';

const { Text } = Typography;

interface SqlEditorProps {
  connection: ConnectionInfo;
  database?: string;
}

const SqlEditor: React.FC<SqlEditorProps> = ({ connection, database }) => {
  const [sql, setSql] = useState('SELECT * FROM');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExecute = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    try {
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
      const res = isSelect
        ? await databaseApi.executeQuery(connection.id!, {
            connectionId: connection.id!,
            database,
            sql,
            page: 1,
            pageSize: 100,
          })
        : await databaseApi.executeUpdate(connection.id!, {
            connectionId: connection.id!,
            database,
            sql,
          });
      setResult(res.data);
      if (res.data.success) {
        message.success('Query executed successfully');
      } else {
        message.error(res.data.message);
      }
    } catch (error) {
      message.error('Failed to execute query');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const columns = result?.columns?.map(col => ({
    title: col,
    dataIndex: col,
    key: col,
    ellipsis: true,
    render: (value: any) => {
      if (value === null) return <span style={{ color: '#9CA3AF' }}>NULL</span>;
      return String(value);
    },
  })) || [];

  return (
    <div className="h-full flex flex-col" style={{ minHeight: '60vh' }}>
      <Card
        size="small"
        className="mb-4 sql-editor-container"
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div className="flex gap-2">
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecute}
              loading={loading}
              size="large"
              style={{
                background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
              }}
            >
              Execute
            </Button>
          </div>
          <div
            style={{
              border: '1px solid #E5E7EB',
              borderRadius: 10,
              overflow: 'hidden',
              transition: 'all 0.2s ease-out',
            }}
          >
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              className="sql-textarea"
              style={{
                width: '100%',
                minHeight: '180px',
                fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
                fontSize: '14px',
                lineHeight: '1.6',
                padding: '16px',
                border: 'none',
                outline: 'none',
                resize: 'vertical',
                background: '#FAFAFA',
              }}
              placeholder="Enter SQL query..."
            />
          </div>
        </Space>
      </Card>

      {result && (
        <Card
          size="small"
          title={
            <Space size="middle">
              <Text
                type={result.success ? 'success' : 'danger'}
                strong
                style={{ fontSize: '15px' }}
              >
                {result.success ? '✓ Success' : '✗ Error'}
              </Text>
              {result.executionTime && (
                <Text type="secondary" style={{ fontSize: '13px' }}>
                  ⏱️ {result.executionTime}ms
                </Text>
              )}
              {result.affectedRows !== undefined && (
                <Text type="secondary" style={{ fontSize: '13px' }}>
                  ↔️ Affected rows: {result.affectedRows}
                </Text>
              )}
            </Space>
          }
          className="flex-1 overflow-auto"
          style={{
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
        >
          {!result.success ? (
            <Text type="danger" style={{ fontSize: '14px' }}>
              {result.message}
            </Text>
          ) : result.columns && result.rows ? (
            <Table
              columns={columns}
              dataSource={result.rows}
              rowKey={(record, index) => index.toString()}
              pagination={{
                pageSize: 50,
                size: 'small',
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} rows`,
              }}
              size="small"
              scroll={{ x: 'max-content', y: '40vh' }}
              style={{ marginTop: '12px' }}
            />
          ) : (
            <Text type="secondary" style={{ fontSize: '14px' }}>
              No results to display
            </Text>
          )}
        </Card>
      )}
    </div>
  );
};

export default SqlEditor;
