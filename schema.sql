CREATE DATABASE IF NOT EXISTS cafe_pos_group11;

USE cafe_pos_group11;

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_method ENUM('cash', 'qr', 'card') NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);