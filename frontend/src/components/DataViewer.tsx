import React, { useState, useEffect } from 'react';
import { message, Typography, Space, Divider, Button, Modal, Form, Input, InputNumber, Spin, Alert } from 'antd';
import { PlusOutlined, ReloadOutlined, TableOutlined, FileTextOutlined, ClockCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { ConnectionInfo, QueryResult, TableInfo } from '../types';
import { databaseApi } from '../services/api';

// Sub-viewers
import SqlViewer from './viewers/SqlViewer';
import MongoViewer from './viewers/MongoViewer';
import RedisViewer from './viewers/RedisViewer';

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
    } catch (error) { console.error('Info load failed', error); }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      let res;
      if (connection.type === 'MONGODB') {
        res = await databaseApi.executeQuery(connection.id!, { connectionId: connection.id!, database, sql: JSON.stringify({ collection: table }), page: 1, pageSize: 50 });
      } else if (connection.type === 'REDIS') {
        res = await databaseApi.executeQuery(connection.id!, { connectionId: connection.id!, database, sql: table });
      } else {
        const quote = connection.type === 'MYSQL' ? '`' : '"';
        const quotedTable = `${quote}${table}${quote}`;
        res = await databaseApi.executeQuery(connection.id!, { connectionId: connection.id!, database, sql: `SELECT * FROM ${quotedTable} LIMIT 100`, page: 1, pageSize: 100 });
      }
      setResult(res.data);
    } catch (error) { message.error('Data load failed'); } finally { setLoading(false); }
  };

  const handleDelete = async (record: any) => {
    try {
      let sql = '';
      if (connection.type === 'MONGODB') {
        sql = JSON.stringify({ command: 'delete', collection: table, filter: { _id: record._id } });
      } else if (connection.type === 'REDIS') {
        sql = JSON.stringify({ action: 'del', key: table });
      } else {
        const pk = tableInfo?.columns?.find(c => c.primaryKey);
        if (!pk) return message.error('No primary key found for deletion');
        sql = `DELETE FROM "${table}" WHERE "${pk.name}" = '${record[pk.name]}'`;
      }
      await databaseApi.executeUpdate(connection.id!, { connectionId: connection.id!, database, sql });
      message.success('Deleted successfully');
      loadData();
    } catch (error) { message.error('Delete failed'); }
  };

  const handleRedisElementDelete = async (type: string, record: any) => {
    let action = '';
    let payload: any = { key: table };
    if (type === 'hash') { action = 'hdel'; payload.field = record.field; }
    else if (type === 'list') { action = 'lrem'; payload.value = record.value; }
    else if (type === 'set') { action = 'srem'; payload.value = record.value; }
    else if (type === 'zset') { action = 'zrem'; payload.value = record.value; }
    
    payload.action = action;
    try {
       await databaseApi.executeUpdate(connection.id!, { connectionId: connection.id!, database, sql: JSON.stringify(payload) });
       message.success('Item removed');
       loadData();
    } catch(e) { message.error('Delete failed'); }
  };

  const handleSave = async (values: any) => {
    try {
      let sql = '';
      if (connection.type === 'MONGODB') {
        const doc = JSON.parse(values.json);
        sql = editingRecord && !editingRecord.isNewItem ? JSON.stringify({ command: 'update', collection: table, filter: { _id: editingRecord._id }, update: doc })
                           : JSON.stringify({ command: 'insert', collection: table, document: doc });
      } else if (connection.type === 'REDIS') {
        if (editingRecord && editingRecord.isNewItem) {
          let action = 'set';
          if (editingRecord.type === 'hash') action = 'hset';
          else if (editingRecord.type === 'list') action = 'rpush';
          else if (editingRecord.type === 'set') action = 'sadd';
          else if (editingRecord.type === 'zset') action = 'zadd';
          sql = JSON.stringify({ action, key: table, field: values.field, score: values.score, value: values.value });
        } else {
          // Editing existing key (String value or just Metadata)
          sql = JSON.stringify({
            action: 'set',
            key: table,
            value: values.value !== undefined ? values.value : editingRecord.value,
            ttl: values.ttl
          });
        }
      } else {
        const pk = tableInfo?.columns?.find(c => c.primaryKey);
        if (editingRecord) {
          const sets = Object.entries(values).filter(([k]) => k !== pk?.name).map(([k, v]) => `"${k}" = '${v}'`).join(', ');
          sql = `UPDATE "${table}" SET ${sets} WHERE "${pk?.name}" = '${editingRecord[pk!.name]}'`;
        } else {
          const cols = Object.keys(values).map(k => `"${k}"`).join(', ');
          const vals = Object.values(values).map(v => `'${v}'`).join(', ');
          sql = `INSERT INTO "${table}" (${cols}) VALUES (${vals})`;
        }
      }
      await databaseApi.executeUpdate(connection.id!, { connectionId: connection.id!, database, sql });
      message.success('Saved successfully');
      setModalVisible(false);
      loadData();
    } catch (error: any) { message.error('Save failed: ' + error.message); }
  };

  const getHeaderIcon = () => {
    if (connection.type === 'REDIS') return <ClockCircleOutlined className="text-red-500 text-xl" />;
    if (connection.type === 'MONGODB') return <FileTextOutlined className="text-green-500 text-xl" />;
    return <TableOutlined className="text-blue-500 text-xl" />;
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Dynamic Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white shadow-sm z-10">
        <Space size="middle">
          <div className="p-2 bg-gray-50 rounded-lg">{getHeaderIcon()}</div>
          <div>
            <Title level={4} className="m-0 leading-tight">{table}</Title>
            <Space size="xs">
               <Text type="secondary" className="text-xs uppercase tracking-wider">{connection.type}</Text>
               <Divider type="vertical" />
               <Text type="secondary" className="text-xs">{database || 'default'}</Text>
            </Space>
          </div>
        </Space>
        <Space>
          {['MYSQL', 'POSTGRESQL', 'SQLITE'].includes(connection.type) && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); form.resetFields(); setModalVisible(true); }}>Add Row</Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
        </Space>
      </div>

      {/* Routed Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <Spin size="large" tip="Fetching data..." />
          </div>
        ) : connection.type === 'REDIS' ? (
          <RedisViewer 
            connection={connection}
            database={database || ''}
            table={table}
            onReload={loadData}
            onKeyDeleted={() => {
              // Usually we'd redirect or close the tab, but for now we just reload
              setResult(null);
            }}
            onKeyRenamed={(newKey) => {
              // We should ideally update the tree and select the new node, 
              // but for now we'll just reload the new key's data
            }}
          />
        ) : connection.type === 'MONGODB' ? (
          <MongoViewer 
            result={result} 
            onEdit={(doc) => { setEditingRecord(doc); form.setFieldsValue({ json: JSON.stringify(doc, null, 2) }); setModalVisible(true); }}
            onDelete={handleDelete}
          />
        ) : (
          <SqlViewer 
            table={table}
            result={result}
            loading={loading}
            tableInfo={tableInfo}
            onEdit={(r) => { setEditingRecord(r); form.setFieldsValue(r); setModalVisible(true); }}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Universal Modal */}
      <Modal 
        open={modalVisible} 
        onCancel={() => setModalVisible(false)} 
        onOk={() => form.submit()} 
        title={editingRecord?.isNewItem ? 'Add New Element' : 'Edit Item'} 
        destroyOnClose 
        width={connection.type === 'MONGODB' ? 800 : 520}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          {connection.type === 'MONGODB' ? (
            <Form.Item name="json" label="JSON Document" rules={[{ required: true, message: 'JSON is required' }]}>
              <Input.TextArea rows={15} className="font-mono text-sm" />
            </Form.Item>
          ) : connection.type === 'REDIS' ? (
             <>
               {editingRecord?.type === 'hash' && editingRecord.isNewItem && <Form.Item name="field" label="Field" rules={[{ required: true }]}><Input /></Form.Item>}
               {editingRecord?.type === 'zset' && editingRecord.isNewItem && <Form.Item name="score" label="Score" rules={[{ required: true }]}><InputNumber style={{width: '100%'}} /></Form.Item>}
               
               {/* Show Value only if it's String or adding new element */}
               {(editingRecord?.type === 'string' || editingRecord?.isNewItem) && (
                 <Form.Item name="value" label={editingRecord?.isNewItem ? 'Element Value' : 'Value'} rules={[{ required: true }]}><Input.TextArea rows={8} className="font-mono" /></Form.Item>
               )}

               {/* Always allow editing TTL for the overall key (when not adding sub-elements) */}
               {!editingRecord?.isNewItem && (
                 <div className="bg-blue-50 p-4 rounded-lg mb-4">
                   <div className="flex items-center gap-2 mb-2 text-blue-700 font-medium">
                     <ClockCircleOutlined /> Key Expiration (TTL)
                   </div>
                   <Form.Item name="ttl" label="TTL (Seconds)" extra="Use -1 for permanent (persist)">
                     <InputNumber style={{width: '100%'}} placeholder="-1" />
                   </Form.Item>
                 </div>
               )}
             </>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto px-1">
              {tableInfo?.columns?.map(c => (
                <Form.Item key={c.name} name={c.name} label={c.name} rules={[{ required: c.primaryKey }]}>
                  {c.type.includes('INT') ? <InputNumber style={{width:'100%'}} /> : <Input />}
                </Form.Item>
              ))}
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default DataViewer;
