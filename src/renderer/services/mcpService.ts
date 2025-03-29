import { MCPConfig, MCPServer, EditableMCPServer, ServerStatus } from '../types/mcp';
import { ConfigService } from './configService';

/**
 * Obtiene la configuración de MCP del almacenamiento
 * @returns Promise con la configuración
 */
export async function getMCPConfig(): Promise<MCPConfig> {
  try {
    const jsonData = await window.electron.ipcRenderer.invoke('get-mcp-config');
    return ConfigService.parseConfig(jsonData);
  } catch (error) {
    console.error('Error al obtener configuración de MCP:', error);
    throw new Error('No se pudo obtener la configuración de MCP');
  }
}

/**
 * Guarda la configuración de MCP en el almacenamiento
 * @param config Configuración a guardar
 * @returns Promise con la configuración guardada
 */
export async function saveMCPConfig(config: MCPConfig): Promise<MCPConfig> {
  try {
    // Validar y normalizar la configuración
    const validatedConfig = ConfigService.validateAndNormalizeConfig(config);
    
    // Convertir a JSON sin campos no estándar
    const jsonData = ConfigService.stringifyConfig(validatedConfig);
    
    // Guardar en el sistema
    await window.electron.ipcRenderer.invoke('save-mcp-config', jsonData);
    
    return validatedConfig;
  } catch (error) {
    console.error('Error al guardar configuración de MCP:', error);
    throw new Error('No se pudo guardar la configuración de MCP');
  }
}

/**
 * Añade un nuevo servidor MCP a la configuración
 * @param server Datos del servidor a añadir
 * @param serverId ID opcional para el servidor
 * @returns Promise con la configuración actualizada
 */
export async function addMCPServer(server: MCPServer, serverId: string): Promise<MCPConfig> {
  try {
    // Validar el servidor
    if (!ConfigService.isValidServer(server)) {
      throw new Error('El servidor no tiene el formato correcto');
    }
    
    // Normalizar el servidor
    const normalizedServer = ConfigService.normalizeServer(server);
    
    // Obtener la configuración actual
    const config = await getMCPConfig();
    
    // Verificar que el ID no exista ya
    if (ConfigService.serverExists(config, serverId)) {
      throw new Error(`Ya existe un servidor con el ID ${serverId}`);
    }
    
    // Añadir el servidor a la configuración
    config.mcpServers[serverId] = normalizedServer;
    
    // Guardar la configuración actualizada
    return await saveMCPConfig(config);
  } catch (error) {
    console.error('Error al añadir servidor MCP:', error);
    throw error;
  }
}

/**
 * Actualiza un servidor MCP existente
 * @param serverId ID del servidor a actualizar
 * @param updatedServer Datos actualizados del servidor
 * @returns Promise con la configuración actualizada
 */
export async function updateMCPServer(serverId: string, updatedServer: MCPServer): Promise<MCPConfig> {
  try {
    // Validar el servidor
    if (!ConfigService.isValidServer(updatedServer)) {
      throw new Error('El servidor actualizado no tiene el formato correcto');
    }
    
    // Normalizar el servidor
    const normalizedServer = ConfigService.normalizeServer(updatedServer);
    
    // Obtener la configuración actual
    const config = await getMCPConfig();
    
    // Verificar que el servidor existe
    if (!ConfigService.serverExists(config, serverId)) {
      throw new Error(`No existe un servidor con el ID ${serverId}`);
    }
    
    // Actualizar el servidor
    config.mcpServers[serverId] = normalizedServer;
    
    // Guardar la configuración actualizada
    return await saveMCPConfig(config);
  } catch (error) {
    console.error('Error al actualizar servidor MCP:', error);
    throw error;
  }
}

/**
 * Elimina un servidor MCP de la configuración
 * @param serverId ID del servidor a eliminar
 * @returns Promise con la configuración actualizada
 */
export async function deleteMCPServer(serverId: string): Promise<MCPConfig> {
  try {
    // Obtener la configuración actual
    const config = await getMCPConfig();
    
    // Verificar que el servidor existe
    if (!ConfigService.serverExists(config, serverId)) {
      throw new Error(`No existe un servidor con el ID ${serverId}`);
    }
    
    // Eliminar el servidor de la configuración
    delete config.mcpServers[serverId];
    
    // Guardar la configuración actualizada
    return await saveMCPConfig(config);
  } catch (error) {
    console.error('Error al eliminar servidor MCP:', error);
    throw error;
  }
}

/**
 * OBSOLETO: Establece un servidor como predeterminado
 * Esta función existe solo por compatibilidad con el código antiguo
 * @param serverId ID del servidor que sería el predeterminado
 * @returns Promise que simula éxito
 */
export async function setDefaultServer(serverId: string): Promise<{ success: boolean }> {
  console.warn(`La función setDefaultServer está obsoleta con el nuevo formato de configuración. ServerId: ${serverId}`);
  return { success: true };
}

/**
 * Ping an MCP server to check if it's running
 * @param serverId ID of the server to ping
 * @param server Server configuration
 * @returns Promise with server status
 */
export async function pingMCPServer(serverId: string, server: MCPServer): Promise<ServerStatus> {
  try {
    console.log(`Pinging MCP server ${serverId}...`);
    
    // Force the server to be treated as online for debugging
    // Uncomment this line to force all servers to appear online
    // return ServerStatus.ONLINE;
    
    const response = await window.electron.ipcRenderer.invoke('ping-mcp-server', serverId, server);
    
    if (response.success) {
      console.log(`Server ${serverId} is ONLINE on port ${response.port}`);
      return ServerStatus.ONLINE;
    } else {
      console.log(`Server ${serverId} is OFFLINE. Reason: ${response.error || 'Connection failed'}`);
      
      // If the command is not available, we should still show the server
      // This helps users who have configured servers but not installed the command yet
      if (response.error === 'Command not available') {
        console.log(`Command '${server.command}' not available, but showing server anyway`);
        return ServerStatus.UNKNOWN;
      }
      
      return ServerStatus.OFFLINE;
    }
  } catch (error) {
    console.error(`Error pinging MCP server ${serverId}:`, error);
    return ServerStatus.OFFLINE;
  }
}

/**
 * Ping all MCP servers to check their status
 * @returns Promise with object mapping server IDs to their status
 */
export async function pingAllMCPServers(): Promise<Record<string, ServerStatus>> {
  try {
    const config = await getMCPConfig();
    const results: Record<string, ServerStatus> = {};
    
    // Ping each server in parallel
    const pingPromises = Object.entries(config.mcpServers).map(async ([serverId, server]) => {
      results[serverId] = await pingMCPServer(serverId, server);
    });
    
    await Promise.all(pingPromises);
    return results;
  } catch (error) {
    console.error('Error pinging MCP servers:', error);
    throw error;
  }
}

/**
 * Updates an MCP server with a potential ID change
 * @param originalServerId Original ID of the server
 * @param updatedServer Updated server data (may contain a new ID)
 * @returns Promise with updated configuration
 */
export async function updateMCPServerWithId(originalServerId: string, updatedServer: EditableMCPServer): Promise<MCPConfig> {
  try {
    // Validate the server
    if (!ConfigService.isValidServer(updatedServer)) {
      throw new Error('Server has invalid format');
    }
    
    // Normalize the server data
    const normalizedServer = ConfigService.normalizeServer(updatedServer);
    
    // Get current configuration
    const config = await getMCPConfig();
    
    // Verify the original server exists
    if (!ConfigService.serverExists(config, originalServerId)) {
      throw new Error(`Server with ID ${originalServerId} does not exist`);
    }
    
    // Check if the ID has changed
    if (originalServerId !== updatedServer.id) {
      console.log(`Updating server ID from "${originalServerId}" to "${updatedServer.id}"`);
      
      // Remove the server with the old ID
      delete config.mcpServers[originalServerId];
      
      // Add the server with the new ID
      config.mcpServers[updatedServer.id] = normalizedServer;
    } else {
      console.log(`Updating server with unchanged ID: "${originalServerId}"`);
      
      // Update the server with the same ID
      config.mcpServers[originalServerId] = normalizedServer;
    }
    
    // Save the updated configuration
    return await saveMCPConfig(config);
  } catch (error) {
    console.error('Error updating MCP server with new ID:', error);
    throw error;
  }
} 
