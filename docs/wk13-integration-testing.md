# WK13: Integration และ End-to-End Testing — Cafe POS Group 11

> Coding Sprint 3 · ทดสอบวันที่ 28 ตุลาคม 2569 · branch `wk13-integration`
> Flow ที่ทดสอบ: **order → payment → report** แยกตามสาขา (`branch_id`)

## 1. สรุปผล

| รอบ | โค้ดที่ทดสอบ | API (TC-13-01..08) | หน้าจอ POS (TC-13-01..07) |
|---|---|---|---|
| รอบที่ 1 | `main` ก่อนรวมระบบ (commit `4098ba9`) | **3/8 ผ่าน** | ทดสอบไม่ได้ — หน้าจอเปิดจาก server ไม่ได้ (404) และไม่ได้เรียก API |
| รอบสุดท้าย (regression) | `wk13-integration` หลังแก้ bug ทั้งหมด | **8/8 ผ่าน** | **7/7 ผ่าน** + ไม่มี JavaScript error |

ทุกรอบเริ่มจากฐานข้อมูลที่โหลด `schema.sql` + `seed.sql` ใหม่ เพื่อให้ Precondition ตรงกันทุกครั้ง

## 2. API Contract ที่ตกลงกันหลังรวมระบบ

ข้อตกลง: DB column เป็น `snake_case` ส่วน JSON request/response เป็น `camelCase` และ **backend แปลงค่า DECIMAL (ราคา, ผลของ `SUM`) เป็น number ก่อนส่ง** (frontend ไม่ต้องแปลงเอง)

| Endpoint | Request | Response สำเร็จ | Error |
|---|---|---|---|
| `GET /api/branches` | – | `[{ branchId, name, address }]` | 500 |
| `GET /api/branches/:branch_id/employees` | – | `[{ employeeId, branchId, name, role }]` | 400 |
| `GET /api/categories` | – | `[{ categoryId, name }]` | 500 |
| `GET /api/menu?branchId=` | – | `[{ menuId, branchId, categoryId, categoryName, name, price: number, stockQuantity }]` | 400 |
| `POST /api/menu` | `{ branchId, categoryId, name, price, stockQuantity }` | `201 { menuId }` | 400, 409 |
| `PUT /api/menu/:id` | `{ branchId, categoryId?, name?, price?, stockQuantity? }` | `{ updated: true }` | 400, 404 |
| `DELETE /api/menu/:id?branchId=` | – | `{ deleted: true }` | 404, 409 (มีประวัติขาย) |
| `POST /api/orders` | `{ branchId, employeeId, paymentMethod: "cash"\|"qr"\|"card", items: [{ menuId, quantity }] }` | `201 { orderId, totalAmount: number, lowStockMenuIds }` | `400 { error }` เช่น สต็อกไม่พอ |
| `GET /api/orders/:order_id?branchId=` | – | `{ orderId, branchId, employeeId, paymentMethod, createdAt, items: [{ menuId, menuName, quantity, unitPrice, subtotal }], totalAmount }` | 400, 404 |
| `GET /api/orders/branch/:branch_id` | – | `[{ orderId, branchId, employeeId, paymentMethod, createdAt, totalAmount }]` | 400 |
| `GET /api/reports/sales?branchId=` | – | `[{ menuId, name, totalQuantity: number, totalSales: number }]` | 400 ถ้าไม่ระบุ branchId |

`createdAt` เป็นเวลา UTC รูปแบบ ISO 8601 (เช่น `2026-10-28T09:30:09.000Z`) หน้าจอแปลงเป็นเวลาไทยเอง

## 3. Test Case และผลการทดสอบ

ข้อมูลตั้งต้น (`seed.sql`): สาขา 1 = Bangsaen (พนักงาน id 1), สาขา 2 = Sriracha (พนักงาน id 2)
สาขา A: Latte (menu 1) สต็อก 20 · Americano (menu 2) สต็อก 40 · Espresso (menu 3) สต็อก 1 · Iced Americano (menu 8) สต็อก 0
สาขา B: Latte (menu 9) สต็อก 15 — คนละแถวกับLatteสาขา A

| TC ID | ที่มา | Precondition | ขั้นตอนทดสอบ | ผลลัพธ์ที่คาดหวัง | ผลลัพธ์จริง รอบ 1 (`main`) | ผลลัพธ์จริง รอบสุดท้าย | Pass/Fail |
|---|---|---|---|---|---|---|---|
| TC-13-01 | ตาราง 2.3 ข้อ 1 | seed ใหม่ | 1. เปิด `http://localhost:3000` เลือกสาขา Bangsaen<br>2. กด + Latte 2 ครั้ง และAmericano 1 ครั้ง | ตะกร้ามี 2 รายการ ยอดรวม ฿190.00 | ❌ `GET /` ได้ 404 · `GET /api/menu` ส่ง `menu_id`, `stock_quantity`, `price: "65.00"` (string) → ยอดรวมคำนวณได้ `NaN` | ยอดรวม ฿190.00 · field เป็น camelCase · `price` เป็น number | **Pass** |
| TC-13-02 | ตาราง 2.3 ข้อ 2 / BR01, BR02 | Latteสาขา A สต็อก 20 | 1. เหลือLatte ×2 ในตะกร้า<br>2. เลือกเงินสด รับเงิน 200<br>3. กดยืนยันการสั่งซื้อ | แสดงใบเสร็จ ยอด ฿130.00 เงินทอน ฿70.00 · `orders` มีแถวใหม่ `branch_id = 1` · response มี `orderId`, `totalAmount` | ❌ บันทึกได้ (`branch_id = 1`) แต่ response เป็น `{ orderId, lowStockMenuIds }` ไม่มี `totalAmount` และ `GET /api/orders/:id` ส่ง field snake_case | ใบเสร็จ #1 ฿130.00 เงินทอน ฿70.00 · `{"orderId":1,"totalAmount":130}` · DB `branch_id = 1` | **Pass** |
| TC-13-03 | ตาราง 2.3 ข้อ 3 / BR03 | หลัง TC-13-02 | 1. ดูป้ายสต็อกLatteบนหน้าจอ<br>2. ตรวจ `menu_item.stock_quantity` ของLatteทั้งสองสาขา | สาขา A เหลือ 18 · สาขา B ยังเป็น 15 | ✅ A = 18, B = 15 | หน้าจอแสดง “18 left” · DB A = 18, B = 15 | **Pass** |
| TC-13-04 | ตาราง 2.3 ข้อ 4 | หลัง TC-13-02 | 1. ไปหน้ารายงานยอดขาย สาขา Bangsaen | ตารางมี “Latte 2 แก้ว 130.00” ยอดขายรวม 130.00 · ค่าใน JSON เป็น number | ❌ `GET /api/reports/sales` ได้ 404 (ยังไม่มี endpoint) · หน้าจอใช้ข้อมูลใน localStorage | `[{"menuId":1,"name":"Latte","totalQuantity":2,"totalSales":130}]` · หน้าจอแสดงถูกต้อง | **Pass** |
| TC-13-05 | ตาราง 2.3 ข้อ 5 / BR ข้อ 1 / alt “สต็อกไม่เพียงพอ” | Espressoสาขา A สต็อก 1 | 1. กด + Espresso 5 ครั้ง<br>2. (จำลองสต็อกถูกขายไปจากเครื่องอื่น) ตั้งสต็อกเป็น 0 แล้วกดยืนยัน<br>3. เรียก API ตรงด้วย quantity 5 | หน้าจอไม่ให้เพิ่มเกิน 1 · backend ตอบ 400 พร้อมข้อความ · ไม่มีออเดอร์ใหม่ | ✅ API ตอบ 400 `สต็อกไม่พอสำหรับเมนู 3` (ผ่าน แต่ข้อความแสดงเป็นเลข id) | ตะกร้าเพิ่มได้แค่ 1 · หน้าจอแสดง “Insufficient stock for Espresso (0 left)” · จำนวนออเดอร์ไม่เปลี่ยน | **Pass** |
| TC-13-06 | ตาราง 2.3 ข้อ 6 | หลัง TC-13-02..05 · Latteสาขา B สต็อก 15 | 1. เปลี่ยนสาขาเป็น Sriracha<br>2. Latte ×3 เงินสด รับ 200 ยืนยัน<br>3. ดูรายงานสาขา B แล้วสลับกลับสาขา A | `orders.branch_id = 2` · สต็อก B = 12 · รายงาน B มีเฉพาะ “Latte 3 / 195.00” · สต็อก A ยัง 18 และรายงาน A ยัง “Latte 2 / 130.00” | ❌ บันทึกและตัดสต็อกถูกสาขา แต่ตรวจรายงานไม่ได้ (404) · หน้าจอไม่มีที่เลือกสาขา | ใบเสร็จ “Receipt · Sriracha branch ฿195.00” · DB `branch_id = 2` · รายงาน B `["Latte 3 195.00"]` · รายงาน A `["Latte 2 130.00"]` · สต็อก A = 18, B = 12 | **Pass** |
| TC-13-07 | Edge case stock = 0 (หัวข้อ 4.2) | Iced Americanoสาขา A สต็อก 0 | 1. ดูการ์ดเมนูIced Americano<br>2. เรียก `POST /api/orders` ตรงด้วย quantity 1 | ปุ่ม + ถูกปิด ป้ายแสดง “Sold out” · backend ยังตอบ 400 | ✅ API ตอบ 400 (หน้าจอทดสอบไม่ได้) | ปุ่ม disabled · ป้าย “Sold out” · API 400 `Insufficient stock for Iced Americano (0 left)` | **Pass** |
| TC-13-08 | Validation ของ endpoint ใหม่ | – | 1. `GET /api/reports/sales` โดยไม่ส่ง branchId | 400 `{ error }` | ❌ 404 | 400 `branchId is required and must be a positive integer` | **Pass** |

**การทดสอบเพิ่มเติมหลังแก้ bug** (เรียก API โดยตรง): เพิ่ม/แก้หมวดหมู่และราคา/ลบเมนูผ่าน `/api/menu` ทำงานถูกต้อง · ขอเมนูของสาขา A โดยระบุ `branchId=2` ได้ 404 · ลบเมนูที่มีประวัติขายได้ 409 · `createdAt` ของออเดอร์ใหม่ตรงกับเวลาจริง (ตรวจหลังแก้ BUG-07) · หน้าจอกว้าง 1400 / 800 / 390 px เลือกสาขาได้และไม่มี horizontal scroll

> **ยังไม่ครอบคลุม:** test case นี้ยังไม่มี assertion สำหรับ use case ย่อยที่ `<<include>>` ใน Use Case Diagram ของกลุ่ม (หัวข้อ 2.2) เพราะ `docs/wk04-userstories-usecasediagram.md` เพิ่งถูกรวมเข้า `main` หลังการทดสอบรอบนี้ — ให้สมาชิกที่ดูแล Use Case Diagram เพิ่ม assertion ให้ครบ การทดสอบ concurrency อยู่นอกขอบเขตตาม wk09

## 4. Bug ที่พบและการแก้ไข (Reproduce → Isolate → Fix & Verify)

| Bug | Reproduce | Isolate (layer) | Fix | Verify |
|---|---|---|---|---|
| **BUG-01** หน้าจอ POS เปิดจาก server ไม่ได้ | เปิด `http://localhost:3000/` ได้ 404 | `src/app.js` — `express.static("public")` แต่ไฟล์อยู่ใน `web/` | ชี้ static ไปที่ `web/` ด้วย `path.join(__dirname, "..", "web")` | TC-13-01 `GET /` = 200 |
| **BUG-02** หน้าจอไม่ได้เชื่อมกับ backend | สั่งออเดอร์บนหน้าจอแล้ว ตาราง `orders` ไม่มีข้อมูล | `web/script.js` — เก็บเมนู/ออเดอร์ใน `localStorage` ทั้งหมด ไม่มี `fetch` | เขียน data layer ใหม่ให้เรียก API ตาม contract (เมนู, ออเดอร์, รายงาน, ประวัติ, ใบเสร็จ, จัดการเมนู) และเพิ่มตัวเลือกสาขา | TC-13-01..07 ผ่านทางหน้าจอจริง |
| **BUG-03** ไม่มีข้อมูลตั้งต้น | `docker compose up` แล้วตารางว่าง/สร้างไม่ครบ | `seed.sql` เป็น **โฟลเดอร์ว่าง** ไม่ใช่ไฟล์ จึง mount เข้า `docker-entrypoint-initdb.d` ไม่ได้ | สร้าง `seed.sql` จริง: 2 สาขา, 3 หมวดหมู่, 2 พนักงาน, เมนูแยกตามสาขาตาม Precondition | โหลด schema + seed สำเร็จทุกรอบ |
| **BUG-04** field ชื่อไม่ตรงข้อตกลง (กรณีหัวข้อ 1.3) | `GET /api/menu` ได้ `menu_id`, `stock_quantity` · หน้าจอที่อ่าน `menuId` ได้ `undefined`, ยอดรวม `NaN` | `menuModel.js` / `orderModel.js` ส่งแถวจาก query ออกไปตรง ๆ | เพิ่ม `toMenu()` / `toOrder()` แปลงเป็น camelCase และแปลง DECIMAL เป็น number | TC-13-01, 02 |
| **BUG-05** `POST /api/orders` ไม่ตรง contract | response ไม่มี `totalAmount` ใบเสร็จต้องคำนวณยอดเองจากราคาฝั่ง client | `orderModel.createOrder` | คำนวณ `totalAmount` จากราคาในฐานข้อมูลด้วย Domain Class `Order`/`OrderItem` (`src/models/Order.js` ที่มีอยู่แล้วแต่ยังไม่เคยถูกใช้) | TC-13-02 `totalAmount: 130` |
| **BUG-06** ไม่มีรายงานยอดขาย | `GET /api/reports/sales?branchId=1` ได้ 404 | ไม่มี route/controller | เพิ่ม `reportRoutes` → `reportController` → `reportModel` กรอง `o.branch_id = ?` · alias camelCase · แปลงผล `SUM` (DECIMAL → string ใน mysql2) เป็น number ที่ backend | TC-13-04, 06, 08 |
| **BUG-07** เวลาออเดอร์เพี้ยน 7 ชั่วโมง | สั่งออเดอร์เวลา 16:28 น. แต่ `createdAt` ได้ `02:28Z` (ควรเป็น `09:28Z`) | `src/config/db.js` — MySQL ใน Docker บันทึก `CURRENT_TIMESTAMP` เป็น UTC แต่ mysql2 อ่าน `DATETIME` เป็นเวลาท้องถิ่นของเครื่อง (UTC+7) | ตั้ง `timezone: "Z"` ใน pool และ `SET time_zone = '+00:00'` ทุก connection | ออเดอร์ใหม่ได้ `09:30:09Z` ตรงกับเวลา UTC จริง |
| **BUG-08** เลือกสาขาบนแท็บเล็ต/มือถือไม่ได้ | ย่อหน้าจอ ≤ 850 px — กล่องสาขาหายไป ทำ TC-13-06 บนแท็บเล็ตไม่ได้ | `web/style.css` media query ซ่อน `.branch` | แสดงเฉพาะ dropdown สาขาแบบย่อในแถบด้านบน | screenshot 800 / 390 px เห็นตัวเลือกสาขา |
| **BUG-09** ข้อความสต็อกไม่พอเข้าใจยาก | TC-13-05 แสดง “สต็อกไม่พอสำหรับเมนู 3” | `orderModel.createOrder` ใช้ `menuId` ในข้อความ | แสดงชื่อเมนูและจำนวนคงเหลือ | TC-13-05 “Insufficient stock for Espresso (0 left)” |
| **BUG-10** เกณฑ์สต็อกต่ำไม่ตรงกัน | หน้าจอขึ้นป้ายเตือนที่ ≤ 8 แต่ backend เตือนที่ < 10 | `web/script.js` กับ `orderModel.js` เขียนตัวเลขซ้ำกันคนละที่ | Refactor (หัวข้อ 3.2): ย้ายเป็น `isLowStock()` ใน `menuModel.js` ให้ `orderModel` ใช้ร่วม และหน้าจอใช้ค่าเดียวกัน (< 10) | regression รอบสุดท้ายผ่านทั้งหมด |
| **BUG-11** ชื่อสาขา/เมนูภาษาไทยเพี้ยนเป็น `à¸¥à¸²...` | `docker compose down -v` → `up -d` แล้วเปิดหน้าจอ POS | ข้อมูลใน DB เสียตั้งแต่ตอน init — mysql client ของ `docker-entrypoint` ใช้ charset `latin1` เป็นค่าเริ่มต้น ข้อความ UTF-8 ใน `seed.sql` จึงถูกแปลงซ้ำ 2 ชั้น (backend และหน้าจอไม่ผิด) | เพิ่ม `SET NAMES utf8mb4;` บรรทัดแรกของ `seed.sql` และเปลี่ยนข้อมูลตั้งต้นเป็นภาษาอังกฤษ (Bangsaen / Sriracha, Latte, …) ตามที่ทีมตกลง · ฐานที่สร้างไว้แล้วแก้ด้วย `UPDATE` ตาม id | `GET /api/menu?branchId=1` ได้ `"name":"Latte","categoryName":"Coffee"` หน้าจอแสดงถูกต้อง |

Refactoring อื่น: รวม `parseId` ที่ซ้ำกันใน `menuController` / `orderController` ไว้ที่ `src/utils/parseId.js`

## 5. การปรับปรุง Requirement (สำหรับเพิ่มในประวัติการเปลี่ยนแปลงของ `wk03-requirements.md`)

> ตอนทดสอบ `docs/wk03-requirements.md` ยังไม่อยู่ใน branch นี้ จึงบันทึกไว้ที่นี่ก่อน ให้ผู้ดูแลเอกสารคัดลอกไปต่อท้ายส่วน “ประวัติการเปลี่ยนแปลง” และ **เปลี่ยนเลข FR-13-x เป็นเลขถัดไปที่ไม่ซ้ำ** กับ FR เดิมของกลุ่ม

- **FR-13-1 (เพิ่มใหม่, พบ 28 ตุลาคม 2569 จากการทดสอบ prototype สัปดาห์ที่ 13):** ระบบต้องปิดการใช้งานปุ่ม “+” และแสดงสถานะ “Sold out” สำหรับเมนูที่ `stock_quantity = 0` ตั้งแต่หน้าจอเลือกเมนู โดย backend ยังต้องตรวจสต็อกและตอบ 400 เหมือนเดิม **เหตุผล:** Requirements เดิมไม่ครอบคลุมกรณีสต็อกเท่ากับศูนย์พอดี (TC-13-07)
- **FR-13-2 (เพิ่มใหม่, พบ 28 ตุลาคม 2569):** พนักงานต้องเลือกสาขาได้จากทุกหน้าจอและทุกขนาดหน้าจอ และเมนู ออเดอร์ สต็อก และรายงานต้องแสดงเฉพาะของสาขาที่เลือก **เหตุผล:** prototype เดิมกำหนดสาขา Bangsaenตายตัวในหน้าจอ และซ่อนส่วนสาขาบนจอเล็ก ทำให้ทดสอบข้ามสาขา (TC-13-06) ไม่ได้ (BUG-02, BUG-08)
- **FR-13-3 (แก้ไข, พบ 28 ตุลาคม 2569):** รายงานยอดขายต้องสรุปยอดรวมต่อเมนูของสาขาที่เลือก (`GET /api/reports/sales?branchId=`) โดยส่งจำนวนและยอดเงินเป็นตัวเลข (number) **เหตุผล:** ผลของ `SUM` ใน MySQL เป็น DECIMAL ซึ่ง mysql2 ส่งเป็น string ทำให้คำนวณต่อผิดแบบเงียบ — ทีมตกลงให้แปลงที่ backend · ตัวกรอง “วันนี้/ทั้งหมด” ของหน้าจอเดิมถูกนำออกชั่วคราวเพราะ endpoint ยังไม่รองรับช่วงเวลา (ควรกำหนดเป็น requirement แยกถ้าต้องการ)
- **FR-13-4 (แก้ไข, พบ 28 ตุลาคม 2569):** เมื่อปฏิเสธออเดอร์เพราะสต็อกไม่พอ ข้อความต้องระบุชื่อเมนูและจำนวนคงเหลือ **เหตุผล:** ข้อความเดิมแสดงเป็นเลข id ซึ่งพนักงานหน้าร้านไม่เข้าใจ (TC-13-05, BUG-09)
- **NFR-13-1 (เพิ่มใหม่, พบ 28 ตุลาคม 2569):** ระบบต้องบันทึกเวลาออเดอร์เป็น UTC และแสดงผลเป็นเวลาประเทศไทยบนหน้าจอ **เหตุผล:** พบเวลาในประวัติการขายเพี้ยน 7 ชั่วโมง (BUG-07) ซึ่งจะทำให้รายงานรายวันผิด

## 6. วิธีรันและทดสอบซ้ำ

โค้ดทั้งหมดอยู่ในโฟลเดอร์ `code/` (path ของไฟล์ในเอกสารนี้ เช่น `src/app.js` อ้างอิงจาก `code/`) ทุกคำสั่งให้รันใน `code/` และต้องมีไฟล์ `code/.env` (คัดลอกจาก `.env.example`)

```bash
cd code
docker compose up -d          # MySQL + schema.sql + seed.sql (เฉพาะ volume ใหม่)
npm install
npm run dev                   # เปิด http://localhost:3000
npm run test:e2e              # TC-13-01..08 ระดับ API — ใช้กับฐานข้อมูลที่เพิ่งโหลด seed ใหม่เท่านั้น
```

**สำคัญ:** container ที่เคยสร้างไว้ก่อนสัปดาห์นี้ (ตอน `seed.sql` ยังเป็นโฟลเดอร์) จะไม่โหลด schema/seed ซ้ำ เพราะ MySQL รันสคริปต์ init เฉพาะตอน volume ว่าง ให้รีเซ็ตหนึ่งครั้ง (ข้อมูลในฐานเดิมจะหาย):
`docker compose down -v` แล้วตามด้วย `docker compose up -d`
`docker-compose.yml` ล็อกชื่อโปรเจกต์เป็น `cafe-pos-group11` ไว้ จึงใช้ container และ volume เดิมต่อได้แม้ย้ายไฟล์เข้า `code/` แล้ว

## 7. ข้อจำกัดและงานที่เหลือ

- ขั้นตอนที่ 1 ของ Workshop (รวมโค้ด): งานรวมระบบทำบน branch `wk13-integration` ระหว่างนั้นสมาชิกปรับโครงสร้าง `main` เป็น `code/` + `docs/` และเพิ่มเอกสาร wk01–wk12 จึง merge `main` กลับเข้า branch แก้ conflict ด้านตำแหน่งไฟล์ (ไฟล์ใหม่ของสัปดาห์นี้ถูกย้ายเข้า `code/` และ `docs/`) แล้วรันทดสอบซ้ำก่อนรวมเข้า `main`
- ยังไม่ได้นำปัญหา Critical/Major จาก `docs/wk12-usability-testing.md` มาแก้ เพราะเอกสารเพิ่งถูกรวมเข้า `main` หลังการทดสอบรอบนี้ — BUG-08 และ BUG-09 เป็นปัญหาด้าน usability ที่พบเองระหว่างทดสอบสัปดาห์นี้
- `wk11-architecture.md` (Development View) ยังไม่มี `reportRoutes` / `lookupRoutes` และ `Order.js` ซึ่งตอนนี้ถูกใช้งานจริงแล้ว ควรอัปเดตก่อนนำเสนอ

> **หมายเหตุ (28 ตุลาคม 2569):** หลังทดสอบเสร็จ ทีมเปลี่ยนข้อความบนหน้าจอ POS และข้อมูลตั้งต้นเป็นภาษาอังกฤษ (BUG-11) ข้อความหน้าจอที่อ้างถึงในตาราง test case จึงเป็นฉบับภาษาอังกฤษ และข้อความ error จาก backend เปลี่ยนเป็นภาษาอังกฤษด้วย (เช่น `Insufficient stock for Espresso (0 left)`) — ผลการทดสอบรอบสุดท้ายในตารางรันซ้ำหลังเปลี่ยนแล้ว (API 8/8, หน้าจอ 7/7) ส่วนคอลัมน์รอบที่ 1 คงข้อความภาษาไทยตามที่โค้ดเดิมตอบกลับจริง
