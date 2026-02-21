# Role-Based Quiz Web App

A pure HTML/CSS/JS quiz application with role-based access for Teachers and Students.

## How to Run
1. Open the folder containing these files.
2. Double-click `index.html` to open it in your web browser.

## Sample Credentials

### Teacher
- **Roll Number:** `TCH001`
- **Password:** `TC01`

### Student
- **Roll Number:** `STU101`
- **Password:** `ST01`

## Features
- **Login:** Role-based redirection logic.
- **Teacher Dashboard:** Create tests with dynamic questions, view student results.
- **Student Dashboard:** View available tests, take tests, view past scores.
- **Persistence:** All data is saved in your browser's `localStorage` (persists refresh).

## Limitations
- Since this uses `localStorage`, data is stored on your specific browser and device. Clearing browser data will remove all tests and results.
