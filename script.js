// =========================================================
// 1. استيراد مكتبات Firebase (SDK v10+)
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
// 2. إعداد مفاتيح Firebase الخاصة بمشروعك
// =========================================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// تهيئة تطبيق Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentTeacherUser = null;

// =========================================================
// 3. إدارة التنقل بين الشاشات والتبويبات
// =========================================================
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

btnStudentTab.addEventListener('click', () => switchTab('student'));
btnTeacherTab.addEventListener('click', () => switchTab('teacher'));

// التبديل بين نموذج تسجيل الدخول وإنشاء الحساب
const loginFormContainer = document.getElementById('loginFormContainer');
const registerFormContainer = document.getElementById('registerFormContainer');
const toRegisterBtn = document.getElementById('toRegisterBtn');
const toLoginBtn = document.getElementById('toLoginBtn');

toRegisterBtn.addEventListener('click', () => {
    loginFormContainer.classList.add('hidden');
    registerFormContainer.classList.remove('hidden');
});

toLoginBtn.addEventListener('click', () => {
    registerFormContainer.classList.add('hidden');
    loginFormContainer.classList.remove('hidden');
});

// =========================================================
// 4. استعلام الطالب عن النتيجة (Firestore Search)
// =========================================================
document.getElementById('studentSearchForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const seatNo = document.getElementById('searchSeatNumber').value.trim();
    const resultBox = document.getElementById('studentResultBox');

    resultBox.className = 'result-box';
    resultBox.innerHTML = '<div style="text-align:center;">جاري البحث في قاعدة البيانات...</div>';
    resultBox.classList.remove('hidden');

    try {
        // البحث عن الدرجات المرتبطة برقم الجلوس في مجموعـة grades
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
                    </div>
                `;
            });
            resultBox.innerHTML = htmlContent;
        } else {
            resultBox.className = 'result-box fail';
            resultBox.innerHTML = `
                <div style="text-align: center; color: var(--danger); font-weight: 700;">
                    عذراً، لم يتم العثور على أي نتيجة برقم الجلوس: (${seatNo})
                </div>
            `;
        }
    } catch (error) {
        console.error("خطأ في جلب النتيجة:", error);
        resultBox.className = 'result-box fail';
        resultBox.innerHTML = `<div style="text-align:center; color:var(--danger);">حدث خطأ أثناء الاتصال بقاعدة البيانات.</div>`;
    }
});

// =========================================================
// 5. تسجيل معلم جديد (باستخدام كود اعتماد فريد من Firestore)
// =========================================================
document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const fullName = document.getElementById('regFullName').value.trim();
    const teacherCode = document.getElementById('regTeacherCode').value.trim().toUpperCase();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const errorMsg = document.getElementById('registerError');

    errorMsg.classList.add('hidden');

    try {
        // 1. التحقق من وجود الكود الفريد في مجموعـة "approved_teacher_codes"
        const codeRef = doc(db, "approved_teacher_codes", teacherCode);
        const codeSnap = await getDoc(codeRef);

        if (!codeSnap.exists() || codeSnap.data().isUsed === true) {
            errorMsg.textContent = "عذراً! كود الاعتماد هذا غير صالح أو تم استخدامه من قبل معلم آخر.";
            errorMsg.classList.remove('hidden');
            return;
        }

        // 2. إنشاء حساب للمعلم في Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 3. حفظ بيانات المعلم في مجموعـة "teachers"
        await setDoc(doc(db, "teachers", user.uid), {
            uid: user.uid,
            fullName: fullName,
            email: email,
            teacherCode: teacherCode,
            createdAt: new Date()
        });

        // 4. تعليم الكود كـ مستخدم حتى لا يُستعمل مجدداً
        await setDoc(codeRef, { isUsed: true, usedBy: user.uid }, { merge: true });

        alert("تم إنشاء حساب المعلم المعتمد بنجاح!");
        this.reset();
        loginFormContainer.classList.remove('hidden');
        registerFormContainer.classList.add('hidden');

    } catch (error) {
        console.error("خطأ في إنشاء الحساب:", error);
        errorMsg.textContent = "خطأ: " + error.message;
        errorMsg.classList.remove('hidden');
    }
});

// =========================================================
// 6. تسجيل دخول المعلم (Firebase Auth)
// =========================================================
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('loginError');

    errorMsg.classList.add('hidden');

    try {
        await signInWithEmailAndPassword(auth, email, password);
        this.reset();
    } catch (error) {
        console.error("خطأ في الدخول:", error);
        errorMsg.textContent = "بيانات الدخول غير صحيحة، يرجى المحاولة مرة أخرى.";
        errorMsg.classList.remove('hidden');
    }
});

// =========================================================
// 7. مراقبة حالة تسجيل الدخول (Auth State Observer)
// =========================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentTeacherUser = user;
        
        // جلب اسم المعلم للعرض
        const teacherDoc = await getDoc(doc(db, "teachers", user.uid));
        if (teacherDoc.exists()) {
            document.getElementById('welcomeTeacherText').textContent = `مرحباً بك، ${teacherDoc.data().fullName}`;
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

// تسجيل الخروج
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth);
});

// =========================================================
// 8. إضافة درجة طالب في Firestore (مرتبطة بالمعلم الحالية)
// =========================================================
document.getElementById('addGradeForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!currentTeacherUser) return;

    const seatNumber = document.getElementById('seatNumber').value.trim();
    const studentName = document.getElementById('studentName').value.trim();
    const subject = document.getElementById('subjectName').value.trim();
    const score = parseFloat(document.getElementById('score').value);

    const evalData = getEvaluation(score);

    try {
        await addDoc(collection(db, "grades"), {
            seatNumber: seatNumber,
            studentName: studentName,
            subject: subject,
            score: score,
            grade: evalData.grade,
            status: evalData.status,
            teacherUid: currentTeacherUser.uid, // ربط السجل بالمعلم الفريد
            createdAt: new Date()
        });

        alert('تم حفظ نتيجة الطالب بنجاح!');
        this.reset();
        loadTeacherGrades();
    } catch (error) {
        console.error("خطأ في الحفظ:", error);
        alert("حدث خطأ في حفظ النتيجة!");
    }
});

// حساب التقدير والحالة
function getEvaluation(score) {
    if (score >= 90) return { grade: 'ممتاز (A)', status: 'ناجح' };
    if (score >= 80) return { grade: 'جيد جداً (B)', status: 'ناجح' };
    if (score >= 70) return { grade: 'جيد (C)', status: 'ناجح' };
    if (score >= 60) return { grade: 'مقبول (D)', status: 'ناجح' };
    return { grade: 'راسب (F)', status: 'راسب' };
}

// =========================================================
// 9. تحميل درجات الطلاب المعلم الحالي فقط
// =========================================================
async function loadTeacherGrades() {
    if (!currentTeacherUser) return;

    const tbody = document.getElementById('teacherTableBody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">جاري تحميل البيانات...</td></tr>';

    try {
        const q = query(
            collection(db, "grades"), 
            where("teacherUid", "==", currentTeacherUser.uid)
        );
        const querySnapshot = await getDocs(q);

        tbody.innerHTML = '';

        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">لا توجد درجات مسجلة لك حتى الآن</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const docId = docSnap.id;
            const tr = document.createElement('tr');
            const isPass = item.status === 'ناجح';
            const badgeClass = isPass ? 'badge-pass' : 'badge-fail';

            tr.innerHTML = `
                <td><strong>${item.seatNumber}</strong></td>
                <td>${item.studentName}</td>
                <td>${item.subject}</td>
                <td>${item.score}</td>
                <td>${item.grade}</td>
                <td><span class="badge ${badgeClass}">${item.status}</span></td>
                <td><button class="btn btn-danger delete-btn" data-id="${docId}">حذف</button></td>
            `;
            tbody.appendChild(tr);
        });

        // تفعيل زر الحذف
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = this.getAttribute('data-id');
                if (confirm('هل أنت تأكد من حذف هذه النتيجة؟')) {
                    await deleteDoc(doc(db, "grades", id));
                    loadTeacherGrades();
                }
            });
        });

    } catch (error) {
        console.error("خطأ في جلب الدرجات:", error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">حدث خطأ في تحميل البيانات</td></tr>';
    }
}
