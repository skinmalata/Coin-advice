document.addEventListener('DOMContentLoaded', () => {
    loadAirdrops();
    
    document.getElementById('refresh-airdrops').addEventListener('click', loadAirdrops);
    document.getElementById('airdrop-search').addEventListener('input', (e) => {
        filterAirdrops(e.target.value);
    });
    document.getElementById('airdrop-filter').addEventListener('change', loadAirdrops);
});

async function loadAirdrops() {
    const list = document.getElementById('tool-content');
    const filter = document.getElementById('airdrop-filter').value;
    list.innerHTML = '<div class="loading">Loading potential airdrops from DeFiLlama...</div>';
    
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
                        <button class="btn" style="flex: 1; padding: 8px; background: ${isTracked ? 'var(--md-red)' : 'var(--md-green)'};" onclick="trackAirdrop('${protocol.name}', '${protocol.symbol || 'N/A'}', '${protocol.category || 'DeFi'}')">
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
    const list = document.getElementById('my-airdrops-list');
    const tracked = getTrackedAirdrops();
    
    if (!list) return;
    
    if (tracked.length === 0) {
        list.innerHTML = '<div style="color: #CAC4D0; padding: 16px;">No airdrops tracked yet.</div>';
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
                <button onclick="trackAirdrop('${airdrop.name}', '${airdrop.token}', '${airdrop.category || 'DeFi'}')">Remove</button>
            </div>
        </div>
    `).join('');
}

function filterAirdrops(query) {
    const cards = document.querySelectorAll('#tool-content .crypto-card');
    cards.forEach(card => {
        card.style.display = card.dataset.name.includes(query.toLowerCase()) ? 'block' : 'none';
    });
}

function getStatusColor(status) {
    switch(status) {
        case 'active': return 'var(--md-green)';
        case 'potential': return 'var(--md-primary)';
        case 'tracked': return 'var(--md-primary)';
        default: return 'var(--md-outline)';
    }
}
