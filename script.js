// =========================================================
// 1. استيراد مكتبات Firebase عبر CDN
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc, 
    deleteDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// =========================================================
// 2. إعدادات Firebase
// =========================================================
const firebaseConfig = {
  apiKey: "AIzaSyA4YOFdX_LT4G1YO3MBu2Odf312657g4C4",
  authDomain: "student-results-2de76.firebaseapp.com",
  projectId: "student-results-2de76",
  storageBucket: "student-results-2de76.firebasestorage.app",
  messagingSenderId: "24575054302",
  appId: "1:24575054302:web:678ee8ede9ebbab0558d4f"
};

let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    console.error("خطأ في تهيئة Firebase:", error);
}

let currentTeacherUser = null;
let isEditingMode = false;
let teacherStudentsCache = [];

// قائمة المواد الافتراضية الخارجة عن المجموع للتوافقية
const NON_TOTAL_SUBJECT_NAMES = [
    'الأنشطة الرياضية', 
    'التربية الفنية', 
    'التربية الفنية (الرسم)', 
    'الكمبيوتر', 
    'الحاسب الآلي'
];

// تنقية النصوص للحماية من ثغرات XSS
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// دالة لمعرفة هل المادة خارج المجموع الكلي
function isNonTotalSubject(subjectName, subjectData) {
    if (typeof subjectData === 'object' && subjectData !== null && subjectData.isNonTotal !== undefined) {
        return Boolean(subjectData.isNonTotal);
    }
    return NON_TOTAL_SUBJECT_NAMES.includes(subjectName.trim());
}

// دالة مساعدة لاستخراج درجة المادة
function getSubjectScore(subjectData) {
    if (typeof subjectData === 'object' && subjectData !== null && subjectData.score !== undefined) {
        return parseFloat(subjectData.score) || 0;
    }
    return parseFloat(subjectData) || 0;
}

// =========================================================
// 3. نظام النوافذ المنبثقة الاحترافية (Custom Modals)
// =========================================================
function showCustomAlert(title, message, type = 'success') {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const modalIcon = document.getElementById('modalIcon');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');

        if (type === 'success') modalIcon.textContent = '🎉';
        else if (type === 'error') modalIcon.textContent = '⚠️';
        else if (type === 'warning') modalIcon.textContent = '💡';
        else modalIcon.textContent = 'ℹ️';

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        confirmBtn.className = 'btn btn-primary';
        confirmBtn.textContent = 'موافق';
        cancelBtn.classList.add('hidden');

        modal.classList.add('active');

        const handleConfirm = () => {
            modal.classList.remove('active');
            confirmBtn.removeEventListener('click', handleConfirm);
            resolve(true);
        };

        confirmBtn.addEventListener('click', handleConfirm);
    });
}

function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const modalIcon = document.getElementById('modalIcon');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');

        modalIcon.textContent = '❓';
        modalTitle.textContent = title;
        modalMessage.textContent = message;

        confirmBtn.className = 'btn btn-danger';
        confirmBtn.textContent = 'تأكيد الحذف';
        cancelBtn.classList.remove('hidden');
        cancelBtn.textContent = 'إلغاء';

        modal.classList.add('active');

        const handleConfirm = () => {
            modal.classList.remove('active');
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            modal.classList.remove('active');
            cleanup();
            resolve(false);
        };

        function cleanup() {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        }

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

// =========================================================
// 4. إدارة الوضع الليلي والتبويبات وإظهار/إخفاء كلمة المرور
// =========================================================
const SVG_EYE_SHOW = `
    <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
`;

const SVG_EYE_HIDE = `
    <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
`;

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.toggle-password-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);

            if (targetInput) {
                const isPassword = targetInput.type === 'password';
                targetInput.type = isPassword ? 'text' : 'password';
                this.innerHTML = isPassword ? SVG_EYE_SHOW : SVG_EYE_HIDE;
            }
        });
    });

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggleBtn) themeToggleBtn.textContent = '☀️';
    }

    themeToggleBtn?.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });

    const btnStudentTab = document.getElementById('btnStudentTab');
    const btnTeacherTab = document.getElementById('btnTeacherTab');
    const studentView = document.getElementById('studentView');
    const teacherAuthView = document.getElementById('teacherAuthView');
    const teacherDashboardView = document.getElementById('teacherDashboardView');

    function switchTab(tab) {
        btnStudentTab.classList.remove('active');
        btnTeacherTab.classList.remove('active');

        studentView.classList.add('hidden');
        teacherAuthView.classList.add('hidden');
        teacherDashboardView.classList.add('hidden');

        if (tab === 'student') {
            btnStudentTab.classList.add('active');
            studentView.classList.remove('hidden');
        } else if (tab === 'teacher') {
            btnTeacherTab.classList.add('active');
            if (currentTeacherUser) {
                teacherDashboardView.classList.remove('hidden');
                loadTeacherGrades();
            } else {
                teacherAuthView.classList.remove('hidden');
            }
        }
    }

    btnStudentTab?.addEventListener('click', () => switchTab('student'));
    btnTeacherTab?.addEventListener('click', () => switchTab('teacher'));

    const loginFormContainer = document.getElementById('loginFormContainer');
    const registerFormContainer = document.getElementById('registerFormContainer');
    const toRegisterBtn = document.getElementById('toRegisterBtn');
    const toLoginBtn = document.getElementById('toLoginBtn');

    toRegisterBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        loginFormContainer.classList.add('hidden');
        registerFormContainer.classList.remove('hidden');
    });

    toLoginBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        registerFormContainer.classList.add('hidden');
        loginFormContainer.classList.remove('hidden');
    });

    document.getElementById('cancelEditBtn')?.addEventListener('click', resetGradeForm);

    document.getElementById('searchTeacherTable')?.addEventListener('input', filterAndRenderTeacherTable);
    document.getElementById('filterStatus')?.addEventListener('change', filterAndRenderTeacherTable);
});

// =========================================================
// 5. مراقبة حالة تسجيل الدخول
// =========================================================
if (auth) {
    onAuthStateChanged(auth, async (user) => {
        const teacherAuthView = document.getElementById('teacherAuthView');
        const teacherDashboardView = document.getElementById('teacherDashboardView');
        const btnTeacherTab = document.getElementById('btnTeacherTab');

        if (user) {
            currentTeacherUser = user;
            try {
                const teacherDoc = await getDoc(doc(db, "teachers", user.uid));
                if (teacherDoc.exists()) {
                    document.getElementById('welcomeTeacherText').textContent = `مرحباً بك، ${escapeHTML(teacherDoc.data().fullName)}`;
                }
            } catch (err) {
                console.log("تعذر جلب بيانات المعلم.");
            }

            if (btnTeacherTab.classList.contains('active')) {
                teacherAuthView.classList.add('hidden');
                teacherDashboardView.classList.remove('hidden');
                loadTeacherGrades();
            }
        } else {
            currentTeacherUser = null;
            if (btnTeacherTab.classList.contains('active')) {
                teacherDashboardView.classList.add('hidden');
                teacherAuthView.classList.remove('hidden');
            }
        }
    });
}

// =========================================================
// 6. استعلام الطالب عرض النتيجة وتقسيم المواد
// =========================================================
document.getElementById('studentSearchForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const seatNumber = document.getElementById('searchSeatNumber').value.trim();
    const studentName = document.getElementById('searchStudentName').value.trim();
    const resultBox = document.getElementById('studentResultBox');

    if (!seatNumber || !studentName) {
        await showCustomAlert("تنبيه", "يرجى إدخال رقم الجلوس واسم الطالب معاً للبحث.", "warning");
        return;
    }

    resultBox.innerHTML = '<div style="text-align:center; padding: 15px;">جاري التحقق والبحث عن النتيجة...</div>';
    resultBox.classList.remove('hidden');

    try {
        const q = query(
            collection(db, "grades"),
            where("seatNumber", "==", seatNumber),
            where("studentName", "==", studentName)
        );

        const querySnapshot = await getDocs(q);
        resultBox.innerHTML = '';

        if (!querySnapshot.empty) {
            querySnapshot.forEach((docSnap) => {
                renderStudentResult(docSnap.data(), resultBox);
            });
        } else {
            resultBox.innerHTML = `
                <div style="text-align: center; color: var(--danger); font-weight: 700; padding: 15px;">
                    عذراً، لم يتم العثور على نتيجة تطابق رقم الجلوس: (${escapeHTML(seatNumber)}) مع الاسم: (${escapeHTML(studentName)})
                </div>
            `;
        }
    } catch (error) {
        console.error("خطأ أثناء البحث:", error);
        resultBox.innerHTML = `<div style="text-align:center; color:var(--danger); padding: 15px;">حدث خطأ أثناء الاتصال بقاعدة البيانات.</div>`;
    }
});

function renderStudentResult(student, resultBox) {
    const isPass = student.status === 'ناجح';
    const badgeClass = isPass ? 'badge-pass' : 'badge-fail';

    let mainSubjectsHTML = '';
    let nonTotalSubjectsHTML = '';

    Object.entries(student.subjects || {}).forEach(([subject, val]) => {
        const score = getSubjectScore(val);
        const nonTotal = isNonTotalSubject(subject, val);

        const itemHTML = `
            <div class="student-grade-item">
                <span class="sub-title">${escapeHTML(subject)}</span>
                <span class="sub-score">${score}</span>
            </div>
        `;

        if (nonTotal) {
            nonTotalSubjectsHTML += itemHTML;
        } else {
            mainSubjectsHTML += itemHTML;
        }
    });

    const card = document.createElement('div');
    card.className = 'student-result-card';
    card.innerHTML = `
        <div class="result-header">
            <div>
                <h3>اسم الطالب: ${escapeHTML(student.studentName)}</h3>
                <span>رقم الجلوس: <strong>${escapeHTML(student.seatNumber)}</strong></span>
            </div>
            <span class="badge ${badgeClass}">${escapeHTML(student.status)}</span>
        </div>

        <!-- قسم المواد الأساسية -->
        <div class="result-section" style="margin-top: 20px;">
            <h4 style="color: var(--primary); border-bottom: 2px solid var(--primary); padding-bottom: 6px; margin-bottom: 12px; font-size: 16px;">
                📚 المواد الأساسية (تُضاف للمجموع)
            </h4>
            <div class="student-grades-grid">
                ${mainSubjectsHTML || '<p style="color: var(--text-muted); padding: 10px;">لا توجد درجات مواد أساسية مسجلة.</p>'}
            </div>
        </div>

        <!-- قسم المواد التي لا تضاف للمجموع -->
        <div class="result-section" style="margin-top: 25px; background: rgba(0,0,0,0.02); padding: 15px; border-radius: 8px; border: 1px dashed var(--border);">
            <h4 style="color: var(--text-muted); border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 12px; font-size: 15px;">
                🎨 مواد لا يتم إضافتها للمجموع
            </h4>
            <div class="student-grades-grid">
                ${nonTotalSubjectsHTML || '<p style="color: var(--text-muted); font-size: 13px;">لا توجد درجات مسجلة للمواد الخارجة عن المجموع.</p>'}
            </div>
        </div>

        <!-- ملخص المجموع والتقدير -->
        <div class="result-summary-bar" style="margin-top: 25px;">
            <div class="summary-box-item">
                <span>المجموع الكلي</span>
                <strong>${student.totalScore} / ${student.maxScore}</strong>
            </div>
            <div class="summary-box-item">
                <span>النسبة المئوية</span>
                <strong>${student.percentage ? Number(student.percentage).toFixed(1) : 0}%</strong>
            </div>
            <div class="summary-box-item">
                <span>التقدير العام</span>
                <strong>${escapeHTML(student.overallGrade)}</strong>
            </div>
        </div>
    `;

    resultBox.appendChild(card);
}

// =========================================================
// 7. تسجيل دخول وإنشاء حساب المعلم
// =========================================================
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('loginError');

    try {
        await signInWithEmailAndPassword(auth, email, password);
        this.reset();
        errorMsg.classList.add('hidden');
    } catch (error) {
        errorMsg.textContent = "بيانات الدخول غير صحيحة، أو لم يفعل الحساب بعد.";
        errorMsg.classList.remove('hidden');
    }
});

document.getElementById('registerForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const fullName = document.getElementById('regFullName').value.trim();
    const teacherCode = document.getElementById('regTeacherCode').value.trim().toUpperCase();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const errorMsg = document.getElementById('registerError');

    errorMsg.classList.add('hidden');

    try {
        const codeRef = doc(db, "approved_teacher_codes", teacherCode);
        const codeSnap = await getDoc(codeRef);

        if (!codeSnap.exists() || codeSnap.data().isUsed === true) {
            errorMsg.textContent = "كود الاعتماد هذا غير صالح أو تم استخدامه مسبقاً.";
            errorMsg.classList.remove('hidden');
            return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "teachers", user.uid), {
            uid: user.uid,
            fullName: fullName,
            email: email,
            teacherCode: teacherCode,
            createdAt: new Date()
        });

        await setDoc(codeRef, { isUsed: true, usedBy: user.uid }, { merge: true });

        await showCustomAlert("تم بنجاح", "تم إنشاء حساب معلم معتمد بنجاح!", "success");
        this.reset();
        document.getElementById('loginFormContainer').classList.remove('hidden');
        document.getElementById('registerFormContainer').classList.add('hidden');
    } catch (error) {
        errorMsg.textContent = error.message;
        errorMsg.classList.remove('hidden');
    }
});

// =========================================================
// 8. حفظ وتحديث نتيجة الطالب
// =========================================================
document.getElementById('addGradeForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!currentTeacherUser || !db) return;

    const studentName = document.getElementById('studentName').value.trim();
    const seatNumber = document.getElementById('seatNumber').value.trim();
    const subjectInputs = document.querySelectorAll('.subject-input');

    let subjects = {};
    let totalScore = 0;
    let mainSubjectsCount = 0;
    let totalEnteredCount = 0;
    let isAllPassed = true;

    subjectInputs.forEach(input => {
        const scoreVal = input.value.trim();
        if (scoreVal !== '') {
            const score = parseFloat(scoreVal);
            const subjectName = input.getAttribute('data-subject');
            const isNonTotal = input.getAttribute('data-non-total') === 'true';

            subjects[subjectName] = {
                score: score,
                isNonTotal: isNonTotal
            };
            totalEnteredCount++;

            if (!isNonTotal) {
                totalScore += score;
                mainSubjectsCount++;
                if (score < 50) {
                    isAllPassed = false;
                }
            }
        }
    });

    if (totalEnteredCount === 0) {
        await showCustomAlert("تنبيه", "يرجى إدخال درجة مادة واحدة على الأقل!", "warning");
        return;
    }

    const maxScore = mainSubjectsCount * 100;
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    let overallGrade = '';
    if (!isAllPassed || percentage < 50) {
        overallGrade = 'راسب (F)';
    } else if (percentage >= 90) {
        overallGrade = 'ممتاز (A)';
    } else if (percentage >= 80) {
        overallGrade = 'جيد جداً (B)';
    } else if (percentage >= 70) {
        overallGrade = 'جيد (C)';
    } else {
        overallGrade = 'مقبول (D)';
    }

    const status = (isAllPassed && percentage >= 50) ? 'ناجح' : 'راسب';

    try {
        await setDoc(doc(db, "grades", seatNumber), {
            seatNumber,
            studentName,
            subjects,
            totalScore,
            maxScore,
            percentage,
            overallGrade,
            status,
            teacherUid: currentTeacherUser.uid,
            updatedAt: new Date()
        });

        const alertText = isEditingMode ? `تم تحديث نتيجة الطالب (${escapeHTML(studentName)}) بنجاح!` : `تم حفظ نتيجة الطالب (${escapeHTML(studentName)}) بنجاح!`;
        await showCustomAlert("تم الحفظ بنجاح", alertText, "success");

        resetGradeForm();
        loadTeacherGrades();
    } catch (error) {
        console.error("خطأ الحفظ:", error);
        await showCustomAlert("خطأ", "حدث خطأ أثناء حفظ البيانات!", "error");
    }
});

function resetGradeForm() {
    const form = document.getElementById('addGradeForm');
    if (form) form.reset();

    const seatInput = document.getElementById('seatNumber');
    if (seatInput) seatInput.readOnly = false;

    const saveBtn = document.getElementById('saveGradeBtn');
    if (saveBtn) saveBtn.textContent = 'حفظ نتيجة الطالب';

    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.classList.add('hidden');

    const formTitle = document.getElementById('formTitle');
    if (formTitle) formTitle.textContent = 'رصد درجات طالب جديد';

    isEditingMode = false;
}

// =========================================================
// 9. تحميل وتنظيم عرض نتائج الطلاب مع الإحصائيات والفلترة
// =========================================================
async function loadTeacherGrades() {
    if (!currentTeacherUser || !db) return;
    const tbody = document.getElementById('teacherTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">جاري تحميل البيانات...</td></tr>';

    try {
        const q = query(
            collection(db, "grades"), 
            where("teacherUid", "==", currentTeacherUser.uid)
        );
        const querySnapshot = await getDocs(q);
        
        teacherStudentsCache = [];
        querySnapshot.forEach((docSnap) => {
            teacherStudentsCache.push({ id: docSnap.id, ...docSnap.data() });
        });

        updateDashboardStats(teacherStudentsCache);
        filterAndRenderTeacherTable();

    } catch (error) {
        console.error("خطأ التحميل:", error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">خطأ في تحميل البيانات</td></tr>';
    }
}

function updateDashboardStats(students) {
    const total = students.length;
    const passed = students.filter(s => s.status === 'ناجح').length;
    const failed = total - passed;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    document.getElementById('statTotalStudents').textContent = total;
    document.getElementById('statPassedStudents').textContent = passed;
    document.getElementById('statFailedStudents').textContent = failed;
    document.getElementById('statPassRate').textContent = `${passRate}%`;
}

function filterAndRenderTeacherTable() {
    const tbody = document.getElementById('teacherTableBody');
    const searchQuery = document.getElementById('searchTeacherTable')?.value.trim().toLowerCase() || '';
    const statusFilter = document.getElementById('filterStatus')?.value || 'all';

    let filtered = teacherStudentsCache.filter(student => {
        const matchesSearch = student.studentName.toLowerCase().includes(searchQuery) || 
                              student.seatNumber.toString().includes(searchQuery);
        
        let matchesStatus = true;
        if (statusFilter === 'nafs') matchesStatus = (student.status === 'ناجح');
        if (statusFilter === 'rasb') matchesStatus = (student.status === 'راسب');

        return matchesSearch && matchesStatus;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">لا توجد نتائج مطابقة للبحث أو الفلترة</td></tr>';
        return;
    }

    filtered.forEach(student => {
        const tr = document.createElement('tr');
        const isPass = student.status === 'ناجح';

        let subjectsChips = Object.entries(student.subjects || {})
            .map(([subj, val]) => {
                const score = getSubjectScore(val);
                const nonTotal = isNonTotalSubject(subj, val);
                const tag = nonTotal ? ' (خارج المجموع)' : '';
                const style = nonTotal ? 'opacity: 0.75; font-style: italic;' : '';
                return `<span class="subject-chip" style="${style}">${escapeHTML(subj)}${tag}: <strong>${score}</strong></span>`;
            })
            .join(' ');

        tr.innerHTML = `
            <td data-label="بيانات الطالب">
                <div style="font-weight:700; color:var(--primary);">${escapeHTML(student.studentName)}</div>
                <div style="font-size:12px; color:var(--text-muted);">رقم الجلوس: <strong>${escapeHTML(student.seatNumber)}</strong></div>
            </td>
            <td data-label="تفاصيل درجات المواد"><div class="subjects-container">${subjectsChips}</div></td>
            <td data-label="المجموع الكلي"><strong>${student.totalScore} / ${student.maxScore}</strong></td>
            <td data-label="التقدير العام"><span style="font-weight:600;">${escapeHTML(student.overallGrade)}</span></td>
            <td data-label="الحالة"><span class="badge ${isPass ? 'badge-pass' : 'badge-fail'}">${escapeHTML(student.status)}</span></td>
            <td data-label="إجراءات" style="text-align: center; white-space: nowrap;">
                <button class="btn edit-btn" data-id="${escapeHTML(student.id)}" style="padding: 6px 12px; font-size: 12px; margin-left: 4px; background-color: #f39c12; color: #fff;">تعديل</button>
                <button class="btn btn-danger delete-btn" data-id="${escapeHTML(student.id)}" style="padding: 6px 12px; font-size: 12px;">حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    attachTableButtonsEvents();
}

function attachTableButtonsEvents() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = this.getAttribute('data-id');
            try {
                const studentDocRef = doc(db, "grades", id);
                const studentSnap = await getDoc(studentDocRef);

                if (studentSnap.exists()) {
                    const student = studentSnap.data();

                    document.getElementById('studentName').value = student.studentName || '';

                    const seatInput = document.getElementById('seatNumber');
                    seatInput.value = student.seatNumber || id;
                    seatInput.readOnly = true;

                    const subjectInputs = document.querySelectorAll('.subject-input');
                    subjectInputs.forEach(input => {
                        const subjectName = input.getAttribute('data-subject');
                        if (student.subjects && student.subjects[subjectName] !== undefined) {
                            input.value = getSubjectScore(student.subjects[subjectName]);
                        } else {
                            input.value = '';
                        }
                    });

                    isEditingMode = true;
                    document.getElementById('saveGradeBtn').textContent = 'تحديث نتيجة الطالب';
                    document.getElementById('cancelEditBtn').classList.remove('hidden');
                    document.getElementById('formTitle').textContent = `تعديل نتيجة الطالب: (${escapeHTML(student.studentName)})`;

                    document.getElementById('addGradeForm').scrollIntoView({ behavior: 'smooth' });
                }
            } catch (err) {
                console.error("خطأ التعديل:", err);
                await showCustomAlert("خطأ", "حدث خطأ أثناء تحميل البيانات للتعديل!", "error");
            }
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = this.getAttribute('data-id');
            const confirmed = await showCustomConfirm("تأكيد الحذف", `هل أنت متأكد من حذف سجل الطالب برقم الجلوس: (${escapeHTML(id)})؟`);
            if (confirmed) {
                await deleteDoc(doc(db, "grades", id));
                loadTeacherGrades();
            }
        });
    });
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (auth) signOut(auth);
});
