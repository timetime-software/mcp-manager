import React from 'react';
import { MCPServer, ServerStatus } from '../../types/mcp';

const pulseAnimation = `
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.6; }
    100% { opacity: 1; }
  }
`;

interface ServerCardProps {
  server: MCPServer;
  serverId: string;
  status?: ServerStatus;
  onEdit: () => void;
  onDelete: () => void;
  onCheckStatus: () => void;
}

const ServerCard: React.FC<ServerCardProps> = ({
  server,
  serverId,
  status = ServerStatus.UNKNOWN,
  onEdit,
  onDelete,
  onCheckStatus,
}) => {
  // Get the number of environment variables
  const numEnvVars = Object.keys(server.env).length;

  // Status badge styles
  const getStatusBadgeStyle = () => {
    switch (status) {
      case ServerStatus.ONLINE:
        return {
          backgroundColor: '#10b981', // Green
          color: 'white',
        };
      case ServerStatus.OFFLINE:
        return {
          backgroundColor: '#ef4444', // Red
          color: 'white',
        };
      case ServerStatus.CHECKING:
        return {
          backgroundColor: '#f59e0b', // Amber
          color: 'white',
          animation: 'pulse 1.2s infinite ease-in-out',
        };
      default:
        return {
          backgroundColor: '#6b7280', // Gray
          color: 'white',
        };
    }
  };

  // Status badge text
  const getStatusText = () => {
    switch (status) {
      case ServerStatus.ONLINE:
        return 'Online';
      case ServerStatus.OFFLINE:
        return 'Offline';
      case ServerStatus.CHECKING:
        return 'Checking...';
      default:
        return 'Unknown';
    }
  };

  return (
    <>
      <style>{pulseAnimation}</style>
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #eee',
        width: '100%'
      }}>
      {/* Status Badge and Refresh Button */}
      <div style={{ 
        marginRight: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <div
          style={{
            ...getStatusBadgeStyle(),
            fontSize: '0.75rem',
            padding: '0.25rem 0.5rem',
            borderRadius: '9999px',
            fontWeight: 'bold',
            transition: 'background-color 0.3s ease-in-out, color 0.3s ease-in-out',
          }}
        >
          {getStatusText()}
        </div>
        
        {/* Refresh Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCheckStatus();
          }}
          style={{
            background: 'none',
            border: '1px solid #ccc',
            borderRadius: '3px',
            padding: '0.15rem 0.3rem',
            cursor: 'pointer',
            fontSize: '0.7rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Refresh status"
        >
          ↻
        </button>
      </div>
      
      {/* ID Column */}
      <div style={{ 
        width: '15%', 
        fontWeight: 'bold', 
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        paddingRight: '1rem'
      }}>
        {serverId}
      </div>
      
      {/* Command Column */}
      <div style={{ 
        width: '30%', 
        fontFamily: 'monospace',
        fontSize: '0.875rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        paddingRight: '1rem'
      }}>
        {server.command}
      </div>
      
      {/* Args Column */}
      <div style={{ 
        width: '15%', 
        fontSize: '0.875rem',
        paddingRight: '1rem'
      }}>
        {server.args.length > 0 ? (
          <span>{server.args.length} arguments</span>
        ) : (
          <span style={{ color: '#666' }}>No arguments</span>
        )}
      </div>
      
      {/* Env Vars Column */}
      <div style={{ 
        width: '15%', 
        fontSize: '0.875rem',
        paddingRight: '1rem'
      }}>
        {numEnvVars > 0 ? (
          <span>{numEnvVars} {numEnvVars === 1 ? 'variable' : 'variables'}</span>
        ) : (
          <span style={{ color: '#666' }}>No env vars</span>
        )}
      </div>
      
      {/* Actions Column */}
      <div style={{ 
        width: '15%',
        display: 'flex', 
        justifyContent: 'flex-end',
        gap: '0.5rem'
      }}>
        <button 
          style={{ 
            background: 'none',
            border: '1px solid #ccc',
            padding: '0.25rem 0.5rem',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '0.75rem'
          }} 
          onClick={onEdit}
        >
          Edit
        </button>
        <button 
          style={{ 
            background: 'none',
            border: '1px solid #ccc',
            padding: '0.25rem 0.5rem',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '0.75rem'
          }} 
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
    </>
  );
};

export default ServerCard; 
