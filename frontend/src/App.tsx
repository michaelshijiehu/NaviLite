import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layout, Button, Modal, message, Tree, Typography, Empty, theme, ConfigProvider, Tooltip, Dropdown, Menu } from 'antd';
import {
  DatabaseOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  TableOutlined,
  SettingOutlined,
  FolderOpenOutlined,
  CaretRightOutlined,
  CaretDownOutlined,
  ConsoleSqlOutlined,
  CloudServerOutlined,
  ReloadOutlined,
  DashboardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DisconnectOutlined,
  LinkOutlined,
  FolderOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import './App.css';
import { connectionApi, databaseApi } from './services/api';
import type { ConnectionInfo, TableInfo, DatabaseType } from './types';
import ConnectionForm from './components/ConnectionForm';
import SqlEditor from './components/SqlEditor';
import DataViewer from './components/DataViewer';
import TableStructure from './components/TableStructure';
import RedisManager from './components/RedisManager';
import DatabaseDashboard from './components/DatabaseDashboard';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const getDbIcon = (type: DatabaseType, isConnected: boolean) => {
  if (!isConnected) return <DatabaseOutlined style={{ color: '#858585' }} />;
  const color = {
    'MYSQL': '#00d1ff',
    'POSTGRESQL': '#71b7ff',
    'MONGODB': '#52c41a',
    'REDIS': '#ff4d4f',
    'SQLITE': '#ffffff'
  }[type] || '#ffffff';
  return <DatabaseOutlined style={{ color }} />;
};

// 数据库图标逻辑：打开为绿色，关闭为灰色
const getDatabaseIcon = (isOpen: boolean) => {
  return <DatabaseOutlined style={{ color: isOpen ? '#52c41a' : '#858585' }} />;
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
  const [siderWidth, setSiderWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [treeData, setTreeData] = useState<TreeDataItem[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeDataItem | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sql' | 'data' | 'structure'>('dashboard');
  const [connectionModalVisible, setConnectionModalVisible] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionInfo | null>(null);
  
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [openDatabaseKeys, setOpenDatabaseKeys] = useState<Set<string>>(new Set()); // 格式: "connId:dbName"
  const [loadedTables, setLoadedTables] = useState<Set<string>>(new Set());

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth > 150 && newWidth < 600) setSiderWidth(newWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const res = await connectionApi.getAll();
      setConnections(res.data);
      buildInitialTree(res.data);
    } catch (error) { console.error('Failed to load connections:', error); }
  };

  const buildConnectionTitle = (conn: ConnectionInfo, isConnected: boolean) => (
    <div className="flex items-center justify-between w-full tree-node-wrapper group">
      <span style={{ color: isConnected ? '#ffffff' : '#cccccc', fontWeight: isConnected ? 'bold' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {conn.name}
      </span>
      <div className="tree-node-actions opacity-0 group-hover:opacity-100 flex gap-1 ml-2 transition-opacity duration-200">
        {isConnected ? (
          <Tooltip title="Disconnect"><Button type="text" size="small" icon={<DisconnectOutlined style={{ color: '#ff9c6e' }} />} onClick={(e) => { e.stopPropagation(); handleDisconnect(conn.id!); }} className="p-0 h-6 w-6 flex items-center justify-center rounded-sm hover:bg-white/10" /></Tooltip>
        ) : (
          <Tooltip title="Connect"><Button type="text" size="small" icon={<LinkOutlined style={{ color: '#b7eb8f' }} />} onClick={(e) => { e.stopPropagation(); handleConnect(conn.id!); }} className="p-0 h-6 w-6 flex items-center justify-center rounded-sm hover:bg-white/10" /></Tooltip>
        )}
        <Button type="text" size="small" icon={<EditOutlined style={{ color: '#8c8c8c' }} />} onClick={(e) => { e.stopPropagation(); setEditingConnection(conn); setConnectionModalVisible(true); }} className="p-0 h-6 w-6 flex items-center justify-center rounded-sm hover:bg-white/10" />
        <Button type="text" size="small" icon={<DeleteOutlined style={{ color: '#ff7875' }} />} onClick={(e) => { e.stopPropagation(); handleDeleteConnection(conn.id!); }} className="p-0 h-6 w-6 flex items-center justify-center rounded-sm hover:bg-white/10" />
      </div>
    </div>
  );

  const buildInitialTree = (conns: ConnectionInfo[]) => {
    const data: TreeDataItem[] = conns.map(conn => ({
      key: `conn-${conn.id}`,
      title: buildConnectionTitle(conn, false),
      type: 'connection',
      connectionId: conn.id,
      icon: getDbIcon(conn.type, false),
      isLeaf: false,
      switcherIcon: ({ expanded }) => expanded ? <CaretDownOutlined className="text-gray-500" /> : <CaretRightOutlined className="text-gray-500" />,
      children: [], 
    }));
    setTreeData(data);
  };

  const handleConnect = async (connectionId: string) => {
    if (connectedIds.has(connectionId)) return;
    message.loading({ content: 'Connecting...', key: 'conn-loading' });
    try {
      const conn = connections.find(c => c.id === connectionId);
      if (!conn) return;
      const res = await connectionApi.getDatabases(connectionId);
      const databases = res.data;
      setTreeData(prev => prev.map(node => {
        if (node.connectionId === connectionId) {
          return {
            ...node,
            title: buildConnectionTitle(conn, true),
            icon: getDbIcon(conn.type, true),
            children: databases.map(db => ({
              key: `db-${connectionId}-${db}`,
              title: <span style={{ color: '#e5e5e5' }}>{db}</span>,
              type: 'database',
              connectionId,
              databaseName: db,
              icon: getDatabaseIcon(false),
              isLeaf: false,
              switcherIcon: ({ expanded }) => expanded ? <CaretDownOutlined className="text-gray-500" /> : <CaretRightOutlined className="text-gray-500" />,
              children: [], 
            }))
          };
        }
        return node;
      }));
      setConnectedIds(prev => new Set([...prev, connectionId]));
      setExpandedKeys(prev => Array.from(new Set([...prev, `conn-${connectionId}`])));
      message.success({ content: 'Connected successfully', key: 'conn-loading' });
    } catch (error) { message.error({ content: 'Connection failed', key: 'conn-loading' }); }
  };

  const handleDisconnect = (connectionId: string) => {
    const conn = connections.find(c => c.id === connectionId);
    if (!conn) return;
    setConnectedIds(prev => { const next = new Set(prev); next.delete(connectionId); return next; });
    setOpenDatabaseKeys(prev => {
      const next = new Set(prev);
      Array.from(next).forEach(k => { if (k.startsWith(`${connectionId}:`)) next.delete(k); });
      return next;
    });
    setTreeData(prev => prev.map(node => {
      if (node.connectionId === connectionId) return { ...node, title: buildConnectionTitle(conn, false), icon: getDbIcon(conn.type, false), children: [] };
      return node;
    }));
    if (selectedNode?.connectionId === connectionId) { setSelectedNode(null); setSelectedKeys([]); }
    message.info('Disconnected');
  };

  const handleOpenDatabase = async (connectionId: string, databaseName: string) => {
    const dbKey = `${connectionId}:${databaseName}`;
    if (openDatabaseKeys.has(dbKey)) return;

    message.loading({ content: `Opening ${databaseName}...`, key: 'db-loading' });
    try {
      const res = await databaseApi.getTables(connectionId, databaseName);
      const tables = res.data;

      setTreeData(prev => prev.map(connNode => {
        if (connNode.connectionId === connectionId && connNode.children) {
          return {
            ...connNode,
            children: connNode.children.map(dbNode => {
              if (dbNode.databaseName === databaseName) {
                return {
                  ...dbNode,
                  icon: getDatabaseIcon(true),
                  title: <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{databaseName}</span>,
                  children: tables.map(table => ({
                    key: `table-${connectionId}-${databaseName}-${table.name}`,
                    title: <span style={{ color: '#ffffff' }}>{table.name}</span>,
                    type: 'table',
                    connectionId,
                    databaseName,
                    tableName: table.name,
                    icon: <TableOutlined style={{ color: '#3b82f6' }} />,
                    isLeaf: true,
                  }))
                };
              }
              return dbNode;
            })
          };
        }
        return connNode;
      }));

      setOpenDatabaseKeys(prev => new Set([...prev, dbKey]));
      setExpandedKeys(prev => Array.from(new Set([...prev, `db-${connectionId}-${databaseName}`])));
      message.success({ content: `${databaseName} opened`, key: 'db-loading' });
    } catch (error) { message.error({ content: 'Failed to open database', key: 'db-loading' }); }
  };

  const handleCloseDatabase = (connectionId: string, databaseName: string) => {
    const dbKey = `${connectionId}:${databaseName}`;
    setOpenDatabaseKeys(prev => { const next = new Set(prev); next.delete(dbKey); return next; });
    setTreeData(prev => prev.map(connNode => {
      if (connNode.connectionId === connectionId && connNode.children) {
        return {
          ...connNode,
          children: connNode.children.map(dbNode => {
            if (dbNode.databaseName === databaseName) return { ...dbNode, icon: getDatabaseIcon(false), title: <span style={{ color: '#e5e5e5' }}>{databaseName}</span>, children: [] };
            return dbNode;
          })
        };
      }
      return connNode;
    }));
    if (selectedNode?.connectionId === connectionId && selectedNode?.databaseName === databaseName && selectedNode?.type !== 'database') {
      setSelectedNode(null);
      setSelectedKeys([]);
    }
    message.info(`${databaseName} closed`);
  };

  const handleTreeExpand = (keys: React.Key[], info: any) => {
    setExpandedKeys(keys);
    const node = info.node as TreeDataItem;
    if (node.type === 'connection' && node.connectionId && !connectedIds.has(node.connectionId)) {
      handleConnect(node.connectionId);
    } else if (node.type === 'database' && node.connectionId && node.databaseName) {
      if (!openDatabaseKeys.has(`${node.connectionId}:${node.databaseName}`)) {
        // Expand can trigger open too, consistent with Navicat
        handleOpenDatabase(node.connectionId, node.databaseName);
      }
    }
  };

  const handleTreeSelect = (keys: React.Key[], info: any) => {
    setSelectedKeys(keys);
    if (keys.length > 0) {
      const node = info.node as TreeDataItem;
      if (node.type === 'connection' && !connectedIds.has(node.connectionId!)) {
        handleConnect(node.connectionId!);
        return;
      }
      setSelectedNode(node);
      const conn = connections.find(c => c.id === node.connectionId);
      if (node.type === 'table' || conn?.type === 'REDIS') {
        setActiveTab('data');
      } else { setActiveTab('dashboard'); }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent, node: TreeDataItem) => {
    if (node.type === 'database' && node.connectionId && node.databaseName) {
      handleOpenDatabase(node.connectionId, node.databaseName);
    } else if (node.type === 'connection' && node.connectionId) {
      handleConnect(node.connectionId);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    Modal.confirm({
      title: 'Delete Connection',
      content: 'Are you sure you want to delete this connection?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await connectionApi.delete(id);
          message.success('Connection deleted');
          loadConnections();
          if (selectedNode?.connectionId === id) setSelectedNode(null);
        } catch (error) { message.error('Failed to delete connection'); }
      }
    });
  };

  const handleSaveConnection = async (data: ConnectionInfo) => {
    try {
      if (editingConnection) { await connectionApi.update(editingConnection.id!, data); }
      else { await connectionApi.create(data); }
      message.success('Connection saved');
      setConnectionModalVisible(false);
      setEditingConnection(null);
      loadConnections();
    } catch (error) { message.error('Failed to save connection'); }
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
          borderRadius: 4,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
        components: {
          Layout: { siderBg: '#1e1e1e' },
          Tree: {
            bg: 'transparent',
            colorText: '#cccccc',
            nodeHoverColor: '#2a2d2e',
            nodeSelectedColor: '#37373d',
          }
        },
      }}
    >
      <Layout style={{ height: '100vh', background: '#f0f2f5' }}>
        <Sider trigger={null} collapsible collapsed={collapsed} width={siderWidth} collapsedWidth={64} style={{ background: '#1e1e1e', borderRight: '1px solid #2b2b2b', position: 'relative', height: '100vh' }}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #2b2b2b', background: '#252526', flexShrink: 0 }}>
              <div className="flex items-center">
                <CloudServerOutlined style={{ color: '#7C3AED', fontSize: '20px' }} />
                {!collapsed && <Title level={5} className="text-white m-0 ml-2" style={{ fontWeight: 600 }}>NaviLite</Title>}
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }} className="custom-scrollbar">
              {!collapsed ? (
                <>
                  <div className="px-3 mb-3">
                    <Button type="primary" block icon={<PlusOutlined />} onClick={() => { setEditingConnection(null); setConnectionModalVisible(true); }} style={{ background: '#7C3AED', border: 'none' }}>New Connection</Button>
                  </div>
                  <Tree 
                    showIcon 
                    treeData={treeData} 
                    expandedKeys={expandedKeys} 
                    selectedKeys={selectedKeys} 
                    onExpand={handleTreeExpand} 
                    onSelect={handleTreeSelect} 
                    onDoubleClick={(e, node) => handleDoubleClick(e, node as TreeDataItem)}
                    blockNode 
                    virtual={false} 
                    switcherIcon={<CaretRightOutlined className="text-gray-500" />} 
                    className="navicat-tree" 
                    titleRender={(node: TreeDataItem) => {
                      if (node.type === 'database') {
                        const isOpen = openDatabaseKeys.has(`${node.connectionId}:${node.databaseName}`);
                        return (
                          <Dropdown
                            overlay={
                              <Menu size="small">
                                {!isOpen ? (
                                  <Menu.Item key="open" icon={<PlayCircleOutlined />} onClick={() => handleOpenDatabase(node.connectionId!, node.databaseName!)}>Open Database</Menu.Item>
                                ) : (
                                  <Menu.Item key="close" icon={<CloseCircleOutlined />} onClick={() => handleCloseDatabase(node.connectionId!, node.databaseName!)}>Close Database</Menu.Item>
                                )}
                                <Menu.Divider />
                                <Menu.Item key="refresh" icon={<ReloadOutlined />} onClick={() => { handleCloseDatabase(node.connectionId!, node.databaseName!); handleOpenDatabase(node.connectionId!, node.databaseName!); }}>Refresh</Menu.Item>
                              </Menu>
                            }
                            trigger={['contextMenu']}
                          >
                            <div className="w-full">{node.title as React.ReactNode}</div>
                          </Dropdown>
                        );
                      }
                      return node.title as React.ReactNode;
                    }}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center gap-4 mt-4">
                  <Tooltip title="New Connection" placement="right"><Button type="primary" shape="circle" icon={<PlusOutlined />} onClick={() => setConnectionModalVisible(true)} /></Tooltip>
                  <Tooltip title="Connections" placement="right"><DatabaseOutlined className="text-gray-400 text-xl cursor-pointer hover:text-white" onClick={() => setCollapsed(false)} /></Tooltip>
                </div>
              )}
            </div>

            <div style={{ height: '40px', borderTop: '1px solid #2b2b2b', background: '#252526', display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }} className="footer-collapse-bar" onClick={() => setCollapsed(!collapsed)}>
               {!collapsed ? (
                 <div className="px-4 flex items-center justify-between w-full">
                   <span style={{ fontSize: '11px', color: '#858585', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Collapse Sidebar</span>
                   <MenuFoldOutlined style={{ color: '#858585' }} />
                 </div>
               ) : (
                 <div className="w-full flex justify-center">
                   <Tooltip title="Expand Sidebar" placement="right"><MenuUnfoldOutlined style={{ fontSize: '18px', color: '#858585' }} /></Tooltip>
                 </div>
               )}
            </div>
          </div>
          
          {!collapsed && <div onMouseDown={startResizing} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '2px', cursor: 'col-resize', zIndex: 10 }} className="sider-resizer" />}
        </Sider>
        
        <Layout>
          <Header style={{ padding: '0 16px', background: '#fff', borderBottom: '1px solid #dcdfe6', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="flex items-center gap-1">
              {selectedNode && (
                <div className="flex bg-[#f4f4f5] p-1 rounded-sm gap-1">
                  {selectedNode.type !== 'table' && getCurrentConnection()?.type !== 'REDIS' && <Button size="small" className={`nav-tab-button ${activeTab === 'dashboard' ? 'active' : ''}`} type={activeTab === 'dashboard' ? 'primary' : 'text'} icon={<DashboardOutlined />} onClick={() => setActiveTab('dashboard')}>Dashboard</Button>}
                  {getCurrentConnection()?.type !== 'REDIS' && <Button size="small" className={`nav-tab-button ${activeTab === 'sql' ? 'active' : ''}`} type={activeTab === 'sql' ? 'primary' : 'text'} icon={<ConsoleSqlOutlined />} onClick={() => setActiveTab('sql')}>SQL Editor</Button>}
                  {(selectedNode.type === 'table' || getCurrentConnection()?.type === 'REDIS') && (
                    <>
                      <Button size="small" className={`nav-tab-button ${activeTab === 'data' ? 'active' : ''}`} type={activeTab === 'data' ? 'primary' : 'text'} icon={getCurrentConnection()?.type === 'REDIS' ? <DashboardOutlined /> : <TableOutlined />} onClick={() => setActiveTab('data')}>{getCurrentConnection()?.type === 'REDIS' ? 'Redis Manager' : getCurrentConnection()?.type === 'MONGODB' ? 'Documents' : 'Data'}</Button>
                      {!['MONGODB', 'REDIS'].includes(getCurrentConnection()?.type || '') && <Button size="small" className={`nav-tab-button ${activeTab === 'structure' ? 'active' : ''}`} type={activeTab === 'structure' ? 'primary' : 'text'} icon={<SettingOutlined />} onClick={() => setActiveTab('structure')}>Structure</Button>}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4"><Text type="secondary" className="text-xs">{selectedNode?.connectionId ? `Connected to: ${connections.find(c => c.id === selectedNode.connectionId)?.name}` : 'Ready'}</Text></div>
          </Header>
          <Content style={{ padding: 0, minHeight: 280, background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {!selectedNode ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-[#fafafa]">
                <DatabaseOutlined style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.2 }} />
                <Text type="secondary" style={{ fontSize: '16px' }}>Select a connection or table to start</Text>
                <Button type="link" onClick={() => setConnectionModalVisible(true)}>Create New Connection</Button>
              </div>
            ) : getCurrentConnection()?.type === 'REDIS' ? (
              <RedisManager connection={getCurrentConnection()!} database={selectedNode.databaseName} tableName={selectedNode.type === 'table' ? selectedNode.tableName : undefined} />
            ) : activeTab === 'dashboard' ? (
              <DatabaseDashboard connection={getCurrentConnection()!} database={selectedNode.databaseName} />
            ) : activeTab === 'sql' ? (
              <SqlEditor connection={getCurrentConnection()!} database={selectedNode.databaseName} />
            ) : activeTab === 'data' && selectedNode.type === 'table' ? (
              <DataViewer connection={getCurrentConnection()!} database={selectedNode.databaseName!} table={selectedNode.tableName!} />
            ) : activeTab === 'structure' && selectedNode.type === 'table' ? (
              <TableStructure connection={getCurrentConnection()!} database={selectedNode.databaseName!} table={selectedNode.tableName!} />
            ) : (
              <div className="p-10"><Empty description="Select a table to view data or structure" /></div>
            )}
          </Content>
        </Layout>

        <Modal title={editingConnection ? 'Edit Connection' : 'New Connection'} open={connectionModalVisible} onCancel={() => { setConnectionModalVisible(false); setEditingConnection(null); }} footer={null} width={600} centered destroyOnClose>
          <ConnectionForm initialValues={editingConnection} onSave={handleSaveConnection} />
        </Modal>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
