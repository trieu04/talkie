<!--
=== Sync Impact Report ===
- Version: N/A → 1.0.0 (khởi tạo lần đầu)
- Nguyên tắc được thêm:
  - I. Chất Lượng Mã Nguồn
  - II. Tiêu Chuẩn Kiểm Thử
  - III. Nhất Quán Trải Nghiệm Người Dùng
  - IV. Yêu Cầu Hiệu Năng
- Mục được thêm:
  - Ràng Buộc Kỹ Thuật
  - Quy Trình Phát Triển
  - Quản Trị
- Mục bị xoá: Không có
- Templates cần cập nhật:
  - .specify/templates/plan-template.md ✅ không cần thay đổi
    (Constitution Check tham chiếu động từ file constitution)
  - .specify/templates/spec-template.md ✅ không cần thay đổi
    (Cấu trúc requirements/acceptance criteria tương thích)
  - .specify/templates/tasks-template.md ✅ không cần thay đổi
    (Phân loại task theo user story, tương thích với nguyên tắc)
  - .specify/templates/commands/*.md ✅ không tồn tại
- TODO chưa giải quyết: Không có
========================
-->

# Talkie Constitution

## Nguyên Tắc Cốt Lõi

### I. Chất Lượng Mã Nguồn

Mọi mã nguồn trong dự án Talkie PHẢI tuân thủ các quy tắc sau:

- **Không chấp nhận type suppression**: TUYỆT ĐỐI KHÔNG sử dụng
  `as any`, `@ts-ignore`, `@ts-expect-error`, hoặc bất kỳ cách
  nào để bỏ qua lỗi kiểu dữ liệu. Mọi lỗi type PHẢI được sửa
  tại gốc.
- **Lint và format bắt buộc**: Mọi code PHẢI pass linter và
  formatter đã cấu hình trước khi merge. Không có ngoại lệ.
- **Nguyên tắc Single Responsibility**: Mỗi module, function,
  và component CHỈ đảm nhận một trách nhiệm duy nhất. Function
  vượt quá 50 dòng PHẢI được tách nhỏ hoặc có justification
  rõ ràng.
- **Xử lý lỗi nghiêm ngặt**: KHÔNG có catch block rỗng.
  Mọi lỗi PHẢI được xử lý cụ thể hoặc propagate lên với
  context đầy đủ.
- **Đặt tên rõ ràng**: Tên biến, function, và file PHẢI
  truyền đạt mục đích sử dụng. Không viết tắt trừ các thuật
  ngữ phổ biến (e.g., `id`, `url`, `api`).
- **Code review bắt buộc**: Mọi thay đổi PHẢI được review
  trước khi merge vào nhánh chính.

**Lý do**: Talkie là sản phẩm realtime — mã nguồn kém chất
lượng trực tiếp gây crash hoặc lỗi âm thầm trong cuộc họp,
ảnh hưởng tới trải nghiệm người dùng ngay lập tức.

### II. Tiêu Chuẩn Kiểm Thử

Mọi tính năng trong Talkie PHẢI có kiểm thử đi kèm:

- **Unit test bắt buộc cho business logic**: Mọi service,
  utility function, và data transformation PHẢI có unit test
  với coverage tối thiểu 80% cho logic branches.
- **Integration test cho luồng chính**: Mỗi user story PHẢI
  có ít nhất một integration test xác minh luồng end-to-end
  hoạt động đúng.
- **Test PHẢI có tính độc lập**: Mỗi test case PHẢI chạy
  độc lập, không phụ thuộc vào thứ tự thực thi hoặc state
  từ test khác.
- **Test PHẢI fail trước khi implement**: Khi viết test cho
  tính năng mới, test PHẢI fail trước (Red), sau đó mới
  implement để pass (Green), rồi refactor.
- **Không xoá test để pass**: TUYỆT ĐỐI KHÔNG xoá hoặc
  skip test đang fail để "đạt" CI. Test fail PHẢI được sửa
  hoặc có issue tracking rõ ràng.
- **Edge case cho realtime**: Các tính năng liên quan đến
  audio streaming, transcript, và translation PHẢI test với
  các điều kiện: mất kết nối, độ trễ cao, dữ liệu không
  hợp lệ, và concurrent sessions.

**Lý do**: Talkie xử lý audio và text realtime — bug không
được phát hiện sớm sẽ gây mất dữ liệu transcript của
người dùng, không thể khôi phục.

### III. Nhất Quán Trải Nghiệm Người Dùng

Mọi giao diện và tương tác trong Talkie PHẢI nhất quán:

- **Design system bắt buộc**: Mọi component UI PHẢI sử
  dụng design tokens (colors, spacing, typography) từ
  design system chung. KHÔNG hardcode giá trị style.
- **Hành vi tương tác đồng nhất**: Cùng một loại thao
  tác (click, swipe, drag) PHẢI cho kết quả giống nhau
  trên toàn bộ ứng dụng. Không có ngoại lệ trừ khi
  có justification UX rõ ràng.
- **Trạng thái loading và error**: Mọi thao tác async
  PHẢI hiển thị trạng thái loading. Mọi lỗi PHẢI có
  thông báo rõ ràng bằng ngôn ngữ người dùng hiểu được,
  kèm hướng dẫn khắc phục nếu có thể.
- **Hỗ trợ đa ngôn ngữ**: Mọi chuỗi hiển thị cho
  người dùng PHẢI đi qua hệ thống i18n. KHÔNG hardcode
  text trực tiếp trong component.
- **Accessibility cơ bản**: Mọi element tương tác PHẢI
  có label phù hợp. Contrast ratio PHẢI đạt WCAG AA
  (tối thiểu 4.5:1 cho text thường).
- **Responsive và adaptive**: Giao diện PHẢI hoạt động
  chính xác trên các kích thước màn hình phổ biến
  (mobile, tablet, desktop).

**Lý do**: Talkie được sử dụng trong cuộc họp — người
dùng không có thời gian để "tìm hiểu" giao diện. Mọi
thao tác PHẢI trực quan và nhất quán.

### IV. Yêu Cầu Hiệu Năng

Talkie xử lý dữ liệu realtime, hiệu năng là yêu cầu
bắt buộc, không phải tối ưu hoá sau:

- **Độ trễ transcript**: Từ lúc người dùng nói đến lúc
  text hiển thị KHÔNG ĐƯỢC vượt quá 2 giây (p95) trong
  điều kiện mạng bình thường.
- **Độ trễ translation**: Bản dịch PHẢI hiển thị trong
  vòng 3 giây (p95) sau khi transcript gốc xuất hiện.
- **Thời gian khởi động**: Ứng dụng PHẢI sẵn sàng sử
  dụng trong vòng 3 giây sau khi mở.
- **Sử dụng bộ nhớ**: Ứng dụng client KHÔNG ĐƯỢC sử
  dụng quá 200MB RAM trong session bình thường (cuộc
  họp dưới 2 giờ).
- **Không memory leak**: Mọi component và subscription
  PHẢI được cleanup đúng cách. Memory usage KHÔNG ĐƯỢC
  tăng liên tục theo thời gian session.
- **Bundle size**: JavaScript bundle cho initial load
  KHÔNG ĐƯỢC vượt quá 300KB (gzipped). Sử dụng code
  splitting cho các tính năng không thiết yếu.
- **Đo lường bắt buộc**: Mọi API endpoint PHẢI có
  metric đo latency (p50, p95, p99). Mọi thay đổi
  ảnh hưởng performance PHẢI có benchmark trước và sau.

**Lý do**: Sản phẩm realtime có độ trễ cao đồng nghĩa
với sản phẩm hỏng. Người dùng trong cuộc họp cần
transcript tức thời — mỗi giây trễ thêm là mỗi giây
mất thông tin.

## Ràng Buộc Kỹ Thuật

Các ràng buộc kỹ thuật bổ sung áp dụng cho toàn bộ dự án:

- **Dependency management**: Ưu tiên sử dụng thư viện
  đã có trong dự án trước khi thêm dependency mới. Mọi
  dependency mới PHẢI được justify trong PR description.
- **Bảo mật dữ liệu cuộc họp**: Nội dung transcript và
  audio PHẢI được mã hoá khi truyền tải (TLS) và khi lưu
  trữ (encryption at rest). KHÔNG log nội dung cuộc họp
  vào hệ thống logging chung.
- **Backward compatibility**: API changes KHÔNG ĐƯỢC break
  client cũ. Sử dụng versioning hoặc deprecation period
  tối thiểu 2 sprint trước khi loại bỏ endpoint/field.
- **Structured logging**: Mọi log PHẢI ở dạng structured
  (JSON) với các field bắt buộc: timestamp, level,
  service, correlation_id.

## Quy Trình Phát Triển

Quy trình phát triển áp dụng cho mọi thành viên:

- **Branch strategy**: Mỗi tính năng/bugfix PHẢI được
  phát triển trên branch riêng từ nhánh chính.
- **PR requirements**: Mọi PR PHẢI có description rõ ràng,
  pass CI (lint + test + build), và được ít nhất 1 người
  review approve.
- **Commit messages**: Sử dụng conventional commits format
  (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `perf:`).
- **Kiểm tra constitution**: Mọi PR review PHẢI xác minh
  rằng thay đổi tuân thủ các nguyên tắc trong constitution
  này. Reviewer có quyền reject nếu vi phạm.
- **Hotfix process**: Bugfix critical trong production PHẢI
  được sửa tối thiểu (minimal fix), KHÔNG refactor kèm theo.
  Refactor PHẢI được thực hiện trong PR riêng sau đó.

## Quản Trị

Constitution này có hiệu lực cao nhất trong dự án Talkie,
vượt trên mọi quy ước không chính thức khác.

- **Sửa đổi**: Mọi thay đổi constitution PHẢI được đề xuất
  dưới dạng PR, có mô tả lý do thay đổi, và được team lead
  approve. Thay đổi PHẢI bao gồm cập nhật version theo
  semantic versioning.
- **Versioning**:
  - MAJOR: Xoá hoặc thay đổi căn bản nguyên tắc hiện có
  - MINOR: Thêm nguyên tắc mới hoặc mở rộng đáng kể
  - PATCH: Sửa từ ngữ, làm rõ, sửa lỗi chính tả
- **Compliance review**: Mỗi sprint retrospective PHẢI bao
  gồm đánh giá mức độ tuân thủ constitution. Vi phạm lặp
  lại PHẢI có action item cụ thể.
- **Tài liệu hướng dẫn**: Sử dụng các template trong
  `.specify/templates/` cho spec, plan, và tasks để đảm bảo
  tính nhất quán với constitution.

**Version**: 1.0.0 | **Ratified**: 2026-04-04 | **Last Amended**: 2026-04-04
