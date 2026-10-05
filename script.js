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
    deleteDoc
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

// =========================================================
// 3. إدارة الوضع الليلي والتبويبات
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
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

    // زر إلغاء التعديل
    document.getElementById('cancelEditBtn')?.addEventListener('click', resetGradeForm);
});

// =========================================================
// 4. مراقبة حالة تسجيل الدخول
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
                    document.getElementById('welcomeTeacherText').textContent = `مرحباً بك، ${teacherDoc.data().fullName}`;
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
// 5. استعلام الطالب (برقم الجلوس فقط)
// =========================================================
document.getElementById('studentSearchForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const seatNumber = document.getElementById('searchSeatNumber').value.trim();
    const resultBox = document.getElementById('studentResultBox');

    resultBox.className = 'result-box';
    resultBox.innerHTML = '<div style="text-align:center;">جاري البحث برقم الجلوس...</div>';
    resultBox.classList.remove('hidden');

    try {
        const studentDocRef = doc(db, "grades", seatNumber);
        const studentSnap = await getDoc(studentDocRef);

        if (studentSnap.exists()) {
            const studentData = studentSnap.data();
            renderStudentResult(studentData, resultBox);
        } else {
            resultBox.className = 'result-box fail';
            resultBox.innerHTML = `<div style="text-align: center; color: var(--danger); font-weight: 700;">عذراً، لم يتم العثور على نتيجة لرقم الجلوس: (${seatNumber})</div>`;
        }
    } catch (error) {
        console.error("خطأ أثناء البحث:", error);
        resultBox.className = 'result-box fail';
        resultBox.innerHTML = `<div style="text-align:center; color:var(--danger);">حدث خطأ أثناء الاتصال بقاعدة البيانات.</div>`;
    }
});

function renderStudentResult(student, resultBox) {
    const isPass = student.status === 'ناجح';
    const statusClass = isPass ? 'pass' : 'fail';
    const badgeClass = isPass ? 'badge-pass' : 'badge-fail';

    let tableHeaders = '';
    let tableRows = '';

    for (const [subject, score] of Object.entries(student.subjects || {})) {
        tableHeaders += `<th>${subject}</th>`;
        tableRows += `<td><strong>${score}</strong></td>`;
    }

    tableHeaders += `<th style="background:var(--primary-light);">المجموع الكلي</th>`;
    tableRows += `<td style="font-weight:bold; color:var(--primary); background:var(--primary-light);">${student.totalScore} / ${student.maxScore}</td>`;

    resultBox.className = `result-box ${statusClass}`;
    resultBox.innerHTML = `
        <div style="margin-bottom: 15px; border-bottom: 1px solid var(--border); padding-bottom: 10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
                <h3 style="margin-bottom: 4px;">اسم الطالب: ${student.studentName}</h3>
                <span style="color: var(--text-muted); font-size: 14px;">رقم الجلوس: <strong>${student.seatNumber}</strong></span>
            </div>
            <span class="badge ${badgeClass}" style="font-size: 15px; padding: 8px 16px;">${student.status}</span>
        </div>

        <div class="table-responsive" style="margin-bottom: 20px;">
            <table>
                <thead>
                    <tr>${tableHeaders}</tr>
                </thead>
                <tbody>
                    <tr>${tableRows}</tr>
                </tbody>
            </table>
        </div>

        <div class="result-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); text-align: center;">
            <div class="result-item">
                <span>المجموع الكلي</span>
                <strong style="font-size: 18px; color: var(--primary);">${student.totalScore} من ${student.maxScore} (${student.percentage ? student.percentage.toFixed(1) : 0}%)</strong>
            </div>
            <div class="result-item">
                <span>تقدير الطالب العام</span>
                <strong style="font-size: 18px;">${student.overallGrade}</strong>
            </div>
            <div class="result-item">
                <span>النتيجة النهائية</span>
                <strong style="font-size: 18px; color: ${isPass ? 'var(--success)' : 'var(--danger)'};">${student.status}</strong>
            </div>
        </div>
    `;
}

// =========================================================
// 6. تسجيل دخول وإنشاء حساب المعلم
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

        alert("تم إنشاء حساب المعلم بنجاح!");
        this.reset();
        document.getElementById('loginFormContainer').classList.remove('hidden');
        document.getElementById('registerFormContainer').classList.add('hidden');
    } catch (error) {
        errorMsg.textContent = error.message;
        errorMsg.classList.remove('hidden');
    }
});

// =========================================================
// 7. حفظ / تحديث درجات الطالب
// =========================================================
document.getElementById('addGradeForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!currentTeacherUser || !db) return;

    const studentName = document.getElementById('studentName').value.trim();
    const seatNumber = document.getElementById('seatNumber').value.trim();
    const subjectInputs = document.querySelectorAll('.subject-input');

    let subjects = {};
    let totalScore = 0;
    let count = 0;
    let isAllPassed = true;

    subjectInputs.forEach(input => {
        const scoreVal = input.value.trim();
        if (scoreVal !== '') {
            const score = parseFloat(scoreVal);
            const subjectName = input.getAttribute('data-subject');
            subjects[subjectName] = score;
            totalScore += score;
            count++;
            if (score < 50) {
                isAllPassed = false;
            }
        }
    });

    if (count === 0) {
        alert('يرجى إدخال درجة مادة واحدة على الأقل!');
        return;
    }

    const maxScore = count * 100;
    const percentage = (totalScore / maxScore) * 100;

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

        alert(isEditingMode ? `تم تحديث نتيجة الطالب (${studentName}) بنجاح!` : `تم حفظ نتيجة الطالب (${studentName}) بنجاح!`);
        resetGradeForm();
        loadTeacherGrades();
    } catch (error) {
        console.error("خطأ الحفظ:", error);
        alert("حدث خطأ أثناء حفظ البيانات!");
    }
});

// دالة إعادة ضبط نموذج الإدخال
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
// 8. عرض جدول النتائج المضافة مع أزرار (تعديل وحذف)
// =========================================================
async function loadTeacherGrades() {
    if (!currentTeacherUser || !db) return;
    const tbody = document.getElementById('teacherTableBody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">جاري تحميل البيانات...</td></tr>';

    try {
        const querySnapshot = await getDocs(collection(db, "grades"));

        tbody.innerHTML = '';
        let count = 0;

        querySnapshot.forEach((docSnap) => {
            const student = docSnap.data();

            if (student.teacherUid === currentTeacherUser.uid) {
                count++;
                const docId = docSnap.id;
                const tr = document.createElement('tr');
                const isPass = student.status === 'ناجح';

                let subjectsSummary = Object.entries(student.subjects || {})
                    .map(([subj, score]) => `${subj}: <strong>${score}</strong>`)
                    .join(' | ');

                tr.innerHTML = `
                    <td><strong style="color:var(--primary);">${student.studentName}</strong></td>
                    <td><strong>${student.seatNumber}</strong></td>
                    <td style="font-size:13px; color: var(--text-muted);">${subjectsSummary}</td>
                    <td><strong>${student.totalScore} / ${student.maxScore}</strong></td>
                    <td>${student.overallGrade}</td>
                    <td><span class="badge ${isPass ? 'badge-pass' : 'badge-fail'}">${student.status}</span></td>
                    <td style="white-space: nowrap;">
                        <button class="btn edit-btn" data-id="${docId}" style="padding: 6px 12px; font-size: 12px; margin-left: 4px; background-color: #f39c12; color: #fff; border:none; border-radius:4px; cursor:pointer;">تعديل</button>
                        <button class="btn btn-danger delete-btn" data-id="${docId}" style="padding: 6px 12px; font-size: 12px;">حذف</button>
                    </td>
                `;
                tbody.appendChild(tr);
            }
        });

        if (count === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">لا يوجد طلاب مضافون حتى الآن بواسطة المعلم</td></tr>';
        }

        // أحداث أزرار التعديل
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = this.getAttribute('data-id');
                try {
                    const studentDocRef = doc(db, "grades", id);
                    const studentSnap = await getDoc(studentDocRef);

                    if (studentSnap.exists()) {
                        const student = studentSnap.data();

                        // تعبئة البيانات في نموذج الإدخال
                        document.getElementById('studentName').value = student.studentName || '';

                        const seatInput = document.getElementById('seatNumber');
                        seatInput.value = student.seatNumber || id;
                        seatInput.readOnly = true; // منع تغيير رقم الجلوس أثناء التعديل

                        // تعبئة درجات المواد
                        const subjectInputs = document.querySelectorAll('.subject-input');
                        subjectInputs.forEach(input => {
                            const subjectName = input.getAttribute('data-subject');
                            input.value = (student.subjects && student.subjects[subjectName] !== undefined) ? student.subjects[subjectName] : '';
                        });

                        // وضع التعديل
                        isEditingMode = true;
                        document.getElementById('saveGradeBtn').textContent = 'تحديث نتيجة الطالب';
                        document.getElementById('cancelEditBtn').classList.remove('hidden');
                        document.getElementById('formTitle').textContent = `تعديل نتيجة الطالب: (${student.studentName})`;

                        // الانتقال للنموذج أعلى الصفحة
                        document.getElementById('addGradeForm').scrollIntoView({ behavior: 'smooth' });
                    }
                } catch (err) {
                    console.error("خطأ التعديل:", err);
                    alert("حدث خطأ أثناء تحميل البيانات للتعديل!");
                }
            });
        });

        // أحداث أزرار الحذف
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = this.getAttribute('data-id');
                if (confirm(`هل أنت تأكد من حذف سجل الطالب رقم الجلوس: (${id})؟`)) {
                    await deleteDoc(doc(db, "grades", id));
                    loadTeacherGrades();
                }
            });
        });

    } catch (error) {
        console.error("خطأ التحميل:", error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">خطأ في تحميل البيانات</td></tr>';
    }
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (auth) signOut(auth);
});
