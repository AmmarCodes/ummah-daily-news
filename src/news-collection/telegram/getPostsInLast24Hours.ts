import { getEpochSecondsMostRecent_11_PM_InDamascus } from "../../utils/dateUtils";
import { ChannelConfig } from "../../types";
import { getPostsForAllChannels } from "./telegramScraper";
import channelsConfig from "../../../channels.json";

export function loadChannelConfig(): ChannelConfig {
  try {
    return channelsConfig as ChannelConfig;
  } catch (error) {
    console.error(
      "Error loading channels.json, falling back to SANA only:",
      error,
    );
    return { channels: [{ handle: "sana_gov", name: "" }] };
  }
}

export async function getPostsInLast24Hours(
  specifiedDate?: Date,
): Promise<Record<string, string[]>> {
  console.log("Getting posts in last 24 hours...");
  const channels = loadChannelConfig();

  const latestEpoch = getEpochSecondsMostRecent_11_PM_InDamascus(specifiedDate);
  const latestDate = new Date(latestEpoch * 1000);
  const earliestEpoch = latestEpoch - 60 * 60 * 24;
  const earliestDate = new Date(earliestEpoch * 1000);

  const allPostsDictionary = await getPostsForAllChannels(
    channels.channels.map((channel) => channel.handle),
    earliestDate,
    latestDate,
  );

  return allPostsDictionary;
}
