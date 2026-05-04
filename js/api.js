const RAPIDAPI_KEY = localStorage.getItem('rapidapi-key') || 'bc006f0aa1msh37b9cf3cb691ca2p1ec37djsn7397984cbc08';

const API = {
    coingecko: {
        base: 'https://api.coingecko.com/api/v3',
        async getPrices(ids = null, perPage = 50) {
            let url = `${this.base}/coins/marks]!d~[href="https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&sparkline=false&price_change_percentage=24h&per_page=100&page=1">https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&sparkline=false&price_change_percentage=24h&per_page=100&page=1</a>;
            if (ids && ids.length > 0) {
                url = `${this.base}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=false&price_change_percentage=24h`;
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
        async getArbitrage(coin = 'btc', exchange = '') {
            let url = `${this.base}/crypto-arbitrage?coin=${coin}`;
            if (exchange) url += `&exchange=${exchange}`;
            
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': 'crypto-arbitrage3.p.rapidapi.com',
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok) throw new Error(`RapidAPI error: ${res.status}`);
            return res.json();
        }
    },
    coingecko_global: {
        base: 'https://api.coingecko.com/api/v3',
        async getGlobalData() {
            const res = await fetch(`${this.base}/global`);
            if (!res.ok) throw new Error('CoinGecko Global API error');
            return res.json();
        },
        async getTopCoins(limit = 5) {
            const res = await fetch(`${this.base}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`);
            if (!res.ok) throw new Error('CoinGecko API error');
            return res.json();
        }
    }
};
