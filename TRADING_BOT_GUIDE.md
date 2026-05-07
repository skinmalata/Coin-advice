# CoinAdvice Robot Trader - Super Simple Guide

## 🤖 What is this?
Imagine you have a robot friend who watches crypto prices all day. When he sees a good deal, he buys it for you! This guide shows you how to set him up (with fake money first, so it's safe!).

---

## 🧱 What you need first (like LEGO pieces)

1. **Python** - This is the language your robot speaks. 
   - Ask a grown-up to install it from python.org
   - Check it works: type `python --version` in your terminal

2. **A place to store stuff** (database) - Like a notebook for your robot
   - We use something called PostgreSQL
   - Grown-ups can install it, or use a free online one

3. **Exchange account** - Like a candy store for crypto
   - Binance, Coinbase, or Kraken (ask mom/dad to help set this up)
   - **Important**: Only give the robot "read" and "trade" powers, NOT "withdraw" (so he can't take money out!)

4. **Your Telegram bot** - You already have this!
   - Password: `8730757481:AAGpu-0K5Xz8lUbSplv-pJUNkmeSeAfIonE`

---

## 🎮 Step 1: Install the Robot's Toolbox

Open your terminal (cmd on Windows):
```bash
cd C:\Users\Toks\Documents\Apps\coinadvice
pip install requests ccxt psycopg2-binary cryptography
```

This is like giving your robot his tools: a calculator, a safe, and a phone.

---

## 📓 Step 2: Make a Notebook (Database)

Ask a grown-up to help you create a "database". It's like a big notebook where your robot writes:
- Who his friends are (users)
- What trades he made
- How much money he made or lost

Grown-ups run this:
```bash
createdb coinadvice_trading
psql coinadvice_trading < sql/trading_bot.sql
```

---

## 🔑 Step 3: Set Up Secret Passwords

Create a file called `.env` (like a secret diary) with these:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/coinadvice_trading
BOT_TOKEN=8730757481:AAGpu-0K5Xz8lUbSplv-pJUNkmeSeAfIonE
ENCRYPTION_KEY=your-secret-code-here
```

**Get your secret code** (like a secret handshake):
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
Copy the long text it gives you and paste it as `ENCRYPTION_KEY=`.

---

## 🏦 Step 4: Give Robot Your Exchange Password (Safely!)

### Important Safety Rules:
- ✅ Let him **see prices** (read)
- ✅ Let him **buy/sell** (trade)
- ❌ **NEVER** let him **take money out** (withdraw) - this keeps your money safe!

When you make API keys on Binance/Coinbase:
1. Check "Spot Trading" ✅
2. Check "Read Info" ✅
3. **UNCHECK** "Withdraw" ❌

---

## 🎮 Step 5: Test with FAKE Money First!

This is like playing a video game before the real thing. Your robot has a "Pretend Mode" already turned on!

Run this:
```bash
python test_trading_bot.py
```

You'll see stuff like:
```
🤖 Checking prices...
BTC/USDT: STRONG BUY at $67,000
[FAKE] Would buy BTC at $67,000
✅ No real money used!
```

**Yay!** Your robot is working, but with pretend money!

---

## 📱 Step 6: Get Messages on Telegram

1. Open Telegram
2. Search for `@followcryptoadvicebot`
3. Say "Hi" or send `/start`
4. He'll reply with numbers (your chat ID) - copy these!
5. Tell your robot: `set USER_TELEGRAM_ID=those-numbers`

Now your robot texts you when he makes trades!

---

## 🚀 Step 7: Let Him Run All Day!

Right now, you have to type the command each time. To make him work 24/7:

### On Windows (ask grown-up):
1. Press `Win + R`, type `taskschd.msc`
2. Create a new task called "CoinAdviceRobot"
3. Set it to run `python run_trading_bot.py` every 1 minute

### On Mac/Linux (ask grown-up):
1. Create a "service" (like a little pet that never sleeps)
2. It runs your robot even when you're not watching

---

## 💰 Step 8: Sell This to People!

You can charge people to use your robot! Like a lemonade stand:

| What they get | How much | What they can do |
|-------------|---------|-----------------|
| **Basic** | $29/month | Robot trades 3 coins for them |
| **Pro** | $79/month | Robot trades 10 coins + texts them |
| **Elite** | $199/month | Robot does EVERYTHING + special tricks |

People pay you, you turn on their robot, and he trades for them!

---

## 🛡️ Super Important Safety Rules!

1. **ALWAYS use fake money first** - Test with "Pretend Mode"!
2. **Never give away your secret passwords** - Keep them in your `.env` diary
3. **Robot only uses 2% of money per trade** - So he doesn't bet the farm!
4. **There's a BIG RED BUTTON** - If something goes wrong, press "Emergency Stop"
5. **Past wins don't mean future wins** - Robot might lose money sometimes

---

## 🆘 Help! It's not working!

### "I don't see any trades!"
- Check if `auto_trade` is set to `True`
- Make sure you connected your exchange keys
- Look at `trading_bot.log` (your robot's diary)

### "My robot won't start!"
- Did you install the toolbox? (`pip install...`)
- Is your `.env` file correct?
- Ask a grown-up to check the error message

### "I lost money!"
- Remember: Trading is risky! Only use money you can afford to lose
- Always start with "Pretend Mode"
- Tell users: "Not financial advice!"

---

## 🎉 You're Done!

Your robot is ready! He:
- ✅ Watches prices 24/7
- ✅ Buys when he sees a good deal
- ✅ Sends you Telegram messages
- ✅ Uses fake money (safe!)

Now go show your mom/dad, and maybe sell this to people! 🚀

**Remember**: This is like a video game at first. Only use real money when you're SURE it works!
