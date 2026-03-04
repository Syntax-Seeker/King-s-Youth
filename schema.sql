-- =============================================
--  KING-YOUTH | GREATER — MySQL Database Schema
-- =============================================

CREATE DATABASE IF NOT EXISTS kingyouth CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kingyouth;

-- Admin credentials
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  end_date DATE,
  time VARCHAR(50),
  deadline DATE,
  location VARCHAR(255),
  description TEXT,
  max_participants INT DEFAULT 100,
  fee DECIMAL(10,2) DEFAULT 0.00,
  status ENUM('open','upcoming','closed') DEFAULT 'upcoming',
  media JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Registrations
CREATE TABLE IF NOT EXISTS registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  age INT,
  gender VARCHAR(20),
  phone VARCHAR(30),
  email VARCHAR(150),
  address TEXT,
  city VARCHAR(100),
  province VARCHAR(100),
  postal_code VARCHAR(20),
  church_name VARCHAR(255),
  pastor_name VARCHAR(100),
  church_phone VARCHAR(30),
  emergency_contact_name VARCHAR(150),
  emergency_contact_phone VARCHAR(30),
  emergency_contact_relation VARCHAR(100),
  medical_conditions TEXT,
  consent_liability BOOLEAN DEFAULT FALSE,
  consent_photo BOOLEAN DEFAULT FALSE,
  consent_rules BOOLEAN DEFAULT FALSE,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
);

-- Products (merch)
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock INT DEFAULT 0,
  sizes JSON,
  category VARCHAR(100),
  images JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(200) NOT NULL,
  customer_email VARCHAR(150),
  customer_phone VARCHAR(30),
  customer_address TEXT,
  items JSON NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status ENUM('pending','confirmed','shipped','completed','cancelled') DEFAULT 'pending',
  ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Ministry info (settings)
CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Default admin (password: greater2025)
INSERT IGNORE INTO admins (username, password_hash)
VALUES ('admin', '$2b$10$rQZ9uAVurKFJJFiDqIjv4eNm1yPzL/nVJsJZ9fmKsFz.IXSS7YAeC');

-- Default settings
INSERT IGNORE INTO settings VALUES
  ('ministry_name', 'King-Youth Ministry', NOW()),
  ('ministry_email', 'info@kingyouth.org', NOW()),
  ('ministry_phone', '', NOW()),
  ('ministry_address', '', NOW());

