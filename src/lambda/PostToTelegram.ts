import { EventBridgeHandler } from "aws-lambda";
import {
  ProcessedNewsSchema,
  ContentLanguage,
  ContentLanguages,
} from "../types";
import { prioritizeAndFormat } from "../prioritizeAndFormat";
import { TelegramUser } from "../telegram/user";
import { getBriefing, updateBriefingPost } from "../db/BriefingEntity";
import { downloadJSON } from "../storage";

if (!process.env.TELEGRAM_CHANNEL_ID) {
  throw new Error("TELEGRAM_CHANNEL_ID is not set");
}

const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

if (!process.env.CONTENT_LANGUAGE) {
  throw new Error("CONTENT_LANGUAGE is not set");
}

if (
  !ContentLanguages.includes(process.env.CONTENT_LANGUAGE as ContentLanguage)
) {
  throw new Error("CONTENT_LANGUAGE is not a valid language");
}

const CONTENT_LANGUAGE = process.env.CONTENT_LANGUAGE as ContentLanguage;

type Payload = {
  date: string;
};

if (!process.env.BUCKET_NAME) {
  throw new Error("BUCKET_NAME is not set");
}

const BUCKET_NAME = process.env.BUCKET_NAME;

export const handler: EventBridgeHandler<string, Payload, void> = async (
  event,
) => {
  console.log("Received EventBridge event:", JSON.stringify(event));

  try {
    const date = event.detail.date;
    const key = `summarized-news/${date}.json`;

    console.log(`Processing storage object: ${key}`);

    if (!key) {
      throw new Error("Missing key in EventBridge event detail");
    }

    console.log(`Processing storage object: ${key}`);

    // Download cached data from storage (S3 in Lambda, R2 in Workers)
    const content = await downloadJSON(key);
    const newsData = ProcessedNewsSchema.parse(content);

    const briefing = await getBriefing(newsData.date);

    if (!briefing) {
      throw new Error(`Briefing ${newsData.date} not found in database`);
    }
    if (
      briefing.posts?.find(
        (post) =>
          post.platform === "telegram" && post.language === CONTENT_LANGUAGE,
      ) !== undefined
    ) {
      throw new Error(
        `Briefing ${newsData.date} already posted to Telegram in ${CONTENT_LANGUAGE}`,
      );
    }

    console.log(`Processing news data for date: ${newsData.date}`);

    const formattedNews = prioritizeAndFormat(
      newsData,
      CONTENT_LANGUAGE,
      "telegram",
    );
    if (!formattedNews) {
      console.log("No news items found, skipping posting.");
      return;
    }

    console.log("Posting summary to Telegram...");

    const user = new TelegramUser();
    await user.login();
    const result = await user.sendMessage(CHANNEL_ID, formattedNews.message, {
      parseMode: "html",
      silent: false,
    });
    try {
      await user.logout();
      let postUrl = `https://t.me/${CHANNEL_ID}/${result.id}`;
      if (CHANNEL_ID.startsWith("-100")) {
        // if the channel id starts with -100, it's a private channel or we simply
        // don't have the handle, so we need to use the channel id without the -100
        postUrl = `https://t.me/c/${CHANNEL_ID.slice(4)}/${result.id}`;
      }

      await updateBriefingPost({
        date: newsData.date,
        formatter: "telegram",
        language: CONTENT_LANGUAGE,
        postUrl,
      });
    } catch (error) {
      console.error("Error in updating briefing:", error);
      console.log("Gracefully exiting...");
      return;
    }

    console.log("Successfully posted summary to Telegram");
  } catch (error) {
    console.error("Error in PostToTelegram function:", error);
    throw error;
  }
};
