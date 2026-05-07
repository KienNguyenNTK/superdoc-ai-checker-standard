# TODO SuperDoc Gaps

Các mục dưới đây phản ánh đúng phạm vi SDK SuperDoc đã được xác minh trong repo này. Chỗ nào chưa có hỗ trợ ổn định đều đã fallback hoặc chỉ comment/TODO, không bịa API.

1. `doc.extract()` hiện chỉ cho block-level structure/text ổn định; run formatting phải hydrate thêm qua `doc.getNodeById()`.
2. Reader hiện support tốt nhất cho `body` và `tableCell`; `header/footer/list/footnote` chưa có mapping path/run ổn định từ SDK nên mới fallback/TODO.
3. `Ignore issue` hiện resolve comment và reject tracked change, nhưng chưa remove permanent highlight khỏi `reviewed-consistency.docx`.
4. Focus issue ở frontend vẫn có fallback `search/goToSearchResult`; chưa có temporary highlight UI 2-3 giây độc lập với search highlight.
5. Format issue cố gắng dùng `doc.format.*` với `changeMode: "tracked"`, nhưng một số mutation format không luôn trả tracked change receipt ổn định; khi đó flow fallback sang comment/direct apply và ghi TODO.
6. `heading_consistency` đang ưu tiên direct formatting hoặc paragraph style khi có `styleName`; chưa có full style-clone engine cho mọi property paragraph/table style.
7. `tone_consistency` hiện mặc định comment-only / needs-review; chưa auto-apply vì đây là semantic rewrite cần người duyệt.
8. Prompt Settings hiện là in-app dev/admin panel, chưa có auth/role system thực thụ.
9. Persistence vẫn là file + JSON dưới `storage/documents/` và `storage/config/`; chưa có DB multi-user.
