const axios = require('axios');

class ProxyManager {
    constructor() {
        this.proxies = [];
        this.currentIndex = 0;
        this.lastUsedProxy = null; // Track the last proxy used for reuse
    }

    // Scrape proxies from free sources
    async scrapeProxies(type = 'all') {
        const sources = {
            http: [
                'https://api.proxyscrape.com/v2/?request=get&protocol=http&timeout=5000&country=all',
                'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
                'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt'
            ],
            socks4: [
                'https://api.proxyscrape.com/v2/?request=get&protocol=socks4&timeout=5000&country=all',
                'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt'
            ],
            socks5: [
                'https://api.proxyscrape.com/v2/?request=get&protocol=socks5&timeout=5000&country=all',
                'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt'
            ]
        };

        let allProxies = [];
        const sourcesToFetch = type === 'all' ? 
            [...sources.http, ...sources.socks4, ...sources.socks5] : 
            sources[type] || [];

        for (const url of sourcesToFetch) {
            try {
                const response = await axios.get(url, { timeout: 10000 });
                const proxies = response.data.split('\n').filter(p => p.trim());
                allProxies = allProxies.concat(proxies.map(p => ({
                    address: p.trim(),
                    type: this.detectProxyType(url),
                    alive: null,
                    speed: null,
                    hypixelSafe: null,
                    lastHypixelCheck: null,
                    country: 'Unknown'
                })));
            } catch (error) {
                console.error(`Failed to fetch from ${url}:`, error.message);
            }
        }

        this.proxies = this.removeDuplicates(allProxies);
        return this.proxies.length;
    }

    detectProxyType(url) {
        if (url.includes('socks5')) return 'socks5';
        if (url.includes('socks4')) return 'socks4';
        return 'http';
    }

    removeDuplicates(proxies) {
        const seen = new Set();
        return proxies.filter(p => {
            if (seen.has(p.address)) return false;
            seen.add(p.address);
            return true;
        });
    }

    // Test if a proxy is alive
    async testProxy(proxy, timeout = 5000) {
        const testUrl = 'https://www.google.com';
        const startTime = Date.now();

        try {
            const config = {
                timeout: timeout,
                proxy: false
            };

            // For HTTP proxies, use axios with proxy config
            if (proxy.type === 'http') {
                const [host, port] = proxy.address.split(':');
                config.proxy = {
                    host: host,
                    port: parseInt(port)
                };
            }

            await axios.get(testUrl, config);
            const speed = Date.now() - startTime;

            return { alive: true, speed };
        } catch (error) {
            return { alive: false, speed: null };
        }
    }

    // Check if proxy is banned on Hypixel
    async testHypixelSafety(proxy, timeout = 10000) {
        try {
            const [host, port] = proxy.address.split(':');
            
            const websiteConfig = {
                timeout: timeout,
                proxy: false,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            };

            if (proxy.type === 'http') {
                websiteConfig.proxy = {
                    host: host,
                    port: parseInt(port)
                };
            }

            // Test Hypixel website access
            try {
                const response = await axios.get('https://hypixel.net', websiteConfig);
                
                if (response.data.includes('blocked') || 
                    response.data.includes('Access denied') ||
                    response.data.includes('Ray ID') ||
                    response.status === 403) {
                    
                    proxy.lastHypixelCheck = Date.now();
                    proxy.hypixelSafe = false;
                    
                    return { safe: false, reason: 'Website blocked' };
                }
            } catch (error) {
                if (error.response && error.response.status === 403) {
                    proxy.lastHypixelCheck = Date.now();
                    proxy.hypixelSafe = false;
                    return { safe: false, reason: 'HTTP 403 Forbidden' };
                }
                if (error.code === 'ECONNREFUSED') {
                    proxy.lastHypixelCheck = Date.now();
                    proxy.hypixelSafe = false;
                    return { safe: false, reason: 'Connection refused' };
                }
            }

            // Test Hypixel API access
            try {
                const apiConfig = { ...websiteConfig };
                const apiResponse = await axios.get('https://api.hypixel.net/status', apiConfig);
                
                if (apiResponse.data.success === false) {
                    proxy.lastHypixelCheck = Date.now();
                    proxy.hypixelSafe = false;
                    return { safe: false, reason: 'API rejected' };
                }
            } catch (error) {
                if (error.response && error.response.status === 403) {
                    proxy.lastHypixelCheck = Date.now();
                    proxy.hypixelSafe = false;
                    return { safe: false, reason: 'API blocked' };
                }
            }

            proxy.lastHypixelCheck = Date.now();
            proxy.hypixelSafe = true;
            
            return { safe: true, reason: 'Verified' };

        } catch (error) {
            proxy.lastHypixelCheck = Date.now();
            proxy.hypixelSafe = false;
            return { safe: false, reason: error.message };
        }
    }

    // Test all proxies
    async testAllProxies(concurrency = 10, onProgress, checkHypixel = false) {
        const results = { alive: 0, dead: 0, hypixelSafe: 0, hypixelBanned: 0, total: this.proxies.length };
        
        for (let i = 0; i < this.proxies.length; i += concurrency) {
            const chunk = this.proxies.slice(i, i + concurrency);
            
            await Promise.all(chunk.map(async (proxy) => {
                const result = await this.testProxy(proxy);
                proxy.alive = result.alive;
                proxy.speed = result.speed;
                
                if (result.alive) {
                    results.alive++;

                    if (checkHypixel) {
                        const hypixelResult = await this.testHypixelSafety(proxy);
                        proxy.hypixelSafe = hypixelResult.safe;

                        if (hypixelResult.safe) {
                            results.hypixelSafe++;
                        } else {
                            results.hypixelBanned++;
                        }
                    }
                } else {
                    results.dead++;
                    proxy.hypixelSafe = false;
                }

                if (onProgress) {
                    onProgress({
                        tested: i + chunk.indexOf(proxy) + 1,
                        alive: results.alive,
                        dead: results.dead,
                        hypixelSafe: results.hypixelSafe,
                        hypixelBanned: results.hypixelBanned,
                        total: results.total
                    });
                }
            }));
        }

        // Sort proxies: Hypixel-safe first, then by speed
        this.proxies = this.proxies
            .filter(p => p.alive)
            .sort((a, b) => {
                if (a.hypixelSafe && !b.hypixelSafe) return -1;
                if (!a.hypixelSafe && b.hypixelSafe) return 1;
                return a.speed - b.speed;
            });

        return results;
    }

    // Get next proxy (with option to reuse last proxy)
    getNextProxy(hypixelSafeOnly = true, reuseLast = false) {
        if (this.proxies.length === 0) return null;

        // If reuse is requested and we have a last proxy, return it
        if (reuseLast && this.lastUsedProxy) {
            return this.lastUsedProxy;
        }

        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        // Filter proxies: must be Hypixel-safe and recently checked
        const availableProxies = hypixelSafeOnly 
            ? this.proxies.filter(p => {
                const isRecent = p.lastHypixelCheck && (now - p.lastHypixelCheck < fiveMinutes);
                return p.hypixelSafe === true && isRecent;
            })
            : this.proxies;

        if (availableProxies.length === 0) return null;

        // Get next proxy from rotation
        const proxy = availableProxies[this.currentIndex % availableProxies.length];
        this.currentIndex = (this.currentIndex + 1) % availableProxies.length;
        
        // Store this as the last used proxy
        this.lastUsedProxy = proxy;
        
        return proxy;
    }

    // Get only Hypixel-safe proxies
    getHypixelSafeProxies() {
        return this.proxies.filter(p => p.alive && p.hypixelSafe === true);
    }

    // Export proxies
    exportProxies(hypixelSafeOnly = true) {
        return this.proxies
            .filter(p => p.alive && (!hypixelSafeOnly || p.hypixelSafe === true))
            .map(p => p.address)
            .join('\n');
    }

    // Import proxies
    importProxies(text, type = 'http') {
        const addresses = text.split('\n').filter(p => p.trim());
        const imported = addresses.map(address => ({
            address: address.trim(),
            type: type,
            alive: null,
            speed: null,
            hypixelSafe: null,
            lastHypixelCheck: null,
            country: 'Unknown'
        }));
        this.proxies = this.removeDuplicates([...this.proxies, ...imported]);
        return imported.length;
    }

    // Clear all proxies
    clear() {
        this.proxies = [];
        this.currentIndex = 0;
        this.lastUsedProxy = null;
    }

    // Get statistics
    getStats() {
        const alive = this.proxies.filter(p => p.alive).length;
        const dead = this.proxies.filter(p => p.alive === false).length;
        const untested = this.proxies.filter(p => p.alive === null).length;
        const hypixelSafe = this.proxies.filter(p => p.hypixelSafe === true).length;
        const hypixelBanned = this.proxies.filter(p => p.hypixelSafe === false && p.alive).length;

        return {
            total: this.proxies.length,
            alive,
            dead,
            untested,
            hypixelSafe,
            hypixelBanned,
            avgSpeed: alive > 0 ? 
                this.proxies.filter(p => p.alive).reduce((sum, p) => sum + p.speed, 0) / alive : 
                0
        };
    }
}

module.exports = ProxyManager;