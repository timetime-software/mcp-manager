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
      const connectionResult = await checkMCPServerConnection(server);
      console.log(`Connection result for ${serverId}:`, connectionResult);
      
      return { 
        success: connectionResult.connected,
        port: connectionResult.port,
        error: connectionResult.error
      };
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
async function checkMCPServerConnection(server: any): Promise<{ connected: boolean; port?: number; error?: string }> {
  // For MCP servers, we'll try to make a simple MCP connection
  // This is a simplified implementation - in a real-world scenario,
  // you would need to follow the MCP protocol more precisely
  return new Promise((resolve) => {
    try {
      // Extract port from environment variables or command line arguments
      let ports: number[] = [];
      
      // Try to find port in environment variables
      if (server.env && server.env.MCP_PORT) {
        ports.push(parseInt(server.env.MCP_PORT, 10));
      }
      
      // Also check for HTTP_PORT or API_PORT in environment variables
      if (server.env && server.env.HTTP_PORT) {
        ports.push(parseInt(server.env.HTTP_PORT, 10));
      }
      
      if (server.env && server.env.API_PORT) {
        ports.push(parseInt(server.env.API_PORT, 10));
      }
      
      // Check for more environment variables that might contain port information
      const portEnvVars = ['PORT', 'SERVER_PORT', 'APP_PORT', 'WEB_PORT', 'SERVICE_PORT'];
      for (const envVar of portEnvVars) {
        if (server.env && server.env[envVar]) {
          ports.push(parseInt(server.env[envVar], 10));
        }
      }
      
      // Try to find port in command line arguments (more thorough check)
      if (Array.isArray(server.args)) {
        for (let i = 0; i < server.args.length; i++) {
          // Check for --port=8080 format
          if (server.args[i].includes('--port=')) {
            const portArg = server.args[i].split('=')[1];
            ports.push(parseInt(portArg, 10));
          }
          // Check for --port 8080 format
          else if (server.args[i] === '--port' && i < server.args.length - 1) {
            ports.push(parseInt(server.args[i + 1], 10));
          }
          // Check for -p 8080 format
          else if (server.args[i] === '-p' && i < server.args.length - 1) {
            ports.push(parseInt(server.args[i + 1], 10));
          }
          // Check for --http-port=8080 or --api-port=8080 format
          else if (server.args[i].includes('--http-port=') || server.args[i].includes('--api-port=')) {
            const portArg = server.args[i].split('=')[1];
            ports.push(parseInt(portArg, 10));
          }
          // Check for any argument that might contain a port number
          else if (/--\w+-port=\d+/.test(server.args[i])) {
            const portArg = server.args[i].split('=')[1];
            ports.push(parseInt(portArg, 10));
          }
        }
      }
      
      // Add common fallback ports if we couldn't determine any
      if (ports.length === 0 || ports.every(p => isNaN(p))) {
        // Common ports for MCP servers
        ports = [8080, 3000, 5000, 8000, 8888, 9000, 4000];
      }
      
      // Filter out invalid ports and remove duplicates
      ports = Array.from(new Set(ports.filter(p => !isNaN(p) && p > 0 && p < 65536)));
      
      console.log(`Checking server on ports: ${ports.join(', ')}`);
      
      // Try each port in sequence
      let portIndex = 0;
      let lastError = '';
      
      const tryNextPort = () => {
        if (portIndex >= ports.length) {
          // We've tried all ports and none worked
          resolve({ 
            connected: false, 
            error: lastError || 'Failed to connect to any port' 
          });
          return;
        }
        
        const port = ports[portIndex++];
        const socket = new net.Socket();
        
        socket.setTimeout(3000); // 3 second timeout (more generous)
        
        socket.on('connect', () => {
          console.log(`Successfully connected to port ${port}`);
          socket.destroy();
          resolve({ connected: true, port });
        });
        
        socket.on('timeout', () => {
          console.log(`Connection to port ${port} timed out`);
          lastError = `Connection to port ${port} timed out`;
          socket.destroy();
          tryNextPort();
        });
        
        socket.on('error', (err) => {
          console.log(`Error connecting to port ${port}: ${err.message}`);
          lastError = err.message;
          socket.destroy();
          tryNextPort();
        });
        
        socket.connect(port, 'localhost');
      };
      
      // Start trying ports
      tryNextPort();
    } catch (error) {
      console.error('Error checking server connection:', error);
      resolve({ connected: false, error: error.message });
    }
  });
}

// Salir cuando todas las ventanas estén cerradas, excepto en macOS. Allí, es común para las aplicaciones y sus barras de menú permanecer activas hasta que el usuario sale explícitamente con Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 
