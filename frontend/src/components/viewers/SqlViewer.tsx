import React from 'react';
import { Table, Button, Space, Popconfirm, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, TableOutlined } from '@ant-design/icons';
import type { QueryResult, TableInfo } from '../../types';

const { Text } = Typography;

interface SqlViewerProps {
  table: string;
  result: QueryResult | null;
  loading: boolean;
  tableInfo: TableInfo | null;
  onEdit: (record: any) => void;
  onDelete: (record: any) => void;
}

const SqlViewer: React.FC<SqlViewerProps> = ({ table, result, loading, tableInfo, onEdit, onDelete }) => {
  // Relaxed detection: Check for result.rows only
  const hasData = result && result.success && result.rows && result.rows.length > 0;

  if (!hasData && !loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl m-4">
        <TableOutlined style={{ fontSize: 48, color: '#d1d5db', marginBottom: 16 }} />
        <Text type="secondary">No data found in table "{table}"</Text>
        {result && !result.success && <Text type="danger" className="mt-2">{result.message}</Text>}
      </div>
    );
  }

  // Fallback to result.columns or derived columns from first row
  const columnNames = result?.columns || (result?.rows?.[0] ? Object.keys(result.rows[0]) : []);

  const columns = [
    ...(columnNames.map(c => ({
      title: <span className="font-bold text-gray-700">{c}</span>,
      dataIndex: c,
      key: c,
      ellipsis: true,
      render: (text: any) => text === null ? <Text type="secondary" italic>NULL</Text> : String(text)
    })) || []),
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right' as const,
      width: 100,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(record)} />
          <Popconfirm title="Delete this row?" onConfirm={() => onDelete(record)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="p-4 flex-1 overflow-hidden flex flex-col">
      <Table 
        dataSource={result?.rows || []} 
        columns={columns} 
        loading={loading} 
        size="small" 
        scroll={{ x: 'max-content', y: 'calc(100vh - 280px)' }}
        pagination={{ 
          pageSize: 50, 
          showSizeChanger: true, 
          size: 'small',
          showTotal: (total) => `Total ${total} rows` 
        }}
        className="navilite-table border border-gray-100 rounded-lg shadow-sm bg-white"
        rowKey={(r, i) => i}
      />
    </div>
  );
};

export default SqlViewer;
