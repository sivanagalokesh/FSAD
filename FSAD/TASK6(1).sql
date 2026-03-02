CREATE TABLE logs(
id INT AUTO_INCREMENT PRIMARY KEY,
action VARCHAR(50),
time TIMESTAMP
);

CREATE TRIGGER log_insert
AFTER INSERT ON students
FOR EACH ROW
INSERT INTO logs(action) VALUES('Student Inserted');

CREATE VIEW daily_report AS
SELECT * FROM logs WHERE DATE(time)=CURDATE();

CREATE DATABASE college;

CREATE TABLE students(
id INT AUTO_INCREMENT PRIMARY KEY,
name VARCHAR(50),
email VARCHAR(50),
dob DATE,
department VARCHAR(20),
phone VARCHAR(15)
);

CREATE TABLE users(
id INT AUTO_INCREMENT PRIMARY KEY,
email VARCHAR(50),
password VARCHAR(50)
);