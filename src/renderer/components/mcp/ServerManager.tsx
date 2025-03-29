import React, { useState, useEffect, useCallback } from 'react';
import ServerCard from './ServerCard';
import ServerDialog from './ServerDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import ImportJsonDialog from './ImportJsonDialog';
import ConfigJsonEditor from './ConfigJsonEditor';
import * as mcpService from '../../services/mcpService';
import { EditableMCPServer, MCPServer, MCPConfig, ServerStatus } from '../../types/mcp';

const ServerManager: React.FC = () => {
  const [servers, setServers] = useState<Record<string, MCPServer>>({});
  const [serverIds, setServerIds] = useState<string[]>([]);
  const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isJsonEditorOpen, setIsJsonEditorOpen] = useState(false);
  const [currentServerId, setCurrentServerId] = useState<string | null>(null);
  
  useEffect(() => {
    loadServers();
  }, []);
  
  const loadServers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const config = await mcpService.getMCPConfig();
      setServers(config.mcpServers || {});
      setServerIds(Object.keys(config.mcpServers || {}));
      
      // Initialize all server statuses as unknown
      const initialStatuses: Record<string, ServerStatus> = {};
      Object.keys(config.mcpServers || {}).forEach(serverId => {
        // Preserve existing status if available, otherwise set to UNKNOWN
        initialStatuses[serverId] = serverStatuses[serverId] || ServerStatus.UNKNOWN;
      });
      setServerStatuses(initialStatuses);
      
      setIsLoading(false);
      
      // Perform a one-time health check only if it hasn't been done yet
      if (!initialCheckDone && Object.keys(config.mcpServers || {}).length > 0) {
        console.log('Performing initial health check...');
        await checkAllServerStatuses();
        setInitialCheckDone(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading MCP servers');
      setIsLoading(false);
      console.error('Error loading MCP servers:', err);
    }
  };
  
  const handleAddServer = async (server: EditableMCPServer) => {
    try {
      await mcpService.addMCPServer(server, server.id);
      setIsAddDialogOpen(false);
      loadServers();
    } catch (err) {
      console.error('Error adding server:', err);
      setError('Failed to add server');
    }
  };
  
  /**
   * Handles updating a server, including potential ID changes
   * @param server Updated server data
   */
  const handleEditServer = async (server: EditableMCPServer) => {
    if (!currentServerId) return;
    
    try {
      // Use the new function that handles ID changes
      await mcpService.updateMCPServerWithId(currentServerId, server);
      setIsEditDialogOpen(false);
      setCurrentServerId(null);
      loadServers();
    } catch (err) {
      console.error('Error updating server:', err);
      setError('Failed to update server');
    }
  };
  
  const handleDeleteServer = async () => {
    if (!currentServerId) return;
    
    try {
      await mcpService.deleteMCPServer(currentServerId);
      setIsDeleteDialogOpen(false);
      setCurrentServerId(null);
      loadServers();
    } catch (err) {
      console.error('Error deleting server:', err);
      setError('Failed to delete server');
    }
  };

  const handleImportFromJson = async (importedConfig: MCPConfig) => {
    try {
      // Get the current configuration
      const currentConfig = await mcpService.getMCPConfig();
      
      // Create a new merged configuration
      const mergedConfig: MCPConfig = { 
        mcpServers: { ...currentConfig.mcpServers }
      };
      
      // Add all imported servers that don't already exist
      let newServersCount = 0;
      Object.entries(importedConfig.mcpServers).forEach(([serverId, server]) => {
        if (!mergedConfig.mcpServers[serverId]) {
          mergedConfig.mcpServers[serverId] = server;
          newServersCount++;
        }
      });
      
      // Save the merged configuration
      await mcpService.saveMCPConfig(mergedConfig);
      setIsImportDialogOpen(false);
      
      // Show success message
      alert(`Imported ${newServersCount} new server${newServersCount !== 1 ? 's' : ''}`);
      
      // Reload servers to update the UI
      loadServers();
    } catch (err) {
      console.error('Error importing servers from JSON:', err);
      setError('Failed to import servers from JSON');
    }
  };
  
  const openEditDialog = (serverId: string) => {
    setCurrentServerId(serverId);
    setIsEditDialogOpen(true);
  };
  
  const openDeleteDialog = (serverId: string) => {
    setCurrentServerId(serverId);
    setIsDeleteDialogOpen(true);
  };
  
  // Check the status of all servers
  const checkAllServerStatuses = useCallback(async () => {
    // Prevent multiple simultaneous status checks
    if (Object.values(serverStatuses).some(status => status === ServerStatus.CHECKING)) {
      console.log('Status check already in progress');
      return;
    }
    
    const startTime = Date.now();
    const minAnimationTime = 800; // ms
    
    try {
      // Mark all servers as checking
      const checkingStatuses = { ...serverStatuses };
      Object.keys(servers).forEach(serverId => {
        checkingStatuses[serverId] = ServerStatus.CHECKING;
      });
      setServerStatuses(checkingStatuses);
      
      // Ping all servers
      const statuses = await mcpService.pingAllMCPServers();
      
      // Ensure minimum animation time
      const updateStatuses = () => {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < minAnimationTime) {
          setTimeout(() => {
            setServerStatuses(statuses);
          }, minAnimationTime - elapsedTime);
        } else {
          setServerStatuses(statuses);
        }
      };
      
      updateStatuses();
    } catch (error) {
      console.error('Error checking server statuses:', error);
      
      // Ensure minimum animation time
      const updateStatuses = () => {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < minAnimationTime) {
          setTimeout(() => {
            // Reset statuses that are still in CHECKING state to UNKNOWN
            setServerStatuses(prev => {
              const updated = { ...prev };
              Object.keys(updated).forEach(id => {
                if (updated[id] === ServerStatus.CHECKING) {
                  updated[id] = ServerStatus.UNKNOWN;
                }
              });
              return updated;
            });
          }, minAnimationTime - elapsedTime);
        } else {
          // Reset statuses that are still in CHECKING state to UNKNOWN
          setServerStatuses(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(id => {
              if (updated[id] === ServerStatus.CHECKING) {
                updated[id] = ServerStatus.UNKNOWN;
              }
            });
            return updated;
          });
        }
      };
      
      updateStatuses();
    }
  }, [servers, serverStatuses]);
  
  // Check the status of a single server
  const checkServerStatus = async (serverId: string) => {
    // Skip if this server is already being checked
    if (serverStatuses[serverId] === ServerStatus.CHECKING) {
      console.log(`Status check already in progress for ${serverId}`);
      return;
    }
    
    try {
      // Mark server as checking
      setServerStatuses(prev => ({
        ...prev,
        [serverId]: ServerStatus.CHECKING,
      }));
      
      // Ping the server
      const status = await mcpService.pingMCPServer(serverId, servers[serverId]);
      
      // Use a small timeout to ensure smooth animation
      // Minimum of 800ms to ensure the checking animation is visible
      const startTime = Date.now();
      const minAnimationTime = 800; // ms
      
      const updateStatus = () => {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < minAnimationTime) {
          // Wait until minimum animation time has passed
          setTimeout(() => {
            setServerStatuses(prev => ({
              ...prev,
              [serverId]: status,
            }));
          }, minAnimationTime - elapsedTime);
        } else {
          // Update immediately if minimum time has already passed
          setServerStatuses(prev => ({
            ...prev,
            [serverId]: status,
          }));
        }
      };
      
      updateStatus();
    } catch (error) {
      console.error(`Error checking server status for ${serverId}:`, error);
      
      // Use a small timeout to ensure smooth animation
      const startTime = Date.now();
      const minAnimationTime = 800; // ms
      
      const updateStatus = () => {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < minAnimationTime) {
          setTimeout(() => {
            setServerStatuses(prev => ({
              ...prev,
              [serverId]: ServerStatus.OFFLINE,
            }));
          }, minAnimationTime - elapsedTime);
        } else {
          setServerStatuses(prev => ({
            ...prev,
            [serverId]: ServerStatus.OFFLINE,
          }));
        }
      };
      
      updateStatus();
    }
  };
  
  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Loading MCP Servers...</h2>
        <div style={{ width: '24px', height: '24px', margin: '0 auto', border: '2px solid #ccc', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Error Loading Servers</h2>
        <p style={{ marginBottom: '1rem', color: '#666' }}>{error}</p>
        <button onClick={loadServers} style={{ padding: '0.5rem 1rem', border: '1px solid #ccc', borderRadius: '4px', background: 'none' }}>
          Try Again
        </button>
      </div>
    );
  }
  
  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>MCP Servers</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={checkAllServerStatuses} 
            style={{ padding: '0.5rem 1rem', borderRadius: '4px', background: 'none', border: '1px solid #ccc' }}
          >
            Check All Statuses
          </button>
          <button 
            onClick={() => setIsJsonEditorOpen(true)} 
            style={{ padding: '0.5rem 1rem', borderRadius: '4px', background: 'none', border: '1px solid #ccc' }}
          >
            View JSON
          </button>
          <button 
            onClick={() => setIsImportDialogOpen(true)} 
            style={{ padding: '0.5rem 1rem', borderRadius: '4px', background: 'none', border: '1px solid #ccc' }}
          >
            Paste from JSON
          </button>
          <button 
            onClick={() => setIsAddDialogOpen(true)} 
            style={{ padding: '0.5rem 1rem', borderRadius: '4px', background: '#f1f1f1', border: '1px solid #ccc' }}
          >
            + Add Server
          </button>
        </div>
      </div>
      
      {serverIds.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', border: '1px solid #ccc', borderRadius: '4px' }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>No MCP Servers Configured</h3>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            MCP servers are used to manage your cluster configuration.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button 
              onClick={() => setIsJsonEditorOpen(true)}
              style={{ padding: '0.5rem 1rem', borderRadius: '4px', background: 'none', border: '1px solid #ccc' }}
            >
              View JSON
            </button>
            <button 
              onClick={() => setIsImportDialogOpen(true)}
              style={{ padding: '0.5rem 1rem', borderRadius: '4px', background: 'none', border: '1px solid #ccc' }}
            >
              Paste from JSON
            </button>
            <button 
              onClick={() => setIsAddDialogOpen(true)}
              style={{ padding: '0.5rem 1rem', borderRadius: '4px', background: '#f1f1f1', border: '1px solid #ccc' }}
            >
              + Add Your First Server
            </button>
          </div>
        </div>
      ) : (
        <div style={{ border: '1px solid #eee', borderRadius: '4px', overflow: 'hidden' }}>
          {/* Table Header */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '0.75rem 1rem',
            borderBottom: '1px solid #eee',
            background: '#f9f9f9',
            fontWeight: 'bold',
            fontSize: '0.875rem'
          }}>
            <div style={{ width: '120px', marginRight: '0.75rem' }}>Status</div>
            <div style={{ width: '15%', paddingRight: '1rem' }}>Server ID</div>
            <div style={{ width: '30%', paddingRight: '1rem' }}>Command</div>
            <div style={{ width: '15%', paddingRight: '1rem' }}>Arguments</div>
            <div style={{ width: '15%', paddingRight: '1rem' }}>Env Variables</div>
            <div style={{ width: '15%', textAlign: 'right' }}>Actions</div>
          </div>
          
          {/* Server Rows */}
          {serverIds.map(serverId => (
            <ServerCard
              key={serverId}
              server={servers[serverId]}
              serverId={serverId}
              status={serverStatuses[serverId] || ServerStatus.UNKNOWN}
              onEdit={() => openEditDialog(serverId)}
              onDelete={() => openDeleteDialog(serverId)}
              onCheckStatus={() => checkServerStatus(serverId)}
            />
          ))}
        </div>
      )}
      
      <ServerDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSubmit={handleAddServer}
        title="Add New Server"
      />
      
      <ServerDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setCurrentServerId(null);
        }}
        onSubmit={handleEditServer}
        server={currentServerId ? servers[currentServerId] : undefined}
        serverId={currentServerId || undefined}
        title={currentServerId ? `Edit Server: ${currentServerId}` : "Edit Server"}
      />
      
      <DeleteConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setCurrentServerId(null);
        }}
        onConfirm={handleDeleteServer}
        serverName={currentServerId || 'this server'}
      />

      <ImportJsonDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImport={handleImportFromJson}
      />

      <ConfigJsonEditor
        isOpen={isJsonEditorOpen}
        onClose={() => {
          setIsJsonEditorOpen(false);
          loadServers(); // Reload servers after closing the editor
        }}
      />
    </div>
  );
};

export default ServerManager; 
