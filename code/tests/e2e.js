// E2E: order -> payment -> report ตาม TC-13-01..08
// usage: npm run test:e2e  (ต้องรัน server และใช้ฐานข้อมูลที่เพิ่งโหลด schema.sql + seed.sql ใหม่)
// ระวัง: สคริปต์นี้สร้างออเดอร์จริงในฐานข้อมูลที่ตั้งไว้ใน .env
require("dotenv").config();
const BASE = process.argv[2] || `http://localhost:${process.env.PORT || 3000}`;
const mysql = require("mysql2/promise");

const results = [];
function record(id, pass, actual) {
  results.push({ id, pass, actual });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} :: ${actual}`);
}
async function api(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { json = text.slice(0, 80); }
  return { status: res.status, json };
}

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  const q = async (sql, p) => (await db.query(sql, p))[0];
  const stock = async (id) => (await q("SELECT stock_quantity s FROM menu_item WHERE menu_id=?", [id]))[0].s;
  const orderCount = async (b) => (await q("SELECT COUNT(*) n FROM orders WHERE branch_id=?", [b]))[0].n;

  // TC-13-01: เลือกสาขา 1 แล้วเลือก ลาเต้ x2 + อเมริกาโน x1 -> ยอดตะกร้า 190
  {
    const page = await fetch(BASE + "/").then((r) => r.status).catch(() => 0);
    const r = await api("GET", "/api/menu?branchId=1");
    const list = Array.isArray(r.json) ? r.json : [];
    const latte = list.find((m) => m.menuId === 1);
    const ame = list.find((m) => m.menuId === 2);
    const total = latte && ame ? latte.price * 2 + ame.price * 1 : NaN;
    const ok = page === 200 && r.status === 200 && total === 190 &&
      typeof latte.stockQuantity === "number";
    record("TC-13-01", ok,
      `GET / -> ${page}; GET /api/menu -> ${r.status}; keys=${Object.keys(list[0] || {}).join(",")}; cartTotal=${total}`);
  }

  // TC-13-02: สั่ง ลาเต้ x2 เงินสด สาขา 1
  let orderA;
  {
    const r = await api("POST", "/api/orders", {
      branchId: 1, employeeId: 1, paymentMethod: "cash", items: [{ menuId: 1, quantity: 2 }],
    });
    orderA = r.json && r.json.orderId;
    const row = orderA ? (await q("SELECT branch_id FROM orders WHERE order_id=?", [orderA]))[0] : null;
    const receipt = orderA ? await api("GET", `/api/orders/${orderA}?branchId=1`) : { status: 0, json: {} };
    const ok = r.status === 201 && r.json.totalAmount === 130 && row && row.branch_id === 1 &&
      receipt.status === 200 && receipt.json.totalAmount === 130;
    record("TC-13-02", ok,
      `POST -> ${r.status} ${JSON.stringify(r.json)}; orders.branch_id=${row && row.branch_id}; receipt keys=${Object.keys(receipt.json || {}).join(",")}`);
  }

  // TC-13-03: สต็อกลาเต้สาขา 1 = 18, สาขา 2 ยังเป็น 15
  {
    const a = await stock(1), b = await stock(9);
    record("TC-13-03", a === 18 && b === 15, `latte A=${a} (expect 18), latte B=${b} (expect 15)`);
  }

  // TC-13-04: รายงานสาขา 1 มีลาเต้ 2 แก้ว 130 บาท เป็น number
  {
    const r = await api("GET", "/api/reports/sales?branchId=1");
    const row = Array.isArray(r.json) ? r.json.find((x) => x.menuId === 1) : null;
    const ok = r.status === 200 && row && row.totalQuantity === 2 && row.totalSales === 130;
    record("TC-13-04", ok, `GET report A -> ${r.status} ${JSON.stringify(r.json)}`);
  }

  // TC-13-05: เอสเพรสโซสาขา 1 สต็อก 1 สั่ง 5 -> 400 และไม่บันทึกออเดอร์
  {
    const before = await orderCount(1);
    const r = await api("POST", "/api/orders", {
      branchId: 1, employeeId: 1, paymentMethod: "cash", items: [{ menuId: 3, quantity: 5 }],
    });
    const after = await orderCount(1);
    const ok = r.status === 400 && typeof r.json.error === "string" && before === after && (await stock(3)) === 1;
    record("TC-13-05", ok, `POST -> ${r.status} ${JSON.stringify(r.json)}; orders A ${before}->${after}`);
  }

  // TC-13-06: สาขา 2 ลาเต้ x3 -> สต็อก 12, รายงาน B มี 3/195, สาขา A ไม่เปลี่ยน
  {
    const r = await api("POST", "/api/orders", {
      branchId: 2, employeeId: 2, paymentMethod: "cash", items: [{ menuId: 9, quantity: 3 }],
    });
    const row = r.json && r.json.orderId
      ? (await q("SELECT branch_id FROM orders WHERE order_id=?", [r.json.orderId]))[0] : null;
    const repB = await api("GET", "/api/reports/sales?branchId=2");
    const repA = await api("GET", "/api/reports/sales?branchId=1");
    const bRow = Array.isArray(repB.json) ? repB.json.find((x) => x.menuId === 9) : null;
    const aRow = Array.isArray(repA.json) ? repA.json.find((x) => x.menuId === 1) : null;
    const sA = await stock(1), sB = await stock(9);
    const ok = r.status === 201 && row && row.branch_id === 2 && sB === 12 && sA === 18 &&
      bRow && bRow.totalQuantity === 3 && bRow.totalSales === 195 &&
      Array.isArray(repB.json) && repB.json.length === 1 &&
      aRow && aRow.totalQuantity === 2 && aRow.totalSales === 130 && repA.json.length === 1;
    record("TC-13-06", ok,
      `POST B -> ${r.status}; orders.branch_id=${row && row.branch_id}; stock A=${sA} B=${sB}; report B=${JSON.stringify(repB.json)}; report A=${JSON.stringify(repA.json)}`);
  }

  // TC-13-07: เมนูสต็อก 0 พอดี (อเมริกาโนเย็น) -> 400
  {
    const r = await api("POST", "/api/orders", {
      branchId: 1, employeeId: 1, paymentMethod: "qr", items: [{ menuId: 8, quantity: 1 }],
    });
    record("TC-13-07", r.status === 400 && (await stock(8)) === 0, `POST -> ${r.status} ${JSON.stringify(r.json)}`);
  }

  // TC-13-08: รายงานไม่ระบุ branchId -> 400
  {
    const r = await api("GET", "/api/reports/sales");
    record("TC-13-08", r.status === 400, `GET report (no branchId) -> ${r.status} ${JSON.stringify(r.json)}`);
  }

  await db.end();
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\nSUMMARY: ${results.length - failed}/${results.length} passed`);
  process.exitCode = failed ? 1 : 0;
})();
