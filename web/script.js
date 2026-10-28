"use strict";
const $ = (selector) => document.querySelector(selector);
const money = (value) =>
  Number(value).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

// ต้องตรงกับ LOW_STOCK_THRESHOLD ใน src/models/menuModel.js
const LOW_STOCK_THRESHOLD = 10;
const paymentLabels = { cash: "เงินสด", qr: "QR Code", card: "บัตร" };
const drinkColors = [
  { color: "#75503b", bg: "#e8e6d9" },
  { color: "#8d9c64", bg: "#e4ebd6" },
  { color: "#77503d", bg: "#e9dfd5" },
  { color: "#bb7b32", bg: "#f1ead5" },
];

// ทุกการเรียก API ใช้ JSON แบบ camelCase ตาม API contract
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `เกิดข้อผิดพลาด (HTTP ${res.status})`);
  return data;
}

const state = {
  branches: [],
  categories: [],
  menus: [],
  branchId: null,
  employee: null,
};
let cart = [];
let category = "all";
let editingId = null;
let toastTimer;

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2800);
}
function branchName() {
  return state.branches.find((b) => b.branchId === state.branchId)?.name || "";
}
function rememberBranch(id) {
  try {
    localStorage.setItem("cafe-pos-branch", String(id));
  } catch {}
}
function savedBranch() {
  try {
    return Number(localStorage.getItem("cafe-pos-branch"));
  } catch {
    return null;
  }
}

async function init() {
  try {
    [state.branches, state.categories] = await Promise.all([
      api("GET", "/api/branches"),
      api("GET", "/api/categories"),
    ]);
  } catch (err) {
    $("#branch-status").textContent = "เชื่อมต่อ server ไม่ได้";
    $("#branch-status").classList.add("offline");
    toast(err.message);
    return;
  }
  $("#branch-select").innerHTML = state.branches
    .map((b) => `<option value="${b.branchId}">${escapeHTML(b.name)}</option>`)
    .join("");
  $("#menu-category").innerHTML = state.categories
    .map(
      (c) => `<option value="${c.categoryId}">${escapeHTML(c.name)}</option>`,
    )
    .join("");
  renderFilters();
  const saved = savedBranch();
  await selectBranch(
    state.branches.some((b) => b.branchId === saved)
      ? saved
      : state.branches[0]?.branchId,
  );
}

async function selectBranch(id) {
  if (!id) return;
  state.branchId = id;
  $("#branch-select").value = String(id);
  rememberBranch(id);
  // ตะกร้าผูกกับเมนูของสาขาเดิม จึงต้องล้างเมื่อเปลี่ยนสาขา
  cart = [];
  $("#order-error").textContent = "";
  try {
    const employees = await api("GET", `/api/branches/${id}/employees`);
    state.employee = employees[0] || null;
    $("#employee-name").textContent =
      state.employee?.name || "ไม่พบพนักงานในสาขานี้";
    $("#employee-branch").textContent = "สาขา " + branchName();
    $("#branch-status").innerHTML = "พร้อมรับออร์เดอร์ <i></i>";
    $("#branch-status").classList.remove("offline");
  } catch (err) {
    toast(err.message);
  }
  await loadMenus();
  await loadReports();
}
$("#branch-select").onchange = (e) => selectBranch(Number(e.target.value));

async function loadMenus() {
  try {
    state.menus = await api("GET", `/api/menu?branchId=${state.branchId}`);
  } catch (err) {
    state.menus = [];
    toast(err.message);
  }
  // ตัดรายการในตะกร้าที่เมนูถูกลบหรือสต็อกไม่พอแล้ว
  cart = cart
    .map((i) => {
      const m = state.menus.find((menu) => menu.menuId === i.menuId);
      return m ? { ...i, qty: Math.min(i.qty, m.stockQuantity) } : null;
    })
    .filter((i) => i && i.qty > 0);
  renderCart();
  renderMenus();
}

function renderFilters() {
  $("#filters").innerHTML =
    `<button class="${category === "all" ? "selected" : ""}" data-category="all">ทั้งหมด</button>` +
    state.categories
      .map(
        (c) =>
          `<button class="${category === c.categoryId ? "selected" : ""}" data-category="${c.categoryId}">${escapeHTML(c.name)}</button>`,
      )
      .join("");
}
function cartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}
function renderProducts() {
  const search = $("#search").value.trim().toLowerCase();
  const menus = state.menus.filter(
    (m) =>
      (category === "all" || m.categoryId === category) &&
      (m.name + " " + m.categoryName).toLowerCase().includes(search),
  );
  $("#menu-count").textContent = `${state.menus.length} เมนู`;
  $("#products").innerHTML = menus.length
    ? menus
        .map((m) => {
          const look = drinkColors[(m.categoryId - 1) % drinkColors.length];
          const remaining =
            m.stockQuantity -
            (cart.find((i) => i.menuId === m.menuId)?.qty || 0);
          // FR-09: เมนูที่หมด (หรือหยิบลงตะกร้าครบแล้ว) กดเพิ่มไม่ได้ตั้งแต่หน้าจอเลือกเมนู
          return `<article class="product${m.stockQuantity === 0 ? " sold-out" : ""}"><div class="drink-art" style="--drink-bg:${look.bg};--drink-color:${look.color}"><div class="cup" aria-hidden="true"></div><span class="stock-badge ${remaining < LOW_STOCK_THRESHOLD ? "low" : ""}">${m.stockQuantity === 0 ? "หมด" : `เหลือ ${remaining} แก้ว`}</span></div><h3>${escapeHTML(m.name)}</h3><p class="thai-name">${escapeHTML(m.categoryName)}</p><div class="product-bottom"><span class="price">฿${money(m.price)} <small>/ แก้ว</small></span><button class="add-product" data-add="${m.menuId}" aria-label="เพิ่ม ${escapeHTML(m.name)}" ${remaining <= 0 ? "disabled" : ""}>+</button></div></article>`;
        })
        .join("")
    : '<p class="empty">ไม่พบเมนูที่ค้นหา</p>';
}
function renderCart() {
  $("#cart-count").textContent = cart.reduce((n, i) => n + i.qty, 0);
  $("#cart-items").innerHTML = cart.length
    ? cart
        .map(
          (i) =>
            `<div class="cart-item"><div class="mini-cup" aria-hidden="true">☕</div><div class="cart-item-body"><strong>${escapeHTML(i.name)}</strong><small>฿${money(i.price)} / แก้ว</small><div class="item-bottom"><div class="quantity"><button data-qty="${i.menuId}" data-step="-1" aria-label="ลดจำนวน ${escapeHTML(i.name)}">−</button><span>${i.qty}</span><button data-qty="${i.menuId}" data-step="1" aria-label="เพิ่มจำนวน ${escapeHTML(i.name)}">+</button></div><strong>฿${money(i.price * i.qty)}</strong></div></div><button class="remove" data-remove="${i.menuId}" aria-label="ลบ ${escapeHTML(i.name)}">×</button></div>`,
        )
        .join("")
    : '<div class="empty"><span class="empty-icon">☕</span>ยังไม่มีรายการที่เลือก<br>เพิ่มเครื่องดื่มแก้วโปรดเพื่อเริ่มออร์เดอร์</div>';
  $("#total").textContent = "฿" + money(cartTotal());
  $("#checkout").disabled = !cart.length;
  $("#clear-cart").disabled = !cart.length;
  updateChange();
  renderProducts();
}
function addItem(menuId) {
  const menu = state.menus.find((m) => m.menuId === menuId);
  if (!menu) return;
  const item = cart.find((i) => i.menuId === menuId);
  if ((item?.qty || 0) >= menu.stockQuantity) {
    toast("จำนวนเกินสต็อกที่มี");
    return;
  }
  if (item) item.qty++;
  else cart.push({ menuId, name: menu.name, price: menu.price, qty: 1 });
  $("#order-error").textContent = "";
  renderCart();
}
$("#products").addEventListener("click", (e) => {
  const b = e.target.closest("[data-add]");
  if (b) addItem(Number(b.dataset.add));
});
$("#cart-items").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.remove)
    cart = cart.filter((i) => i.menuId !== Number(b.dataset.remove));
  else if (b.dataset.qty) {
    const menuId = Number(b.dataset.qty);
    if (b.dataset.step === "1") {
      addItem(menuId);
      return;
    }
    const item = cart.find((i) => i.menuId === menuId);
    if (item) item.qty--;
    cart = cart.filter((i) => i.qty > 0);
  }
  renderCart();
});
$("#clear-cart").onclick = () => {
  cart = [];
  $("#order-error").textContent = "";
  renderCart();
};
$("#search").oninput = renderProducts;
$("#filters").onclick = (e) => {
  const b = e.target.closest("[data-category]");
  if (!b) return;
  category = b.dataset.category === "all" ? "all" : Number(b.dataset.category);
  renderFilters();
  renderProducts();
};
function updateChange() {
  const cash = $('input[name="payment"]:checked')?.value === "cash";
  $("#cash-field").hidden = !cash;
  const received = Number($("#cash-received").value);
  $("#change").textContent =
    cash && $("#cash-received").value !== "" && received >= cartTotal()
      ? `เงินทอน ฿${money(received - cartTotal())}`
      : "";
}
document.querySelectorAll('[name="payment"]').forEach(
  (r) =>
    (r.onchange = () => {
      $("#order-error").textContent = "";
      updateChange();
    }),
);
$("#cash-received").oninput = updateChange;
$("#checkout").onclick = async () => {
  const payment = $('input[name="payment"]:checked')?.value;
  const total = cartTotal();
  const received = Number($("#cash-received").value);
  let error = "";
  if (!cart.length) error = "กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ";
  else if (!payment) error = "กรุณาเลือกวิธีชำระเงิน";
  else if (
    payment === "cash" &&
    (!Number.isFinite(received) || received < total)
  )
    error = "กรุณาระบุเงินที่รับมาให้เพียงพอกับยอดชำระ";
  else if (!state.employee) error = "ไม่พบพนักงานของสาขานี้ในระบบ";
  if (error) {
    $("#order-error").textContent = error;
    return;
  }
  $("#checkout").disabled = true;
  try {
    // ราคาและยอดรวมจริงคำนวณที่ backend จากราคาในฐานข้อมูล
    const result = await api("POST", "/api/orders", {
      branchId: state.branchId,
      employeeId: state.employee.employeeId,
      paymentMethod: payment,
      items: cart.map((i) => ({ menuId: i.menuId, quantity: i.qty })),
    });
    const order = {
      orderId: result.orderId,
      date: new Date().toISOString(),
      items: cart.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
      total: result.totalAmount,
      payment,
      received: payment === "cash" ? received : result.totalAmount,
      change:
        payment === "cash"
          ? Math.round((received - result.totalAmount) * 100) / 100
          : 0,
    };
    cart = [];
    $("#cash-received").value = "";
    document
      .querySelectorAll('[name="payment"]')
      .forEach((r) => (r.checked = false));
    $("#order-error").textContent = "";
    showReceipt(order);
  } catch (err) {
    // เช่น 400 สต็อกไม่พอ — แสดงข้อความจาก backend ตรง ๆ
    $("#order-error").textContent = err.message;
  }
  await loadMenus();
  loadReports();
};
function showReceipt(order) {
  const paid =
    order.received === undefined
      ? ""
      : `<br>รับเงิน: ฿${money(order.received)}<br>เงินทอน: ฿${money(order.change)}`;
  $("#receipt").innerHTML =
    `<div class="receipt-brand">🌿 brue rim lay Coffee</div><div class="receipt-sub">ใบเสร็จรับเงิน · สาขา ${escapeHTML(branchName())}</div><div class="receipt-info">เลขที่ #${escapeHTML(order.orderId)}<br>${new Date(order.date).toLocaleString("th-TH")}<br>พนักงาน: ${escapeHTML(state.employee?.name || "-")}</div><div class="receipt-lines">${order.items.map((i) => `<div class="receipt-line"><span>${escapeHTML(i.name)} × ${i.qty}<small>฿${money(i.price)} / แก้ว</small></span><span>฿${money(i.price * i.qty)}</span></div>`).join("")}</div><div class="receipt-total"><span>รวมทั้งหมด</span><span>฿${money(order.total)}</span></div><div class="receipt-info">ชำระโดย: ${paymentLabels[order.payment] || escapeHTML(order.payment)}${paid}</div><div class="receipt-thanks">ขอบคุณที่ให้เราเป็นส่วนหนึ่งของวันดี ๆ ♡<small>ใบเสร็จจากระบบตัวอย่าง</small></div>`;
  $("#receipt-dialog").showModal();
}
$("#print").onclick = () => window.print();
document
  .querySelectorAll(".close-dialog")
  .forEach((b) => (b.onclick = () => b.closest("dialog").close()));
const pageNames = {
  order: ["รายการสั่งซื้อใหม่", "brue rim lay · กินแล้วเสร็จ"],
  menus: ["จัดการเมนู", "ดูแลเมนู ราคา และสต็อกเครื่องดื่มของร้าน"],
  reports: ["รายงานยอดขาย", "ทุกแก้วที่เสิร์ฟ สู่ภาพรวมการขายของคุณ"],
};
document.querySelectorAll(".nav").forEach(
  (b) =>
    (b.onclick = () => {
      document
        .querySelectorAll(".nav")
        .forEach((n) => n.classList.toggle("active", n === b));
      document
        .querySelectorAll(".page")
        .forEach((p) => (p.hidden = p.id !== b.dataset.page + "-page"));
      $("#page-title").textContent = pageNames[b.dataset.page][0];
      $("#page-subtitle").textContent = pageNames[b.dataset.page][1];
      if (b.dataset.page === "reports") loadReports();
    }),
);
function renderMenus() {
  $("#menu-table").innerHTML =
    state.menus
      .map(
        (m) =>
          `<tr><td>☕ ${escapeHTML(m.name)}</td><td>${escapeHTML(m.categoryName)}</td><td>${money(m.price)}</td><td>${m.stockQuantity === 0 ? "หมด" : m.stockQuantity}</td><td><button data-edit="${m.menuId}">แก้ไข</button><button class="delete" data-delete="${m.menuId}">ลบ</button></td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="5">ยังไม่มีเมนู เพิ่มเมนูใหม่เพื่อเริ่มใช้งาน</td></tr>';
}
function openMenuForm(menu) {
  editingId = menu?.menuId || null;
  $("#form-title").textContent = menu ? "แก้ไขเมนู" : "เพิ่มเมนูใหม่";
  $("#menu-name").value = menu?.name || "";
  $("#menu-category").value = String(
    menu?.categoryId || state.categories[0]?.categoryId || "",
  );
  $("#menu-price").value = menu?.price || "";
  $("#menu-stock").value = menu?.stockQuantity ?? 0;
  $("#menu-dialog").showModal();
}
$("#add-menu").onclick = () => openMenuForm();
$("#menu-table").onclick = async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.edit)
    openMenuForm(state.menus.find((m) => m.menuId === Number(b.dataset.edit)));
  else if (b.dataset.delete && confirm("ต้องการลบเมนูนี้หรือไม่?")) {
    try {
      await api(
        "DELETE",
        `/api/menu/${b.dataset.delete}?branchId=${state.branchId}`,
      );
      toast("ลบเมนูเรียบร้อย");
    } catch (err) {
      toast(err.message);
    }
    await loadMenus();
  }
};
$("#menu-form").onsubmit = async (e) => {
  e.preventDefault();
  const name = $("#menu-name").value.trim(),
    price = Number($("#menu-price").value),
    stockQuantity = Number($("#menu-stock").value),
    categoryId = Number($("#menu-category").value);
  if (
    !name ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isInteger(stockQuantity) ||
    stockQuantity < 0
  ) {
    toast("กรุณาตรวจสอบชื่อ ราคา และจำนวนสต็อก");
    return;
  }
  const body = {
    branchId: state.branchId,
    categoryId,
    name,
    price,
    stockQuantity,
  };
  try {
    if (editingId) {
      await api("PUT", `/api/menu/${editingId}`, body);
      cart = cart.filter((i) => i.menuId !== editingId);
      toast("บันทึกแล้ว กรุณาเพิ่มเมนูที่แก้ไขในออร์เดอร์อีกครั้ง");
    } else {
      await api("POST", "/api/menu", body);
      toast("เพิ่มเมนูเรียบร้อย");
    }
  } catch (err) {
    toast(err.message);
    return;
  }
  $("#menu-dialog").close();
  await loadMenus();
};
async function loadReports() {
  $("#report-branch").textContent = "· สาขา " + branchName();
  let sales, orders;
  try {
    [sales, orders] = await Promise.all([
      api("GET", `/api/reports/sales?branchId=${state.branchId}`),
      api("GET", `/api/orders/branch/${state.branchId}`),
    ]);
  } catch (err) {
    toast(err.message);
    return;
  }
  // backend แปลง SUM (DECIMAL) เป็น number แล้วตาม API contract
  $("#sales-total").textContent = money(
    sales.reduce((s, row) => s + row.totalSales, 0),
  );
  $("#sales-orders").textContent = orders.length;
  $("#sales-cups").textContent = sales.reduce(
    (n, row) => n + row.totalQuantity,
    0,
  );
  $("#sales-table").innerHTML =
    sales
      .map(
        (row) =>
          `<tr><td>${escapeHTML(row.name)}</td><td>${row.totalQuantity}</td><td>${money(row.totalSales)}</td></tr>`,
      )
      .join("") || '<tr><td colspan="3">ยังไม่มียอดขายในสาขานี้</td></tr>';
  $("#history").innerHTML =
    orders
      .map(
        (o) =>
          `<div class="history-row"><div><strong>#${o.orderId}</strong><small>${new Date(o.createdAt).toLocaleString("th-TH")} · ${paymentLabels[o.paymentMethod] || escapeHTML(o.paymentMethod)}</small></div><strong>฿${money(o.totalAmount)}</strong><button class="secondary" data-receipt="${o.orderId}">ใบเสร็จ</button></div>`,
      )
      .join("") || '<p class="empty">ออร์เดอร์ที่ยืนยันแล้วจะแสดงที่นี่</p>';
}
$("#refresh-report").onclick = loadReports;
$("#history").onclick = async (e) => {
  const b = e.target.closest("[data-receipt]");
  if (!b) return;
  try {
    const o = await api(
      "GET",
      `/api/orders/${b.dataset.receipt}?branchId=${state.branchId}`,
    );
    showReceipt({
      orderId: o.orderId,
      date: o.createdAt,
      items: o.items.map((i) => ({
        name: i.menuName,
        qty: i.quantity,
        price: i.unitPrice,
      })),
      total: o.totalAmount,
      payment: o.paymentMethod,
    });
  } catch (err) {
    toast(err.message);
  }
};
$("#today").textContent = new Date().toLocaleDateString("th-TH", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
renderCart();
init();
