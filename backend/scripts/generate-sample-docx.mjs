import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const outputDir = path.join(projectRoot, "examples");
const outputPath = path.join(outputDir, "sample-spelling-review.docx");

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: "SuperDoc AI DOCX Checker - tai lieu test co chu y loi chinh ta.",
              bold: true,
            }),
          ],
        }),
        new Paragraph(
          "Chung toi luon ho tro khach hang trong qua trinh xu ly du lieu cho doi ngu SuperDoc."
        ),
        new Paragraph(
          "Doan nay co mot so loi ro rang: hổ trợ, dử liệu, va khach hang can duoc sua dung vi tri."
        ),
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph("Bang du lieu bi sai chinh ta o o nay")],
                }),
                new TableCell({
                  children: [new Paragraph("Ten rieng SuperDoc va React phai duoc giu nguyen")],
                }),
              ],
            }),
          ],
        }),
      ],
    },
  ],
});

await mkdir(outputDir, { recursive: true });
const buffer = await Packer.toBuffer(doc);
await writeFile(outputPath, buffer);
console.log(outputPath);
