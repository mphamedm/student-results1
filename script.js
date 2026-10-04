// =========================================================
// 1. استيراد مكتبات Firebase من CDN
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
    addDoc, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc, 
    deleteDoc, 
    query, 
    where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// =========================================================
// 2. بيانات مشروعك الخاص بـ Firebase
// =========================================================
const firebaseConfig = {
  apiKey: "AIzaSyA4YOFdX_LT4G1YO3MBu2Odf312657g4C4",
  authDomain: "student-results-2de76.firebaseapp.com",
  projectId: "student-results-2de76",
  storageBucket: "student-results-2de76.firebasestorage.app",
  messagingSenderId: "24575054302",
  appId: "1:24575054302:web:678ee8ede9ebbab0558d4f"
};

// تهيئة Firebase
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("تم الاتصال بـ Firebase بنجاح!");
} catch (error) {
    console.error("خطأ في تهيئة Firebase:", error);
}

let currentTeacherUser = null;

// =========================================================
// 3. التنقل بين التبويبات والصفحات
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
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

    toRegisterBtn?.addEventListener('click', () => {
        loginFormContainer.classList.add('hidden');
        registerFormContainer.classList.remove('hidden');
    });

    toLoginBtn?.addEventListener('click', () => {
        registerFormContainer.classList.add('hidden');
        loginFormContainer.classList.remove('hidden');
    });
});

// =========================================================
// 4. مراقبة حالة جلسة المستخدم (Auth Observer)
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
                console.log("لم يتم العثور على بيانات إضافية للمعلم");
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
// 5. استعلام الطالب عن النتيجة
// =========================================================
document.getElementById('studentSearchForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const seatNo = document.getElementById('searchSeatNumber').value.trim();
    const resultBox = document.getElementById('studentResultBox');

    resultBox.className = 'result-box';
    resultBox.innerHTML = '<div style="text-align:center;">جاري البحث في قاعدة البيانات...</div>';
    resultBox.classList.remove('hidden');

    try {
        const q = query(collection(db, "grades"), where("seatNumber", "==", seatNo));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            let htmlContent = '';
            querySnapshot.forEach((docSnap) => {
                const student = docSnap.data();
                const isPass = student.status === 'ناجح';
                const statusClass = isPass ? 'pass' : 'fail';
                const badgeClass = isPass ? 'badge-pass' : 'badge-fail';

                htmlContent += `
                    <div class="result-box ${statusClass}" style="margin-top:10px;">
                        <div class="result-header">
                            <div class="student-name">${student.studentName}</div>
                            <span class="badge ${badgeClass}">${student.status}</span>
                        </div>
                        <div class="result-grid">
                            <div class="result-item"><span>رقم الجلوس</span><strong>${student.seatNumber}</strong></div>
                            <div class="result-item"><span>المادة</span><strong>${student.subject}</strong></div>
                            <div class="result-item"><span>الدرجة</span><strong>${student.score} / 100</strong></div>
                            <div class="result-item"><span>التقدير</span><strong>${student.grade}</strong></div>
                        </div>
                    </div>
                `;
            });
            resultBox.innerHTML = htmlContent;
        } else {
            resultBox.className = 'result-box fail';
            resultBox.innerHTML = `<div style="text-align: center; color: var(--danger); font-weight: 700;">عذراً، لم يتم العثور على أي نتيجة برقم الجلوس: (${seatNo})</div>`;
        }
    } catch (error) {
        console.error("خطأ:", error);
        resultBox.className = 'result-box fail';
        resultBox.innerHTML = `<div style="text-align:center; color:var(--danger);">حدث خطأ أثناء الاتصال بقاعدة البيانات.</div>`;
    }
});

// =========================================================
// 6. تسجيل دخول المعلم
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
        errorMsg.textContent = "بيانات الدخول غير صحيحة، أو الحساب غير موجود.";
        errorMsg.classList.remove('hidden');
    }
});

// =========================================================
// 7. إنشاء حساب معلم معتمد بكود فريد
// =========================================================
document.getElementById('registerForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const fullName = document.getElementById('regFullName').value.trim();
    const teacherCode = document.getElementById('regTeacherCode').value.trim().toUpperCase();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const errorMsg = document.getElementById('registerError');

    errorMsg.classList.add('hidden');

    try {
        // التحقق من كود الاعتماد في Firestore
        const codeRef = doc(db, "approved_teacher_codes", teacherCode);
        const codeSnap = await getDoc(codeRef);

        if (!codeSnap.exists() || codeSnap.data().isUsed === true) {
            errorMsg.textContent = "كود الاعتماد هذا غير صالح أو سبق استخدامه.";
            errorMsg.classList.remove('hidden');
            return;
        }

        // إنشاء الحساب
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // حفظ بيانات المعلم
        await setDoc(doc(db, "teachers", user.uid), {
            uid: user.uid,
            fullName: fullName,
            email: email,
            teacherCode: teacherCode,
            createdAt: new Date()
        });

        // تعطيل الكود حتى لا يُستخدم مجدداً
        await setDoc(codeRef, { isUsed: true, usedBy: user.uid }, { merge: true });

        alert("تم حساب المعلم بنجاح!");
        this.reset();
        document.getElementById('loginFormContainer').classList.remove('hidden');
        document.getElementById('registerFormContainer').classList.add('hidden');
    } catch (error) {
        errorMsg.textContent = error.message;
        errorMsg.classList.remove('hidden');
    }
});

// =========================================================
// 8. إضافة نتيجة جديدة
// =========================================================
document.getElementById('addGradeForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!currentTeacherUser) return;

    const seatNumber = document.getElementById('seatNumber').value.trim();
    const studentName = document.getElementById('studentName').value.trim();
    const subject = document.getElementById('subjectName').value.trim();
    const score = parseFloat(document.getElementById('score').value);

    const evalData = getEvaluation(score);

    try {
        await addDoc(collection(db, "grades"), {
            seatNumber,
            studentName,
            subject,
            score,
            grade: evalData.grade,
            status: evalData.status,
            teacherUid: currentTeacherUser.uid,
            createdAt: new Date()
        });

        alert('تم حفظ النتيجة بنجاح!');
        this.reset();
        loadTeacherGrades();
    } catch (error) {
        alert("حدث خطأ في الحفظ!");
    }
});

function getEvaluation(score) {
    if (score >= 90) return { grade: 'ممتاز (A)', status: 'ناجح' };
    if (score >= 80) return { grade: 'جيد جداً (B)', status: 'ناجح' };
    if (score >= 70) return { grade: 'جيد (C)', status: 'ناجح' };
    if (score >= 60) return { grade: 'مقبول (D)', status: 'ناجح' };
    return { grade: 'راسب (F)', status: 'راسب' };
}

// =========================================================
// 9. عرض سجل نتائج المعلم
// =========================================================
async function loadTeacherGrades() {
    if (!currentTeacherUser) return;
    const tbody = document.getElementById('teacherTableBody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">جاري تحميل البيانات...</td></tr>';

    try {
        const q = query(collection(db, "grades"), where("teacherUid", "==", currentTeacherUser.uid));
        const querySnapshot = await getDocs(q);

        tbody.innerHTML = '';
        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">لا توجد درجات مضافة حتى الآن</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const docId = docSnap.id;
            const tr = document.createElement('tr');
            const isPass = item.status === 'ناجح';

            tr.innerHTML = `
                <td><strong>${item.seatNumber}</strong></td>
                <td>${item.studentName}</td>
                <td>${item.subject}</td>
                <td>${item.score}</td>
                <td>${item.grade}</td>
                <td><span class="badge ${isPass ? 'badge-pass' : 'badge-fail'}">${item.status}</span></td>
                <td><button class="btn btn-danger delete-btn" data-id="${docId}">حذف</button></td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = this.getAttribute('data-id');
                if (confirm('هل أنت تأكد من الحذف؟')) {
                    await deleteDoc(doc(db, "grades", id));
                    loadTeacherGrades();
                }
            });
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">خطأ في تحميل البيانات</td></tr>';
    }
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (auth) signOut(auth);
});
