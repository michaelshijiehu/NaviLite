import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Select, Button, message } from 'antd';
import type { ConnectionInfo, DatabaseType } from '../types';
import { connectionApi } from '../services/api';

const { Option } = Select;

interface ConnectionFormProps {
  initialValues?: ConnectionInfo | null;
  onSave: (data: ConnectionInfo) => void;
}

const ConnectionForm: React.FC<ConnectionFormProps> = ({ initialValues, onSave }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  const dbType = Form.useWatch('type', form);

  // Sync initialValues when they change (important for Edit mode)
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues);
    } else {
      form.resetFields();
    }
  }, [initialValues, form]);

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      setTestLoading(true);
      const res = await connectionApi.test(values);
      if (res.data.success) {
        message.success('Connection successful!');
      } else {
        message.error('Connection failed: ' + res.data.message);
      }
    } catch (error: any) {
      if (error.errorFields) {
        const fieldNames = error.errorFields.map((f: any) => Array.isArray(f.name) ? f.name.join('.') : f.name).join(', ');
        message.error('Please fill in required fields: ' + fieldNames);
      } else {
        message.error('Validation failed: ' + (error.message || JSON.stringify(error)));
      }
    } finally {
      setTestLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      onSave(values);
    } catch (error: any) {
      console.error('Validation failed:', error);
      if (error.errorFields) {
        const fieldNames = error.errorFields.map((f: any) => Array.isArray(f.name) ? f.name.join('.') : f.name).join(', ');
        message.error('Please fix validation errors: ' + fieldNames);
      } else {
        message.error('Submit failed: ' + (error.message || JSON.stringify(error)));
      }
    } finally {
      setLoading(false);
    }
  };

  const getDefaultPort = (type: DatabaseType) => {
    switch (type) {
      case 'MYSQL': return 3306;
      case 'POSTGRESQL': return 5432;
      case 'MONGODB': return 27017;
      case 'REDIS': return 6379;
      default: return 3306;
    }
  };

  const handleTypeChange = (type: DatabaseType) => {
    form.setFieldValue('port', getDefaultPort(type));
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues || {
        type: 'MYSQL',
        host: 'localhost',
        port: 3306,
        username: '',
        password: '',
      }}
      onValuesChange={(changedValues) => {
        if (changedValues.type) {
          handleTypeChange(changedValues.type);
        }
      }}
    >
      <Form.Item
        name="name"
        label="Connection Name"
        rules={[{ required: true, message: 'Please input connection name' }]}
      >
        <Input placeholder="My Database" />
      </Form.Item>

      <Form.Item
        name="type"
        label="Database Type"
        rules={[{ required: true, message: 'Please select database type' }]}
      >
        <Select onChange={handleTypeChange}>
          <Option value="MYSQL">MySQL</Option>
          <Option value="POSTGRESQL">PostgreSQL</Option>
          <Option value="SQLITE">SQLite</Option>
          <Option value="MONGODB">MongoDB</Option>
          <Option value="REDIS">Redis</Option>
        </Select>
      </Form.Item>

      {dbType !== 'SQLITE' && (
        <>
          <Form.Item
            name="host"
            label="Host"
            rules={[{ required: true, message: 'Please input host' }]}
          >
            <Input placeholder="localhost" />
          </Form.Item>

          <Form.Item
            name="port"
            label="Port"
            rules={[{ required: true, message: 'Please input port' }]}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="username"
            label="Username"
          >
            <Input placeholder="root (optional)" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
          >
            <Input.Password placeholder="password (optional)" />
          </Form.Item>
        </>
      )}

      {dbType === 'SQLITE' && (
        <Form.Item
          name="filePath"
          label="Database File Path"
          rules={[{ required: true, message: 'Please input file path' }]}
        >
          <Input placeholder="/path/to/database.db" />
        </Form.Item>
      )}

      {(dbType === 'MYSQL' || dbType === 'POSTGRESQL') && (
        <Form.Item
          name="database"
          label="Database (optional)"
          help="Leave empty to see all databases"
        >
          <Input placeholder="mydb" />
        </Form.Item>
      )}

      <div className="flex gap-2">
        <Button onClick={handleTest} loading={testLoading}>
          Test Connection
        </Button>
        <Button type="primary" onClick={handleSubmit} loading={loading}>
          Save
        </Button>
      </div>
    </Form>
  );
};

export default ConnectionForm;
