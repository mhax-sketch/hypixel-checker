const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Token checking
  checkToken: (token, proxyType) => ipcRenderer.invoke('check-token', token, proxyType),
  onProgress: (callback) => ipcRenderer.on('check-progress', (event, data) => callback(data)),
  
  // Proxy management
  scrapeProxies: (type) => ipcRenderer.invoke('scrape-proxies', type),
  testProxies: () => ipcRenderer.invoke('test-proxies'),
  clearProxies: () => ipcRenderer.invoke('clear-proxies'),
  exportProxies: () => ipcRenderer.invoke('export-proxies'),
  importProxies: () => ipcRenderer.invoke('import-proxies'),
  onProxyProgress: (callback) => ipcRenderer.on('proxy-progress', (event, data) => callback(data))
});