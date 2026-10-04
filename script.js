// ==========================================
// ملف الجافاسكريبت المستقل: script.js
// ==========================================

// جلب البيانات المخزنة محلياً وحالة تسجيل الدخول
let resultsData = JSON.parse(localStorage.getItem('student_results_app')) || [];
let isTeacherLoggedIn = sessionStorage.getItem('isTeacherLoggedIn') === 'true';

// بيانات تسجيل دخول المعلم الافتراضية
const TEACHER_USER = "admin";
const TEACHER_PASS = "123456";

// 1. التنقل بين التبويبات والشاشات
function switchTab(tab) {
    document.getElementById('btnStudentTab').classList.remove('active');
    document.getElementById('btnTeacherTab').classList.remove('active');

    document.getElementById('studentView').classList.add('hidden');
    document.getElementById('teacherLoginView').classList.add('hidden');
    document.getElementById('teacherDashboardView').classList.add('hidden');

    if (tab === 'student') {
        document.getElementById('btnStudentTab').classList.add('active');
        document.getElementById('studentView').classList.remove('hidden');
    } else if (tab === 'teacher') {
        document.getElementById('btnTeacherTab').classList.add('active');
        if (isTeacherLoggedIn) {
            document.getElementById('teacherDashboardView').classList.remove('hidden');
            renderTeacherTable();
        } else {
            document.getElementById('teacherLoginView').classList.remove('hidden');
        }
    }
}

// 2. بحث واستعلام الطالب برقم الجلوس
document.getElementById('studentSearchForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const seatNo = document.getElementById('searchSeatNumber').value.trim();
    const resultBox = document.getElementById('studentResultBox');

    const student = resultsData.find(item => item.seatNumber === seatNo);

    if (student) {
        const isPass = student.status === 'ناجح';
        const statusClass = isPass ? 'pass' : 'fail';
        const badgeClass = isPass ? 'badge-pass' : 'badge-fail';

        resultBox.className = `result-box ${statusClass}`;
        resultBox.innerHTML = `
            <div class="result-header">
                <div class="student-name">${student.name}</div>
                <span class="badge ${badgeClass}">${student.status}</span>
            </div>
            <div class="result-grid">
                <div class="result-item">
                    <span>رقم الجلوس</span>
                    <strong>${student.seatNumber}</strong>
                </div>
                <div class="result-item">
                    <span>المادة الدراسية</span>
                    <strong>${student.subject}</strong>
                </div>
                <div class="result-item">
                    <span>الدرجة الكلية</span>
                    <strong>${student.score} / 100</strong>
                </div>
                <div class="result-item">
                    <span>التقدير</span>
                    <strong>${student.grade}</strong>
                </div>
            </div>
        `;
    } else {
        resultBox.className = 'result-box fail';
        resultBox.innerHTML = `
            <div style="text-align: center; color: var(--danger); font-weight: 700;">
                عذراً، لم يتم العثور على أي نتيجة مرتبطة برقم الجلوس: (${seatNo})
            </div>
        `;
    }
    resultBox.classList.remove('hidden');
});

// 3. تسجيل دخول المعلم
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('loginError');

    if (user === TEACHER_USER && pass === TEACHER_PASS) {
        isTeacherLoggedIn = true;
        sessionStorage.setItem('isTeacherLoggedIn', 'true');
        errorMsg.classList.add('hidden');
        switchTab('teacher');
    } else {
        errorMsg.classList.remove('hidden');
    }
});

// 4. تسجيل خروج المعلم
function teacherLogout() {
    isTeacherLoggedIn = false;
    sessionStorage.removeItem('isTeacherLoggedIn');
    switchTab('teacher');
}

// 5. إضافة نتيجة جديدة
document.getElementById('addGradeForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const seatNumber = document.getElementById('seatNumber').value.trim();
    const name = document.getElementById('studentName').value.trim();
    const subject = document.getElementById('subjectName').value.trim();
    const score = parseFloat(document.getElementById('score').value);

    const evalData = getEvaluation(score);

    const newEntry = {
        seatNumber: seatNumber,
        name: name,
        subject: subject,
        score: score,
        grade: evalData.grade,
        status: evalData.status
    };

    resultsData.push(newEntry);
    localStorage.setItem('student_results_app', JSON.stringify(resultsData));

    renderTeacherTable();
    this.reset();
});

// 6. حساب التقدير والحالة تلقائياً
function getEvaluation(score) {
    if (score >= 90) return { grade: 'ممتاز (A)', status: 'ناجح' };
    if (score >= 80) return { grade: 'جيد جداً (B)', status: 'ناجح' };
    if (score >= 70) return { grade: 'جيد (C)', status: 'ناجح' };
    if (score >= 60) return { grade: 'مقبول (D)', status: 'ناجح' };
    return { grade: 'راسب (F)', status: 'راسب' };
}

// 7. عرض جدول درجات الطلاب للمعلم
function renderTeacherTable() {
    const tbody = document.getElementById('teacherTableBody');
    tbody.innerHTML = '';

    if (resultsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">لا توجد درجات مسجلة حتى الآن</td></tr>';
        return;
    }

    resultsData.forEach((item, index) => {
        const tr = document.createElement('tr');
        const isPass = item.status === 'ناجح';
        const badgeClass = isPass ? 'badge-pass' : 'badge-fail';

        tr.innerHTML = `
            <td><strong>${item.seatNumber}</strong></td>
            <td>${item.name}</td>
            <td>${item.subject}</td>
            <td>${item.score}</td>
            <td>${item.grade}</td>
            <td><span class="badge ${badgeClass}">${item.status}</span></td>
            <td><button class="btn btn-danger" onclick="deleteGrade(${index})">حذف</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// 8. حذف نتيجة
function deleteGrade(index) {
    if (confirm('هل أنت تأكد من حذف هذه النتيجة؟')) {
        resultsData.splice(index, 1);
        localStorage.setItem('student_results_app', JSON.stringify(resultsData));
        renderTeacherTable();
    }
}
