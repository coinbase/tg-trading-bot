# Telegram Trading Bot

This provides a template for Telegram trading bot on Base Mainnet that uses the
[Coinbase Developer Platform (CDP) SDK](https://docs.cdp.coinbase.com/cdp-sdk/docs/welcome)
and [MPC Wallet APIs](https://docs.cdp.coinbase.com/mpc-wallet/docs/welcome).

It stores wallet data in a local database using PouchDB, and is meant to be run locally.

## Set Up

1. Clone this repository:

```bash
git clone https://github.com/coinbase/tg-trading-bot.git
```

2. Provision a [CDP API Key](https://docs.cdp.coinbase.com/developer-platform/docs/cdp-keys).
3. Provision a [Telegram Bot Token](https://core.telegram.org/bots/tutorial) and register your Bot.
4. Generate a 32-byte encryption key using OpenSSL:

```bash
openssl rand -hex 32 # Save the output to use as the encryption key in Step 5.
```

5. Set the following environment variables, e.g. in a `.env` file or in a
   Secret Manager:

```bash
TELEGRAM_BOT_TOKEN="Your Telegram Bot Token"
COINBASE_API_KEY_NAME="Your CDP API Key Name"
COINBASE_API_KEY_SECRET="Your CDP API Key Private Key"
ENCRYPTION_KEY="Your hex-encoded encryption key"
```

6. Run the project!

```
npm install
npm run start
```
