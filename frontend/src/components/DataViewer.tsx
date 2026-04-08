import React, { useState, useEffect } from 'react';
import { Table, message, Card, Typography, Empty, Tag, Space, Descriptions, Divider, Button, Modal, Form, Input, InputNumber, Popconfirm } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { ConnectionInfo, QueryResult, TableInfo, ColumnInfo } from '../types';
import { databaseApi } from '../services/api';

const { Text, Title } = Typography;

interface DataViewerProps {
  connection: ConnectionInfo;
  database?: string;
  table: string;
}

const DataViewer: React.FC<DataViewerProps> = ({ connection, database, table }) => {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
    if (!['MONGODB', 'REDIS'].includes(connection.type)) {
      loadTableInfo();
    }
  }, [connection.id, database, table]);

  const loadTableInfo = async () => {
    try {
      const res = await databaseApi.getTableInfo(connection.id!, table, database);
      setTableInfo(res.data);
    } catch (error) {
      console.error('Failed to load table info:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      let res;
      if (connection.type === 'MONGODB') {
        const query = JSON.stringify({ collection: table });
        res = await databaseApi.executeQuery(connection.id!, {
          connectionId: connection.id!,
          database,
          sql: query,
          page: 1,
          pageSize: 50,
        });
      } else if (connection.type === 'REDIS') {
        res = await databaseApi.executeQuery(connection.id!, {
          connectionId: connection.id!,
          database,
          sql: table,
        });
      } else {
        const sql = `SELECT * FROM \`${table}\` LIMIT 100`;
        res = await databaseApi.executeQuery(connection.id!, {
          connectionId: connection.id!,
          database,
          sql,
          page: 1,
          pageSize: 100,
        });
      }
      setResult(res.data);
    } catch (error) {
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (record: any) => {
    try {
      if (connection.type === 'MONGODB') {
        const sql = JSON.stringify({ 
          command: 'delete', 
          collection: table, 
          filter: { _id: record._id } 
        });
        await databaseApi.executeUpdate(connection.id!, { connectionId: connection.id!, database, sql });
      } else if (connection.type === 'REDIS') {
        await databaseApi.dropTable(connection.id!, record.key, database);
      } else {
        const pk = tableInfo?.columns?.find(c => c.primaryKey);
        if (!pk) {
          message.error('No primary key found for this table. Deletion is unsafe.');
          return;
        }
        const sql = `DELETE FROM \`${table}\` WHERE \`${pk.name}\` = '${record[pk.name]}'`;
        await databaseApi.executeUpdate(connection.id!, { connectionId: connection.id!, database, sql });
      }
      message.success('Deleted successfully');
      loadData();
    } catch (error) {
      message.error('Failed to delete');
    }
  };

  const handleSave = async (values: any) => {
    try {
      if (connection.type === 'MONGODB') {
        const doc = JSON.parse(values.json);
        let sql = '';
        if (editingRecord) {
          sql = JSON.stringify({
            command: 'update',
            collection: table,
            filter: { _id: editingRecord._id },
            update: doc
          });
        } else {
          sql = JSON.stringify({
            command: 'insert',
            collection: table,
            document: doc
          });
        }
        await databaseApi.executeUpdate(connection.id!, { connectionId: connection.id!, database, sql });
      } else if (connection.type === 'REDIS') {
        const sql = `${values.key}:${values.value}`;
        await databaseApi.executeUpdate(connection.id!, { connectionId: connection.id!, database, sql });
      } else {
        const pk = tableInfo?.columns?.find(c => c.primaryKey);
        let sql = '';
        if (editingRecord) {
          const sets = Object.entries(values)
            .filter(([key]) => key !== pk?.name && key !== 'actions')
            .map(([key, val]) => `\`${key}\` = '${val}'`)
            .join(', ');
          sql = `UPDATE \`${table}\` SET ${sets} WHERE \`${pk?.name}\` = '${editingRecord[pk!.name]}'`;
        } else {
          const cols = Object.keys(values).map(k => `\`${k}\``).join(', ');
          const vals = Object.values(values).map(v => `'${v}'`).join(', ');
          sql = `INSERT INTO \`${table}\` (${cols}) VALUES (${vals})`;
        }
        await databaseApi.executeUpdate(connection.id!, { connectionId: connection.id!, database, sql });
      }
      message.success('Saved successfully');
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      message.error('Failed to save: ' + error.message);
    }
  };

  const renderSqlTable = () => {
    const dataColumns = result?.columns?.map(col => ({
      title: col,
      dataIndex: col,
      key: col,
      ellipsis: true,
      render: (value: any) => {
        if (value === null) return <span className="text-gray-400">NULL</span>;
        return String(value);
      },
    })) || [];

    const actionColumn = {
      title: 'Actions',
      key: 'actions',
      fixed: 'right' as const,
      width: 100,
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button 
            type="text" 
            size="small" 
            icon={<EditOutlined />} 
            onClick={() => {
              setEditingRecord(record);
              form.setFieldsValue(record);
              setModalVisible(true);
            }}
          />
          <Popconfirm title="Delete this row?" onConfirm={() => handleDelete(record)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    };

    return (
      <Table
        columns={[...dataColumns, actionColumn]}
        dataSource={result?.rows || []}
        rowKey={(record, index) => index.toString()}
        loading={loading}
        pagination={{ pageSize: 50 }}
        size="small"
        scroll={{ x: 'max-content', y: 'calc(100vh - 320px)' }}
        className="data-table"
      />
    );
  };

  const renderMongoDocuments = () => {
    if (!result?.rows || result.rows.length === 0) return <Empty description="No documents found" />;
    return (
      <div className="flex flex-col gap-4 overflow-auto" style={{ height: 'calc(100vh - 240px)' }}>
        {result.rows.map((doc, idx) => (
          <Card 
            key={idx} 
            size="small" 
            className="mongo-doc-card shadow-sm"
            title={<Text type="secondary">Document #{idx + 1}</Text>}
            extra={
              <Space>
                <Button 
                  type="text" 
                  icon={<EditOutlined />} 
                  size="small" 
                  onClick={() => {
                    setEditingRecord(doc);
                    form.setFieldsValue({ json: JSON.stringify(doc, null, 2) });
                    setModalVisible(true);
                  }} 
                />
                <Popconfirm title="Delete document?" onConfirm={() => handleDelete(doc)}>
                  <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                </Popconfirm>
              </Space>
            }
          >
            <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ margin: 0, borderRadius: '4px', fontSize: '13px' }}>
              {JSON.stringify(doc, null, 2)}
            </SyntaxHighlighter>
          </Card>
        ))}
      </div>
    );
  };

  const renderRedisValue = () => {
    if (!result?.rows || result.rows.length === 0) return <Empty description="Key not found" />;
    const data = result.rows[0];
    const { key, type, value } = data;
    return (
      <div className="p-4 bg-white rounded-lg border border-gray-200">
        <Descriptions title="Key Information" bordered column={1} extra={
          <Space>
            <Button 
              type="primary" 
              icon={<EditOutlined />} 
              onClick={() => {
                setEditingRecord(data);
                form.setFieldsValue({ key, value: typeof value === 'string' ? value : JSON.stringify(value) });
                setModalVisible(true);
              }}
            >
              Edit Value
            </Button>
            <Popconfirm title="Delete this key?" onConfirm={() => handleDelete(data)}>
              <Button type="primary" danger icon={<DeleteOutlined />}>Delete Key</Button>
            </Popconfirm>
          </Space>
        }>
          <Descriptions.Item label="Key">{key}</Descriptions.Item>
          <Descriptions.Item label="Type"><Tag color="magenta">{String(type).toUpperCase()}</Tag></Descriptions.Item>
        </Descriptions>
        <Divider orientation="left">Value</Divider>
        <div className="bg-gray-50 p-4 rounded border border-dashed border-gray-300">
          <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ margin: 0, borderRadius: '4px' }}>
            {JSON.stringify(value, null, 2)}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <Space>
          <Title level={5} className="m-0">
            {connection.type === 'REDIS' ? 'Key: ' : connection.type === 'MONGODB' ? 'Collection: ' : 'Table: '}
            <span style={{ color: '#7C3AED' }}>{table}</span>
          </Title>
          <Tag color="blue">{connection.type}</Tag>
        </Space>
        <Space>
          {connection.type === 'MONGODB' && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => {
                setEditingRecord(null);
                form.resetFields();
                setModalVisible(true);
              }}
            >
              Add Document
            </Button>
          )}
          {['MYSQL', 'POSTGRESQL', 'SQLITE'].includes(connection.type) && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => {
                setEditingRecord(null);
                form.resetFields();
                setModalVisible(true);
              }}
            >
              Add Row
            </Button>
          )}
        </Space>
      </div>

      <div className="flex-1 overflow-hidden">
        {connection.type === 'MONGODB' ? renderMongoDocuments() :
         connection.type === 'REDIS' ? renderRedisValue() :
         renderSqlTable()}
      </div>

      <Modal
        title={editingRecord ? 'Edit Data' : 'Add New Data'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          {connection.type === 'MONGODB' ? (
            <Form.Item name="json" label="Document JSON" rules={[{ required: true }]}>
              <Input.TextArea rows={10} placeholder='{ "key": "value" }' />
            </Form.Item>
          ) : connection.type === 'REDIS' ? (
            <>
              <Form.Item name="key" label="Key" rules={[{ required: true }]}>
                <Input disabled={!!editingRecord} />
              </Form.Item>
              <Form.Item name="value" label="Value" rules={[{ required: true }]}>
                <Input.TextArea rows={5} />
              </Form.Item>
            </>
          ) : (
            tableInfo?.columns?.map(col => (
              <Form.Item 
                key={col.name} 
                name={col.name} 
                label={col.name} 
                rules={[{ required: !col.nullable && !col.primaryKey }]}
              >
                {col.type.toLowerCase().includes('int') ? <InputNumber style={{ width: '100%' }} /> : <Input />}
              </Form.Item>
            ))
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default DataViewer;
