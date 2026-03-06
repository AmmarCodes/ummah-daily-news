import { ProcessedNews, NewsItemLabelRelation } from "./types";

/**
 * Get the most frequent label from a list of news items.
 * Used for selecting banner category in the original deployment.
 * Maintained for compatibility.
 */
export function getMostFrequentLabel(processedNews: ProcessedNews): string {
  const items = processedNews.newsResponse.newsItems;

  if (!items || items.length === 0) {
    return "politics";
  }

  const labelCounts: Record<string, number> = {};

  items.forEach((item) => {
    if (item.labels && Array.isArray(item.labels)) {
      item.labels.forEach((labelRelation: NewsItemLabelRelation) => {
        const label = labelRelation.label;
        labelCounts[label] = (labelCounts[label] || 0) + 1;
      });
    }
  });

  let maxCount = 0;
  let mostFrequent = "politics";

  for (const [label, count] of Object.entries(labelCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostFrequent = label;
    }
  }

  return mostFrequent;
}
