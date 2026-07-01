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

function startGoServer(port = '8080') {
  serverPort = port;
  checkServerStatus(port);
}

function stopGoServer() {
  // Arka plandaki sistem servisine dokunmuyoruz, sadece statüyü güncelliyoruz
  serverStatus = 'stopped';
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
