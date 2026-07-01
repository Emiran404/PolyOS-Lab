const { app, BrowserWindow, ipcMain, session, desktopCapturer } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');

const isDev = !app.isPackaged;
let serverProcess = null;
let serverPort = '8080';
let serverStatus = 'stopped';

const net = require('net');

function checkServerStatus(port) {
  const tester = net.createServer()
    .once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        if (serverStatus !== 'running') {
          serverStatus = 'running';
          sendServerStatus();
        }
      } else {
        if (serverStatus !== 'stopped') {
          serverStatus = 'stopped';
          sendServerStatus();
        }
      }
    })
    .once('listening', () => {
      tester.once('close', () => {
        if (serverStatus !== 'stopped') {
          serverStatus = 'stopped';
          sendServerStatus();
        }
      })
      .close();
    })
    .listen(port);
}

function checkPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(true);
        }
      })
      .once('listening', () => {
        tester.once('close', () => {
          resolve(true);
        })
        .close();
      })
      .listen(port);
  });
}

async function startGoServer(port = '8080') {
  serverPort = port;
  const isFree = await checkPortFree(port);
  
  if (!isFree) {
    console.log(`Port ${port} is already in use. Assuming background daemon is active.`);
    serverStatus = 'running';
    sendServerStatus();
    return;
  }

  if (serverProcess) {
    stopGoServer();
  }

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
    console.log(`Starting integrated Go server from: ${binPath}`);
    serverProcess = spawn(binPath, ['-port', port, '-token', 'polyos-secure-token'], {
      cwd: cwdPath,
      env: { ...process.env, PORT: port }
    });

    serverStatus = 'running';
    sendServerStatus();

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
      sendServerStatus();
    });
  } catch (err) {
    console.error('Failed to start integrated Go server process:', err.message);
    serverStatus = 'stopped';
    sendServerStatus();
  }
}

function stopGoServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    serverStatus = 'stopped';
    console.log('Go server stopped.');
  } else {
    serverStatus = 'stopped';
  }
  sendServerStatus();
}

function sendServerStatus() {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows[0].webContents.send('server-status', { status: serverStatus, port: serverPort });
  }
}

function createWindow() {
  startGoServer(serverPort);

  // Arka plandaki sunucunun durumunu periyodik olarak kontrol et
  setInterval(() => {
    checkServerStatus(serverPort);
  }, 2500);

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
