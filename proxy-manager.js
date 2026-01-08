const axios = require('axios');
const { spawn } = require('child_process');

class ProxyManager {
    constructor() {
        this.proxies = [];
        this.currentIndex = 0;
        this.testedProxies = new Map(); // proxy -> {alive, speed, lastChecked}
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
                proxy: false // Disable axios default proxy
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

            this.testedProxies.set(proxy.address, {
                alive: true,
                speed: speed,
                lastChecked: Date.now()
            });

            return { alive: true, speed };
        } catch (error) {
            this.testedProxies.set(proxy.address, {
                alive: false,
                speed: null,
                lastChecked: Date.now()
            });
            return { alive: false, speed: null };
        }
    }

    // Test all proxies (with concurrency limit)
    async testAllProxies(concurrency = 10, onProgress) {
        const results = { alive: 0, dead: 0, total: this.proxies.length };
        
        // Split into chunks
        for (let i = 0; i < this.proxies.length; i += concurrency) {
            const chunk = this.proxies.slice(i, i + concurrency);
            
            await Promise.all(chunk.map(async (proxy) => {
                const result = await this.testProxy(proxy);
                proxy.alive = result.alive;
                proxy.speed = result.speed;
                
                if (result.alive) {
                    results.alive++;
                } else {
                    results.dead++;
                }

                if (onProgress) {
                    onProgress({
                        tested: i + chunk.indexOf(proxy) + 1,
                        alive: results.alive,
                        dead: results.dead,
                        total: results.total
                    });
                }
            }));
        }

        // Sort by speed (fastest first)
        this.proxies = this.proxies.filter(p => p.alive).sort((a, b) => a.speed - b.speed);
        return results;
    }

    // Get next proxy (round-robin)
    getNextProxy() {
        if (this.proxies.length === 0) return null;
        const proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return proxy;
    }

    // Get proxies by country
    getProxiesByCountry(countryCode) {
        return this.proxies.filter(p => p.country === countryCode);
    }

    // Get fastest proxies
    getFastestProxies(count = 10) {
        return this.proxies
            .filter(p => p.alive)
            .sort((a, b) => a.speed - b.speed)
            .slice(0, count);
    }

    // Export proxies to text
    exportProxies() {
        return this.proxies
            .filter(p => p.alive)
            .map(p => p.address)
            .join('\n');
    }

    // Import proxies from text
    importProxies(text, type = 'http') {
        const addresses = text.split('\n').filter(p => p.trim());
        const imported = addresses.map(address => ({
            address: address.trim(),
            type: type,
            alive: null,
            speed: null,
            country: 'Unknown'
        }));
        this.proxies = this.removeDuplicates([...this.proxies, ...imported]);
        return imported.length;
    }

    // Clear all proxies
    clear() {
        this.proxies = [];
        this.currentIndex = 0;
        this.testedProxies.clear();
    }

    // Get statistics
    getStats() {
        const alive = this.proxies.filter(p => p.alive).length;
        const dead = this.proxies.filter(p => p.alive === false).length;
        const untested = this.proxies.filter(p => p.alive === null).length;

        return {
            total: this.proxies.length,
            alive,
            dead,
            untested,
            avgSpeed: alive > 0 ? 
                this.proxies.filter(p => p.alive).reduce((sum, p) => sum + p.speed, 0) / alive : 
                0
        };
    }
}

module.exports = ProxyManager;

// Install required dependencies:
// npm install axios