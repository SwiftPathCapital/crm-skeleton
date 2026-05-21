const { app, BrowserWindow, session } = require('electron')
const { join } = require('path')
const { spawn } = require('child_process')

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#080b10',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// In dev mode electron-vite loads the renderer from the Vite dev server
// (http://localhost:5173), so we need to start the Express API server ourselves.
let serverProcess = null;
if (process.env['ELECTRON_RENDERER_URL']) {
  serverProcess = spawn('node', [join(__dirname, '../../server/index.js')], {
    stdio: 'inherit',
    env: process.env,
  });
}

app.on('quit', () => { if (serverProcess) serverProcess.kill(); });

app.whenReady().then(() => {
  // Grant microphone access so Telnyx WebRTC getUserMedia works in Electron
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media' || permission === 'microphone');
  });

  // Allow all requests including localhost and WebRTC signaling
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({ requestHeaders: details.requestHeaders })
  })

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
