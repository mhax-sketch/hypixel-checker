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
ipcMain.handle('check-token', async (event, token, proxyType, reuseSameProxy = false) => {
  return new Promise(async (resolve, reject) => {
    const pythonScript = path.join(__dirname, 'python', 'checker.py');
    
    let proxyArg = 'none';
    
    // Handle Auto Rotate proxy selection
    if (proxyType === 'auto') {
      const proxy = proxyManager.getNextProxy(true, reuseSameProxy);
      
      if (proxy) {
        // Re-verify proxy safety before using it
        mainWindow.webContents.send('check-progress', '🔍 Verifying proxy safety...\n');
        const safetyCheck = await proxyManager.testHypixelSafety(proxy);
        
        if (!safetyCheck.safe) {
          // Proxy is now banned, mark it and try next one
          proxy.hypixelSafe = false;
          mainWindow.webContents.send('check-progress', `⚠️  Proxy ${proxy.address} is now banned! Trying next...\n`);
          
          const newProxy = proxyManager.getNextProxy(true, false);
          if (newProxy) {
            const newCheck = await proxyManager.testHypixelSafety(newProxy);
            if (newCheck.safe) {
              proxyArg = `${newProxy.type}:${newProxy.address}`;
              mainWindow.webContents.send('check-progress', `✅ Using fresh proxy: ${newProxy.address}\n`);
            } else {
              mainWindow.webContents.send('check-progress', '❌ No safe proxies available!\n');
            }
          }
        } else {
          // Proxy is still safe
          proxyArg = `${proxy.type}:${proxy.address}`;
          if (reuseSameProxy) {
            mainWindow.webContents.send('check-progress', `🔄 Reusing same proxy: ${proxy.address}\n`);
          } else {
            mainWindow.webContents.send('check-progress', `✅ Proxy verified safe: ${proxy.address}\n`);
          }
        }
      }
    }
    
    // Run Python checker script
    const python = spawn('python', [pythonScript, token, proxyArg]);
    
    let output = '';
    let errorOutput = '';
    let jsonOutput = '';

    python.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      
      // Only send non-JSON lines to the UI
      const lines = text.split('\n');
      lines.forEach(line => {
        // Skip JSON lines (they contain quotes and braces)
        if (!line.includes('"mc_name"') && !line.includes('"mc_uuid"') && 
            !line.includes('"status"') && !line.includes('"reason"') &&
            !line.trim().startsWith('{') && !line.trim().startsWith('}')) {
          mainWindow.webContents.send('check-progress', line + '\n');
        }
      });
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

ipcMain.handle('scrape-proxies', async (event, type) => {
  try {
    const count = await proxyManager.scrapeProxies(type);
    const stats = proxyManager.getStats();
    return {
      count,
      stats,
      proxies: proxyManager.proxies.slice(0, 100)
    };
  } catch (error) {
    throw new Error('Failed to scrape proxies: ' + error.message);
  }
});

ipcMain.handle('test-proxies', async (event, checkHypixel = false) => {
  try {
    const results = await proxyManager.testAllProxies(10, (progress) => {
      mainWindow.webContents.send('proxy-progress', progress);
    }, checkHypixel);
    
    const stats = proxyManager.getStats();
    
    const proxiesToShow = checkHypixel 
      ? proxyManager.getHypixelSafeProxies().slice(0, 100)
      : proxyManager.proxies.slice(0, 100);
    
    return {
      ...results,
      stats,
      proxies: proxiesToShow
    };
  } catch (error) {
    throw new Error('Failed to test proxies: ' + error.message);
  }
});

ipcMain.handle('clear-proxies', async () => {
  proxyManager.clear();
  return { success: true };
});

ipcMain.handle('export-proxies', async () => {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Proxies',
      defaultPath: 'proxies-hypixel-safe.txt',
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (filePath) {
      const data = proxyManager.exportProxies(true);
      await fs.writeFile(filePath, data, 'utf8');
      return { success: true, path: filePath };
    }
    
    return { success: false };
  } catch (error) {
    throw new Error('Failed to export proxies: ' + error.message);
  }
});

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