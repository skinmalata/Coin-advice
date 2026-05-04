document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initPriceTracker();
    initPortfolio();
    initTrending();
    initDexScanner();
    initTokenChecker();
    initCharts();
    initArbitrage();
    initAirdrops();
    initGlobalStats();
});

window.navigateTo = function(tabName) {
    const tab = document.getElementById(tabName);
    if (!tab) return;
    
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    const navLink = document.querySelector(`.nav-link[data-tab="${tabName}"]`);
    if (navLink) navLink.classList.add('active');
    
    tab.classList.add('active');
    
    if (tabName === 'global-stats') loadGlobalStats();
    if (tabName === 'trending') loadTrending('gainers');
    if (tabName === 'arbitrage') scanArbitrage();
    if (tabName === 'airdrops') loadAirdrops();
    if (tabName === 'profit-calculator') renderProfitHistory();
};

function initTabs() {
    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = link.dataset.tab;
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            link.classList.add('active');
            document.getElementById(tab).classList.add('active');
            
            if (tab === 'global-stats') loadGlobalStats();
            if (tab === 'trending') loadTrending('gainers');
        });
    });
}

let priceInterval;
let lastPriceLoad = 0;
let priceCache = { coingecko: null, binance: null, timestamp: 0 };
let retryCount = 0;
const PRICE_POLL_INTERVAL = 60000; // 60 seconds
const CACHE_DURATION = 45000; // 45 seconds

function initPriceTracker() {
    loadPrices();
    priceInterval = setInterval(loadPrices, PRICE_POLL_INTERVAL);
    
    document.getElementById('search-crypto').addEventListener('input', (e) => {
        filterPrices(e.target.value);
    });
    
    document.getElementById('price-source').addEventListener('change', () => {
        retryCount = 0;
        loadPrices();
    });
}

async function loadPrices() {
    const now = Date.now();
    if (now - lastPriceLoad < CACHE_DURATION) return;
    lastPriceLoad = now;
    
    const grid = document.getElementById('price-grid');
    const source = document.getElementById('price-source').value;
    
    try {
        let data;
        if (source === 'coingecko') {
            data = await fetchWithRetry(() => API.coingecko.getPrices(null, 30), 3);
            priceCache.coingecko = data;
            priceCache.timestamp = now;
            renderCoinGeckoPrices(data);
        } else {
            data = await fetchWithRetry(() => API.binance.getPrices(), 3);
            priceCache.binance = data;
            priceCache.timestamp = now;
            renderBinancePrices(data);
        }
        retryCount = 0;
        addTimestamp(source);
    } catch (err) {
        handlePriceError(err, grid, source);
    }
}

async function fetchWithRetry(fn, maxRetries) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (err) {
            if (i === maxRetries - 1) throw err;
            await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        }
    }
}

function handlePriceError(err, grid, source) {
    const cached = priceCache[source];
    const timeLeft = Math.ceil((PRICE_POLL_INTERVAL - (Date.now() - priceCache.timestamp)) / 1000);
    
    if (cached) {
        if (source === 'coingecko') renderCoinGeckoPrices(cached);
        else renderBinancePrices(cached);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.style.cssText = 'background: rgba(255,152,0,0.15); border-color: #FF9800; margin-bottom: 16px;';
        errorDiv.innerHTML = `⚠ Using cached data (API rate limited)<br><small>Next update in ${timeLeft}s</small>`;
        grid.prepend(errorDiv);
    } else {
        grid.innerHTML = `
            <div class="error">
                ${err.message.includes('Failed to fetch') ? 'Connection failed. Check your internet.' : err.message}<br>
                <small>Retrying in ${PRICE_POLL_INTERVAL / 1000}s</small>
            </div>`;
    }
}

function addTimestamp(source) {
    const grid = document.getElementById('price-grid');
    const existing = document.getElementById('price-timestamp');
    if (existing) existing.remove();
    
    const timestamp = document.createElement('div');
    timestamp.id = 'price-timestamp';
    timestamp.style.cssText = 'text-align: right; font-size: 12px; color: #CAC4D0; margin-bottom: 16px;';
    timestamp.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    grid.parentNode.insertBefore(timestamp, grid);
}

async function loadPrices() {
    const grid = document.getElementById('price-grid');
    const source = document.getElementById('price-source').value;
    
    try {
        if (source === 'coingecko') {
            const coins = await API.coingecko.getPrices(null, 50);
            renderCoinGeckoPrices(coins);
        } else {
            const tickers = await API.binance.getPrices();
            renderBinancePrices(tickers);
        }
    } catch (err) {
        grid.innerHTML = `<div class="error">Error loading prices: ${err.message}</div>`;
    }
}

function renderCoinGeckoPrices(coins) {
    const grid = document.getElementById('price-grid');
    grid.innerHTML = coins.map(coin => `
        <div class="crypto-card" data-name="${coin.name.toLowerCase()}">
            <div class="coin-header">
                <div>
                    <div class="coin-name">${coin.name}</div>
                    <div class="coin-symbol">${coin.symbol.toUpperCase()}</div>
                </div>
                <img src="${coin.image}" width="32" height="32">
            </div>
            <div class="coin-price">$${coin.current_price?.toLocaleString() || 'N/A'}</div>
            <div class="price-change ${coin.price_change_percentage_24h > 0 ? 'positive' : 'negative'}">
                ${coin.price_change_percentage_24h?.toFixed(2) || '0.00'}%
            </div>
            <div class="coin-stats">
                <span>MCap: $${(coin.market_cap / 1e9).toFixed(2)}B</span>
                <span>Vol: $${(coin.total_volume / 1e9).toFixed(2)}B</span>
            </div>
        </div>
    `).join('');
}

function renderBinancePrices(tickers) {
    const grid = document.getElementById('price-grid');
    grid.innerHTML = tickers.map(t => `
        <div class="crypto-card" data-name="${t.symbol.toLowerCase()}">
            <div class="coin-header">
                <div>
                    <div class="coin-name">${t.symbol.replace('USDT', '')}</div>
                    <div class="coin-symbol">${t.symbol}</div>
                </div>
            </div>
            <div class="coin-price">$${parseFloat(t.lastPrice).toLocaleString()}</div>
            <div class="price-change ${parseFloat(t.priceChangePercent) > 0 ? 'positive' : 'negative'}">
                ${parseFloat(t.priceChangePercent).toFixed(2)}%
            </div>
            <div class="coin-stats">
                <span>High: $${parseFloat(t.highPrice).toLocaleString()}</span>
                <span>Low: $${parseFloat(t.lowPrice).toLocaleString()}</span>
            </div>
        </div>
    `).join('');
}

function filterPrices(query) {
    const cards = document.querySelectorAll('#price-grid .crypto-card');
    cards.forEach(card => {
        const name = card.dataset.name;
        card.style.display = name.includes(query.toLowerCase()) ? 'block' : 'none';
    });
}

function initPortfolio() {
    renderPortfolio();
    
    document.getElementById('add-to-portfolio').addEventListener('click', () => {
        const coin = document.getElementById('coin-search').value;
        const amount = parseFloat(document.getElementById('coin-amount').value);
        const buyPrice = parseFloat(document.getElementById('coin-buy-price').value);
        
        if (!coin || !amount) return;
        
        const portfolio = getPortfolio();
        portfolio.push({ coin, amount, buyPrice: buyPrice || 0, date: new Date().toISOString() });
        savePortfolio(portfolio);
        renderPortfolio();
        
        document.getElementById('coin-search').value = '';
        document.getElementById('coin-amount').value = '';
        document.getElementById('coin-buy-price').value = '';
    });
}

function getPortfolio() {
    return JSON.parse(localStorage.getItem('crypto-portfolio') || '[]');
}

function savePortfolio(portfolio) {
    localStorage.setItem('crypto-portfolio', JSON.stringify(portfolio));
}

async function renderPortfolio() {
    const list = document.getElementById('portfolio-list');
    const summary = document.getElementById('portfolio-summary');
    const portfolio = getPortfolio();
    
    if (portfolio.length === 0) {
        list.innerHTML = '<div class="loading">No holdings yet. Add some coins!</div>';
        summary.innerHTML = '';
        return;
    }
    
    try {
        const coinIds = [...new Set(portfolio.map(p => p.coin.toLowerCase()))].join(',');
        const prices = await API.coingecko.getPrices(portfolio.map(p => p.coin.toLowerCase()));
        
        let totalValue = 0;
        let totalCost = 0;
        
        list.innerHTML = portfolio.map((item, idx) => {
            const coinData = prices.find(p => p.id === item.coin.toLowerCase());
            const currentPrice = coinData?.current_price || 0;
            const value = currentPrice * item.amount;
            const cost = item.buyPrice * item.amount;
            const pnl = item.buyPrice > 0 ? ((currentPrice - item.buyPrice) / item.buyPrice * 100) : 0;
            
            totalValue += value;
            totalCost += cost;
            
            return `
                <div class="portfolio-item">
                    <div class="portfolio-item-info">
                        <h4>${item.coin.toUpperCase()}</h4>
                        <div>Amount: ${item.amount}</div>
                        <div>Current: $${currentPrice.toLocaleString()}</div>
                        <div class="${pnl >= 0 ? 'positive' : 'negative'}">
                            PnL: ${pnl.toFixed(2)}%
                        </div>
                    </div>
                    <div class="portfolio-item-actions">
                        <div>Value: $${value.toLocaleString()}</div>
                        <button onclick="removeFromPortfolio(${idx})">Remove</button>
                    </div>
                </div>
            `;
        }).join('');
        
        const totalPnl = totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0;
        
        summary.innerHTML = `
            <div class="summary-item">
                <div class="summary-label">Total Value</div>
                <div class="summary-value">$${totalValue.toLocaleString()}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Total PnL</div>
                <div class="summary-value ${totalPnl >= 0 ? 'positive' : 'negative'}">
                    ${totalPnl.toFixed(2)}%
                </div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Holdings</div>
                <div class="summary-value">${portfolio.length}</div>
            </div>
        `;
    } catch (err) {
        list.innerHTML = `<div class="error">Error loading portfolio data</div>`;
    }
}

window.removeFromPortfolio = function(idx) {
    const portfolio = getPortfolio();
    portfolio.splice(idx, 1);
    savePortfolio(portfolio);
    renderPortfolio();
};

function initTrending() {
    document.querySelectorAll('.trending-controls .btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.trending-controls .btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadTrending(btn.dataset.filter);
        });
    });
}

async function loadTrending(filter) {
    const list = document.getElementById('trending-list');
    list.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        if (filter === 'trending') {
            const data = await API.coingecko.getTrending();
            const coins = data.coins.slice(0, 15).map(c => c.item);
            list.innerHTML = coins.map(coin => `
                <div class="crypto-card">
                    <div class="coin-header">
                        <div>
                            <div class="coin-name">${coin.name}</div>
                            <div class="coin-symbol">${coin.symbol}</div>
                        </div>
                        <img src="${coin.small}" width="32" height="32">
                    </div>
                    <div class="coin-stats">
                        <span>Rank: #${coin.market_cap_rank || 'N/A'}</span>
                        <span>Score: ${coin.score || 0}</span>
                    </div>
                </div>
            `).join('');
        } else {
            const coins = await API.coingecko.getPrices();
            const sorted = coins.sort((a, b) => 
                filter === 'gainers' 
                    ? (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)
                    : (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0)
            ).slice(0, 15);
            
            list.innerHTML = sorted.map(coin => `
                <div class="crypto-card">
                    <div class="coin-header">
                        <div>
                            <div class="coin-name">${coin.name}</div>
                            <div class="coin-symbol">${coin.symbol.toUpperCase()}</div>
                        </div>
                        <img src="${coin.image}" width="32" height="32">
                    </div>
                    <div class="coin-price">$${coin.current_price?.toLocaleString()}</div>
                    <div class="price-change ${coin.price_change_percentage_24h > 0 ? 'positive' : 'negative'}">
                        ${coin.price_change_percentage_24h?.toFixed(2) || '0.00'}%
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        list.innerHTML = `<div class="error">Error: ${err.message}</div>`;
    }
}

function initDexScanner() {
    loadDexPairs();
    
    document.getElementById('dex-search').addEventListener('input', (e) => {
        filterDexPairs(e.target.value);
    });
    
    document.getElementById('chain-filter').addEventListener('change', () => {
        loadDexPairs();
    });
}

async function loadDexPairs() {
    const grid = document.getElementById('dex-pairs');
    const chain = document.getElementById('chain-filter').value;
    grid.innerHTML = '<div class="loading">Loading hot DEX pairs...</div>';
    
    try {
        const data = await API.dexscreener.getHotPairs(chain);
        const pairs = data.pairs || [];
        
        grid.innerHTML = pairs.map(pair => `
            <div class="dex-pair" data-pair="${(pair.baseToken?.name || '').toLowerCase()}">
                <div class="pair-header">
                    <div class="pair-name">${pair.baseToken?.symbol || 'N/A'}/${pair.quoteToken?.symbol || 'N/A'}</div>
                    <span class="chain-badge">${pair.chainId || 'N/A'}</span>
                </div>
                <div class="pair-stats">
                    <div class="pair-stat">
                        <span>Price:</span>
                        <span>$${parseFloat(pair.priceUsd || 0).toFixed(6)}</span>
                    </div>
                    <div class="pair-stat">
                        <span>24h Change:</span>
                        <span class="${parseFloat(pair.priceChange?.h24 || 0) > 0 ? 'positive' : 'negative'}">
                            ${parseFloat(pair.priceChange?.h24 || 0).toFixed(2)}%
                        </span>
                    </div>
                    <div class="pair-stat">
                        <span>24h Volume:</span>
                        <span>$${(parseFloat(pair.volume?.h24 || 0) / 1e6).toFixed(2)}M</span>
                    </div>
                    <div class="pair-stat">
                        <span>Liquidity:</span>
                        <span>$${(parseFloat(pair.liquidity?.usd || 0) / 1e6).toFixed(2)}M</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        grid.innerHTML = `<div class="error">Error loading DEX pairs: ${err.message}</div>`;
    }
}

function filterDexPairs(query) {
    const pairs = document.querySelectorAll('#dex-pairs .dex-pair');
    pairs.forEach(pair => {
        pair.style.display = pair.dataset.pair.includes(query.toLowerCase()) ? 'block' : 'none';
    });
}

function initTokenChecker() {
    document.getElementById('check-token').addEventListener('click', checkToken);
}

async function checkToken() {
    const address = document.getElementById('token-address').value;
    const chainId = document.getElementById('check-chain').value;
    const result = document.getElementById('token-result');
    
    if (!address) {
        result.innerHTML = '<div class="error">Please enter a token address</div>';
        return;
    }
    
    result.innerHTML = '<div class="loading">Checking token security...</div>';
    
    try {
        const data = await API.goplus.checkToken(chainId, address);
        const token = data.result?.[address.toLowerCase()];
        
        if (!token) {
            result.innerHTML = '<div class="error">Token not found or analysis failed</div>';
            return;
        }
        
        const score = calculateSecurityScore(token);
        const scoreColor = score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--yellow)' : 'var(--red)';
        
        result.innerHTML = `
            <div class="security-result">
                <div class="security-score">
                    <div class="score-circle" style="background: ${scoreColor}20; color: ${scoreColor}; border: 3px solid ${scoreColor};">
                        ${score}
                    </div>
                    <h3>Security Score</h3>
                </div>
                <div class="security-checks">
                    <div class="check-item">
                        <span>Is Open Source</span>
                        <span class="check-status ${token.is_open_source === '1' ? 'pass' : 'warning'}">
                            ${token.is_open_source === '1' ? '✓ Yes' : '✗ No'}
                        </span>
                    </div>
                    <div class="check-item">
                        <span>Has Proxy</span>
                        <span class="check-status ${token.has_proxy === '1' ? 'warning' : 'pass'}">
                            ${token.has_proxy === '1' ? '⚠ Yes' : '✓ No'}
                        </span>
                    </div>
                    <div class="check-item">
                        <span>Is Mintable</span>
                        <span class="check-status ${token.is_mintable === '1' ? 'fail' : 'pass'}">
                            ${token.is_mintable === '1' ? '✗ Yes' : '✓ No'}
                        </span>
                    </div>
                    <div class="check-item">
                        <span>Can Take Back Ownership</span>
                        <span class="check-status ${token.can_take_back_ownership === '1' ? 'fail' : 'pass'}">
                            ${token.can_take_back_ownership === '1' ? '✗ Yes' : '✓ No'}
                        </span>
                    </div>
                    <div class="check-item">
                        <span>Owner Balance</span>
                        <span class="check-status ${parseFloat(token.owner_balance || 0) > 10 ? 'warning' : 'pass'}">
                            ${parseFloat(token.owner_balance || 0).toFixed(2)}%
                        </span>
                    </div>
                    <div class="check-item">
                        <span>Is Honeypot</span>
                        <span class="check-status ${token.is_honeypot === '1' ? 'fail' : 'pass'}">
                            ${token.is_honeypot === '1' ? '✗ DANGER' : '✓ Safe'}
                        </span>
                    </div>
                    <div class="check-item">
                        <span>Transfer Pausable</span>
                        <span class="check-status ${token.is_pausable === '1' ? 'warning' : 'pass'}">
                            ${token.is_pausable === '1' ? '⚠ Yes' : '✓ No'}
                        </span>
                    </div>
                    <div class="check-item">
                        <span>Trading Cooldown</span>
                        <span class="check-status ${token.is_cooldown === '1' ? 'warning' : 'pass'}">
                            ${token.is_cooldown === '1' ? '⚠ Yes' : '✓ No'}
                        </span>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        result.innerHTML = `<div class="error">Error checking token: ${err.message}</div>`;
    }
}

function calculateSecurityScore(token) {
    let score = 100;
    if (token.is_open_source !== '1') score -= 10;
    if (token.has_proxy === '1') score -= 10;
    if (token.is_mintable === '1') score -= 15;
    if (token.can_take_back_ownership === '1') score -= 20;
    if (parseFloat(token.owner_balance || 0) > 10) score -= 10;
    if (token.is_honeypot === '1') score -= 30;
    if (token.is_pausable === '1') score -= 10;
    if (token.is_cooldown === '1') score -= 5;
    return Math.max(0, score);
}

let chartInstance = null;
function initCharts() {
    document.getElementById('load-chart').addEventListener('click', loadChart);
}

function initArbitrage() {
    document.getElementById('scan-arbitrage').addEventListener('click', scanArbitrage);
    document.getElementById('arbitrage-search').addEventListener('input', (e) => {
        filterArbitrage(e.target.value);
    });
    
    const keyInput = document.getElementById('rapidapi-key');
    if (keyInput && localStorage.getItem('rapidapi-key')) {
        keyInput.value = localStorage.getItem('rapidapi-key');
    }
}

function initAirdrops() {
    loadAirdrops();
    document.getElementById('refresh-airdrops').addEventListener('click', loadAirdrops);
    document.getElementById('airdrop-search').addEventListener('input', (e) => {
        filterAirdrops(e.target.value);
    });
    document.getElementById('airdrop-filter').addEventListener('change', loadAirdrops);
}

function loadAirdrops() {
    const list = document.getElementById('airdrop-list');
    const filter = document.getElementById('airdrop-filter').value;
    list.innerHTML = '<div class="loading">Loading potential airdrops from DeFiLlama...</div>';
    
    fetchAirdrops(filter);
}

async function fetchAirdrops(filter) {
    const list = document.getElementById('airdrop-list');
    
    try {
        const protocols = await API.defillama.getProtocols();
        
        let filtered = protocols.filter(p => {
            const hasToken = p.symbol && p.symbol !== '-' && p.symbol !== '';
            const tvl = p.tvl || 0;
            
            if (filter === 'potential') return !hasToken && tvl > 10000000;
            if (filter === 'active') return hasToken;
            if (filter === 'ended') return hasToken && tvl < 1000000;
            return true;
        }).slice(0, 20);
        
        const tracked = getTrackedAirdrops();
        
        list.innerHTML = filtered.map(protocol => {
            const isTracked = tracked.some(t => t.name === protocol.name);
            const hasToken = protocol.symbol && protocol.symbol !== '-';
            const status = !hasToken ? 'potential' : 'active';
            const tvl = ((protocol.tvl || 0) / 1e6).toFixed(1);
            
            return `
                <div class="crypto-card" data-name="${protocol.name.toLowerCase()}">
                    <div class="coin-header">
                        <div>
                            <div class="coin-name">${protocol.name}</div>
                            <div class="coin-symbol">${hasToken ? protocol.symbol.toUpperCase() : 'NO TOKEN'}</div>
                        </div>
                        <span class="chain-badge" style="background: ${getStatusColor(status)};">${status}</span>
                    </div>
                    <div class="pair-stats">
                        <div class="pair-stat">
                            <span>TVL:</span>
                            <span>$${tvl}M</span>
                        </div>
                        <div class="pair-stat">
                            <span>Category:</span>
                            <span>${protocol.category || 'DeFi'}</span>
                        </div>
                    </div>
                    <div style="margin-top: 12px; font-size: 13px; color: #CAC4D0;">
                        <strong>Chains:</strong> ${(protocol.chains || []).slice(0, 3).join(', ')}
                    </div>
                    <div style="margin-top: 16px; display: flex; gap: 8px;">
                        <button class="btn" style="flex: 1; padding: 8px;" onclick="window.open('${protocol.url || '#'}', '_blank')">
                            Visit
                        </button>
                        <button class="btn" style="flex: 1; padding: 8px; background: ${isTracked ? 'var(--md-red)' : 'var(--md-green)'};" onclick="window.trackAirdrop('${protocol.name}', '${protocol.symbol || 'N/A'}', '${protocol.category || 'DeFi'}')">
                            ${isTracked ? 'Remove' : 'Track'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        if (filtered.length === 0) {
            list.innerHTML = '<div class="loading">No airdrops found for this filter.</div>';
        }
        
        renderTrackedAirdrops();
    } catch (err) {
        list.innerHTML = `<div class="error">Error loading airdrops: ${err.message}</div>`;
    }
}

function getTrackedAirdrops() {
    return JSON.parse(localStorage.getItem('tracked-airdrops') || '[]');
}

window.trackAirdrop = function(name, token, category) {
    const tracked = getTrackedAirdrops();
    const index = tracked.findIndex(t => t.name === name);
    
    if (index > -1) {
        tracked.splice(index, 1);
    } else {
        tracked.push({ 
            name: name, 
            token: token || 'N/A', 
            category: category || 'DeFi',
            trackedAt: new Date().toISOString(),
            status: 'tracked'
        });
    }
    
    localStorage.setItem('tracked-airdrops', JSON.stringify(tracked));
    loadAirdrops();
};

function renderTrackedAirdrops() {
    const list = document.getElementById('tracked-list');
    const tracked = getTrackedAirdrops();
    
    if (tracked.length === 0) {
        list.innerHTML = '<div style="color: #CAC4D0; padding: 16px;">No airdrops tracked yet. Click "Track" on protocols above.</div>';
        return;
    }
    
    list.innerHTML = tracked.map((airdrop) => `
        <div class="portfolio-item">
            <div class="portfolio-item-info">
                <h4>${airdrop.name} (${airdrop.token})</h4>
                <div>Category: ${airdrop.category || 'DeFi'}</div>
                <div style="font-size: 12px; color: #CAC4D0;">Tracked: ${new Date(airdrop.trackedAt).toLocaleDateString()}</div>
            </div>
            <div class="portfolio-item-actions">
                <button onclick="window.trackAirdrop('${airdrop.name}', '${airdrop.token}', '${airdrop.category || 'DeFi'}')">Remove</button>
            </div>
        </div>
    `).join('');
}

function filterAirdrops(query) {
    const cards = document.querySelectorAll('#airdrop-list .crypto-card');
    cards.forEach(card => {
        card.style.display = card.dataset.name.includes(query.toLowerCase()) ? 'block' : 'none';
    });
}

function loadAirdrops() {
    const list = document.getElementById('airdrop-list');
    const filter = document.getElementById('airdrop-filter').value;
    list.innerHTML = '<div class="loading">Loading potential airdrops from DeFiLlama...</div>';
    
    fetchAirdrops(filter);
}

async function fetchAirdrops(filter) {
    const list = document.getElementById('airdrop-list');
    
    try {
        const protocols = await API.defillama.getProtocols();
        
        let filtered = protocols.filter(p => {
            const hasToken = p.symbol && p.symbol !== '-' && p.symbol !== '';
            const tvl = p.tvl || 0;
            
            if (filter === 'potential') return !hasToken && tvl > 10000000; // >$10M TVL, no token
            if (filter === 'active') return hasToken;
            if (filter === 'ended') return hasToken && (p.tvl || 0) < 1000000; // <$1M TVL
            return true;
        }).slice(0, 20);
        
        const tracked = getTrackedAirdrops();
        
        list.innerHTML = filtered.map(protocol => {
            const isTracked = tracked.some(t => t.name === protocol.name);
            const hasToken = protocol.symbol && protocol.symbol !== '-';
            const status = !hasToken ? 'potential' : 'active';
            const tvl = ((protocol.tvl || 0) / 1e6).toFixed(1);
            
            return `
                <div class="crypto-card" data-name="${protocol.name.toLowerCase()}">
                    <div class="coin-header">
                        <div>
                            <div class="coin-name">${protocol.name}</div>
                            <div class="coin-symbol">${hasToken ? protocol.symbol.toUpperCase() : 'NO TOKEN'}</div>
                        </div>
                        <span class="chain-badge" style="background: ${getStatusColor(status)};">${status}</span>
                    </div>
                    <div class="pair-stats">
                        <div class="pair-stat">
                            <span>TVL:</span>
                            <span>$${tvl}M</span>
                        </div>
                        <div class="pair-stat">
                            <span>Category:</span>
                            <span>${protocol.category || 'DeFi'}</span>
                        </div>
                    </div>
                    <div style="margin-top: 12px; font-size: 13px; color: #CAC4D0;">
                        <strong>Chains:</strong> ${(protocol.chains || []).slice(0, 3).join(', ')}
                    </div>
                    <div style="margin-top: 16px; display: flex; gap: 8px;">
                        <button class="btn" style="flex: 1; padding: 8px;" onclick="window.open('${protocol.url || '#'}', '_blank')">
                            Visit
                        </button>
                        <button class="btn" style="flex: 1; padding: 8px; background: ${isTracked ? 'var(--md-red)' : 'var(--md-green)'};" onclick="window.trackAirdropSafe('${protocol.name}', '${protocol.symbol || 'N/A'}', '${protocol.category || 'DeFi'}')">
                            ${isTracked ? 'Remove' : 'Track'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        if (filtered.length === 0) {
            list.innerHTML = '<div class="loading">No airdrops found for this filter.</div>';
        }
        
        renderTrackedAirdrops();
    } catch (err) {
        list.innerHTML = `<div class="error">Error loading airdrops: ${err.message}</div>`;
    }
}

function getStatusColor(status) {
    switch(status) {
        case 'active': return 'var(--md-green)';
        case 'potential': return 'var(--md-primary)';
        case 'ended': return 'var(--md-outline)';
        default: return 'var(--md-outline)';
    }
}

function getTrackedAirdrops() {
    return JSON.parse(localStorage.getItem('tracked-airdrops') || '[]');
}

function trackAirdrop(name, token, category) {
    const tracked = getTrackedAirdrops();
    const index = tracked.findIndex(t => t.name === name);
    
    if (index > -1) {
        tracked.splice(index, 1);
    } else {
        tracked.push({ 
            name: name, 
            token: token || 'N/A', 
            category: category || 'DeFi',
            trackedAt: new Date().toISOString(),
            status: 'tracked'
        });
    }
    
    localStorage.setItem('tracked-airdrops', JSON.stringify(tracked));
    loadAirdrops();
}

window.trackAirdropSafe = function(name, token, category) {
    trackAirdrop(name, token, category);
};

function renderTrackedAirdrops() {
    const list = document.getElementById('tracked-list');
    const tracked = getTrackedAirdrops();
    
    if (tracked.length === 0) {
        list.innerHTML = '<div style="color: #CAC4D0; padding: 16px;">No airdrops tracked yet. Click "Track" on protocols above.</div>';
        return;
    }
    
    list.innerHTML = tracked.map((airdrop, idx) => `
        <div class="portfolio-item">
            <div class="portfolio-item-info">
                <h4>${airdrop.name} (${airdrop.token})</h4>
                <div>Category: ${airdrop.category || 'DeFi'}</div>
                <div style="font-size: 12px; color: #CAC4D0;">Tracked: ${new Date(airdrop.trackedAt).toLocaleDateString()}</div>
            </div>
            <div class="portfolio-item-actions">
                <button onclick="trackAirdrop('${airdrop.name}', '${airdrop.token}', '${airdrop.category || 'DeFi'}')">Remove</button>
            </div>
        </div>
    `).join('');
}

function filterAirdrops(query) {
    const cards = document.querySelectorAll('#airdrop-list .crypto-card');
    cards.forEach(card => {
        card.style.display = card.dataset.name.includes(query.toLowerCase()) ? 'block' : 'none';
    });
}

async function scanArbitrage() {
    const list = document.getElementById('arbitrage-list');
    list.innerHTML = '<div class="loading">Scanning for arbitrage opportunities...</div>';
    
    try {
        const data = await API.rapidapi_arbitrage.getArbitrage('btc');
        
        if (!data || !Array.isArray(data)) {
            throw new Error('Invalid response from RapidAPI');
        }
        
        const opportunities = data.filter(opp => {
            const profit = parseFloat(opp.profit_percent);
            return profit > 0.5;
        }).sort((a, b) => parseFloat(b.profit_percent) - parseFloat(a.profit_percent));
        
        list.innerHTML = opportunities.map(opp => {
            const profitPct = parseFloat(opp.profit_percent);
            const buyPrice = parseFloat(opp.buy_price);
            const sellPrice = parseFloat(opp.sell_price);
            const spread = sellPrice - buyPrice;
            
            return `
                <div class="crypto-card" data-coin="${(opp.coin || '').toLowerCase()}">
                    <div class="coin-header">
                        <div>
                            <div class="coin-name">${opp.coin}</div>
                            <div class="coin-symbol">${opp.pair || ''}</div>
                        </div>
                    </div>
                    <div class="pair-stats">
                        <div class="pair-stat">
                            <span>Buy at:</span>
                            <span>${opp.buy_exchange}</span>
                        </div>
                        <div class="pair-stat">
                            <span>Price:</span>
                            <span>$${buyPrice.toLocaleString()}</span>
                        </div>
                        <div class="pair-stat">
                            <span>Sell at:</span>
                            <span>${opp.sell_exchange}</span>
                        </div>
                        <div class="pair-stat">
                            <span>Price:</span>
                            <span>$${sellPrice.toLocaleString()}</span>
                        </div>
                    </div>
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(103, 80, 164, 0.2);">
                        <div class="price-change positive" style="font-size: 16px;">
                            +${profitPct.toFixed(2)}% profit
                        </div>
                        <div style="font-size: 12px; color: #CAC4D0; margin-top: 8px;">
                            Spread: $${spread.toFixed(2)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        if (opportunities.length === 0) {
            list.innerHTML = '<div class="loading">No significant arbitrage opportunities found. Try again later.</div>';
        }
    } catch (err) {
        list.innerHTML = `<div class="error">Error: ${err.message}</div>`;
    }
}

window.saveRapidAPIKey = function() {
    const key = document.getElementById('rapidapi-key-input').value;
    if (key) {
        localStorage.setItem('rapidapi-key', key);
        RAPIDAPI_KEY = key;
        scanArbitrage();
    }
};

function filterArbitrage(query) {
    const cards = document.querySelectorAll('#arbitrage-list .crypto-card');
    cards.forEach(card => {
        card.style.display = card.dataset.coin.includes(query.toLowerCase()) ? 'block' : 'none';
    });
}

async function loadChart() {
    const coinId = document.getElementById('chart-coin').value || 'bitcoin';
    const days = document.getElementById('chart-days').value;
    const canvas = document.getElementById('price-chart');
    
    try {
        const data = await API.coingecko.getChart(coinId, days);
        const prices = data.prices;
        
        if (chartInstance) chartInstance.destroy();
        
        const ctx = canvas.getContext('2d');
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: prices.map(p => {
                    const d = new Date(p[0]);
                    return days <= 1 ? d.toLocaleTimeString() : d.toLocaleDateString();
                }),
                datasets: [{
                    label: 'Price (USD)',
                    data: prices.map(p => p[1]),
                    borderColor: 'var(--accent)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: 'var(--text-primary)' } }
                },
                scales: {
                    x: { 
                        ticks: { color: 'var(--text-secondary)', maxRotation: 45 },
                        grid: { color: 'var(--border)' }
                    },
                    y: { 
                        ticks: { color: 'var(--text-secondary)' },
                        grid: { color: 'var(--border)' }
                    }
                }
            }
        });
    } catch (err) {
        canvas.outerHTML = `<div class="error">Error loading chart: ${err.message}</div>`;
    }
}

function initGlobalStats() {
    loadGlobalStats();
}

async function loadGlobalStats() {
    const grid = document.getElementById('global-data');
    grid.innerHTML = '<div class="loading">Loading global stats...</div>';
    
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/global');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const global = data.data;
        
        grid.innerHTML = `
            <div class="global-card">
                <div class="global-label">Total Market Cap</div>
                <div class="global-value">$${((global.total_market_cap?.usd || 0) / 1e12).toFixed(2)}T</div>
            </div>
            <div class="global-card">
                <div class="global-label">24h Volume</div>
                <div class="global-value">$${((global.total_volume?.usd || 0) / 1e9).toFixed(2)}B</div>
            </div>
            <div class="global-card">
                <div class="global-label">BTC Dominance</div>
                <div class="global-value">${(global.market_cap_percentage?.btc || 0).toFixed(2)}%</div>
            </div>
            <div class="global-card">
                <div class="global-label">ETH Dominance</div>
                <div class="global-value">${(global.market_cap_percentage?.eth || 0).toFixed(2)}%</div>
            </div>
            <div class="global-card">
                <div class="global-label">Active Cryptos</div>
                <div class="global-value">${(global.active_cryptocurrencies || 0).toLocaleString()}</div>
            </div>
            <div class="global-card">
                <div class="global-label">Markets</div>
                <div class="global-value">${(global.markets || 0).toLocaleString()}</div>
            </div>
        `;
    } catch (err) {
        grid.innerHTML = `<div class="error">Error: ${err.message}. Try again later.</div>`;
    }
}

// Profit Calculator
window.calculateProfit = function() {
    const invest = parseFloat(document.getElementById('invest-amount').value) || 0;
    const buyPrice = parseFloat(document.getElementById('buy-price').value) || 0;
    const sellPrice = parseFloat(document.getElementById('sell-price').value) || 0;
    const feePercent = parseFloat(document.getElementById('fee-percent').value) || 0;
    
    if (invest <= 0 || buyPrice <= 0 || sellPrice <= 0) {
        document.getElementById('profit-result').innerHTML = '<div class="error">Please fill in all fields with valid values.</div>';
        return;
    }
    
    const coinsBought = invest / buyPrice;
    const grossAmount = coinsBought * sellPrice;
    const feeAmount = grossAmount * (feePercent / 100);
    const netAmount = grossAmount - feeAmount;
    const profit = netAmount - invest;
    const roi = ((profit / invest) * 100).toFixed(2);
    
    const resultColor = profit >= 0 ? 'profit-positive' : 'profit-negative';
    const profitSign = profit >= 0 ? '+' : '';
    
    const resultHTML = `
        <div class="result-card">
            <div class="result-row">
                <span class="result-label">Investment</span>
                <span class="result-value">$${invest.toFixed(2)}</span>
            </div>
            <div class="result-row">
                <span class="result-label">Coins Bought</span>
                <span class="result-value">${coinsBought.toFixed(6)}</span>
            </div>
            <div class="result-row">
                <span class="result-label">Gross Amount</span>
                <span class="result-value">$${grossAmount.toFixed(2)}</span>
            </div>
            <div class="result-row">
                <span class="result-label">Fee (${feePercent}%)</span>
                <span class="result-value">-$${feeAmount.toFixed(2)}</span>
            </div>
            <div class="result-row">
                <span class="result-label">Net Amount</span>
                <span class="result-value">$${netAmount.toFixed(2)}</span>
            </div>
            <div class="result-row">
                <span class="result-label">Profit / Loss</span>
                <span class="result-value ${resultColor}">${profitSign}$${profit.toFixed(2)}</span>
            </div>
            <div class="result-row">
                <span class="result-label">ROI</span>
                <span class="result-value ${resultColor}">${profitSign}${roi}%</span>
            </div>
        </div>
    `;
    
    document.getElementById('profit-result').innerHTML = resultHTML;
    
    saveCalculation({
        invest,
        buyPrice,
        sellPrice,
        feePercent,
        profit,
        roi: parseFloat(roi),
        timestamp: new Date().toISOString()
    });
    
    renderProfitHistory();
};

function getProfitHistory() {
    return JSON.parse(localStorage.getItem('profit-history') || '[]');
}

function saveCalculation(calc) {
    const history = getProfitHistory();
    history.unshift(calc);
    if (history.length > 10) history.pop();
    localStorage.setItem('profit-history', JSON.stringify(history));
}

function renderProfitHistory() {
    const list = document.getElementById('profit-history-list');
    const history = getProfitHistory();
    
    if (history.length === 0) {
        list.innerHTML = '<div style="color: #CAC4D0; padding: 16px;">No calculations yet.</div>';
        return;
    }
    
    list.innerHTML = history.map((calc, idx) => `
        <div class="profit-history-item">
            <div>Invested: $${calc.invest.toFixed(2)} | Buy: $${calc.buyPrice} | Sell: $${calc.sellPrice}</div>
            <div class="profit ${calc.profit >= 0 ? 'profit-positive' : 'profit-negative'}">
                ${calc.profit >= 0 ? '+' : ''}$${calc.profit.toFixed(2)} (${calc.roi >= 0 ? '+' : ''}${calc.roi.toFixed(2)}%)
            </div>
            <div style="font-size: 11px; color: #888; margin-top: 4px;">${new Date(calc.timestamp).toLocaleString()}</div>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    renderProfitHistory();
});
