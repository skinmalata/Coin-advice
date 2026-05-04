document.addEventListener('DOMContentLoaded', () => {
    initTokenChecker();
});

function initTokenChecker() {
    document.getElementById('check-token').addEventListener('click', checkToken);
}

async function checkToken() {
    const address = document.getElementById('token-address').value.trim();
    const chainId = document.getElementById('check-chain').value;
    const result = document.getElementById('tool-content');
    
    if (!address) {
        result.innerHTML = '<div class="error">Please enter a token address</div>';
        return;
    }
    
    result.innerHTML = '<div class="loading">Checking token security...</div>';
    
    try {
        const res = await fetch(`https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`);
        if (!res.ok) throw new Error(`GoPlus API error: ${res.status}`);
        const data = await res.json();
        const token = data.result?.[address.toLowerCase()];
        
        if (!token) {
            result.innerHTML = '<div class="error">Token not found or analysis failed</div>';
            return;
        }
        
        const score = calculateSecurityScore(token);
        const scoreColor = score >= 80 ? 'var(--md-green)' : score >= 50 ? 'var(--md-yellow)' : 'var(--md-red)';
        
        result.innerHTML = `
            <div class="security-result">
                <div class="security-score">
                    <div class="score-circle" style="background: ${scoreColor}20; color: ${scoreColor}; border-color: ${scoreColor};">
                        ${score}
                    </div>
                    <h3>Security Score</h3>
                </div>
                <div class="security-checks">
                    <div class="check-item">
                        <span>Is Open Source</span>
                        <span class="check-status ${token.is_open_source === '1' ? 'pass' : 'warning'}">
                            ${token.is_open_source === '1' ? '✓ Yes' : '✗ No'}
                        </span>
                    </div>
                    <div class="check-item">
                        <span>Has Proxy</span>
                        <span class="check-status ${token.has_proxy === '1' ? 'warning' : 'pass'}">
                            ${token.has_proxy === '1' ? '⚠ Yes' : '✓ No'}
                        </span>
                    </div>
                    <div class="check-item">
                        <span>Is Mintable</span>
                        <span class="check-status ${token.is_mintable === '1' ? 'fail' : 'pass'}">
                            ${token.is_mintable === '1' ? '✗ Yes' : '✓ No'}
                        </span>
                    </div>
                    <div class="check-item">
                        <span>Can Take Back Ownership</span>
                        <span class="check-status ${token.can_take_back_ownership === '1' ? 'fail' : 'pass'}">
                            ${token.can_take_back_ownership === '1' ? '✗ Yes' : '✓ No'}
                        </span>
                    </div>
                    <div class="check-item">
                        <span>Owner Balance</span>
                        <span class="check-status ${parseFloat(token.owner_balance || 0) > 10 ? 'warning' : 'pass'}">
                            ${parseFloat(token.owner_balance || 0).toFixed(2)}%
                        </span>
                    </div>
                    <div class="check-item">
                        <span>Is Honeypot</span>
                        <span class="check-status ${token.is_honeypot === '1' ? 'fail' : 'pass'}">
                            ${token.is_honeypot === '1' ? '✗ DANGER' : '✓ Safe'}
                        </span>
                    </div>
                    <div class="check-item">
                        <span>Transfer Pausable</span>
                        <span class="check-status ${token.is_pausable === '1' ? 'warning' : 'pass'}">
                            ${token.is_pausable === '1' ? '⚠ Yes' : '✓ No'}
                        </span>
                    </div>
                    <div class="check-item">
                        <span>Trading Cooldown</span>
                        <span class="check-status ${token.is_cooldown === '1' ? 'warning' : 'pass'}">
                            ${token.is_cooldown === '1' ? '⚠ Yes' : '✓ No'}
                        </span>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        result.innerHTML = `<div class="error">Error checking token: ${err.message}</div>`;
    }
}

function calculateSecurityScore(token) {
    let score = 100;
    if (token.is_open_source !== '1') score -= 10;
    if (token.has_proxy === '1') score -= 10;
    if (token.is_mintable === '1') score -= 15;
    if (token.can_take_back_ownership === '1') score -= 20;
    if (parseFloat(token.owner_balance || 0) > 10) score -= 10;
    if (token.is_honeypot === '1') score -= 30;
    if (token.is_pausable === '1') score -= 5;
    if (token.is_cooldown === '1') score -= 5;
    return Math.max(0, score);
}
