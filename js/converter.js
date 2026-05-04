const currencies = [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'crypto' },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', type: 'crypto' },
    { id: 'tether', symbol: 'USDT', name: 'Tether', type: 'crypto' },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB', type: 'crypto' },
    { id: 'solana', symbol: 'SOL', name: 'Solana', type: 'crypto' },
    { id: 'ripple', symbol: 'XRP', name: 'XRP', type: 'crypto' },
    { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin', type: 'crypto' },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano', type: 'crypto' },
    { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', type: 'crypto' },
    { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', type: 'crypto' },
    { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', type: 'crypto' },
    { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', type: 'crypto' },
    { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', type: 'crypto' },
    { id: 'matic-network', symbol: 'MATIC', name: 'Polygon', type: 'crypto' },
    { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu', type: 'crypto' },
    { id: 'usd', symbol: 'USD', name: 'US Dollar', type: 'fiat' },
    { id: 'eur', symbol: 'EUR', name: 'Euro', type: 'fiat' },
    { id: 'gbp', symbol: 'GBP', name: 'British Pound', type: 'fiat' },
    { id: 'jpy', symbol: 'JPY', name: 'Japanese Yen', type: 'fiat' },
    { id: 'ngn', symbol: 'NGN', name: 'Nigerian Naira', type: 'fiat' }
];

let prices = {};
let conversionHistory = [];

async function loadPrices() {
    try {
        const cryptoIds = currencies.filter(c => c.type === 'crypto').map(c => c.id).join(',');
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds}&vs_currencies=usd`);
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        prices = { usd: 1 };
        for (const [id, val] of Object.entries(data)) {
            prices[id] = val.usd;
            prices['usd_to_' + id] = 1 / val.usd;
        }
        const eurRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur,gbp,jpy');
        if (eurRes.ok) {
            const eurData = await eurRes.json();
            prices.eur = 1 / eurData.bitcoin.eur;
            prices.gbp = 1 / eurData.bitcoin.gbp;
            prices.jpy = 1 / eurData.bitcoin.jpy;
            prices.usd_to_eur = eurData.bitcoin.eur;
            prices.usd_to_gbp = eurData.bitcoin.gbp;
            prices.usd_to_jpy = eurData.bitcoin.jpy;
            prices.usd_to_ngn = 1500;
        }
    } catch (e) {
        prices = {
            usd: 1,
            bitcoin: 105000,
            ethereum: 3200,
            tether: 1,
            binancecoin: 720,
            solana: 210,
            ripple: 2.8,
            'usd-coin': 1,
            cardano: 1.1,
            dogecoin: 0.35,
            polkadot: 8.5,
            litecoin: 125,
            avalanche: 42,
            chainlink: 18,
            'matic-network': 0.65,
            'shiba-inu': 0.000028,
            eur: 0.92,
            gbp: 0.79,
            jpy: 152,
            ngn: 1500
        };
    }
    populateDropdowns();
}

function populateDropdowns() {
    const fromSelect = document.getElementById('from-currency');
    const toSelect = document.getElementById('to-currency');
    if (!fromSelect || !toSelect) return;
    
    fromSelect.innerHTML = currencies.map(c => 
        `<option value="${c.id}">${c.symbol} - ${c.name}</option>`
    ).join('');
    
    toSelect.innerHTML = currencies.map(c => 
        `<option value="${c.id}">${c.symbol} - ${c.name}</option>`
    ).join('');
    
    fromSelect.value = 'bitcoin';
    toSelect.value = 'usd';
}

function convert() {
    const from = document.getElementById('from-currency').value;
    const to = document.getElementById('to-currency').value;
    const amount = parseFloat(document.getElementById('amount').value);
    
    if (!amount || amount <= 0) {
        document.getElementById('result').innerHTML = '<div class="error">Please enter a valid amount</div>';
        return;
    }
    
    const fromPrice = prices[from] || 1;
    const toPrice = prices[to] || 1;
    
    let result;
    if (from === 'usd') {
        result = amount * (toPrice || 1);
    } else if (to === 'usd') {
        result = amount * fromPrice;
    } else {
        const usdAmount = amount * fromPrice;
        result = usdAmount / toPrice;
    }
    
    const fromCurr = currencies.find(c => c.id === from);
    const toCurr = currencies.find(c => c.id === to);
    
    let displayResult;
    if (result >= 1000) {
        displayResult = result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (result >= 1) {
        displayResult = result.toFixed(4);
    } else {
        displayResult = result.toFixed(8);
    }
    
    document.getElementById('result').innerHTML = `
        <div class="result-card" style="text-align: center;">
            <div style="font-size: 14px; color: #A8A8B3; margin-bottom: 8px;">${amount} ${fromCurr.symbol} =</div>
            <div style="font-size: 32px; font-weight: bold; color: #EFD834;">${displayResult} ${toCurr.symbol}</div>
            <div style="font-size: 12px; color: #666; margin-top: 8px;">1 ${fromCurr.symbol} = ${(result / amount).toFixed(6)} ${toCurr.symbol}</div>
        </div>
    `;
    
    saveConversion({ from: fromCurr.symbol, to: toCurr.symbol, amount, result, timestamp: new Date().toISOString() });
    renderHistory();
}

function saveConversion(conv) {
    const history = JSON.parse(localStorage.getItem('converter-history') || '[]');
    history.unshift(conv);
    if (history.length > 10) history.pop();
    localStorage.setItem('converter-history', JSON.stringify(history));
}

function renderHistory() {
    const history = JSON.parse(localStorage.getItem('converter-history') || '[]');
    const container = document.getElementById('history');
    if (!container) return;
    
    if (history.length === 0) {
        container.innerHTML = '<div style="color: #A8A8B3; padding: 16px; text-align: center;">No conversion history yet</div>';
        return;
    }
    
    container.innerHTML = history.map(h => `
        <div style="padding: 12px; border-bottom: 1px solid #2A2A3C;">
            <div style="color: #E0E0E0;">${h.amount} ${h.from} = ${h.result.toFixed(4)} ${h.to}</div>
            <div style="font-size: 11px; color: #666;">${new Date(h.timestamp).toLocaleString()}</div>
        </div>
    `).join('');
}

function swapCurrencies() {
    const from = document.getElementById('from-currency');
    const to = document.getElementById('to-currency');
    const temp = from.value;
    from.value = to.value;
    to.value = temp;
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadPrices();
    renderHistory();
});