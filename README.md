# MCP Manager

MCP Manager is an Electron-based desktop application for managing Model Context Protocol (MCP) servers. It provides an intuitive graphical interface to configure, monitor, and manage MCP servers with ease.

![MCP Manager Screenshot](./docs/img/img-0.png)


## Features

![MCP Manager Screenshot](./docs/img/demo.gif)

- 🖥️ **Visual Server Management**: Add, edit, and remove MCP servers through a user-friendly interface.
- 🔄 **Real-time Status Monitoring**: Check the status of your servers with one click.
- 🛠️ **Advanced Configuration**: Customize command, arguments, and environment variables for each server.
- 📋 **JSON Import/Export**: Import and export server configurations in JSON format.
- 🔍 **Direct JSON Editing**: View and edit the raw configuration file if needed.

## Installation

### Direct Download

You can download the latest pre-built application for your platform:

- [macOS (DMG)](https://github.com/timetime-software/mcp-manager/raw/main/release/MCP%20Manager-1.0.0.dmg)
- [macOS (ZIP)](https://github.com/timetime-software/mcp-manager/raw/main/release/MCP%20Manager-1.0.0-mac.zip)

### Building from Source

If you prefer to build the application yourself:

1. Clone the repository:
   ```bash
   git clone https://github.com/iagolast/mcp-manager.git
   cd mcp-manager
   ```

2. Install dependencies:
   ```bash
   npm install
   # or if you prefer pnpm
   pnpm install
   ```

3. Build the application:
   ```bash
   npm run build
   # or with pnpm
   pnpm build
   ```

4. Create distributables:
   ```bash
   npm run dist
   # or with pnpm
   pnpm dist
   ```

The built application will be available in the `release` directory.

## Development

### Running in Development Mode

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/iagolast/mcp-manager.git
   cd mcp-manager
   npm install
   # or if you prefer pnpm
   pnpm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   # or with pnpm
   pnpm dev
   ```

This will launch both the Vite development server for the React frontend and the Electron application.

### Project Structure

- `src/renderer`: React application code (UI components)
- `src/renderer/components`: React components
- `src/renderer/services`: Services for managing configuration and server communication
- `src/renderer/types`: TypeScript type definitions
- `electron`: Electron main process code

### Testing

Run the tests with:
```bash
npm test
# or with pnpm
pnpm test
```

For development with continuous testing:
```bash
npm run test:watch
# or with pnpm
pnpm test:watch
```

## Configuration

MCP Manager stores its configuration in:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- Built with [Electron](https://www.electronjs.org/)
- Frontend developed with [React](https://reactjs.org/) and [TypeScript](https://www.typescriptlang.org/)
- UI styled with CSS-in-JS techniques 
