-- ============================================================
-- CMS (Coaching Management System) — MySQL schema
-- Run: mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS cms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cms_db;

-- ---------- Users / Auth ----------
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(150) UNIQUE,
  phone         VARCHAR(20)  UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','staff','teacher','student','parent') NOT NULL DEFAULT 'staff',
  status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Roles / permissions (simple matrix, extend as needed) ----------
CREATE TABLE role_permissions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  role        VARCHAR(40) NOT NULL,
  module      VARCHAR(60) NOT NULL,
  can_view    BOOLEAN DEFAULT TRUE,
  can_edit    BOOLEAN DEFAULT FALSE,
  UNIQUE KEY role_module (role, module)
) ENGINE=InnoDB;

-- ---------- Courses ----------
CREATE TABLE courses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  duration    VARCHAR(60),
  fee         DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Teachers ----------
CREATE TABLE teachers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNIQUE,
  name        VARCHAR(120) NOT NULL,
  subject     VARCHAR(100),
  phone       VARCHAR(20),
  email       VARCHAR(150),
  salary      DECIMAL(10,2) DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Batches ----------
CREATE TABLE batches (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  course_id   INT,
  teacher_id  INT,
  schedule    VARCHAR(150),
  seats       INT DEFAULT 30,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Students ----------
CREATE TABLE students (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNIQUE,
  name        VARCHAR(120) NOT NULL,
  phone       VARCHAR(20),
  email       VARCHAR(150),
  course_id   INT,
  batch_id    INT,
  join_date   DATE,
  status      ENUM('Active','Inactive') DEFAULT 'Active',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Parents (linked to one or more students) ----------
CREATE TABLE parent_links (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  student_id  INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Attendance ----------
CREATE TABLE attendance (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  student_id  INT NOT NULL,
  batch_id    INT NOT NULL,
  date        DATE NOT NULL,
  status      ENUM('Present','Absent','Late') NOT NULL,
  marked_by   INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_att (student_id, batch_id, date),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Exams & Results ----------
CREATE TABLE exams (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  course_id   INT,
  exam_date   DATE,
  max_marks   INT DEFAULT 100,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE results (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  exam_id     INT NOT NULL,
  student_id  INT NOT NULL,
  marks       DECIMAL(6,2) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_result (exam_id, student_id),
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Fees ----------
CREATE TABLE fees (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  student_id  INT NOT NULL,
  course_id   INT,
  total       DECIMAL(10,2) NOT NULL,
  paid        DECIMAL(10,2) NOT NULL DEFAULT 0,
  due_date    DATE,
  status      ENUM('Unpaid','Partial','Paid') DEFAULT 'Unpaid',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE fee_payments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  fee_id          INT NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  method          ENUM('cash','bkash','nagad','card','sslcommerz','other') DEFAULT 'cash',
  transaction_id  VARCHAR(150),
  status          ENUM('pending','success','failed') DEFAULT 'success',
  paid_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fee_id) REFERENCES fees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Notifications ----------
CREATE TABLE notifications (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  message     TEXT NOT NULL,
  audience    VARCHAR(100) NOT NULL, -- 'all_students' | 'all_parents' | 'all_teachers' | batch name
  channel     SET('app','email','sms') DEFAULT 'app',
  created_by  INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- LMS ----------
CREATE TABLE lms_materials (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  course_id   INT,
  type        ENUM('PDF','Video','Slide','Assignment') DEFAULT 'PDF',
  file_url    VARCHAR(500),
  uploaded_by INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Payroll ----------
CREATE TABLE payroll (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id  INT NOT NULL,
  month       CHAR(7) NOT NULL, -- 'YYYY-MM'
  amount      DECIMAL(10,2) NOT NULL,
  status      ENUM('Pending','Paid') DEFAULT 'Pending',
  paid_at     TIMESTAMP NULL,
  UNIQUE KEY uniq_payroll (teacher_id, month),
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Seed: default admin (password = Admin@123, hash generated with bcrypt) ----------
-- Change this password immediately after first login.
INSERT INTO users (name, email, phone, password_hash, role)
VALUES ('Super Admin', 'admin@cms.com', '01700000000',
'$2b$10$xHgm11NawD.DKCAQ/AtC8OC2IMtO5tlGoQbGQSlaEmoUwuHKkkRlG', 'admin');
-- This hash was generated for the password: Admin@123
-- Login with email admin@cms.com / password Admin@123, then change it immediately.
-- To generate a hash for a different password: node scripts/hash-password.js "yourpassword"
