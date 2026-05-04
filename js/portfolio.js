let RAPIDAPI_KEY = localStorage.getItem('rapidapi-key') || 'bc006f0aa1msh37b9cf3cb691ca2p1ec37djsn7397984cbc08';

const API = {
    coingecko: {
        base: 'https://api.coingecko.com/api/v3',
        async getPrices(ids = null, perPage = 50) {
            let url = `${this.base}/coins/markets?vs_currency=usd&sparkline=false&price_change_percentage=24h`;
            if (ids && ids.length > 0) {
                url += `&ids=${ids.join(',')}`;
            } else {
                url += `&order=market_cap_desc&per_page=${perPage}&page=1`;
            }
            const res = await fetch(url);
            if (!res.ok) throw new Error('CoinGecko API error');
            return res.json();
        }
    },
    binance: {
        base: 'https://api.binance.com/api/v3',
        async getPrices() {
            const res = await fetch(`${this.base}/ticker/24hr`);
            if (!res.ok) throw new Error('Binance API error');
            const data = await res.json();
            return data.filter(d => d.symbol.endsWith('USDT')).slice(0, 20);
        }
    },
    defillama: {
        base: 'https://api.llama.fi',
        async getProtocols() {
            const res = await fetch(`${this.base}/protocols`);
            if (!res.ok) throw new Error('DeFiLlama API error');
            return res.json();
        }
    },
    rapidapi_arbitrage: {
        base: 'https://crypto-arbitrage3.p.rapidapi.com',
        async getArbitrage(coin = 'btc') {
            const res = await fetch(`${this.base}/crypto-arbitrage?coin=${coin}`, {
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': 'crypto-arbitrage3.p.rapidapi.com'
                }
            });
            if (!res.ok) throw new Error(`RapidAPI error: ${res.status}`);
            return res.json();
        }
    }
};

function getPortfolio() {
    return JSON.parse(localStorage.getItem('crypto-portfolio') || '[]');
}

function savePortfolio(portfolio) {
    localStorage.setItem('crypto-portfolio', JSON.stringify(portfolio));
}

function initPortfolio() {
    renderPortfolio();
    
    document.getElementById('add-to-portfolio').addEventListener('click', async () => {
        const coin = document.getElementById('coin-search').value.trim().toLowerCase();
        const amount = parseFloat(document.getElementById('coin-amount').value);
        const buyPrice = parseFloat(document.getElementById('coin-buy-price').value) || 0;
        
        if (!coin || !amount) return alert('Please enter coin name and amount');
        
        try {
            const data = await API.coingecko.getPrices([coin]);
            if (!data || data.length === 0) return alert('Coin not found');
            
            const portfolio = getPortfolio();
            portfolio.push({
                coin: data[0].id,
                name: data[0].name,
                symbol: data[0].symbol,
                amount,
                buyPrice,
                date: new Date().toISOString()
            });
            savePortfolio(portfolio);
            renderPortfolio();
            
            document.getElementById('coin-search').value = '';
            document.getElementById('coin-amount').value = '';
            document.getElementById('coin-buy-price').value = '';
        } catch (err) {
            alert('Error: ' + err.message);
        }
    });
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
        const ids = [...new Set(portfolio.map(p => p.coin))];
        const prices = await API.coingecko.getPrices(ids);
        
        let totalValue = 0, totalCost = 0;
        
        list.innerHTML = portfolio.map((item, idx) => {
            const coinData = prices.find(p => p.id === item.coin);
            const currentPrice = coinData?.current_price || 0;
            const value = currentPrice * item.amount;
            const cost = item.buyPrice * item.amount;
            const pnl = item.buyPrice > 0 ? ((currentPrice - item.buyPrice) / item.buyPrice * 100) : 0;
            
            totalValue += value;
            totalCost += cost;
            
            return `
                <div class="portfolio-item">
                    <div class="portfolio-item-info">
                        <h4>${item.name || item.coin} (${item.symbol?.toUpperCase() || ''})</h4>
                        <div>Amount: ${item.amount}</div>
                        <div>Current: $${currentPrice.toLocaleString()}</div>
                        <div class="${pnl >= 0 ? 'positive' : 'negative'}" style="margin-top: 4px;">
                            PnL: ${pnl.toFixed(2)}%
                        </div>
                    </div>
                    <div class="portfolio-item-actions">
                        <div style="margin-bottom: 8px;">Value: $${value.toLocaleString()}</div>
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
        list.innerHTML = `<div class="error">Error: ${err.message}</div>`;
    }
}

window.removeFromPortfolio = function(idx) {
    const portfolio = getPortfolio();
    portfolio.splice(idx, 1);
    savePortfolio(portfolio);
    renderPortfolio();
};

document.addEventListener('DOMContentLoaded', initPortfolio);
