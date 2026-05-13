const CryptoAssistant = {
    session: { history: [], context: {} },
    _sending: false,
    _sendThrottle: 0,
    _typingTimeout: null,
    MAX_HISTORY: 50,
    MAX_INPUT: 500,
    SESSION_KEY: 'ca_session',

    init() {
        this.restoreSession();
        this.buildWidget();
        this.bindEvents();
        window.addEventListener('online', () => this._updateStatus('Online'));
        window.addEventListener('offline', () => this._updateStatus('Offline'));
        this.showGreeting();
    },

    escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    },

    _updateStatus(s) {
        const el = document.getElementById('ca-status');
        if (el) el.textContent = s;
    },

    saveSession() {
        try {
            const save = {
                history: this.session.history.slice(-this.MAX_HISTORY),
                context: this.session.context
            };
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(save));
        } catch {}
    },

    restoreSession() {
        try {
            const raw = localStorage.getItem(this.SESSION_KEY);
            if (raw) {
                const s = JSON.parse(raw);
                this.session.history = s.history || [];
                this.session.context = s.context || {};
            }
        } catch {}
    },

    clearSession() {
        this.session = { history: [], context: {} };
        try { localStorage.removeItem(this.SESSION_KEY); } catch {}
        document.getElementById('ca-messages').innerHTML = '';
        document.getElementById('ca-suggestions').innerHTML = '';
        this.showGreeting();
    },

    buildWidget() {
        const w = document.createElement('div');
        w.id = 'crypto-assistant';
        w.innerHTML = `
            <div id="ca-toggle" role="button" aria-label="Open Coin Analyst" tabindex="0">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div id="ca-panel" role="dialog" aria-label="Coin Analyst chat">
                <div id="ca-header">
                    <div id="ca-header-info">
                        <div id="ca-avatar">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        </div>
                        <div>
                            <div id="ca-title">Coin Analyst</div>
                            <div id="ca-status">Online</div>
                        </div>
                    </div>
                    <div id="ca-header-actions">
                        <button id="ca-clear" aria-label="Clear conversation" title="Clear chat">🗑️</button>
                        <button id="ca-close" aria-label="Close chat">✕</button>
                    </div>
                </div>
                <div id="ca-messages" role="log" aria-live="polite"></div>
                <div id="ca-suggestions"></div>
                <div id="ca-input-area">
                    <input type="text" id="ca-input" placeholder="Ask about any crypto..." maxlength="${this.MAX_INPUT}" autocomplete="off" aria-label="Chat message">
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
        document.getElementById('ca-toggle').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(true); } };
        document.getElementById('ca-close').onclick = () => this.toggle(false);
        document.getElementById('ca-clear').onclick = () => { if (this.session.history.length > 0 && confirm('Clear conversation?')) this.clearSession(); };
        const input = document.getElementById('ca-input');
        document.getElementById('ca-send').onclick = () => this.send();
        input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); } };
    },

    toggle(open) {
        document.getElementById('crypto-assistant').classList.toggle('open', open);
        if (open) {
            setTimeout(() => document.getElementById('ca-input').focus(), 100);
            this._restoreMessages();
        }
    },

    _restoreMessages() {
        const container = document.getElementById('ca-messages');
        if (container.children.length > 0 || this.session.history.length === 0) return;
        container.innerHTML = '';
        this.session.history.forEach(msg => {
            if (msg.role === 'assistant') {
                this.addMessage('assistant', msg.text, false);
            }
        });
        if (this.session.history.length === 0) {
            this.showGreeting();
        } else {
            this.renderQuickCommands();
        }
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
        if (this.isL2Query(q)) return this.getL2Explanation();
        if (this.isDexQuery(q)) return this.getDexExplanation();
        if (this.isMemeCoinQuery(q)) return this.getMemeCoinExplanation();
        if (this.isOracleQuery(q)) return this.getOracleExplanation();
        if (this.isBridgeQuery(q)) return this.getBridgeExplanation();
        if (this.isForkQuery(q)) return this.getForkExplanation();
        if (this.isDaoQuery(q)) return this.getDaoExplanation();
        if (this.isTokenomicsQuery(q)) return this.getTokenomicsExplanation();
        if (this.isWeb3Query(q)) return this.getWeb3Explanation();
        if (this.isStablecoinQuery(q)) return this.getStablecoinExplanation();
        if (this.isAmmQuery(q)) return this.getAmmExplanation();
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
    isHowToQuery(q) { return /\b(how to|how do i|guide|tutorial|steps|way to|learn|what is|what are|what does|what do)\b/.test(q); },
    isPriceQuery(q) { return /\b(price|worth|cost|rate|value|how much)\b/.test(q); },
    isAnalysisQuery(q) { return /\b(analyze|analysis|explain|about|tell me|outlook|forecast|predict|bullish|bearish)\b/.test(q); },
    isDefiQuery(q) { return /\b(defi|decentralized finance|liquidity pool|yield farming|aave|compound|uni|swap)\b/.test(q); },
    isBtcQuery(q) { return /\b(bitcoin|btc)\b/.test(q) && !this.extractCoin(q); },
    isEthQuery(q) { return /\b(ethereum|eth)\b/.test(q) && !this.extractCoin(q); },
    isWalletQuery(q) { return /\b(wallet|cold storage|hardware wallet|self.?custody|ledger|trezor)\b/.test(q); },
    isStakingQuery(q) { return /\b(staking|stake|apy|earn.*crypto|passive income|rewards)\b/.test(q); },
    isL2Query(q) { return /\b(layer.?2|layer two|l2|rollup|scaling solution|arbitrum|optimism|polygon.*zk|zksync|base.*coinbase|superchain)\b/.test(q); },
    isDexQuery(q) { return /\b(dex|decentralized exchange|automated market maker|amm|swap.*protocol|order book|slippage|spot.*trade|perpetual.*dex)\b/.test(q); },
    isMemeCoinQuery(q) { return /\b(meme.?coin|memecoin|shitcoin|meme.*token|what.*meme|explain.*meme|about.*meme)\b/.test(q); },
    isOracleQuery(q) { return /\b(oracle|price feed|real.world data|chainlink|pyth)\b/.test(q); },
    isBridgeQuery(q) { return /\b(bridge|cross.?chain|wrapped|lock.*mint|wormhole|layerzero|axelar)\b/.test(q); },
    isForkQuery(q) { return /\b(fork|hard fork|soft fork|chain split|divergence)\b/.test(q); },
    isDaoQuery(q) { return /\b(dao|decentralized autonomous|governance token|vote.*proposal|treasury)\b/.test(q); },
    isTokenomicsQuery(q) { return /\b(tokenomics|token.?economics|supply|inflation|vesting|max supply|circulating supply)\b/.test(q); },
    isWeb3Query(q) { return /\b(web3|web 3|decentralized.*web|dapp|dapp)\b/.test(q); },
    isStablecoinQuery(q) { return /\b(stablecoin|stable.?coin|usdc|usdt|dai|peg|pegged|fiat.*collateral)\b/.test(q); },
    isAmmQuery(q) { return /\b(amm|automated market maker|liquidity pool|lp token|impermanent loss|constant product)\b/.test(q); },

    getGreetingResponse() {
        return 'Hello! I\'m your crypto analyst at <b>CoinAdvice</b>.\n\nI can help you with:\n• <b>Coin analysis</b> — "Analyze Solana" or "Explain Bitcoin"\n• <b>Market overview</b> — "What\'s happening in crypto today?"\n• <b>Trending & gainers</b> — "Top gainers" or "Trending coins"\n• <b>Trading ideas</b> — "Trade idea for Ethereum"\n• <b>Compare coins</b> — "Compare Bitcoin and Solana"\n• <b>Learn crypto</b> — "What is DeFi?", "Explain L2", "How do oracles work?"\n• <b>Topics</b> — Layer 2, DEXs, Meme coins, Staking, Wallets, Bridges, DAOs, Tokenomics, AMMs, Forks, Web3, Stablecoins, NFTs, Gas fees, DCA, Halving, and more!\n\nTry the quick buttons below or ask your own question!';
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
            'base': 'base',
            'mantle': 'mantle', 'mnt': 'mantle',
            'starknet': 'starknet', 'strk': 'starknet',
            'zksync': 'zksync',
            'core': 'coredaoorg',
            'notcoin': 'notcoin', 'not': 'notcoin',
            'dog not': 'dog-not',
            'popcat': 'popcat',
            'mog': 'mog-coin',
            'cat in a dogs world': 'mew',
            'book of meme': 'bome',
            'ordi': 'ordi',
            'sats': 'sats',
            'runes': 'runes',
            'bitcoin sv': 'bitcoin-cash-sv', 'bsv': 'bitcoin-cash-sv',
            'lido': 'lido-dao', 'ldo': 'lido-dao',
            'rocket pool': 'rocket-pool', 'rpl': 'rocket-pool',
            'frax': 'frax',
            'curve': 'curve-dao-token', 'crv': 'curve-dao-token',
            'sushiswap': 'sushi', 'sushi': 'sushi',
            '1inch': '1inch', 'one inch': '1inch',
            'balancer': 'balancer', 'bal': 'balancer',
            'synthetix': 'synthetix', 'snx': 'synthetix',
            'gmx': 'gmx',
            'loopring': 'loopring', 'lrc': 'loopring',
            'terra': 'terra-luna-2', 'luna': 'terra-luna-2',
            'thorchain': 'thorchain', 'rune': 'thorchain',
            'quant': 'quant-network', 'qnt': 'quant-network',
            'internet computer': 'internet-computer', 'icp': 'internet-computer',
            'stacks': 'stacks', 'stx': 'stacks',
            'multiversx': 'elrond-erd-2', 'egld': 'elrond-erd-2',
            'apecoin': 'apecoin', 'ape': 'apecoin',
            'gala': 'gala',
            'immutable': 'immutable', 'imx': 'immutable',
            'beam': 'beam-2',
            'manta': 'manta-network', 'mania': 'manta-network',
            'dymension': 'dymension', 'dym': 'dymension',
            'pixel': 'pixel-2',
            'sei': 'sei-network',
            'ondo': 'ondo-finance',
            'jito': 'jito-governance-token',
            'marginfi': 'marginfi',
            'drift': 'drift-protocol',
            'tensor': 'tensor-2',
            'blur': 'blur',
            'looksrare': 'looksrare', 'looks': 'looksrare',
            'xai': 'xai-2',
            'rbn': 'ribbon-finance',
            'pancakeswap': 'pancakeswap', 'cake': 'pancakeswap',
            'velo': 'velodrome-finance',
            'aerodrome': 'aerodrome-finance',
            'comp': 'compound-governance-token',
            'aero': 'aerodrome-finance',
            'ondo': 'ondo-finance',
            'pendle': 'pendle',
            'ether.fi': 'ether-fi', 'ethfi': 'ether-fi',
            'altlayer': 'altlayer', 'alt': 'altlayer',
            'strk': 'strk',
            'saga': 'saga-2',
            'port3': 'port3-network',
            'aevox': 'aevox',
            'polygon': 'matic-network', 'matic': 'matic-network',
            'avalanche': 'avalanche-2', 'avax': 'avalanche-2',
            'binance coin': 'binancecoin', 'bnb': 'binancecoin',
            'toncoin': 'the-open-network', 'ton': 'the-open-network',
            'cronos': 'crypto-com-chain', 'cro': 'crypto-com-chain',
            'elrond': 'elrond-erd-2', 'egld': 'elrond-erd-2',
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
            const items = d.coins.slice(0, 7).map(c => c.item);
            const ids = items.map(c => c.id).filter(Boolean);
            let priceData = [];
            if (ids.length > 0) {
                try {
                    priceData = await this.fetchWithCache(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=false&price_change_percentage=24h`, 60000);
                } catch {}
            }
            let list = '';
            items.forEach((item, i) => {
                const p = priceData.find(x => x.id === item.id);
                const price = p?.current_price;
                const ch24 = p?.price_change_percentage_24h;
                const vol = p?.total_volume;
                const mcap = p?.market_cap;
                list += `${i+1}. <b>${item.name}</b> <code>${item.symbol.toUpperCase()}</code>\n`;
                if (price) list += `   💰 ${this.formatPrice(price)}`;
                if (ch24 !== undefined) list += ` ${ch24 >= 0 ? '📈' : '📉'} ${ch24 >= 0 ? '+' : ''}${ch24.toFixed(1)}%`;
                list += `\n   📊 Vol: ${this.formatLargeNumber(vol || 0)} • MCap: ${this.formatLargeNumber(mcap || 0)}\n\n`;
            });
            return `<b>🔥 Top Trending Cryptocurrencies Today</b>\n\nBased on most searched coins in the last few hours:\n\n${list}<i>Data from CoinGecko • Updated every 60 seconds</i>`;
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

            const coinInfo = this._getCoinKnowledge(coinId) || {};
            const description = coinInfo.desc || `${name} is a cryptocurrency project in the blockchain space.`;
            const coinCategory = coinInfo.cat || 'General';

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
<b>📂 Category:</b> ${coinCategory}

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
        const coin = await this.extractCoin(q) || 'bitcoin';
        try {
            const d = await this.fetchWithCache(`https://api.coingecko.com/api/v3/coins/${coin}?localization=false&tickers=false&community_data=false&developer_data=false`, 120000);
            const md = d.market_data || {};
            const name = d.name, sym = d.symbol?.toUpperCase();
            const price = md.current_price?.usd || 0;
            const high24 = md.high_24h?.usd || price * 1.02;
            const low24 = md.low_24h?.usd || price * 0.98;
            const pc24 = md.price_change_percentage_24h || 0;
            const pc7 = md.price_change_percentage_7d || 0;
            const pc30 = md.price_change_percentage_30d || 0;
            const vol = md.total_volume?.usd || 0;
            const mcap = md.market_cap?.usd || 0;
            const ath = md.ath?.usd || price;
            const atl = md.atl?.usd || 0;

            const vol24Range = ((high24 - low24) / price) * 100;
            const volToMcRatio = mcap > 0 ? vol / mcap : 0;
            const isVolatile = vol24Range > 8;
            const isLiquid = volToMcRatio > 0.1;

            const nearestRound = price >= 100 ? 10 ** Math.floor(Math.log10(price) - 1) : price >= 1 ? 0.1 : price >= 0.01 ? 0.001 : price >= 0.0001 ? 0.00001 : 0.000001;
            const roundToNearest = (n) => Math.round(n / nearestRound) * nearestRound;

            const atr = (high24 - low24) * 0.75;
            const atrPct = (atr / price) * 100;
            const atrStep = atrPct > 10 ? 'wide' : atrPct > 4 ? 'moderate' : 'tight';

            const isLongIdea = /\b(long|buy|bull|break.*above|long.*entry)\b/.test(q);
            const isShortIdea = /\b(short|sell|bear|break.*below|short.*entry)\b/.test(q);
            const bias = isLongIdea ? 'long' : isShortIdea ? 'short' : pc24 > 0 && pc7 > 0 ? 'long' : pc24 < 0 && pc7 < 0 ? 'short' : 'neutral';

            const entryLong = roundToNearest(price);
            const entryShort = roundToNearest(price);

            const slBuffer = atr * (isVolatile ? 2.0 : 1.5);
            const tpBuffer = slBuffer * 2.0;

            let longSL, longTP1, longTP2, longTP3;
            let shortSL, shortTP1, shortTP2, shortTP3;

            if (bias !== 'short') {
                longSL = roundToNearest(price - slBuffer);
                longTP1 = roundToNearest(price + tpBuffer);
                longTP2 = roundToNearest(price + tpBuffer * 1.8);
                longTP3 = roundToNearest(price + tpBuffer * 3.0);
            }
            if (bias !== 'long') {
                shortSL = roundToNearest(price + slBuffer);
                shortTP1 = roundToNearest(price - tpBuffer);
                shortTP2 = roundToNearest(price - tpBuffer * 1.8);
                shortTP3 = roundToNearest(price - tpBuffer * 3.0);
            }

            const longRR1 = longSL ? ((longTP1 - entryLong) / (entryLong - longSL)).toFixed(2) : '—';
            const longRR2 = longSL ? ((longTP2 - entryLong) / (entryLong - longSL)).toFixed(2) : '—';
            const shortRR1 = shortSL ? ((entryShort - shortTP1) / (shortSL - entryShort)).toFixed(2) : '—';
            const shortRR2 = shortSL ? ((entryShort - shortTP2) / (shortSL - entryShort)).toFixed(2) : '—';

            const trend = pc7 > 10 ? 'Strong Uptrend 📈' : pc7 > 3 ? 'Uptrend 📈' : pc7 > -3 ? 'Sideways/Consolidating ↔️' : pc7 > -10 ? 'Downtrend 📉' : 'Strong Downtrend 📉';
            const momentum24 = pc24 > 5 ? 'Strong Bullish' : pc24 > 2 ? 'Bullish' : pc24 > -2 ? 'Neutral' : pc24 > -5 ? 'Bearish' : 'Strong Bearish';
            const volDesc = isVolatile ? 'High' : vol24Range > 4 ? 'Moderate' : 'Low';
            const liqDesc = isLiquid ? 'Good' : 'Low';

            const positionSizing = isVolatile
                ? 'Reduce position size (0.5-1% of portfolio) due to high volatility'
                : 'Standard position size (1-2% of portfolio) is reasonable';

            const riskLevel = isVolatile && atrStep === 'wide' ? '⚠️ High Risk' : atrStep === 'moderate' ? '📊 Moderate Risk' : '✅ Lower Risk';

            let scenarioBull = '';
            let scenarioBear = '';

            if (bias !== 'short') {
                scenarioBull = `<b>🟢 Long Setup</b>
<b>Entry Zone:</b> ${this.formatPrice(entryLong)}
<b>Stop Loss:</b> ${this.formatPrice(longSL)} (${((entryLong - longSL) / entryLong * 100).toFixed(1)}% below entry)
<b>Take Profit Targets:</b>
  🎯 TP1: ${this.formatPrice(longTP1)} (R:R ${longRR1}) — <i>Book 40%</i>
  🎯 TP2: ${this.formatPrice(longTP2)} (R:R ${longRR2}) — <i>Book 35%</i>
  🎯 TP3: ${this.formatPrice(longTP3)} (R:R ${((longTP3 - entryLong) / (entryLong - longSL)).toFixed(2)}) — <i>Let 25% run</i>

<b>📈 Bullish Thesis:</b>
• ${pc24 > 0 ? `24h momentum is positive at +${pc24.toFixed(1)}%` : 'Price shows resilience holding above recent lows'}
• ${pc7 > 0 ? `Weekly trend is bullish (+${pc7.toFixed(1)}%)` : 'Weekly trend is recovering'}
• ${volToMcRatio > 0.15 ? 'Strong volume relative to market cap suggests genuine interest' : 'Volume is adequate for smooth execution'}
• A break above $${this.formatPrice(high24)} (24h high) confirms the move

<b>📉 Invalidation:</b> Daily close below ${this.formatPrice(longSL)} invalidates the setup.`;
            }

            if (bias !== 'long') {
                scenarioBear = `<b>🔴 Short Setup</b>
<b>Entry Zone:</b> ${this.formatPrice(entryShort)}
<b>Stop Loss:</b> ${this.formatPrice(shortSL)} (${((shortSL - entryShort) / entryShort * 100).toFixed(1)}% above entry)
<b>Take Profit Targets:</b>
  🎯 TP1: ${this.formatPrice(shortTP1)} (R:R ${shortRR1}) — <i>Book 40%</i>
  🎯 TP2: ${this.formatPrice(shortTP2)} (R:R ${shortRR2}) — <i>Book 35%</i>
  🎯 TP3: ${this.formatPrice(shortTP3)} (R:R ${((entryShort - shortTP3) / (shortSL - entryShort)).toFixed(2)}) — <i>Let 25% run</i>

<b>📉 Bearish Thesis:</b>
• ${pc24 < 0 ? `24h selling pressure at ${pc24.toFixed(1)}%` : 'Price faces overhead resistance at recent highs'}
• ${pc7 < 0 ? `Weekly trend is negative (${pc7.toFixed(1)}%)` : 'Weekly trend shows signs of exhaustion'}
• ${volToMcRatio < 0.1 ? 'Below-average volume suggests lack of buyer conviction' : 'Volume dynamics warrant caution'}
• A breakdown below $${this.formatPrice(low24)} (24h low) confirms the move

<b>📈 Invalidation:</b> Daily close above ${this.formatPrice(shortSL)} invalidates the setup.`;
            }

            const conviction = bias === 'long' ? (pc24 > 3 && pc7 > 5 && isLiquid ? 'High' : 'Moderate') : bias === 'short' ? (pc24 < -3 && pc7 < -5 && isLiquid ? 'High' : 'Moderate') : 'Low';

            return `<b>📊 Professional Trade Setup: ${name} (${sym})</b>

<b>💰 Current Price:</b> ${this.formatPrice(price)}
<b>🎯 Bias:</b> ${bias === 'long' ? '🟢 Bullish' : bias === 'short' ? '🔴 Bearish' : '🟡 Neutral'}
<b>⚡ Conviction:</b> ${conviction}

<b>📋 Market Context</b>
• <b>Trend (7d):</b> ${trend}
• <b>Momentum (24h):</b> ${momentum24} (${pc24 >= 0 ? '+' : ''}${pc24.toFixed(1)}%)
• <b>Weekly Change:</b> ${pc7 >= 0 ? '+' : ''}${pc7.toFixed(1)}% • <b>30d Change:</b> ${pc30 >= 0 ? '+' : ''}${pc30.toFixed(1)}%
• <b>24h Range:</b> ${this.formatPrice(low24)} — ${this.formatPrice(high24)} (Range: ${vol24Range.toFixed(1)}%)
• <b>ATR%:</b> ${atrPct.toFixed(1)}% (${atrStep} spreads)
• <b>Volatility:</b> ${volDesc} • <b>Liquidity:</b> ${liqDesc}
• <b>Vol/MCap:</b> ${(volToMcRatio * 100).toFixed(1)}%
• <b>Risk Level:</b> ${riskLevel}

${scenarioBull}
${scenarioBear}

<b>📐 Position Management</b>
• <b>${positionSizing}</b>
• Scale into position (enter 50% at entry, 25% on confirmation, 25% on pullback)
• Move SL to breakeven when TP1 is hit
• Trail remaining position using 1.5× ATR below/above price

<b>🔄 Alternative Scenarios</b>
• <b>If neutral:</b> Wait for a confirmed breakout above $${this.formatPrice(high24)} (long) or breakdown below $${this.formatPrice(low24)} (short) before entering
• <b>If volatility spikes:</b> Widen stops to 3× ATR or reduce position size by 50%
• <b>If volume diverges:</b> A breakout on declining volume is a trap — await confirmation

<b>📊 Key Levels</b>
• <b>Resistance:</b> ${this.formatPrice(high24)} (24h H) → ${this.formatPrice(roundToNearest(high24 * 1.05))} → ${this.formatPrice(ath)} (ATH)
• <b>Support:</b> ${this.formatPrice(low24)} (24h L) → ${this.formatPrice(roundToNearest(low24 * 0.95))} → ${this.formatPrice(atl)} (ATL)

<b>⏱ Suggested Timeframe:</b> ${isVolatile ? '4-24 hours (scalp/day trade)' : '1-5 days (swing trade)'}

⚠️ <b>Disclaimer:</b> This is an educational analysis, not financial advice. Cryptocurrency trading carries substantial risk of loss. Never risk more than you can afford to lose. Past performance does not guarantee future results.

🔗 <a href="https://coinadvice.site/pages/coin-analysis.html?coin=${coin}" style="color:#818cf8">Full analysis on CoinAdvice →</a>`;
        } catch {
            return `Unable to generate trade idea for that coin. Please try a different coin or try again later.`;
        }
    },

    _coinKnowledge: {
        'bitcoin': {
            desc: 'Bitcoin is the original cryptocurrency, created in 2009 by Satoshi Nakamoto. It operates on a decentralized peer-to-peer network using Proof of Work consensus. Bitcoin is the largest cryptocurrency by market cap and is often called "digital gold" as a store of value.',
            cat: 'Store of Value / L1'
        },
        'ethereum': {
            desc: 'Ethereum is a decentralized computing platform that enables smart contracts and decentralized applications (dApps). It transitioned from Proof of Work to Proof of Stake in September 2022 (The Merge), reducing energy consumption by ~99.95%. Ethereum powers most of the DeFi and NFT ecosystem.',
            cat: 'Smart Contract Platform / L1'
        },
        'solana': {
            desc: 'Solana is a high-performance blockchain designed for decentralized applications and crypto-currencies. It uses a unique Proof of History (PoH) mechanism combined with Proof of Stake, enabling fast transaction speeds (up to 65,000 TPS) with low fees (~$0.01). It competes with Ethereum as a smart contract platform.',
            cat: 'Smart Contract Platform / L1'
        },
        'binancecoin': {
            desc: 'Binance Coin (BNB) is the native cryptocurrency of the Binance ecosystem, including the Binance exchange and BNB Chain (formerly Binance Smart Chain). It is used for trading fee discounts, transaction fees on BNB Chain, and participation in token sales on Binance Launchpad.',
            cat: 'Exchange Token / L1'
        },
        'ripple': {
            desc: 'Ripple (XRP) is a digital payment protocol designed for fast, low-cost international money transfers. Unlike most cryptocurrencies, Ripple does not use mining and is managed by the Ripple company. It focuses on partnerships with financial institutions for cross-border settlement.',
            cat: 'Payment / Settlement'
        },
        'cardano': {
            desc: 'Cardano is a Proof of Stake blockchain platform founded by Charles Hoskinson (co-founder of Ethereum). It uses a research-driven approach with peer-reviewed academic papers. Cardano features a two-layer architecture separating settlement and computation, and uses the Ouroboros consensus mechanism.',
            cat: 'Smart Contract Platform / L1'
        },
        'dogecoin': {
            desc: 'Dogecoin is a cryptocurrency created in 2013 as a joke based on the Doge meme. It features unlimited supply and fast transaction times. Despite its origins, Dogecoin has gained significant popularity and market cap, driven largely by community support and endorsements from figures like Elon Musk.',
            cat: 'Meme Coin'
        },
        'polkadot': {
            desc: 'Polkadot is a multi-chain blockchain platform created by Gavin Wood (co-founder of Ethereum). It enables different blockchains to transfer messages and value in a trust-free fashion via its relay chain and parachain architecture. DOT is used for governance, staking, and bonding.',
            cat: 'Interoperability / L0'
        },
        'avalanche-2': {
            desc: 'Avalanche is a platform for decentralized applications and custom blockchain networks. It claims extremely fast transaction finality (under 2 seconds) using its novel Avalanche consensus protocol. It supports the Ethereum Virtual Machine (EVM) for compatibility with Ethereum dApps and features subnets for custom chains.',
            cat: 'Smart Contract Platform / L1'
        },
        'chainlink': {
            desc: 'Chainlink is a decentralized oracle network that connects smart contracts with real-world data, events, and payments. It allows blockchains to securely interact with external data feeds, APIs, and traditional payment systems. LINK tokens pay node operators for retrieving data.',
            cat: 'Oracle / Infrastructure'
        },
        'matic-network': {
            desc: 'Polygon (formerly Matic Network) is a Layer 2 scaling solution for Ethereum. It provides faster and cheaper transactions while maintaining security via the Ethereum main chain. Polygon uses a sidechain architecture and supports Ethereum-compatible dApps with significantly lower gas fees.',
            cat: 'Layer 2 / Scaling'
        },
        'litecoin': {
            desc: 'Litecoin is a peer-to-peer cryptocurrency created by Charlie Lee in 2011 as a "lighter" version of Bitcoin. It offers faster block generation times (2.5 minutes vs Bitcoin\'s 10) and uses the Scrypt mining algorithm. Often called the "silver to Bitcoin\'s gold".',
            cat: 'Payment / Store of Value'
        },
        'uniswap': {
            desc: 'Uniswap is a decentralized exchange (DEX) protocol built on Ethereum that uses an Automated Market Maker (AMM) model. It allows users to swap ERC-20 tokens without a central order book. UNI is the governance token enabling holders to vote on protocol changes.',
            cat: 'DEX / DeFi'
        },
        'tron': {
            desc: 'Tron is a blockchain platform focused on content sharing and entertainment. It aims to build a decentralized internet where content creators have full ownership rights. Tron supports high throughput (up to 2,000 TPS) and features low transaction fees.',
            cat: 'Smart Contract Platform / L1'
        },
        'sui': {
            desc: 'Sui is a Layer 1 blockchain developed by Mysten Labs (founded by former Meta engineers). It uses a novel object-centric data model and the Move programming language for parallel transaction execution, enabling high throughput and low latency.',
            cat: 'Smart Contract Platform / L1'
        },
        'aptos': {
            desc: 'Aptos is a Layer 1 blockchain built by former Meta employees who worked on the Diem project. It uses the Move programming language for security and flexibility, with a parallel execution engine for high throughput. Focuses on safety, performance, and user experience.',
            cat: 'Smart Contract Platform / L1'
        },
        'near': {
            desc: 'NEAR Protocol is a Layer 1 blockchain designed for usability and scalability. It uses sharding (Nightshade) to scale throughput and features human-readable account names instead of cryptographic addresses. It has low transaction fees and fast finality.',
            cat: 'Smart Contract Platform / L1'
        },
        'optimism': {
            desc: 'Optimism is a Layer 2 scaling solution for Ethereum using Optimistic Rollup technology. It bundles transactions off-chain and submits them to Ethereum as calldata, reducing fees by ~10x. OP tokens are used for governance of the protocol.',
            cat: 'Layer 2 / Scaling'
        },
        'arbitrum': {
            desc: 'Arbitrum is a Layer 2 scaling solution for Ethereum using Optimistic Rollup technology. Developed by Offchain Labs, it offers EVM-equivalent compatibility, meaning Ethereum dApps can run with minimal changes. It significantly reduces gas costs while inheriting Ethereum\'s security.',
            cat: 'Layer 2 / Scaling'
        },
        'injective-protocol': {
            desc: 'Injective Protocol is a decentralized exchange protocol built on Cosmos that enables cross-chain derivatives trading. It provides a fully decentralized order book and supports spot, futures, and options trading across multiple blockchains.',
            cat: 'DeFi / DEX'
        },
        'render-token': {
            desc: 'Render Network is a distributed GPU rendering platform built on Solana. It connects artists who need rendering power with GPU owners who have idle capacity. RNDR tokens power the network and compensate node operators.',
            cat: 'AI / GPU / Infrastructure'
        },
        'fetch-ai': {
            desc: 'Fetch.ai is a decentralized machine learning platform that enables autonomous AI agents to perform tasks like data sharing, trading, and logistics optimization. Built on Cosmos, it aims to create an open network for AI-powered automation.',
            cat: 'AI / Infrastructure'
        },
        'worldcoin-wld': {
            desc: 'Worldcoin is a project founded by Sam Altman (OpenAI) that aims to create a global identity and financial network. It uses iris scanning (Orb) to verify human uniqueness and distributes WLD tokens to verified users. The goal is universal basic income infrastructure.',
            cat: 'Identity / Infrastructure'
        },
        'pepe': {
            desc: 'Pepe is a meme coin based on the Pepe the Frog internet meme. Launched on Ethereum, it gained massive popularity in 2023. Like most meme coins, it has no intrinsic utility and its value is driven entirely by community interest and social media hype.',
            cat: 'Meme Coin'
        },
        'shiba-inu': {
            desc: 'Shiba Inu (SHIB) is a meme coin and ecosystem token on Ethereum, billed as the "Dogecoin killer." It features a large supply and has expanded beyond memes to include ShibaSwap (DEX), Shibarium (L2), and NFT projects like Shiboshis.',
            cat: 'Meme Coin / Ecosystem'
        },
        'stellar': {
            desc: 'Stellar is a decentralized payment protocol connecting banks, payment systems, and individuals for fast, low-cost cross-border transactions. XLM (Lumens) serves as the native asset and is used to pay transaction fees and maintain account minimums.',
            cat: 'Payment / Settlement'
        },
        'cosmos': {
            desc: 'Cosmos is an interoperable blockchain ecosystem designed to enable communication between different blockchains via the Inter-Blockchain Communication (IBC) protocol. ATOM is the staking and governance token of the Cosmos Hub.',
            cat: 'Interoperability / L0'
        },
        'filecoin': {
            desc: 'Filecoin is a decentralized storage network that turns cloud storage into an algorithmic market. Users pay FIL tokens to store files, and miners earn FIL by providing storage space. It uses Proof of Replication and Proof of Spacetime consensus.',
            cat: 'Storage / Infrastructure'
        },
        'the-open-network': {
            desc: 'TON (The Open Network) was originally developed by Telegram and is now maintained by the TON Foundation. It is a fast, scalable Layer 1 blockchain designed for mass adoption with features like native stablecoins, payment channels, and decentralized DNS.',
            cat: 'Smart Contract Platform / L1'
        },
        'theta-token': {
            desc: 'Theta Network is a decentralized video streaming and delivery platform. Users earn TFUEL tokens by sharing bandwidth and watching content. THETA is the governance token used for staking and protocol governance.',
            cat: 'Media / Entertainment'
        },
        'vechain': {
            desc: 'VeChain is a blockchain platform focused on supply chain management and enterprise solutions. It uses a two-token system (VET, VTHO) to separate value transfer from transaction costs. VET holders generate VTHO as a dividend.',
            cat: 'Enterprise / Supply Chain'
        },
        'monero': {
            desc: 'Monero is a privacy-focused cryptocurrency that uses ring signatures, stealth addresses, and confidential transactions to obfuscate sender, receiver, and amount. It is the leading privacy coin and is fungible by design.',
            cat: 'Privacy / Currency'
        },
        'ethereum-classic': {
            desc: 'Ethereum Classic is the original Ethereum blockchain that retained the Proof of Work consensus after the 2016 DAO hack fork. It maintains the principle of "code is law" and continues to support smart contracts, dApps, and immutability.',
            cat: 'Smart Contract Platform / L1'
        },
        'lido-dao': {
            desc: 'Lido is a liquid staking protocol that allows users to stake their tokens (ETH, SOL, MATIC) and receive tradable staked representations (stETH, stSOL, etc.). This lets users earn staking rewards while maintaining liquidity for DeFi participation.',
            cat: 'DeFi / Liquid Staking'
        },
        'aave': {
            desc: 'Aave is a decentralized lending and borrowing protocol on Ethereum. Users can deposit assets to earn interest or borrow against their deposits. Aave pioneered features like flash loans (uncollateralized instant loans) and variable/stable interest rates.',
            cat: 'DeFi / Lending'
        },
        'maker': {
            desc: 'MakerDAO is a decentralized lending protocol on Ethereum that manages the DAI stablecoin. DAI is a decentralized, collateral-backed stablecoin pegged to the US dollar. MKR is the governance token used to manage the protocol and absorb risk.',
            cat: 'DeFi / Stablecoin'
        },
        'compound-governance-token': {
            desc: 'Compound is a decentralized money market protocol on Ethereum where users can lend and borrow cryptocurrencies. Interest rates adjust algorithmically based on supply and demand. COMP tokens enable community governance of protocol parameters.',
            cat: 'DeFi / Lending'
        },
        'thorchain': {
            desc: 'THORChain is a decentralized cross-chain liquidity protocol that enables native asset swaps across different blockchains without wrapped tokens. RUNE is the native asset used for liquidity, security, and governance.',
            cat: 'DeFi / Cross-Chain DEX'
        },
        'fantom': {
            desc: 'Fantom is a fast, scalable Layer 1 blockchain using a Directed Acyclic Graph (DAG) consensus mechanism called Lachesis. It is EVM-compatible, supporting Ethereum dApps with near-instant finality and low fees.',
            cat: 'Smart Contract Platform / L1'
        },
        'crypto-com-chain': {
            desc: 'Cronos (CRO) is the native token of the Crypto.com ecosystem and Cronos chain, an EVM-compatible Layer 1 built on Cosmos. It powers the Crypto.com exchange, DeFi wallet, and Visa card rewards program.',
            cat: 'Exchange Token / L1'
        },
        'bitcoin-cash': {
            desc: 'Bitcoin Cash (BCH) is a fork of Bitcoin created in 2017 that increased the block size from 1MB to 32MB to enable more transactions per block. It aims to be a peer-to-peer electronic cash system with low fees and fast confirmations.',
            cat: 'Payment / Currency'
        },
        'algorand': {
            desc: 'Algorand is a Proof of Stake blockchain platform founded by Turing Award winner Silvio Micali. It uses a Pure Proof of Stake (PPoS) consensus mechanism with instant finality and no forking. It supports smart contracts and standard assets.',
            cat: 'Smart Contract Platform / L1'
        },
        'hedera-hashgraph': {
            desc: 'Hedera is a public network using the Hashgraph consensus algorithm, offering high throughput (10,000+ TPS), low fees, and fast finality (3-5 seconds). It is governed by a council of major enterprises (Google, IBM, Boeing) and supports smart contracts and tokenization.',
            cat: 'Smart Contract Platform / L1'
        },
        'flow': {
            desc: 'Flow is a blockchain designed specifically for games, NFTs, and decentralized applications. Created by the team behind CryptoKitties, Flow uses a multi-node architecture to scale. It powers popular projects like NBA Top Shot.',
            cat: 'Gaming / NFT / L1'
        },
        'pyth-network': {
            desc: 'Pyth Network is a decentralized oracle that publishes real-time financial market data to multiple blockchains. It sources data from major exchanges and trading firms, providing high-fidelity price feeds for DeFi applications.',
            cat: 'Oracle / Infrastructure'
        },
        'eigenlayer': {
            desc: 'EigenLayer is a restaking protocol built on Ethereum that allows ETH stakers to secure additional networks (AVSes) beyond Ethereum itself. This enables new protocols to bootstrap security using Ethereum\'s validator set.',
            cat: 'DeFi / Restaking'
        },
        'bittensor': {
            desc: 'Bittensor is a decentralized machine learning network that creates a marketplace for AI model training and inference. Miners train models and earn TAO tokens, while consumers pay TAO to access model outputs. It incentivizes open AI development.',
            cat: 'AI / Infrastructure'
        },
        'kaspa': {
            desc: 'Kaspa is a Proof of Work cryptocurrency implementing the GHOSTDAG protocol, which allows multiple blocks to coexist without orphanage. This enables very high block rates (1 block per second) and fast confirmations while maintaining PoW security.',
            cat: 'Payment / L1'
        },
        'sei-network': {
            desc: 'Sei is a Layer 1 blockchain optimized for decentralized exchanges (DEXes). It features built-in order matching, fast transaction finality (600ms), and uses the Cosmos SDK with IBC for interoperability. Sei is designed specifically for trading applications.',
            cat: 'Smart Contract Platform / L1'
        },
        'celestia': {
            desc: 'Celestia is a modular blockchain network that separates consensus from execution. It provides a data availability layer that other blockchains (rollups) can use, enabling easy deployment of sovereign rollups with minimal overhead.',
            cat: 'Infrastructure / Modular'
        },
        'wormhole': {
            desc: 'Wormhole is a cross-chain messaging protocol that enables interoperability between multiple blockchains (Ethereum, Solana, BNB Chain, etc). It allows the transfer of assets and data across chains through its Guardian network.',
            cat: 'Interoperability / Bridge'
        },
        'dydx-chain': {
            desc: 'dYdX is a decentralized exchange for derivatives trading, built on its own application-specific Chain using the Cosmos SDK. It offers perpetual futures trading with up to 20x leverage, using an off-chain order book with on-chain settlement.',
            cat: 'DeFi / Derivatives DEX'
        },
        'ondo-finance': {
            desc: 'Ondo Finance is a DeFi protocol that bridges traditional finance with DeFi by creating tokenized real-world assets (RWAs) and structured products. It offers products like tokenized US Treasuries (OUSG) and DeFi yield strategies.',
            cat: 'DeFi / RWA'
        },
        'elrond-erd-2': {
            desc: 'MultiversX (formerly Elrond) is a highly scalable, secure and decentralized blockchain platform for distributed apps, enterprise use cases and the internet economy. It uses Adaptive State Sharding and Secure Proof of Stake (SPoS) for high throughput.',
            cat: 'Smart Contract Platform / L1'
        },
        'internet-computer': {
            desc: 'Internet Computer (ICP) is a blockchain developed by the DFINITY Foundation that aims to extend the functionality of the internet by hosting software and data directly on the blockchain. It can run smart contracts at web speed with unlimited capacity.',
            cat: 'Smart Contract Platform / L1'
        },
        'stacks': {
            desc: 'Stacks (STX) is a Bitcoin Layer 2 that enables smart contracts and decentralized applications using Bitcoin as a secure base layer. It uses a unique consensus mechanism (Proof of Transfer) that settles transactions on Bitcoin.',
            cat: 'Layer 2 / Smart Contracts'
        },
        'quant-network': {
            desc: 'Quant (QNT) is a blockchain interoperability protocol that connects different blockchain networks through its Overledger technology. It aims to be the operating system for the decentralized web, enabling multi-chain applications.',
            cat: 'Interoperability / Infrastructure'
        },
        'terra-luna-2': {
            desc: 'Terra (LUNA) is a blockchain protocol that uses a combination of fiat-pegged stablecoins and a native token (LUNA) to power a price-stable payment system. After the 2022 collapse, Terra 2.0 relaunched as a new chain.',
            cat: 'Payment / Stablecoin Ecosystem'
        },
        'apecoin': {
            desc: 'ApeCoin (APE) is the governance and utility token of the APE ecosystem, which includes the Bored Ape Yacht Club NFT collection and related projects. It is used for governance, gaming, and ecosystem transactions.',
            cat: 'NFT / Gaming'
        },
        'gmx': {
            desc: 'GMX is a decentralized perpetual exchange (perps DEX) built on Arbitrum and Avalanche. It allows trading with up to 50x leverage using a unique multi-asset pool model that earns fees from swaps and leverage trading.',
            cat: 'DeFi / Derivatives DEX'
        },
        'curve-dao-token': {
            desc: 'Curve Finance is a decentralized exchange (DEX) optimized for stablecoin trading with low slippage and low fees. CRV is the governance token, and veCRV holders earn trading fees and boost rewards from liquidity pools.',
            cat: 'DeFi / DEX'
        },
        'balancer': {
            desc: 'Balancer is an automated market maker (AMM) protocol that allows customizable liquidity pools with up to 8 tokens and variable weights. It enables sophisticated portfolio strategies and price discovery for illiquid assets.',
            cat: 'DeFi / DEX'
        },
        'synthetix': {
            desc: 'Synthetix is a decentralized derivatives liquidity protocol on Ethereum and Optimism that enables the creation of synthetic assets (Synths) tracking real-world assets like currencies, commodities, stocks, and indices.',
            cat: 'DeFi / Derivatives'
        },
        'loopring': {
            desc: 'Loopring is a Layer 2 scaling protocol for Ethereum using ZK-Rollup technology, focused on decentralized exchange (DEX) trading with near-zero gas fees and high throughput.',
            cat: 'Layer 2 / DEX'
        },
        'frax': {
            desc: 'Frax is a fractional-algorithmic stablecoin protocol. FRAX is partially backed by collateral and partially stabilized algorithmically. It also offers Frax ETH (frxETH) for liquid staking on Ethereum.',
            cat: 'DeFi / Stablecoin'
        },
        'rocket-pool': {
            desc: 'Rocket Pool is a decentralized Ethereum liquid staking protocol. Users can stake as little as 0.01 ETH and receive rETH (a liquid staking token) that appreciates in value over time. It is non-custodial and decentralized.',
            cat: 'DeFi / Liquid Staking'
        },
        '1inch': {
            desc: '1inch is a decentralized exchange (DEX) aggregator that sources liquidity from various DEXs to find the most efficient swap routes. It splits orders across multiple protocols to minimize slippage and maximize returns.',
            cat: 'DeFi / DEX Aggregator'
        },
        'pancakeswap': {
            desc: 'PancakeSwap is the leading decentralized exchange on BNB Chain, using an Automated Market Maker (AMM) model. It offers token swaps, yield farming, staking (Syrup Pools), lottery, and NFTs.',
            cat: 'DeFi / DEX'
        },
        'sushi': {
            desc: 'SushiSwap is a decentralized exchange (DEX) and DeFi platform forked from Uniswap with added features like yield farming, staking (SushiBar), lending (Kashi), and a launchpad (Miso).',
            cat: 'DeFi / DEX'
        },
        'blur': {
            desc: 'Blur is an NFT marketplace aggregator that offers fast trading, zero marketplace fees, and advanced portfolio management tools. It uses a bid-based model and rewards active traders with BLUR token incentives.',
            cat: 'NFT / Marketplace'
        },
    },

    _getCoinKnowledge(coinId) {
        const k = this._coinKnowledge[coinId];
        if (k) return k;
        const coinKey = Object.keys(this._coinKnowledge).find(id => coinId.includes(id) || id.includes(coinId));
        return coinKey ? this._coinKnowledge[coinKey] : null;
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

    getL2Explanation() {
        return `<b>What are Layer 2 Solutions?</b>

Layer 2 (L2) solutions are protocols built on top of a Layer 1 blockchain (like Ethereum) to improve scalability, speed, and reduce transaction costs.

<b>Types of Layer 2:</b>
• <b>Optimistic Rollups</b> — Arbitrum, Optimism assume transactions are valid unless challenged
• <b>ZK-Rollups</b> — zkSync, StarkNet use zero-knowledge proofs for instant finality
• <b>Plasma</b> — Creates child chains anchored to the main chain
• <b>Validium</b> — Off-chain data availability with validity proofs

<b>Popular L2s:</b>
• <b>Arbitrum</b> — Largest L2 by TVL, EVM-compatible
• <b>Optimism</b> — EVM-equivalent, OP Stack powers superchain
• <b>Base</b> — Coinbase-backed L2 built on OP Stack
• <b>zkSync Era</b> — ZK-rollup with EVM compatibility
• <b>Polygon zkEVM</b> — ZK-rollup by Polygon team

<b>Benefits:</b>
• Lower fees (often 10-100x cheaper than L1)
• Higher throughput
• Inherits security from the underlying L1`;
    },

    getDexExplanation() {
        return `<b>What is a DEX?</b>

A DEX (Decentralized Exchange) is a peer-to-peer marketplace where users trade cryptocurrencies directly without a central intermediary.

<b>How DEXs Work:</b>
• <b>AMM Model</b> — Uniswap, SushiSwap use automated market makers with liquidity pools
• <b>Order Book</b> — dYdX, Injective use on-chain order books
• <b>Aggregators</b> — 1inch, Matcha scan multiple DEXs for best prices

<b>Popular DEXs:</b>
• <b>Uniswap</b> — Largest DEX on Ethereum
• <b>Raydium</b> — Leading DEX on Solana
• <b>PancakeSwap</b> — Top DEX on BNB Chain
• <b>Jupiter</b> — Solana aggregator

<b>✅ Pros:</b> No KYC, self-custody, permissionless
<b>⚠️ Cons:</b> Slippage, impermanent loss, smart contract risk

Track DEX pairs on our <a href="https://coinadvice.site/pages/dex-scanner.html" style="color:#818cf8">DEX Scanner →</a>`;
    },

    getMemeCoinExplanation() {
        return `<b>What Are Meme Coins?</b>

Meme coins are cryptocurrencies inspired by internet memes, jokes, or viral trends. They typically have no intrinsic utility and rely entirely on community hype, social media buzz, and celebrity endorsements.

<b>Characteristics:</b>
• Highly volatile — can pump 1000% or crash 90%
• Community-driven with no fundamental value
• Often have very large token supplies
• High risk of rug pulls and pump-and-dumps

<b>Notable Meme Coins:</b>
• <b>Dogecoin (DOGE)</b> — The original meme coin
• <b>Shiba Inu (SHIB)</b> — "DOGE killer" with ecosystem
• <b>Pepe (PEPE)</b> — Based on Pepe the Frog meme
• <b>dogwifhat (WIF)</b> — Solana-based meme coin
• <b>Bonk (BONK)</b> — Solana's first dog-themed meme

<b>⚠️ Warning:</b> Meme coins are extremely risky. Never invest more than you can afford to lose. Most meme coins fail and go to zero.`;
    },

    getOracleExplanation() {
        return `<b>What Are Blockchain Oracles?</b>

Oracles are systems that bring real-world data onto the blockchain so smart contracts can use it. Blockchains cannot access external data natively — oracles solve this.

<b>Why They Matter:</b>
• DeFi protocols need price feeds for lending/borrowing
• Prediction markets need real-world event outcomes
• Insurance protocols need weather, flight data, etc.

<b>Leading Oracle:</b>
• <b>Chainlink (LINK)</b> — Decentralized oracle network with 1000+ price feeds
• <b>Pyth Network</b> — High-frequency financial data from major exchanges
• <b>WINkLink</b> — Oracle on TRON

<b>⚠️ Risks:</b>
• Oracle manipulation (attacking the data source)
• Centralization risk if too few node operators
• Stale or delayed price feeds causing liquidations

Without oracles, DeFi would not exist as we know it.`;
    },

    getBridgeExplanation() {
        return `<b>What Are Cross-Chain Bridges?</b>

Bridges enable the transfer of assets and data between different blockchains. For example, moving ETH from Ethereum to Solana, or USDC from BNB Chain to Arbitrum.

<b>How They Work:</b>
• <b>Lock & Mint</b> — Lock tokens on source chain, mint wrapped tokens on destination
• <b>Burn & Release</b> — Burn wrapped tokens on destination, release original on source

<b>Types of Bridges:</b>
• <b>Centralized</b> — Binance Bridge, exchange-based (fast but trust-based)
• <b>Decentralized</b> — Wormhole, LayerZero, Axelar (trust-minimized)
• <b>Liquidity Networks</b> — Across, Synapse (swap across chains)

<b>⚠️ Security Risks:</b>
Bridges are the most hacked DeFi infrastructure. Over $2B has been lost in bridge exploits (Wormhole $325M, Ronin $620M).

<b>💡 Tip:</b> Use bridges only when necessary and stick to well-audited, battle-tested protocols.`;
    },

    getForkExplanation() {
        return `<b>What Is a Blockchain Fork?</b>

A fork occurs when a blockchain's protocol changes, splitting the chain into two separate paths. Forks can be planned (upgrades) or contentious (community splits).

<b>Hard Fork:</b>
• Permanent divergence from the previous version
• Old nodes cannot validate new blocks
• Creates a new blockchain if community splits
• <b>Examples:</b> Bitcoin Cash (from BTC), Ethereum Classic (from ETH after DAO hack)

<b>Soft Fork:</b>
• Backward-compatible upgrade
• Old nodes can still validate new blocks (with limitations)
• No new chain created
• <b>Examples:</b> SegWit on Bitcoin, Ethereum's Istanbul upgrade

<b>Why Forks Happen:</b>
• Protocol upgrades (better scalability, security)
• Community disagreement on direction
• Fixing critical bugs or security issues

<b>💡 For Investors:</b> Hard forks can result in free tokens (like Bitcoin Cash from Bitcoin). Always research before a planned fork.`;
    },

    getDaoExplanation() {
        return `<b>What Is a DAO?</b>

A DAO (Decentralized Autonomous Organization) is an organization governed by smart contracts and collective voting rather than a central authority. Decisions are made through token-based voting.

<b>How DAOs Work:</b>
• Members buy or earn governance tokens
• Token holders propose and vote on changes
• Smart contracts execute approved proposals automatically
• Treasury funds are controlled collectively

<b>Types of DAOs:</b>
• <b>Protocol DAOs</b> — Uniswap, Compound, Aave govern their protocols
• <b>Investment DAOs</b> — Members pool funds to invest in projects
• <b>Social DAOs</b> — Community-focused organizations
• <b>Grant DAOs</b> — Distribute funds to support ecosystem development

<b>Notable DAOs:</b>
• <b>Uniswap DAO</b> — Controls Uniswap protocol
• <b>MakerDAO</b> — Manages DAI stablecoin
• <b>Aragon</b> — Platform for creating DAOs

<b>⚠️ Risks:</b> Low voter participation, whale dominance, governance attacks, legal uncertainty.`;
    },

    getTokenomicsExplanation() {
        return `<b>What Is Tokenomics?</b>

Tokenomics (token + economics) is the study of how a cryptocurrency's supply, distribution, and incentives work. Understanding tokenomics is key to evaluating a project.

<b>Key Components:</b>

<b>1. Supply</b>
• <b>Max Supply</b> — Total tokens that will ever exist (BTC: 21M)
• <b>Circulating Supply</b> — Tokens currently in circulation
• <b>Inflation Rate</b> — New tokens created per year

<b>2. Distribution</b>
• <b>Team & Investors</b> — Percentage allocated to founders/VCs
• <b>Public Sale</b> — ICO, IEO, IDO allocations
• <b>Community/ Treasury</b> — For grants, ecosystem growth
• <b>Vesting Schedules</b> — Lockup periods preventing dumps

<b>3. Utility</b>
• <b>Governance</b> — Voting rights (UNI, MKR)
• <b>Staking</b> — Earn rewards, secure network
• <b>Gas/ Fees</b> — Pay for transactions (ETH, SOL)
• <b>Revenue Share</b> — Protocol fees distributed to holders

<b>🔴 Red Flags:</b>
• >30% allocated to team with short vesting
• No hard cap on supply
• Extremely high inflation rate (>100% APY)
• No clear utility for the token

Learn how to research tokens with our <a href="https://coinadvice.site/pages/token-checker.html" style="color:#818cf8">Token Checker →</a>`;
    },

    getWeb3Explanation() {
        return `<b>What Is Web3?</b>

Web3 is the next evolution of the internet, built on blockchain technology. It shifts from centralized platforms to decentralized, user-owned protocols.

<b>The Evolution:</b>
• <b>Web1 (Read)</b> — Static websites, read-only (1990s)
• <b>Web2 (Read-Write)</b> — Social media, user-generated content, but centralized (2000s-present)
• <b>Web3 (Read-Write-Own)</b> — User-owned data, decentralized apps, token-based economies

<b>Key Principles:</b>
• Decentralization — No single entity controls the network
• Trustlessness — No need to trust third parties
• Permissionless — Anyone can participate
• Self-Sovereign Identity — You control your data

<b>Web3 Technologies:</b>
• Blockchains (Ethereum, Solana, Polkadot)
• dApps (Uniswap, Aave, OpenSea)
• NFTs and Digital Ownership
• Decentralized Storage (IPFS, Filecoin)
• DAOs (Community Governance)

<b>💡 Why It Matters:</b> Web3 gives users ownership and control that Web2 platforms took away. No more platform lock-in, data exploitation, or censorship.`;
    },

    getStablecoinExplanation() {
        return `<b>What Are Stablecoins?</b>

Stablecoins are cryptocurrencies designed to maintain a stable value, typically pegged 1:1 to a fiat currency like the US dollar.

<b>Types of Stablecoins:</b>

<b>1. Fiat-Collateralized</b>
• Backed by real US dollars in bank accounts
• Fully transparent and audited
• <b>Examples:</b> USDC (Circle), USDT (Tether)
• Most reliable but centralized

<b>2. Crypto-Collateralized</b>
• Backed by other cryptocurrencies (over-collateralized)
• Maintained through smart contracts
• <b>Example:</b> DAI (MakerDAO) — backed by ETH, USDC, etc.
• Decentralized but complex

<b>3. Algorithmic</b>
• No collateral — uses algorithms to maintain peg
• Adjusts supply based on demand
• <b>Example:</b> FRAX (partially algorithmic)
• ⚠️ High risk — UST collapsed in 2022 ($40B lost)

<b>Why Stablecoins Matter:</b>
• On-ramp/off-ramp between crypto and fiat
• Trading pairs without volatility
• DeFi lending and borrowing base
• Cross-border payments and remittances`;
    },

    getAmmExplanation() {
        return `<b>What is an Automated Market Maker (AMM)?</b>

AMM is a decentralized trading mechanism that uses mathematical formulas to price assets instead of traditional order books. It powers most decentralized exchanges (DEXs).

<b>How AMMs Work:</b>
• Liquidity providers deposit token pairs into pools
• The AMM uses a formula to determine prices based on pool balances
• <b>Constant Product Formula:</b> x * y = k (used by Uniswap)
• Traders swap against the pool, paying a fee to LPs

<b>Key Concepts:</b>
• <b>Liquidity Pool</b> — Smart contract holding token reserves
• <b>Liquidity Provider (LP)</b> — Anyone who deposits tokens to earn fees
• <b>LP Tokens</b> — Represent your share of the pool
• <b>Slippage</b> — Price difference due to pool size vs trade size
• <b>Impermanent Loss</b> — Temporary loss when prices diverge

<b>Popular AMMs:</b>
• <b>Uniswap</b> — Ethereum, multiple fee tiers
• <b>Curve</b> — Optimized for stablecoin swaps (low slippage)
• <b>Balancer</b> — Multi-token pools with custom weights

Track liquidity pools on our <a href="https://coinadvice.site/pages/dex-scanner.html" style="color:#818cf8">DEX Scanner →</a>`;
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
        if (/\b(seed phrase|recovery phrase|mnemonic|24 words|12 words)\b/.test(q)) {
            return 'A seed phrase (or recovery phrase) is a set of 12 or 24 words that can recover your entire crypto wallet. It is the master key to all your funds.\n\n<b>🔐 Critical Rules:</b>\n• Never share your seed phrase with anyone\n• Never type it into any website or app\n• Store it offline — write it on paper, NOT digitally\n• Use a metal backup to protect against fire/flood\n• Never photograph or screenshot it\n\n<b>💡 Best Practice:</b> Keep multiple copies in separate secure locations. A hardware wallet like Ledger keeps your seed offline.\n\nLearn more on our <a href="https://coinadvice.site/blog/030-what-is-private-key-why-it-matters.html" style="color:#818cf8">What is a Private Key guide →</a>';
        }
        if (/\b(layer.?1|l1|base layer|mainnet)\b/.test(q)) {
            return 'Layer 1 (L1) refers to the base blockchain network itself. L1s handle consensus, security, and finality for all transactions.\n\n<b>Major Layer 1s:</b>\n• <b>Bitcoin</b> — The original, PoW, digital gold\n• <b>Ethereum</b> — Smart contracts, PoS, largest ecosystem\n• <b>Solana</b> — High speed, PoH+PoS, ~65K TPS\n• <b>Cardano</b> — Research-driven, PoS\n• <b>Avalanche</b> — Subnets, fast finality\n• <b>BNB Chain</b> — EVM-compatible, large DeFi ecosystem\n• <b>Polkadot</b> — Multi-chain, parachains\n\nLayer 2s (Arbitrum, Optimism) build on top of L1s for scalability.';
        }
        if (/\b(coin vs token|token vs coin|coin and token difference)\b/.test(q)) {
            return '🔑 <b>Coin vs Token: What\'s the Difference?</b>\n\n<b>Coins</b> have their own blockchain:\n• BTC runs on Bitcoin network\n• ETH runs on Ethereum network\n• SOL runs on Solana network\n\n<b>Tokens</b> are built on existing blockchains:\n• USDC, UNI, SHIB are ERC-20 tokens on Ethereum\n• BONK, WIF are SPL tokens on Solana\n• CAKE is a BEP-20 token on BNB Chain\n\nCoins secure their own network; tokens piggyback on existing ones for security and infrastructure.';
        }
        if (/\b(kyc|verify.*identity|identity verification|proof.*identity|know your customer)\b/.test(q)) {
            return 'KYC (Know Your Customer) is the process of verifying your identity before using a centralized crypto exchange. You typically need to submit:\n\n• Government-issued ID (passport, driver\'s license)\n• Proof of address (utility bill, bank statement)\n• Selfie/face verification\n\n<b>Why KYC Matters:</b>\n• Legal requirement in most countries\n• Prevents money laundering and fraud\n• Higher withdrawal limits and fiat access\n• Required for regulated platforms\n\n<b>💡 Tip:</b> DEXs (Uniswap, Jupiter) don\'t require KYC. CEXs (Binance, Coinbase) do. Choose based on your needs.';
        }
        if (/\b(airdrop|free token|claim.*token|retroactive)\b/.test(q)) {
            return 'Crypto airdrops distribute free tokens to users who meet certain criteria (past users, testers, active community members).\n\n<b>How to Find Airdrops:</b>\n• Use protocols early and actively\n• Complete testnet tasks\n• Hold governance tokens\n• Follow project announcements\n\n<b>Famous Airdrops:</b>\n• Uniswap (UNI): $1,200 per user\n• Arbitrum (ARB): $1,500+ per wallet\n• Celestia (TIA): $2,000+ per staker\n• Jito (JTO): $500+ per Solana user\n\n<b>⚠️ Warning:</b> Never connect your wallet to unknown sites promising airdrops. Use our <a href="https://coinadvice.site/pages/airdrops.html" style="color:#818cf8">Airdrop Finder</a> for verified opportunities.';
        }
        if (/\b(fomo|fud|bagholder|rekt)\b/.test(q)) {
            return '<b>Common Crypto Slang Explained:</b>\n\n• <b>FOMO</b> — Fear Of Missing Out. Buying after a big pump out of fear. Usually leads to buying the top.\n• <b>FUD</b> — Fear, Uncertainty, Doubt. Negative news or rumors intended to spread fear.\n• <b>HODL</b> — Hold On for Dear Life. Long-term holding regardless of price volatility.\n• <b>REKT</b> — Wrecked. Heavy losses from a bad trade or market crash.\n• <b>Bagholder</b> — Someone holding a token that has crashed significantly.\n• <b>DYOR</b> — Do Your Own Research. Always verify before investing.\n• <b>NGMI</b> — Not Gonna Make It. A project or person unlikely to succeed.';
        }
        if (/\b(whitepaper|white.?paper)\b/.test(q)) {
            return 'A whitepaper is a document published by a crypto project explaining its technology, vision, tokenomics, and roadmap. It is the foundational document for evaluating any project.\n\n<b>What to Look For:</b>\n• <b>Problem & Solution</b> — What does it solve?\n• <b>Technology</b> — How does it work (consensus, architecture)?\n• <b>Tokenomics</b> — Supply, distribution, inflation, utility\n• <b>Team</b> — Who is building it? Are they doxxed?\n• <b>Roadmap</b> — Past milestones and future plans\n\n🔴 <b>Red Flags:</b> No whitepaper, plagiarized content, unrealistic promises, anonymous team.\n\nLearn more on our <a href="https://coinadvice.site/blog/040-what-is-whitepaper-how-to-read.html" style="color:#818cf8">How to Read a Whitepaper guide →</a>';
        }
        if (/\b(portfolio|diversif|allocation|manage.*risk|risk.*management)\b/.test(q)) {
            return '<b>Crypto Portfolio Management Tips:</b>\n\n<b>1. Diversify</b> — Don\'t put everything in one coin. Spread across BTC, ETH, and select alts.\n<b>2. Size Matters</b> — Large cap (60-70%), mid cap (20-30%), small cap (10-20% max)\n<b>3. Rebalance</b> — Review and rebalance quarterly\n<b>4. Risk Management</b> — Never invest more than you can afford to lose\n<b>5. Take Profits</b> — Have a plan for when to sell, not just when to buy\n\nTrack your portfolio with our <a href="https://coinadvice.site/pages/portfolio.html" style="color:#818cf8">Portfolio Tracker →</a>\nCalculate profits with our <a href="https://coinadvice.site/pages/profit-calculator.html" style="color:#818cf8">Profit Calculator →</a>';
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

<b>📚 Educational Topics</b>
"What is DeFi?", "How does staking work?", "What is a wallet?"
"Explain Layer 2", "What is a DEX?", "How do oracles work?"
"Meme coins explained", "What is a DAO?", "Tokenomics basics"
"Cross-chain bridges", "Stablecoins", "AMMs", "Halving", "Web3"
"Coin vs Token", "Seed phrases", "KYC", "Portfolio tips"

<b>💎 Altcoin Discovery</b>
"Best altcoins today", "Altcoins with potential"

Try typing one of these or use the quick buttons below!`;
    },
};
