const { app, BrowserWindow, ipcMain, session, desktopCapturer } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');

const isDev = !app.isPackaged;
let serverProcess = null;
let serverPort = '8080';
let serverStatus = 'stopped';

// Compile Go server on launch
function buildGoServer() {
  try {
    console.log('Building Go server...');
    const buildCmd = process.platform === 'win32' ? 'go build -o server_bin.exe main.go' : 'go build -o server_bin main.go';
    execSync(buildCmd, { cwd: path.join(__dirname, '../server') });
    console.log('Go server built successfully!');
  } catch (err) {
    console.error('Failed to build Go server:', err.message);
  }
}

function startGoServer(port = '8080') {
  if (serverProcess) {
    stopGoServer();
  }
  
  serverPort = port;
  const binName = process.platform === 'win32' ? 'server_bin.exe' : './server_bin';
  
  try {
    serverProcess = spawn(binName, ['-port', port], {
      cwd: path.join(__dirname, '../server'),
      env: { ...process.env, PORT: port }
    });
    
    serverStatus = 'running';
    console.log(`Go server started on port ${port}`);

    serverProcess.stdout.on('data', (data) => {
      console.log(`[Go Server] ${data.toString().trim()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[Go Server Error] ${data.toString().trim()}`);
    });

    serverProcess.on('close', (code) => {
      console.log(`Go server process exited with code ${code}`);
      serverStatus = 'stopped';
      serverProcess = null;
    });
  } catch (err) {
    console.error('Failed to start Go server process:', err.message);
    serverStatus = 'stopped';
  }
}

function stopGoServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    serverStatus = 'stopped';
    console.log('Go server stopped.');
  }
}

function createWindow() {
  // Build and start Go server automatically
  buildGoServer();
  startGoServer(serverPort);

  // Enable getDisplayMedia support in Electron
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (sources.length > 0) {
        callback({ video: sources[0] });
      } else {
        callback({ error: 'No screens found' });
      }
    });
  });

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// IPC Handlers
ipcMain.on('server-control', (event, arg) => {
  const { action, port } = arg;
  if (action === 'start') {
    startGoServer(port || serverPort);
  } else if (action === 'stop') {
    stopGoServer();
  } else if (action === 'restart') {
    stopGoServer();
    setTimeout(() => startGoServer(port || serverPort), 500);
  }
  event.reply('server-status', { status: serverStatus, port: serverPort });
});

ipcMain.on('get-server-status', (event) => {
  event.reply('server-status', { status: serverStatus, port: serverPort });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  stopGoServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  stopGoServer();
});
