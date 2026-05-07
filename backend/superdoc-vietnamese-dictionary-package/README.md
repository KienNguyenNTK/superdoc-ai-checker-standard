# SuperDoc Vietnamese Dictionary Sample

Bộ này dùng để làm **custom dictionary / allowlist** cho SuperDoc AI DOCX Checker.

## Nguồn dữ liệu

- Source: duyet/vietnamese-wordlist `Viet74K.txt`
- Repo: https://github.com/duyet/vietnamese-wordlist
- License: GPL-2.0
- Số dòng gốc: 73,160
- Số mục normalize lower-case: 72,515
- Từ đơn: 8,810
- Cụm từ: 63,705

## File trong gói

- `vietnamese-dictionary-74k.txt`: wordlist gốc, giữ nguyên hoa/thường.
- `vietnamese-dictionary-74k-normalized.txt`: bản lower-case để check nhanh.
- `superdoc-vietnamese-dictionary.json`: JSON đầy đủ để backend load.
- `superdoc-custom-dictionary.sample.json`: mẫu nhẹ hơn, có preserveTerms cho dự án SuperDoc.
- `load-custom-dictionary.ts`: ví dụ code TypeScript để load dictionary.

## Cách dùng khuyến nghị

Không nên nhét toàn bộ 74k từ vào prompt LLM vì rất tốn token. Nên dùng theo pipeline:

1. Backend load dictionary vào `Set<string>`.
2. Rule engine dùng dictionary để lọc lỗi chính tả rõ ràng.
3. LLM chỉ nhận danh sách `CUSTOM_DICTIONARY` nhỏ gồm tên riêng/thuật ngữ trong tài liệu.
4. Với lỗi không chắc chắn, trả `needs_review` thay vì tự sửa.

## Lưu ý quan trọng

Đây là allowlist, không phải bộ kiểm tra ngữ pháp hoàn chỉnh. Một từ có trong từ điển vẫn có thể sai ngữ cảnh.
Ví dụ: `sử dụng` đúng, nhưng `xử dụng` sai; hoặc `hổ trợ` có thể xuất hiện trong dữ liệu nhưng trong văn chuẩn thường cần sửa thành `hỗ trợ`.

Vì vậy SuperDoc vẫn nên có tầng kiểm tra ngữ cảnh bằng rule + LLM.
