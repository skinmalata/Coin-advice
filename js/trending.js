async function loadTrending(filter = 'gainers') {
    const list = document.getElementById('tool-content');
    list.innerHTML = '<div class="loading">Loading trending coins...</div>';
    
    try {
        const coins = await API.coingecko.getPrices(null, 50);
        let filtered;
        
        if (filter === 'gainers') {
            filtered = coins.sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)).slice(0, 15);
        } else if (filter === 'losers') {
            filtered = coins.sort((a, b) => (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0)).slice(0, 15);
        } else {
            const data = await fetch('https://api.coingecko.com/api/v3/search/trending').then(r => r.json());
            filtered = data.coins?.slice(0, 15).map(c => c.item) || [];
        }
        
        list.innerHTML = filtered.map(coin => `
            <div class="crypto-card" data-name="${coin.name?.toLowerCase() || ''}">
                <div class="coin-header">
                    <div>
                        <div class="coin-name">${coin.name}</div>
                        <div class="coin-symbol">${coin.symbol?.toUpperCase()}</div>
                    </div>
                    ${coin.image ? `<img src="${coin.image}" width="32" height="32">` : ''}
                </div>
                <div class="coin-price">$${coin.current_price?.toLocaleString() || 'N/A'}</div>
                ${coin.price_change_percentage_24h !== undefined ? `
                    <div class="price-change ${coin.price_change_percentage_24h > 0 ? 'positive' : 'negative'}">
                        ${coin.price_change_percentage_24h?.toFixed(2)}%
                    </div>
                ` : ''}
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = `<div class="error">Error: ${err.message}</div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadTrending('gainers');
    
    document.querySelectorAll('.trending-controls .btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.trending-controls .btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadTrending(btn.dataset.filter);
        });
    });
});
