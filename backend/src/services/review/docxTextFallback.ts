import { readFile, writeFile } from "node:fs/promises";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Issue } from "../../domain/types.js";

function findParagraphByBlockId(xml: Document, blockId: string) {
  const paragraphs = Array.from(xml.getElementsByTagName("w:p"));
  return paragraphs.find((paragraph) => {
    const paraId = paragraph.getAttribute("w14:paraId") || paragraph.getAttribute("w:paraId");
    return paraId === blockId;
  });
}

export async function applyTextIssueXmlFallback(
  sourcePath: string,
  outPath: string,
  issue: Issue,
  replacementText: string
): Promise<boolean> {
  if (
    typeof issue.location.startOffset !== "number" ||
    typeof issue.location.endOffset !== "number" ||
    !issue.location.blockId
  ) {
    return false;
  }

  const buffer = await readFile(sourcePath);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = zip.file("word/document.xml");
  if (!documentXml) return false;

  const rawXml = await documentXml.async("string");
  const parsed = new DOMParser().parseFromString(rawXml, "application/xml");
  const paragraph = findParagraphByBlockId(parsed, issue.location.blockId);
  if (!paragraph) return false;

  const textNodes = Array.from(paragraph.getElementsByTagName("w:t"));
  let offset = 0;

  for (const node of textNodes) {
    const text = node.textContent || "";
    const start = offset;
    const end = offset + text.length;
    offset = end;

    if (
      issue.location.startOffset >= start &&
      issue.location.endOffset <= end
    ) {
      const localStart = issue.location.startOffset - start;
      const localEnd = issue.location.endOffset - start;
      const current = text.slice(localStart, localEnd);
      if (current !== issue.wrong) return false;

      node.textContent =
        text.slice(0, localStart) +
        replacementText +
        text.slice(localEnd);

      zip.file("word/document.xml", new XMLSerializer().serializeToString(parsed));
      const nextBuffer = await zip.generateAsync({ type: "nodebuffer" });
      await writeFile(outPath, nextBuffer);
      return true;
    }
  }

  return false;
}
