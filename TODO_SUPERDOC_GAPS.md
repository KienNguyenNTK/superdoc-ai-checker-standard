# TODO SuperDoc Gaps

Các mục dưới đây đã được ghi rõ fallback trong source, không bịa thêm API ngoài bản SDK hiện dùng:

1. `Ignore issue` hiện resolve comment và reject tracked change, nhưng chưa remove permanent highlight khỏi `reviewed.docx`.
2. Focus issue ở frontend đang fallback qua `search/goToSearchResult`; chưa có temporary highlight UI 2-3 giây độc lập với search highlight.
3. Sidebar `Comments` dùng kết hợp card custom và built-in comments surface; chưa đồng bộ state accept/reject sâu hơn với custom filter.
4. `applyIssue` khi issue chưa có tracked change sẽ replace trực tiếp để chốt kết quả; nếu muốn luôn tạo tracked change rồi accept sau cần tách riêng UX `Suggest` và `Apply`.
5. Backend đang ưu tiên `doc.extract()` cho body/table cell; chưa thêm reader riêng cho header/footer/list block path chi tiết.
6. Chưa có endpoint riêng để accept/reject trực tiếp theo `changeId`; hiện flow đi qua `issueId`.
7. Chưa thêm persistence DB; session hiện lưu file + JSON dưới `storage/documents/`.
