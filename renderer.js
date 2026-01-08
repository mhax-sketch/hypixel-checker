// ===== TAB SWITCHING =====
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // Remove active class from all
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked
        btn.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    });
});

// ===== TOKEN CHECKER =====
const tokenInput = document.getElementById('tokenInput');
const checkBtn = document.getElementById('checkBtn');
const clearBtn = document.getElementById('clearBtn');
const results = document.getElementById('results');
const status = document.getElementById('status');
const reuseSameProxyCheckbox = document.getElementById('reuseSameProxy');

let isChecking = false;

function log(message, type = 'info') {
    const line = document.createElement('div');
    line.className = `log-${type}`;
    line.textContent = message;
    results.appendChild(line);
    results.scrollTop = results.scrollHeight;
}

function updateStatus(message) {
    status.textContent = message;
}

clearBtn.addEventListener('click', () => {
    tokenInput.value = '';
    results.innerHTML = '';
    updateStatus('Cleared');
});

checkBtn.addEventListener('click', async () => {
    if (isChecking) return;

    const token = tokenInput.value.trim();
    
    if (!token) {
        alert('Please enter a session token');
        return;
    }

    if (!token.startsWith('eyJ')) {
        alert('Token must start with "eyJ"');
        return;
    }

    const proxyType = document.querySelector('input[name="proxy"]:checked').value;
    const reuseSameProxy = reuseSameProxyCheckbox.checked;

    isChecking = true;
    checkBtn.disabled = true;
    checkBtn.textContent = 'CHECKING...';
    results.innerHTML = '';

    try {
        log('='.repeat(70), 'info');
        log(`Checking token: ${token.substring(0, 40)}...`, 'info');
        updateStatus('Checking token...');

        const result = await window.electronAPI.checkToken(token, proxyType, reuseSameProxy);

        log('='.repeat(70), 'info');
        log('RESULTS:', 'info');
        log('='.repeat(70), 'info');
        log(`MC Name: ${result.mc_name}`, 'info');
        log(`MC UUID: ${result.mc_uuid}`, 'info');

        if (result.status === 'unbanned') {
            log('✔ STATUS: UNBANNED', 'success');
            updateStatus(`${result.mc_name} is unbanned`);
        } else if (result.status === 'banned') {
            log('✗ STATUS: BANNED', 'error');
            log(`  Reason: ${result.reason}`, 'error');
            log(`  Time Left: ${result.time_left}`, 'warning');
            log(`  Ban ID: ${result.ban_id}`, 'warning');
            updateStatus(`${result.mc_name} is banned`);
        } else {
            log(`⚠ STATUS: ${result.status.toUpperCase()}`, 'warning');
            updateStatus('Check complete');
        }

        log('='.repeat(70), 'info');

    } catch (error) {
        log(`✗ ERROR: ${error.error || error.message || 'Unknown error'}`, 'error');
        updateStatus('Error occurred');
    } finally {
        isChecking = false;
        checkBtn.disabled = false;
        checkBtn.textContent = 'CHECK TOKEN';
    }
});

// Listen for progress updates from Python script
window.electronAPI.onProgress((data) => {
    const lines = data.split('\n').filter(l => l.trim());
    lines.forEach(line => {
        if (line.includes('ERROR') || line.includes('✗')) {
            log(line, 'error');
        } else if (line.includes('✓') || line.includes('SUCCESS') || line.includes('✅')) {
            log(line, 'success');
        } else if (line.includes('⚠') || line.includes('WARNING')) {
            log(line, 'warning');
        } else if (line.trim()) {
            log(line, 'info');
        }
    });
});

// Listen for progress updates from Python script
window.electronAPI.onProgress((data) => {
    const lines = data.split('\n').filter(l => l.trim());
    lines.forEach(line => {
        if (line.includes('ERROR') || line.includes('✗')) {
            log(line, 'error');
        } else if (line.includes('✓') || line.includes('SUCCESS')) {
            log(line, 'success');
        } else if (line.includes('⚠') || line.includes('WARNING')) {
            log(line, 'warning');
        } else {
            log(line, 'info');
        }
    });
});

// ===== PROXY MANAGER =====
const scrapeBtn = document.getElementById('scrapeBtn');
const testBtn = document.getElementById('testBtn');
const clearProxiesBtn = document.getElementById('clearProxiesBtn');
const importBtn = document.getElementById('importBtn');
const exportBtn = document.getElementById('exportBtn');
const proxyType = document.getElementById('proxyType');
const proxyList = document.getElementById('proxyList');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

// Stat elements
const totalProxies = document.getElementById('totalProxies');
const aliveProxies = document.getElementById('aliveProxies');
const hypixelSafeProxies = document.getElementById('hypixelSafeProxies');
const deadProxies = document.getElementById('deadProxies');
const avgSpeed = document.getElementById('avgSpeed');
const checkHypixel = document.getElementById('checkHypixel');

function updateProxyStats(stats) {
    totalProxies.textContent = stats.total;
    aliveProxies.textContent = stats.alive;
    hypixelSafeProxies.textContent = stats.hypixelSafe || 0;
    deadProxies.textContent = (stats.dead || 0) + (stats.hypixelBanned || 0);
    avgSpeed.textContent = stats.avgSpeed ? `${Math.round(stats.avgSpeed)}ms` : '0ms';
}

function updateProxyList(proxies) {
    proxyList.innerHTML = '';
    
    if (proxies.length === 0) {
        proxyList.innerHTML = '<div style="text-align: center; opacity: 0.5; padding: 20px;">No proxies loaded</div>';
        return;
    }

    proxies.forEach(proxy => {
        const item = document.createElement('div');
        
        // Determine class based on status
        let statusClass = '';
        let statusBadge = '';
        
        if (proxy.hypixelSafe === true) {
            statusClass = 'hypixel-safe';
            statusBadge = '<span class="status-badge safe">🛡️ SAFE</span>';
        } else if (proxy.hypixelSafe === false && proxy.alive) {
            statusClass = 'hypixel-banned';
            statusBadge = '<span class="status-badge banned">⚠️ BANNED</span>';
        } else if (proxy.alive === true) {
            statusClass = 'alive';
            statusBadge = '<span class="status-badge">✔</span>';
        } else if (proxy.alive === false) {
            statusClass = 'dead';
            statusBadge = '<span class="status-badge">✗</span>';
        }
        
        item.className = `proxy-item ${statusClass}`;
        
        item.innerHTML = `
            <span class="proxy-address">${proxy.address}</span>
            <div class="proxy-info">
                ${statusBadge}
                <span class="proxy-type">${proxy.type}</span>
                ${proxy.speed ? `<span class="proxy-speed">${proxy.speed}ms</span>` : ''}
            </div>
        `;
        
        proxyList.appendChild(item);
    });
}

function showProgress(show) {
    progressContainer.style.display = show ? 'block' : 'none';
    if (!show) {
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
    }
}

function updateProgress(current, total) {
    const percent = Math.round((current / total) * 100);
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
}

// Scrape proxies
scrapeBtn.addEventListener('click', async () => {
    scrapeBtn.disabled = true;
    scrapeBtn.textContent = '🔄 Scraping...';
    updateStatus('Scraping proxies from sources...');

    try {
        const type = proxyType.value;
        const result = await window.electronAPI.scrapeProxies(type);
        
        updateStatus(`Scraped ${result.count} proxies`);
        updateProxyStats(result.stats);
        updateProxyList(result.proxies);
    } catch (error) {
        alert('Error scraping proxies: ' + (error.message || 'Unknown error'));
    } finally {
        scrapeBtn.disabled = false;
        scrapeBtn.textContent = '🌐 Scrape Proxies';
    }
});

// Test all proxies
testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    testBtn.textContent = '⏳ Testing...';
    const shouldCheckHypixel = checkHypixel.checked;
    updateStatus(shouldCheckHypixel ? 'Testing proxies + Hypixel safety...' : 'Testing proxies...');
    showProgress(true);

    try {
        // Listen for progress updates
        const progressHandler = (progress) => {
            updateProgress(progress.tested, progress.total);
            if (shouldCheckHypixel) {
                updateStatus(`Testing: ${progress.tested}/${progress.total} (${progress.hypixelSafe} safe, ${progress.hypixelBanned} banned)`);
            } else {
                updateStatus(`Testing: ${progress.tested}/${progress.total} (${progress.alive} alive)`);
            }
        };

        window.electronAPI.onProxyProgress(progressHandler);

        const result = await window.electronAPI.testProxies(shouldCheckHypixel);
        
        if (shouldCheckHypixel) {
            updateStatus(`Complete: ${result.hypixelSafe} Hypixel-safe, ${result.hypixelBanned} banned, ${result.dead} dead`);
        } else {
            updateStatus(`Complete: ${result.alive} alive, ${result.dead} dead`);
        }
        
        updateProxyStats(result.stats);
        updateProxyList(result.proxies);
    } catch (error) {
        alert('Error testing proxies: ' + (error.message || 'Unknown error'));
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = '✓ Test All';
        showProgress(false);
    }
});

// Clear proxies
clearProxiesBtn.addEventListener('click', async () => {
    if (!confirm('Clear all proxies?')) return;

    await window.electronAPI.clearProxies();
    updateProxyStats({ total: 0, alive: 0, dead: 0, hypixelSafe: 0, avgSpeed: 0 });
    updateProxyList([]);
    updateStatus('Proxies cleared');
});

// Export proxies
exportBtn.addEventListener('click', async () => {
    try {
        await window.electronAPI.exportProxies();
        updateStatus('Hypixel-safe proxies exported successfully');
    } catch (error) {
        alert('Error exporting: ' + (error.message || 'Unknown error'));
    }
});

// Import proxies
importBtn.addEventListener('click', async () => {
    try {
        const result = await window.electronAPI.importProxies();
        updateStatus(`Imported ${result.count} proxies`);
        updateProxyStats(result.stats);
		updateProxyList(result.proxies);
} catch (error) {
    alert('Error importing: ' + (error.message || 'Unknown error'));
}
});
