document.addEventListener('DOMContentLoaded', () => {
    initPriceTracker();
});

let priceInterval;
let lastPriceLoad = 0;
const PRICE_POLL_INTERVAL = 60000;
const CACHE_DURATION = 45000;

function initPriceTracker() {
    loadPrices();
    priceInterval = setInterval(loadPrices, PRICE_POLL_INTERVAL);
    
    document.getElementById('search-crypto').addEventListener('input', (e) => {
        filterPrices(e.target.value);
    });
    
    document.getElementById('price-source').addEventListener('change', () => {
        lastPriceLoad = 0;
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
        if (source === 'coingecko') {
            const coins = await API.coingecko.getPrices(null, 50);
            renderCoinGeckoPrices(coins);
        } else {
            const tickers = await API.binance.getPrices();
            renderBinancePrices(tickers);
        }
        addTimestamp();
    } catch (err) {
        if (err.message.includes('Failed to fetch') || err.message.includes('429')) {
            grid.innerHTML = `<div class="error" style="background: rgba(255,152,0,0.15); border-color: #FF9800;">Rate limited. Waiting 60s...<br><small>CoinGecko free tier: 10-50 calls/min</small></div>`;
        } else {
            grid.innerHTML = `<div class="error">Error: ${err.message}</div>`;
        }
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
                <img src="${coin.image}" width="32" height="32" alt="${coin.name}">
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
        card.style.display = card.dataset.name.includes(query.toLowerCase()) ? 'block' : 'none';
    });
}

function addTimestamp() {
    const ts = document.getElementById('price-timestamp');
    if (ts) {
        ts.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    }
}
