import { fetchAndParseHTML } from "./browser";

export async function extractSANAArticleContent(url: string) {
  console.log(`🔍 Extracting article from ${url.replace("https://", "")}`);

  try {
    const document = await fetchAndParseHTML(url);

    const titleElement = document.querySelector("h1.s-title");
    const title = titleElement?.textContent?.trim() || "";

    const paragraphElements = document.querySelectorAll(
      ".entry-content.rbct p",
    );
    const paragraphs = Array.from(paragraphElements);
    const body = paragraphs
      .map((p) => (p as any).textContent?.trim().replace(/\s+/g, " ") || "")
      .filter((text) => text.length > 0)
      .join("\n\n");
    return { title, body };
  } catch (error) {
    console.error(
      `Failed to extract from ${url}, falling back to original content. Error:`,
      error,
    );
    return undefined;
  }
}
