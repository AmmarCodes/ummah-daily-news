import { EventBridgeHandler } from "aws-lambda";
import { downloadJSON, uploadJSON } from "../storage";
import { summarize } from "../ai/summarize";
import {
  ProcessedNews,
  SimplifiedNewsWithMetadataSchema,
  DeduplicatedNewsDataEvent,
} from "../types";
import {
  getBriefing,
  updateBriefingSummarizedTime,
} from "../db/BriefingEntity";
import { getCurrentUsage, resetCurrentUsage } from "../ai/getLLMProvider";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

const eventBridgeClient = new EventBridgeClient({
  region: process.env.AWS_REGION || "us-east-1",
});

export const handler: EventBridgeHandler<
  "NewsDeduplicated",
  DeduplicatedNewsDataEvent,
  void
> = async (event) => {
  console.log("Received EventBridge event:", JSON.stringify(event));

  try {
    console.log("Starting summarization for:", event.time);

    // Extract storage details from EventBridge event
    const key = `deduplicated-news/${event.detail.date}.json`;

    console.log(`Processing storage object: ${key}`);

    // Download cached data from storage
    const content = await downloadJSON<unknown>(key);
    const deduplicatedNews = SimplifiedNewsWithMetadataSchema.parse(content);
    const briefing = await getBriefing(deduplicatedNews.date);

    if (!briefing) {
      throw new Error(
        `Briefing ${deduplicatedNews.date} not found in database`,
      );
    }
    if (briefing.summarizedTime !== undefined) {
      throw new Error(`Briefing ${deduplicatedNews.date} already summarized`);
    }

    resetCurrentUsage();

    const summarizedNews = await summarize(
      deduplicatedNews.items.map(
        (item) => `${item.text}\n\n${item.sources.join("\n")}`,
      ),
    );
    const processedNews: ProcessedNews = {
      newsResponse: summarizedNews,
      numberOfPosts: deduplicatedNews.numberOfPosts,
      numberOfSources: deduplicatedNews.numberOfSources,
      date: deduplicatedNews.date,
    };
    const storageKey = key.replace("deduplicated-news", "summarized-news");

    // Upload to storage (S3 in Lambda, R2 in Workers)
    await uploadJSON(storageKey, processedNews);
    await updateBriefingSummarizedTime({
      date: deduplicatedNews.date,
      summarizedTime: new Date(),
      summarizedUsage: getCurrentUsage(),
    });

    await eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: process.env.BUS_NAME,
            Source: "news.summarization",
            DetailType: "NewsSummarized",
            Detail: JSON.stringify({ date: deduplicatedNews.date }),
          },
        ],
      }),
    );

    console.log(`Successfully uploaded news data to storage: ${storageKey}`);
  } catch (error) {
    console.error("Error in Summarize function:", error);
    throw error;
  }
};
