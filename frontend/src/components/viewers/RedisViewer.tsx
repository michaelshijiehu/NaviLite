import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Card, Tag, Space, Descriptions, Divider, Button, 
  Popconfirm, Empty, Typography, Tooltip, Input, InputNumber, 
  message, Spin, Select 
} from 'antd';
import { 
  EditOutlined, DeleteOutlined, PlusOutlined, ClockCircleOutlined, 
  SettingOutlined, SaveOutlined, ReloadOutlined, SearchOutlined 
} from '@ant-design/icons';
import type { QueryResult, ConnectionInfo } from '../../types';
import { databaseApi } from '../../services/api';

const { Text, Title } = Typography;
const { Option } = Select;

interface RedisViewerProps {
  connection: ConnectionInfo;
  database: string;
  table: string; // The redis key
  onReload: () => void;
  onKeyDeleted: () => void;
  onKeyRenamed: (newKey: string) => void;
}

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const RedisViewer: React.FC<RedisViewerProps> = ({ connection, database, table, onReload, onKeyDeleted, onKeyRenamed }) => {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Editor State
  const [editValue, setEditValue] = useState('');
  const [editTtl, setEditTtl] = useState<number | null>(null);
  const [renameKey, setRenameKey] = useState(table);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadKeyData();
  }, [connection.id, database, table]);

  const loadKeyData = async () => {
    setLoading(true);
    try {
      const res = await databaseApi.executeQuery(connection.id!, { 
        connectionId: connection.id!, 
        database, 
        sql: table 
      });
      setResult(res.data);
      if (res.data?.rows?.[0]) {
        const { value, ttl } = res.data.rows[0];
        setEditValue(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
        setEditTtl(ttl);
        setRenameKey(table);
      }
    } catch (e) {
      message.error("Failed to load key data");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result?.rows?.[0]) return;
    const { type } = result.rows[0];
    
    setSaving(true);
    try {
      // 1. Rename if changed
      if (renameKey !== table && renameKey.trim() !== '') {
        await databaseApi.executeUpdate(connection.id!, {
          connectionId: connection.id!,
          database,
          sql: JSON.stringify({ action: 'rename', key: table, newKey: renameKey })
        });
        message.success('Key renamed');
        onKeyRenamed(renameKey);
        return; // onKeyRenamed will trigger a reload from parent
      }

      // 2. Save Value (Only for String) and TTL
      if (type === 'string') {
        await databaseApi.executeUpdate(connection.id!, {
          connectionId: connection.id!,
          database,
          sql: JSON.stringify({ action: 'set', key: table, value: editValue, ttl: editTtl })
        });
        message.success('Saved successfully');
      } else {
        // Just update TTL for complex types
        await databaseApi.executeUpdate(connection.id!, {
          connectionId: connection.id!,
          database,
          sql: JSON.stringify({ action: 'set', key: table, value: 'DUMMY_NOT_USED', ttl: editTtl }) // Backend ignores value if we are just calling expire
        });
        message.success('TTL updated');
      }
      loadKeyData();
    } catch (e) {
      message.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteElement = async (type: string, record: any) => {
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
       loadKeyData();
    } catch(e) { message.error('Delete failed'); }
  };

  const handleDeleteKey = async () => {
    try {
      await databaseApi.executeUpdate(connection.id!, {
        connectionId: connection.id!,
        database,
        sql: JSON.stringify({ action: 'del', key: table })
      });
      message.success('Key deleted');
      onKeyDeleted();
    } catch (e) {
      message.error('Delete failed');
    }
  };

  if (loading && !result) {
    return <div className="p-10 flex justify-center"><Spin size="large" /></div>;
  }

  if (!result?.rows?.[0]) {
    return <Empty className="mt-20" description="Key not found or expired" />;
  }

  const { type, value, ttl, memory } = result.rows[0];
  const isComplex = type !== 'string';

  let dataSource: any[] = [];
  let columns: any[] = [];

  if (isComplex && typeof value === 'object' && value !== null) {
    if (type === 'hash') {
       dataSource = Object.entries(value).map(([k, v]) => ({ field: k, value: String(v) }));
       columns = [{ title: 'Field', dataIndex: 'field', key: 'field', width: '30%' }, { title: 'Value', dataIndex: 'value', key: 'value' }];
    } else if (type === 'list') {
       dataSource = (value as any[]).map((v, i) => ({ index: i, value: String(v) }));
       columns = [{ title: 'Index', dataIndex: 'index', key: 'index', width: '100px' }, { title: 'Value', dataIndex: 'value', key: 'value' }];
    } else if (type === 'set') {
       dataSource = (value as any[]).map(v => ({ value: String(v) }));
       columns = [{ title: 'Value', dataIndex: 'value', key: 'value' }];
    } else if (type === 'zset') {
       dataSource = (value as any[]).map(v => ({ score: v.score, value: String(v.value) }));
       columns = [{ title: 'Score', dataIndex: 'score', key: 'score', width: '120px' }, { title: 'Value', dataIndex: 'value', key: 'value' }];
    }

    columns.push({
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Popconfirm title="Remove element?" onConfirm={() => handleDeleteElement(type as string, record)}>
          <Button type="link" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    });
  }

  // Local Search Filter
  const filteredDataSource = dataSource.filter(item => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return Object.values(item).some(val => String(val).toLowerCase().includes(s));
  });

  return (
    <div className="h-full flex flex-col bg-[#f0f2f5]">
      {/* Top Header - RDM Style */}
      <div className="bg-white p-4 border-b border-gray-200 flex flex-col gap-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
             <Tag color="red" className="m-0 text-sm font-bold uppercase">{type}</Tag>
             <Input 
                value={renameKey} 
                onChange={e => setRenameKey(e.target.value)} 
                className="font-bold text-lg border-transparent hover:border-gray-300 focus:border-purple-500 max-w-md"
                style={{ padding: '0 8px', height: '32px' }}
             />
          </div>
          <Space>
             <Button icon={<ReloadOutlined />} onClick={loadKeyData} loading={loading}>Refresh</Button>
             <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>Save Changes</Button>
             <Popconfirm title="Are you sure you want to delete this key?" onConfirm={handleDeleteKey}>
               <Button danger icon={<DeleteOutlined />}>Delete</Button>
             </Popconfirm>
          </Space>
        </div>

        <div className="flex gap-8 text-sm">
           <div className="flex items-center gap-2">
             <Text type="secondary">Size:</Text>
             <Text strong>{memory ? formatBytes(memory) : 'Unknown'}</Text>
           </div>
           <div className="flex items-center gap-2">
             <Text type="secondary">TTL (s):</Text>
             <InputNumber 
                size="small" 
                value={editTtl} 
                onChange={setEditTtl} 
                className="w-24"
                placeholder="-1"
             />
             <Tooltip title="Set to -1 to persist (remove expiration)">
               <ClockCircleOutlined className="text-gray-400" />
             </Tooltip>
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        {!isComplex ? (
           <Card size="small" className="flex-1 flex flex-col border-none shadow-sm" bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 0 }}>
             <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
               <Text strong className="text-gray-600">Value</Text>
               <Select defaultValue="text" size="small" style={{ width: 120 }} bordered={false}>
                  <Option value="text">Plain Text</Option>
                  <Option value="json">JSON</Option>
               </Select>
             </div>
             <Input.TextArea 
               value={editValue} 
               onChange={e => setEditValue(e.target.value)}
               className="flex-1 border-none resize-none font-mono text-sm p-4 focus:shadow-none"
               style={{ borderRadius: 0, boxShadow: 'none' }}
             />
           </Card>
        ) : (
           <Card size="small" className="flex-1 flex flex-col border-none shadow-sm" bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 0 }}>
             <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
               <Input 
                 placeholder="Filter elements..." 
                 prefix={<SearchOutlined className="text-gray-400" />} 
                 value={searchText}
                 onChange={e => setSearchText(e.target.value)}
                 className="max-w-xs"
                 allowClear
               />
               <Button type="dashed" icon={<PlusOutlined />} onClick={() => message.info('Please use DataViewer Modal for now')}>Add Element</Button>
             </div>
             <div className="flex-1 overflow-auto">
               <Table 
                 dataSource={filteredDataSource} 
                 columns={columns} 
                 rowKey={(r) => r.field || r.index || r.value} 
                 size="small"
                 pagination={{ pageSize: 100, size: 'small', showTotal: (t) => `Total ${t} elements` }}
                 className="navilite-query-table"
                 scroll={{ y: 'calc(100vh - 350px)' }}
               />
             </div>
           </Card>
        )}
      </div>
    </div>
  );
};

export default RedisViewer;
