# wk14-quality-review.md — บันทึกผลการตรวจสอบคุณภาพและความปลอดภัย

## ข้อมูลพื้นฐาน

- **กลุ่ม:** Cafe POS Group 11
- **ผู้ตรวจสอบ:** สมาชิกในกลุ่ม
- **วันที่ตรวจสอบ:** 28 ตุลาคม 2569
- **จำนวน endpoint ทั้งหมดที่ตรวจ:** 13 endpoint (จาก `code/src/routes/` ทั้ง 4 ไฟล์) + middleware ส่วนกลางใน `code/src/app.js`

**วิธีตรวจ:** อ่านโค้ด routes → controllers → models ทีละ endpoint แล้วยิง request จริง (ทั้งค่าปกติ ค่าผิดรูปแบบ ค่าข้ามสาขา และ payload SQL injection) ไปที่ server ซึ่งต่อกับฐานข้อมูลทดสอบแยก (`cafe_pos_group11_wk14` โหลดจาก `schema.sql` + `seed.sql`) เพื่อไม่กระทบข้อมูลจริงของกลุ่ม ส่วนข้อ Race Condition ทดสอบด้วยการยิง request พร้อมกันหลายตัว (`Promise.all`)

---

## 1. รายการ endpoint ที่ตรวจสอบ

| Endpoint                                           | 1. Input Validation   | 2. IDOR                                    | 3. SQL Injection | 4. Error Handling     | 5. Race Condition                                  |
| -------------------------------------------------- | --------------------- | ------------------------------------------ | ---------------- | --------------------- | -------------------------------------------------- |
| `GET /api/branches`                                | ผ่าน (ไม่มี input)    | ผ่าน (ข้อมูลสาธารณะ)                       | ผ่าน             | ผ่าน                  | ผ่าน (อ่านอย่างเดียว)                              |
| `GET /api/branches/:branch_id/employees`           | ผ่าน                  | **ไม่ผ่าน** (#1)                           | ผ่าน             | ผ่าน                  | ผ่าน (อ่านอย่างเดียว)                              |
| `GET /api/categories`                              | ผ่าน (ไม่มี input)    | ผ่าน (ข้อมูลสาธารณะ)                       | ผ่าน             | ผ่าน                  | ผ่าน (อ่านอย่างเดียว)                              |
| `GET /api/menu?branchId=`                          | ผ่าน (มีข้อสังเกต #6) | ผ่าน (เมนูเป็นข้อมูลที่ลูกค้าเห็นอยู่แล้ว) | ผ่าน             | ผ่าน                  | ผ่าน (อ่านอย่างเดียว)                              |
| `GET /api/menu/:id?branchId=`                      | ผ่าน                  | ผ่าน (กรอง `branch_id` แล้ว)               | ผ่าน             | ผ่าน                  | ผ่าน (อ่านอย่างเดียว)                              |
| `POST /api/menu`                                   | ผ่าน                  | **ไม่ผ่าน** (#1)                           | ผ่าน             | ผ่าน                  | ผ่าน (`UNIQUE (branch_id, name)` กันชื่อซ้ำ → 409) |
| `PUT /api/menu/:id`                                | ผ่าน                  | **ไม่ผ่าน** (#1)                           | ผ่าน             | ผ่าน                  | **ไม่ผ่าน → แก้แล้ว** (#3)                         |
| `DELETE /api/menu/:id?branchId=`                   | ผ่าน                  | **ไม่ผ่าน** (#1)                           | ผ่าน             | ผ่าน                  | ผ่าน (FK กันลบเมนูที่มีประวัติขาย → 409)           |
| `POST /api/orders`                                 | ผ่าน                  | **ไม่ผ่าน** (#1)                           | ผ่าน             | ผ่าน                  | ผ่าน (transaction + `SELECT … FOR UPDATE`)         |
| `GET /api/orders/branch/:branch_id`                | ผ่าน (มีข้อสังเกต #6) | **ไม่ผ่าน** (#1)                           | ผ่าน             | ผ่าน                  | ผ่าน (อ่านอย่างเดียว)                              |
| `GET /api/orders/:order_id?branchId=`              | ผ่าน                  | **ไม่ผ่าน** (#1)                           | ผ่าน             | ผ่าน                  | ผ่าน (อ่านอย่างเดียว)                              |
| `DELETE /api/orders/:order_id?branchId=`           | ผ่าน                  | **ไม่ผ่าน** (#1, #2)                       | ผ่าน             | ผ่าน (มีข้อสังเกต #5) | ผ่าน (ล็อกออเดอร์ `FOR UPDATE`)                    |
| `GET /api/reports/sales?branchId=`                 | ผ่าน (มีข้อสังเกต #6) | **ไม่ผ่าน** (#1)                           | ผ่าน             | ผ่าน                  | ผ่าน (อ่านอย่างเดียว)                              |
| (ส่วนกลาง) `express.json()` และ route ที่ไม่มีอยู่ | –                     | –                                          | –                | **ไม่ผ่าน** (#5)      | –                                                  |

### หลักฐานจากการทดสอบจริง (สรุป)

| ข้อ Checklist       | สิ่งที่ยิง                                                                                                                                                                             | ผลที่ได้                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Input Validation | ราคา `-5`, ราคาเป็น string `"65"`, ชื่อยาว 101 ตัว, `stockQuantity: 1.5`, `quantity: 0 / -2 / "2"`, `paymentMethod: "bitcoin"`, `items: []`, จำนวนรวมเกิน INT                          | ได้ `400` พร้อมข้อความที่บอกสาเหตุทุกกรณี ไม่มีข้อมูลเข้า DB                                                                                                                      |
| 2. IDOR             | เรียกเมนู 9 (สาขา 2) ด้วย `branchId=1`, สั่งขายเมนูสาขา 2 จากสาขา 1, ใช้พนักงานสาขา 1 ขายให้สาขา 2                                                                                     | ได้ `404` / `400` — **การกรองข้ามสาขาทำงานถูกต้อง** แต่ถ้าแค่เปลี่ยน `branchId=2` ใน request ก็เข้าถึงได้ทันที เพราะไม่มีการยืนยันตัวตน (ดู #1)                                   |
| 3. SQL Injection    | `branchId=1 OR 1=1`, `/api/menu/1' OR '1'='1`, `/api/orders/1;DROP TABLE orders`, `branchId[]=1&branchId[]=2`, `branchId: { toSqlString: … }`, ชื่อเมนู `x'); DROP TABLE menu_item;--` | ID ทุกตัวผ่าน `parseId()` / `Number.isSafeInteger` จึงได้ `400` ส่วนชื่อเมนูถูกบันทึกเป็นข้อความธรรมดา เพราะทุก query ใช้ placeholder `?` ไม่มีการต่อ string เป็น SQL             |
| 4. Error Handling   | JSON เสีย, body ใหญ่เกิน 100kb, ชื่อเมนูซ้ำ, `categoryId` ไม่มีจริง, ลบเมนูที่มีประวัติขาย, ออเดอร์ไม่มีจริง                                                                           | ได้ `400 / 409 / 400 / 409 / 404` พร้อมข้อความที่ไม่เปิดเผย stack trace ยกเว้น body ใหญ่ (`413` แต่ข้อความ "Internal server error") และ route ที่ไม่มี (ได้หน้า HTML ของ Express) |
| 5. Race Condition   | (R-A) สั่ง Cappuccino สต็อก 8 พร้อมกัน 20 request, (R-B) ยกเลิกออเดอร์เดียวกันพร้อมกัน 5 request, (R-C) แก้ราคาเมนูขณะมีการขายแทรก                                                     | R-A สำเร็จ 8 สต็อกเหลือ 0 ไม่ติดลบ · R-B สำเร็จ 1 อีก 4 ได้ `404` คืนสต็อกครั้งเดียว · **R-C สต็อกถูกเขียนทับ** (ดู #3)                                                           |

---

## 2. จุดที่พบความเสี่ยง

### ความเสี่ยง #1 — ไม่มีการยืนยันตัวตน ทุก endpoint เชื่อ `branchId` / `employeeId` ที่ client ส่งมา

- **Endpoint ที่เกี่ยวข้อง:** `GET /api/branches/:branch_id/employees`, `POST|PUT|DELETE /api/menu…`, `POST /api/orders`, `GET /api/orders/branch/:branch_id`, `GET|DELETE /api/orders/:order_id`, `GET /api/reports/sales`
- **Checklist ข้อที่ไม่ผ่าน:** 2. IDOR
- **รายละเอียดความเสี่ยง:** โค้ดกรองข้อมูลตาม `branch_id` ถูกต้องทุก query แต่ค่า `branchId` มาจาก query string / body ที่ผู้เรียกกำหนดเอง และระบบไม่มี login หรือ role ตัวอย่างสถานการณ์จริง:
  - แคชเชียร์สาขาบางแสน (หรือใครก็ได้ที่อยู่ในวง LAN ของร้าน) ยิง `DELETE /api/orders/5?branchId=2` ได้ทันที ออเดอร์ของสาขาศรีราชาถูกลบ สต็อกถูกคืน และยอดขายในรายงานหายไป โดย `order_id` เป็นเลขเรียงกันและมีแค่ 2 สาขา จึงไล่เดาได้ทั้งหมดในไม่กี่วินาที
  - ยิง `GET /api/reports/sales?branchId=2` เพื่อดูยอดขายของสาขาอื่น
  - แคชเชียร์ส่ง `employeeId` ของเพื่อนร่วมสาขาใน `POST /api/orders` ทำให้ยอดขายถูกบันทึกเป็นชื่อคนอื่น
  - พนักงาน role `cashier` เรียก `PUT /api/menu/1` แก้ราคา Latte เป็น 1 บาทได้ เพราะไม่มีการตรวจ role
- **ระดับความรุนแรง:** **Critical** — ไม่ต้องมีความรู้พิเศษ แค่แก้ตัวเลขใน URL ก็ลบหรือแก้ข้อมูลการเงินได้ และขัดกับ Acceptance Criteria wk04 (US-01, US-06) ที่กำหนดว่าผู้ใช้ต้อง "เข้าสู่ระบบแล้ว"

### ความเสี่ยง #2 — `DELETE /api/orders/:order_id` ลบออเดอร์ถาวร ไม่มีร่องรอยและไม่จำกัดสิทธิ์

- **Endpoint ที่เกี่ยวข้อง:** `DELETE /api/orders/:order_id?branchId=`
- **Checklist ข้อที่ไม่ผ่าน:** 2. IDOR (การควบคุมสิทธิ์ระดับฟังก์ชัน)
- **รายละเอียดความเสี่ยง:** การยกเลิกทำด้วย `DELETE FROM orders` และ `order_item` หายไปด้วย `ON DELETE CASCADE` จึงไม่เหลือบันทึกว่าใครยกเลิก เมื่อไร หรือเพราะอะไร และยกเลิกออเดอร์ย้อนหลังกี่วันก็ได้ สถานการณ์จริง: แคชเชียร์รับเงินสด 130 บาท แล้วยกเลิกออเดอร์นั้นตอนปิดร้าน ยอดในรายงานจะลดลง 130 บาทตรงกับเงินในลิ้นชัก โดยไม่มีหลักฐานเหลือ (มีเพียงแถว `+2` ใน `stock_movement` ที่ไม่ผูกกับออเดอร์)
- **ระดับความรุนแรง:** **High**

### ความเสี่ยง #3 — Lost update: หน้าแก้ไขเมนูเขียนทับสต็อกที่ขายไประหว่างแก้ไข _(แก้แล้ว — ดูหัวข้อ 3)_

- **Endpoint ที่เกี่ยวข้อง:** `PUT /api/menu/:id` (และฟอร์ม Edit Menu ใน `code/web/script.js`)
- **Checklist ข้อที่ไม่ผ่าน:** 5. Race Condition
- **รายละเอียดความเสี่ยง:** ฟอร์ม Edit Menu ส่งทุกฟิลด์รวมถึง `stockQuantity` ที่โหลดไว้ตอนเปิดฟอร์ม และ server ตั้งค่า `stock_quantity = ?` ทับทันที สถานการณ์จริงที่ทดสอบได้ (R-C): ผู้จัดการเปิดฟอร์มแก้ราคา Latte ซึ่งตอนนั้นสต็อกเป็น 20 → ระหว่างนั้นเครื่อง POS อีกเครื่องขาย Latte ไป 5 แก้ว (สต็อกจริง 15) → ผู้จัดการกดบันทึกโดยแก้แค่ราคา → **สต็อกกลับเป็น 20** มี Latte 5 แก้วที่ไม่มีอยู่จริงในระบบ ร้านจะขายเกินของที่มีจริง ซึ่งขัดกับ AC ของ US-07 "จำนวนคงเหลือต้องถูกต้อง 100%" ปัญหานี้เกิดจากการใช้งานปกติ ไม่ต้องมีผู้ไม่หวังดี
- **ระดับความรุนแรง:** **High**

### ความเสี่ยง #4 — การปรับสต็อกด้วยมือไม่ถูกบันทึกใน `stock_movement`

- **Endpoint ที่เกี่ยวข้อง:** `PUT /api/menu/:id`, `POST /api/menu`
- **Checklist ข้อที่ไม่ผ่าน:** 5. Race Condition / ความถูกต้องของข้อมูล (data integrity)
- **รายละเอียดความเสี่ยง:** การขายและการยกเลิกบันทึก `stock_movement` ทุกครั้ง แต่การแก้ `stockQuantity` ผ่านหน้าจัดการเมนูไม่บันทึก ผลรวมของ `stock_movement` จึงไม่ตรงกับ `stock_quantity` เมื่อสต็อกหายก็ตรวจย้อนไม่ได้ว่าหายจากการขายหรือจากการแก้ตัวเลขด้วยมือ
- **ระดับความรุนแรง:** **Medium**

### ความเสี่ยง #5 — Error response บางกรณีไม่ตรงความจริงหรือไม่เป็น JSON

- **Endpoint ที่เกี่ยวข้อง:** error handler ส่วนกลางใน `code/src/app.js`, `DELETE /api/orders/:order_id`
- **Checklist ข้อที่ไม่ผ่าน:** 4. Error Handling
- **รายละเอียดความเสี่ยง:**
  - ส่ง body เกิน 100kb ได้สถานะ `413` แต่ข้อความเป็น `"Internal server error"` ทำให้ frontend หรือผู้ทดสอบเข้าใจผิดว่า server พัง
  - เรียก `/api/` ที่ไม่มีอยู่ (เช่น `/api/nope`) ได้หน้า HTML `Cannot GET /api/nope` แทน JSON ทำให้ `api()` ใน frontend แสดงแค่ "Something went wrong (HTTP 404)"
  - `deleteOrder` ไม่แปลง `ER_LOCK_DEADLOCK` / `ER_LOCK_WAIT_TIMEOUT` เป็น `409` เหมือน `createOrder` ผู้ใช้จึงได้ `500` ทั้งที่ลองใหม่แล้วจะสำเร็จ
- **ระดับความรุนแรง:** **Low** — ไม่มี stack trace หรือข้อมูลภายในรั่วออกไป

### ความเสี่ยง #6 — Input ที่ผ่าน validation แต่ไม่มีอยู่จริง และ response ไม่จำกัดขนาด

- **Endpoint ที่เกี่ยวข้อง:** `GET /api/menu`, `GET /api/orders/branch/:branch_id`, `GET /api/reports/sales`
- **Checklist ข้อที่ไม่ผ่าน:** 1. Input Validation (ข้อสังเกต)
- **รายละเอียดความเสี่ยง:** `branchId=999` (สาขาที่ไม่มีจริง) ได้ `200 []` เหมือนสาขาที่ยังไม่มียอดขาย ผู้ใช้จึงแยกไม่ออกว่าเลือกสาขาผิดหรือยังไม่มีข้อมูล นอกจากนี้ `GET /api/orders/branch/:branch_id` ส่งออเดอร์ทั้งหมดของสาขาโดยไม่มี pagination หรือช่วงวันที่ เมื่อเปิดร้านไปหลายเดือน response จะใหญ่ขึ้นเรื่อย ๆ และหน้ารายงานจะช้าลง (ขัดกับ AC US-08 "สร้างรายงานภายใน 5 วินาที" ในระยะยาว)
- **ระดับความรุนแรง:** **Low**

### ความเสี่ยง #7 — โค้ดที่ไม่ได้ใช้แต่ไม่ตรวจสาขา

- **Endpoint ที่เกี่ยวข้อง:** ไม่มี endpoint เรียกใช้ (`menuModel.deductStock`, `menuModel.findManyForStockCheck` ใน `code/src/models/menuModel.js`)
- **Checklist ข้อที่ไม่ผ่าน:** 2. IDOR (ความเสี่ยงแฝง)
- **รายละเอียดความเสี่ยง:** `deductStock` ตัดสต็อกด้วย `WHERE menu_id = ?` โดยไม่มี `branch_id` และไม่อยู่ใน transaction ถ้าสมาชิกในกลุ่มนำไปใช้ในฟีเจอร์ใหม่โดยไม่รู้ จะตัดสต็อกข้ามสาขาได้และเกิด race condition ได้
- **ระดับความรุนแรง:** **Low**

---

## 3. การแก้ไขที่ทำจริง

**แก้ไข:** ความเสี่ยง #3 — Lost update ของสต็อกใน `PUT /api/menu/:id`

**เหตุผลที่เลือกข้อนี้:** #3 เป็นความเสี่ยงที่รุนแรงที่สุดที่แก้จบได้ภายใน Workshop โดยไม่เปลี่ยนโครงสร้างระบบ และเกิดได้จากการใช้งานปกติทุกวัน ส่วน #1 (Critical) ต้องสร้างระบบ login, session/token และ role ใหม่ทั้งหมด พร้อมแก้ทุก endpoint และหน้าจอ จึงย้ายไปไว้ในแผนหัวข้อ 4

**แนวทาง:** ใช้ _optimistic concurrency (compare-and-set)_

- ถ้าจะตั้งสต็อกใหม่ client ต้องส่ง `expectedStockQuantity` (สต็อกที่เห็นตอนเปิดฟอร์ม) มาด้วย server จะ `UPDATE` เฉพาะเมื่อสต็อกปัจจุบันยังเท่ากับค่านั้น ซึ่งตรวจและเขียนใน `UPDATE` คำสั่งเดียว (atomic) ถ้าไม่ตรงจะตอบ `409` และไม่แก้ฟิลด์ใดเลย
- หน้าจอส่ง `stockQuantity` เฉพาะเมื่อผู้ใช้แก้ตัวเลขสต็อกจริง การแก้แค่ราคาหรือชื่อจึงไม่ไปแตะสต็อก

### โค้ดก่อนแก้

`code/src/models/menuModel.js`

```js
// แก้ไขเฉพาะฟิลด์ที่ส่งมา
exports.updateFields = async (
  menuId,
  branchId,
  { categoryId, name, price, stockQuantity },
) => {
  const [result] = await db.query(
    `UPDATE menu_item
     SET category_id = COALESCE(?, category_id),
         name = COALESCE(?, name),
         price = COALESCE(?, price),
         stock_quantity = COALESCE(?, stock_quantity)
     WHERE menu_id = ? AND branch_id = ?`,
    [
      categoryId ?? null,
      name ?? null,
      price ?? null,
      stockQuantity ?? null,
      menuId,
      branchId,
    ],
  );

  return result.affectedRows;
};
```

`code/src/controllers/menuController.js` (`updateMenu`)

```js
  const { name, price, stockQuantity } = body;
  // ... validation ...
  try {
    const affectedRows = await menuModel.updateFields(menuId, branchId, {
      categoryId,
      name: name === undefined ? undefined : name.trim(),
      price,
      stockQuantity,
    });

    // ส่งค่าเดิมซ้ำก็ถือว่าแก้ไขสำเร็จ ถ้าเมนูยังมีอยู่
    if (affectedRows === 0) {
      const menu = await menuModel.findByIdAndBranch(menuId, branchId);

      if (!menu) {
        return res.status(404).json({ error: "Menu item not found in this branch" });
      }
    }

    return res.json({ updated: true });
```

`code/web/script.js` (ฟอร์ม Edit Menu)

```js
    if (editingId) {
      await api("PUT", `/api/menu/${editingId}`, body); // body มี stockQuantity เสมอ
```

### โค้ดหลังแก้

`code/src/models/menuModel.js`

```js
// แก้ไขเฉพาะฟิลด์ที่ส่งมา
// ถ้าส่ง expectedStockQuantity จะแก้เฉพาะเมื่อสต็อกปัจจุบันยังเท่าเดิม (compare-and-set ใน UPDATE เดียว)
exports.updateFields = async (
  menuId,
  branchId,
  { categoryId, name, price, stockQuantity, expectedStockQuantity },
) => {
  const [result] = await db.query(
    `UPDATE menu_item
     SET category_id = COALESCE(?, category_id),
         name = COALESCE(?, name),
         price = COALESCE(?, price),
         stock_quantity = COALESCE(?, stock_quantity)
     WHERE menu_id = ? AND branch_id = ?
       AND (? IS NULL OR stock_quantity = ?)`,
    [
      categoryId ?? null,
      name ?? null,
      price ?? null,
      stockQuantity ?? null,
      menuId,
      branchId,
      expectedStockQuantity ?? null,
      expectedStockQuantity ?? null,
    ],
  );

  return result.affectedRows;
};
```

`code/src/controllers/menuController.js` (`updateMenu`)

```js
  const { name, price, stockQuantity, expectedStockQuantity } = body;
  // ... validation เดิม ...

  // ตั้งสต็อกเป็นค่าใหม่ต้องส่งสต็อกที่เห็นตอนเปิดฟอร์มมาด้วย
  // กันเขียนทับยอดที่ขายไประหว่างแก้ไข (lost update)
  if (stockQuantity !== undefined && !validStock(expectedStockQuantity)) {
    return res.status(400).json({
      error: "expectedStockQuantity is required when changing stockQuantity",
    });
  }

  try {
    const affectedRows = await menuModel.updateFields(menuId, branchId, {
      categoryId,
      name: name === undefined ? undefined : name.trim(),
      price,
      stockQuantity,
      expectedStockQuantity:
        stockQuantity === undefined ? undefined : expectedStockQuantity,
    });

    // ส่งค่าเดิมซ้ำก็ถือว่าแก้ไขสำเร็จ ถ้าเมนูยังมีอยู่และสต็อกไม่ถูกเปลี่ยนระหว่างนั้น
    if (affectedRows === 0) {
      const menu = await menuModel.findByIdAndBranch(menuId, branchId);

      if (!menu) {
        return res.status(404).json({ error: "Menu item not found in this branch" });
      }

      if (stockQuantity !== undefined && menu.stockQuantity !== expectedStockQuantity) {
        return res.status(409).json({
          error: `Stock changed to ${menu.stockQuantity} while editing, please check and save again`,
        });
      }
    }

    return res.json({ updated: true });
```

`code/web/script.js` (ฟอร์ม Edit Menu)

```js
let editingStock = null;
// openMenuForm(): editingStock = menu?.stockQuantity ?? null;

    if (editingId) {
      // ส่งสต็อกเฉพาะเมื่อแก้จริง พร้อมค่าที่เห็นตอนเปิดฟอร์ม ให้ server ตรวจว่าไม่มีการขายแทรก
      if (stockQuantity === editingStock) delete body.stockQuantity;
      else body.expectedStockQuantity = editingStock;
      await api("PUT", `/api/menu/${editingId}`, body);
  // ...
  } catch (err) {
    toast(err.message);
    // สต็อกอาจถูกขายไประหว่างแก้ไข โหลดค่าล่าสุดไว้เทียบในการบันทึกครั้งถัดไป
    if (editingId) {
      await loadMenus();
      const fresh = state.menus.find((m) => m.menuId === editingId);
      if (fresh) editingStock = fresh.stockQuantity;
    }
    return;
  }
```

API contract ในหัวข้อ 2 ของ `docs/wk13-integration-testing.md` ได้อัปเดตแถว `PUT /api/menu/:id` ให้ตรงกับพฤติกรรมใหม่แล้ว (เพิ่ม `expectedStockQuantity` และ `409`)

### ผลการทดสอบหลังแก้

ทดสอบกับฐานข้อมูลทดสอบที่โหลด `schema.sql` + `seed.sql` ใหม่

**ความเสี่ยงที่แก้ (R-C) — ก่อน / หลัง**

| สถานการณ์                                                        | ก่อนแก้                                     | หลังแก้                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| เปิดฟอร์มตอนสต็อก Latte = 20 → ขายแทรก 5 แก้ว → บันทึกการแก้ราคา | `200` สต็อกกลายเป็น **20** (ผิด ควรเป็น 15) | `409 "Stock changed to 13 while editing…"` สต็อกคงเป็นค่าจริง ราคาไม่ถูกแก้ครึ่ง ๆ กลาง ๆ |

(รอบหลังแก้รันต่อจาก e2e จึงมีสต็อกตั้งต้น 18 → 13 แต่ลำดับเหตุการณ์เหมือนกัน)

**Edge case ของ `PUT /api/menu/7` (Chocolate สต็อก 40 ราคา 70)**

| Request body                                                          | ผล    | สถานะหลังเรียก                        |
| --------------------------------------------------------------------- | ----- | ------------------------------------- |
| `{ branchId, price: 75 }` แก้ราคาอย่างเดียว                           | `200` | ราคา 75 · สต็อก 40 (ไม่ถูกแตะ)        |
| `{ branchId, stockQuantity: 50 }` ไม่ส่งค่าที่คาดไว้                  | `400` | ไม่เปลี่ยน                            |
| `{ branchId, stockQuantity: 50, expectedStockQuantity: 40 }`          | `200` | สต็อก 50                              |
| ส่งค่าเดิมซ้ำทั้งหมด (`expectedStockQuantity: 50`)                    | `200` | ไม่เปลี่ยน                            |
| `{ price: 99, stockQuantity: 60, expectedStockQuantity: 40 }` ค่าเก่า | `409` | ราคา 75 · สต็อก 50 (ไม่แก้ทั้งคำสั่ง) |
| `expectedStockQuantity: -1`                                           | `400` | ไม่เปลี่ยน                            |
| เมนูที่ไม่มีอยู่ (`/api/menu/9999`)                                   | `404` | –                                     |

**Regression — ยังทำงานตาม Acceptance Criteria เดิม**

- `npm run test:e2e` (TC-13-01 ถึง TC-13-08 ครอบคลุม US-01 สร้างออเดอร์, US-02 คำนวณราคารวม, US-03 ชำระเงิน, US-07 ตัดสต็อก, US-08 รายงานยอดขาย): **8/8 ผ่าน**
- Race test ของ endpoint อื่นยังผ่านเหมือนเดิม: R-A (20 ออเดอร์พร้อมกัน สต็อก 8) สำเร็จ 8 สต็อกเหลือ 0 · R-B (ยกเลิกซ้ำพร้อมกัน 5 ครั้ง) คืนสต็อกครั้งเดียว
- US-06 (จัดการเมนู): AC "เพิ่มหรือแก้ไขเมนู → ระบบบันทึกข้อมูล" ยังผ่าน (ดูตาราง ข) และตอนนี้สอดคล้องกับ AC ของ US-07 "จำนวนคงเหลือต้องถูกต้อง 100%" ด้วย
- `node --check` ไฟล์ที่แก้ทั้ง 3 ไฟล์ผ่าน
- **ยังไม่ได้ทดสอบ:** การกดฟอร์ม Edit Menu ผ่าน browser จริง (ทดสอบเฉพาะระดับ API) — ต้องให้สมาชิกเปิดหน้า POS แล้วลอง (1) แก้ราคาอย่างเดียว (2) แก้สต็อก (3) เปิดฟอร์มค้างไว้ แล้วขายเมนูนั้นจากอีกแท็บก่อนกดบันทึก ซึ่งต้องขึ้น toast แจ้งว่าสต็อกเปลี่ยน

---

## 4. แผนการแก้ไขที่เหลือ

| ความเสี่ยง #                                                       | ระดับความรุนแรง | เหตุผลที่ยังไม่แก้                                                                                                                                                                    | แนวทางที่ควรทำต่อ                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1 ไม่มีการยืนยันตัวตน / IDOR ทุก endpoint                         | Critical        | ต้องเพิ่มฟีเจอร์ใหม่ทั้งชุด (ตาราง user/รหัสผ่าน, login, session หรือ token, role) และแก้ทุก endpoint กับหน้าจอ เกินขอบเขต Workshop 1 สัปดาห์ และกระทบ API contract ที่ตกลงไว้ใน wk13 | เพิ่ม `POST /api/login` ที่ออก session/JWT ซึ่งเก็บ `employeeId`, `branchId`, `role` แล้วทำ middleware ที่ดึงค่าเหล่านี้จาก token แทนการรับจาก client กำหนด role: `cashier` สร้าง/ดูออเดอร์ได้เฉพาะสาขาตัวเอง ส่วน `manager` จัดการเมนู ยกเลิกออเดอร์ และดูรายงาน เขียน test ว่า token สาขา 1 เรียกข้อมูลสาขา 2 ต้องได้ `403` — **ควรทำเป็นลำดับแรกก่อนใช้งานจริง** |
| #2 ยกเลิกออเดอร์ลบถาวร ไม่มี audit                                 | High            | ถ้าเปลี่ยนเป็น soft delete ต้องแก้ schema และทุก query รายงาน/ประวัติให้กรองออเดอร์ที่ยกเลิก จึงควรทำพร้อม #1 เพื่อบันทึกได้ว่า "ใคร" เป็นคนยกเลิก                                    | เพิ่มคอลัมน์ `status`, `cancelled_at`, `cancelled_by`, `cancel_reason` ใน `orders` แล้วเปลี่ยน `DELETE` เป็น `UPDATE status='cancelled'` ให้รายงานนับเฉพาะ `status='paid'` จำกัดให้ manager ยกเลิกได้ และยกเลิกได้เฉพาะออเดอร์ของวันเดียวกัน                                                                                                                        |
| #4 ปรับสต็อกด้วยมือไม่ลง `stock_movement`                          | Medium          | ต้องเพิ่มคอลัมน์ประเภทการเคลื่อนไหว (`sale` / `cancel` / `adjust`) ใน `stock_movement` เพื่อแยกที่มา ซึ่งกระทบ schema ที่ใช้ทดสอบ wk13                                                | หลังแก้ #3 แล้วรู้ค่าต่างได้เลย (`stockQuantity − expectedStockQuantity`) ให้ทำ `UPDATE` + `INSERT stock_movement` ใน transaction เดียวกับ `createOrder` และบันทึกการสร้างเมนูพร้อมสต็อกตั้งต้นด้วย                                                                                                                                                                 |
| #5 Error response ไม่ตรง (413, 404 HTML, deadlock ตอนยกเลิก)       | Low             | ไม่มีข้อมูลรั่ว และไม่กระทบการใช้งานปกติผ่านหน้าจอ                                                                                                                                    | ใน error handler ของ `app.js` ใช้ข้อความตาม `err.status` (`413 → "Request body too large"`) เพิ่ม `app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }))` ก่อน error handler และใน `deleteOrder` แปลง `ER_LOCK_DEADLOCK` / `ER_LOCK_WAIT_TIMEOUT` เป็น `409` แบบเดียวกับ `createOrder`                                                        |
| #6 สาขาที่ไม่มีจริงได้ `200 []` และ response ไม่จำกัดขนาด          | Low             | ข้อมูลปัจจุบันยังน้อย ไม่กระทบเวลาตอบสนอง                                                                                                                                             | ตรวจว่าสาขามีอยู่จริงแล้วตอบ `404` เพิ่ม `from` / `to` (ช่วงวันที่ตาม AC US-08) และ `limit` / `offset` ให้ `GET /api/orders/branch/:branch_id` และ `GET /api/reports/sales`                                                                                                                                                                                         |
| #7 `deductStock` / `findManyForStockCheck` ไม่ได้ใช้และไม่ตรวจสาขา | Low             | ไม่มี endpoint ใดเรียกใช้ จึงยังไม่มีผลกับระบบ                                                                                                                                        | ลบสองฟังก์ชันนี้ออกจาก `menuModel.js` เพราะ `orderModel.createOrder` ทำหน้าที่แทนแล้วอย่างถูกต้อง (ตรวจสาขา + transaction)                                                                                                                                                                                                                                          |
