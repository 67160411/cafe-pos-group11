-- client ของ docker-entrypoint ใช้ latin1 เป็นค่าเริ่มต้น ต้องตั้งเป็น utf8mb4 ก่อน insert
SET NAMES utf8mb4;
USE cafe_pos_group11;

-- ข้อมูลตั้งต้นสำหรับทดสอบ E2E สัปดาห์ที่ 13 (TC-13-01 ถึง TC-13-06)
INSERT INTO branch (branch_id, name, address) VALUES
  (1, 'Bangsaen', 'Bangsaen Sai 2 Rd., Chonburi'),
  (2, 'Sriracha', 'Sukhumvit Rd., Sriracha, Chonburi');

INSERT INTO category (category_id, name) VALUES
  (1, 'Coffee'),
  (2, 'Tea & Matcha'),
  (3, 'Others');

INSERT INTO employee (employee_id, branch_id, name, role) VALUES
  (1, 1, 'Bangsaen Cashier', 'cashier'),
  (2, 2, 'Sriracha Cashier', 'cashier');

-- เมนูแต่ละสาขาเป็นคนละแถวกัน (menu_item.branch_id)
INSERT INTO menu_item (branch_id, category_id, name, price, stock_quantity) VALUES
  (1, 1, 'Latte', 65.00, 20),
  (1, 1, 'Americano', 60.00, 40),
  (1, 1, 'Espresso', 55.00, 1),
  (1, 1, 'Cappuccino', 65.00, 8),
  (1, 2, 'Matcha Latte', 95.00, 50),
  (1, 2, 'Lemon Tea', 65.00, 30),
  (1, 3, 'Chocolate', 70.00, 40),
  (1, 1, 'Iced Americano', 65.00, 0),
  (2, 1, 'Latte', 65.00, 15),
  (2, 1, 'Americano', 60.00, 25),
  (2, 1, 'Espresso', 55.00, 10),
  (2, 2, 'Matcha Latte', 95.00, 20),
  (2, 3, 'Chocolate', 70.00, 12);
