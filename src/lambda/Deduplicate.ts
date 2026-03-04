import { EventBridgeHandler } from "aws-lambda";
import { uploadJSON, downloadJSON } from "../storage";
import { deduplicate } from "../ai/deduplicate";
import {
  CollectedNewsDataSchema,
  SimplifiedNewsWithMetadata,
  CollectedNewsDataEvent,
} from "../types";
import { getBriefing, updateBriefingDeduplicated } from "../db/BriefingEntity";
import { getCurrentUsage, resetCurrentUsage } from "../ai/getLLMProvider";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

const eventBridgeClient = new EventBridgeClient({
  region: process.env.AWS_REGION || "us-east-1",
});

export const handler: EventBridgeHandler<
  "NewsCollected",
  CollectedNewsDataEvent,
  void
> = async (event) => {
  console.log("Received EventBridge event:", JSON.stringify(event));

  try {
    console.log("Starting deduplication for:", event.time);

    const key = `collected-news/${event.detail.date}.json`;
    console.log(`Processing object: ${key}`);

    // Download cached data from storage
    const content = await downloadJSON<unknown>(key);
    const collectedNews = CollectedNewsDataSchema.parse(content);

    const briefing = await getBriefing(collectedNews.date);
    if (!briefing) {
      throw new Error(`Briefing ${collectedNews.date} not found in database`);
    }
    if (briefing.deduplicatedTime !== undefined) {
      throw new Error(`Briefing ${collectedNews.date} already deduplicated`);
    }

    resetCurrentUsage();

    const deduplicatedNews = await deduplicate(collectedNews.newsItems);
    const processedNews: SimplifiedNewsWithMetadata = {
      items: deduplicatedNews,
      numberOfPosts: collectedNews.numberOfPosts,
      numberOfSources: collectedNews.numberOfSources,
      date: collectedNews.date,
    };
    // Upload to storage with date as key
    const storageKey = key.replace("collected-news", "deduplicated-news");

    await uploadJSON(storageKey, processedNews);
    await updateBriefingDeduplicated({
      date: collectedNews.date,
      deduplicatedTime: new Date(),
      deduplicatedUsage: getCurrentUsage(),
    });

    await eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: process.env.BUS_NAME,
            Source: "news.deduplication",
            DetailType: "NewsDeduplicated",
            Detail: JSON.stringify({ date: collectedNews.date }),
          },
        ],
      }),
    );
    console.log(`Successfully uploaded news data: ${storageKey}`);
  } catch (error) {
    console.error("Error in Deduplicate function:", error);
    throw error;
  }
};
