import { Bot, InputFile } from "grammy";
import { Env } from "../types/env";

export class TelegramBot {
  bot: Bot;
  private channelId?: number;
  private env: Env | NodeJS.ProcessEnv;

  constructor(channelId?: number, env: Env | NodeJS.ProcessEnv = process.env) {
    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN is not set");
    }

    this.bot = new Bot(botToken);
    this.channelId = channelId;
    this.env = env;

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Add error handling middleware
    this.bot.catch((err) => {
      console.error("Error in bot:", err);
      console.error("Error stack:", err.stack);
    });

    //// Add middleware to log raw updates
    // this.bot.use(async (ctx, next) => {
    //   console.log("Raw update received:", JSON.stringify(ctx.update, null, 2));
    //   try {
    //     await next();
    //   } catch (err) {
    //     console.error("Error in middleware:", err);
    //     throw err;
    //   }
    // });

    // Log all updates
    this.bot.on("message", async (ctx) => {
      console.log("Message received:", ctx.message);
    });

    this.bot.on("channel_post", async (ctx) => {
      console.log("Channel post received:", ctx.chat?.id);
    });

    // Handle any other types of updates
    this.bot.on("callback_query", async (ctx) => {
      console.log("Callback query received:", ctx.callbackQuery);
    });

    this.bot.on("inline_query", async (ctx) => {
      console.log("Inline query received:", ctx.inlineQuery);
    });
  }

  async postMessage(htmlText: string) {
    if (!this.channelId) {
      throw new Error("channelId is not set");
    }
    const result = await this.bot.api.sendMessage(this.channelId, htmlText, {
      parse_mode: "HTML",
      link_preview_options: {
        is_disabled: true,
      },
    });
    console.log("Message posted to Telegram.");
    return result;
  }

  async postPhoto(buffer: Buffer, caption: string) {
    if (!this.channelId) {
      throw new Error("channelId is not set");
    }
    await this.bot.api.sendPhoto(this.channelId, new InputFile(buffer), {
      parse_mode: "HTML",
      caption: caption,
    });
    console.log("Message posted to Telegram.");
  }
}
