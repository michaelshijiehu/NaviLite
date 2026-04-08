import React, { useState, useEffect } from 'react';
import { Table, message, Card, Typography, Tag } from 'antd';
import type { ConnectionInfo, TableInfo } from '../types';
import { databaseApi } from '../services/api';

const { Text } = Typography;

interface TableStructureProps {
  connection: ConnectionInfo;
  database?: string;
  table: string;
}

const TableStructure: React.FC<TableStructureProps> = ({ connection, database, table }) => {
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStructure();
  }, [connection.id, database, table]);

  const loadStructure = async () => {
    setLoading(true);
    try {
      const res = await databaseApi.getTableInfo(connection.id!, table, database);
      setTableInfo(res.data);
    } catch (error) {
      message.error('Failed to load table structure');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <Text strong={record.primaryKey}>{name}</Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color="blue">{type}</Tag>
      ),
    },
    {
      title: 'Length',
      dataIndex: 'length',
      key: 'length',
    },
    {
      title: 'Nullable',
      dataIndex: 'nullable',
      key: 'nullable',
      render: (nullable: boolean) => (
        <Tag color={nullable ? 'default' : 'red'}>
          {nullable ? 'YES' : 'NO'}
        </Tag>
      ),
    },
    {
      title: 'Primary Key',
      dataIndex: 'primaryKey',
      key: 'primaryKey',
      render: (pk: boolean) => pk && <Tag color="gold">PK</Tag>,
    },
    {
      title: 'Default',
      dataIndex: 'defaultValue',
      key: 'defaultValue',
      render: (value: any) => value !== null && value !== undefined ? String(value) : '-',
    },
    {
      title: 'Comment',
      dataIndex: 'comment',
      key: 'comment',
      render: (comment: string) => comment || '-',
    },
  ];

  return (
    <Card
      title={
        <Text strong>Structure: {table}</Text>
      }
      className="h-full"
    >
      <Table
        columns={columns}
        dataSource={tableInfo?.columns || []}
        rowKey="name"
        loading={loading}
        pagination={false}
        size="small"
      />
    </Card>
  );
};

export default TableStructure;
