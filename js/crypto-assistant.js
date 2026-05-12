const CryptoAssistant = {
    session: { history: [], context: {} },

    init() {
        this.buildWidget();
        this.bindEvents();
        this.showGreeting();
    },

    buildWidget() {
        const w = document.createElement('div');
        w.id = 'crypto-assistant';
        w.innerHTML = `
            <div id="ca-toggle" role="button" aria-label="Open AI AI Crypto Advisor">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div id="ca-panel">
                <div id="ca-header">
                    <div id="ca-header-info">
                        <div id="ca-avatar">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        </div>
                        <div>
                            <div id="ca-title">AI Crypto Advisor</div>
                            <div id="ca-status">Online</div>
                        </div>
                    </div>
                    <button id="ca-close" aria-label="Close chat">✕</button>
                </div>
                <div id="ca-messages"></div>
                <div id="ca-suggestions"></div>
                <div id="ca-input-area">
                    <input type="text" id="ca-input" placeholder="Ask about any crypto..." autocomplete="off">
                    <button id="ca-send" aria-label="Send">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(w);
    },

    bindEvents() {
        document.getElementById('ca-toggle').onclick = () => this.toggle(true);
        document.getElementById('ca-close').onclick = () => this.toggle(false);
        const input = document.getElementById('ca-input');
        document.getElementById('ca-send').onclick = () => this.send();
        input.onkeydown = (e) => { if (e.key === 'Enter') this.send(); };
    },

    toggle(open) {
        document.getElementById('crypto-assistant').classList.toggle('open', open);
        if (open) document.getElementById('ca-input').focus();
    },

    showGreeting() {
        setTimeout(() => {
            this.addMessage('assistant',
                '<b>👋 Welcome to CoinAdvice AI</b>\n\nI\'m your crypto analyst. Ask me about any cryptocurrency, get market insights, or explore trading ideas. All data is live from the market.'
            );
            this.renderQuickCommands();
        }, 400);
    },

    renderQuickCommands() {
        const container = document.getElementById('ca-suggestions');
        container.innerHTML = '';
        const cmds = [
            { label: '📈 Top Gainers', action: 'top gainers today' },
            { label: '📉 Top Losers', action: 'top losers today' },
            { label: '🔥 Trending', action: 'trending coins' },
            { label: '🌍 Market', action: 'market summary' },
            { label: '₿ Bitcoin', action: 'analyze bitcoin' },
            { label: 'Ξ Ethereum', action: 'analyze ethereum' },
        ];
        cmds.forEach(c => {
            const btn = document.createElement('button');
            btn.className = 'ca-suggestion';
            btn.textContent = c.label;
            btn.onclick = () => { document.getElementById('ca-input').value = c.action; this.send(); };
            container.appendChild(btn);
        });
    },

    async send() {
        const input = document.getElementById('ca-input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        document.getElementById('ca-suggestions').innerHTML = '';
        this.session.history.push({ role: 'user', text });
        this.addMessage('user', text);
        this.addTyping();
        try {
            const response = await this.processQuery(text);
            this.session.history.push({ role: 'assistant', text: response });
            this.removeTyping();
            this.addMessage('assistant', response);
            this.renderQuickCommands();
        } catch (e) {
            this.removeTyping();
            this.addMessage('assistant', 'Sorry, I had trouble processing that. Please try again.');
            this.renderQuickCommands();
        }
    },

    addMessage(role, content) {
        const el = document.createElement('div');
        el.className = `ca-msg ca-${role}`;
        el.innerHTML = `<div class="ca-bubble">${content}</div>`;
        document.getElementById('ca-messages').appendChild(el);
        this.scroll();
    },

    addTyping() {
        const el = document.createElement('div');
        el.className = 'ca-msg ca-assistant';
        el.id = 'ca-typing';
        el.innerHTML = '<div class="ca-bubble ca-typing"><span></span><span></span><span></span></div>';
        document.getElementById('ca-messages').appendChild(el);
        this.scroll();
    },

    removeTyping() {
        const t = document.getElementById('ca-typing');
        if (t) t.remove();
    },

    scroll() {
        const container = document.getElementById('ca-messages');
        container.scrollTop = container.scrollHeight;
    },

    async processQuery(text) {
        const q = text.toLowerCase().trim();
        if (this.isGreeting(q)) return this.getGreetingResponse();
        if (this.isThanks(q)) return this.getThanksResponse();
        if (this.isHelp(q)) return this.getHelpResponse();
        if (this.isCompareQuery(q)) return await this.handleCompare(q);
        if (this.isMarketSummary(q)) return await this.getMarketSummary();
        if (this.isTrending(q)) return await this.getTrendingResponse();
        if (this.isTopGainers(q)) return await this.getTopMovers('gainers');
        if (this.isTopLosers(q)) return await this.getTopMovers('losers');
        if (this.isAltcoins(q)) return await this.getAltcoinPicks();
        if (this.isTradeIdea(q)) return await this.getTradeIdea(q);
        if (this.isHowToQuery(q)) return await this.searchAndRender(q);
        const coin = await this.extractCoin(q);
        if (coin && (this.isAnalysisQuery(q) || this.isPriceQuery(q) || q.includes(coin.toLowerCase().split('-')[0]))) {
            return await this.getCoinAnalysis(coin, q);
        }
        if (this.isBtcQuery(q)) return await this.getCoinAnalysis('bitcoin', q);
        if (this.isEthQuery(q)) return await this.getCoinAnalysis('ethereum', q);
        if (this.isDefiQuery(q)) return this.getDefiExplanation();
        if (this.isWalletQuery(q)) return this.getWalletExplanation();
        if (this.isStakingQuery(q)) return this.getStakingExplanation();
        if (coin) return await this.getCoinAnalysis(coin, q);
        return await this.fallbackGeneral(q);
    },

    isGreeting(q) { return /^(hi|hello|hey|sup|howdy|good morning|good evening)\b/.test(q); },
    isThanks(q) { return /\b(thanks|thank you|thx|appreciate)\b/.test(q); },
    isHelp(q) { return /\b(help|what can you|what do you)\b/.test(q); },
    isMarketSummary(q) {
        if (this.session.context.lastCoin) return false;
        return /\b(market|summary|overview|global|crypto market|what.*happening|today.*crypto)\b/.test(q);
    },
    isTrending(q) { return /\b(trending|hot|popular|what.*people|what.*buzz)\b/.test(q); },
    isTopGainers(q) { return /\b(top.*gain|gainers|biggest.*gain|highest.*gain)\b/.test(q) && !/\blosers?\b/.test(q); },
    isTopLosers(q) { return /\b(top.*los|losers?|biggest.*los|worst.*perfor)\b/.test(q); },
    isCompareQuery(q) { return /\b(compare|vs|versus|difference|which.*better|which.*best)\b/.test(q); },
    isAltcoins(q) { return /\b(altcoin|alt.*coin|best alt|potential.*alt|alt.*week|small cap|low cap)\b/.test(q); },
    isTradeIdea(q) { return /\b(trade|signal|entry|buy.*now|sell.*now|should.*buy|should.*sell|opportunity|support|resistance)\b/.test(q); },
    isHowToQuery(q) { return /\b(how to|how do i|guide|tutorial|steps|way to|learn|what is)\b/.test(q); },
    isPriceQuery(q) { return /\b(price|worth|cost|rate|value|how much)\b/.test(q); },
    isAnalysisQuery(q) { return /\b(analyze|analysis|explain|about|tell me|outlook|forecast|predict|bullish|bearish)\b/.test(q); },
    isDefiQuery(q) { return /\b(defi|decentralized finance|liquidity pool|yield farming|aave|compound|uni|swap)\b/.test(q); },
    isBtcQuery(q) { return /\b(bitcoin|btc)\b/.test(q) && !this.extractCoin(q); },
    isEthQuery(q) { return /\b(ethereum|eth)\b/.test(q) && !this.extractCoin(q); },
    isWalletQuery(q) { return /\b(wallet|cold storage|hardware wallet|self.?custody|ledger|trezor)\b/.test(q); },
    isStakingQuery(q) { return /\b(staking|stake|apy|earn.*crypto|passive income|rewards)\b/.test(q); },

    getGreetingResponse() {
        return 'Hello! I\'m your crypto analyst at <b>CoinAdvice</b>.\n\nI can help you with:\n• <b>Coin analysis</b> — "Analyze Solana" or "Explain Bitcoin"\n• <b>Market overview</b> — "What\'s happening in crypto today?"\n• <b>Trending & gainers</b> — "Top gainers" or "Trending coins"\n• <b>Trading ideas</b> — "Trade idea for Ethereum"\n• <b>Compare coins</b> — "Compare Bitcoin and Solana"\n• <b>Learn crypto</b> — "What is DeFi?" or "How does staking work?"\n\nTry the quick buttons below or ask your own question!';
    },

    getThanksResponse() {
        return 'You\'re welcome! Feel free to ask more questions anytime. I\'m here to help you navigate crypto.';
    },

    getHelpResponse() {
        return this.getGreetingResponse();
    },

    async extractCoin(q) {
        const words = q.split(/\s+/).filter(w => w.length > 1).slice(0, 5);
        const map = {
            'bitcoin': 'bitcoin', 'btc': 'bitcoin',
            'ethereum': 'ethereum', 'eth': 'ethereum',
            'solana': 'solana', 'sol': 'solana',
            'cardano': 'cardano', 'ada': 'cardano',
            'ripple': 'ripple', 'xrp': 'ripple',
            'binance coin': 'binancecoin', 'bnb': 'binancecoin',
            'dogecoin': 'dogecoin', 'doge': 'dogecoin',
            'polkadot': 'polkadot', 'dot': 'polkadot',
            'avalanche': 'avalanche-2', 'avax': 'avalanche-2',
            'chainlink': 'chainlink', 'link': 'chainlink',
            'polygon': 'matic-network', 'matic': 'matic-network',
            'litecoin': 'litecoin', 'ltc': 'litecoin',
            'uniswap': 'uniswap', 'uni': 'uniswap',
            'tron': 'tron', 'trx': 'tron',
            'sui': 'sui',
            'aptos': 'aptos', 'apt': 'aptos',
            'near': 'near',
            'optimism': 'optimism', 'op': 'optimism',
            'arbitrum': 'arbitrum', 'arb': 'arbitrum',
            'injective': 'injective-protocol', 'inj': 'injective-protocol',
            'render': 'render-token', 'rndr': 'render-token',
            'fetch.ai': 'fetch-ai', 'fet': 'fetch-ai',
            'worldcoin': 'worldcoin-wld', 'wld': 'worldcoin-wld',
            'pepe': 'pepe', 'pepecoin': 'pepe',
            'shiba': 'shiba-inu', 'shib': 'shiba-inu',
            'stellar': 'stellar', 'xlm': 'stellar',
            'cosmos': 'cosmos', 'atom': 'cosmos',
            'filecoin': 'filecoin', 'fil': 'filecoin',
            'theta': 'theta-token',
            'vechain': 'vechain', 'vet': 'vechain',
            'toncoin': 'the-open-network', 'ton': 'the-open-network',
            'ondo': 'ondo-finance',
            'sei': 'sei-network',
            'celestia': 'celestia', 'tia': 'celestia',
            'jupiter': 'jupiter-exchange-solana',
            'wormhole': 'wormhole',
            'strk': 'strk',
            'ethereum classic': 'ethereum-classic', 'etc': 'ethereum-classic',
            'monero': 'monero', 'xmr': 'monero',
            'bitcoin cash': 'bitcoin-cash', 'bch': 'bitcoin-cash',
            'lido': 'lido-dao', 'ldo': 'lido-dao',
            'aave': 'aave',
            'maker': 'maker', 'mkr': 'maker',
            'compound': 'compound-governance-token', 'comp': 'compound-governance-token',
            'cronos': 'crypto-com-chain', 'cro': 'crypto-com-chain',
            'algorand': 'algorand', 'algo': 'algorand',
            'tezos': 'tezos', 'xtz': 'tezos',
            'hedera': 'hedera-hashgraph', 'hbar': 'hedera-hashgraph',
            'flow': 'flow',
            'elrond': 'elrond-erd-2', 'egld': 'elrond-erd-2',
            'immutable': 'immutable', 'imx': 'immutable',
            'gala': 'gala',
            'sandbox': 'the-sandbox', 'sand': 'the-sandbox',
            'decentraland': 'decentraland', 'mana': 'decentraland',
            'axie': 'axie-infinity', 'axs': 'axie-infinity',
            'pyth': 'pyth-network',
            'beam': 'beam-2',
            'dydx': 'dydx-chain',
            'gnosis': 'gnosis', 'gno': 'gnosis',
            'pendle': 'pendle',
            'eigenlayer': 'eigenlayer', 'eigen': 'eigenlayer',
            'aevo': 'aevo',
            'ionet': 'io-net', 'io': 'io-net',
            'omni': 'omni-network',
            'saga': 'saga-2',
            'sats': 'sats',
            'kaspa': 'kaspa', 'kas': 'kaspa',
            'fet': 'fetch-ai',
            'bittensor': 'bittensor', 'tao': 'bittensor',
            'maker': 'maker', 'mkr': 'maker',
            'thorchain': 'thorchain', 'rune': 'thorchain',
            'fantom': 'fantom', 'ftm': 'fantom',
            'arweave': 'arweave', 'ar': 'arweave',
            'akash': 'akash-network', 'akt': 'akash-network',
            'mina': 'mina-protocol',
            'conflux': 'conflux', 'cfx': 'conflux',
            'iotex': 'iotex', 'iotx': 'iotex',
            'kava': 'kava',
            'neutron': 'neutron-3', 'ntrn': 'neutron-3',
            'dymension': 'dymension', 'dym': 'dymension',
            'saga': 'saga-2',
            'altlayer': 'altlayer', 'alt': 'altlayer',
            'port3': 'port3-network',
            'nano': 'nano', 'xno': 'nano',
            'bittorrent': 'bittorrent', 'btt': 'bittorrent',
            'chiliz': 'chiliz', 'chz': 'chiliz',
            'enjin': 'enjin-coin', 'enj': 'enjin-coin',
            'basic attention': 'basic-attention-token', 'bat': 'basic-attention-token',
            'zcash': 'zcash', 'zec': 'zcash',
            'dash': 'dash',
            'eos': 'eos',
            'iota': 'iota', 'miota': 'iota',
            'neo': 'neo',
            'waves': 'waves',
            'kucoin': 'kucoin-shares', 'kcs': 'kucoin-shares',
            'okb': 'okb',
            'canto': 'canto',
            'zilliqa': 'zilliqa', 'zil': 'zilliqa',
            'dexe': 'dexe',
            'radix': 'radix', 'xrd': 'radix',
            'myro': 'myro',
            'dogwifhat': 'dogwifhat', 'wif': 'dogwifhat',
            'bonk': 'bonk',
            'floki': 'floki',
            'memecoin': 'memecoin-2', 'meme': 'memecoin-2',
        };
        const matched = Object.entries(map).find(([name]) => q.includes(name));
        if (matched) {
            this.session.context.lastCoin = matched[1];
            return matched[1];
        }
        return this.dynamicLookup(q);
    },

    async dynamicLookup(q) {
        const words = q.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1 && !['what','which','this','that','with','about','tell','give','show','find','price','rate','value','coin','token','analyze','analysis','explain','buy','sell','trade','market','today','now','how','the','for','and','its','has','are','is','it','on','in','to','of','at','by','be','do','up','down','good','bad','best','worst','new','old','big','small','high','low','top','all','any','can','get','see','know','want','need','look','check','think','just','like','was','will','has','had','but','not','out','so','if','no','or','an','me','my','your','from','than','then','also','very'].includes(w));
        for (const w of words) {
            try {
                const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(w)}`, { signal: AbortSignal.timeout(5000) });
                if (!res.ok) continue;
                const data = await res.json();
                const coin = data.coins?.[0];
                if (coin?.id) {
                    this.session.context.lastCoin = coin.id;
                    return coin.id;
                }
            } catch {}
        }
        return null;
    },

    async fetchWithCache(url, cacheMs = 120000) {
        const key = 'ca_' + btoa(url).slice(0, 36);
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const { data, ts } = JSON.parse(raw);
                if (Date.now() - ts < cacheMs) return data;
            }
        } catch {}
        const res = await fetch(url);
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
        return data;
    },

    formatPrice(n) {
        if (!n && n !== 0) return 'N/A';
        if (n < 0.000001) return '$' + n.toFixed(12);
        if (n < 0.001) return '$' + n.toFixed(9);
        if (n < 1) return '$' + n.toFixed(6);
        if (n < 1000) return '$' + n.toFixed(4);
        return '$' + n.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    },

    formatLargeNumber(n) {
        if (!n && n !== 0) return 'N/A';
        if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
        if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
        return n.toFixed(2);
    },

    async getMarketSummary() {
        try {
            const [globalRes, topRes] = await Promise.all([
                this.fetchWithCache('https://api.coingecko.com/api/v3/global', 120000),
                this.fetchWithCache('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&sparkline=false&price_change_percentage=24h', 120000)
            ]);
            const d = globalRes.data;
            const btcDom = d.market_cap_percentage?.btc?.toFixed(1) || '?';
            const ethDom = d.market_cap_percentage?.eth?.toFixed(1) || '?';
            const mcap = this.formatLargeNumber(d.total_market_cap?.usd || 0);
            const vol = this.formatLargeNumber(d.total_volume?.usd || 0);
            const btcChange = d.market_cap_change_percentage_24h_usd?.toFixed(2);
            const direction = btcChange >= 0 ? '📈 Bullish' : '📉 Bearish';

            let movers = { up: [], down: [] };
            topRes.forEach(c => {
                const ch = c.price_change_percentage_24h || 0;
                if (ch > 0) movers.up.push({ n: c.name, ch });
                if (ch < 0) movers.down.push({ n: c.name, ch });
            });
            movers.up.sort((a, b) => b.ch - a.ch);
            movers.down.sort((a, b) => a.ch - b.ch);

            let topMover = movers.up[0] ? `<b>${movers.up[0].n}</b> (+${movers.up[0].ch.toFixed(1)}%)` : 'N/A';
            let topFall = movers.down[0] ? `<b>${movers.down[0].n}</b> (${movers.down[0].ch.toFixed(1)}%)` : 'N/A';

            return `<b>🌍 Daily Market Summary</b>

<b>Overall Direction:</b> ${direction} (${btcChange}%)
<b>Total Market Cap:</b> ${mcap}
<b>24h Volume:</b> ${vol}
<b>BTC Dominance:</b> ${btcDom}% | <b>ETH Dominance:</b> ${ethDom}%

<b>📈 Top Mover:</b> ${topMover}
<b>📉 Top Faller:</b> ${topFall}

<b>Key Narratives:</b>
• Bitcoin dominance at ${btcDom}% — ${btcDom > 50 ? 'suggesting altcoin season may not be here yet' : 'altcoins gaining relative share'}
• Market sentiment is ${btcChange >= 2 ? 'strongly positive' : btcChange >= 0 ? 'mildly positive' : btcChange >= -2 ? 'mildly negative' : 'cautious'}
• ${d.active_cryptocurrencies || '?'} active coins across ${d.markets || '?'} markets

<i>Data refreshes every 2 minutes • CoinAdvice AI</i>`;
        } catch {
            return 'Unable to fetch market data right now. Please try again shortly.';
        }
    },

    async getTrendingResponse() {
        try {
            const d = await this.fetchWithCache('https://api.coingecko.com/api/v3/search/trending', 60000);
            let list = '';
            d.coins.slice(0, 7).forEach((c, i) => {
                const item = c.item;
                const score = item.score !== undefined ? '🔥'.repeat(Math.min(3, Math.max(1, 4 - item.score))) : '';
                const rank = item.market_cap_rank ? `#${item.market_cap_rank}` : 'N/A';
                list += `${i+1}. <b>${item.name}</b> <code>${item.symbol.toUpperCase()}</code>\n   Rank: ${rank} ${score}\n`;
            });
            return `<b>🔥 Trending on CoinGecko</b>\n\nCoins gaining the most community attention right now:\n\n${list}\n<i>Based on search volume and social interest</i>`;
        } catch {
            return 'Unable to fetch trending coins right now.';
        }
    },

    async getTopMovers(type) {
        try {
            const d = await this.fetchWithCache('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&sparkline=false&price_change_percentage=24h', 120000);
            const sorted = [...d].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
            const items = type === 'gainers' ? sorted.slice(0, 5) : sorted.reverse().slice(0, 5);
            const emoji = type === 'gainers' ? '📈' : '📉';
            const color = type === 'gainers' ? '#10b981' : '#ef4444';
            const title = type === 'gainers' ? 'Top 5 Gainers (24h)' : 'Top 5 Losers (24h)';
            let list = '';
            items.forEach(c => {
                const ch = c.price_change_percentage_24h || 0;
                const sign = ch >= 0 ? '+' : '';
                list += `<b>${c.name}</b> (${c.symbol.toUpperCase()}) — <span style="color:${color}">${emoji} ${sign}${ch.toFixed(1)}%</span> → ${this.formatPrice(c.current_price)}\n`;
            });
            return `<b>${title}</b>\n\n${list}\n<i>Sorted by 24h price change • Top 50 coins by market cap</i>`;
        } catch {
            return 'Unable to fetch market data right now.';
        }
    },

    async getAltcoinPicks() {
        try {
            const d = await this.fetchWithCache('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=50&sparkline=false&price_change_percentage=24h%2C7d', 120000);
            const filtered = d.filter(c => {
                const mcap = c.market_cap || 0;
                const vol = c.total_volume || 0;
                const ch24 = c.price_change_percentage_24h || 0;
                const ch7 = c.price_change_percentage_7d || 0;
                return mcap < 5e9 && mcap > 5e7 && vol > 5e6 && ch7 > 0 && ch24 > -5;
            }).sort((a, b) => (b.price_change_percentage_7d || 0) - (a.price_change_percentage_7d || 0)).slice(0, 5);
            let list = '';
            filtered.forEach((c, i) => {
                list += `${i+1}. <b>${c.name}</b> <code>${c.symbol.toUpperCase()}</code>\n   MCap: ${this.formatLargeNumber(c.market_cap)} | 7d: 📈 +${(c.price_change_percentage_7d || 0).toFixed(1)}% | Vol: ${this.formatLargeNumber(c.total_volume)}\n`;
            });
            return `<b>💎 Altcoins Showing Potential</b>\n\nCoins with positive weekly momentum and moderate market caps:\n\n${list}\n\n<b>⚠️ Disclaimer:</b> This is not financial advice. Always DYOR before investing.`;
        } catch {
            return 'Unable to fetch altcoin data right now.';
        }
    },

    async handleCompare(q) {
        const coins = [];
        const map = {
            'bitcoin': 'bitcoin', 'btc': 'bitcoin',
            'ethereum': 'ethereum', 'eth': 'ethereum',
            'solana': 'solana', 'sol': 'solana',
            'cardano': 'cardano', 'ada': 'cardano',
            'ripple': 'ripple', 'xrp': 'ripple',
            'bnb': 'binancecoin', 'binance coin': 'binancecoin',
            'dogecoin': 'dogecoin', 'doge': 'dogecoin',
            'polkadot': 'polkadot', 'dot': 'polkadot',
            'avalanche': 'avalanche-2', 'avax': 'avalanche-2',
            'chainlink': 'chainlink', 'link': 'chainlink',
            'polygon': 'matic-network', 'matic': 'matic-network',
            'litecoin': 'litecoin', 'ltc': 'litecoin',
            'tron': 'tron', 'trx': 'tron',
            'sui': 'sui', 'aptos': 'aptos', 'apt': 'aptos',
            'near': 'near',
            'toncoin': 'the-open-network', 'ton': 'the-open-network',
            'ondo': 'ondo-finance',
            'sei': 'sei-network',
            'celestia': 'celestia', 'tia': 'celestia',
            'monero': 'monero', 'xmr': 'monero',
            'bitcoin cash': 'bitcoin-cash', 'bch': 'bitcoin-cash',
            'ethereum classic': 'ethereum-classic', 'etc': 'ethereum-classic',
            'stellar': 'stellar', 'xlm': 'stellar',
            'cosmos': 'cosmos', 'atom': 'cosmos',
            'filecoin': 'filecoin', 'fil': 'filecoin',
            'injective': 'injective-protocol', 'inj': 'injective-protocol',
            'thorchain': 'thorchain', 'rune': 'thorchain',
            'fantom': 'fantom', 'ftm': 'fantom',
            'kava': 'kava',
            'eos': 'eos',
            'iota': 'iota',
            'neo': 'neo',
            'waves': 'waves',
        };
        for (const [name, id] of Object.entries(map)) {
            if (q.includes(name) && !coins.includes(id)) coins.push(id);
            if (coins.length >= 2) break;
        }
        if (coins.length < 2) {
            if (this.session.context.lastCompare) coins.push(...this.session.context.lastCompare);
            if (coins.length < 2) return 'Please specify two coins to compare, e.g. "Compare Bitcoin and Ethereum".';
        }
        this.session.context.lastCompare = coins;
        try {
            const [a, b] = await Promise.all([
                this.fetchWithCache(`https://api.coingecko.com/api/v3/coins/${coins[0]}?localization=false&tickers=false&community_data=false&developer_data=false`, 120000),
                this.fetchWithCache(`https://api.coingecko.com/api/v3/coins/${coins[1]}?localization=false&tickers=false&community_data=false&developer_data=false`, 120000)
            ]);
            const ma = a.market_data || {}, mb = b.market_data || {};
            const nameA = a.name, nameB = b.name;
            const symA = a.symbol?.toUpperCase(), symB = b.symbol?.toUpperCase();

            const row = (label, va, vb) =>
                `<tr><td style="padding:4px 8px;color:var(--text-muted)">${label}</td><td style="padding:4px 8px;text-align:right"><b>${va}</b></td><td style="padding:4px 8px;text-align:right"><b>${vb}</b></td></tr>`;

            return `<b>⚖️ ${nameA} vs ${nameB}</b>
<table style="width:100%;font-size:0.85rem;border-collapse:collapse;margin-top:8px">
<tr style="border-bottom:1px solid rgba(255,255,255,0.06)"><th style="padding:4px 8px;text-align:left;color:var(--text-muted)">Metric</th><th style="padding:4px 8px;text-align:right;color:#818cf8">${symA}</th><th style="padding:4px 8px;text-align:right;color:#818cf8">${symB}</th></tr>
${row('Price', this.formatPrice(ma.current_price?.usd), this.formatPrice(mb.current_price?.usd))}
${row('Market Cap', this.formatLargeNumber(ma.market_cap?.usd), this.formatLargeNumber(mb.market_cap?.usd))}
${row('24h Volume', this.formatLargeNumber(ma.total_volume?.usd), this.formatLargeNumber(mb.total_volume?.usd))}
${row('24h Change', (ma.price_change_percentage_24h || 0) >= 0 ? '📈 +' + ma.price_change_percentage_24h?.toFixed(1) + '%' : '📉 ' + ma.price_change_percentage_24h?.toFixed(1) + '%', (mb.price_change_percentage_24h || 0) >= 0 ? '📈 +' + mb.price_change_percentage_24h?.toFixed(1) + '%' : '📉 ' + mb.price_change_percentage_24h?.toFixed(1) + '%')}
${row('7d Change', (ma.price_change_percentage_7d || 0) >= 0 ? '📈 +' + ma.price_change_percentage_7d?.toFixed(1) + '%' : '📉 ' + ma.price_change_percentage_7d?.toFixed(1) + '%', (mb.price_change_percentage_7d || 0) >= 0 ? '📈 +' + mb.price_change_percentage_7d?.toFixed(1) + '%' : '📉 ' + mb.price_change_percentage_7d?.toFixed(1) + '%')}
${row('30d Change', (ma.price_change_percentage_30d || 0) >= 0 ? '📈 +' + ma.price_change_percentage_30d?.toFixed(1) + '%' : '📉 ' + ma.price_change_percentage_30d?.toFixed(1) + '%', (mb.price_change_percentage_30d || 0) >= 0 ? '📈 +' + mb.price_change_percentage_30d?.toFixed(1) + '%' : '📉 ' + mb.price_change_percentage_30d?.toFixed(1) + '%')}
${row('ATH', this.formatPrice(ma.ath?.usd), this.formatPrice(mb.ath?.usd))}
${row('Rank', '#' + (a.market_cap_rank || '?'), '#' + (b.market_cap_rank || '?'))}
</table>

<b>💡 Verdict:</b> ${this.compareVerdict(nameA, nameB, ma, mb)}

<i>Data from CoinGecko • Not financial advice</i>`;
        } catch {
            return 'Unable to fetch comparison data. Please try again.';
        }
    },

    compareVerdict(nameA, nameB, ma, mb) {
        const chA = ma.price_change_percentage_24h || 0;
        const chB = mb.price_change_percentage_24h || 0;
        const volA = ma.total_volume?.usd || 0;
        const volB = mb.total_volume?.usd || 0;
        const mcapA = ma.market_cap?.usd || 0;
        const mcapB = mb.market_cap?.usd || 0;

        if (chA > chB + 3) return `${nameA} has stronger 24h momentum (+${chA.toFixed(1)}% vs ${chB.toFixed(1)}%)`;
        if (chB > chA + 3) return `${nameB} has stronger 24h momentum (+${chB.toFixed(1)}% vs ${chA.toFixed(1)}%)`;
        if (mcapA > mcapB * 10) return `${nameA} is more established with significantly higher market cap`;
        if (mcapB > mcapA * 10) return `${nameB} is more established with significantly higher market cap`;
        if (volA > volB * 3) return `${nameA} has much higher trading volume, suggesting more liquidity`;
        if (volB > volA * 3) return `${nameB} has much higher trading volume, suggesting more liquidity`;
        return `Both coins show similar metrics. ${nameA} (rank #${ma.market_cap_rank || '?'}) vs ${nameB} (rank #${mb.market_cap_rank || '?'}). Consider your risk tolerance and investment goals.`;
    },

    async getCoinAnalysis(coinId, q) {
        try {
            const d = await this.fetchWithCache(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`, 120000);
            const md = d.market_data || {};
            const name = d.name, sym = d.symbol?.toUpperCase();
            const price = md.current_price?.usd;
            const pc24 = md.price_change_percentage_24h;
            const pc7 = md.price_change_percentage_7d;
            const pc30 = md.price_change_percentage_30d;
            const rank = d.market_cap_rank || 'N/A';
            const mcap = md.market_cap?.usd;
            const vol = md.total_volume?.usd;
            const ath = md.ath?.usd;
            const athDate = md.ath_date?.usd ? new Date(md.ath_date.usd).toLocaleDateString() : 'N/A';
            const high24 = md.high_24h?.usd;
            const low24 = md.low_24h?.usd;
            const circ = md.circulating_supply;
            const total = md.total_supply;
            const athDist = price && ath ? ((price / ath - 1) * 100).toFixed(1) : 'N/A';

            const rsi = Math.max(10, Math.min(90, 50 + (pc24 || 0) * 2.5));

            let signal, signalColor, signalDesc;
            if ((pc24 || 0) > 8) { signal = '🟢 Strong Bullish'; signalColor = '#10b981'; signalDesc = 'Strong upward momentum with significant daily gains'; }
            else if ((pc24 || 0) > 3) { signal = '🟢 Bullish'; signalColor = '#34d399'; signalDesc = 'Positive momentum with moderate daily gains'; }
            else if ((pc24 || 0) > 0) { signal = '🟡 Mildly Bullish'; signalColor = '#fbbf24'; signalDesc = 'Slight positive movement, consolidating'; }
            else if ((pc24 || 0) > -3) { signal = '🟡 Neutral'; signalColor = '#fbbf24'; signalDesc = 'Sideways movement, no clear direction'; }
            else if ((pc24 || 0) > -8) { signal = '🔴 Bearish'; signalColor = '#f87171'; signalDesc = 'Downward pressure, exercise caution'; }
            else { signal = '🔴 Strong Bearish'; signalColor = '#ef4444'; signalDesc = 'Significant sell-off, wait for stabilization'; }

            const isBuyQuery = /\b(buy|good.*invest|worth|potential|long.?term)\b/.test(q);
            const isSellQuery = /\b(sell|exit|take.*profit)\b/.test(q);

            const description = sym === 'BTC' ? 'Bitcoin is the original cryptocurrency, created in 2009. It operates on a decentralized peer-to-peer network and is the largest cryptocurrency by market cap.' :
                sym === 'ETH' ? 'Ethereum is a decentralized computing platform that enables smart contracts and decentralized applications (dApps). It transitioned to Proof of Stake in 2022.' :
                `${name} is a cryptocurrency project in the blockchain space.`;

            const bullishFactors = [];
            if ((pc7 || 0) > 5) bullishFactors.push('📈 Strong weekly performance');
            if ((pc30 || 0) > 10) bullishFactors.push('📈 Positive monthly trend');
            if (vol && mcap && (vol / mcap) > 0.2) bullishFactors.push('📊 High liquidity relative to market cap');
            if (athDist && parseFloat(athDist) < -30) bullishFactors.push('💎 Significant room for growth from current levels');
            if (rank && rank <= 10) bullishFactors.push('🏆 Top 10 cryptocurrency by market cap');
            if (bullishFactors.length === 0) bullishFactors.push('Market conditions are neutral at this time');

            const bearishRisks = [];
            if ((pc7 || 0) < -5) bearishRisks.push('📉 Weak weekly performance');
            if ((pc30 || 0) < -10) bearishRisks.push('📉 Negative monthly trend');
            if (rsi > 70) bearishRisks.push('⚠️ RSI suggests overbought conditions — potential pullback risk');
            if (rsi < 30) bearishRisks.push('⚠️ RSI suggests oversold conditions — further downside possible');
            if (athDist && parseFloat(athDist) > -5) bearishRisks.push('⚠️ Trading near all-time highs — resistance may be strong');
            if (bearishRisks.length === 0) bearishRisks.push('No major bearish signals detected at this time');

            const outlook = (pc24 || 0) > 5 ? `Short-term outlook is <b>positive</b> with strong momentum. Watch for continuation above $${(high24 || 0).toFixed(2)}.` :
                (pc24 || 0) > 0 ? `Short-term outlook is <b>cautiously optimistic</b>. Holding above $${(low24 || 0).toFixed(2)} is a positive sign.` :
                (pc24 || 0) > -3 ? `Short-term outlook is <b>neutral</b>. Price is consolidating in a range.` :
                `Short-term outlook is <b>cautious</b>. Price is under pressure. Watch for support at $${(low24 || 0).toFixed(2)}.`;

            const response = `<b>📊 ${name} (${sym}) Analysis</b>

<b>💰 Price:</b> ${this.formatPrice(price)}
<b>${signal}</b> — ${signalDesc}

<b>Price Movement</b>
• 24h: ${pc24 >= 0 ? '📈 +' : '📉 '}${pc24?.toFixed(1) || '?'}%
• 7d: ${pc7 >= 0 ? '📈 +' : '📉 '}${pc7?.toFixed(1) || '?'}%
• 30d: ${pc30 >= 0 ? '📈 +' : '📉 '}${pc30?.toFixed(1) || '?'}%

<b>Key Stats</b>
• Market Cap: ${this.formatLargeNumber(mcap)} | Rank: #${rank}
• 24h Volume: ${this.formatLargeNumber(vol)}
• 24h Range: ${this.formatPrice(low24)} — ${this.formatPrice(high24)}
• ATH: ${this.formatPrice(ath)} (${athDist}% below) — ${athDate}

<b>Technical</b>
• RSI: ${rsi.toFixed(0)} ${rsi > 70 ? '(overbought territory)' : rsi < 30 ? '(oversold territory)' : '(neutral range)'}

<b>📖 About ${name}</b>
${description}

<b>✅ Bullish Factors</b>
${bullishFactors.join('\n')}

<b>⚠️ Bearish Risks</b>
${bearishRisks.join('\n')}

<b>🔮 Short-term Outlook</b>
${outlook}

${isBuyQuery || isSellQuery ? '\n<b>⚠️ Disclaimer:</b> This is not financial advice. Cryptocurrency investments carry risk. Always do your own research before making trading decisions.' : ''}

🔗 <a href="https://coinadvice.site/pages/coin-analysis.html?coin=${coinId}" style="color:#818cf8">View full analysis on CoinAdvice →</a>`;

            return response;
        } catch {
            return 'Sorry, I couldn\'t find data for that coin. Please check the name and try again.';
        }
    },

    async getTradeIdea(q) {
        const coin = this.extractCoin(q) || 'bitcoin';
        try {
            const d = await this.fetchWithCache(`https://api.coingecko.com/api/v3/coins/${coin}?localization=false&tickers=false&community_data=false&developer_data=false`, 120000);
            const md = d.market_data || {};
            const name = d.name, sym = d.symbol?.toUpperCase();
            const price = md.current_price?.usd || 0;
            const high24 = md.high_24h?.usd || price * 1.02;
            const low24 = md.low_24h?.usd || price * 0.98;
            const pc24 = md.price_change_percentage_24h || 0;

            const support1 = (low24 * 0.97).toFixed(2);
            const support2 = (low24 * 0.93).toFixed(2);
            const resist1 = (high24 * 1.03).toFixed(2);
            const resist2 = (high24 * 1.08).toFixed(2);

            const sentiment = pc24 > 5 ? '🥇 Bullish' : pc24 > 0 ? '🟡 Mildly Bullish' : pc24 > -3 ? '🟡 Neutral' : pc24 > -8 ? '🔴 Bearish' : '🔴 Strongly Bearish';

            const bullCase = pc24 > 0 ?
                `Price is showing positive momentum with +${pc24.toFixed(1)}% in 24h. A break above $${resist1} could target $${resist2}.` :
                `Despite recent weakness, ${name} could bounce from support at $${support1}. Watch for reversal patterns.`;

            const bearCase = pc24 < 0 ?
                `Price is under selling pressure at ${pc24.toFixed(1)}% today. A break below $${support1} could test $${support2}.` :
                `${name} is showing gains but may face resistance at $${resist1}. Caution on chasing.`;

            return `<b>📊 Trade Idea: ${name} (${sym})</b>

<b>Current Price:</b> ${this.formatPrice(price)}
<b>Market Sentiment:</b> ${sentiment}

<b>📉 Support Levels</b>
• S1: ${this.formatPrice(parseFloat(support1))}
• S2: ${this.formatPrice(parseFloat(support2))}

<b>📈 Resistance Levels</b>
• R1: ${this.formatPrice(parseFloat(resist1))}
• R2: ${this.formatPrice(parseFloat(resist2))}

<b>🟢 Bullish Scenario</b>
${bullCase}

<b>🔴 Bearish Scenario</b>
${bearCase}

<b>📋 Key Levels to Watch</b>
• Holding above $${low24.toFixed(2)}: bullish continuation
• Losing $${support1}: potential further downside
• Breaking $${resist1}: next leg up likely

⚠️ <b>Disclaimer:</b> This is for educational purposes only. Not financial advice. Trading cryptocurrencies carries significant risk. Never trade more than you can afford to lose.

🔗 <a href="https://coinadvice.site/pages/coin-analysis.html?coin=${coin}" style="color:#818cf8">Full analysis →</a>`;
        } catch {
            return `Unable to generate trade idea for that coin. Please try a different coin.`;
        }
    },

    getDefiExplanation() {
        return `<b>What is DeFi?</b>

DeFi (Decentralized Finance) is a financial system built on blockchain technology that removes traditional intermediaries like banks and brokers.

<b>Key Components:</b>
• <b>Lending/Borrowing</b> — Platforms like Aave let you earn interest or take loans
• <b>Decentralized Exchanges</b> — Uniswap, SushiSwap let you trade without a central authority
• <b>Liquidity Pools</b> — Provide tokens to earn fees from trades
• <b>Stablecoins</b> — DAI, USDC maintain 1:1 value with the dollar

<b>Why It Matters:</b>
• Accessible to anyone with an internet connection
• No credit checks or approval needed
• Full control of your funds
• Transparent and auditable

<b>⚠️ Risks:</b>
• Smart contract bugs and exploits
• Impermanent loss in liquidity pools
• High gas fees during congestion
• Regulatory uncertainty`;
    },

    getWalletExplanation() {
        return `<b>Crypto Wallets Explained</b>

A crypto wallet stores your private keys — the passwords that let you access your cryptocurrency.

<b>Hot Wallets</b> (Connected to internet):
• <b>MetaMask</b> — Most popular for Ethereum and dApps
• <b>Trust Wallet</b> — Great mobile option, multi-chain
• <b>Rainbow</b> — Beautiful UI, Ethereum-focused
• Best for: daily use, small amounts, DeFi interaction

<b>Cold Wallets</b> (Offline storage):
• <b>Ledger</b> — Hardware wallet, supports 5000+ coins
• <b>Trezor</b> — Open-source hardware wallet
• <b>SafePal</b> — Affordable hardware option
• Best for: long-term holding, large amounts

<b>💡 Best Practice:</b>
• Use hot wallets for spending and DeFi
• Use cold wallets for saving and long-term storage
• Never share your seed phrase with anyone
• Write your seed phrase on paper, store securely`;
    },

    getStakingExplanation() {
        return `<b>What is Staking?</b>

Staking is the process of locking up cryptocurrency to support a blockchain network. In return, you earn rewards.

<b>How It Works:</b>
• You hold a Proof-of-Stake (PoS) cryptocurrency
• The network uses your tokens to validate transactions
• You earn a share of network fees and new token issuance
• Your tokens remain yours (subject to lockup periods)

<b>Popular Staking Coins:</b>
• <b>Ethereum (ETH)</b> — ~3-5% APY • 24h+ unbonding
• <b>Solana (SOL)</b> — ~6-8% APY • No lockup
• <b>Cardano (ADA)</b> — ~3-5% APY • No lockup
• <b>Polkadot (DOT)</b> — ~12-16% APY • 28-day unbonding
• <b>Avalanche (AVAX)</b> — ~7-10% APY • 14-day unbonding

<b>⚠️ Risks:</b>
• Token price can drop more than staking rewards earn
• Lockup periods mean you can't sell during dips
• Slashing (penalty for validator misbehavior) is rare but possible

<b>💡 Strategy:</b> Only stake coins you plan to hold long-term.`;
    },

    toolPages: [
        { title: 'Price Tracker', url: 'pages/price-tracker.html', desc: 'Live cryptocurrency prices and market data for all coins' },
        { title: 'Trending Coins', url: 'pages/trending.html', desc: 'Top gainers, losers, and trending coins on the market' },
        { title: 'Global Stats', url: 'pages/global-stats.html', desc: 'Total crypto market cap, BTC dominance, and global metrics' },
        { title: 'DEX Scanner', url: 'pages/dex-scanner.html', desc: 'Scan decentralized exchanges for hot pairs and volume' },
        { title: 'Token Checker', url: 'pages/token-checker.html', desc: 'Check if a token is safe or a potential scam' },
        { title: 'Arbitrage Scanner', url: 'pages/arbitrage.html', desc: 'Find price differences across exchanges for arbitrage' },
        { title: 'Airdrop Finder', url: 'pages/airdrops.html', desc: 'Discover active and upcoming crypto airdrops' },
        { title: 'Portfolio Tracker', url: 'pages/portfolio.html', desc: 'Track your crypto portfolio with P&L and allocations' },
        { title: 'Profit Calculator', url: 'pages/profit-calculator.html', desc: 'Calculate crypto profits, ROI, and tax implications' },
        { title: 'Converter', url: 'pages/converter.html', desc: 'Convert between cryptocurrencies and fiat currencies' },
        { title: 'Whale Tracker', url: 'pages/whale-wallet.html', desc: 'Track large cryptocurrency transactions and whale movements' },
        { title: 'Signal Scoreboard', url: 'pages/signal-scoreboard.html', desc: 'Track signal performance and liquidation data' },
        { title: 'Pump Scanner', url: 'pages/pump-scanner.html', desc: 'Detect early pumps, breakouts, and unusual volume' },
        { title: 'Coin Analysis', url: 'pages/coin-analysis.html', desc: 'Deep analysis of individual coins with technical indicators' },
    ],

    async loadBlogIndex() {
        const key = 'ca_blog_idx';
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const { data, ts } = JSON.parse(raw);
                if (Date.now() - ts < 3600000) return data;
            }
        } catch {}
        try {
            const html = await (await fetch('/blog.html')).text();
            const match = html.match(/const blogPosts\s*=\s*(\[[\s\S]*?\]);/);
            if (!match) return [];
            const data = JSON.parse(match[1]);
            try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
            return data;
        } catch { return []; }
    },

    async fetchBlogContent(url) {
        try {
            const html = await (await fetch(url)).text();
            const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
            const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
            const contentMatch = html.match(/<div class="blog-content">([\s\S]*?)<\/div>/);
            const text = contentMatch
                ? contentMatch[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
                : '';
            const snippet = text.length > 600 ? text.slice(0, 600) + '...' : text;
            return { title, snippet, url };
        } catch { return null; }
    },

    async searchAndRender(q) {
        const match = await this.websiteSearch(q);
        if (match) {
            if (match.type === 'tool') {
                return `<b>🛠️ ${match.title}</b>\n\n${match.desc}\n\n<a href="${match.url}" style="color:#818cf8">Open tool →</a>`;
            }
            const content = await this.fetchBlogContent(match.url);
            if (content && content.snippet) {
                return `<b>📖 ${content.title}</b>\n\n${content.snippet}\n\n<a href="${match.url}" style="color:#818cf8">Read full article →</a>`;
            }
        }
        return this.fallbackGeneral(q);
    },

    async websiteSearch(q) {
        const query = q.toLowerCase();
        const words = query.split(/\s+/).filter(w => w.length > 2 && !['what','which','this','that','with','about','tell','give','show','find','the','how','why','can','get','know','want','need','look','check','think','just','like','was','will','has','had','but','not','out','so','if','no','or','an','me','my','your','from','than','then','also','very','all','any','are','its'].includes(w));
        if (words.length === 0) return null;

        const results = [];

        for (const tool of this.toolPages) {
            let score = 0;
            const haystack = (tool.title + ' ' + tool.desc).toLowerCase();
            for (const w of words) { if (haystack.includes(w)) score++; }
            if (score > 0) results.push({ type: 'tool', ...tool, score });
        }

        const blogIndex = await this.loadBlogIndex();
        for (const post of blogIndex) {
            let score = 0;
            const haystack = (post.title + ' ' + post.desc).toLowerCase();
            for (const w of words) { if (haystack.includes(w)) score += haystack.includes(w) ? (post.title.toLowerCase().includes(w) ? 3 : 2) : 0; }
            if (score > 2) results.push({ type: 'blog', ...post, score });
        }

        results.sort((a, b) => b.score - a.score);
        return results.length > 0 ? results[0] : null;
    },

    async fallbackGeneral(q) {
        if (this.session.history.length > 2 && this.session.context.lastCoin) {
            const coin = this.session.context.lastCoin;
            if (/\b(long.?term|hold|future|prospect|worth)\b/.test(q)) {
                return await this.getCoinAnalysis(coin, q);
            }
            if (/\b(trade|buy|sell|entry|price target)\b/.test(q)) {
                return await this.getTradeIdea(q);
            }
        }

        if (/\b(alt.?season)\b/.test(q)) {
            return 'Alt season refers to periods when altcoins outperform Bitcoin significantly. Signs include:\n\n• BTC dominance dropping below 40%\n• ETH outperforming BTC\n• Social volume shifting to altcoins\n• Capital rotating from BTC to smaller caps\n\nTrack BTC dominance on our <a href="https://coinadvice.site/pages/global-stats.html" style="color:#818cf8">Global Stats page</a>.';
        }
        if (/\b(nft|non.?fungible)\b/.test(q)) {
            return 'NFTs (Non-Fungible Tokens) are unique digital assets verified on a blockchain. They represent ownership of digital items like art, music, or in-game assets.\n\n<b>Popular Platforms:</b>\n• OpenSea — Largest NFT marketplace\n• Blur — Professional trading platform\n• Magic Eden — Solana-focused\n\n⚠️ NFT markets are highly speculative. Use our <a href="https://coinadvice.site/pages/token-checker.html" style="color:#818cf8">Token Checker</a> to verify contracts.';
        }
        if (/\b(mcap|market cap|market capitalization)\b/.test(q)) {
            return 'Market capitalization = current price × circulating supply. It measures the total value of a cryptocurrency.\n\n<b>Categories:</b>\n• <b>Large Cap</b> (>$10B) — Established, lower risk\n• <b>Mid Cap</b> ($1-10B) — Growth potential, moderate risk\n• <b>Small Cap</b> (<$1B) — Higher risk, higher potential\n\nTrack market caps on our <a href="https://coinadvice.site/pages/global-stats.html" style="color:#818cf8">Global Stats page</a>.';
        }
        if (/\b(rsi|relative strength|indicator|technical analysis|chart)\b/.test(q)) {
            return 'RSI (Relative Strength Index) measures the speed and change of price movements on a scale of 0-100.\n\n• <b>RSI > 70</b> — Overbought (price may drop)\n• <b>RSI < 30</b> — Oversold (price may rise)\n• <b>30-70</b> — Neutral range\n\n<b>💡 Tip:</b> Combine RSI with other indicators like moving averages for better signals.';
        }
        if (/\b(gas|fee|transaction fee|gas price)\b/.test(q)) {
            return 'Gas fees are payments to network validators for processing transactions. Fees vary by network congestion.\n\n<b>Typical Fees:</b>\n• <b>Ethereum:</b> $1-50+ (varies by congestion)\n• <b>Solana:</b> ~$0.01\n• <b>Polygon:</b> ~$0.01-0.05\n• <b>BNB Chain:</b> ~$0.05-0.20\n\n<b>💡 Tip:</b> Use Layer 2 solutions (Arbitrum, Optimism) for lower Ethereum fees.';
        }
        if (/\b(dca|dollar cost average|averaging|dollar.?cost)\b/.test(q)) {
            return 'DCA (Dollar Cost Averaging) is an investment strategy where you buy a fixed dollar amount at regular intervals, regardless of price.\n\n<b>Benefits:</b>\n• Removes emotional decision-making\n• Reduces impact of volatility\n• Works well for long-term holds\n• Simple to execute\n\n<b>💡 Strategy:</b> Buy a fixed amount of BTC/ETH weekly regardless of price. Over time, you\'ll average into the market.';
        }
        if (/\b(whale|large transaction|big money|institutional)\b/.test(q)) {
            return 'Whales are entities holding large amounts of cryptocurrency. Their transactions can significantly impact markets.\n\n<b>Why Track Whales:</b>\n• Large buys often precede price increases\n• Large sells can signal tops\n• Whale accumulation is a bullish signal\n\nTrack live whale transactions on our <a href="https://coinadvice.site/pages/whale-wallet.html" style="color:#818cf8">Whale Tracker</a>.';
        }
        if (/\b(liquidation|leveraged|margin|futures)\b/.test(q)) {
            return 'Liquidations happen when leveraged trading positions are forcibly closed due to adverse price movements.\n\n<b>Key Facts:</b>\n• Large liquidations can trigger cascading price moves\n• Long liquidations accelerate downward moves\n• Short liquidations accelerate upward moves\n• Monitor liquidation levels to gauge market sentiment\n\nCheck live data on our <a href="https://coinadvice.site/pages/signal-scoreboard.html" style="color:#818cf8">Signal Scoreboard</a>.';
        }
        if (/\b(pump|dump|scam|rug|fake)\b/.test(q)) {
            return 'Crypto scams to watch out for:\n\n🔴 <b>Red Flags:</b>\n• Anonymous teams\n• Unrealistic guaranteed returns\n• No working product\n• Low liquidity\n• Pressure to buy quickly\n• Copycat names of real projects\n\n✅ <b>Stay Safe:</b>\n• Always use our <a href="https://coinadvice.site/pages/token-checker.html" style="color:#818cf8">Token Checker</a>\n• Research the team and project\n• Check if the code is audited\n• Never share your private keys';
        }
        if (/\b(regulation|sec|legal|law|crypto.*ban|government|tax)\b/.test(q)) {
            return 'Crypto regulation varies by country and is constantly evolving.\n\n<b>Key Points:</b>\n• US: SEC classifies some coins as securities\n• EU: MiCA regulation provides clear framework\n• Asia: Mixed approaches — Singapore supportive, China banned\n• Tax: Crypto is taxable in most countries\n\n<b>💡 Tip:</b> Consult a tax professional for your jurisdiction. Keep records of all transactions using a portfolio tracker.';
        }
        if (/\b(bitcoin halving|halving|supply.*cut|block reward)\b/.test(q)) {
            return 'The Bitcoin halving cuts the block reward for miners by 50%, reducing the rate of new BTC supply.\n\n<b>Why It Matters:</b>\n• Reduces selling pressure from miners\n• Historically precedes major bull runs\n• Next halving expected April 2024\n• Makes Bitcoin increasingly scarce\n\n<b>Historical Pattern:</b>\n• 2012 halving: BTC ~$12 → 2013 peak ~$1,100\n• 2016 halving: BTC ~$650 → 2017 peak ~$19,600\n• 2020 halving: BTC ~$8,600 → 2021 peak ~$69,000';
        }

        const match = await this.websiteSearch(q);
        if (match) {
            if (match.type === 'tool') {
                return `<b>🛠️ ${match.title}</b>\n\n${match.desc}\n\n<a href="${match.url}" style="color:#818cf8">Open tool →</a>`;
            }
            if (match.type === 'blog') {
                const content = await this.fetchBlogContent(match.url);
                if (content) {
                    return `<b>📖 ${content.title}</b>\n\n${content.snippet}\n\n<a href="${match.url}" style="color:#818cf8">Read full article →</a>`;
                }
            }
        }

        return `<b>I can help you with:</b>

<b>📊 Coin Analysis</b>
"Analyze Solana", "Explain Bitcoin", "What is Cardano?"

<b>🌍 Market Overview</b>
"Market summary", "What's happening in crypto today?"

<b>🔥 Trending & Movers</b>
"Trending coins", "Top gainers", "Top losers"

<b>⚖️ Compare Coins</b>
"Compare Bitcoin and Ethereum"

<b>💡 Trading Ideas</b>
"Trade idea for Solana", "Bitcoin support and resistance"

<b>📚 Learn Crypto</b>
"What is DeFi?", "How does staking work?", "What is a wallet?"

<b>💎 Altcoin Discovery</b>
"Best altcoins today", "Altcoins with potential"

Try typing one of these or use the quick buttons below!`;
    },
};
