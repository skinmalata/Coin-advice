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
    const grid = document.getElementById('tool-content');
    const chain = document.getElementById('chain-filter').value;
    grid.innerHTML = '<div class="loading">Loading hot DEX pairs...</div>';
    
    try {
        let url = 'https://api.dexscreener.com/latest/dex';
        if (chain) {
            url += `/pairs/${chain}?limit=20`;
        } else {
            url += '/search?q=hot&limit=20';
        }
        
        const res = await fetch(url);
        if (!res.ok) throw new Error('DexScreener API error');
        const data = await res.json();
        const pairs = data.pairs || data.results || [];
        
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
        
        if (pairs.length === 0) {
            grid.innerHTML = '<div class="loading">No pairs found.</div>';
        }
    } catch (err) {
        grid.innerHTML = `<div class="error">Error: ${err.message}</div>`;
    }
}

function filterDexPairs(query) {
    const pairs = document.querySelectorAll('#tool-content .dex-pair');
    pairs.forEach(pair => {
        pair.style.display = pair.dataset.pair.includes(query.toLowerCase()) ? 'block' : 'none';
    });
}

document.addEventListener('DOMContentLoaded', initDexScanner);
