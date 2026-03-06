import type { SimplifiedNewsItem } from "../types";

const SHOULD_SKIP_FILE_OPS = !process.env.DEDUPE_OUTPUT_FOLDER;

export async function writeJSON<T>(data: T, filePath: string): Promise<void> {
  if (SHOULD_SKIP_FILE_OPS) {
    return;
  }

  try {
    // Dynamic import to avoid build errors in Workers environment
    const fs = await import("node:fs/promises");
    const jsonString = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonString, "utf-8");
  } catch (error) {
    // Silently fail if file operations are not available
    console.error("Failed to write to file:", error);
  }
}

export async function writeNewsToFile(
  items: (SimplifiedNewsItem | string)[],
  type: "input" | "output",
  roundNumber: number,
  batchNumber?: number,
  folder?: string,
): Promise<void> {
  if (SHOULD_SKIP_FILE_OPS) {
    return;
  }

  const outputFolder = folder || process.env.DEDUPE_OUTPUT_FOLDER;
  if (!outputFolder) {
    return;
  }
  const batchName = `${String(roundNumber).padStart(2, "0")}-${String(batchNumber || "00").padStart(2, "0")}-${type}.json`;
  const outputPath = `${outputFolder}/${batchName}`;

  await writeJSON(items, outputPath);
}
