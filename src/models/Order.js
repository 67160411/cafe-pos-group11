
class OrderItem {
  constructor(menuId, quantity, unitPrice, menuName = "") {
    this.menuId = menuId;
    this.quantity = quantity;
    this.unitPrice = Number(unitPrice);
    this.menuName = menuName;
  }

  calculateSubtotal() {
    return this.quantity * this.unitPrice;
  }
}

class Order {
  constructor(orderId, branchId, employeeId, paymentMethod) {
    this.orderId = orderId;
    this.branchId = branchId;
    this.employeeId = employeeId;
    this.paymentMethod = paymentMethod;
    this.items = [];
  }

  addItem(item) {
    this.items.push(item);
  }

  calculateTotal() {
    const totalCents = this.items.reduce(
      (sum, item) =>
        sum + Math.round(item.calculateSubtotal() * 100),
      0
    );

    return totalCents / 100;
  }
}

module.exports = { Order, OrderItem };
