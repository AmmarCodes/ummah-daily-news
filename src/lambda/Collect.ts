import { ScheduledHandler } from "aws-lambda";
import { collect } from "../news-collection/collect";
import { CollectedNewsData } from "../types";
import {
  formatDateUTCPlus3,
  getEpochSecondsMostRecent_11_PM_InDamascus,
} from "../utils/dateUtils";
import {
  initializeBriefing,
  updateBriefingCollectedTime,
} from "../db/BriefingEntity";
import { uploadJSON } from "../storage";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

const eventBridgeClient = new EventBridgeClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const ONE_MINUTE_MILLISECONDS = 60 * 1000;

export const handler: ScheduledHandler = async (event) => {
  try {
    const date = event.time ? new Date(event.time) : new Date();
    // render the date portion of the date to YYYY-MM-DD in Damascus timezone
    const lastMidnightInDamascus =
      getEpochSecondsMostRecent_11_PM_InDamascus(date) * 1000;
    const damascusDate = formatDateUTCPlus3(
      new Date(lastMidnightInDamascus - ONE_MINUTE_MILLISECONDS), // 1 minute before midnight, this is to get the previous day's date
    );

    await initializeBriefing({ date: damascusDate });

    console.log("Starting news collection for:", date);

    const collectedNews = await collect(date);
    const collectedNewsWithDate: CollectedNewsData = {
      ...collectedNews,
      date: damascusDate,
    };
    // Upload to storage (S3 in Lambda, R2 in Workers) with date as key
    const s3Key = `collected-news/${damascusDate}.json`;

    await uploadJSON(s3Key, collectedNewsWithDate);

    await updateBriefingCollectedTime({
      date: damascusDate,
      collectedTime: new Date(),
    });

    await eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: process.env.BUS_NAME,
            Source: "news.collection",
            DetailType: "NewsCollected",
            Detail: JSON.stringify({ date: damascusDate }),
          },
        ],
      }),
    );
    console.log(`Successfully uploaded news data: ${s3Key}`);
  } catch (error) {
    console.error("Error in Collect function:", error);
    throw error;
  }
};
