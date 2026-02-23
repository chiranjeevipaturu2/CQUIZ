/**
 * CQUIZ - Modern Role Based Quiz Application
 */

const USERS = [
    { roll: 'TCH001', role: 'teacher' },
    { roll: 'TCH002', role: 'teacher' },
    { roll: 'STU101', role: 'student' },
    { roll: 'STU102', role: 'student' },
    { roll: 'STU103', role: 'student' }
];

window.STORAGE_KEYS = {
    USER: 'cquiz_user_v2',
    TESTS: 'cquiz_tests_v2',
    RESULTS: 'cquiz_results_v2'
};
const STORAGE_KEYS = window.STORAGE_KEYS;

/* --- Authentication --- */

function generatePassword(roll) {
    if (!roll || roll.length < 4) return null;
    return roll.substring(0, 2) + roll.substring(roll.length - 2);
}

/* --- View Test Details --- */
window.viewTest = function (testId) {
    const tests = getTests();
    const test = tests.find(t => t.id === testId);
    if (!test) return;

    document.getElementById('viewTestTitle').textContent = test.title;
    const container = document.getElementById('viewQuestionsContainer');

    // Fix 4: 2-Column Grid for Details
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
    container.style.gap = '1rem';

    container.innerHTML = test.questions.map((q, idx) => `
        <div class="glass-card mb-3" style="padding: 1rem; height: 100%;">
            <h5 class="mb-2" style="color:var(--primary);">Question ${idx + 1}</h5>
            <p class="mb-3">${q.text}</p>
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                ${q.options.map((opt, optIdx) => `
                    <div style="
                        padding: 8px 12px; 
                        border-radius: 6px; 
                        background: ${optIdx === q.correctIndex ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)'};
                        border: 1px solid ${optIdx === q.correctIndex ? 'rgba(16, 185, 129, 0.4)' : 'transparent'};
                        color: ${optIdx === q.correctIndex ? '#6ee7b7' : 'var(--text-muted)'};
                    ">
                        ${opt} ${optIdx === q.correctIndex ? '✔' : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    document.getElementById('viewTestModal').classList.add('active');
}

window.login = function (roll, password) {
    const user = USERS.find(u => u.roll === roll);
    if (!user) return { success: false, message: 'User not found' };

    const expected = generatePassword(roll);
    if (password !== expected) return { success: false, message: 'Invalid credentials' };

    sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return { success: true, user };
}
const login = window.login;

function logout() {
    document.body.classList.add('fade-out');
    setTimeout(() => {
        sessionStorage.removeItem(STORAGE_KEYS.USER);
        window.location.href = 'index.html';
    }, 400); // Wait for animation
}

function requireAuth(role) {
    const user = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.USER));
    if (!user) { window.location.href = 'index.html'; return null; }
    if (role && user.role !== role) {
        alert('Unauthorized');
        window.location.href = 'index.html';
        return null;
    }
    return user;
}

/* --- Data Management --- */

function getTests() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TESTS) || '[]');
}

window.saveTest = function (test) {
    // Determine ID if not present
    if (!test.id) test.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    if (!test.createdAt) test.createdAt = Date.now();

    // LocalStorage Fallback (Keep it working alongside Firestore)
    const tests = getTests();
    const existingIdx = tests.findIndex(t => t.id === test.id);
    if (existingIdx > -1) tests[existingIdx] = test;
    else tests.push(test);
    localStorage.setItem(STORAGE_KEYS.TESTS, JSON.stringify(tests));

    // Handle Firestore Save IF window.saveToFirestore is defined (added in HTML modules)
    if (window.saveToFirestore) {
        window.saveToFirestore('tests', test.id, test);
    }

    if (typeof renderTeacherDashboard === 'function') renderTeacherDashboard();
    return test;
}
const saveTest = window.saveTest;

window.deleteTest = async function (testId) {
    if (!confirm('Are you sure you want to delete this test? This will also remove all related results.')) return;

    try {
        // 1. Delete from Firestore if available
        if (window.deleteFromFirestore) {
            await window.deleteFromFirestore('tests', testId);
            // Also delete related submissions
            if (window.deleteSubmissionsForTest) {
                await window.deleteSubmissionsForTest(testId);
            }
        }

        // 2. Delete from LocalStorage
        const tests = getTests().filter(t => t.id !== testId);
        localStorage.setItem(STORAGE_KEYS.TESTS, JSON.stringify(tests));

        const results = getResults().filter(r => r.testId !== testId);
        localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));

        alert('Test deleted successfully');
        if (typeof renderTeacherDashboard === 'function') renderTeacherDashboard();
        else window.location.reload();
    } catch (err) {
        console.error('Delete Error:', err);
        alert('Failed to delete test completely.');
    }
}

function getResults() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.RESULTS) || '[]');
}

function saveResult(result) {
    const results = getResults();
    // result: { id, testId, testTitle, studentRoll, score, total, timestamp, answers: {} }
    result.id = Date.now().toString(36);
    result.timestamp = Date.now();
    results.push(result);
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
}

/* --- Analytics Helpers --- */

function getAnalytics() {
    const results = getResults();
    if (!results.length) return null;

    const scores = results.map(r => (r.score / r.total) * 100);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
        totalAttempts: results.length,
        avgScore: avg.toFixed(1),
        highScore: Math.max(...scores).toFixed(1),
        lowScore: Math.min(...scores).toFixed(1)
    };
}

/* --- Teacher Dashboard Specific --- */

if (window.location.pathname.endsWith('teacher.html')) {
    window.renderTeacherDashboard = function () {
        // Fix 2: Prevent polling re-render if modal is open to avoid freezing/stutter
        if (document.getElementById('viewTestModal') && document.getElementById('viewTestModal').classList.contains('active')) {
            return;
        }
        // Analytics
        const results = getResults();
        const stats = getAnalytics();

        if (stats) {
            document.getElementById('statAttempts').textContent = stats.totalAttempts;
            // Removed detailed analytics as per strict correction
            document.getElementById('statAvg').textContent = '-';
            document.getElementById('statHigh').textContent = '-';
        }

        // Recent Submissions (Table)
        const tbody = document.getElementById('resultsTable');
        const newTableHTML = results.length ? results.map(r => `
            <tr>
                <td>${r.studentRoll}</td>
                <td>${r.testTitle}</td>
                <td><span class="badge ${r.score >= r.total / 2 ? 'badge-indigo' : 'badge-pink'}">${r.score}/${r.total}</span></td>
                <td style="font-size: 0.9rem; color: var(--text-muted);">${formatDate(r.timestamp)}</td>
            </tr>
        `).reverse().join('') : '<tr><td colspan="4" class="text-center">No submissions yet.</td></tr>';

        if (tbody && tbody.innerHTML !== newTableHTML) tbody.innerHTML = newTableHTML;

        // My Created Tests (List)
        const myContainer = document.getElementById('myTestsContainer');
        const user = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.USER));
        const allTests = getTests().filter(t => t.createdBy === user.roll);

        const newTestsHTML = allTests.length ? allTests.map(t => {
            const submissionCount = results.filter(r => r.testId === t.id).length;
            return `
            <div class="test-list-item" onclick="viewTest('${t.id}')" style="cursor: pointer;">
                <div class="flex-between">
                    <div>
                        <h4 style="margin:0; font-size:1rem;">${t.title}</h4>
                        <span class="text-muted" style="font-size:0.85rem;">${t.questions.length} Questions</span>
                    </div>
                     <span class="badge badge-indigo">View Details</span>
                </div>
            </div>
        `}).reverse().join('') : '<p class="text-center text-muted">You haven\'t created any tests yet.</p>';

        if (myContainer && myContainer.innerHTML !== newTestsHTML) myContainer.innerHTML = newTestsHTML;
    }

    // Polling every 3 seconds
    setInterval(window.renderTeacherDashboard, 3000);
}

/* --- UI Utilities --- */

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

// Auto-init specific behaviors
document.addEventListener('DOMContentLoaded', () => {
    // Add ripple effect to buttons
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            const circle = document.createElement('span');
            const diameter = Math.max(btn.clientWidth, btn.clientHeight);
            const radius = diameter / 2;
            circle.style.width = circle.style.height = `${diameter}px`;
            circle.style.left = `${e.clientX - (btn.offsetLeft + radius)}px`;
            circle.style.top = `${e.clientY - (btn.offsetTop + radius)}px`;
            circle.classList.add('ripple');
            // btn.appendChild(circle); // Implementation of ripple css needs more classes, skipping for now to keep simple
        });
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Password Visibility Toggle Logic
    const initPasswordToggle = () => {
        const passwordInputs = document.querySelectorAll('input[type="password"]');

        // Define SVG icons for toggle
        const eyeOpen = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>`;
        const eyeClosed = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.047m4.522-2.223A9.945 9.945 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.059 10.059 0 01-4.293 5.774M6.228 6.228L17.772 17.772M9 12a3 3 0 116 0 3 3 0 01-6 0z" /></svg>`;

        passwordInputs.forEach(input => {
            // Prevent multiple initializations
            if (input.parentElement.classList.contains('password-wrapper')) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'password-wrapper';
            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(input);

            const toggle = document.createElement('button');
            toggle.type = 'button'; // Prevent form submission
            toggle.className = 'password-toggle';
            toggle.innerHTML = eyeOpen;
            wrapper.appendChild(toggle);

            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isPassword = input.getAttribute('type') === 'password';
                input.setAttribute('type', isPassword ? 'text' : 'password');
                toggle.innerHTML = isPassword ? eyeClosed : eyeOpen;
            });
        });
    };

    initPasswordToggle();
    // Re-run for dynamic content if needed
    const observer = new MutationObserver(initPasswordToggle);
    observer.observe(document.body, { childList: true, subtree: true });
});
