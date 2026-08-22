/* ========================================
   NEXGOLD EXCHANGE - SHARED CORE UTILITIES
   (All page-agnostic helpers. Page-specific logic in separate scripts.)
   ======================================== */

// ========================================
// CONSTANTS & MULTIPLIERS
// ========================================
const KARAT_MULTIPLIERS = { '24K': 1, '22K': 0.916, '18K': 0.75 };
const UNIT_MULTIPLIERS  = { 'Gram': 1, 'Ounce': 31.103, 'Kilo': 1000 };
const ADMIN_PASSWORD = 'admin123';
const ADMIN_EMAIL = 'admin@nexgold.exchange';
const TX_STATUS_PENDING  = 'PENDING';
const TX_STATUS_APPROVED = 'APPROVED';
const TX_STATUS_REJECTED = 'REJECTED';

// ========================================
// STORAGE HELPERS
// ========================================
function getFromStorage(key, defaultValue) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.warn('[Storage] read failed for', key, '-> using default');
        return defaultValue;
    }
}
function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error('[Storage] write failed for', key);
        return false;
    }
}

function setElementValue(el, value) {
    if (!el) return;
    const tag = (el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        el.value = value;
    } else {
        el.textContent = value;
    }
}
function getElementValue(el) {
    if (!el) return '';
    const tag = (el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        return el.value;
    }
    return el.textContent || '';
}

// ========================================
// DATA INITIALIZATION (runs everywhere)
// ========================================
function createDemoUserLocal() {
    const email    = 'demo@nexgold.exchange';
    const password = 'Demo@123';
    const users    = getFromStorage('users', []);
    if (!users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        const newUser = {
            id: Date.now() - 86400000 * 7,
            name: 'Demo Investor',
            email: email,
            password: password,
            country: 'United States',
            address: '1 Demo Way, New York, NY 10001'
        };
        users.push(newUser);
        saveToStorage('users', users);

        const wallets = getFromStorage('wallets', []);
        const wallet = { userId: newUser.id, main: 10.5, vault: 5.25, bonus: 2.1 };
        wallets.push(wallet);
        saveToStorage('wallets', wallets);

        const txns = [
            { id: Date.now() - 86400000 * 6, userId: newUser.id, type: 'BUY',  karat: '24K', grams: 5.0,  price: 5 * 65, date: new Date(Date.now() - 86400000 * 6).toISOString(), status: TX_STATUS_APPROVED },
            { id: Date.now() - 86400000 * 3, userId: newUser.id, type: 'BUY',  karat: '22K', grams: 5.5,  price: 5.5 * 65 * 0.916, date: new Date(Date.now() - 86400000 * 3).toISOString(), status: TX_STATUS_APPROVED },
            { id: Date.now() - 86400000 * 1, userId: newUser.id, type: 'SELL', karat: '24K', grams: 0.25, price: 0.25 * 65, date: new Date(Date.now() - 86400000 * 1).toISOString(), status: TX_STATUS_APPROVED }
        ];
        txns.forEach(saveTransaction);
        return { success: true, message: 'Demo account created locally', user: newUser };
    }
    return { success: false, message: 'Demo user exists' };
}

(function initializeData() {
    if (!localStorage.getItem('users'))          saveToStorage('users', []);
    if (!localStorage.getItem('wallets'))        saveToStorage('wallets', []);
    if (!localStorage.getItem('transactions'))   saveToStorage('transactions', []);
    if (!localStorage.getItem('certificates'))   saveToStorage('certificates', []);
    if (!localStorage.getItem('paymentMethods')) saveToStorage('paymentMethods', {
        usdt: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        btc:  'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        bankAccounts: [{
            bankName:      'Nexgold Exchange AG · Swiss Corporate Account',
            accountName:   'NEXGOLD EXCHANGE LTD',
            accountNumber: 'CH93 0076 2011 6238 2700 9 (IBAN)',
            swift:         'CRESCHZZ80A · Credit Suisse, Zurich'
        }]
    });
    const pmExisting = getFromStorage('paymentMethods', null);
    if (pmExisting && (!pmExisting.bankAccounts || pmExisting.bankAccounts.length === 0)) {
        pmExisting.usdt = pmExisting.usdt || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
        pmExisting.btc  = pmExisting.btc  || 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
        pmExisting.bankAccounts = [{
            bankName:      'Nexgold Exchange AG · Swiss Corporate Account',
            accountName:   'NEXGOLD EXCHANGE LTD',
            accountNumber: 'CH93 0076 2011 6238 2700 9 (IBAN)',
            swift:         'CRESCHZZ80A · Credit Suisse, Zurich'
        }];
        saveToStorage('paymentMethods', pmExisting);
    }
    if (!localStorage.getItem('settings')) {
        saveToStorage('settings', {
            basePrice: 65,
            weeklyPercent: 2,
            monthlyPercent: 8,
            yearlyPercent: 100,
            bonusTransferLimit: 100
        });
    }
    const txns = getFromStorage('transactions', []);
    let needsSave = false;
    txns.forEach(t => {
        if (!t.status) { t.status = TX_STATUS_APPROVED; needsSave = true; }
    });
    if (needsSave) saveToStorage('transactions', txns);
    const users = getFromStorage('users', []);
    if (users.length === 0) createDemoUserLocal();
})();

// ========================================
// FORMATTING HELPERS
// ========================================
function formatCurrency(amount) {
    return '$' + parseFloat(amount || 0).toFixed(2) + ' USD';
}
function formatNumber(num, decimals = 4) {
    const n = parseFloat(num || 0);
    return n.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

// ========================================
// SETTINGS
// ========================================
function getSettings() {
    return getFromStorage('settings', {
        basePrice: 65, weeklyPercent: 2, monthlyPercent: 8,
        yearlyPercent: 100, bonusTransferLimit: 100
    });
}

// ========================================
// PRICE CALCULATION
// ========================================
function calculatePrice(karat, unit, quantity) {
    const settings = getSettings();
    const karatMultiplier = KARAT_MULTIPLIERS[karat] || 1;
    const unitMultiplier  = UNIT_MULTIPLIERS[unit]  || 1;
    const basePrice       = settings.basePrice;
    const totalGrams      = parseFloat(quantity || 0) * unitMultiplier;
    const pricePerGram    = basePrice * karatMultiplier;
    const totalPrice      = totalGrams * pricePerGram;
    return { basePrice, karatMultiplier, unitMultiplier, totalGrams, pricePerGram, totalPrice };
}

function setupCalculator(prefix = '') {
    const karatEl = document.getElementById(prefix + 'karat');
    const unitEl  = document.getElementById(prefix + 'unit');
    const qtyEl   = document.getElementById(prefix + 'quantity');
    const totalEl = document.getElementById(prefix + 'totalPrice');
    if (!karatEl || !unitEl || !qtyEl) return;

    const update = () => {
        const karat = karatEl.value;
        const unit  = unitEl.value;
        const qty   = parseFloat(qtyEl.value) || 0;
        if (qty <= 0) {
            if (totalEl) setElementValue(totalEl, formatCurrency(0));
            updateBreakdown(prefix, { totalGrams: 0, pricePerGram: 0, totalPrice: 0 });
            return;
        }
        const result = calculatePrice(karat, unit, qty);
        if (totalEl) setElementValue(totalEl, formatCurrency(result.totalPrice));
        updateBreakdown(prefix, result);
    };
    karatEl.addEventListener('change', update);
    unitEl .addEventListener('change', update);
    qtyEl  .addEventListener('input',  update);
    update();
}
function updateBreakdown(prefix, result) {
    const g  = document.getElementById(prefix + 'breakdownGrams');
    const p  = document.getElementById(prefix + 'breakdownPPG');
    if (g) g.textContent = formatNumber(result.totalGrams, 4) + ' g';
    if (p) p.textContent = formatCurrency(result.pricePerGram);
}

// ========================================
// AUTHENTICATION MODULE (shared)
// ========================================
const Auth = (function () {
    const _registerLocal = function (name, email, password, country, address) {
        const tEmail = String(email).trim().toLowerCase();
        const tPwd   = String(password).trim();
        const users  = getFromStorage('users', []);
        const existing = users.find(u => String(u.email || '').trim().toLowerCase() === tEmail);
        if (existing) {
            if (String(existing.password || '').trim() === tPwd) {
                return { success: true, user: existing, _reused: true, message: 'Welcome back! Your account already exists — signing you in.' };
            }
            return { success: false, message: 'Email already registered. Please login instead.' };
        }
        const newUser = {
            id: Date.now(),
            name: String(name).trim(),
            email: tEmail,
            password: tPwd,
            country: String(country || '').trim(),
            address: String(address || '').trim()
        };
        users.push(newUser);
        const saved = saveToStorage('users', users);
        if (!saved) return { success: false, message: 'Could not save your account. Please disable Private Browsing or free up storage and try again.' };

        const wallets = getFromStorage('wallets', []);
        if (!wallets.find(w => String(w.userId) === String(newUser.id))) {
            wallets.push({ userId: newUser.id, main: 0, vault: 0, bonus: 0 });
            saveToStorage('wallets', wallets);
        }
        return { success: true, user: newUser, message: 'Registration successful!' };
    };

    const _loginLocal = function (email, password) {
        try {
            if (localStorage.getItem('currentUserId')) localStorage.removeItem('currentUserId');
        } catch (_) {}
        const users  = getFromStorage('users', []);
        const tEmail = String(email || '').trim().toLowerCase();
        const tPwd   = String(password || '').trim();
        console.debug('[Auth:Login] Attempting login for:', tEmail, '| users in db:', users.length);
        let user = null;
        const emailMatch = users.find(u => String(u.email || '').trim().toLowerCase() === tEmail);
        if (emailMatch) {
            const uPwd = String(emailMatch.password || '').trim();
            if (uPwd === tPwd) {
                user = emailMatch;
                console.debug('[Auth:Login] Exact email + password match. Name:', emailMatch.name);
            } else {
                console.debug('[Auth:Login] Email match found but stored password differs.',
                    '| providedLen:', tPwd.length, 'storedLen:', uPwd.length,
                    '| looseEq:', uPwd == tPwd, '| encodedEq:', tPwd && uPwd && encodeURIComponent(uPwd) === encodeURIComponent(tPwd));
                if (tPwd && uPwd && (uPwd == tPwd || encodeURIComponent(uPwd) === encodeURIComponent(tPwd))) user = emailMatch;
            }
        }
        if (!user) {
            user = users.find(u => {
                const uEmail = String(u.email || '').trim().toLowerCase();
                const uPwd   = String(u.password || '').trim();
                return uEmail === tEmail && (uPwd === tPwd || uPwd == tPwd);
            });
        }
        if (!user) {
            console.warn('[Auth:Login] FAIL — no matching email/password pair for:', tEmail);
            const hint = emailMatch ? ' Email exists — double-check your password.' : '';
            return { success: false, message: 'Invalid email or password. Please check your details and try again.' + hint };
        }
        let sessionSaved = false;
        try {
            localStorage.setItem('currentUserId', String(user.id));
            sessionSaved = (localStorage.getItem('currentUserId') === String(user.id));
        } catch (_) {}
        if (!sessionSaved) return { success: false, message: 'Could not create your session. Please disable Private Browsing or try another browser.' };
        return { success: true, user, message: 'Login successful! Redirecting...' };
    };

    const module = {
        _localRegister: _registerLocal,
        _localLogin: _loginLocal,
        getCurrentUser() {
            const userId = localStorage.getItem('currentUserId');
            if (!userId) return null;
            const users = getFromStorage('users', []);
            let u = users.find(x => String(x.id) === String(userId));
            if (!u) u = users.find(x => x.id == userId);
            return u || null;
        },
        getCurrentUserId() {
            const raw = localStorage.getItem('currentUserId');
            if (!raw) return null;
            const n = parseInt(raw);
            if (Number.isFinite(n) && String(n) === String(raw).trim()) return n;
            const users = getFromStorage('users', []);
            const match = users.find(x => String(x.id) === String(raw) || x.id == raw);
            return match ? match.id : (Number.isFinite(n) ? n : null);
        },
        checkSession(redirect = true) {
            const user = this.getCurrentUser();
            if (!user && redirect) {
                try { window.location.href = 'auth.html'; } catch (_) {}
            }
            return user;
        },
        register(name, email, password, country, address) {
            const FB = (typeof window !== 'undefined') && window.FB;
            if (FB && FB.enabled && FB.auth && FB.auth.createUserWithEmailAndPassword) {
                return (async () => {
                    try {
                        const trimmedEmail = String(email).trim().toLowerCase();
                        const trimmedPwd   = String(password).trim();
                        const trimmedName  = String(name).trim();
                        const trimmedCountry = String(country || '').trim();
                        const trimmedAddress = String(address || '').trim();
                        const uc = await FB.auth.createUserWithEmailAndPassword(trimmedEmail, trimmedPwd);
                        const fbUid = uc && uc.user && uc.user.uid;
                        const local = _registerLocal(trimmedName, trimmedEmail, trimmedPwd, trimmedCountry, trimmedAddress);
                        if (local && local.success && fbUid && FB.db) {
                            try {
                                await FB.db.collection('users').doc(fbUid).set({
                                    name: trimmedName, email: trimmedEmail, country: trimmedCountry,
                                    address: trimmedAddress, localUserId: local.user.id, role: 'user',
                                    createdAt: new Date().toISOString()
                                }).catch(() => {});
                                await FB.db.collection('wallets').doc(fbUid).set({
                                    userId: local.user.id, main: 0, vault: 0, bonus: 0,
                                    updatedAt: new Date().toISOString()
                                }).catch(() => {});
                            } catch (_) {}
                        }
                        if (local && local.success) return local;
                        if (local && (local.message || '').includes('already registered')) {
                            const login = _loginLocal(trimmedEmail, trimmedPwd);
                            if (login.success) return { ...login, message: login.message + ' (Account already existed)' };
                        }
                        return local;
                    } catch (e) {
                        const local = _registerLocal(name, email, password, country, address);
                        if (local && local.success) return local;
                        if (local && (local.message || '').includes('already registered')) {
                            const login = _loginLocal(String(email).trim().toLowerCase(), String(password).trim());
                            if (login.success) return { ...login, message: 'Welcome back! Signed you in.' };
                        }
                        return local;
                    }
                })();
            }
            const local = _registerLocal(name, email, password, country, address);
            if (local && local.success) return Promise.resolve(local);
            if (local && (local.message || '').includes('already registered')) {
                const login = _loginLocal(String(email).trim().toLowerCase(), String(password).trim());
                if (login.success) return Promise.resolve({ ...login, message: 'Welcome back! Signed you in.' });
            }
            return Promise.resolve(local);
        },
        login(email, password) {
            const tEmail = String(email || '').trim().toLowerCase();
            const tPwd   = String(password || '').trim();
            const local  = _loginLocal(tEmail, tPwd);
            const FB = (typeof window !== 'undefined') && window.FB;
            if (local && local.success) {
                if (FB && FB.enabled && FB.auth && FB.auth.signInWithEmailAndPassword) {
                    FB.auth.signInWithEmailAndPassword(tEmail, tPwd).catch(() => {});
                    if (FB.analytics) try { FB.analytics.logEvent('login', { method: 'email' }); } catch (_) {}
                }
                return Promise.resolve(local);
            }
            async function tryFirebaseLogin(fb) {
                try {
                    const uc = await fb.auth.signInWithEmailAndPassword(tEmail, tPwd);
                    const fbUid = uc && uc.user && uc.user.uid;
                    let doc = {};
                    if (fbUid && fb.db) {
                        try {
                            const snap = await fb.db.collection('users').doc(fbUid).get().catch(() => null);
                            doc = (snap && typeof snap.data === 'function') ? (snap.data() || {}) : {};
                        } catch (_) {}
                    }
                    const reg = _registerLocal(
                        doc.name    || tEmail.split('@')[0],
                        tEmail,
                        tPwd,
                        doc.country || '',
                        doc.address || ''
                    );
                    if (reg && (reg.success || reg._reused)) {
                        return _loginLocal(tEmail, tPwd);
                    }
                    if (reg && (reg.message || '').includes('already registered')) {
                        const users = getFromStorage('users', []);
                        const idx = users.findIndex(u => String(u.email || '').trim().toLowerCase() === tEmail);
                        if (idx >= 0) {
                            users[idx].password = tPwd;
                            if (doc.name)    users[idx].name    = String(doc.name).trim() || users[idx].name;
                            if (doc.country) users[idx].country = String(doc.country).trim() || users[idx].country;
                            if (doc.address) users[idx].address = String(doc.address).trim() || users[idx].address;
                            if (fbUid) users[idx].fbUid = fbUid;
                            saveToStorage('users', users);
                            return _loginLocal(tEmail, tPwd);
                        }
                    }
                    return { success: false, message: 'Invalid email or password. Please check your details and try again.' };
                } catch (e) {
                    return local;
                }
            }
            if (FB && FB.enabled && FB.auth && FB.auth.signInWithEmailAndPassword && FB.db) {
                return tryFirebaseLogin(FB);
            }
            if (typeof window !== 'undefined' && window.addEventListener) {
                const FB_WAIT_MS = 6000;
                return new Promise(resolve => {
                    let settled = false;
                    const timer = setTimeout(() => {
                        if (settled) return;
                        settled = true;
                        const fb = window.FB;
                        if (fb && fb.enabled && fb.auth && fb.auth.signInWithEmailAndPassword) {
                            resolve(tryFirebaseLogin(fb));
                        } else {
                            resolve(local);
                        }
                    }, FB_WAIT_MS);
                    window.addEventListener('firebase-ready', function once() {
                        if (settled) return;
                        settled = true;
                        clearTimeout(timer);
                        window.removeEventListener('firebase-ready', once);
                        const fb = window.FB;
                        if (fb && fb.enabled && fb.auth && fb.auth.signInWithEmailAndPassword) {
                            resolve(tryFirebaseLogin(fb));
                        } else {
                            resolve(local);
                        }
                    }, { once: false });
                });
            }
            return Promise.resolve(local);
        },
        logout() {
            const FB = (typeof window !== 'undefined') && window.FB;
            if (FB && FB.enabled && FB.auth && typeof FB.auth.signOut === 'function') {
                try { FB.auth.signOut().catch(() => {}); } catch (_) {}
            }
            try { localStorage.removeItem('currentUserId'); } catch (_) {}
            try { localStorage.removeItem('adminLoggedIn'); } catch (_) {}
            try { window.location.href = 'index.html'; } catch (_) {}
        },
        adminLogin(email, password) {
            const tEmail = String(email || '').trim().toLowerCase();
            const tPwd = String(password || '').trim();
            if (tEmail === String(ADMIN_EMAIL).toLowerCase() && tPwd === String(ADMIN_PASSWORD)) {
                try { localStorage.setItem('adminLoggedIn', 'true'); } catch (_) {}
                return { success: true, message: 'Admin access granted' };
            }
            return { success: false, message: 'Invalid admin email or password' };
        },
        checkAdminSession(redirect = true) {
            const isAdmin = localStorage.getItem('adminLoggedIn') === 'true';
            if (!isAdmin && redirect) {
                try { window.location.href = 'admin.html'; } catch (_) {}
            }
            return isAdmin;
        }
    };
    return module;
})();

// ========================================
// USER, WALLET & TRANSACTION HELPERS
// ========================================
function getUserById(userId) {
    if (userId === null || userId === undefined) return null;
    const users = getFromStorage('users', []);
    const uid = String(userId);
    let u = users.find(x => String(x.id) === uid);
    if (!u) u = users.find(x => String(x.fbUid || '') === uid);
    if (!u) u = users.find(x => x.id == userId);
    return u || null;
}
function getUserWallet(userId) {
    const wallets = getFromStorage('wallets', []);
    let w = wallets.find(x => String(x.userId) === String(userId));
    if (!w) w = wallets.find(x => x.userId === userId);
    if (!w) w = wallets.find(x => x.id == userId);
    return w || null;
}
function saveWallet(wallet) {
    const wallets = getFromStorage('wallets', []);
    const idx = wallets.findIndex(w => String(w.userId) === String(wallet.userId) || w.userId === wallet.userId);
    idx >= 0 ? (wallets[idx] = wallet) : wallets.push(wallet);
    saveToStorage('wallets', wallets);
}
function saveTransaction(tx) {
    const transactions = getFromStorage('transactions', []);
    if (!tx.status) tx.status = TX_STATUS_APPROVED;
    transactions.unshift(tx);
    saveToStorage('transactions', transactions);
}
function updateTransaction(txId, updates) {
    const transactions = getFromStorage('transactions', []);
    const idx = transactions.findIndex(t => String(t.id) === String(txId));
    if (idx >= 0) {
        transactions[idx] = { ...transactions[idx], ...updates };
        saveToStorage('transactions', transactions);
        return transactions[idx];
    }
    return null;
}
function getTransactionById(txId) {
    const transactions = getFromStorage('transactions', []);
    return transactions.find(t => String(t.id) === String(txId)) || null;
}
function getAllTransactions() {
    return getFromStorage('transactions', []);
}
function getPendingTransactions() {
    return getAllTransactions().filter(t => t.status === TX_STATUS_PENDING);
}

function buyGold(karat, unit, quantity, paymentMethod = '', paymentDetails = '') {
    const userId = Auth.getCurrentUserId();
    if (!userId) return { success: false, message: 'Please login first', requiresAuth: true };

    const qty = parseFloat(quantity);
    if (qty <= 0) return { success: false, message: 'Please enter a valid quantity' };

    const calc   = calculatePrice(karat, unit, quantity);
    const user   = Auth.getCurrentUser();
    if (!user)   return { success: false, message: 'User not found' };

    const transaction = {
        id: Date.now(),
        userId,
        type: 'BUY',
        karat,
        unit,
        grams: calc.totalGrams,
        price: calc.totalPrice,
        date: new Date().toISOString(),
        status: TX_STATUS_PENDING,
        paymentMethod: paymentMethod || 'Not specified',
        paymentDetails: paymentDetails || '',
        note: 'Awaiting admin approval'
    };
    saveTransaction(transaction);

    return {
        success: true,
        message: 'Purchase order submitted! Awaiting admin approval before completion.',
        transaction,
        pending: true
    };
}

function sellGold(karat, unit, quantity, payoutMethod = '', deliveryAddress = '', payoutDetails = '') {
    const userId = Auth.getCurrentUserId();
    if (!userId) return { success: false, message: 'Please login first', requiresAuth: true };

    const qty = parseFloat(quantity);
    if (qty <= 0) return { success: false, message: 'Please enter a valid quantity' };

    const calc   = calculatePrice(karat, unit, quantity);
    const wallet = getUserWallet(userId);
    if (!wallet || wallet.main < calc.totalGrams) {
        return { success: false, message: 'Insufficient gold balance in Main wallet' };
    }

    const transaction = {
        id: Date.now(),
        userId,
        type: 'SELL',
        karat,
        unit,
        grams: calc.totalGrams,
        price: calc.totalPrice,
        date: new Date().toISOString(),
        status: TX_STATUS_PENDING,
        payoutMethod: payoutMethod || 'Not specified',
        payoutDetails: payoutDetails || '',
        deliveryAddress: deliveryAddress || '',
        note: 'Awaiting admin approval before completion'
    };
    saveTransaction(transaction);

    return {
        success: true,
        message: 'Sell order submitted! Awaiting admin approval before completion.',
        transaction,
        pending: true
    };
}

function transferBonusToMain(grams) {
    const userId = Auth.getCurrentUserId();
    if (!userId) return { success: false, message: 'Please login' };

    const settings      = getSettings();
    const wallet        = getUserWallet(userId);
    const transferGrams = parseFloat(grams);

    if (transferGrams > settings.bonusTransferLimit) {
        return { success: false, message: `Transfer limit exceeded. Max ${settings.bonusTransferLimit}g per transfer.` };
    }
    if (wallet.bonus < transferGrams) {
        return { success: false, message: 'Insufficient Bonus balance' };
    }
    wallet.bonus = parseFloat((wallet.bonus - transferGrams).toFixed(6));
    wallet.main  = parseFloat((wallet.main  + transferGrams).toFixed(6));
    saveWallet(wallet);

    saveTransaction({
        id: Date.now(), userId, type: 'TRANSFER', karat: '24K',
        grams: transferGrams, price: 0, date: new Date().toISOString(),
        note: 'Bonus → Main', status: TX_STATUS_APPROVED
    });
    return { success: true, message: 'Transfer completed!' };
}

// ========================================
// CERTIFICATES MODULE (shared)
// ========================================
function generatePolicyNumber() {
    const year   = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    return `GLD-INS-${year}-${random}`;
}
function generateCertificateData(user, transaction, calc) {
    const certificates = getFromStorage('certificates', []);
    const cert = {
        id: transaction.id,
        userId: user.id,
        policyNumber: generatePolicyNumber(),
        userName: user.name,
        userEmail: user.email,
        karat: transaction.karat,
        grams: transaction.grams,
        value: transaction.price,
        date: transaction.date,
        custodian: "Brink's Global Services",
        underwriter: "Lloyd's of London",
        title: "CERTIFICATE OF INSURANCE & CUSTODIAL COVERAGE"
    };
    certificates.unshift(cert);
    saveToStorage('certificates', certificates);
    return cert;
}
function getUserCertificates(userId) {
    return getFromStorage('certificates', []).filter(c => c.userId === userId);
}
function downloadCertificate(certId) {
    const cert = getFromStorage('certificates', []).find(c => String(c.id) === String(certId));
    if (cert) generateCertificatePDF(cert);
}
function generateCertificatePDF(cert) {
    try {
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF) { showToast('PDF library not loaded', 'error'); return cert; }
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth  = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;

        doc.setFillColor(250, 248, 240);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        doc.setDrawColor(212, 175, 55);
        doc.setLineWidth(1.5);
        doc.rect(margin - 5, margin - 5, pageWidth - 2 * (margin - 5), pageHeight - 2 * (margin - 5));
        doc.setLineWidth(0.5);
        doc.rect(margin - 2, margin - 2, pageWidth - 2 * (margin - 2), pageHeight - 2 * (margin - 2));

        doc.setFillColor(212, 175, 55);
        doc.rect(margin - 5, margin - 5, pageWidth - 2 * (margin - 5), 25, 'F');

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('NEXGOLD EXCHANGE', pageWidth / 2, margin + 10, { align: 'center' });

        doc.setFontSize(15);
        doc.setTextColor(212, 175, 55);
        doc.text(cert.title, pageWidth / 2, margin + 45, { align: 'center' });

        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60);
        doc.setFont('helvetica', 'normal');
        doc.text(`POLICY NUMBER: ${cert.policyNumber}`, pageWidth / 2, margin + 55, { align: 'center' });

        const certDate = new Date(cert.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.text(`Date of Issue: ${certDate}`, pageWidth / 2, margin + 62, { align: 'center' });

        doc.setDrawColor(212, 175, 55);
        doc.setLineWidth(0.8);
        doc.line(margin, margin + 72, pageWidth - margin, margin + 72);

        let currentY = margin + 85;
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
        const sections = [
            { label: 'Account Holder:', value: cert.userName },
            { label: 'Email:', value: cert.userEmail },
            { label: 'Asset:', value: `${cert.karat} Gold, ${formatNumber(cert.grams, 4)} Grams` },
            { label: 'Insured Value:', value: `$${formatNumber(cert.value, 2)} USD` },
            { label: 'Custodian:', value: cert.custodian },
            { label: 'Underwriter:', value: cert.underwriter }
        ];
        sections.forEach(sec => {
            doc.setFont('helvetica', 'bold');
            doc.text(sec.label, margin, currentY);
            doc.setFont('helvetica', 'normal');
            doc.text(sec.value, margin + 55, currentY);
            currentY += 10;
        });

        currentY += 10;
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        const coverageText = 'This certificate confirms that the above-named account holder holds the specified gold asset in secure custody. The asset is fully insured against theft, loss, and damage under the terms of the master policy held by NEXGOLD EXCHANGE.';
        doc.text(doc.splitTextToSize(coverageText, pageWidth - 2 * margin), margin, currentY);
        currentY += 35;

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        const qrSize = 35;
        const qrX = pageWidth - margin - qrSize;
        doc.rect(qrX, currentY, qrSize, qrSize);
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text('QR Code', qrX + qrSize / 2, currentY + qrSize / 2 + 2, { align: 'center' });
        doc.text('Verify',   qrX + qrSize / 2, currentY + qrSize / 2 + 8, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.setFont('helvetica', 'bold');
        doc.text('Coverage Details:', margin, currentY);
        currentY += 6;
        doc.setFont('helvetica', 'normal');
        doc.text(`Storage: Fully Segregated, Audited Monthly`, margin, currentY); currentY += 5;
        doc.text(`Insurance: All-risk, Full Replacement Value`, margin, currentY); currentY += 5;
        doc.text(`Audit: Quarterly Independent Third-Party`, margin, currentY); currentY += 5;
        doc.text(`Redemption: Physical Delivery Available`, margin, currentY);

        currentY = pageHeight - margin - 35;
        doc.setDrawColor(60, 60, 60);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY, margin + 60, currentY);
        doc.line(pageWidth - margin - 60, currentY, pageWidth - margin, currentY);
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.text('Authorized Signature', margin, currentY + 6);
        doc.text('Account Holder Acknowledgment', pageWidth - margin - 60, currentY + 6, { align: 'left' });
        doc.text('NEXGOLD EXCHANGE', margin, currentY + 15);
        doc.text(cert.userName, pageWidth - margin - 60, currentY + 15);

        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(`Certificate ID: ${cert.id} | This is a system-generated document.`, pageWidth / 2, pageHeight - 8, { align: 'center' });

        doc.save(`NEXGOLD-Certificate-${cert.policyNumber}.pdf`);
    } catch (e) {
        console.warn('PDF generation failed:', e);
        showToast('Certificate saved (PDF unavailable in this environment)', 'info');
    }
    return cert;
}

// ========================================
// DASHBOARD HELPERS (shared rendering functions)
// ========================================
function getUserTransactions(userId, limit = 10) {
    return getFromStorage('transactions', []).filter(t => String(t.userId) === String(userId)).slice(0, limit);
}

function statusBadgeClass(status) {
    switch (status) {
        case TX_STATUS_APPROVED: return 'background: rgba(34, 197, 94, 0.15); color: #22c55e;';
        case TX_STATUS_REJECTED: return 'background: rgba(239, 68, 68, 0.15); color: #ef4444;';
        case TX_STATUS_PENDING:
        default:
            return 'background: rgba(245, 158, 11, 0.15); color: #f59e0b;';
    }
}

function renderTransactionHistory(userId, containerId, limit = 10) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const transactions = getUserTransactions(userId, limit);

    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-journal-x"></i>
                <h5>No Transactions Yet</h5>
                <p>Your transaction history will appear here after your first purchase.</p>
            </div>`;
        return;
    }
    container.innerHTML = `
        <table class="table table-nexgold align-middle">
            <thead><tr><th>Type</th><th>Asset</th><th>Grams</th><th>Value</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>${transactions.map(t => `
                <tr>
                    <td><span class="badge-${t.type.toLowerCase() === 'buy' ? 'buy' : t.type.toLowerCase() === 'sell' ? 'sell' : 'buy'}">${t.type}</span></td>
                    <td>${t.karat} Gold</td>
                    <td>${formatNumber(t.grams, 4)} g</td>
                    <td>${t.type === 'TRANSFER' ? '-' : formatCurrency(t.price)}</td>
                    <td><span style="padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; ${statusBadgeClass(t.status)}">${t.status || TX_STATUS_APPROVED}</span>
                    ${t.status === TX_STATUS_PENDING ? '<div style="font-size:10px;color:#f59e0b;margin-top:2px;">Awaiting admin</div>' : ''}
                    </td>
                    <td>${new Date(t.date).toLocaleString()}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
}

function renderCertificatesList(userId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const certs = getUserCertificates(userId);

    if (certs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-file-earmark-text"></i>
                <h5>No Certificates Yet</h5>
                <p>Purchase gold & have your order approved by admin to receive your insurance & custody certificates.</p>
            </div>`;
        return;
    }
    container.innerHTML = certs.map(c => `
        <div class="certificate-card">
            <div class="certificate-info">
                <h5><i class="bi bi-shield-check text-gold"></i> ${c.title.substring(0, 35)}...</h5>
                <p><span class="certificate-id">${c.policyNumber}</span> | ${c.karat} Gold | ${formatNumber(c.grams, 4)}g | Insured: ${formatCurrency(c.value)}</p>
                <p style="margin-top:6px;">Issued: ${new Date(c.date).toLocaleDateString()}</p>
            </div>
            <button class="btn-sm-gold" onclick="downloadCertificate(${c.id})">
                <i class="bi bi-download"></i> Download PDF
            </button>
        </div>`).join('');
}

function renderWalletCards(userId) {
    const wallet   = getUserWallet(userId);
    const user     = Auth.getCurrentUser();
    const settings = getSettings();
    if (!wallet || !user) return;

    const pricePerGram = settings.basePrice;
    const mainUSD  = wallet.main  * pricePerGram;
    const vaultUSD = wallet.vault * pricePerGram;
    const bonusUSD = wallet.bonus * pricePerGram;

    const mainCard  = document.getElementById('mainWalletCard');
    const vaultCard = document.getElementById('vaultWalletCard');
    const bonusCard = document.getElementById('bonusWalletCard');

    if (mainCard) {
        const gramsEl = mainCard.querySelector('.wallet-balance-grams');
        const usdEl   = mainCard.querySelector('.wallet-balance-usd .amount');
        if (gramsEl) gramsEl.textContent = formatNumber(wallet.main, 4);
        if (usdEl)   usdEl.textContent   = formatCurrency(mainUSD);
    }
    if (vaultCard) {
        const gramsEl = vaultCard.querySelector('.wallet-balance-grams');
        const usdEl   = vaultCard.querySelector('.wallet-balance-usd .amount');
        if (gramsEl) gramsEl.textContent = formatNumber(wallet.vault, 4);
        if (usdEl)   usdEl.textContent   = formatCurrency(vaultUSD);
    }
    if (bonusCard) {
        const gramsEl = bonusCard.querySelector('.wallet-balance-grams');
        const usdEl   = bonusCard.querySelector('.wallet-balance-usd .amount');
        if (gramsEl) gramsEl.textContent = formatNumber(wallet.bonus, 4);
        if (usdEl)   usdEl.textContent   = formatCurrency(bonusUSD);
    }
    const welcomeEl = document.getElementById('welcomeName');
    if (welcomeEl) welcomeEl.textContent = user.name;

    document.querySelectorAll('.live-price').forEach(el => {
        el.textContent = formatCurrency(pricePerGram) + '/g (24K)';
    });
}

// ========================================
// INVESTMENT CALCULATOR
// ========================================
function calculateInvestment(amount, periodType, periods) {
    const settings  = getSettings();
    const amountNum = parseFloat(amount) || 0;
    const pNum      = parseInt(periods)  || 1;
    let rate;
    switch (periodType) {
        case 'Weekly':  rate = settings.weeklyPercent;  break;
        case 'Monthly': rate = settings.monthlyPercent; break;
        case 'Yearly':  rate = settings.yearlyPercent;  break;
        default:        rate = settings.monthlyPercent;
    }
    const projection    = amountNum * Math.pow(1 + rate / 100, pNum);
    const growth        = projection - amountNum;
    const growthPercent = amountNum > 0 ? (growth / amountNum) * 100 : 0;
    const chartData = [];
    for (let i = 0; i <= pNum; i++) {
        chartData.push({ period: i, value: amountNum * Math.pow(1 + rate / 100, i) });
    }
    return { initial: amountNum, projection, growth, growthPercent, rate, periods: pNum, periodType, chartData };
}

let investmentChart = null;
function renderInvestmentChart(chartData, canvasId = 'investmentChart') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;
    const ctx = canvas.getContext('2d');
    if (investmentChart) investmentChart.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(212, 175, 55, 0.4)');
    gradient.addColorStop(1, 'rgba(212, 175, 55, 0.02)');

    investmentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map(d => `P${d.period}`),
            datasets: [{
                label: 'Projected Value',
                data: chartData.map(d => d.value),
                borderColor: '#D4AF37', backgroundColor: gradient,
                borderWidth: 3, fill: true, tension: 0.4,
                pointBackgroundColor: '#D4AF37', pointBorderColor: '#000',
                pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `$${ctx.parsed.y.toFixed(2)} USD` } }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6c757d' } },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#6c757d', callback: (val) => '$' + val.toLocaleString() }
                }
            }
        }
    });
}

// ========================================
// ADMIN MODULE (shared helpers)
// ========================================
const Admin = {
    getStats() {
        const users        = getFromStorage('users', []);
        const transactions = getFromStorage('transactions', []);
        const approvedBuys = transactions.filter(t => t.type === 'BUY' && t.status === TX_STATUS_APPROVED);
        const wallets      = getFromStorage('wallets', []);
        return {
            totalUsers:        users.length,
            totalTransactions: transactions.length,
            totalGoldSold:     approvedBuys.reduce((sum, t) => sum + (t.grams || 0), 0),
            totalVolume:       approvedBuys.reduce((sum, t) => sum + (t.price || 0), 0),
            totalGoldHeld:     wallets.reduce((sum, w) => sum + (w.main || 0) + (w.vault || 0) + (w.bonus || 0), 0),
            pendingCount:      transactions.filter(t => t.status === TX_STATUS_PENDING).length
        };
    },
    getAllUsersWithWallets() {
        const users   = getFromStorage('users', []);
        const wallets = getFromStorage('wallets', []);
        return users.map(u => ({
            ...u,
            wallet: wallets.find(w => String(w.userId) === String(u.id)) || { main: 0, vault: 0, bonus: 0 }
        }));
    },
    creditWallet(userId, walletType, grams) {
        let wallet = getUserWallet(userId);
        if (!wallet) {
            const wallets = getFromStorage('wallets', []);
            const users   = getFromStorage('users', []);
            const uByUid  = users.find(u => String(u.fbUid || '') === String(userId)) ||
                            users.find(u => String(u.id) === String(userId));
            if (uByUid) wallet = wallets.find(w => String(w.userId) === String(uByUid.id));
        }
        if (!wallet) return { success: false, message: `Wallet not found for user "${userId}" — please have them login once first` };
        const g = parseFloat(grams);
        if (isNaN(g) || g <= 0) return { success: false, message: 'Invalid amount' };
        wallet[walletType] = parseFloat((wallet[walletType] + g).toFixed(6));
        saveWallet(wallet);
        return { success: true, message: `Credited ${g}g to ${walletType}` };
    },
    debitWallet(userId, walletType, grams) {
        let wallet = getUserWallet(userId);
        if (!wallet) {
            const wallets = getFromStorage('wallets', []);
            const users   = getFromStorage('users', []);
            const uByUid  = users.find(u => String(u.fbUid || '') === String(userId)) ||
                            users.find(u => String(u.id) === String(userId));
            if (uByUid) wallet = wallets.find(w => String(w.userId) === String(uByUid.id));
        }
        if (!wallet) return { success: false, message: `Wallet not found for user "${userId}" — please have them login once first` };
        const g = parseFloat(grams);
        if (isNaN(g) || g <= 0) return { success: false, message: 'Invalid amount' };
        if (wallet[walletType] < g) return { success: false, message: `Insufficient balance in ${walletType}` };
        wallet[walletType] = parseFloat((wallet[walletType] - g).toFixed(6));
        saveWallet(wallet);
        return { success: true, message: `Debited ${g}g from ${walletType}` };
    },
    updateSettings(newSettings) {
        const settings = getSettings();
        const updated  = { ...settings, ...newSettings };
        Object.keys(updated).forEach(k => {
            if (typeof updated[k] === 'string' && !isNaN(parseFloat(updated[k]))) updated[k] = parseFloat(updated[k]);
        });
        saveToStorage('settings', updated);
        return { success: true, settings: updated };
    },
    getPaymentMethods() {
        return getFromStorage('paymentMethods', { usdt: '', btc: '', bankAccounts: [] });
    },
    savePaymentMethods(methods) {
        saveToStorage('paymentMethods', methods);
        return { success: true };
    },
    approveTransaction(txId) {
        console.info('[Admin:Approve] called for txId:', txId, '(type:', typeof txId, ')');
        const tx = getTransactionById(txId);
        if (!tx) { console.error('[Admin:Approve] transaction not found for id=', txId); return { success: false, message: 'Transaction not found — try refreshing the page' }; }
        if (tx.status === TX_STATUS_APPROVED) return { success: true, message: 'Already approved', transaction: tx };
        if (tx.status === TX_STATUS_REJECTED) return { success: false, message: 'Cannot approve a rejected transaction' };

        const users = getFromStorage('users', []);
        const user = users.find(u => String(u.id) === String(tx.userId));
        const wallet = getUserWallet(tx.userId);
        console.info('[Admin:Approve] found user=', !!user, '| wallet=', !!wallet, '| userId=', tx.userId, '| type=', tx.type);
        if (!wallet) return { success: false, message: 'User wallet not found — unable to process' };

        if (tx.type === 'BUY') {
            wallet.main = parseFloat((wallet.main + (tx.grams || 0)).toFixed(6));
            saveWallet(wallet);

            let cert = null;
            if (user) {
                const calc = calculatePrice(tx.karat, tx.unit || 'Gram', (tx.grams || 0) / (UNIT_MULTIPLIERS[tx.unit || 'Gram'] || 1));
                cert = generateCertificateData(user, tx, calc);
            }
            const updated = updateTransaction(txId, {
                status: TX_STATUS_APPROVED,
                approvedAt: new Date().toISOString(),
                approvedBy: ADMIN_EMAIL,
                note: 'Approved by admin - gold credited to wallet'
            });
            return {
                success: true,
                message: `BUY approved: ${formatNumber(tx.grams, 4)}g credited & certificate issued`,
                transaction: updated,
                certificate: cert
            };
        } else if (tx.type === 'SELL') {
            if (wallet.main < (tx.grams || 0)) {
                return { success: false, message: `User has insufficient balance (${formatNumber(wallet.main,4)}g) — cannot approve ${formatNumber(tx.grams,4)}g sell` };
            }
            wallet.main = parseFloat((wallet.main - (tx.grams || 0)).toFixed(6));
            saveWallet(wallet);

            const updated = updateTransaction(txId, {
                status: TX_STATUS_APPROVED,
                approvedAt: new Date().toISOString(),
                approvedBy: ADMIN_EMAIL,
                note: 'Approved by admin - gold debited & payout queued'
            });
            return {
                success: true,
                message: `SELL approved: ${formatNumber(tx.grams, 4)}g debited from wallet`,
                transaction: updated
            };
        } else {
            const updated = updateTransaction(txId, {
                status: TX_STATUS_APPROVED,
                approvedAt: new Date().toISOString(),
                approvedBy: ADMIN_EMAIL
            });
            return { success: true, message: 'Transaction approved', transaction: updated };
        }
    },
    rejectTransaction(txId, reason = '') {
        const tx = getTransactionById(txId);
        if (!tx) return { success: false, message: 'Transaction not found — try refreshing the page' };
        if (tx.status === TX_STATUS_REJECTED) return { success: true, message: 'Already rejected', transaction: tx };
        if (tx.status === TX_STATUS_APPROVED) return { success: false, message: 'Cannot reject an already-approved transaction' };

        const updated = updateTransaction(txId, {
            status: TX_STATUS_REJECTED,
            rejectedAt: new Date().toISOString(),
            rejectedBy: ADMIN_EMAIL,
            rejectionReason: reason || 'Not specified',
            note: 'Rejected by admin'
        });
        return { success: true, message: 'Transaction rejected — wallet left untouched', transaction: updated };
    }
};

// ========================================
// TOAST / UI HELPERS
// ========================================
function showToast(message, type = 'success') {
    const bg = type === 'success' ? 'linear-gradient(90deg, #16a34a, #22c55e)' :
               type === 'error'   ? 'linear-gradient(90deg, #dc2626, #ef4444)' :
               type === 'warning' ? 'linear-gradient(90deg, #d97706, #f59e0b)' :
                                    'linear-gradient(90deg, #2563eb, #3b82f6)';
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; top: 100px; right: 20px; z-index: 9999;
        background: ${bg}; color: white; padding: 16px 24px;
        border-radius: 12px; font-weight: 600;
        box-shadow: 0 10px 40px rgba(0,0,0,0.4);
        transform: translateX(120%);
        transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        max-width: 380px;`;
    toast.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info-circle'} me-2"></i>${message}`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.transform = 'translateX(0)'; }, 50);
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 500);
    }, 4500);
}

function showAuthModal(type = 'login') {
    try { window.location.href = 'auth.html?tab=' + type; } catch (_) {}
}

// ========================================
// GLOBAL EXPORTS (for inline onclick handlers)
// ========================================
Object.assign(window, {
    Auth, Admin, calculatePrice, buyGold, sellGold, transferBonusToMain,
    generateCertificatePDF, downloadCertificate, calculateInvestment,
    formatCurrency, formatNumber, showToast,
    setupCalculator, renderWalletCards, renderTransactionHistory, renderCertificatesList,
    getTransactionById, getPendingTransactions, getAllTransactions,
    TX_STATUS_PENDING, TX_STATUS_APPROVED, TX_STATUS_REJECTED
});

// ========================================
// GLOBAL DOM READY (live price, lightweight)
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    const settings = getSettings();
    document.querySelectorAll('[data-live-price]').forEach(el => {
        el.textContent = formatCurrency(settings.basePrice) + '/g';
    });
});

/* ========================================
   FIREBASE INTEGRATION LAYER
   (Non-blocking. Falls back to localStorage. Local auth always wins for reliability.)
   ======================================== */
(function attachFirebaseLayer() {
    const onReady = () => {
        const FB = window.FB || {};
        if (!FB.enabled) return;
        const { auth, db, analytics } = FB;

        // KEEP local references for reliable fallback
        const _localRegister = Auth._localRegister || Auth.register.bind(Auth);
        const _localLogin    = Auth._localLogin    || Auth.login.bind(Auth);
        const _localLogout   = Auth.logout.bind(Auth);

        // Auth wrappers: try Firebase, local ALWAYS wins/is source of truth
        Auth.register = async function (name, email, password, country, address) {
            const trimmedEmail = String(email).trim().toLowerCase();
            const trimmedName = String(name).trim();
            const trimmedCountry = String(country || '').trim();
            const trimmedAddress = String(address || '').trim();
            const trimmedPassword = String(password).trim();
            try {
                const uc = await auth.createUserWithEmailAndPassword(trimmedEmail, trimmedPassword);
                const fbUid = uc.user.uid;
                const local = _localRegister(trimmedName, trimmedEmail, trimmedPassword, trimmedCountry, trimmedAddress);
                if (local.success) {
                    try {
                        const fbProfile = { name: trimmedName, email: trimmedEmail, country: trimmedCountry, address: trimmedAddress, localUserId: local.user.id, role: 'user', createdAt: new Date().toISOString() };
                        await db.collection('users').doc(fbUid).set(fbProfile);
                        await db.collection('wallets').doc(fbUid).set({ userId: local.user.id, main: 0, vault: 0, bonus: 0, updatedAt: new Date().toISOString() });
                    } catch (e) { console.warn('[Firebase] write user failed (local OK):', e.message); }
                }
                return local;
            } catch (e) {
                const local = _localRegister(trimmedName, trimmedEmail, trimmedPassword, trimmedCountry, trimmedAddress);
                if (local.success) return local;
                if (local && local._reused) return local;
                if (local && (local.message || '').includes('already registered')) {
                    const login = _localLogin(trimmedEmail, trimmedPassword);
                    if (login.success) return { ...login, message: 'Account already present. Signed you in!' };
                }
                return local;
            }
        };

        Auth.login = async function (email, password) {
            const trimmedEmail = String(email).trim().toLowerCase();
            const trimmedPassword = String(password).trim();
            const local = _localLogin(trimmedEmail, trimmedPassword);
            if (local.success) {
                try {
                    await auth.signInWithEmailAndPassword(trimmedEmail, trimmedPassword).catch(() => {});
                    if (analytics) analytics.logEvent('login', { method: 'email' });
                } catch (_) {}
                return local;
            }
            try {
                const uc = await auth.signInWithEmailAndPassword(trimmedEmail, trimmedPassword);
                const fbUid = uc.user.uid;
                const snap = await db.collection('users').doc(fbUid).get().catch(() => ({ exists: false, data: () => ({}) }));
                const doc = snap.data ? snap.data() : {};
                const reg = _localRegister(
                    doc.name     || trimmedEmail.split('@')[0],
                    trimmedEmail,
                    trimmedPassword,
                    doc.country  || '',
                    doc.address  || ''
                );
                if (reg.success || (reg && reg._reused)) {
                    return _localLogin(trimmedEmail, trimmedPassword);
                }
                if (reg && (reg.message || '').includes('already registered')) {
                    const users = getFromStorage('users', []);
                    const idx = users.findIndex(u => String(u.email || '').trim().toLowerCase() === trimmedEmail);
                    if (idx >= 0) {
                        users[idx].name    = (doc.name    || users[idx].name || '').toString().trim() || users[idx].name;
                        users[idx].country = (doc.country || users[idx].country || '').toString().trim() || users[idx].country;
                        users[idx].address = (doc.address || users[idx].address || '').toString().trim() || users[idx].address;
                        users[idx].password = trimmedPassword;
                        users[idx].fbUid = fbUid;
                        saveToStorage('users', users);
                        console.info('[Auth:Login] Updated local password/profile for', trimmedEmail, 'based on successful Firebase sign-in.');
                        return _localLogin(trimmedEmail, trimmedPassword);
                    }
                }
                return { success: false, message: 'Invalid email or password. Please check your details and try again.' };
            } catch (e) {
                return local;
            }
        };

        Auth.logout = async function () {
            try { await auth.signOut(); } catch (_) {}
            _localLogout();
        };

        // Firestore mirror of writes (best-effort)
        const mirrorToFirestore = async (col, docId, data) => {
            try {
                const uid = auth.currentUser && auth.currentUser.uid;
                const id  = String(uid || docId || (data && data.userId) || 'anon');
                await db.collection(col).doc(String(docId || data.id || Date.now())).set({ ...data, _userId: id, _syncedAt: new Date().toISOString() }, { merge: true });
            } catch (e) {
                console.debug('[Firebase] mirror skip', col, e.code || e.message);
            }
        };

        const _saveWallet      = window.saveWallet;
        const _saveTransaction = window.saveTransaction;
        const _saveToStorage   = window.saveToStorage;

        if (_saveWallet) {
            window.saveWallet = function (w) {
                _saveWallet(w);
                if (auth.currentUser) mirrorToFirestore('wallets', auth.currentUser.uid, w);
            };
        }
        if (_saveTransaction) {
            window.saveTransaction = function (t) {
                _saveTransaction(t);
                mirrorToFirestore('transactions', t.id, t);
                if (analytics) analytics.logEvent('transaction', { type: t.type, value: t.price, grams: t.grams });
            };
        }
        if (_saveToStorage) {
            window.saveToStorage = function (key, value) {
                _saveToStorage(key, value);
                if (key === 'certificates' && Array.isArray(value) && value.length > 0) {
                    const latest = value[0];
                    mirrorToFirestore('certificates', latest.id, latest);
                }
                if (key === 'settings') {
                    try { db.collection('system').doc('settings').set({ value, updatedAt: new Date().toISOString() }); }
                    catch (_) {}
                }
            };
        }

        const _credit = Admin.creditWallet.bind(Admin);
        Admin.creditWallet = async function (userId, walletType, grams) {
            const r = _credit(userId, walletType, grams);
            if (analytics) analytics.logEvent('admin_credit', { userId, walletType, grams });
            return r;
        };

        console.info('[Firebase] Layer attached (local-auth-first mode)');
    };

    async function hydrateSessionFromFirebaseAuth() {
        const FB = window.FB;
        if (!FB || !FB.enabled || !FB.auth) return;
        try {
            const user = FB.auth.currentUser;
            if (!user || !user.email) return;
            const tEmail = String(user.email).trim().toLowerCase();
            const localUsers = getFromStorage('users', []);
            const alreadyLocal = localUsers.some(u => String(u.email || '').trim().toLowerCase() === tEmail
                || (u.fbUid && String(u.fbUid) === String(user.uid)));
            if (alreadyLocal) {
                try {
                    const match = localUsers.find(u => String(u.email || '').trim().toLowerCase() === tEmail
                        || (u.fbUid && String(u.fbUid) === String(user.uid)));
                    if (match && !localStorage.getItem('currentUserId')) {
                        localStorage.setItem('currentUserId', String(match.id));
                    }
                } catch (_) {}
                return;
            }
            let doc = {};
            if (FB.db) {
                try {
                    const snap = await FB.db.collection('users').doc(user.uid).get().catch(() => null);
                    doc = (snap && typeof snap.data === 'function') ? (snap.data() || {}) : {};
                } catch (_) {}
            }
            const dummyPassword = '__fb_hydrated__';
            const reg = Auth._localRegister(
                doc.name    || (user.displayName ? String(user.displayName).trim() : tEmail.split('@')[0]),
                tEmail,
                dummyPassword,
                doc.country || '',
                doc.address || ''
            );
            if (reg && (reg.success || reg._reused)) {
                const users = getFromStorage('users', []);
                const idx = users.findIndex(u => String(u.email || '').trim().toLowerCase() === tEmail);
                if (idx >= 0) {
                    users[idx].fbUid = user.uid;
                    users[idx]._hydratedFromFirebase = true;
                    saveToStorage('users', users);
                }
                try {
                    const saved = reg && reg.user ? reg.user : (reg && reg._reused ? reg.user : null);
                    const targetId = saved ? saved.id : (idx >= 0 ? users[idx].id : null);
                    if (targetId) {
                        localStorage.setItem('currentUserId', String(targetId));
                        console.info('[Auth:Hydrate] Reconstructed local user record + session from Firebase auth state:', tEmail);
                    }
                } catch (_) {}
            }
        } catch (e) {
            console.debug('[Auth:Hydrate] Skipped:', e.message);
        }
    }

    if (window.FB && window.FB.enabled) {
        onReady();
        setTimeout(hydrateSessionFromFirebaseAuth, 0);
        if (window.FB && window.FB.auth && typeof window.FB.auth.onAuthStateChanged === 'function') {
            window.FB.auth.onAuthStateChanged(function (u) {
                if (u && u.email) setTimeout(hydrateSessionFromFirebaseAuth, 50);
            });
        }
    } else {
        window.addEventListener('firebase-ready', function onReadyOnce() {
            onReady();
            setTimeout(hydrateSessionFromFirebaseAuth, 0);
            if (window.FB && window.FB.auth && typeof window.FB.auth.onAuthStateChanged === 'function') {
                window.FB.auth.onAuthStateChanged(function (u) {
                    if (u && u.email) setTimeout(hydrateSessionFromFirebaseAuth, 50);
                });
            }
            window.removeEventListener('firebase-ready', onReadyOnce);
        });
    }
})();

/* ========================================
   DIAGNOSTIC HELPERS (paste in DevTools)
   ======================================== */
window.authDump = function authDump() {
    const users = getFromStorage('users', []);
    const FB = window.FB || {};
    const currentId = (function(){try{return localStorage.getItem('currentUserId');}catch(_){return null;}})();
    const fbUser = FB.auth && FB.auth.currentUser;
    const userSummary = users.map(u => ({
        id: u.id, email: u.email, name: u.name,
        pwdLen: (u.password || '').length, fbUid: u.fbUid || null,
        hydrated: !!u._hydratedFromFirebase,
        isCurrent: currentId !== null && String(u.id) === String(currentId)
    }));
    const info = {
        FB_enabled: !!FB.enabled,
        FB_auth_currentUser: fbUser ? { uid: fbUser.uid, email: fbUser.email, displayName: fbUser.displayName || null } : null,
        localStorage_currentUserId: currentId,
        users_count: users.length,
        users: userSummary,
        wallets: getFromStorage('wallets', []).length,
        transactions: getFromStorage('transactions', []).length
    };
    console.group('%c NEXGOLD AUTH DUMP ', 'background:#000;color:#D4AF37;font-weight:900;padding:6px 14px;border:2px solid #D4AF37;border-radius:8px;');
    console.table(userSummary);
    console.log(info);
    console.groupEnd();
    return info;
};

/* ========================================
   DEMO USER SEEDER (console + auth page banner)
   ======================================== */
const DEMO_USER = {
    name: 'Demo User',
    email: 'demo@nexgold.exchange',
    password: 'Demo@123',
    country: 'Global',
    address: '1 NEXGOLD Tower, Digital Gold District'
};
Object.assign(window, { DEMO_USER });

window.createDemoUser = async function () {
    try {
        const r = await Auth.register(DEMO_USER.name, DEMO_USER.email, DEMO_USER.password, DEMO_USER.country, DEMO_USER.address);
        if (!r.success && (r.message || '').includes('already registered')) {
            const l = await Auth.login(DEMO_USER.email, DEMO_USER.password);
            console.log('[DEMO] Already existed -> logged in.');
            return l;
        }
        if (r && r.success) {
            const uid = r.user.id;
            const wallets = getFromStorage('wallets', []);
            const w = wallets.find(x => String(x.userId) === String(uid));
            if (w) {
                w.main  = parseFloat((w.main + 1.5).toFixed(4));
                w.bonus = parseFloat((w.bonus + 0.5).toFixed(4));
                saveWallet(w);
                saveTransaction({
                    id: Date.now() - 1000, userId: uid, type: 'BUY', karat: '24K',
                    grams: 1.5, price: 1.5 * getSettings().basePrice, date: new Date(Date.now() - 86400000).toISOString(),
                    note: 'Demo seed', status: TX_STATUS_APPROVED
                });
            }
        }
        return r;
    } catch (e) {
        console.error('[DEMO] create failed:', e);
        return { success: false, message: e.message };
    }
};
console.log('%c NEXGOLD DEMO CREDENTIALS', 'background:#000;color:#D4AF37;font-size:16px;font-weight:900;padding:12px 18px;border:2px solid #D4AF37;border-radius:8px;');
console.log('%c Email:    demo@nexgold.exchange\n Password: Demo@123\n Admin PW: admin123\n Run `await createDemoUser()` in console to seed.', 'font-family:monospace;font-size:13px;color:#D4AF37;');
