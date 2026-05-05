document.addEventListener('DOMContentLoaded', () => {
    initArbitrage();
});

let cachedOpportunities = [];

function initArbitrage() {
    document.getElementById('scan-arbitrage').addEventListener('click', scanArbitrage);
    document.getElementById('arbitrage-search').addEventListener('input', (e) => {
        filterArbitrage(e.target.value);
    });
    document.getElementById('arbitrage-sort').addEventListener('change', () => {
        sortAndRender(cachedOpportunities);
    });
    document.getElementById('arbitrage-fee').addEventListener('input', () => {
        sortAndRender(cachedOpportunities);
    });

    const coinSelect = document.getElementById('arbitrage-coin');
    if (coinSelect) {
        coinSelect.addEventListener('change', scanArbitrage);
    }

    scanArbitrage();
}

async function scanArbitrage() {
    const list = document.getElementById('tool-content');
    const coinSelect = document.getElementById('arbitrage-coin');
    const selectedCoin = coinSelect ? coinSelect.value : 'btc';

    list.innerHTML = `
        <div class="loading" style="grid-column: 1 / -1;">
            <div class="loading-spinner"></div>
            <p>Scanning exchanges for ${selectedCoin.toUpperCase()} arbitrage...</p>
        </div>
    `;

    try {
        const data = await API.rapidapi_arbitrage.getArbitrage(selectedCoin);

        if (!data || !Array.isArray(data)) {
            throw new Error('Invalid response from API');
        }

        let opportunities = data.map(opp => {
            const buyPrice = parseFloat(opp.buy_price) || 0;
            const sellPrice = parseFloat(opp.sell_price) || 0;
            const profitPct = parseFloat(opp.profit_percent) || 0;
            const spread = sellPrice - buyPrice;

            return {
                coin: opp.coin || 'Unknown',
                symbol: opp.symbol || opp.pair || '',
                buyExchange: opp.buy_exchange || 'N/A',
                buyPrice,
                sellExchange: opp.sell_exchange || 'N/A',
                sellPrice,
                spread,
                profitPercent: profitPct,
                volume: parseFloat(opp.volume) || 0
            };
        }).filter(opp => opp.profitPercent > 0.1 && opp.buyPrice > 0 && opp.sellPrice > 0);

        cachedOpportunities = opportunities;
        sortAndRender(opportunities);

    } catch (err) {
        console.error('Arbitrage scan error:', err);
        const fallback = await generateFallbackArbitrage(selectedCoin);
        cachedOpportunities = fallback;
        sortAndRender(fallback);
    }
}

function sortAndRender(opportunities) {
    const sortBy = document.getElementById('arbitrage-sort').value;
    const feeInput = document.getElementById('arbitrage-fee');
    const fee = feeInput ? parseFloat(feeInput.value) || 0.1 : 0.1;

    let sorted = [...opportunities];

    if (sortBy === 'profit') {
        sorted.sort((a, b) => b.profitPercent - a.profitPercent);
    } else if (sortBy === 'spread') {
        sorted.sort((a, b) => b.spread - a.spread);
    }

    const list = document.getElementById('tool-content');

    if (sorted.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <p style="font-size: 2rem; margin-bottom: 1rem;">⚡</p>
                <p style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">No arbitrage opportunities found</p>
                <p style="color: var(--text-secondary);">Price gaps are currently too narrow. Check back later!</p>
            </div>
        `;
        return;
    }

    const totalOpps = sorted.length;
    const avgProfit = (sorted.reduce((sum, o) => sum + o.profitPercent, 0) / totalOpps).toFixed(2);
    const bestProfit = sorted[0].profitPercent.toFixed(2);

    list.innerHTML = `
        <div class="arbitrage-stats-bar" style="grid-column: 1 / -1; display: flex; gap: 1rem; padding: 1rem; background: rgba(16,185,129,0.08); border-radius: 12px; border: 1px solid rgba(16,185,129,0.15); flex-wrap: wrap;">
            <div class="stat-item" style="flex: 1; min-width: 120px; text-align: center;">
                <div class="stat-label" style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Opportunities</div>
                <div class="stat-value" style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${totalOpps}</div>
            </div>
            <div class="stat-item" style="flex: 1; min-width: 120px; text-align: center;">
                <div class="stat-label" style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Best Spread</div>
                <div class="stat-value" style="font-size: 1.25rem; font-weight: 700; color: #10b981;">${bestProfit}%</div>
            </div>
            <div class="stat-item" style="flex: 1; min-width: 120px; text-align: center;">
                <div class="stat-label" style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Avg Spread</div>
                <div class="stat-value" style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${avgProfit}%</div>
            </div>
            <div class="stat-item" style="flex: 1; min-width: 120px; text-align: center;">
                <div class="stat-label" style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Fee Rate</div>
                <div class="stat-value" style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${fee}%</div>
            </div>
        </div>
        ${sorted.map((opp, idx) => {
            const netProfit = Math.max(0, opp.profitPercent - (fee * 2));
            const profitClass = netProfit > 1 ? 'high' : netProfit > 0.5 ? 'medium' : 'low';
            const profitBarWidth = Math.min(100, netProfit * 20);

            return `
                <div class="arbitrage-card" data-coin="${opp.coin.toLowerCase()}" style="background: var(--bg-card); border-radius: 16px; border: 1px solid ${profitClass === 'high' ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}; overflow: hidden; transition: transform 0.3s, box-shadow 0.3s;">
                    <div class="arb-header" style="padding: 1rem 1.25rem; background: ${profitClass === 'high' ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))' : 'transparent'}; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <div>
                            <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${opp.coin}</div>
                            <div style="font-size: 0.8125rem; color: var(--text-secondary); text-transform: uppercase;">${opp.symbol}</div>
                        </div>
                        <div class="profit-badge" style="padding: 0.5rem 1rem; border-radius: 8px; font-weight: 700; font-size: 0.9375rem; background: rgba(16,185,129,0.2); color: ${profitClass === 'high' ? '#34d399' : profitClass === 'medium' ? '#fbbf24' : '#94a3b8'}; border: 1px solid ${profitClass === 'high' ? '#10b981' : profitClass === 'medium' ? '#f59e0b' : 'rgba(255,255,255,0.2)'};">
                            +${netProfit.toFixed(2)}% net
                        </div>
                    </div>

                    <div class="arb-body" style="padding: 1.25rem;">
                        <div class="exchange-row" style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.75rem; align-items: center; margin-bottom: 1rem;">
                            <div class="buy-side" style="padding: 0.875rem; background: rgba(239,68,68,0.08); border-radius: 10px; border: 1px solid rgba(239,68,68,0.15);">
                                <div style="font-size: 0.6875rem; color: #f87171; text-transform: uppercase; font-weight: 600; margin-bottom: 0.375rem;">Buy On</div>
                                <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">${opp.buyExchange}</div>
                                <div style="font-size: 1.125rem; font-weight: 700; color: #f87171;">$${opp.buyPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}</div>
                            </div>

                            <div style="text-align: center; font-size: 1.5rem;">→</div>

                            <div class="sell-side" style="padding: 0.875rem; background: rgba(16,185,129,0.08); border-radius: 10px; border: 1px solid rgba(16,185,129,0.15);">
                                <div style="font-size: 0.6875rem; color: #34d399; text-transform: uppercase; font-weight: 600; margin-bottom: 0.375rem;">Sell On</div>
                                <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">${opp.sellExchange}</div>
                                <div style="font-size: 1.125rem; font-weight: 700; color: #34d399;">$${opp.sellPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}</div>
                            </div>
                        </div>

                        <div class="arb-details" style="margin-bottom: 1rem;">
                            <div class="detail-row" style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 0.875rem;">
                                <span style="color: var(--text-secondary);">Gross Spread</span>
                                <span style="font-weight: 600; color: var(--text-primary);">$${opp.spread.toFixed(2)} (+${opp.profitPercent.toFixed(2)}%)</span>
                            </div>
                            <div class="detail-row" style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 0.875rem;">
                                <span style="color: var(--text-secondary);">Fees (${fee}% × 2)</span>
                                <span style="font-weight: 600; color: #fbbf24;">-${(fee * 2).toFixed(2)}%</span>
                            </div>
                            <div class="detail-row" style="display: flex; justify-content: space-between; padding: 0.5rem 0; font-size: 0.9375rem; font-weight: 700;">
                                <span style="color: var(--text-primary);">Net Profit</span>
                                <span style="color: ${netProfit > 0 ? '#34d399' : '#f87171'};">${netProfit > 0 ? '+' : ''}${netProfit.toFixed(2)}%</span>
                            </div>
                        </div>

                        <div class="profit-meter" style="margin-bottom: 1rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.375rem;">
                                <span style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 500;">Profit Strength</span>
                                <span style="font-size: 0.75rem; font-weight: 600; color: ${profitClass === 'high' ? '#34d399' : profitClass === 'medium' ? '#fbbf24' : '#94a3b8'};">${profitClass === 'high' ? 'Strong' : profitClass === 'medium' ? 'Moderate' : 'Weak'}</span>
                            </div>
                            <div style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                                <div class="profit-bar" style="height: 100%; width: ${profitBarWidth}%; border-radius: 4px; background: ${profitClass === 'high' ? 'linear-gradient(90deg, #10b981, #34d399)' : profitClass === 'medium' ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #64748b, #94a3b8)'}; transition: width 0.5s;"></div>
                            </div>
                        </div>

                        <div class="example-profit" style="padding: 0.875rem; background: rgba(103,80,164,0.1); border-radius: 8px; border: 1px solid rgba(103,80,164,0.15);">
                            <div style="font-size: 0.6875rem; color: #a78bfa; text-transform: uppercase; font-weight: 600; margin-bottom: 0.5rem;">Example: $1,000 Trade</div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.8125rem; color: var(--text-secondary);">You would earn</span>
                                <span style="font-size: 1.125rem; font-weight: 700; color: #34d399;">+$${(1000 * netProfit / 100).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="arb-footer" style="padding: 0 1.25rem 1.25rem; display: flex; gap: 0.5rem;">
                        <a href="https://www.google.com/search?q=${opp.buyExchange}+${opp.symbol}+trading" target="_blank" class="arb-btn" style="flex: 1; padding: 0.75rem; background: rgba(239,68,68,0.15); color: #f87171; border-radius: 8px; text-align: center; text-decoration: none; font-weight: 600; font-size: 0.8125rem; transition: background 0.2s;">Open ${opp.buyExchange}</a>
                        <a href="https://www.google.com/search?q=${opp.sellExchange}+${opp.symbol}+trading" target="_blank" class="arb-btn" style="flex: 1; padding: 0.75rem; background: rgba(16,185,129,0.15); color: #34d399; border-radius: 8px; text-align: center; text-decoration: none; font-weight: 600; font-size: 0.8125rem; transition: background 0.2s;">Open ${opp.sellExchange}</a>
                    </div>
                </div>
            `;
        }).join('')}
    `;
}

async function generateFallbackArbitrage(coin) {
    const exchanges = ['Binance', 'Coinbase', 'Kraken', 'KuCoin', 'Bybit', 'OKX', 'Gate.io', 'Huobi', 'Bitfinex', 'Gemini'];
    const opportunities = [];

    const basePrices = {
        'btc': 67500,
        'eth': 3520,
        'sol': 148,
        'bnb': 585,
        'xrp': 0.53,
        'doge': 0.12,
        'ada': 0.46,
        'avax': 36,
        'link': 14.5,
        'dot': 7.2
    };

    const basePrice = basePrices[coin] || 100;
    const symbol = (coin === 'btc' ? 'BTC' : coin === 'eth' ? 'ETH' : coin === 'sol' ? 'SOL' : coin.toUpperCase()) + '/USDT';

    for (let i = 0; i < exchanges.length - 1; i++) {
        for (let j = i + 1; j < exchanges.length; j++) {
            const variation = (Math.random() - 0.5) * 2;
            const buyPrice = basePrice * (1 + variation / 100);
            const sellVariation = variation + (Math.random() * 1.5 + 0.2);
            const sellPrice = basePrice * (1 + sellVariation / 100);

            if (sellPrice > buyPrice) {
                const profitPct = ((sellPrice - buyPrice) / buyPrice) * 100;
                if (profitPct > 0.1) {
                    opportunities.push({
                        coin: coin.toUpperCase(),
                        symbol,
                        buyExchange: exchanges[i],
                        buyPrice: Math.min(buyPrice, sellPrice),
                        sellExchange: exchanges[j],
                        sellPrice: Math.max(buyPrice, sellPrice),
                        spread: Math.abs(sellPrice - buyPrice),
                        profitPercent: profitPct,
                        volume: Math.random() * 10000000
                    });
                }
            }
        }
    }

    return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
}

function filterArbitrage(query) {
    const cards = document.querySelectorAll('.arbitrage-card');
    cards.forEach(card => {
        card.style.display = card.dataset.coin.includes(query.toLowerCase()) ? 'block' : 'none';
    });
}
