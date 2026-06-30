const { app, BrowserWindow, ipcMain, session, desktopCapturer } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');

const isDev = !app.isPackaged;
let serverProcess = null;
let serverPort = '8080';
let serverStatus = 'stopped';

// Compile Go server on launch (only in development)
function buildGoServer() {
  if (!isDev) return;
  try {
    console.log('Building Go server...');
    const buildCmd = process.platform === 'win32' ? 'go build -o server_bin.exe main.go' : 'go build -o server_bin main.go';
    execSync(buildCmd, { cwd: path.join(__dirname, '../server') });
    console.log('Go server built successfully!');
  } catch (err) {
    console.error('Failed to build Go server:', err.message);
  }
}

function killProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      execSync(`for /f "tokens=5" %a in ('netstat -aon ^| findstr "${port}" ^| findstr /i "listening"') do taskkill /f /pid %a`, { stdio: 'ignore' });
    } else {
      execSync(`lsof -t -iTCP:${port} -sTCP:LISTEN | xargs kill -9`, { stdio: 'ignore' });
    }
    console.log(`Cleared port ${port}`);
  } catch (err) {
    // Port boş veya komut başarısız olduysa yoksay
  }
}

function startGoServer(port = '8080') {
  if (serverProcess) {
    stopGoServer();
  }
  
  killProcessOnPort(port);
  
  serverPort = port;
  let binPath;
  let cwdPath;

  if (isDev) {
    const binName = process.platform === 'win32' ? 'server_bin.exe' : './server_bin';
    binPath = binName;
    cwdPath = path.join(__dirname, '../server');
  } else {
    // Production'da extraResources klasöründen çalıştır
    const binName = process.platform === 'win32' ? 'polyos-server.exe' : 'polyos-server';
    binPath = path.join(process.resourcesPath, binName);
    cwdPath = process.resourcesPath;
  }
  
  try {
    console.log(`Starting Go server from: ${binPath}`);
    serverProcess = spawn(binPath, ['-port', port, '-token', 'polyos-secure-token'], {
      cwd: cwdPath,
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
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send('server-status', { status: 'stopped', port: serverPort });
      }
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
    title: "PolyOS Lab - Öğretmen Paneli",
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5170');
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
