## การใช้ AI ในงานนี้ (AI Usage Declaration) — Coding Sprint สัปดาห์ที่ 13

### 1. ใช้ AI หรือไม่?

- [ ] ไม่ได้ใช้ AI
- [x] ใช้ AI (กรุณาระบุรายละเอียด)

### 2. เครื่องมือ AI ที่ใช้:

- Claude Code (Claude Opus 5.5) ใน VS Code — ทำงานกับไฟล์ใน repository และรันคำสั่ง (Docker, Node.js) บนเครื่องของผู้ใช้

### 3. งานส่วนไหนใช้ AI:

- [ ] Requirement Analysis
- [ ] Database Design
- [ ] System Architecture
- [x] Document/Grammar Check - ส่วน: ร่าง `wk13-integration-testing.md` (ตาราง test case, บันทึก bug, ร่าง FR ที่ปรับปรุง)
- [x] อื่นๆ: Integration และ Coding Sprint 3
  - ตรวจโค้ดเพื่อหาจุดที่ API contract ไม่ตรงกันระหว่าง module
  - implement `GET /api/reports/sales` (`reportRoutes` / `reportController` / `reportModel`) และ endpoint ข้อมูลอ้างอิง (`/api/branches`, `/api/categories`)
  - แก้ bug BUG-01 ถึง BUG-10 (ดูหัวข้อ 4 ใน `wk13-integration-testing.md`) และเชื่อม `web/script.js` เข้ากับ API
  - สร้าง `seed.sql` และสคริปต์ทดสอบ E2E (`tests/e2e.js`) แล้วรันทดสอบ API และหน้าจอจริงผ่าน headless Chrome

### 4. Prompt ที่ใช้ (ตัวอย่าง):

"[วางเนื้อหา Workshop สัปดาห์ที่ 13 ทั้งหมด: รวมโค้ด → ตรวจ API contract → implement GET /api/reports/sales → ทดสอบ E2E ตามหัวข้อ 2.3 → แก้ bug → ปรับ requirement → ทดสอบซ้ำ → commit/push และทำ AI Disclosure] คุณทำในโฟลเดอร์นี้เลยนะ"

### 5. ผลลัพธ์จาก AI:

"AI รันโค้ดเดิมบน `main` กับฐานข้อมูลทดสอบ ได้ผล 3/8 test case และพบว่าหน้าจอ POS ใช้ localStorage แทน API, `seed.sql` เป็นโฟลเดอร์ว่าง, response ส่งชื่อ field แบบ snake_case และ DECIMAL เป็น string, `POST /api/orders` ไม่มี `totalAmount`, ยังไม่มีรายงานยอดขาย และระหว่างทดสอบพบเวลาออเดอร์เพี้ยน 7 ชั่วโมงกับการเลือกสาขาบนจอเล็กไม่ได้ หลังแก้ไข ผลการทดสอบซ้ำผ่าน 8/8 (API) และ 7/7 (หน้าจอ) พร้อมร่าง FR/NFR ที่ต้องเพิ่มใน `wk03-requirements.md`"

### 6. การปรับแต่งของตัวเอง:

"[ให้สมาชิกกรอกเอง เช่น ตรวจโค้ดที่ AI แก้ทีละไฟล์หรือไม่, ทดสอบหน้าจอเองด้วยมือหรือไม่, แก้/ไม่เห็นด้วยกับจุดใด, เปลี่ยนเลข FR-13-x ให้ตรงกับเอกสารของกลุ่ม, ตัดสินใจเรื่องตัวกรองรายงาน “วันนี้/ทั้งหมด” อย่างไร]"

### 7. เหตุผลในการใช้ AI:

"[ให้สมาชิกกรอกเอง เช่น ต้องการตรวจหาจุดที่ module ไม่เข้ากันอย่างเป็นระบบภายในเวลา Workshop 90 นาที]"
