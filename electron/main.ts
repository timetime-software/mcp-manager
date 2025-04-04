import { exec } from 'child_process';
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import isDev from 'electron-is-dev';
import fs from 'fs';
import net from 'net';
import path from 'path';

// Mantener una referencia global del objeto window para evitar que la ventana se cierre automáticamente cuando el objeto JavaScript sea recogido por el recolector de basura.
let mainWindow: BrowserWindow | null = null;

// Dirección del archivo de configuración Claude
const getClaudeConfigPath = () => {
  return path.join(
    app.getPath('home'),
    'Library',
    'Application Support',
    'Claude',
    'claude_desktop_config.json'
  );
};

function createWindow() {
  // Crear la ventana del navegador.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      nodeIntegrationInWorker: true,
      webSecurity: !isDev, // Disable web security in development
    },
    icon: path.join(__dirname, isDev ? '../../assets/icons/icon.png' : '../assets/icons/icon.png'),
    show: false,
    backgroundColor: '#ffffff',
    titleBarStyle: 'default',
    resizable: true,
    movable: true,
    frame: true,
  });

  // Mostrar la ventana solo cuando está lista para evitar parpadeos
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Cargar la URL de la aplicación.
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Abrir las DevTools en desarrollo.
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Abrir enlaces externos en el navegador predeterminado
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Crear el menú de la aplicación
  createMenu();

  // Emitido cuando la ventana es cerrada.
  mainWindow.on('closed', () => {
    // Eliminar la referencia del objeto window
    mainWindow = null;
  });
}

// Crear el menú de la aplicación
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://github.com/iagolast/mcp-manager');
          }
        },
        {
          label: 'About',
          click: () => {
            const version = app.getVersion();
            const aboutMessage = `MCP Manager\nVersion: ${version}\n\nA desktop application for managing Model Context Protocol (MCP) servers.`;
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                alert('${aboutMessage}');
              `);
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template as any);
  Menu.setApplicationMenu(menu);
}

// Este método se llamará cuando Electron haya terminado la inicialización y esté listo para crear ventanas del navegador.
// Algunas APIs pueden usarse sólo después de que este evento ocurra.
app.whenReady().then(() => {
  // Leer la configuración MCP (ahora desde el archivo Claude)
  ipcMain.handle('get-mcp-config', async () => {
    try {
      const configPath = getClaudeConfigPath();
      
      // Si el archivo no existe, crear uno con la configuración por defecto
      if (!fs.existsSync(configPath)) {
        const defaultConfig = {
          mcpServers: {}
        };
        await fs.promises.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
        return JSON.stringify(defaultConfig);
      }
      
      // Leer el archivo existente
      const data = await fs.promises.readFile(configPath, 'utf8');
      return data;
    } catch (error) {
      console.error('Error reading Claude config:', error);
      throw new Error('Failed to read configuration');
    }
  });

  // Guardar la configuración MCP (ahora en el archivo Claude)
  ipcMain.handle('save-mcp-config', async (event, jsonData) => {
    try {
      const configPath = getClaudeConfigPath();
      await fs.promises.writeFile(configPath, jsonData);
      return true;
    } catch (error) {
      console.error('Error saving Claude config:', error);
      throw new Error('Failed to save configuration');
    }
  });

  // Read the Claude desktop config - now the same as get-mcp-config
  ipcMain.handle('get-claude-config', async () => {
    try {
      const claudeConfigPath = getClaudeConfigPath();
      
      // Check if file exists
      if (!fs.existsSync(claudeConfigPath)) {
        throw new Error('Claude desktop configuration file not found');
      }
      
      // Read the file
      const data = await fs.promises.readFile(claudeConfigPath, 'utf8');
      return data;
    } catch (error) {
      console.error('Error reading Claude config:', error);
      throw new Error(`Failed to read Claude configuration: ${error.message}`);
    }
  });

  // Ping an MCP server to check if it's running
  ipcMain.handle('ping-mcp-server', async (event, serverId, server) => {
    try {
      // First, check if the command exists
      const isCommandAvailable = await checkCommandAvailability(server.command);
      if (!isCommandAvailable) {
        console.warn(`Command not available: ${server.command}`);
        return { success: false, error: 'Command not available' };
      }

      // Try to connect to the server using the Model Context Protocol
      const pingSuccess = await checkMCPServerConnection(server);
      return { success: pingSuccess };
    } catch (error) {
      console.error(`Error pinging MCP server ${serverId}:`, error);
      return { success: false, error: error.message };
    }
  });

  // Crear la ventana principal
  createWindow();
  app.on('activate', function () {
    // En macOS es común volver a crear una ventana en la aplicación cuando el
    // icono del dock es clicado y no hay otras ventanas abiertas.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Check if a command is available in the system
async function checkCommandAvailability(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const platform = process.platform;
    const cmd = platform === 'win32' ? 'where' : 'which';
    
    exec(`${cmd} ${command}`, (error) => {
      if (error) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// Check if an MCP server is responding
async function checkMCPServerConnection(server: any): Promise<boolean> {
  // For MCP servers, we'll try to make a simple MCP connection
  // This is a simplified implementation - in a real-world scenario,
  // you would need to follow the MCP protocol more precisely
  return new Promise((resolve) => {
    try {
      // Extract port from environment variables or command line arguments
      let port = 0;
      
      // Try to find port in environment variables
      if (server.env && server.env.MCP_PORT) {
        port = parseInt(server.env.MCP_PORT, 10);
      }
      
      // Otherwise try to find port in command line arguments (simple check)
      if (!port && Array.isArray(server.args)) {
        for (let i = 0; i < server.args.length; i++) {
          if (server.args[i].includes('--port=')) {
            const portArg = server.args[i].split('=')[1];
            port = parseInt(portArg, 10);
            break;
          }
          if (server.args[i] === '--port' && i < server.args.length - 1) {
            port = parseInt(server.args[i + 1], 10);
            break;
          }
        }
      }
      
      // If we couldn't determine a port, assume port 8080 as fallback
      if (!port || isNaN(port)) {
        port = 8080;
      }
      
      // Try to connect to the port
      const socket = new net.Socket();
      
      socket.setTimeout(1000); // 1 second timeout
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(port, 'localhost');
    } catch (error) {
      console.error('Error checking server connection:', error);
      resolve(false);
    }
  });
}

// Salir cuando todas las ventanas estén cerradas, excepto en macOS. Allí, es común para las aplicaciones y sus barras de menú permanecer activas hasta que el usuario sale explícitamente con Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 