CREATE DATABASE IF NOT EXISTS cafe_pos_group11
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cafe_pos_group11;

CREATE TABLE category (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE branch (
  branch_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(255)
);

CREATE TABLE employee (
  employee_id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL,
  FOREIGN KEY (branch_id) REFERENCES branch(branch_id)
);

CREATE TABLE menu_item (
  menu_id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  category_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  stock_quantity INT NOT NULL DEFAULT 0,
  UNIQUE (branch_id, name),
  FOREIGN KEY (branch_id) REFERENCES branch(branch_id),
  FOREIGN KEY (category_id) REFERENCES category(category_id)
);

CREATE TABLE orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  employee_id INT NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branch(branch_id),
  FOREIGN KEY (employee_id) REFERENCES employee(employee_id)
);

CREATE TABLE order_item (
  order_item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_id INT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (menu_id) REFERENCES menu_item(menu_id)
);

CREATE TABLE stock_movement (
  movement_id INT AUTO_INCREMENT PRIMARY KEY,
  menu_id INT NOT NULL,
  quantity_change INT NOT NULL,
  moved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_id) REFERENCES menu_item(menu_id)
);