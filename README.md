# Telegram Trading Bot

This provides a template for Telegram trading bot on Base Mainnet that uses the
[Coinbase Developer Platform (CDP) SDK](https://docs.cdp.coinbase.com/cdp-sdk/docs/welcome)
and [MPC Wallet APIs](https://docs.cdp.coinbase.com/mpc-wallet/docs/welcome).

It stores wallet data in a local database using PouchDB, and is meant to be run locally.

> **NOTE: This sample app is for demonstration purposes only.** Make sure to persist your
> private keys, and deposit only small amounts of ETH to reduce the risk of losing your funds.

**Secure your wallet using [best practices](https://docs.cdp.coinbase.com/mpc-wallet/docs/wallets#securing-a-wallet). In production, you should [use the 2-of-2 CDP Server-Signer](https://docs.cdp.coinbase.com/mpc-wallet/docs/serversigners)
for increased security.**

## Feature requests

If there is specific functionality you'd like to see in the CDP SDK that is missing,
please [file it as an issue](https://github.com/coinbase/coinbase-sdk-nodejs/issues), and we will get back to you as soon as possible.

You can also contact us via the [CDP SDK Discord Channel](https://discord.com/channels/1220414409550336183/1232677295546957919).

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

5. Set the following environment variables in a `.env` file in this directory:

```bash
TELEGRAM_BOT_TOKEN="Your Telegram Bot Token"
COINBASE_API_KEY_NAME="Your CDP API Key Name"
COINBASE_API_KEY_SECRET="Your CDP API Key Private Key"
ENCRYPTION_KEY="Your hex-encoded encryption key"
```

6. Run the project:

```
npm install
npm run start
```

7. Send the `/start` message to the Bot you provisioned in Step 3 on Telegrma, and start trading!
