const { Bot, InlineKeyboard } = require("grammy");
const { Coinbase, Wallet } = require("@coinbase/coinbase-sdk");
const PouchDB = require('pouchdb');
const Decimal = require("decimal.js");
const Web3 = require("web3");
const crypto = require("crypto");

require("dotenv").config();

// Required environment variables validation
const requiredEnvVars = [
  "TELEGRAM_BOT_TOKEN",
  "COINBASE_API_KEY_NAME",
  "COINBASE_API_KEY_SECRET",
  "ENCRYPTION_KEY",
];

requiredEnvVars.forEach((env) => {
  if (!process.env[env]) {
    throw new Error(`Missing ${env} environment variable`);
  }
});

// Initialize core components
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const userStates = {};
const db = new PouchDB('myapp', {
  ajax: {
    timeout: 10000 // 10 second timeout for database operations
  }
});

// Initialize Coinbase SDK
const coinbase = new Coinbase({
  apiKeyName: process.env.COINBASE_API_KEY_NAME,
  privateKey: process.env.COINBASE_API_KEY_SECRET,
});

// State management functions
const updateUserState = (user, newState) => {
  const currentState = userStates[user.id] || {};
  userStates[user.id] = { ...currentState, ...newState };
  console.log('Updated user state:', user.id, userStates[user.id]);
};

const clearUserState = (user) => {
  delete userStates[user.id];
  console.log('Cleared state for user:', user.id);
};

const getUserState = (user) => {
  return userStates[user.id] || {};
};

// Reply keyboard setup
const mainMenuKeyboard = {
  keyboard: [
    ["Check Balance", "Deposit"],
    ["Buy", "Sell"],
    ["Help", "Settings"]
  ],
  resize_keyboard: true,
  persistent: true
};

// Message handling functions
const sendReply = async (ctx, text, options = {}) => {
  try {
    const message = await ctx.reply(text, {
      parse_mode: "Markdown",
      ...options
    });
    if (options.trackReply !== false) {
      updateUserState(ctx.from, { lastMessageId: message.message_id });
    }
    return message;
  } catch (error) {
    console.error('Error sending reply:', error);
    throw error;
  }
};

// Wallet management
async function getOrCreateAddress(user) {
  console.log('Getting address for user:', user.id);
  
  try {
    // Check memory cache first
    const cachedState = getUserState(user);
    if (cachedState.address) {
      return cachedState.address;
    }

    let wallet;
    // Try to load existing wallet
    try {
      const result = await db.get(user.id.toString());
      const { ivString, encryptedWalletData } = result;
      const iv = Buffer.from(ivString, "hex");
      const walletData = JSON.parse(decrypt(encryptedWalletData, iv));
      wallet = await Wallet.import(walletData);
    } catch (error) {
      // Create new wallet if not found
      if (error.name === 'not_found' || error.status === 404) {
        wallet = await Wallet.create({ networkId: "base-mainnet" });
        const iv = crypto.randomBytes(16);
        const encryptedWalletData = encrypt(JSON.stringify(wallet.export()), iv);
        await db.put({
          _id: user.id.toString(),
          ivString: iv.toString("hex"),
          encryptedWalletData,
        });
      } else {
        console.error('Database error:', error);
        throw error;
      }
    }

    const address = wallet.getDefaultAddress();
    updateUserState(user, { address });
    return address;
  } catch (error) {
    console.error('Error in getOrCreateAddress:', error);
    throw error;
  }
}

// Command handlers
async function handleCheckBalance(ctx) {
  try {
    const userAddress = await getOrCreateAddress(ctx.from);
    const balanceMap = await userAddress.listBalances();
    const balancesString = balanceMap.size > 0
      ? balanceMap.toString().slice(11, -1)
      : "You have no balances.";
    await sendReply(ctx, `Your current balances are as follows:\n${balancesString}`);
  } catch (error) {
    console.error('Error checking balance:', error);
    await ctx.reply("Error checking balance. Please try again later.");
  }
}

async function handleDeposit(ctx) {
  try {
    const userAddress = await getOrCreateAddress(ctx.from);
    await sendReply(ctx, 
      "_Note: As this is a test app, make sure to deposit only small amounts of ETH!_",
      { parse_mode: "Markdown" }
    );
    await sendReply(ctx, "Please send your ETH to the following address on Base:");
    await sendReply(ctx, `\`${userAddress.getId()}\``, { parse_mode: "Markdown" });
  } catch (error) {
    console.error('Error handling deposit:', error);
    await ctx.reply("Error generating deposit address. Please try again later.");
  }
}

async function handleInitialBuy(ctx) {
  updateUserState(ctx.from, { 
    buyRequested: true,
    step: 'asset'
  });
  await sendReply(ctx, 
    "Please respond with the asset you would like to buy (ticker or contract address).",
    { reply_markup: { force_reply: true } }
  );
}

async function handleInitialSell(ctx) {
  updateUserState(ctx.from, {
    sellRequested: true,
    step: 'asset'
  });
  await sendReply(ctx,
    "Please respond with the asset you would like to sell (ticker or contract address).",
    { reply_markup: { force_reply: true } }
  );
}

async function handleBuy(ctx) {
  const userState = getUserState(ctx.from);
  await executeTrade(ctx, "buy", userState);
}

async function handleSell(ctx) {
  const userState = getUserState(ctx.from);
  await executeTrade(ctx, "sell", userState);
}

async function executeTrade(ctx, type, userState) {
  try {
    if (!userState.asset) {
      if (ctx.message.text.toLowerCase() === "eth" && type === "sell") {
        await ctx.reply("You cannot sell ETH, as it is the quote currency. Please try again.");
        clearUserState(ctx.from);
        return;
      }

      updateUserState(ctx.from, { 
        asset: ctx.message.text.toLowerCase(),
        step: 'amount'
      });

      const prompt = type === "buy"
        ? "Please respond with the amount of ETH you would like to spend."
        : "Please respond with the amount of the asset you would like to sell.";
      
      await sendReply(ctx, prompt, { reply_markup: { force_reply: true } });
    } else {
      const amount = new Decimal(ctx.message.text);
      const userAddress = await getOrCreateAddress(ctx.from);
      const currentBalance = await userAddress.getBalance(
        type === "buy" ? Coinbase.assets.Eth : userState.asset
      );

      if (amount.isNaN() || amount.greaterThan(currentBalance)) {
        await ctx.reply("Invalid amount or insufficient balance. Please try again.");
        clearUserState(ctx.from);
        return;
      }

      const tradeType = type === "buy"
        ? { fromAssetId: Coinbase.assets.Eth, toAssetId: userState.asset }
        : { fromAssetId: userState.asset, toAssetId: Coinbase.assets.Eth };

      await sendReply(ctx, `Initiating ${type}...`);
      
      try {
        const trade = await userAddress.createTrade({ amount, ...tradeType });
        await trade.wait();
        await sendReply(ctx,
          `Successfully completed ${type}: [Basescan Link](${trade.getTransaction().getTransactionLink()})`,
          { parse_mode: "Markdown" }
        );
      } catch (error) {
        console.error(`Error executing ${type}:`, error);
        await ctx.reply(`An error occurred while executing the ${type}. Please try again.`);
      }
      
      clearUserState(ctx.from);
    }
  } catch (error) {
    console.error(`Error in executeTrade (${type}):`, error);
    await ctx.reply("An error occurred. Please try again.");
    clearUserState(ctx.from);
  }
}

// Bot command handlers
bot.command("start", async (ctx) => {
  console.log('Received /start command from user:', ctx.from.id);
  const { from: user } = ctx;
  
  try {
    const userAddress = await getOrCreateAddress(user);
    
    const welcomeMessage = `
Welcome to your Onchain Trading Bot!
Your Base address is \`${userAddress.getId()}\`.

Available commands:
• Check Balance - View your current holdings
• Deposit - Get your deposit address
• Buy - Purchase cryptocurrencies
• Sell - Sell your assets
• Help - Get assistance
• Settings - Configure your preferences

Please select an option from the menu below.`;

    await ctx.reply(welcomeMessage, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard
    });
  } catch (error) {
    console.error('Error in start command:', error);
    await ctx.reply("An error occurred while starting the bot. Please try again.");
  }
});

// Message handler
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  const userState = getUserState(ctx.from);

  try {
    // Handle ongoing operations first
    if (userState.buyRequested || userState.sellRequested) {
      const operation = userState.buyRequested ? handleBuy : handleSell;
      await operation(ctx);
      return;
    }

    // Handle menu commands
    switch (text) {
      case "Check Balance":
        await handleCheckBalance(ctx);
        break;
      case "Deposit":
        await handleDeposit(ctx);
        break;
      case "Buy":
        await handleInitialBuy(ctx);
        break;
      case "Sell":
        await handleInitialSell(ctx);
        break;
      case "Help":
        await ctx.reply(`
Available commands:
• Check Balance - View your current holdings
• Deposit - Get your deposit address
• Buy - Purchase cryptocurrencies
• Sell - Sell your assets
• Help - Get assistance
• Settings - Configure your preferences

Send /start to see this menu again.`);
        break;
      case "Settings":
        await ctx.reply("Settings menu is coming soon.");
        break;
      default:
        await ctx.reply("Please select an option from the menu or type /start to see available commands.");
    }
  } catch (error) {
    console.error('Error handling message:', error);
    await ctx.reply("An error occurred while processing your request. Please try again.");
    clearUserState(ctx.from);
  }
});

// Error handler
bot.catch((error) => {
  console.error("Bot error:", error);
  
  if (error.ctx) {
    error.ctx.reply("An error occurred while processing your request. Please try again.")
      .catch(e => console.error("Error sending error message:", e));
  }
});

// Encryption utilities
function encrypt(text, iv) {
  const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const cipher = crypto.createCipheriv("aes-256-cbc", encryptionKey, iv);
  return cipher.update(text, "utf8", "hex") + cipher.final("hex");
}

function decrypt(encrypted, iv) {
  const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", encryptionKey, iv);
  return decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8");
}

// Start the bot
bot.start();
console.log('Bot started');