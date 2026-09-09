/* ========================================
   NEXGOLD EXCHANGE - FIREBASE TWO-WAY GLOBAL SYNC
   Ensures accounts/wallets/transactions/settings/payments created on ANY
   device are visible and accessible on EVERY other device by:
   1. Pulling EVERYTHING from Firestore into localStorage on page load & login
   2. Immediately writing wallet/txn/settings/payment-method changes back
      to Firestore so other devices can pull them.
   Load this script AFTER app.js and BEFORE page scripts (admin.js, dashboard.js, auth.js).
   ======================================== */
(function () {
    'use strict';

    const TX_STATUS_PENDING  = 'PENDING';
    const TX_STATUS_APPROVED = 'APPROVED';
    const TX_STATUS_REJECTED = 'REJECTED';

    function _get(key, def) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : def;
        } catch (_) { return def; }
    }
    function _set(key, val) {
        try {
            localStorage.setItem(key, JSON.stringify(val));
            if (window.Sync && typeof window.Sync.emit === 'function') {
                try {
                    if (key === 'users')          window.Sync.emit('users');
                    if (key === 'wallets')        window.Sync.emit('wallets');
                    if (key === 'transactions')   window.Sync.emit('transactions');
                    if (key === 'certificates')   window.Sync.emit('certificates');
                    if (key === 'settings')       window.Sync.emit('settings');
                    if (key === 'paymentMethods') window.Sync.emit('paymentMethods');
                } catch (_) {}
            }
            return true;
        } catch (e) { return false; }
    }

    async function pullAllFromFirestore(db) {
        if (!db) return false;
        try {
            console.debug('[GlobalSync] Pulling all collections from Firestore…');

            function guardedGet(label, collectionName) {
                return db.collection(collectionName).get().then(function (snap) {
                    console.debug('[GlobalSync] 🟢 ' + label + ' pulled: ' + (snap && snap.size != null ? snap.size : '?') + ' docs');
                    return snap;
                }).catch(function (err) {
                    const code = (err && err.code) || 'unknown';
                    const msg = (err && err.message) || String(err);
                    const FB = window.FB || {};
                    const isAuthed = !!(FB.auth && FB.auth.currentUser);
                    console.warn('[GlobalSync] 🔴 ' + label + ' FAILED — code=' + code + ' msg=' + msg +
                        ' | isAuthed=' + isAuthed + ' | authUid=' + (isAuthed && FB.auth.currentUser ? FB.auth.currentUser.uid : 'N/A'));
                    if (code === 'permission-denied' || code === 'permission-denied') {
                        console.warn('[GlobalSync] ⚠️  PERMISSION DENIED on /' + collectionName +
                            (isAuthed
                                ? ' — Admin auth UID=' + FB.auth.currentUser.uid + ' has NO matching /admins/<uid> Firestore doc! Login again to auto-create it.'
                                : ' — no user signed in (expected during login screen)'));
                    }
                    if (window.showToast && typeof window.showToast === 'function' && isAuthed) {
                        try {
                            if (code === 'permission-denied' || code === 'permission-denied') {
                                window.showToast('⚠️ Admin permissions not active. Logout & login once to fix, then click Sync.', 'warning', 8000);
                            } else {
                                window.showToast('Sync warning: /' + collectionName + ' (' + code + ')', 'warning');
                            }
                        } catch (_) {}
                    }
                    return { size: 0, docs: [] };
                });
            }

            const [usersSnap, walletsSnap, txnsSnap, certsSnap, adminsSnap] = await Promise.all([
                guardedGet('users', 'users'),
                guardedGet('wallets', 'wallets'),
                guardedGet('transactions', 'transactions'),
                guardedGet('certificates', 'certificates'),
                guardedGet('admins', 'admins')
            ]);
            let settingsVal = null, paymentsVal = null;
            try {
                const s = await db.collection('system').doc('settings').get();
                if (s && s.exists) settingsVal = (s.data() || {}).value;
            } catch (_) {}
            try {
                const p = await db.collection('system').doc('paymentMethods').get();
                if (p && p.exists) paymentsVal = (p.data() || {}).value;
            } catch (_) {}

            const localUsers   = _get('users', []);
            const localWallets = _get('wallets', []);
            const localTxns    = _get('transactions', []);
            const localCerts   = _get('certificates', []);
            const localAdmins  = _get('admins', []);

            const byEmail = new Map();
            const byId    = new Map();
            const byFbUid = new Map();
            localUsers.forEach(u => {
                const em = String(u.email || '').trim().toLowerCase();
                if (em) byEmail.set(em, u);
                byId.set(String(u.id), u);
                if (u.fbUid) byFbUid.set(String(u.fbUid), u);
            });
            const walletsByUid = new Map(localWallets.map(w => [String(w.userId), w]));
            const txnsById     = new Map(localTxns.map(t => [String(t.id), t]));
            const certsById    = new Map(localCerts.map(c => [String(c.id), c]));
            const adminsByEmail = new Map(localAdmins.map(a => [String(a.email || '').trim().toLowerCase(), a]));

            let usersDirty = false, walletsDirty = false, txnsDirty = false, certsDirty = false, adminsDirty = false;

            const userDocs = (usersSnap && usersSnap.docs) ? usersSnap.docs : [];
            userDocs.forEach(doc => {
                const fbUid = doc.id;
                const d = doc.data() || {};
                const email = String(d.email || '').trim().toLowerCase();
                let local = null;
                if (email) local = byEmail.get(email);
                if (!local && fbUid) local = byFbUid.get(fbUid);
                if (!local && d.localUserId) local = byId.get(String(d.localUserId));

                if (local) {
                    let dirty = false;
                    if (!local.fbUid && fbUid) { local.fbUid = fbUid; dirty = true; }
                    if (d.name    && (!local.name    || String(local.name).trim()    !== String(d.name).trim()))    { local.name    = String(d.name).trim();    dirty = true; }
                    if (d.country && (!local.country || String(local.country).trim() !== String(d.country).trim())) { local.country = String(d.country).trim(); dirty = true; }
                    if (d.address && (!local.address || String(local.address).trim() !== String(d.address).trim())) { local.address = String(d.address).trim(); dirty = true; }
                    if (d.password && (!local.password || local.password === '__firebase_only__' || local.password === '__fb_hydrated__')) {
                        local.password = String(d.password); dirty = true;
                    }
                    if (d.frozen === true && local.frozen !== true) { local.frozen = true; local.frozenAt = d.frozenAt || new Date().toISOString(); dirty = true; }
                    if (d.frozen === false && local.frozen === true) { delete local.frozen; delete local.frozenAt; dirty = true; }
                    if (dirty) usersDirty = true;
                } else {
                    const password = d.password || '__firebase_only__';
                    const newId = d.localUserId ? Number(d.localUserId) : (Date.now() + Math.floor(Math.random() * 9999999));
                    const nu = {
                        id: newId,
                        fbUid: fbUid,
                        name:    String(d.name    || (email ? email.split('@')[0] : 'User')).trim(),
                        email:   email,
                        password: password,
                        country: String(d.country || '').trim(),
                        address: String(d.address || '').trim(),
                        role:    d.role || 'user',
                        createdAt: d.createdAt || new Date().toISOString(),
                        frozen:  d.frozen === true,
                        frozenAt: d.frozen === true ? (d.frozenAt || new Date().toISOString()) : undefined,
                        _fromFirestore: true
                    };
                    localUsers.push(nu);
                    byEmail.set(email, nu);
                    byId.set(String(nu.id), nu);
                    if (fbUid) byFbUid.set(fbUid, nu);
                    usersDirty = true;
                }
            });

            const walletDocs = (walletsSnap && walletsSnap.docs) ? walletsSnap.docs : [];
            walletDocs.forEach(doc => {
                const fbUid = doc.id;
                const d = doc.data() || {};
                let user = (fbUid ? byFbUid.get(fbUid) : null) ||
                           (d.userId ? byId.get(String(d.userId)) : null);
                if (!user && d.email) {
                    const email = String(d.email || '').trim().toLowerCase();
                    user = byEmail.get(email);
                }
                if (!user && !d.userId) return;
                if (!user) return;
                const userId = user.id;
                let wallet = walletsByUid.get(String(userId));
                if (!wallet) {
                    wallet = { userId: userId, main: 0, vault: 0, bonus: 0 };
                    localWallets.push(wallet);
                    walletsByUid.set(String(userId), wallet);
                    walletsDirty = true;
                }
                const newM = parseFloat(d.main  || 0);
                const newV = parseFloat(d.vault || 0);
                const newB = parseFloat(d.bonus || 0);
                if (newM > parseFloat(wallet.main  || 0)) { wallet.main  = newM; walletsDirty = true; }
                if (newV > parseFloat(wallet.vault || 0)) { wallet.vault = newV; walletsDirty = true; }
                if (newB > parseFloat(wallet.bonus || 0)) { wallet.bonus = newB; walletsDirty = true; }
            });

            const byEmailNow = new Map();
            localUsers.forEach(u => { const em = String(u.email || '').trim().toLowerCase(); if (em) byEmailNow.set(em, u); });
            localUsers.forEach(u => {
                const userId = u.id;
                if (!walletsByUid.has(String(userId))) {
                    localWallets.push({ userId: userId, main: 0, vault: 0, bonus: 0 });
                    walletsByUid.set(String(userId), localWallets[localWallets.length - 1]);
                    walletsDirty = true;
                }
            });

            const txnDocs = (txnsSnap && txnsSnap.docs) ? txnsSnap.docs : [];
            txnDocs.forEach(doc => {
                const d = doc.data() || {};
                const rawId = String(d.id || doc.id);
                if (!rawId) return;
                let tx = txnsById.get(rawId);
                const existingNumeric = localTxns.find(t => String(t.id) === rawId);
                tx = tx || existingNumeric;
                if (!tx) {
                    let userId = d.userId;
                    if (!userId && d._userId) {
                        const u = byFbUid.get(String(d._userId));
                        if (u) userId = u.id;
                    }
                    if (!userId && d.userId) {
                        const u = byId.get(String(d.userId));
                        if (!u) return;
                        userId = u.id;
                    }
                    const numId = Number(rawId);
                    const newId = Number.isFinite(numId) && String(numId) === rawId.trim()
                        ? numId
                        : (Date.now() + Math.floor(Math.random() * 9999999));
                    tx = {
                        id: newId,
                        userId: userId,
                        type: d.type || 'BUY',
                        karat: d.karat || '24K',
                        unit: d.unit || 'Gram',
                        grams: parseFloat(d.grams || 0),
                        price: parseFloat(d.price || 0),
                        date: d.date || new Date().toISOString(),
                        status: d.status || TX_STATUS_APPROVED,
                        paymentMethod: d.paymentMethod || '',
                        paymentDetails: d.paymentDetails || '',
                        payoutMethod: d.payoutMethod || '',
                        payoutDetails: d.payoutDetails || '',
                        deliveryAddress: d.deliveryAddress || '',
                        note: d.note || '',
                        approvedAt: d.approvedAt || '',
                        rejectedAt: d.rejectedAt || '',
                        rejectionReason: d.rejectionReason || '',
                        approvedBy: d.approvedBy || '',
                        rejectedBy: d.rejectedBy || '',
                        _fromFirestore: true
                    };
                    localTxns.push(tx);
                    txnsById.set(String(tx.id), tx);
                    txnsDirty = true;
                } else {
                    let dirty = false;
                    if (d.status &&
                        (d.status === TX_STATUS_APPROVED || d.status === TX_STATUS_REJECTED) &&
                        tx.status !== d.status) {
                        tx.status = d.status;
                        if (d.status === TX_STATUS_APPROVED) tx.approvedAt = d.approvedAt || tx.approvedAt || new Date().toISOString();
                        if (d.status === TX_STATUS_REJECTED) tx.rejectedAt = d.rejectedAt || tx.rejectedAt || new Date().toISOString();
                        dirty = true;
                    }
                    if (dirty) txnsDirty = true;
                }
            });

            const certDocs = (certsSnap && certsSnap.docs) ? certsSnap.docs : [];
            certDocs.forEach(doc => {
                const d = doc.data() || {};
                const id = String(d.id || doc.id);
                if (!id || certsById.has(id)) return;
                localCerts.push(d);
                certsById.set(id, d);
                certsDirty = true;
            });

            const adminDocs = (adminsSnap && adminsSnap.docs) ? adminsSnap.docs : [];
            adminDocs.forEach(doc => {
                const d = doc.data() || {};
                const email = String(d.email || '').trim().toLowerCase();
                if (!email) return;
                if (!adminsByEmail.has(email)) {
                    localAdmins.push({
                        id: doc.id,
                        email: email,
                        password: String(d.password || ''),
                        name: String(d.name || email.split('@')[0]),
                        role: String(d.role || 'admin'),
                        active: d.active !== false
                    });
                    adminsByEmail.set(email, localAdmins[localAdmins.length - 1]);
                    adminsDirty = true;
                } else {
                    const existing = adminsByEmail.get(email);
                    let dirty = false;
                    if (d.name && existing.name !== String(d.name).trim()) { existing.name = String(d.name).trim(); dirty = true; }
                    if (d.password && existing.password !== String(d.password)) { existing.password = String(d.password); dirty = true; }
                    if (d.role && existing.role !== String(d.role)) { existing.role = String(d.role); dirty = true; }
                    if (d.active === false && existing.active !== false) { existing.active = false; dirty = true; }
                    if (dirty) adminsDirty = true;
                }
            });

            if (usersDirty)   _set('users', localUsers);
            if (adminsDirty)  _set('admins', localAdmins);
            if (walletsDirty) _set('wallets', localWallets);
            if (txnsDirty) {
                localTxns.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
                _set('transactions', localTxns);
            }
            if (certsDirty) _set('certificates', localCerts);

            if (settingsVal) {
                const cur = _get('settings', null);
                const newS = {
                    basePrice: parseFloat(settingsVal.basePrice || 65),
                    weeklyPercent: parseFloat(settingsVal.weeklyPercent || 2),
                    monthlyPercent: parseFloat(settingsVal.monthlyPercent || 8),
                    yearlyPercent: parseFloat(settingsVal.yearlyPercent || 100),
                    bonusTransferLimit: parseFloat(settingsVal.bonusTransferLimit || 100)
                };
                if (!cur ||
                    newS.basePrice !== parseFloat(cur.basePrice || 0) ||
                    newS.monthlyPercent !== parseFloat(cur.monthlyPercent || 0)) {
                    _set('settings', newS);
                }
            }
            if (paymentsVal) _set('paymentMethods', paymentsVal);

            console.debug('[GlobalSync] Pulled from Firestore:',
                (usersSnap.size||0), 'users,',
                (adminsSnap.size||0), 'admins,',
                (walletsSnap.size||0), 'wallets,',
                (txnsSnap.size||0), 'txns,',
                (certsSnap.size||0), 'certs');

            if (window.dispatchEvent) {
                try { window.dispatchEvent(new CustomEvent('nexgold-sync-pulled', { detail: { users: localUsers.length, wallets: localWallets.length } })); } catch (_) {}
            }
            if (typeof window.renderStats === 'function') try { window.renderStats(); } catch (_) {}
            if (typeof window.renderUsersTable === 'function') try { window.renderUsersTable(); } catch (_) {}
            if (typeof window.renderPendingApprovals === 'function') try { window.renderPendingApprovals(); } catch (_) {}
            if (typeof window.renderTransactionsTable === 'function') try { window.renderTransactionsTable(); } catch (_) {}
            return true;
        } catch (e) {
            console.warn('[GlobalSync] pullAllFromFirestore failed:', e.message || e);
            return false;
        }
    }

    async function writeWalletByLocalUserId(db, auth, userIdOrEmail, wallet) {
        if (!db || !wallet) return;
        try {
            const users = _get('users', []);
            const tgt = String(userIdOrEmail || '').trim().toLowerCase();
            let user = users.find(u => String(u.id) === String(userIdOrEmail)) ||
                       users.find(u => String(u.email || '').trim().toLowerCase() === tgt) ||
                       users.find(u => String(u.fbUid || '') === String(userIdOrEmail));
            let fbUid = user ? user.fbUid : null;
            if (!fbUid && auth && auth.currentUser && user &&
                String(user.email || '').trim().toLowerCase() === String(auth.currentUser.email || '').trim().toLowerCase()) {
                fbUid = auth.currentUser.uid;
            }
            if (!fbUid && wallet.fbUid) fbUid = wallet.fbUid;
            if (!fbUid) return;
            await db.collection('wallets').doc(String(fbUid)).set({
                userId: (user && user.id) || wallet.userId || userIdOrEmail,
                main:  parseFloat(wallet.main  || 0),
                vault: parseFloat(wallet.vault || 0),
                bonus: parseFloat(wallet.bonus || 0),
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            console.debug('[GlobalSync] wallet push skipped:', e.code || e.message);
        }
    }

    async function writeTxnById(db, txId) {
        if (!db || !txId) return;
        try {
            const txs = _get('transactions', []);
            const tx = txs.find(t => String(t.id) === String(txId));
            if (!tx) return;
            await db.collection('transactions').doc(String(txId)).set({
                ...tx,
                _syncedAt: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            console.debug('[GlobalSync] tx push skipped:', e.code || e.message);
        }
    }

    function install(FB) {
        if (!FB || !FB.enabled || !FB.db) return;
        const { auth, db, analytics } = FB;

        if (!window.__nexgoldGlobalSyncInstalled) {
            let authResolved = false;
            let authUser = null;

            function doPullWithLogging() {
                console.debug('[GlobalSync] Pulling... FB.auth.currentUser=',
                    auth && auth.currentUser ? auth.currentUser.uid + ' (' + (auth.currentUser.email || '') + ')' : 'NULL');
                return pullAllFromFirestore(db);
            }

            function scheduleInitialPulls() {
                doPullWithLogging().catch(() => {});
                setTimeout(() => doPullWithLogging().catch(() => {}), 5000);
                setTimeout(() => doPullWithLogging().catch(() => {}), 15000);
                setTimeout(() => doPullWithLogging().catch(() => {}), 30000);
            }

            let pulledAlready = false;
            function pullIfReadyAndNeeded() {
                if (pulledAlready) return;
                if (authUser || authResolved) {
                    pulledAlready = true;
                    scheduleInitialPulls();
                }
            }

            if (auth && typeof auth.onAuthStateChanged === 'function') {
                let authTimer = setTimeout(function () {
                    authResolved = true;
                    console.warn('[GlobalSync] onAuthStateChanged timed out after 8s — proceeding with/without auth.');
                    pullIfReadyAndNeeded();
                }, 8000);
                auth.onAuthStateChanged(function (u) {
                    authResolved = true;
                    authUser = u || null;
                    clearTimeout(authTimer);
                    if (u) {
                        console.debug('[GlobalSync] ✅ Auth ready — user signed in:', u.uid, u.email || '(no email)');
                    } else {
                        console.debug('[GlobalSync] Auth ready — no user signed in (pull will proceed unauthenticated)');
                    }
                    pullIfReadyAndNeeded();
                });
            } else {
                authResolved = true;
                pullIfReadyAndNeeded();
            }

            setInterval(() => doPullWithLogging().catch(() => {}), 60000);
        }
        window.__nexgoldGlobalSyncInstalled = true;

        const origLogin = window.Auth && window.Auth.login ? window.Auth.login.bind(window.Auth) : null;
        if (origLogin) {
            window.Auth.login = async function (email, password) {
                await pullAllFromFirestore(db).catch(() => {});
                const r = await origLogin(email, password);
                if (r && r.success) setTimeout(() => pullAllFromFirestore(db).catch(() => {}), 500);
                return r;
            };
        }

        const origRegister = window.Auth && window.Auth.register ? window.Auth.register.bind(window.Auth) : null;
        if (origRegister) {
            window.Auth.register = async function (name, email, password, country, address) {
                const r = await origRegister(name, email, password, country, address);
                if (r && r.success && r.user && db) {
                    try {
                        const users = _get('users', []);
                        const idx = users.findIndex(u => String(u.id) === String(r.user.id));
                        let fbUid = null;
                        if (idx >= 0 && users[idx].fbUid) fbUid = users[idx].fbUid;
                        if (!fbUid && auth && auth.currentUser) fbUid = auth.currentUser.uid;
                        if (fbUid) {
                            await db.collection('users').doc(String(fbUid)).set({
                                name: r.user.name, email: r.user.email, country: r.user.country,
                                address: r.user.address, localUserId: r.user.id, role: r.user.role || 'user',
                                password: r.user.password, createdAt: r.user.createdAt || new Date().toISOString()
                            }, { merge: true });
                            await db.collection('wallets').doc(String(fbUid)).set({
                                userId: r.user.id, main: 0, vault: 0, bonus: 0,
                                updatedAt: new Date().toISOString()
                            }, { merge: true });
                            if (idx >= 0) { users[idx].fbUid = fbUid; _set('users', users); }
                        }
                    } catch (e) { console.debug('[GlobalSync] register sync:', e.code || e.message); }
                }
                return r;
            };
        }

        const origSaveWallet = window.saveWallet;
        if (typeof origSaveWallet === 'function') {
            window.saveWallet = function (wallet) {
                origSaveWallet(wallet);
                writeWalletByLocalUserId(db, auth, wallet.userId, wallet);
            };
        }

        const origSaveTxn = window.saveTransaction;
        if (typeof origSaveTxn === 'function') {
            window.saveTransaction = function (tx) {
                origSaveTxn(tx);
                if (db) {
                    db.collection('transactions').doc(String(tx.id)).set({
                        ...tx, _syncedAt: new Date().toISOString()
                    }, { merge: true }).catch(() => {});
                    if (analytics) {
                        try { analytics.logEvent('transaction', { type: tx.type, value: tx.price, grams: tx.grams }); } catch (_) {}
                    }
                }
            };
        }

        const origSaveStorage = window.saveToStorage;
        if (typeof origSaveStorage === 'function') {
            window.saveToStorage = function (key, value) {
                origSaveStorage(key, value);
                if (!db) return;
                if (key === 'certificates' && Array.isArray(value) && value.length > 0) {
                    const latest = value[0];
                    if (latest && latest.id) {
                        db.collection('certificates').doc(String(latest.id)).set({ ...latest, _syncedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
                    }
                }
                if (key === 'settings') {
                    db.collection('system').doc('settings').set({ value, updatedAt: new Date().toISOString() }).catch(() => {});
                }
                if (key === 'paymentMethods') {
                    db.collection('system').doc('paymentMethods').set({ value, updatedAt: new Date().toISOString() }).catch(() => {});
                }
                if (key === 'users' && Array.isArray(value)) {
                    value.forEach(function (u) {
                        if (u && u.fbUid) {
                            try {
                                db.collection('users').doc(String(u.fbUid)).set({
                                    name: u.name, email: u.email, country: u.country,
                                    address: u.address, localUserId: u.id,
                                    role: u.role || 'user', password: u.password,
                                    frozen: u.frozen === true,
                                    frozenAt: u.frozen === true ? (u.frozenAt || new Date().toISOString()) : null,
                                    _syncedAt: new Date().toISOString()
                                }, { merge: true }).catch(function () {});
                            } catch (_) {}
                        }
                    });
                }
            };
        }

        if (window.Admin) {
            const origCredit = window.Admin.creditWallet ? window.Admin.creditWallet.bind(window.Admin) : null;
            if (origCredit) {
                window.Admin.creditWallet = async function (userId, walletType, grams) {
                    const r = origCredit(userId, walletType, grams);
                    if (r && r.success) {
                        const wallet = (typeof window.getUserWallet === 'function') ? window.getUserWallet(userId) : null;
                        if (wallet) await writeWalletByLocalUserId(db, auth, userId, wallet);
                    }
                    if (analytics) { try { analytics.logEvent('admin_credit', { userId, walletType, grams }); } catch (_) {} }
                    return r;
                };
            }

            const origDebit = window.Admin.debitWallet ? window.Admin.debitWallet.bind(window.Admin) : null;
            if (origDebit) {
                window.Admin.debitWallet = async function (userId, walletType, grams) {
                    const r = origDebit(userId, walletType, grams);
                    if (r && r.success) {
                        const wallet = (typeof window.getUserWallet === 'function') ? window.getUserWallet(userId) : null;
                        if (wallet) await writeWalletByLocalUserId(db, auth, userId, wallet);
                    }
                    return r;
                };
            }

            const origApprove = window.Admin.approveTransaction ? window.Admin.approveTransaction.bind(window.Admin) : null;
            if (origApprove) {
                window.Admin.approveTransaction = async function (txId) {
                    const r = origApprove(txId);
                    if (r && r.success) {
                        await writeTxnById(db, txId);
                        if (r.transaction && r.transaction.userId && typeof window.getUserWallet === 'function') {
                            const w = window.getUserWallet(r.transaction.userId);
                            if (w) await writeWalletByLocalUserId(db, auth, r.transaction.userId, w);
                        }
                    }
                    return r;
                };
            }

            const origReject = window.Admin.rejectTransaction ? window.Admin.rejectTransaction.bind(window.Admin) : null;
            if (origReject) {
                window.Admin.rejectTransaction = async function (txId, reason) {
                    const r = origReject(txId, reason);
                    if (r && r.success) await writeTxnById(db, txId);
                    return r;
                };
            }

            const origUpdateSettings = window.Admin.updateSettings ? window.Admin.updateSettings.bind(window.Admin) : null;
            if (origUpdateSettings) {
                window.Admin.updateSettings = function (newSettings) {
                    const r = origUpdateSettings(newSettings);
                    if (r && r.success && db) {
                        db.collection('system').doc('settings').set({ value: r.settings, updatedAt: new Date().toISOString() }).catch(() => {});
                    }
                    return r;
                };
            }

            const origSavePM = window.Admin.savePaymentMethods ? window.Admin.savePaymentMethods.bind(window.Admin) : null;
            if (origSavePM) {
                window.Admin.savePaymentMethods = function (methods) {
                    const r = origSavePM(methods);
                    if (r && r.success && db) {
                        db.collection('system').doc('paymentMethods').set({ value: methods, updatedAt: new Date().toISOString() }).catch(() => {});
                    }
                    return r;
                };
            }
        }

        console.info('[GlobalSync] INSTALLED — two-way Firestore sync active.');
    }

    if (window.FB && window.FB.enabled) {
        install(window.FB);
    } else {
        window.addEventListener('firebase-ready', function once() {
            install(window.FB);
        }, { once: true });
    }

    window.NexgoldGlobalSync = {
        pullAllFromFirestore: (dbOverride) => pullAllFromFirestore(dbOverride || (window.FB && window.FB.db)),
        forceSync: () => {
            const db = window.FB && window.FB.db;
            if (db) {
                pullAllFromFirestore(db).catch(() => {});
                setTimeout(() => pullAllFromFirestore(db).catch(() => {}), 2000);
                return true;
            }
            return false;
        }
    };
})();
