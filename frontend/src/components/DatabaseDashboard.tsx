import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Tag, 
  Space, 
  Spin,
  Button,
  Descriptions
} from 'antd';
import { 
  DashboardOutlined, 
  DatabaseOutlined, 
  ReloadOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  HddOutlined,
  FieldTimeOutlined
} from '@ant-design/icons';
import type { ConnectionInfo } from '../types';
import { databaseApi } from '../services/api';
import DataViewer from './DataViewer';

const { Title, Text } = Typography;

interface DatabaseDashboardProps {
  connection: ConnectionInfo;
  database?: string;
}

const DatabaseDashboard: React.FC<DatabaseDashboardProps> = ({ connection, database }) => {
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<Record<string, any>>({});

  useEffect(() => {
    loadInfo();
  }, [connection.id, database]);

  const loadInfo = async () => {
    setLoading(true);
    setInfo({}); // Reset previous info
    try {
      let version = 'Unknown';
      let connections = 0;
      let uptime: any = 'Unknown';
      let memory: any = 'Unknown';

      if (connection.type === 'MONGODB') {
        const res = await databaseApi.executeQuery(connection.id!, {
          connectionId: connection.id!,
          database,
          sql: '__INFO__'
        });
        if (res.data.success && res.data.rows && res.data.rows[0]) {
          const data = res.data.rows[0];
          version = data.version;
          uptime = `${Math.floor(data.uptime / 3600)}h ${Math.floor((data.uptime % 3600) / 60)}m`;
          connections = data.current_connections;
          memory = `${data.resident_memory_mb} MB`;
        }
      } else if (connection.type === 'MYSQL') {
        const resVersion = await databaseApi.executeQuery(connection.id!, {
          connectionId: connection.id!,
          database,
          sql: 'SELECT VERSION() as version'
        });
        if (resVersion.data.success && resVersion.data.rows?.length) {
          version = resVersion.data.rows[0].version;
        }

        const resStatus = await databaseApi.executeQuery(connection.id!, {
          connectionId: connection.id!,
          database,
          sql: 'SHOW GLOBAL STATUS LIKE "Threads_connected"'
        });
        if (resStatus.data.success && resStatus.data.rows?.length) {
          connections = parseInt(resStatus.data.rows[0].Value || '0', 10);
        }
        
        const resUptime = await databaseApi.executeQuery(connection.id!, {
          connectionId: connection.id!,
          database,
          sql: 'SHOW GLOBAL STATUS LIKE "Uptime"'
        });
        if (resUptime.data.success && resUptime.data.rows?.length) {
          const upSec = parseInt(resUptime.data.rows[0].Value || '0', 10);
          uptime = `${Math.floor(upSec / 3600)}h ${Math.floor((upSec % 3600) / 60)}m`;
        }
      } else if (connection.type === 'POSTGRESQL') {
        const resVersion = await databaseApi.executeQuery(connection.id!, {
          connectionId: connection.id!,
          database,
          sql: 'SELECT version()'
        });
        if (resVersion.data.success && resVersion.data.rows?.length) {
          // PostgreSQL version() returns a long string, let's extract the version number
          const fullVersion = resVersion.data.rows[0].version || '';
          version = fullVersion.split(' ')[1] || fullVersion;
        }
        
        const resConn = await databaseApi.executeQuery(connection.id!, {
          connectionId: connection.id!,
          database,
          sql: 'SELECT sum(numbackends) as connections FROM pg_stat_database'
        });
        if (resConn.data.success && resConn.data.rows?.length) {
          connections = resConn.data.rows[0].connections;
        }
      } else if (connection.type === 'SQLITE') {
        const resVersion = await databaseApi.executeQuery(connection.id!, {
          connectionId: connection.id!,
          database,
          sql: 'SELECT sqlite_version() as version'
        });
        if (resVersion.data.success && resVersion.data.rows?.length) {
          version = resVersion.data.rows[0].version;
        }
        connections = 1; // SQLite is an embedded DB, usually single connection per process
        uptime = 'N/A';
      }

      setInfo({ version, connections, uptime, memory });
    } catch (error) {
      console.error(`Failed to load ${connection.type} info`, error);
    } finally {
      setLoading(false);
    }
  };

  const getThemeColor = () => {
    switch (connection.type) {
      case 'MONGODB': return { bg: 'bg-green-50', text: 'text-green-500', tag: 'green' };
      case 'MYSQL': return { bg: 'bg-blue-50', text: 'text-blue-500', tag: 'blue' };
      case 'POSTGRESQL': return { bg: 'bg-indigo-50', text: 'text-indigo-500', tag: 'geekblue' };
      case 'SQLITE': return { bg: 'bg-gray-100', text: 'text-gray-600', tag: 'default' };
      default: return { bg: 'bg-gray-50', text: 'text-gray-500', tag: 'default' };
    }
  };

  const theme = getThemeColor();

  return (
    <div className="h-full overflow-auto p-6 bg-gray-50">
      <div className="mb-6 flex justify-between items-center">
        <Space size="middle">
          <div className={`p-3 rounded-xl ${theme.bg}`}>
            <DatabaseOutlined className={`${theme.text} text-2xl`} />
          </div>
          <div>
            <Title level={3} className="m-0">{connection.name}</Title>
            <Space>
              <Tag color={theme.tag}>{connection.type}</Tag>
              {connection.type !== 'SQLITE' && (
                <Text type="secondary">{connection.host}:{connection.port}</Text>
              )}
              {database && <Tag color="blue">{database}</Tag>}
            </Space>
          </div>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={loadInfo}>Refresh Statistics</Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spin size="large" tip={`Loading ${connection.type} Statistics...`} />
        </div>
      ) : (
        <Space direction="vertical" size="large" className="w-full">
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Card bordered={false} className="shadow-sm">
                <Statistic
                  title="Database Version"
                  value={info.version || 'Unknown'}
                  prefix={<ThunderboltOutlined className="text-yellow-500" />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false} className="shadow-sm">
                <Statistic
                  title="Active Connections"
                  value={info.connections || '0'}
                  prefix={<TeamOutlined className="text-green-500" />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false} className="shadow-sm">
                <Statistic
                  title="Uptime"
                  value={info.uptime || 'N/A'}
                  prefix={<FieldTimeOutlined className="text-purple-500" />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false} className="shadow-sm">
                <Statistic
                  title="Memory Usage"
                  value={info.memory || 'N/A'}
                  prefix={<HddOutlined className="text-blue-500" />}
                />
              </Card>
            </Col>
          </Row>

          <Card title={<Space><DashboardOutlined /> Instance Information</Space>} bordered={false} className="shadow-sm">
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Connection Name">{connection.name}</Descriptions.Item>
              <Descriptions.Item label="Database Type">{connection.type}</Descriptions.Item>
              <Descriptions.Item label="Host">{connection.host || 'Local'}</Descriptions.Item>
              <Descriptions.Item label="Port">{connection.port || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Username">{connection.username || 'None'}</Descriptions.Item>
              <Descriptions.Item label="Default Database">{connection.database || 'None'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Space>
      )}
    </div>
  );
};

export default DatabaseDashboard;
