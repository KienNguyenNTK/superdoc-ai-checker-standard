import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const outputDir = path.join(projectRoot, "examples");
const spellingSamplePath = path.join(outputDir, "sample-spelling-review.docx");
const consistencySamplePath = path.join(outputDir, "sample-consistency-100-pages.docx");

function createSpellingSample() {
  return new Document({
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
}

function createLongConsistencySample() {
  const children = [];

  for (let page = 1; page <= 100; page += 1) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: `Chương ${page}: SuperDoc Consistency Review`,
            bold: true,
          }),
        ],
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "SuperDoc",
            bold: true,
          }),
          new TextRun({
            text: " là document engine phục vụ người dùng doanh nghiệp trong hệ sinh thái OpenAI.",
          }),
        ],
      })
    );

    const unboldProductName = page % 7 === 0 ? "SuperDoc" : "";
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Trang ${page}: chúng tôi `,
          }),
          new TextRun({
            text:
              page % 5 === 0
                ? "bọn mình"
                : "chúng tôi",
          }),
          new TextRun({
            text:
              page % 9 === 0
                ? ` đang dùng công cụ tài liệu để hỗ trợ bạn và ${unboldProductName} đôi lúc mất định dạng.`
                : " đang dùng bộ máy tài liệu để hỗ trợ người dùng và giữ định dạng nhất quán.",
          }),
        ],
      })
    );

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: page % 6 === 0 ? "Open Ai" : "OpenAI",
                        bold: page % 4 !== 0,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: page % 8 === 0 ? "10 phần trăm" : "10%",
                        italic: page % 10 === 0,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    children.push(
      new Paragraph(
        `Dòng kiểm thử ${page}: hệ thông cần kiễm tra chính tã, hổ trợ comment, track changes và reviewed-consistency.docx.`
      )
    );

    if (page < 100) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  return new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
}

await mkdir(outputDir, { recursive: true });
await writeFile(spellingSamplePath, await Packer.toBuffer(createSpellingSample()));
await writeFile(consistencySamplePath, await Packer.toBuffer(createLongConsistencySample()));

console.log(spellingSamplePath);
console.log(consistencySamplePath);
