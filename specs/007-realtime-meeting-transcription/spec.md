# Feature Specification: Realtime Meeting Transcription

**Feature Branch**: `007-realtime-meeting-transcription`
**Created**: 2026-04-04
**Status**: Draft
**Input**: User description: "Xây dựng ứng dụng web Talkie — ghi âm, phiên âm (transcript) và dịch thuật (translate) realtime cho cuộc họp online. Có thể tổng hợp (summary) và xem lại transcript sau cuộc họp."

## Clarifications

### Session 2026-04-04

- Q: Host có cần tài khoản để tạo meeting và xem lại history không? → A: Host cần tài khoản đơn giản; participant vẫn anonymous qua link.
- Q: Participant có cần lớp bảo vệ bổ sung để vào meeting không? → A: Ai có link hoặc mã phòng đều vào được ngay.
- Q: Participant có được xem lại transcript/summary sau khi meeting kết thúc không? → A: Participant có link hoặc mã phòng vẫn xem lại được sau meeting.
- Q: Translation được lưu theo phạm vi nào? → A: Chỉ lưu transcript gốc; translation được tạo và lưu khi có người yêu cầu.
- Q: Ngôn ngữ transcript gốc được xác định thế nào? → A: Host chọn một source language chính cho cả meeting trước khi bắt đầu.
- Q: GPU worker được cung cấp như thế nào? → A: GPU sử dụng Google Colab notebook session do user tự bật.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Host ghi âm và nhận transcript realtime (Priority: P1)

Một người dùng đã đăng nhập (host) tạo phiên họp mới, chọn một source language chính cho meeting, và bắt đầu ghi âm trực tiếp từ trình duyệt. Hệ thống thu âm tất cả âm thanh từ microphone — bao gồm cả giọng host và giọng người khác phát qua loa/speaker. Trong vài giây sau khi nói, transcript hiển thị realtime trên màn hình host. Audio thô được lưu lại trên server trong suốt quá trình ghi âm.

**Why this priority**: Đây là core value proposition của Talkie — không có ghi âm và transcript thì không có sản phẩm. Mọi feature khác đều phụ thuộc vào khả năng này.

**Independent Test**: Có thể test đầy đủ bằng cách một người dùng tạo meeting, bật ghi âm, nói vài câu, và xác nhận transcript xuất hiện trong vài giây. Deliverable: host thấy transcript realtime.

**Acceptance Scenarios**:

1. **Given** host đã đăng nhập và đang ở trang chủ, **When** host tạo phiên họp mới, chọn source language chính, và nhấn "Bắt đầu ghi âm", **Then** trình duyệt yêu cầu quyền microphone và bắt đầu thu âm sau khi được cấp quyền.
2. **Given** host đang ghi âm, **When** host nói một câu, **Then** transcript của câu đó hiển thị trên màn hình trong vòng tối đa 10 giây.
3. **Given** host đang ghi âm, **When** kết nối mạng bị gián đoạn tạm thời (< 30 giây), **Then** hệ thống tự động reconnect và tiếp tục ghi âm, không mất dữ liệu audio đã buffer.
4. **Given** host đang ghi âm, **When** host nhấn "Dừng ghi âm", **Then** hệ thống dừng thu âm, hoàn tất processing các audio chunks còn lại, và lưu toàn bộ raw audio trên server.
5. **Given** host đang ghi âm và có người khác nói qua loa, **When** âm thanh từ loa được thu qua microphone, **Then** transcript bao gồm cả nội dung từ giọng phát qua loa.

---

### User Story 2 - Participant xem transcript realtime (Priority: P2)

Người tham gia cuộc họp (không phải host) tham gia phiên họp qua link/mã phòng và xem transcript hiển thị realtime. Bất kỳ ai có link hoặc mã phòng đều có thể vào ngay. Participant không cần ghi âm — chỉ nhận và hiển thị transcript từ hệ thống.

**Why this priority**: Giá trị collaborative — nhiều người cùng theo dõi transcript realtime biến Talkie từ công cụ cá nhân thành công cụ team. Phụ thuộc vào P1 (phải có transcript trước).

**Independent Test**: Host bật ghi âm ở một trình duyệt, participant mở link phòng ở trình duyệt khác — cả hai đều thấy transcript realtime cùng lúc.

**Acceptance Scenarios**:

1. **Given** host đã tạo phiên họp và đang ghi âm, **When** participant truy cập link hoặc nhập mã phòng hợp lệ, **Then** participant vào được meeting ngay và thấy transcript đang được cập nhật realtime mà không cần thao tác phê duyệt thêm.
2. **Given** participant đang xem transcript, **When** host nói thêm một câu, **Then** câu mới xuất hiện trên màn hình participant trong vòng tối đa 10 giây (cùng latency với host).
3. **Given** participant đang xem transcript, **When** participant bị mất kết nối và reconnect, **Then** participant nhận lại toàn bộ transcript đã miss trong thời gian disconnect.
4. **Given** nhiều participants (tối thiểu 10) đang xem cùng phiên họp, **When** transcript mới xuất hiện, **Then** tất cả participants nhận được transcript với latency tương đương nhau.

---

### User Story 3 - Dịch thuật realtime (Priority: P3)

Transcript được tự động dịch sang ngôn ngữ đích ngay khi xuất hiện. Người dùng (host hoặc participant) có thể chọn ngôn ngữ dịch và thấy bản dịch song song với transcript gốc, không cần thao tác thêm cho mỗi đoạn. Transcript gốc luôn được lưu; translation chỉ được tạo và lưu cho từng ngôn ngữ khi có người yêu cầu.

**Why this priority**: Translation là value-add quan trọng cho cuộc họp đa ngôn ngữ. Phụ thuộc vào P1/P2 (phải có transcript trước khi dịch).

**Independent Test**: Host ghi âm bằng tiếng Việt, participant chọn ngôn ngữ dịch là English — transcript tiếng Việt và bản dịch English hiển thị song song.

**Acceptance Scenarios**:

1. **Given** transcript đang hiển thị realtime, **When** người dùng chọn ngôn ngữ dịch đích, **Then** bản dịch xuất hiện bên cạnh/bên dưới mỗi đoạn transcript trong vòng vài giây sau khi transcript gốc xuất hiện.
2. **Given** translation đang hoạt động, **When** một đoạn transcript mới xuất hiện, **Then** bản dịch cho đoạn đó tự động xuất hiện mà không cần thao tác thêm từ người dùng.
3. **Given** người dùng đang xem translation sang English, **When** người dùng đổi ngôn ngữ đích sang Japanese, **Then** các đoạn transcript tiếp theo được dịch sang Japanese, và các đoạn cũ vẫn giữ bản dịch English hiện tại.

---

### User Story 4 - Tổng hợp nội dung cuộc họp (Priority: P4)

Sau khi cuộc họp kết thúc (hoặc bất kỳ lúc nào theo yêu cầu), hệ thống tạo bản tổng hợp (summary) nội dung cuộc họp dựa trên transcript. Summary giúp người dùng nắm bắt nhanh các điểm chính mà không cần đọc toàn bộ transcript.

**Why this priority**: Summary là convenience feature — có giá trị cao nhưng sản phẩm vẫn hoạt động được mà không có nó. Phụ thuộc vào transcript hoàn chỉnh (P1).

**Independent Test**: Kết thúc một cuộc họp có transcript, nhấn "Tạo summary" — summary xuất hiện với các điểm chính của cuộc họp.

**Acceptance Scenarios**:

1. **Given** cuộc họp đã kết thúc và có transcript, **When** người dùng nhấn "Tạo summary", **Then** hệ thống tạo summary trong thời gian hợp lý (< 60 giây cho cuộc họp 1 giờ) và hiển thị kết quả.
2. **Given** cuộc họp đang diễn ra, **When** người dùng yêu cầu summary on-demand, **Then** hệ thống tạo summary từ transcript đã có tính đến thời điểm hiện tại.
3. **Given** summary đã được tạo, **When** người dùng xem lại, **Then** summary bao gồm các điểm chính, quyết định, và action items (nếu có) được trích xuất từ transcript.

---

### User Story 5 - Xem lại cuộc họp trước (Priority: P5)

Host đã đăng nhập truy cập danh sách các cuộc họp trước đó do mình tạo và xem lại transcript, translation, và summary. Participant có link hoặc mã phòng của meeting cũng có thể xem lại transcript, translation, và summary sau khi meeting kết thúc. Dữ liệu lịch sử được lưu trữ đầy đủ và có thể truy cập bất kỳ lúc nào.

**Why this priority**: Review là long-tail value — người dùng quay lại xem sau cuộc họp. Phụ thuộc vào tất cả features trước (P1-P4) để có dữ liệu đầy đủ.

**Independent Test**: Sau khi hoàn thành ít nhất một cuộc họp, mở trang lịch sử, chọn cuộc họp — thấy transcript, translation, summary đầy đủ.

**Acceptance Scenarios**:

1. **Given** host đã đăng nhập và đã tạo ít nhất một cuộc họp trước đó, **When** host mở trang lịch sử cuộc họp, **Then** danh sách các cuộc họp do host tạo hiển thị với thông tin: tên/ngày, thời lượng, có transcript/translation/summary hay không.
2. **Given** participant có link hoặc mã phòng của một cuộc họp đã kết thúc, **When** participant mở link hoặc nhập mã phòng đó, **Then** participant có thể xem lại transcript, translation, và summary của meeting mà không cần tài khoản.
3. **Given** người dùng đang xem một cuộc họp cũ, **When** chọn một cuộc họp cụ thể, **Then** transcript đầy đủ hiển thị với timeline, có thể cuộn và tìm kiếm nội dung.
4. **Given** người dùng đang xem transcript của cuộc họp cũ, **When** người dùng chọn xem translation, **Then** bản dịch hiển thị song song với transcript gốc bằng translation đã lưu nếu đã tồn tại, hoặc được tạo mới rồi lưu lại nếu chưa có.
5. **Given** cuộc họp cũ chưa có summary, **When** người dùng yêu cầu tạo summary, **Then** hệ thống tạo summary từ transcript đã lưu.

---

### User Story 6 - GPU Worker xử lý speech-to-text (Priority: P6)

Hệ thống hỗ trợ mô hình GPU worker phân tán — các worker chạy dưới dạng Google Colab notebook session do user tự bật, sau đó chủ động poll server để nhận audio chunks cần xử lý, chạy speech-to-text, và trả kết quả transcript về server. Nhiều notebook sessions có thể hoạt động đồng thời để tăng throughput.

**Why this priority**: Infrastructure story — cần thiết cho P1 hoạt động nhưng không trực tiếp tạo user value. Được tách riêng để có thể phát triển và scale độc lập.

**Independent Test**: Chạy một GPU worker, gửi audio chunk qua polling mechanism, nhận lại transcript text chính xác.

**Acceptance Scenarios**:

1. **Given** server có audio chunks chờ xử lý, **When** GPU worker poll server, **Then** worker nhận được audio chunk cùng metadata cần thiết (meeting ID, chunk sequence number).
2. **Given** GPU worker đã nhận audio chunk, **When** worker hoàn tất speech-to-text processing, **Then** worker gửi kết quả transcript về server và server phân phối realtime cho clients.
3. **Given** nhiều GPU workers đang hoạt động đồng thời, **When** server có nhiều audio chunks chờ xử lý, **Then** các chunks được phân phối cho workers mà không bị duplicate processing.
4. **Given** một GPU worker bị disconnect giữa chừng, **When** worker không trả kết quả trong thời gian timeout, **Then** server tự động reassign chunk đó cho worker khác.
5. **Given** user chưa tự bật Google Colab notebook session nào, **When** host bắt đầu ghi âm, **Then** audio chunks vẫn được nhận và xếp hàng chờ xử lý cho đến khi có notebook session online.

---

### Edge Cases

- Điều gì xảy ra khi không có GPU worker nào online trong khi host đang ghi âm? → Audio chunks được queue và xử lý ngay khi worker available. User thấy thông báo "đang chờ xử lý" thay vì transcript.
- Điều gì xảy ra khi user chưa bật Google Colab notebook session trước khi meeting bắt đầu? → Server vẫn nhận và lưu audio chunks, nhưng transcript/translation chỉ bắt đầu xuất hiện sau khi notebook session được user bật và poll job.
- Điều gì xảy ra khi cuộc họp kéo dài hơn 4 giờ? → Hệ thống tiếp tục hoạt động bình thường, audio được chunk và xử lý liên tục, không giới hạn thời lượng.
- Điều gì xảy ra khi host đóng trình duyệt đột ngột? → Hệ thống lưu toàn bộ dữ liệu đã nhận đến thời điểm đó. Phiên họp chuyển sang trạng thái "kết thúc bất thường" và vẫn có thể xem lại.
- Điều gì xảy ra khi chất lượng audio rất thấp (nhiều noise)? → Transcript vẫn được tạo với chất lượng tốt nhất có thể. Hệ thống không block vì audio quality.
- Điều gì xảy ra khi nhiều người nói cùng lúc? → Hệ thống transcript tất cả âm thanh thu được qua mic — không phân biệt speaker riêng lẻ (single-stream recording).
- Điều gì xảy ra khi người nói dùng ngôn ngữ khác với source language đã chọn cho meeting? → Transcript vẫn được xử lý theo source language chính của meeting; hệ thống không tự động phát hiện hoặc chuyển source language trong lúc meeting đang diễn ra.
- Điều gì xảy ra khi link hoặc mã phòng bị chia sẻ ngoài dự kiến? → Bất kỳ ai có link hoặc mã phòng hợp lệ đều có thể vào meeting ngay; đây là tradeoff được chấp nhận để tối ưu tốc độ tham gia.
- Điều gì xảy ra khi meeting đã kết thúc nhưng link hoặc mã phòng vẫn tiếp tục được chia sẻ? → Bất kỳ ai có link hoặc mã phòng hợp lệ vẫn có thể xem lại transcript, translation, và summary của meeting đó.
- Điều gì xảy ra khi người dùng mở replay và chọn một ngôn ngữ translation chưa từng được tạo trước đó? → Hệ thống tạo translation cho ngôn ngữ đó từ transcript gốc rồi lưu lại để các lần xem sau dùng lại.

## Requirements *(mandatory)*

### Functional Requirements

**Ghi âm & Streaming**
- **FR-001**: Hệ thống PHẢI cho phép host bắt đầu ghi âm trực tiếp từ trình duyệt web bằng cách cấp quyền microphone.
- **FR-002**: Hệ thống PHẢI thu âm toàn bộ âm thanh từ microphone input (bao gồm giọng host và âm thanh phát qua loa/speaker).
- **FR-003**: Hệ thống PHẢI stream audio chunks liên tục lên server trong suốt quá trình ghi âm.
- **FR-004**: Hệ thống PHẢI lưu trữ raw audio thô trên server cho mỗi cuộc họp.

**Quản lý Phiên Họp**
- **FR-005**: Hệ thống PHẢI cho phép host tạo phiên họp mới với một định danh duy nhất (link hoặc mã phòng).
- **FR-005a**: Hệ thống PHẢI yêu cầu host đăng nhập bằng tài khoản để tạo phiên họp mới và truy cập lịch sử cuộc họp của mình.
- **FR-005b**: Hệ thống PHẢI yêu cầu host chọn một source language chính cho meeting trước khi bắt đầu ghi âm; source language này là mặc định cho transcript của toàn bộ meeting.
- **FR-006**: Mỗi phiên họp PHẢI có chính xác MỘT host thực hiện ghi âm — participants không có quyền ghi âm.
- **FR-007**: Hệ thống PHẢI cho phép participants tham gia phiên họp qua link hoặc mã phòng mà không cần đăng ký tài khoản.
- **FR-007a**: Hệ thống PHẢI cho phép bất kỳ ai có link hoặc mã phòng hợp lệ vào meeting ngay mà không cần host phê duyệt hoặc passcode bổ sung.
- **FR-008**: Host PHẢI có khả năng bắt đầu và dừng ghi âm bất kỳ lúc nào trong phiên họp.

**Transcript Realtime**
- **FR-009**: Hệ thống PHẢI hiển thị transcript realtime cho cả host và tất cả participants đang trong phiên họp.
- **FR-010**: Transcript PHẢI xuất hiện trong vòng tối đa 10 giây sau khi nói (end-to-end latency bao gồm audio streaming, queueing, STT processing, và delivery).
- **FR-011**: Transcript PHẢI được hiển thị theo thứ tự thời gian chính xác, không bị đảo lộn khi nhiều chunks được xử lý song song.

**Translation**
- **FR-012**: Hệ thống PHẢI dịch tự động mỗi đoạn transcript sang ngôn ngữ đích do người dùng chọn.
- **FR-013**: Translation PHẢI xuất hiện tự động mà không cần thao tác thêm từ người dùng cho mỗi đoạn.
- **FR-014**: Người dùng PHẢI có thể thay đổi ngôn ngữ đích bất kỳ lúc nào.
- **FR-014a**: Hệ thống PHẢI luôn lưu transcript gốc của meeting; translation chỉ được tạo và lưu cho từng ngôn ngữ khi có yêu cầu xem hoặc dịch.

**Summary**
- **FR-015**: Hệ thống PHẢI cho phép tạo summary sau khi cuộc họp kết thúc.
- **FR-016**: Hệ thống PHẢI cho phép tạo summary on-demand trong khi cuộc họp đang diễn ra (dựa trên transcript hiện có).
- **FR-017**: Summary PHẢI bao gồm các điểm chính, quyết định, và action items được trích xuất từ transcript.

**Xem Lại**
- **FR-018**: Hệ thống PHẢI lưu trữ và cho phép truy cập lại toàn bộ transcript, translation, và summary của các cuộc họp trước.
- **FR-019**: Hệ thống PHẢI cung cấp danh sách cuộc họp với metadata (ngày, thời lượng, trạng thái).
- **FR-020**: Người dùng PHẢI có thể tìm kiếm nội dung trong transcript của cuộc họp cũ.
- **FR-020a**: Participant có link hoặc mã phòng hợp lệ PHẢI có thể truy cập lại transcript, translation, và summary của meeting đã kết thúc mà không cần tài khoản.

**GPU Worker Pipeline**
- **FR-021**: GPU workers PHẢI chạy dưới dạng Google Colab notebook session do user tự bật và chủ động poll server để lấy audio chunks cần xử lý (pull model, không push).
- **FR-022**: Hệ thống PHẢI hỗ trợ nhiều GPU workers hoạt động đồng thời mà không bị duplicate processing.
- **FR-023**: Hệ thống PHẢI tự động reassign audio chunks cho workers khác nếu worker ban đầu không trả kết quả trong thời gian timeout.
- **FR-023a**: Hệ thống PHẢI tiếp tục nhận, lưu, và xếp hàng audio chunks ngay cả khi chưa có Google Colab notebook session nào online.

**Connectivity & Reliability**
- **FR-024**: Hệ thống PHẢI tự động reconnect khi kết nối bị gián đoạn (cho cả host streaming audio và participant nhận transcript).
- **FR-025**: Hệ thống PHẢI buffer audio tại client trong thời gian mất kết nối và gửi lại khi reconnect thành công.

### Key Entities

- **Meeting (Cuộc họp)**: Đại diện cho một phiên ghi âm. Thuộc tính chính: định danh duy nhất, thời gian bắt đầu/kết thúc, trạng thái (đang diễn ra / đã kết thúc / kết thúc bất thường), host, source language chính, danh sách participants. Một meeting có nhiều transcript segments, translations, và tối đa một summary.
- **Host Account (Tài khoản host)**: Đại diện cho người dùng có quyền tạo và quản lý cuộc họp. Thuộc tính chính: định danh tài khoản, thông tin đăng nhập, và danh sách meetings đã tạo. Một Host Account có thể sở hữu nhiều Meetings.
- **Transcript Segment (Đoạn phiên âm)**: Một đoạn text được phiên âm từ audio. Thuộc tính: nội dung text, timestamp bắt đầu/kết thúc trong cuộc họp, thứ tự sequence. Thuộc về chính xác một Meeting.
- **Translation (Bản dịch)**: Bản dịch của một Transcript Segment sang ngôn ngữ đích cụ thể. Thuộc tính: nội dung dịch, ngôn ngữ gốc, ngôn ngữ đích, trạng thái đã lưu. Quan hệ: một Transcript Segment có thể có nhiều Translations (mỗi ngôn ngữ đích một bản), nhưng chỉ được tạo khi có yêu cầu cho ngôn ngữ đó.
- **Summary (Tổng hợp)**: Bản tóm tắt nội dung cuộc họp. Thuộc tính: nội dung tóm tắt (điểm chính, quyết định, action items), thời điểm tạo. Thuộc về chính xác một Meeting.
- **Audio Chunk (Đoạn âm thanh)**: Một phần audio thô được gửi từ browser lên server. Thuộc tính: dữ liệu audio, sequence number, trạng thái xử lý (chờ / đang xử lý / hoàn tất / lỗi). Thuộc về một Meeting.
- **Notebook Session (Phiên Colab)**: Một Google Colab notebook session do user tự bật để làm GPU worker. Thuộc tính: trạng thái online/offline, thời điểm poll gần nhất, khả năng nhận job. Một Notebook Session có thể xử lý nhiều Audio Chunks theo thời gian.
- **Participant (Người tham gia)**: Một người đang xem transcript/translation trong phiên họp. Thuộc tính: session identifier, vai trò (host hoặc viewer), thời gian tham gia. Một Meeting có nhiều Participants.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Host có thể bắt đầu ghi âm và thấy transcript đầu tiên xuất hiện trong vòng 15 giây sau khi nói câu đầu tiên.
- **SC-002**: Transcript realtime hiển thị với độ trễ end-to-end tối đa 10 giây (từ lúc nói đến lúc text xuất hiện trên màn hình).
- **SC-003**: Hệ thống hỗ trợ tối thiểu 10 participants đồng thời trong một phiên họp mà không giảm chất lượng trải nghiệm.
- **SC-004**: Translation xuất hiện trong vòng 5 giây sau khi transcript segment tương ứng hiển thị.
- **SC-005**: Summary cho cuộc họp 1 giờ được tạo trong vòng 60 giây.
- **SC-006**: Hệ thống hoạt động ổn định cho cuộc họp kéo dài tối thiểu 2 giờ liên tục mà không crash, memory leak, hoặc mất dữ liệu.
- **SC-007**: 90% người dùng có thể tạo meeting và bắt đầu ghi âm thành công trong lần thử đầu tiên mà không cần hướng dẫn.
- **SC-008**: Khi kết nối bị gián đoạn < 30 giây, hệ thống tự động khôi phục mà không mất dữ liệu audio hoặc transcript.
- **SC-009**: Toàn bộ transcript, translation, và summary của cuộc họp cũ có thể được truy cập lại trong vòng 3 giây (thời gian tải trang).

## Assumptions

- Người dùng sử dụng trình duyệt web hiện đại hỗ trợ Web Audio API (Chrome, Firefox, Edge phiên bản gần đây).
- Người dùng có kết nối internet ổn định với băng thông đủ để stream audio (tối thiểu 256kbps upload cho host).
- KHÔNG yêu cầu consent/privacy flow — host có toàn quyền ghi âm mà không cần xin phép participants.
- Host cần tài khoản đơn giản để tạo meeting và xem lại history; participants không cần tài khoản và có thể vào ngay hoặc xem lại sau meeting nếu có link hoặc mã phòng hợp lệ.
- GPU workers chạy dưới dạng Google Colab notebook session do user tự bật; server không tự khởi tạo GPU worker hoặc tự chạy STT processing.
- Host chọn một source language chính cho mỗi meeting trước khi ghi âm; hệ thống không tự động chuyển source language trong lúc meeting đang diễn ra.
- Hệ thống không phân biệt speaker (speaker diarization) — tất cả audio được xử lý như single-stream.
- Raw audio được lưu trữ không giới hạn thời gian trừ khi người dùng chủ động xóa.
- Một host chỉ có thể ghi âm cho một cuộc họp tại một thời điểm.
- Transcript gốc luôn được lưu; translation không được precompute cho mọi ngôn ngữ mà chỉ được tạo và lưu theo nhu cầu sử dụng thực tế.
