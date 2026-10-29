const { useState, useEffect } = React;

function App() {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [toastMessage, setToastMessage] = useState(null);
    const [toastError, setToastError] = useState(false);

    // نافذة دخول المشرف فقط
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [adminPasswordInput, setAdminPasswordInput] = useState('');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        fetchFilesFromDB();
    }, []);

    const showToast = (message, isError = false) => {
        setToastMessage(message);
        setToastError(isError);
        setTimeout(() => {
            setToastMessage(null);
        }, 3500);
    };

    const toggleTheme = () => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    };

    const handleAdminButtonClick = () => {
        if (isAdminLoggedIn) {
            setIsAdminLoggedIn(false);
            showToast('تم تسجيل خروج المشرف بنجاح');
        } else {
            setAdminPasswordInput('');
            setShowAdminModal(true);
        }
    };

    const verifyAdminPassword = async () => {
        if (!adminPasswordInput) {
            showToast('الرجاء إدخال كلمة المرور', true);
            return;
        }

        try {
            const { data, error } = await sb
                .from('app_settings')
                .select('value')
                .eq('key', 'admin_password')
                .single();

            if (error || !data) throw new Error('تعذر التحقق من إعدادات المشرف.');

            if (adminPasswordInput === data.value) {
                setIsAdminLoggedIn(true);
                setShowAdminModal(false);
                setAdminPasswordInput('');
                showToast('مرحباً بك مجدداً يا مشرف التنفيذ ✓');
            } else {
                showToast('كلمة المرور غير صحيحة!', true);
            }
        } catch (error) {
            console.error(error);
            showToast('تعذر التحقق من كلمة المرور.', true);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0] || null;
        if (file && (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
            showToast('يرجى اختيار ملف PDF فقط', true);
            e.target.value = '';
            return;
        }
        setSelectedFile(file);
    };

    const uploadFile = async () => {
        if (!selectedFile) {
            showToast('اختر ملف PDF أولاً', true);
            return;
        }
        setUploading(true);

        try {
            const cleanName = selectedFile.name
                .normalize('NFKD')
                .replace(/[^a-zA-Z0-9_.-]/g, '_')
                .slice(-150);
            const storagePath = Date.now() + '_' + cleanName;

            const { error: uploadError } = await sb.storage
                .from(BUCKET_NAME)
                .upload(storagePath, selectedFile, { contentType: 'application/pdf', upsert: false });

            if (uploadError) throw uploadError;

            const { data: urlData } = sb.storage
                .from(BUCKET_NAME)
                .getPublicUrl(storagePath);

            const { error: dbError } = await sb
                .from('pdf_files')
                .insert([{ name: selectedFile.name, url: urlData.publicUrl }]);

            if (dbError) {
                await sb.storage.from(BUCKET_NAME).remove([storagePath]);
                throw dbError;
            }

            setSelectedFile(null);
            document.getElementById('pdfFileInput').value = '';
            showToast('تم رفع الملف وحفظه بنجاح ✓');
            fetchFilesFromDB();
        } catch (error) {
            console.error('Upload error:', error);
            showToast('تعذر رفع الملف', true);
        } finally {
            setUploading(false);
        }
    };

    const fetchFilesFromDB = async () => {
        setLoading(true);
        try {
            const { data, error } = await sb
                .from('pdf_files')
                .select('*')
                .order('id', { ascending: false });

            if (error) throw error;
            setFiles(data || []);
        } catch (error) {
            console.error('Fetch error:', error);
            showToast('تعذر تحميل الملفات', true);
        } finally {
            setLoading(false);
        }
    };

    // الحذف الفوري بدون نافذة تأكيد
    const deleteFileImmediately = async (id, fileUrl) => {
        if (!isAdminLoggedIn) {
            showToast('يجب تسجيل دخول المشرف أولاً', true);
            return;
        }

        try {
            const parsedUrl = new URL(fileUrl);
            const marker = '/storage/v1/object/public/' + BUCKET_NAME + '/';
            const markerIndex = parsedUrl.pathname.indexOf(marker);
            const storagePath = decodeURIComponent(parsedUrl.pathname.slice(markerIndex + marker.length));

            const { error: dbError } = await sb.from('pdf_files').delete().eq('id', id);
            if (dbError) throw dbError;

            await sb.storage.from(BUCKET_NAME).remove([storagePath]);
            showToast('تم حذف الملف فوراً ✓');
            fetchFilesFromDB();
        } catch (error) {
            console.error('Delete error:', error);
            showToast('تعذر حذف الملف', true);
        }
    };

    const filteredFiles = files.filter(file => 
        String(file.name || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    return React.createElement('div', { className: 'app' },
        React.createElement('header', { className: 'topbar' },
            React.createElement('div', { className: 'brand' },
                React.createElement('div', { className: 'logo' }, '📚'),
                React.createElement('div', null,
                    React.createElement('h1', null, 'مكتبتي'),
                    React.createElement('p', null, 'مكتبة ملفات PDF الذكية')
                )
            ),
            React.createElement('div', { className: 'header-actions' },
                React.createElement('button', { 
                    className: `admin-btn ${isAdminLoggedIn ? 'active' : ''}`, 
                    onClick: handleAdminButtonClick, 
                    type: 'button' 
                }, 
                    React.createElement('span', { className: 'admin-status-dot' }),
                    isAdminLoggedIn ? '🔓 لوحة المشرف مفعلة' : '🔐 دخول المشرف'
                ),
                React.createElement('button', { 
                    className: 'icon-btn', 
                    onClick: toggleTheme, 
                    type: 'button' 
                }, theme === 'dark' ? '☀️ الوضع الفاتح' : '🌙 الوضع الداكن')
            )
        ),
        React.createElement('section', { className: 'hero' },
            React.createElement('div', { className: 'hero-content' },
                React.createElement('span', { className: 'hero-label' }, '✨ مكتبتك الرقمية'),
                React.createElement('h2', null, 'كل ملفاتك في مكان واحد'),
                React.createElement('p', null, 'ارفع ملفات PDF، واحتفظ بها في مكتبتك الرقمية، واستعرض مستنداتك وحمّلها بسهولة من أي جهاز.')
            )
        ),
        React.createElement('section', { className: 'stats' },
            React.createElement('div', { className: 'stat-card' },
                React.createElement('div', { className: 'stat-icon purple' }, '📚'),
                React.createElement('div', null,
                    React.createElement('p', null, 'إجمالي الملفات'),
                    React.createElement('strong', null, files.length)
                )
            ),
            React.createElement('div', { className: 'stat-card' },
                React.createElement('div', { className: 'stat-icon green' }, '☁️'),
                React.createElement('div', null,
                    React.createElement('p', null, 'حالة المكتبة'),
                    React.createElement('strong', { style: { fontSize: '17px' } }, 'متصلة')
                )
            ),
            React.createElement('div', { className: 'stat-card' },
                React.createElement('div', { className: 'stat-icon blue' }, '📄'),
                React.createElement('div', null,
                    React.createElement('p', null, 'نوع المستندات'),
                    React.createElement('strong', { style: { fontSize: '17px' } }, 'PDF')
                )
            )
        ),
        React.createElement('section', { className: 'panel' },
            React.createElement('div', { className: 'panel-heading' },
                React.createElement('div', null,
                    React.createElement('h3', null, '📤 إضافة ملف جديد'),
                    React.createElement('p', null, 'اختر مستند PDF لإضافته إلى المكتبة')
                )
            ),
            React.createElement('div', { className: 'upload-zone' },
                React.createElement('div', { className: 'upload-icon' }, '📁'),
                React.createElement('h4', null, 'أضف مستندك إلى المكتبة'),
                React.createElement('p', null, 'اختر ملف PDF من هاتفك أو اسحبه إلى هذه المنطقة'),
                React.createElement('input', { 
                    type: 'file', 
                    id: 'pdfFileInput', 
                    accept: '.pdf,application/pdf', 
                    onChange: handleFileChange,
                    style: { display: 'none' } 
                }),
                React.createElement('label', { htmlFor: 'pdfFileInput', className: 'upload-label' }, '＋ اختيار ملف PDF'),
                selectedFile && React.createElement('div', { className: 'selected-file' },
                    React.createElement('span', null, '📄'),
                    React.createElement('span', { className: 'selected-file-name' }, `${selectedFile.name}`),
                    React.createElement('button', { 
                        type: 'button', 
                        className: 'icon-btn', 
                        onClick: () => setSelectedFile(null) 
                    }, '✕')
                ),
                selectedFile && React.createElement('button', { 
                    type: 'button', 
                    className: 'upload-btn', 
                    onClick: uploadFile,
                    disabled: uploading 
                }, uploading ? '⏳ جارٍ الرفع...' : '☁️ رفع الملف وحفظه')
            )
        ),
        React.createElement('section', { className: 'panel' },
            React.createElement('div', { className: 'panel-heading' },
                React.createElement('div', null,
                    React.createElement('h3', null, '📖 مكتبة الملفات'),
                    React.createElement('p', null, 'تصفح ملفاتك واعثر على المستند المطلوب')
                ),
                React.createElement('div', { className: 'search-box' },
                    React.createElement('span', { className: 'search-icon' }, '🔎'),
                    React.createElement('input', { 
                        type: 'search', 
                        placeholder: 'ابحث عن اسم الملف...', 
                        value: searchQuery,
                        onChange: (e) => setSearchQuery(e.target.value)
                    })
                )
            ),
            loading ? React.createElement('div', { className: 'loading' }, '⏳ جارٍ تحميل الملفات...') :
            filteredFiles.length === 0 ? React.createElement('div', { className: 'empty' },
                React.createElement('div', { style: { fontSize: '40px', marginBottom: '12px' } }, '📂'),
                React.createElement('strong', null, searchQuery ? 'لم يتم العثور على ملفات مطابقة' : 'مكتبتك فارغة حالياً')
            ) :
            React.createElement('div', { className: 'file-list' },
                filteredFiles.map(file => 
                    React.createElement('article', { key: file.id, className: 'file-item' },
                        React.createElement('div', { className: 'file-top' },
                            React.createElement('div', { className: 'pdf-icon' }, '📕'),
                            React.createElement('div', { className: 'file-details' },
                                React.createElement('div', { className: 'file-name', title: file.name }, file.name || 'ملف PDF'),
                                React.createElement('div', { className: 'file-type' }, 'مستند PDF')
                            )
                        ),
                        React.createElement('div', { className: 'file-actions' },
                            React.createElement('a', { className: 'btn btn-view', href: file.url, target: '_blank', rel: 'noopener noreferrer' }, '👁️ عرض'),
                            React.createElement('a', { className: 'btn btn-download', href: file.url, target: '_blank', rel: 'noopener noreferrer' }, '⬇️ حفظ'),
                            isAdminLoggedIn && React.createElement('button', { 
                                type: 'button', 
                                className: 'btn btn-delete', 
                                onClick: () => deleteFileImmediately(file.id, file.url) 
                            }, '🗑️ حذف')
                        )
                    )
                )
            )
        ),
        React.createElement('footer', { className: 'footer' },
            React.createElement('p', null, '📚 مكتبتي — مكتبتك الرقمية لملفات PDF')
        ),

        // 🔐 نافذة دخول المشرف الاحترافية
        showAdminModal && React.createElement('div', { className: 'modal-overlay' },
            React.createElement('div', { className: 'admin-modal-card' },
                React.createElement('div', { className: 'admin-modal-header' },
                    React.createElement('div', { className: 'admin-badge-icon' }, '🛡️'),
                    React.createElement('div', null,
                        React.createElement('h3', null, 'بوابة صلاحيات المشرف'),
                        React.createElement('p', null, 'أدخل كلمة المرور لتفعيل أزرار الإدارة والحذف المباشر')
                    )
                ),
                React.createElement('div', { className: 'admin-input-group' },
                    React.createElement('input', {
                        type: 'password',
                        className: 'modal-input',
                        placeholder: '••••••••',
                        value: adminPasswordInput,
                        onChange: (e) => setAdminPasswordInput(e.target.value),
                        onKeyDown: (e) => e.key === 'Enter' && verifyAdminPassword(),
                        autoFocus: true
                    })
                ),
                React.createElement('div', { className: 'modal-actions' },
                    React.createElement('button', {
                        className: 'modal-btn modal-btn-cancel',
                        onClick: () => setShowAdminModal(false)
                    }, 'إلغاء الأمر'),
                    React.createElement('button', {
                        className: 'modal-btn modal-btn-confirm',
                        onClick: verifyAdminPassword
                    }, 'التحقق ودخول')
                )
            )
        ),

        toastMessage && React.createElement('div', { className: `toast show ${toastError ? 'error-toast' : ''}` }, toastMessage)
    );
}

ReactDOM.render(React.createElement(App), document.getElementById('root'));

