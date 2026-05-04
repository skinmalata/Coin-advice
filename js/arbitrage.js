document.addEventListener('DOMContentLoaded', () => {
    initArbitrage();
});

function initArbitrage() {
    document.getElementById('scan-arbitrage').addEventListener('click', scanArbitrage);
    document.getElementById('arbitrage-search').addEventListener('input', (e) => {
        filterArbitrage(e.target.value);
    });
    document.getElementById('arbitrage-sort').addEventListener('change', scanArbitrage);
}

async function scanArbitrage() {
    const list = document.getElementById('tool-content');
    list.innerHTML = '<div class="loading">Scanning for arbitrage opportunities...</div>';
    
    try {
        const data = await API.rapidapi_arbitrage.getArbitrage('btc');
        
        if (!data || !Array.isArray(data)) {
            throw new Error('Invalid response from RapidAPI');
        }
        
        let opportunities = data.filter(opp => parseFloat(opp.profit_percent) > 0.5);
        
        const sortBy = document.getElementById('arbitrage-sort').value;
        if (sortBy === 'profit') {
            opportunities.sort((a, b) => parseFloat(b.profit_percent) - parseFloat(a.profit_percent));
        } else {
            opportunities.sort((a, b) => {
                const spreadA = parseFloat(b.sell_price) - parseFloat(b.buy_price);
                const spreadB = parseFloat(a.sell_price) - parseFloat(a.buy_price);
                return spreadB - spreadA;
            });
        }
        
        list.innerHTML = opportunities.map(opp => {
            const profitPct = parseFloat(opp.profit_percent);
            const buyPrice = parseFloat(opp.buy_price);
            const sellPrice = parseFloat(opp.sell_price);
            const spread = sellPrice - buyPrice;
            
            return `
                <div class="crypto-card" data-coin="${(opp.coin || '').toLowerCase()}">
                    <div class="coin-header">
                        <div>
                            <div class="coin-name">${opp.coin || 'N/A'}</div>
                            <div class="coin-symbol">${opp.symbol || opp.pair || ''}</div>
                        </div>
                    </div>
                    <div class="pair-stats">
                        <div class="pair-stat">
                            <span>Buy at:</span>
                            <span>${opp.buy_exchange || 'N/A'}</span>
                        </div>
                        <div class="pair-stat">
                            <span>Price:</span>
                            <span>$${buyPrice.toLocaleString()}</span>
                        </div>
                        <div class="pair-stat">
                            <span>Sell at:</span>
                            <span>${opp.sell_exchange || 'N/A'}</span>
                        </div>
                        <div class="pair-stat">
                            <span>Price:</span>
                            <span>$${sellPrice.toLocaleString()}</span>
                        </div>
                    </div>
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(103,80,164,0.2);">
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
        list.innerHTML = `<div class="error">Error scanning: ${err.message}</div>`;
    }
}

function filterArbitrage(query) {
    const cards = document.querySelectorAll('#tool-content .crypto-card');
    cards.forEach(card => {
        card.style.display = card.dataset.coin.includes(query.toLowerCase()) ? 'block' : 'none';
    });
}
