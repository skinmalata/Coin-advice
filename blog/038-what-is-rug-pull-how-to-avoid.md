---
title: "What is a Rug Pull? How to Spot and Avoid It (2026)"
meta_description: "Learn what a rug pull is, how they work, and warning signs to watch for. Protect your crypto from scams with our security guide."
meta_keywords: "rug pull crypto, what is a rug pull, how to spot rug pull, avoid rug pull, crypto scam, liquidity removal, honeypot"
author: "Coin Advice"
date: "2026-04-30"
---

# What is a Rug Pull? How to Spot and Avoid It (2026)

You found a new DeFi token. Website looks professional. Telegram group has 50,000 members. Influencers are shilling it.

You buy $5,000 worth.

Two days later, the price crashes 99%. The Telegram group is deleted. The website is down. The developers are gone.

You've been **rug pulled** — one of the most devastating scams in crypto.

Every year, billions are lost to rug pulls. But they're 100% avoidable if you know the warning signs.

Let's break down exactly how rug pulls work and how to never fall for one.

## What is a Rug Pull?

A **rug pull** is a crypto scam where developers:
1. Create a token
2. Build hype and get people to buy
3. **Remove all liquidity** from the DEX (Uniswap, PancakeSwap)
4. **Disappear with the money**

The term comes from "pulling the rug out from under you" — one moment you're standing (profitable), the next you're on the floor (worthless).

Think of it like a fake investment seminar:
- Scammer rents a fancy hotel
- Gives a great presentation about "guaranteed returns"
- Collects $1 million from attendees
- Disappears before anyone realizes it's a scam

## How Rug Pulls Work (Step-by-Step)

### Step 1: Create the Token
Scammers deploy a simple ERC-20 or BEP-20 token.

**Cost**: $50-200 (cheap on Ethereum, cheaper on BSC/Solana).

### Step 2: Add Liquidity to a DEX
They pair their token with ETH/USDC/BNB on Uniswap/PancakeSwap.

**Example**:
- 1,000,000 SCAM tokens
- 100 ETH (worth $400,000)
- Total liquidity = $800,000

### Step 3: Build Hype
- Twitter bots spam "100x gem!"
- Telegram group grows to 50,000 members (mostly bots)
- Paid influencers shill it (undisclosed ads)
- Fake partnerships announced ("We're working with Ethereum!")

### Step 4: The Trap
Price pumps as retail buys in.

**You buy at $1**: "It's going to $100!"

### Step 5: The Rug Pull
Developers remove ALL liquidity from the DEX pool.

**What happens**:
- 1,000,000 SCAM tokens flood back to developers
- 100 ETH is gone (stolen)
- Your tokens are now worth $0 (no liquidity to sell)

**You lose 100% instantly.**

## Types of Rug Pulls

### 1. Liquidity Removal (Classic)
**How it works**: Developers remove liquidity they added.

**Warning sign**: Developers are the ONLY ones who provided liquidity.

**Protection**: Check if liquidity is **LOCKED** (see below).

### 2. Mint Function (Infinite Tokens)
**How it works**: Developers secretly keep "mint" function.

**What they do**:
1. You buy at $1
2. Developers mint 1 billion new tokens
3. Price crashes to $0.0001
4. Developers sell their pre-mined bags at $1

**Warning sign**: Contract allows minting (check with our [Token Checker Tool](../../index.html)).

### 3. Hidden Transfer Fees (Honeypot)
**How it works**: Contract has hidden code.

**What happens**:
- You can BUY the token (works fine)
- You try to SELL... transaction fails
- Developers can sell, YOU can't!

**Warning sign**: Contract has "tax" or "fee" functions that only apply to certain addresses.

**Protection**: ALWAYS check contracts with our [Token Checker Tool](../../index.html) before buying.

### 4. Fake Team (Anonymous + Fake Profiles)
**How it works**: "CEO" is a stolen LinkedIn profile photo.

**What happens**:
- You trust the "team" because they look legitimate
- They rug pull
- You can't find them (fake identities)

**Warning sign**: Team photos reverse Google search shows they're stock photos.

## Warning Signs: RED FLAGS

### 🚩 RED FLAG 1: Anonymous Team
**You can't find who created it.**

**Reality**: Some legit projects are anonymous (Satoshi). But for investment? You want accountability.

**Action**: Google the team. LinkedIn? Past projects? If they're anonymous, proceed with EXTREME caution.

### 🚩 RED FLAG 2: Liquidity NOT Locked
**You check Etherscan/BSCScan... liquidity can be removed anytime.**

**What to look for**:
- "Liquidity Locked" badge on Uniswap
- Check the lock duration (should be 6-12+ months)
- If NOT locked = rug pull waiting to happen

**Tool**: Our [Token Checker Tool](../../index.html) shows if liquidity is locked.

### 🚩 RED FLAG 3: Massive Token Holdings by Team
**You check the token distribution... team holds 80% of supply.**

**What happens**: They can dump on you anytime.

**Rule**: If team holds >20-30% of supply, be VERY careful.

### 🚩 RED FLAG 4: No Code Audit
**Project has no security audit.**

**Reality**: Legitimate projects pay $20K-100K for audits (CertiK, Trail of Bits, etc.).

**Action**: Check if audited. If not, it's high-risk.

### 🚩 RED FLAG 5: Unrealistic Promises
**"Guaranteed 1000% APY!" "Next Bitcoin!" "Will reach $100!"**

**Reality**: No one can guarantee crypto returns.

**Action**: If it sounds too good to be true, IT IS.

### 🚩 RED FLAG 6: Paid Influencer Hype
**Every influencer is tweeting about it... but none disclose it's an ad.**

**What to do**: Check #ad disclosure. Real projects don't need 50 influencers shilling simultaneously.

### 🚩 RED FLAG 7: No Real Product
**Website is just a whitepaper and "coming soon" roadmap.**

**Reality**: If there's no working product after 2 years, there never will be.

**Action**: Only invest in projects with LIVE products.

### 🚩 RED FLAG 8: Whitepaper is Gibberish
**You read it... it's just buzzwords. "AI-powered blockchain Web3 metaverse synergy."**

**Reality**: If you can't understand the use case after reading the whitepaper, neither can they.

## How to Check if a Token is Safe

### Step 1: Use Our [Token Checker Tool](../../index.html)
Enter the contract address, and we'll check:
- ✅ Ownership renounced?
- ✅ Mint function disabled?
- ✅ Liquidity locked?
- ✅ Hidden fees?
- ✅ Proxy contract risks?

**Powered by GoPlus API** — the same data used by major wallets.

### Step 2: Check Etherscan/BSCScan
1. Go to etherscan.io (or bscscan.com)
2. Search the token name
3. Click "Contract" tab
4. Look for:
   - "Proxy" (risk: contract can be changed)
   - "Renounce Ownership" (good sign)
   - Read contract code (if you can)

### Step 3: Check Liquidity Lock
1. Go to Uniswap Info (or DEX where it trades)
2. Look for "Liquidity Locked" badge
3. Check lock duration (6+ months = safer)

### Step 4: Check Token Distribution
1. Etherscan → "Holders" tab
2. See if top 10 holders own >50% (bad sign)
3. If one wallet owns 80% = RUG PULL COMING

### Step 5: Google the Team
1. Reverse image search team photos
2. Check LinkedIn profiles (real work history?)
3. Look for past projects (did they rug before?)

## Real Rug Pull Examples

### 1. SafeMoon (2022)
- Massive hype, celebrity endorsements
- Team held huge percentage
- Developers sold their tokens secretly
- Price crashed 90%+

### 2. Squid Game Token (2021)
- Tied to Netflix show (no official connection)
- Liquidity NOT locked
- Developers ruggd for $3.3 million
- Website went offline instantly

### 3. AnubisDAO (2021)
- $60 million raised in "DAO"
- Developers ruggd 24 hours later
- No product, just a whitepaper

**Common thread**: All had RED FLAGS that were ignored due to FOMO.

## Safe vs Risky: Comparison

| Feature | Safe Token | Rug Pull Risk |
|---------|-------------|---------------|
| **Team** | Doxxed (public) | Anonymous/fake |
| **Liquidity** | Locked 12+ months | Unlocked |
| **Contract** | Audited | No audit |
| **Token %** | Team <20% | Team >50% |
| **Product** | Live now | "Coming soon" |
| **Audit** | Multiple audits | None |
| **Website** | Professional | Template/fake |

## How to Buy New Tokens Safely

### Strategy 1: Use [1inch](https://1inch.io) Aggregator
- Finds best prices across DEXs
- Shows you if liquidity is REAL
- Less chance of honeypot tokens

### Strategy 2: Only Invest "Mad Money"
- Treat new tokens as gambling
- Only invest what you can lose 100% of
- **Rule**: <5% of your portfolio in new tokens

### Strategy 3: Take Profits Immediately
- New token pumps 2x? SELL 50%
- Pumps 5x? SELL 80%
- Never "hold forever" on new tokens

### Strategy 4: Use [Ledger](https://www.ledger.com) Hardware Wallet
- Even if you buy a scam token, it's separate from your main holdings
- **Never keep new tokens on exchanges** (harder to exit quickly)

## The Bottom Line

Rug pulls are 100% avoidable.

**To protect yourself:**
1. **ALWAYS check contracts** with our [Token Checker Tool](../../index.html)
2. **Verify liquidity is locked** (6+ months minimum)
3. **Check the team** (doxxed > anonymous)
4. **Only use "mad money"** (<5% of portfolio)
5. **Take profits early** (don't HODL new tokens)

**Remember**: If you're hearing about it on Twitter/Telegram, you're already late. Smart money is SELLING to you.

Ready to verify tokens before buying? Use our [Token Checker Tool](../../index.html) for instant security scans, [DEX Scanner](../../index.html) to check real liquidity, and [1inch](https://1inch.io) for safe DEX trading.

---

*Want to learn more about crypto security? Read our [How to Store Crypto Safely Guide](link-to-post-10) and [What is Market Manipulation](link-to-post-32) to build your defense strategy.*
