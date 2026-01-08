const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const ProxyManager = require('./proxy-manager');

let mainWindow;
const proxyManager = new ProxyManager();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 950,
    height: 800,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    frame: true,
    backgroundColor: '#1e1e2e'
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ===== TOKEN CHECKING =====
ipcMain.handle('check-token', async (event, token, proxyType) => {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'python', 'checker.py');
    
    // Get proxy if needed
    let proxyArg = 'none';
    if (proxyType === 'auto') {
      const proxy = proxyManager.getNextProxy();
      if (proxy) {
        proxyArg = `${proxy.type}:${proxy.address}`;
      }
    }
    
    const python = spawn('python', [pythonScript, token, proxyArg]);
    
    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
      mainWindow.webContents.send('check-progress', data.toString());
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          reject({ error: 'Failed to parse response' });
        }
      } else {
        reject({ error: errorOutput || 'Python script failed' });
      }
    });
  });
});

// ===== PROXY MANAGEMENT =====

// Scrape proxies
ipcMain.handle('scrape-proxies', async (event, type) => {
  try {
    const count = await proxyManager.scrapeProxies(type);
    const stats = proxyManager.getStats();
    return {
      count,
      stats,
      proxies: proxyManager.proxies.slice(0, 100) // Return first 100 for display
    };
  } catch (error) {
    throw new Error('Failed to scrape proxies: ' + error.message);
  }
});

// Test proxies
ipcMain.handle('test-proxies', async (event) => {
  try {
    const results = await proxyManager.testAllProxies(10, (progress) => {
      mainWindow.webContents.send('proxy-progress', progress);
    });
    
    const stats = proxyManager.getStats();
    return {
      ...results,
      stats,
      proxies: proxyManager.proxies.slice(0, 100)
    };
  } catch (error) {
    throw new Error('Failed to test proxies: ' + error.message);
  }
});

// Clear proxies
ipcMain.handle('clear-proxies', async () => {
  proxyManager.clear();
  return { success: true };
});

// Export proxies
ipcMain.handle('export-proxies', async () => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Proxies',
      defaultPath: 'proxies.txt',
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (filePath) {
      const data = proxyManager.exportProxies();
      await fs.writeFile(filePath, data, 'utf8');
      return { success: true, path: filePath };
    }
    
    return { success: false };
  } catch (error) {
    throw new Error('Failed to export proxies: ' + error.message);
  }
});

// Import proxies
ipcMain.handle('import-proxies', async () => {
  try {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Proxies',
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
      properties: ['openFile']
    });

    if (filePaths && filePaths[0]) {
      const data = await fs.readFile(filePaths[0], 'utf8');
      const count = proxyManager.importProxies(data);
      const stats = proxyManager.getStats();
      
      return {
        count,
        stats,
        proxies: proxyManager.proxies.slice(0, 100)
      };
    }
    
    return { count: 0 };
  } catch (error) {
    throw new Error('Failed to import proxies: ' + error.message);
  }
});