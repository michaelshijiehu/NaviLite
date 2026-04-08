import React from 'react';
import { Card, Button, Space, Popconfirm, Empty } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { QueryResult } from '../../types';

interface MongoViewerProps {
  result: QueryResult | null;
  onEdit: (doc: any) => void;
  onDelete: (doc: any) => void;
}

const MongoViewer: React.FC<MongoViewerProps> = ({ result, onEdit, onDelete }) => {
  if (!result?.rows || result.rows.length === 0) return <Empty description="No documents in this collection" />;

  return (
    <div className="p-4 flex-1 overflow-auto flex flex-col gap-4 bg-gray-50">
      {result.rows.map((doc, idx) => (
        <Card 
          key={idx} 
          size="small" 
          className="shadow-sm border-gray-200 hover:border-purple-300 transition-colors"
          extra={
            <Space>
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(doc)} />
              <Popconfirm title="Delete document?" onConfirm={() => onDelete(doc)}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          }
        >
          <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ margin: 0, padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
            {JSON.stringify(doc, null, 2)}
          </SyntaxHighlighter>
        </Card>
      ))}
    </div>
  );
};

export default MongoViewer;
