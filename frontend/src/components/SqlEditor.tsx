import React, { useState, useEffect, useRef } from 'react';
import { Button, Table, message, Card, Space, Typography, Spin, Badge, Divider, Empty } from 'antd';
import { PlayCircleOutlined, ConsoleSqlOutlined } from '@ant-design/icons';
import type { ConnectionInfo, QueryResult } from '../types';
import { databaseApi } from '../services/api';

const { Text } = Typography;

interface SqlEditorProps {
  connection: ConnectionInfo;
  database?: string;
}

declare global {
  interface Window {
    monaco: any;
    require: any;
  }
}

const SqlEditor: React.FC<SqlEditorProps> = ({ connection, database }) => {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<any>(null);
  const isInitializing = useRef(false);

  // 核心修复：彻底的清理函数
  const destroyEditor = () => {
    if (editorInstance.current) {
      editorInstance.current.dispose();
      editorInstance.current = null;
    }
    if (containerRef.current) {
      containerRef.current.innerHTML = ''; // 物理清空
    }
  };

  useEffect(() => {
    // 切换连接或数据库时，先彻底摧毁旧的
    destroyEditor();
    setEditorReady(false);
    
    const init = async () => {
      if (isInitializing.current) return;
      isInitializing.current = true;

      try {
        if (!window.monaco) {
          await loadMonacoScript();
        }
        createEditor();
      } catch (e) {
        console.error('Monaco init error', e);
      } finally {
        isInitializing.current = false;
      }
    };

    init();

    return () => destroyEditor();
  }, [connection.id, database]);

  const loadMonacoScript = () => {
    return new Promise((resolve) => {
      if (document.getElementById('monaco-cdn-loader')) {
        const interval = setInterval(() => {
          if (window.monaco && window.require) {
            clearInterval(interval);
            resolve(true);
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.id = 'monaco-cdn-loader';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js';
      script.onload = () => {
        window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
        window.require(['vs/editor/editor.main'], () => resolve(true));
      };
      document.body.appendChild(script);
    });
  };

  const createEditor = async () => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = ''; // 再次确认清空

    // 注册 SQL 补全 (仅一次)
    if (window.monaco.languages.getLanguages().some((l: any) => l.id === 'sql')) {
      try {
        window.monaco.languages.registerCompletionItemProvider('sql', {
          provideCompletionItems: async (model: any, position: any) => {
            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
              startColumn: word.startColumn, endColumn: word.endColumn
            };
            const suggestions: any[] = [];
            
            // 基础关键字
            ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'JOIN', 'LEFT JOIN', 'ORDER BY'].forEach(k => {
              suggestions.push({ label: k, kind: window.monaco.languages.CompletionItemKind.Keyword, insertText: k, range });
            });

            // 动态表名
            try {
              const res = await databaseApi.getTables(connection.id!, database);
              res.data.forEach((t: any) => {
                suggestions.push({ label: t.name, kind: window.monaco.languages.CompletionItemKind.Class, insertText: t.name, detail: 'Table', range });
              });
            } catch (e) {}

            return { suggestions };
          }
        });
      } catch (e) {} // 忽略重复注册错误
    }

    editorInstance.current = window.monaco.editor.create(containerRef.current, {
      value: `-- Connection: ${connection.name}\n-- Database: ${database || 'default'}\nSELECT * FROM `,
      language: 'sql',
      theme: 'vs-light',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      padding: { top: 12 }
    });

    setEditorReady(true);
  };

  const handleExecute = async () => {
    if (!editorInstance.current) return;
    const sql = editorInstance.current.getValue();
    if (!sql.trim()) return;

    setLoading(true);
    try {
      const res = await databaseApi.executeQuery(connection.id!, { 
        connectionId: connection.id!, 
        database, 
        sql, 
        page: 1, 
        pageSize: 1000 
      });
      setResult(res.data);
      if (res.data.success) message.success('Success');
      else message.error(res.data.message);
    } catch (error) { message.error('Failed to execute'); } finally { setLoading(false); }
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#f8f9fa]">
      <Card size="small" className="mb-4 border-none shadow-sm overflow-hidden" bodyStyle={{ padding: 0 }}>
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100">
          <Space>
            <ConsoleSqlOutlined className="text-purple-600" />
            <Text strong>SQL Editor</Text>
            <Divider type="vertical" />
            <Text type="secondary" className="text-xs">{connection.name} / {database || 'default'}</Text>
          </Space>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleExecute} loading={loading} size="small">Run</Button>
        </div>
        <div style={{ position: 'relative', height: '300px' }}>
          {!editorReady && <div className="absolute inset-0 flex items-center justify-center bg-white z-10"><Spin tip="Loading Monaco..." /></div>}
          <div ref={containerRef} style={{ height: '100%' }} />
        </div>
      </Card>

      {result && (
        <Card size="small" className="flex-1 overflow-hidden flex flex-col border-none shadow-sm" title={
          <Space size="middle">
            <Badge status={result.success ? "success" : "error"} text={result.success ? "Success" : "Error"} />
            {result.executionTime && <Text type="secondary" className="text-xs">{result.executionTime}ms</Text>}
          </Space>
        }>
          {!result.success ? (
            <div className="p-4 bg-red-50 text-red-600 font-mono text-sm whitespace-pre-wrap rounded">{result.message}</div>
          ) : result.rows && result.rows.length > 0 ? (
            <Table 
              columns={result.columns?.map(c => ({ title: c, dataIndex: c, key: c, ellipsis: true, render: (v: any) => v === null ? <Text type="secondary" italic>NULL</Text> : String(v) }))} 
              dataSource={result.rows} 
              rowKey={(_, i) => String(i)} 
              size="small" 
              scroll={{ x: 'max-content', y: 'calc(100vh - 580px)' }} 
              pagination={{ pageSize: 50, size: 'small' }} 
            />
          ) : <div className="py-10 text-center"><Empty description="No rows returned" /></div>}
        </Card>
      )}
    </div>
  );
};

export default SqlEditor;
