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
const initialMenus = [
  {
    id: "americano",
    name: "Americano",
    thai: "อเมริกาโน",
    category: "coffee",
    price: 60,
    stock: 40,
    color: "#75503b",
    bg: "#e8e6d9",
  },
  {
    id: "latte",
    name: "Latte",
    thai: "ลาเต้",
    category: "coffee",
    price: 65,
    stock: 24,
    color: "#be946b",
    bg: "#eee6d7",
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    thai: "คาปูชิโน",
    category: "coffee",
    price: 65,
    stock: 8,
    color: "#aa805b",
    bg: "#e5e9dd",
  },
  {
    id: "mocha",
    name: "Mocha",
    thai: "มอคค่า",
    category: "coffee",
    price: 70,
    stock: 20,
    color: "#825b48",
    bg: "#ede2d8",
  },
  {
    id: "matcha",
    name: "Matcha Latte",
    thai: "มัทฉะลาเต้",
    category: "tea",
    price: 95,
    stock: 50,
    color: "#8d9c64",
    bg: "#e4ebd6",
  },
  {
    id: "chocolate",
    name: "Chocolate",
    thai: "ช็อกโกแลต",
    category: "other",
    price: 70,
    stock: 40,
    color: "#77503d",
    bg: "#e9dfd5",
  },
  {
    id: "lemon",
    name: "Lemon Tea",
    thai: "ชามะนาว",
    category: "tea",
    price: 65,
    stock: 30,
    color: "#bb7b32",
    bg: "#f1ead5",
  },
  {
    id: "espresso",
    name: "Espresso",
    thai: "เอสเปรสโซ",
    category: "coffee",
    price: 55,
    stock: 15,
    color: "#563f31",
    bg: "#e3e5da",
  },
  {
    id: "iced-americano",
    name: "Iced Americano",
    thai: "อเมริกาโนเย็น",
    category: "coffee",
    price: 65,
    stock: 0,
    color: "#624637",
    bg: "#e5e6df",
  },
];
let storageAvailable = true;
function loadState() {
  try {
    const raw = localStorage.getItem("baimai-pos-v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed.menus) &&
        Array.isArray(parsed.orders) &&
        parsed.menus.every(
          (m) =>
            typeof m.id === "string" &&
            typeof m.name === "string" &&
            Number.isFinite(m.price) &&
            m.price > 0 &&
            Number.isInteger(m.stock) &&
            m.stock >= 0,
        )
      )
        return parsed;
    }
  } catch {
    storageAvailable = false;
  }
  return { menus: structuredClone(initialMenus), orders: [] };
}
let state = loadState();
let cart = [];
let category = "all";
let editingId = null;
let toastTimer;
function save() {
  try {
    localStorage.setItem("baimai-pos-v1", JSON.stringify(state));
  } catch {
    storageAvailable = false;
    toast("บันทึกในเบราว์เซอร์ไม่ได้ ข้อมูลจะอยู่เฉพาะรอบนี้");
  }
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2800);
}
const categories = { coffee: "กาแฟ", tea: "ชาและมัทฉะ", other: "อื่น ๆ" };
function cartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}
function renderProducts() {
  const search = $("#search").value.trim().toLowerCase();
  const menus = state.menus.filter(
    (m) =>
      (category === "all" || m.category === category) &&
      (m.name + " " + (m.thai || "")).toLowerCase().includes(search),
  );
  $("#menu-count").textContent = `${state.menus.length} เมนู`;
  $("#products").innerHTML = menus.length
    ? menus
        .map((m) => {
          const remaining =
            m.stock - (cart.find((i) => i.id === m.id)?.qty || 0);
          return `<article class="product"><div class="drink-art" style="--drink-bg:${safeColor(m.bg, "#e8e6d9")};--drink-color:${safeColor(m.color, "#a87345")}"><div class="cup" aria-hidden="true"></div><span class="stock-badge ${remaining <= 8 ? "low" : ""}">${remaining === 0 ? "หมดชั่วคราว" : `เหลือ ${remaining} แก้ว`}</span></div><h3>${escapeHTML(m.name)}</h3><p class="thai-name">${escapeHTML(m.thai || categories[m.category] || "เครื่องดื่ม")}</p><div class="product-bottom"><span class="price">฿${money(m.price)} <small>/ แก้ว</small></span><button class="add-product" data-add="${escapeHTML(m.id)}" aria-label="เพิ่ม ${escapeHTML(m.name)}" ${remaining <= 0 ? "disabled" : ""}>+</button></div></article>`;
        })
        .join("")
    : '<p class="empty">ไม่พบเมนูที่ค้นหา</p>';
}
function safeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
}
function renderCart() {
  $("#cart-count").textContent = cart.reduce((n, i) => n + i.qty, 0);
  $("#cart-items").innerHTML = cart.length
    ? cart
        .map(
          (i) =>
            `<div class="cart-item"><div class="mini-cup" aria-hidden="true">☕</div><div class="cart-item-body"><strong>${escapeHTML(i.name)}</strong><small>฿${money(i.price)} / แก้ว</small><div class="item-bottom"><div class="quantity"><button data-qty="${escapeHTML(i.id)}" data-step="-1" aria-label="ลดจำนวน ${escapeHTML(i.name)}">−</button><span>${i.qty}</span><button data-qty="${escapeHTML(i.id)}" data-step="1" aria-label="เพิ่มจำนวน ${escapeHTML(i.name)}">+</button></div><strong>฿${money(i.price * i.qty)}</strong></div></div><button class="remove" data-remove="${escapeHTML(i.id)}" aria-label="ลบ ${escapeHTML(i.name)}">×</button></div>`,
        )
        .join("")
    : '<div class="empty"><span class="empty-icon">☕</span>ยังไม่มีรายการที่เลือก<br>เพิ่มเครื่องดื่มแก้วโปรดเพื่อเริ่มออร์เดอร์</div>';
  $("#total").textContent = "฿" + money(cartTotal());
  $("#checkout").disabled = !cart.length;
  $("#clear-cart").disabled = !cart.length;
  updateChange();
  renderProducts();
}
function addItem(id) {
  const menu = state.menus.find((m) => m.id === id);
  if (!menu) return;
  const item = cart.find((i) => i.id === id);
  if ((item?.qty || 0) >= menu.stock) {
    toast("จำนวนเกินสต็อกที่มี");
    return;
  }
  if (item) item.qty++;
  else cart.push({ id: menu.id, name: menu.name, price: menu.price, qty: 1 });
  $("#order-error").textContent = "";
  renderCart();
}
$("#products").addEventListener("click", (e) => {
  const b = e.target.closest("[data-add]");
  if (b) addItem(b.dataset.add);
});
$("#cart-items").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.remove) cart = cart.filter((i) => i.id !== b.dataset.remove);
  else if (b.dataset.qty) {
    if (b.dataset.step === "1") {
      addItem(b.dataset.qty);
      return;
    }
    const item = cart.find((i) => i.id === b.dataset.qty);
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
  category = b.dataset.category;
  document
    .querySelectorAll("#filters button")
    .forEach((btn) => btn.classList.toggle("selected", btn === b));
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
$("#checkout").onclick = () => {
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
  else if (
    cart.some(
      (i) =>
        !state.menus.find((m) => m.id === i.id) ||
        state.menus.find((m) => m.id === i.id).stock < i.qty,
    )
  )
    error = "สต็อกเปลี่ยนแปลง กรุณาตรวจสอบรายการอีกครั้ง";
  if (error) {
    $("#order-error").textContent = error;
    return;
  }
  const order = {
    id: "BM-" + Date.now().toString(36).toUpperCase(),
    date: new Date().toISOString(),
    items: structuredClone(cart),
    total,
    payment,
    received: payment === "cash" ? received : total,
    change: payment === "cash" ? Math.round((received - total) * 100) / 100 : 0,
  };
  order.items.forEach(
    (i) => (state.menus.find((m) => m.id === i.id).stock -= i.qty),
  );
  state.orders.push(order);
  save();
  cart = [];
  $("#cash-received").value = "";
  document
    .querySelectorAll('[name="payment"]')
    .forEach((r) => (r.checked = false));
  $("#order-error").textContent = "";
  renderCart();
  renderMenus();
  renderReports();
  showReceipt(order);
};
function showReceipt(order) {
  $("#receipt").innerHTML =
    `<div class="receipt-brand">🌿 brue rim lay Coffee</div><div class="receipt-sub">ใบเสร็จรับเงิน · สาขาบางแสน</div><div class="receipt-info">เลขที่ ${escapeHTML(order.id)}<br>${new Date(order.date).toLocaleString("th-TH")}<br>พนักงาน: พนักงานหน้าร้าน</div><div class="receipt-lines">${order.items.map((i) => `<div class="receipt-line"><span>${escapeHTML(i.name)} × ${i.qty}<small>฿${money(i.price)} / แก้ว</small></span><span>฿${money(i.price * i.qty)}</span></div>`).join("")}</div><div class="receipt-total"><span>รวมทั้งหมด</span><span>฿${money(order.total)}</span></div><div class="receipt-info">ชำระโดย: ${order.payment === "cash" ? "เงินสด" : "QR Code (บันทึกเท่านั้น)"}<br>รับเงิน: ฿${money(order.received)}<br>เงินทอน: ฿${money(order.change)}</div><div class="receipt-thanks">ขอบคุณที่ให้เราเป็นส่วนหนึ่งของวันดี ๆ ♡<small>ใบเสร็จจากระบบตัวอย่าง</small></div>`;
  $("#receipt-dialog").showModal();
}
$("#print").onclick = () => window.print();
document
  .querySelectorAll(".close-dialog")
  .forEach((b) => (b.onclick = () => b.closest("dialog").close()));
const pageNames = {
  order: ["รายการสั่งซื้อใหม่", "เติมความสดชื่นให้ทุกวัน ด้วยกาแฟแก้วโปรด"],
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
      renderMenus();
      renderReports();
    }),
);
function renderMenus() {
  $("#menu-table").innerHTML =
    state.menus
      .map(
        (m) =>
          `<tr><td>☕ ${escapeHTML(m.name)}</td><td>${categories[m.category] || "อื่น ๆ"}</td><td>${money(m.price)}</td><td>${m.stock === 0 ? "หมดชั่วคราว" : m.stock}</td><td><button data-edit="${escapeHTML(m.id)}">แก้ไข</button><button class="delete" data-delete="${escapeHTML(m.id)}">ลบ</button></td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="5">ยังไม่มีเมนู เพิ่มเมนูใหม่เพื่อเริ่มใช้งาน</td></tr>';
}
function openMenuForm(menu) {
  editingId = menu?.id || null;
  $("#form-title").textContent = menu ? "แก้ไขเมนู" : "เพิ่มเมนูใหม่";
  $("#menu-name").value = menu?.name || "";
  $("#menu-category").value = menu?.category || "coffee";
  $("#menu-price").value = menu?.price || "";
  $("#menu-stock").value = menu?.stock ?? 0;
  $("#menu-dialog").showModal();
}
$("#add-menu").onclick = () => openMenuForm();
$("#menu-table").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.edit)
    openMenuForm(state.menus.find((m) => m.id === b.dataset.edit));
  else if (b.dataset.delete && confirm("ต้องการลบเมนูนี้หรือไม่?")) {
    state.menus = state.menus.filter((m) => m.id !== b.dataset.delete);
    cart = cart.filter((i) => i.id !== b.dataset.delete);
    save();
    renderMenus();
    renderCart();
    toast("ลบเมนูเรียบร้อย");
  }
};
$("#menu-form").onsubmit = (e) => {
  e.preventDefault();
  const name = $("#menu-name").value.trim(),
    price = Number($("#menu-price").value),
    stock = Number($("#menu-stock").value);
  if (
    !name ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    toast("กรุณาตรวจสอบชื่อ ราคา และจำนวนสต็อก");
    return;
  }
  if (editingId) {
    const menu = state.menus.find((m) => m.id === editingId);
    Object.assign(menu, {
      name,
      price,
      stock,
      category: $("#menu-category").value,
    });
    cart = cart.filter((i) => i.id !== editingId);
    toast("บันทึกแล้ว กรุณาเพิ่มเมนูที่แก้ไขในออร์เดอร์อีกครั้ง");
  } else {
    state.menus.push({
      id: "menu-" + crypto.randomUUID(),
      name,
      price,
      stock,
      category: $("#menu-category").value,
      color: "#a08b64",
      bg: "#e7ebdf",
    });
    toast("เพิ่มเมนูเรียบร้อย");
  }
  save();
  $("#menu-dialog").close();
  renderMenus();
  renderCart();
};
function dayKey(date) {
  return new Date(date).toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  });
}
function renderReports() {
  const orders = state.orders.filter(
    (o) =>
      $("#report-range").value === "all" ||
      dayKey(o.date) === dayKey(new Date()),
  );
  $("#sales-total").textContent = money(
    orders.reduce((s, o) => s + o.total, 0),
  );
  $("#sales-orders").textContent = orders.length;
  $("#sales-cups").textContent = orders.reduce(
    (n, o) => n + o.items.reduce((s, i) => s + i.qty, 0),
    0,
  );
  const grouped = new Map();
  orders.forEach((o) =>
    o.items.forEach((i) => {
      const row = grouped.get(i.id) || { name: i.name, qty: 0, total: 0 };
      row.qty += i.qty;
      row.total += i.price * i.qty;
      grouped.set(i.id, row);
    }),
  );
  $("#sales-table").innerHTML =
    [...grouped.values()]
      .sort((a, b) => b.total - a.total)
      .map(
        (i) =>
          `<tr><td>${escapeHTML(i.name)}</td><td>${i.qty}</td><td>${money(i.total)}</td></tr>`,
      )
      .join("") || '<tr><td colspan="3">ยังไม่มียอดขายในช่วงเวลานี้</td></tr>';
  $("#history").innerHTML =
    orders
      .slice()
      .reverse()
      .map(
        (o) =>
          `<div class="history-row"><div><strong>${escapeHTML(o.id)}</strong><small>${new Date(o.date).toLocaleString("th-TH")} · ${o.payment === "cash" ? "เงินสด" : "QR Code"}</small></div><strong>฿${money(o.total)}</strong><button class="secondary" data-receipt="${escapeHTML(o.id)}">ใบเสร็จ</button></div>`,
      )
      .join("") || '<p class="empty">ออร์เดอร์ที่ยืนยันแล้วจะแสดงที่นี่</p>';
}
$("#report-range").onchange = renderReports;
$("#history").onclick = (e) => {
  const b = e.target.closest("[data-receipt]");
  if (b) showReceipt(state.orders.find((o) => o.id === b.dataset.receipt));
};
$("#today").textContent = new Date().toLocaleDateString("th-TH", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
renderCart();
renderMenus();
renderReports();
if (!storageAvailable)
  toast("ไม่สามารถอ่านข้อมูลเดิมได้ เริ่มข้อมูลตัวอย่างใหม่");
