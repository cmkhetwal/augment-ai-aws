import React from 'react';
import { Table, Tag, Card, Typography, Space, Button, Tooltip } from 'antd';
import { 
  PlayCircleOutlined, 
  StopOutlined, 
  ReloadOutlined,
  CloudServerOutlined,
  EnvironmentOutlined 
} from '@ant-design/icons';
import moment from 'moment';

const { Title } = Typography;

const Instances = ({ data }) => {
  const { instances, pingResults } = data;

  const columns = [
    {
      title: 'Instance Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => {
        const name = record.Tags?.find(tag => tag.Key === 'Name')?.Value || record.InstanceId;
        return (
          <Space>
            <CloudServerOutlined />
            <span style={{ fontWeight: 'bold' }}>{name}</span>
          </Space>
        );
      },
      sorter: (a, b) => {
        const nameA = a.Tags?.find(tag => tag.Key === 'Name')?.Value || a.InstanceId;
        const nameB = b.Tags?.find(tag => tag.Key === 'Name')?.Value || b.InstanceId;
        return nameA.localeCompare(nameB);
      }
    },
    {
      title: 'Instance ID',
      dataIndex: 'InstanceId',
      key: 'instanceId',
      render: text => <code>{text}</code>
    },
    {
      title: 'Type',
      dataIndex: 'InstanceType',
      key: 'instanceType',
      filters: [
        { text: 't2.micro', value: 't2.micro' },
        { text: 't2.small', value: 't2.small' },
        { text: 't3.micro', value: 't3.micro' },
        { text: 't3.small', value: 't3.small' },
        { text: 'm5.large', value: 'm5.large' }
      ],
      onFilter: (value, record) => record.InstanceType === value,
      render: text => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'State',
      dataIndex: 'State',
      key: 'state',
      filters: [
        { text: 'Running', value: 'running' },
        { text: 'Stopped', value: 'stopped' },
        { text: 'Pending', value: 'pending' },
        { text: 'Stopping', value: 'stopping' }
      ],
      onFilter: (value, record) => record.State.Name === value,
      render: state => {
        const colorMap = {
          running: 'green',
          stopped: 'red',
          pending: 'orange',
          stopping: 'orange'
        };
        return <Tag color={colorMap[state.Name] || 'default'}>{state.Name.toUpperCase()}</Tag>;
      }
    },
    {
      title: 'Public IP',
      dataIndex: 'PublicIpAddress',
      key: 'publicIp',
      render: ip => ip || <span style={{ color: '#ccc' }}>N/A</span>
    },
    {
      title: 'Private IP',
      dataIndex: 'PrivateIpAddress',
      key: 'privateIp',
      render: ip => ip || <span style={{ color: '#ccc' }}>N/A</span>
    },
    {
      title: 'Ping Status',
      key: 'pingStatus',
      render: (text, record) => {
        const pingResult = pingResults[record.InstanceId];
        if (!pingResult) {
          return <Tag color="default">Unknown</Tag>;
        }
        
        return (
          <Tooltip title={`Response time: ${pingResult.avg || 'N/A'}ms`}>
            <Tag color={pingResult.alive ? 'green' : 'red'}>
              {pingResult.alive ? 'Online' : 'Offline'}
            </Tag>
          </Tooltip>
        );
      },
      filters: [
        { text: 'Online', value: 'online' },
        { text: 'Offline', value: 'offline' }
      ],
      onFilter: (value, record) => {
        const pingResult = pingResults[record.InstanceId];
        if (!pingResult) return false;
        return value === 'online' ? pingResult.alive : !pingResult.alive;
      }
    },
    {
      title: 'Availability Zone',
      dataIndex: 'AvailabilityZone',
      key: 'az',
      render: (text, record) => (
        <Space>
          <EnvironmentOutlined />
          {record.AvailabilityZone}
        </Space>
      )
    },
    {
      title: 'Launch Time',
      dataIndex: 'LaunchTime',
      key: 'launchTime',
      render: time => moment(time).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => new Date(a.LaunchTime) - new Date(b.LaunchTime),
      defaultSortOrder: 'descend'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (text, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button 
              type="primary" 
              size="small" 
              icon={<CloudServerOutlined />}
              onClick={() => window.open(`https://console.aws.amazon.com/ec2/v2/home?region=${record.AvailabilityZone?.slice(0, -1)}#InstanceDetails:instanceId=${record.InstanceId}`, '_blank')}
            >
              Details
            </Button>
          </Tooltip>
          <Tooltip title="Refresh Status">
            <Button 
              size="small" 
              icon={<ReloadOutlined />}
              onClick={() => {
                // Refresh functionality would be implemented here
                console.log('Refreshing instance:', record.InstanceId);
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  const expandedRowRender = (record) => {
    const innerColumns = [
      { title: 'Key', dataIndex: 'Key', key: 'key' },
      { title: 'Value', dataIndex: 'Value', key: 'value' }
    ];

    const tags = record.Tags || [];
    const securityGroups = record.SecurityGroups || [];

    return (
      <div>
        <div style={{ marginBottom: '16px' }}>
          <Title level={5}>Instance Details</Title>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div><strong>VPC ID:</strong> {record.VpcId || 'N/A'}</div>
            <div><strong>Subnet ID:</strong> {record.SubnetId || 'N/A'}</div>
            <div><strong>Key Name:</strong> {record.KeyName || 'N/A'}</div>
            <div><strong>Architecture:</strong> {record.Architecture || 'N/A'}</div>
          </Space>
        </div>
        
        {tags.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <Title level={5}>Tags</Title>
            <Table
              columns={innerColumns}
              dataSource={tags}
              pagination={false}
              size="small"
              rowKey="Key"
            />
          </div>
        )}
        
        {securityGroups.length > 0 && (
          <div>
            <Title level={5}>Security Groups</Title>
            <Space wrap>
              {securityGroups.map(sg => (
                <Tag key={sg.GroupId} color="cyan">
                  {sg.GroupName} ({sg.GroupId})
                </Tag>
              ))}
            </Space>
          </div>
        )}
      </div>
    );
  };

  const getInstanceSummary = () => {
    const total = instances.length;
    const running = instances.filter(i => i.State.Name === 'running').length;
    const stopped = instances.filter(i => i.State.Name === 'stopped').length;
    const others = total - running - stopped;
    
    return { total, running, stopped, others };
  };

  const summary = getInstanceSummary();

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2}>EC2 Instances</Title>
        <Space>
          <Tag color="green">Running: {summary.running}</Tag>
          <Tag color="red">Stopped: {summary.stopped}</Tag>
          <Tag color="orange">Others: {summary.others}</Tag>
          <Tag color="blue">Total: {summary.total}</Tag>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={instances}
          rowKey="InstanceId"
          expandable={{
            expandedRowRender,
            rowExpandable: record => true,
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} instances`
          }}
          scroll={{ x: 1200 }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default Instances;