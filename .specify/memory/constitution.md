<!--
  Sync Impact Report
  ==================
  Version change: N/A (initial) → 1.0.0
  Modified principles: N/A (first ratification)
  Added sections:
    - Core Principles (4): Code Quality, Testing Standards,
      UX Consistency, Performance Requirements
    - Ràng Buộc Kỹ Thuật (Technical Constraints)
    - Quy Trình Phát Triển (Development Workflow)
    - Governance
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ no update needed
      (Constitution Check section is dynamically filled)
    - .specify/templates/spec-template.md ✅ no update needed
      (requirements/success criteria align with principles)
    - .specify/templates/tasks-template.md ✅ no update needed
      (test phases and quality gates align with principles)
    - .specify/templates/commands/*.md ✅ directory does not exist
  Follow-up TODOs: None
-->

# Talkie Constitution

## Core Principles

### I. Chất Lượng Code (Code Quality)

Mọi code được merge vào nhánh chính PHẢI đạt các tiêu chuẩn sau:

- **Type Safety**: PHẢI sử dụng strict typing. KHÔNG được dùng
  `as any`, `@ts-ignore`, hoặc `@ts-expect-error` để suppress lỗi.
  Mọi type error PHẢI được sửa tại gốc vấn đề.
- **Linting & Formatting**: Mọi code PHẢI pass toàn bộ linting rules
  và formatting rules đã cấu hình. KHÔNG có exception trừ khi được
  document rõ ràng lý do trong code review.
- **Clean Code**: Functions PHẢI có single responsibility. Tên biến
  và hàm PHẢI mô tả rõ mục đích. KHÔNG duplicate logic — extract
  thành shared utility hoặc module.
- **Error Handling**: KHÔNG được có empty catch blocks. Mọi error
  PHẢI được handle có chủ đích: log, propagate, hoặc recover.
  Error messages PHẢI cung cấp đủ context để debug.
- **Code Review**: Mọi thay đổi PHẢI qua code review trước khi merge.
  Reviewer PHẢI verify compliance với constitution này.

### II. Tiêu Chuẩn Testing (Testing Standards)

Testing là yêu cầu bắt buộc, không phải tuỳ chọn:

- **Test Coverage**: Mọi feature mới PHẢI có test đi kèm.
  Business logic PHẢI đạt tối thiểu 80% branch coverage.
- **Test Pyramid**: Tuân thủ test pyramid — nhiều unit tests,
  vừa phải integration tests, ít end-to-end tests. Unit tests
  PHẢI chạy nhanh (< 5 giây cho toàn bộ unit test suite).
- **Test Quality**: Tests PHẢI test behavior, KHÔNG test
  implementation details. Mỗi test PHẢI có tên mô tả rõ
  scenario đang test. KHÔNG dùng test names chung chung
  như "test1", "should work".
- **Regression Testing**: Mọi bug fix PHẢI kèm theo regression test
  chứng minh bug đã được sửa. Test này PHẢI fail trước khi
  apply fix và pass sau khi fix.
- **Test Independence**: Tests PHẢI chạy độc lập, không phụ thuộc
  vào thứ tự thực thi hoặc shared mutable state giữa các tests.

### III. Nhất Quán Trải Nghiệm Người Dùng (UX Consistency)

Trải nghiệm người dùng PHẢI nhất quán và dễ dự đoán:

- **Design System**: Mọi UI component PHẢI tuân thủ design system
  đã định nghĩa. KHÔNG tạo one-off styles hoặc custom components
  khi đã có component tương đương trong design system.
- **Interaction Patterns**: Các hành động tương tự PHẢI có behavior
  tương tự xuyên suốt ứng dụng. Ví dụ: mọi form PHẢI có cùng
  validation flow, cùng error display pattern, cùng loading state.
- **Accessibility**: PHẢI đảm bảo tối thiểu WCAG 2.1 Level AA.
  Keyboard navigation, screen reader support, và color contrast
  PHẢI được test cho mọi feature mới.
- **Localization**: Talkie hỗ trợ đa ngôn ngữ. Mọi user-facing
  text PHẢI được externalize qua i18n system. KHÔNG hard-code
  strings trực tiếp trong components.
- **Error States & Feedback**: Mọi thao tác của người dùng PHẢI
  có feedback rõ ràng: loading indicators cho async operations,
  success/error notifications, và graceful degradation khi
  offline hoặc gặp lỗi.

### IV. Yêu Cầu Hiệu Năng (Performance Requirements)

Sản phẩm real-time đòi hỏi hiệu năng cao là bắt buộc:

- **Latency**: Transcript hiển thị PHẢI có độ trễ tối đa 500ms
  từ khi nhận audio. UI interactions PHẢI respond trong 100ms.
  API responses PHẢI trả về trong 200ms (p95).
- **Bundle Size**: Frontend bundle PHẢI được tối ưu. Lazy loading
  PHẢI được áp dụng cho mọi route và heavy components.
  KHÔNG import toàn bộ library khi chỉ dùng một phần.
- **Memory**: Ứng dụng PHẢI không có memory leaks. Mọi
  subscriptions, event listeners, và timers PHẢI được cleanup
  đúng cách. Memory usage PHẢI ổn định trong sessions kéo dài
  (> 2 giờ họp liên tục).
- **Real-time Processing**: Audio streaming và transcript
  processing PHẢI handle concurrent sessions mà không degradation.
  WebSocket connections PHẢI có reconnection logic với
  exponential backoff.
- **Monitoring**: Performance metrics PHẢI được track trong
  production. Bao gồm: response times, error rates, memory
  usage, và WebSocket connection stability. Alerts PHẢI được
  cấu hình cho khi metrics vượt ngưỡng cho phép.

## Ràng Buộc Kỹ Thuật (Technical Constraints)

- **Dependencies**: PHẢI ưu tiên sử dụng thư viện đã có trong
  project trước khi thêm dependency mới. Mọi dependency mới
  PHẢI được justify trong pull request description.
- **Security**: Mọi user input PHẢI được sanitize. Authentication
  tokens PHẢI có expiration. Sensitive data PHẢI được encrypt
  at rest và in transit. KHÔNG log sensitive information.
- **Backward Compatibility**: API changes PHẢI backward compatible
  trừ khi có migration plan rõ ràng và được approve. Breaking
  changes PHẢI được communicate trước ít nhất 1 sprint.
- **Documentation**: Mọi public API, complex business logic, và
  architectural decisions PHẢI được document. Code comments
  giải thích "tại sao" (why), không phải "cái gì" (what).

## Quy Trình Phát Triển (Development Workflow)

- **Branch Strategy**: Mỗi feature/bugfix PHẢI được phát triển
  trên branch riêng. Branch name PHẢI theo format:
  `feature/[short-description]` hoặc `fix/[short-description]`.
- **Commit Messages**: Tuân thủ Conventional Commits format.
  Mỗi commit PHẢI có scope rõ ràng. Ví dụ:
  `feat(transcript): add real-time translation support`.
- **Quality Gates**: Trước khi merge, PHẢI pass: linting,
  type checking, unit tests, integration tests (nếu có),
  và build thành công. CI pipeline PHẢI enforce tất cả gates.
- **Incremental Delivery**: Features PHẢI được chia thành
  increments nhỏ, có thể deliver và test độc lập. Mỗi
  increment PHẢI mang lại giá trị cho người dùng hoặc
  tạo nền tảng rõ ràng cho increment tiếp theo.

## Governance

Constitution này là tài liệu cao nhất quy định tiêu chuẩn
phát triển cho Talkie. Mọi quy trình, code review, và
technical decisions PHẢI tuân thủ các nguyên tắc trong này.

- **Tuân thủ**: Mọi pull requests và code reviews PHẢI
  verify compliance với constitution. Violations PHẢI được
  flag và sửa trước khi merge.
- **Sửa đổi**: Thay đổi constitution yêu cầu: (1) document
  rõ lý do thay đổi, (2) review và approve bởi tech lead,
  (3) migration plan cho code hiện tại nếu cần.
- **Versioning**: Constitution tuân thủ Semantic Versioning:
  MAJOR cho thay đổi incompatible, MINOR cho thêm nguyên tắc
  mới, PATCH cho clarifications và sửa lỗi chính tả.
- **Review định kỳ**: Constitution PHẢI được review mỗi quý
  để đảm bảo vẫn phù hợp với direction của sản phẩm.

**Version**: 1.0.0 | **Ratified**: 2026-04-04 | **Last Amended**: 2026-04-04
