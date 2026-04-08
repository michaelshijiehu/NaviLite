import React, { useState, useEffect } from 'react';
import { Layout, Button, Modal, message, Tree, Typography, Empty, theme, ConfigProvider } from 'antd';
import {
  DatabaseOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  TableOutlined,
  SettingOutlined,
  FolderOpenOutlined,
  CaretRightOutlined,
  CaretDownOutlined,
  ConsoleSqlOutlined,
  CloudServerOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import './App.css';
import { connectionApi, databaseApi } from './services/api';
import type { ConnectionInfo, TableInfo, DatabaseType } from './types';
import ConnectionForm from './components/ConnectionForm';
import SqlEditor from './components/SqlEditor';
import DataViewer from './components/DataViewer';
import TableStructure from './components/TableStructure';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const getDbIcon = (type: DatabaseType) => {
  switch (type) {
    case 'MYSQL': return <DatabaseOutlined style={{ color: '#00758f' }} />;
    case 'POSTGRESQL': return <DatabaseOutlined style={{ color: '#336791' }} />;
    case 'MONGODB': return <DatabaseOutlined style={{ color: '#4db33d' }} />;
    case 'REDIS': return <DatabaseOutlined style={{ color: '#d82c20' }} />;
    case 'SQLITE': return <DatabaseOutlined style={{ color: '#003b57' }} />;
    default: return <DatabaseOutlined />;
  }
};

interface TreeDataItem extends DataNode {
  key: string;
  type: 'connection' | 'database' | 'table' | 'loading';
  connectionId?: string;
  databaseName?: string;
  tableName?: string;
}

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [treeData, setTreeData] = useState<TreeDataItem[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeDataItem | null>(null);
  const [activeTab, setActiveTab] = useState<'sql' | 'data' | 'structure'>('sql');
  const [connectionModalVisible, setConnectionModalVisible] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionInfo | null>(null);
  const [loadedDatabases, setLoadedDatabases] = useState<Set<string>>(new Set());
  const [loadedTables, setLoadedTables] = useState<Set<string>>(new Set());

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const res = await connectionApi.getAll();
      setConnections(res.data);
      buildTreeData(res.data);
    } catch (error) {
      console.error('Failed to load connections:', error);
    }
  };

  const buildTreeData = (conns: ConnectionInfo[]) => {
    const data: TreeDataItem[] = conns.map(conn => ({
      key: `conn-${conn.id}`,
      title: (
        <div className="flex items-center justify-between w-full tree-node-wrapper group">
          <span className="flex-1 font-medium truncate">{conn.name}</span>
          <div className="tree-node-actions opacity-0 group-hover:opacity-100 flex gap-1 ml-2 transition-opacity duration-200">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined className="text-gray-400 hover:text-white" />}
              onClick={(e) => {
                e.stopPropagation();
                setEditingConnection(conn);
                setConnectionModalVisible(true);
              }}
              className="p-0 h-6 w-6 flex items-center justify-center rounded-sm hover:bg-white/10"
            />
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined className="text-red-400 hover:text-red-300" />}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteConnection(conn.id!);
              }}
              className="p-0 h-6 w-6 flex items-center justify-center rounded-sm hover:bg-white/10"
            />
          </div>
        </div>
      ),
      type: 'connection',
      connectionId: conn.id,
      icon: getDbIcon(conn.type),
      isLeaf: false,
      switcherIcon: ({ expanded }) => expanded ? <CaretDownOutlined className="text-gray-500" /> : <CaretRightOutlined className="text-gray-500" />,
      children: [{
        key: `loading-${conn.id}`,
        title: <span className="text-gray-500 italic text-xs">Loading...</span>,
        type: 'loading',
        isLeaf: true,
      }],
    }));
    setTreeData(data);
  };

  const loadDatabases = async (connectionId: string) => {
    const cacheKey = `db-${connectionId}`;
    if (loadedDatabases.has(cacheKey)) return;

    try {
      const res = await connectionApi.getDatabases(connectionId);
      const databases = res.data;

      setTreeData(prevTreeData => {
        const newTreeData = [...prevTreeData];
        const connIndex = newTreeData.findIndex(n => n.connectionId === connectionId);
        if (connIndex !== -1) {
          newTreeData[connIndex].children = databases.map(db => ({
            key: `db-${connectionId}-${db}`,
            title: <span className="text-gray-300">{db}</span>,
            type: 'database',
            connectionId,
            databaseName: db,
            icon: <FolderOpenOutlined style={{ color: '#eab308' }} />,
            isLeaf: false,
            switcherIcon: ({ expanded }) => expanded ? <CaretDownOutlined className="text-gray-500" /> : <CaretRightOutlined className="text-gray-500" />,
            children: [{
              key: `loading-tables-${connectionId}-${db}`,
              title: <span className="text-gray-500 italic text-xs">Loading...</span>,
              type: 'loading',
              isLeaf: true,
            }],
          }));
        }
        return newTreeData;
      });
      setLoadedDatabases(prev => new Set([...prev, cacheKey]));
    } catch (error) {
      console.error('Failed to load databases:', error);
      message.error('Failed to load databases');
    }
  };

  const loadTables = async (connectionId: string, databaseName: string) => {
    const cacheKey = `tables-${connectionId}-${databaseName}`;
    if (loadedTables.has(cacheKey)) return;

    try {
      const res = await databaseApi.getTables(connectionId, databaseName);
      const tables = res.data;

      setTreeData(prevTreeData => {
        const newTreeData = [...prevTreeData];
        const connNode = newTreeData.find(n => n.connectionId === connectionId);
        if (connNode?.children) {
          const dbNode = connNode.children.find(n => n.databaseName === databaseName);
          if (dbNode) {
            dbNode.children = tables.map(table => ({
              key: `table-${connectionId}-${databaseName}-${table.name}`,
              title: <span className="text-gray-300">{table.name}</span>,
              type: 'table',
              connectionId,
              databaseName,
              tableName: table.name,
              icon: <TableOutlined style={{ color: '#3b82f6' }} />,
              isLeaf: true,
            }));
          }
        }
        return newTreeData;
      });
      setLoadedTables(prev => new Set([...prev, cacheKey]));
    } catch (error) {
      console.error('Failed to load tables:', error);
      message.error('Failed to load tables');
    }
  };

  const handleTreeExpand = (keys: React.Key[], info: any) => {
    setExpandedKeys(keys);
    const node = info.node as TreeDataItem;
    if (node.type === 'connection' && node.connectionId) {
      loadDatabases(node.connectionId);
    } else if (node.type === 'database' && node.connectionId && node.databaseName) {
      loadTables(node.connectionId, node.databaseName);
    }
  };

  const handleTreeSelect = (keys: React.Key[], info: any) => {
    setSelectedKeys(keys);
    if (keys.length > 0) {
      const node = info.node as TreeDataItem;
      setSelectedNode(node);
      if (node.type === 'table') {
        setActiveTab('data');
      } else {
        setActiveTab('sql');
      }
    }
  };

  const handleDeleteConnection = async (id: string) => {
    Modal.confirm({
      title: 'Delete Connection',
      content: 'Are you sure you want to delete this connection?',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await connectionApi.delete(id);
          message.success('Connection deleted');
          loadConnections();
          if (selectedNode?.connectionId === id) {
            setSelectedNode(null);
          }
        } catch (error) {
          message.error('Failed to delete connection');
        }
      }
    });
  };

  const handleSaveConnection = async (data: ConnectionInfo) => {
    try {
      if (editingConnection) {
        await connectionApi.update(editingConnection.id!, data);
      } else {
        await connectionApi.create(data);
      }
      message.success('Connection saved');
      setConnectionModalVisible(false);
      setEditingConnection(null);
      loadConnections();
      // Force refresh of loaded status if editing
      if (editingConnection) {
        setLoadedDatabases(new Set());
        setLoadedTables(new Set());
      }
    } catch (error) {
      message.error('Failed to save connection');
    }
  };

  const getCurrentConnection = () => {
    if (!selectedNode?.connectionId) return null;
    return connections.find(c => c.id === selectedNode.connectionId);
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#7C3AED',
          colorPrimaryHover: '#6D28D9',
          colorPrimaryActive: '#5B21B6',
          borderRadius: 4,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
        components: {
          Layout: {
            siderBg: '#2C2C2C',
          },
          Button: {
            controlHeight: 32,
            borderRadius: 4,
          },
          Tree: {
            bg: 'transparent',
            colorText: '#d1d5db',
            nodeHoverColor: 'rgba(255, 255, 255, 0.08)',
            nodeSelectedColor: 'rgba(124, 58, 237, 0.25)',
          }
        },
      }}
    >
      <Layout style={{ height: '100vh', background: '#f0f2f5' }}>
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={280}
          style={{
            background: '#2C2C2C',
            borderRight: '1px solid #1a1a1a',
            overflow: 'auto',
          }}
        >
          <div className="p-3 flex items-center justify-between border-b border-[#1a1a1a] mb-2 bg-[#252525]">
            <Title level={5} className="text-gray-100 m-0 flex items-center gap-2">
              <CloudServerOutlined style={{ color: '#7C3AED' }} />
              NaviLite
            </Title>
            <Button 
              type="text" 
              size="small" 
              icon={<ReloadOutlined className="text-gray-400" />} 
              onClick={loadConnections}
              title="Refresh All"
            />
          </div>
          <div className="px-3 mb-3">
            <Button
              type="primary"
              block
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingConnection(null);
                setConnectionModalVisible(true);
              }}
              style={{ background: '#7C3AED', border: 'none' }}
            >
              New Connection
            </Button>
          </div>
          <div className="connection-tree-container">
            <Tree
              showIcon
              treeData={treeData}
              expandedKeys={expandedKeys}
              selectedKeys={selectedKeys}
              onExpand={handleTreeExpand}
              onSelect={handleTreeSelect}
              blockNode
              height="calc(100vh - 135px)"
              virtual={false}
              switcherIcon={<CaretRightOutlined />}
              className="navicat-tree"
            />
          </div>
        </Sider>
        <Layout>
          <Header
            style={{
              padding: '0 16px',
              background: '#fff',
              borderBottom: '1px solid #dcdfe6',
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div className="flex items-center gap-1">
              {selectedNode && (
                <div className="flex bg-[#f4f4f5] p-1 rounded-sm gap-1">
                  <Button
                    size="small"
                    className={`nav-tab-button ${activeTab === 'sql' ? 'active' : ''}`}
                    type={activeTab === 'sql' ? 'primary' : 'text'}
                    icon={<ConsoleSqlOutlined />}
                    onClick={() => setActiveTab('sql')}
                  >
                    SQL Editor
                  </Button>
                  {selectedNode.type === 'table' && (
                    <>
                      <Button
                        size="small"
                        className={`nav-tab-button ${activeTab === 'data' ? 'active' : ''}`}
                        type={activeTab === 'data' ? 'primary' : 'text'}
                        icon={<TableOutlined />}
                        onClick={() => setActiveTab('data')}
                      >
                        {getCurrentConnection()?.type === 'REDIS' ? 'Value' : 
                         getCurrentConnection()?.type === 'MONGODB' ? 'Documents' : 'Data'}
                      </Button>
                      {/* Structure tab only for SQL databases */}
                      {!['MONGODB', 'REDIS'].includes(getCurrentConnection()?.type || '') && (
                        <Button
                          size="small"
                          className={`nav-tab-button ${activeTab === 'structure' ? 'active' : ''}`}
                          type={activeTab === 'structure' ? 'primary' : 'text'}
                          icon={<SettingOutlined />}
                          onClick={() => setActiveTab('structure')}
                        >
                          Structure
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </Header>
          <Content
            style={{
              padding: 0,
              minHeight: 280,
              background: '#fff',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {!selectedNode ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-[#fafafa]">
                <DatabaseOutlined style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.2 }} />
                <Text type="secondary" style={{ fontSize: '16px' }}>Select a connection or table to start</Text>
              </div>
            ) : activeTab === 'sql' ? (
              <SqlEditor
                connection={getCurrentConnection()!}
                database={selectedNode.databaseName}
              />
            ) : activeTab === 'data' && selectedNode.type === 'table' ? (
              <DataViewer
                connection={getCurrentConnection()!}
                database={selectedNode.databaseName!}
                table={selectedNode.tableName!}
              />
            ) : activeTab === 'structure' && selectedNode.type === 'table' ? (
              <TableStructure
                connection={getCurrentConnection()!}
                database={selectedNode.databaseName!}
                table={selectedNode.tableName!}
              />
            ) : (
              <div className="p-10">
                <Empty description="Select a table to view data or structure" />
              </div>
            )}
          </Content>
        </Layout>

        <Modal
          title={editingConnection ? 'Edit Connection' : 'New Connection'}
          open={connectionModalVisible}
          onCancel={() => {
            setConnectionModalVisible(false);
            setEditingConnection(null);
          }}
          footer={null}
          width={600}
          centered
          destroyOnClose
        >
          <ConnectionForm
            initialValues={editingConnection}
            onSave={handleSaveConnection}
          />
        </Modal>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
