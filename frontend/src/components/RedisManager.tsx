import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Tag, 
  Button, 
  Space, 
  Spin,
  message,
  Descriptions,
  Modal,
  Form,
  Input,
  InputNumber,
  Select
} from 'antd';
import { 
  DashboardOutlined, 
  DatabaseOutlined, 
  ReloadOutlined,
  ThunderboltOutlined,
  HddOutlined,
  TeamOutlined,
  FieldTimeOutlined,
  PlusOutlined
} from '@ant-design/icons';
import type { ConnectionInfo } from '../types';
import { databaseApi } from '../services/api';
import DataViewer from './DataViewer';

const { Title, Text } = Typography;
const { Option } = Select;

interface RedisManagerProps {
  connection: ConnectionInfo;
  database?: string;
  tableName?: string; // This is the Redis Key
}

const RedisManager: React.FC<RedisManagerProps> = ({ connection, database, tableName }) => {
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<Record<string, string>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!tableName) {
      loadRedisInfo();
    }
  }, [connection.id, database, tableName]);

  const loadRedisInfo = async () => {
    setLoading(true);
    try {
      const res = await databaseApi.executeQuery(connection.id!, {
        connectionId: connection.id!,
        database,
        sql: '__INFO__'
      });
      
      if (res.data.success && res.data.rows && res.data.rows[0]) {
        const infoData = res.data.rows[0].value;
        if (typeof infoData === 'string') {
          const parsedInfo: Record<string, string> = {};
          infoData.split('\n').forEach(line => {
            if (line && line.includes(':')) {
              const [key, value] = line.split(':');
              parsedInfo[key.trim()] = value.trim();
            }
          });
          setInfo(parsedInfo);
        }
      }
    } catch (error) {
      console.error('Failed to load Redis info', error);
    } finally {
      setLoading(false);
    }
  };

  const [keyType, setKeyType] = useState('string');

  const handleAddKey = async (values: any) => {
    try {
      const { type, key, field, score, value, ttl } = values;
      
      let action = 'set';
      if (type === 'hash') action = 'hset';
      else if (type === 'list') action = 'rpush';
      else if (type === 'set') action = 'sadd';
      else if (type === 'zset') action = 'zadd';

      const command = JSON.stringify({
        action,
        key,
        field,
        score,
        value,
        ttl
      });
      
      const res = await databaseApi.executeUpdate(connection.id!, {
        connectionId: connection.id!,
        database,
        sql: command
      });

      if (res.data.success) {
        message.success(`Key "${key}" set successfully`);
        setModalVisible(false);
        form.resetFields();
      } else {
        message.error(res.data.message);
      }
    } catch (error) {
      message.error('Failed to set Redis key');
    }
  };

  if (tableName) {
    return <DataViewer connection={connection} database={database} table={tableName} />;
  }

  return (
    <div className="h-full overflow-auto p-6 bg-gray-50">
      <div className="mb-6 flex justify-between items-center">
        <Space size="middle">
          <div className="p-3 bg-red-50 rounded-xl">
            <DatabaseOutlined className="text-red-500 text-2xl" />
          </div>
          <div>
            <Title level={3} className="m-0">{connection.name}</Title>
            <Space>
              <Tag color="red">REDIS</Tag>
              <Text type="secondary">{connection.host}:{connection.port}</Text>
              {database && <Tag color="blue">{database}</Tag>}
            </Space>
          </div>
        </Space>
        <Space>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => {
              setKeyType('string');
              form.setFieldsValue({ type: 'string' });
              setModalVisible(true);
            }}
            style={{ backgroundColor: '#d82c20', borderColor: '#d82c20' }}
          >
            Add New Key
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadRedisInfo}>Refresh Statistics</Button>
        </Space>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spin size="large" tip="Loading Redis Statistics..." />
        </div>
      ) : (
        <Space direction="vertical" size="large" className="w-full">
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Card bordered={false} className="shadow-sm">
                <Statistic
                  title="Redis Version"
                  value={info.redis_version || 'Unknown'}
                  prefix={<ThunderboltOutlined className="text-yellow-500" />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false} className="shadow-sm">
                <Statistic
                  title="Memory Usage"
                  value={info.used_memory_human || '0'}
                  prefix={<HddOutlined className="text-blue-500" />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false} className="shadow-sm">
                <Statistic
                  title="Connected Clients"
                  value={info.connected_clients || '0'}
                  prefix={<TeamOutlined className="text-green-500" />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false} className="shadow-sm">
                <Statistic
                  title="Uptime"
                  value={info.uptime_in_days ? `${info.uptime_in_days} days` : 'Unknown'}
                  prefix={<FieldTimeOutlined className="text-purple-500" />}
                />
              </Card>
            </Col>
          </Row>

          <Card title={<Space><DashboardOutlined /> Server Information</Space>} bordered={false} className="shadow-sm">
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="OS">{info.os}</Descriptions.Item>
              <Descriptions.Item label="Process ID">{info.process_id}</Descriptions.Item>
              <Descriptions.Item label="Mode">{info.redis_mode}</Descriptions.Item>
              <Descriptions.Item label="TCP Port">{info.tcp_port}</Descriptions.Item>
              <Descriptions.Item label="Role">{info.role}</Descriptions.Item>
              <Descriptions.Item label="Max Memory">{info.maxmemory_human || 'Unlimited'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Space>
      )}

      <Modal
        title="Add New Key"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleAddKey} initialValues={{ type: 'string' }} onValuesChange={(changedValues) => {
          if (changedValues.type) {
            setKeyType(changedValues.type);
          }
        }}>
          <Form.Item name="type" label="Key Type" rules={[{ required: true }]}>
            <Select>
              <Option value="string">String</Option>
              <Option value="hash">Hash</Option>
              <Option value="list">List</Option>
              <Option value="set">Set</Option>
              <Option value="zset">ZSet</Option>
            </Select>
          </Form.Item>
          <Form.Item name="key" label="Key Name" rules={[{ required: true, message: 'Please input key name' }]}>
            <Input placeholder="e.g. user:100:name" />
          </Form.Item>
          
          {keyType === 'hash' && (
            <Form.Item name="field" label="Field" rules={[{ required: true, message: 'Please input hash field' }]}>
              <Input placeholder="Field name" />
            </Form.Item>
          )}

          {keyType === 'zset' && (
            <Form.Item name="score" label="Score" rules={[{ required: true, message: 'Please input score' }]}>
              <InputNumber style={{ width: '100%' }} placeholder="Score" />
            </Form.Item>
          )}

          <Form.Item name="value" label="Value" rules={[{ required: true, message: 'Please input value' }]}>
            <Input.TextArea rows={4} placeholder="Key value content" />
          </Form.Item>
          
          <Form.Item name="ttl" label="TTL (Seconds, optional)">
            <InputNumber min={-1} style={{ width: '100%' }} placeholder="-1 for no expiration" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RedisManager;
