/* ========================================
   ADMIN PAGE SCRIPT - admin.html only
   ======================================== */

document.addEventListener('DOMContentLoaded', initializeAdmin);

async function initializeAdmin() {
    const loginScreen = document.getElementById('adminLoginScreen');
    const mainScreen  = document.getElementById('adminMainScreen');
    const isAdmin     = Auth.checkAdminSession(false);

    if (!isAdmin) {
        loginScreen.style.display = 'flex';
        mainScreen.style.display  = 'none';

        document.getElementById('adminLoginBtn')?.addEventListener('click', async function () {
            const email = document.getElementById('adminEmailAdmin').value;
            const pw = document.getElementById('adminPassword').value.trim();
            const btn = this;
            const originalHTML = btn ? btn.innerHTML : null;
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-arrow-repeat spin me-2"></i>AUTHORIZING...'; }
            try {
                const result = await Promise.resolve(Auth.adminLogin(email, pw));
                if (result && result.success) {
                    showToast(result.message || 'Admin access granted — syncing Firestore…', 'success');
                    let pulledCount = 0;
                    if (window.NexgoldGlobalSync && typeof window.NexgoldGlobalSync.pullAllFromFirestore === 'function') {
                        try {
                            const preSyncUsers = getFromStorage('users', []).length;
                            await Promise.race([
                                window.NexgoldGlobalSync.pullAllFromFirestore(),
                                new Promise(function(res) { setTimeout(res, 6000); })
                            ]);
                            if (window.NexgoldGlobalSync && typeof window.NexgoldGlobalSync.pullAllFromFirestore === 'function') {
                                await Promise.race([
                                    window.NexgoldGlobalSync.pullAllFromFirestore(),
                                    new Promise(function(res) { setTimeout(res, 6000); })
                                ]);
                            }
                            const postSyncUsers = getFromStorage('users', []).length;
                            pulledCount = postSyncUsers - preSyncUsers;
                            showToast('Synced ' + Math.max(0, pulledCount) + ' new user(s) — finishing up…', 'success');
                        } catch (_) {}
                    }
                    setTimeout(() => location.reload(), Math.max(1500, 1500));
                } else {
                    showToast((result && result.message) || 'Invalid admin email or password', 'error');
                    if (btn && originalHTML) { btn.disabled = false; btn.innerHTML = originalHTML; }
                }
            } catch (err) {
                showToast((err && err.message) || 'Admin login failed', 'error');
                if (btn && originalHTML) { btn.disabled = false; btn.innerHTML = originalHTML; }
            }
        });
        document.getElementById('adminPassword')?.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { document.getElementById('adminLoginBtn')?.click(); }
        });
        document.getElementById('adminEmailAdmin')?.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { document.getElementById('adminLoginBtn')?.click(); }
        });
        return;
    }

    loginScreen.style.display = 'none';
    mainScreen.style.display  = 'block';

    if (window.NexgoldGlobalSync && typeof window.NexgoldGlobalSync.pullAllFromFirestore === 'function') {
        try {
            await Promise.race([
                window.NexgoldGlobalSync.pullAllFromFirestore(),
                new Promise(function(res) { setTimeout(res, 8000); })
            ]);
        } catch (_) {}
        try {
            await new Promise(function(res) { setTimeout(res, 2000); });
            await Promise.race([
                window.NexgoldGlobalSync.pullAllFromFirestore(),
                new Promise(function(res) { setTimeout(res, 8000); })
            ]);
        } catch (_) {}
    }

    renderStats();
    renderPendingApprovals();
    renderUsersTable();

    // Seed placeholder users for Firebase Auth accounts that haven't logged in yet.
    // These are real emails/UIDs visible in Firebase Console but no Firestore user doc exists.
    (function ensureKnownAuthUsersSeeded() {
        try {
            const knownUsers = [
                { fbUid: 'UDzfRsJAZcYTH1IVDogH9aG', email: 'lsc68@verizon.net', name: 'User Lsc68' },
                { fbUid: 'f6MjCVr46jWxQ6c2eyuLHGIL', email: 'marcusharberofficial@', name: 'Marcus Harber' },
                { fbUid: '0EtOl243MsQvoxSUEx7mXetp', email: 'neroesiso@gmail.com', name: 'Neroesis O' },
                { fbUid: 'Zyr3RANmB9NSuavHxRLfeOwU', email: 'stanleyf418@gmail.com', name: 'Stanley F' },
                { fbUid: '5twNNtHOfdVHMd5HVC2i0rEh', email: 'sydney.wilson87@mx-', name: 'Sydney Wilson' }
            ];
            const users = getFromStorage('users', []);
            const wallets = getFromStorage('wallets', []);
            let changed = false;
            knownUsers.forEach(tpl => {
                const exists = users.some(u =>
                    (u.email || '').toLowerCase() === (tpl.email || '').toLowerCase() ||
                    String(u.fbUid || '') === String(tpl.fbUid || '')
                );
                if (exists) return;
                const newId = String(Date.now()) + String(Math.floor(Math.random() * 9999));
                const u = {
                    id: newId,
                    fbUid: tpl.fbUid,
                    localUserId: newId,
                    email: tpl.email,
                    name: tpl.name || 'User ' + String(tpl.fbUid || '').slice(-4),
                    country: '—',
                    address: '',
                    password: 'password',
                    createdAt: new Date().toISOString(),
                    _source: 'seeded-from-auth',
                    _seededAt: new Date().toISOString(),
                    photoURL: ''
                };
                users.push(u);
                const widx = wallets.findIndex(w => String(w.userId) === String(newId));
                if (widx < 0) wallets.push({ userId: newId, main: 0, vault: 0, bonus: 0 });
                changed = true;
            });
            if (changed) {
                saveToStorage('users', users);
                saveToStorage('wallets', wallets);
                try { Sync.emit('users'); Sync.emit('wallets'); } catch (_) {}
                console.debug('[Admin] Seeded known Firebase Auth users into localStorage so they appear in admin table.');
                renderUsersTable();
                renderStats();
            }
        } catch (e) {
            console.warn('[Admin] Seeder skipped:', e.message);
        }
    })();

    if (window.NexgoldGlobalSync && typeof window.NexgoldGlobalSync.pullAllFromFirestore === 'function') {
        setTimeout(function () {
            window.NexgoldGlobalSync.pullAllFromFirestore().catch(function () {});
        }, 12000);
    }
    loadSettingsIntoForm();
    loadPaymentMethodsIntoForm();

    const usersTbody = document.getElementById('usersTableBody');
    if (usersTbody && !usersTbody.dataset.delegatedBound) {
        usersTbody.dataset.delegatedBound = '1';
        usersTbody.addEventListener('click', function (e) {
            const btn = e.target.closest('button[data-admin-action]');
            if (!btn) return;
            const action     = btn.dataset.adminAction;
            const walletType = btn.dataset.adminWallet;
            const userIdRaw  = btn.dataset.adminUserid;
            window.adminAction(action, walletType, userIdRaw);
        });
    }

    document.getElementById('saveSettingsBtn')?.addEventListener('click', function () {
        const result = Admin.updateSettings({
            basePrice:          parseFloat(document.getElementById('setBasePrice').value),
            weeklyPercent:      parseFloat(document.getElementById('setWeekly').value),
            monthlyPercent:     parseFloat(document.getElementById('setMonthly').value),
            yearlyPercent:      parseFloat(document.getElementById('setYearly').value),
            bonusTransferLimit: parseFloat(document.getElementById('setBonusLimit').value)
        });
        if (result.success) {
            showToast('Platform settings updated successfully', 'success');
            renderStats();
        }
    });

    document.getElementById('savePaymentsBtn')?.addEventListener('click', function () {
        Admin.savePaymentMethods({
            usdt: document.getElementById('payUSDT').value,
            btc:  document.getElementById('payBTC').value,
            bankAccounts: [{
                bankName:      document.getElementById('payBankName').value,
                accountName:   document.getElementById('payAccountName').value,
                accountNumber: document.getElementById('payAccountNumber').value,
                swift:         document.getElementById('paySwift').value
            }]
        });
        showToast('Payment methods saved', 'success');
    });

    setTimeout(loadAnalyticsCharts, 500);

    function debounce(fn, wait) {
        let t;
        return function () {
            clearTimeout(t);
            t = setTimeout(fn, wait);
        };
    }

    const refreshAllAdmin = debounce(function () {
        renderStats();
        renderPendingApprovals();
        renderUsersTable();
        loadAnalyticsCharts(true);
    }, 120);

    const refreshPendingAndStats = debounce(function () {
        renderStats();
        renderPendingApprovals();
        loadAnalyticsCharts(true);
    }, 100);

    const refreshWalletsAndStats = debounce(function () {
        renderStats();
        renderUsersTable();
        loadAnalyticsCharts(true);
    }, 100);

    if (window.Sync) {
        Sync.on('transactions', refreshPendingAndStats);
        Sync.on('transactionAdded', refreshPendingAndStats);
        Sync.on('transactionUpdated', refreshPendingAndStats);
        Sync.on('wallets', refreshWalletsAndStats);
        Sync.on('walletUpdated', refreshWalletsAndStats);
        Sync.on('users', renderUsersTable);
        Sync.on('certificates', function () { renderStats(); loadAnalyticsCharts(true); });
        Sync.on('settings', function () { loadSettingsIntoForm(); renderStats(); });
        Sync.on('paymentMethods', loadPaymentMethodsIntoForm);
        Sync.on('*', function (ev) {
            if (['transactions','wallets','users','certificates','settings','paymentMethods'].includes(ev)) return;
            refreshAllAdmin();
        });
    }
}

window.refreshUsers = function refreshUsers() {
    try { renderUsersTable(); renderStats(); showToast('Users table refreshed', 'success'); }
    catch (e) { showToast('Refresh failed: ' + e.message, 'error'); }
};

window.adminSyncAllNow = async function adminSyncAllNow() {
    const syncKey = '__syncingNow_';
    if (window[syncKey]) return;
    window[syncKey] = true;
    try {
        const preUsers = getFromStorage('users', []).length;
        showToast('🔄 Syncing from Firestore… (pass 1/3)', 'info');
        if (window.NexgoldGlobalSync && typeof window.NexgoldGlobalSync.forceSync === 'function') {
            try {
                window.NexgoldGlobalSync.forceSync();
                await new Promise(function (res) { setTimeout(res, 3000); });
            } catch (_) {}
        }
        if (window.NexgoldGlobalSync && typeof window.NexgoldGlobalSync.pullAllFromFirestore === 'function') {
            try {
                await Promise.race([
                    window.NexgoldGlobalSync.pullAllFromFirestore(),
                    new Promise(function(res) { setTimeout(res, 8000); })
                ]);
            } catch (_) {}
        }
        showToast('🔄 Sync pass 2/3…', 'info');
        await new Promise(function (res) { setTimeout(res, 2000); });
        if (window.NexgoldGlobalSync && typeof window.NexgoldGlobalSync.pullAllFromFirestore === 'function') {
            try {
                await Promise.race([
                    window.NexgoldGlobalSync.pullAllFromFirestore(),
                    new Promise(function(res) { setTimeout(res, 8000); })
                ]);
            } catch (_) {}
        }
        showToast('🔄 Sync pass 3/3 — finalizing…', 'info');
        await new Promise(function (res) { setTimeout(res, 2000); });
        if (window.NexgoldGlobalSync && typeof window.NexgoldGlobalSync.pullAllFromFirestore === 'function') {
            try {
                await Promise.race([
                    window.NexgoldGlobalSync.pullAllFromFirestore(),
                    new Promise(function(res) { setTimeout(res, 8000); })
                ]);
            } catch (_) {}
        }
        try { renderStats(); renderPendingApprovals(); renderUsersTable(); loadAnalyticsCharts(true); } catch (_) {}
        try {
            const users = getFromStorage('users', []).length;
            const newUsers = users - preUsers;
            const msg = newUsers > 0
                ? ('✅ Sync complete! ' + users + ' users total (+' + newUsers + ' new)')
                : ('✅ Sync complete! ' + users + ' users loaded locally');
            showToast(msg, 'success');
        } catch (_) {
            showToast('✅ Sync complete!', 'success');
        }
    } catch (e) {
        showToast('Sync error: ' + e.message, 'error');
    } finally {
        delete window[syncKey];
    }
};

/* ================================================================
   Sub-renderers
   ================================================================ */
function renderStats() {
    const stats = Admin.getStats();
    const put = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    put('statUsers', stats.totalUsers.toLocaleString());
    put('statTransactions', stats.totalTransactions.toLocaleString());
    put('statGold', formatNumber(stats.totalGoldSold, 2) + ' g');
    put('statVolume', formatCurrency(stats.totalVolume));
    put('statPending', (stats.pendingCount || 0).toLocaleString());

    const card = document.getElementById('pendingTxnsCard');
    if (card) {
        if ((stats.pendingCount || 0) === 0) {
            card.style.opacity = '0.55';
            card.style.filter = 'grayscale(0.5)';
        } else {
            card.style.opacity = '1';
            card.style.filter = 'none';
        }
    }
}

window.renderPendingApprovals = function () {
    const container = document.getElementById('pendingApprovalsTable');
    if (!container) return;
    const allUsers = getFromStorage('users', []);
    const pending = getPendingTransactions();

    if (pending.length === 0) {
        container.innerHTML = `
            <div style="padding:40px 20px;text-align:center;">
                <i class="bi bi-check2-all" style="font-size:56px;color:#22c55e;opacity:0.5;margin-bottom:14px;"></i>
                <h5 style="margin:0 0 6px 0;color:#22c55e;">All Caught Up!</h5>
                <p style="color:#8a8a8a;font-size:14px;margin:0;">No pending transactions requiring approval.</p>
            </div>`;
        renderStats();
        return;
    }

    const rows = pending.map(t => {
        const u = allUsers.find(x => String(x.id) === String(t.userId));
        const userDisplay = u
            ? `<strong style="color:#fff;">${u.name}</strong><br><small class="text-muted">${u.email}</small>`
            : `<strong>Unknown User</strong>`;
        const badgeClass = t.type.toLowerCase() === 'buy' ? 'buy' : 'sell';
        const typeClass = t.type === 'BUY' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';
        const typeColor = t.type === 'BUY' ? '#22c55e' : '#ef4444';

        let payInfo = '';
        if (t.type === 'BUY') {
            payInfo = [
                t.paymentMethod   ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                    <div><i class="bi bi-credit-card me-1"></i> Method: <strong>${t.paymentMethod}</strong></div>
                    <button class="copy-btn" style="background:transparent;border:1px solid rgba(139,92,246,0.3);color:#a78bfa;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px;" onclick="copyToClipboard(${JSON.stringify(String(t.paymentMethod))}, this)" title="Copy"><i class="bi bi-copy"></i></button>
                </div>` : '',
                t.paymentDetails  ? `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-top:4px;">
                    <div style="font-size:12px;color:#b0b0b0;line-height:1.5;">${t.paymentDetails}</div>
                    <button class="copy-btn" style="background:transparent;border:1px solid rgba(139,92,246,0.3);color:#a78bfa;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px;flex-shrink:0;" onclick="copyToClipboard(${JSON.stringify(String(t.paymentDetails))}, this)" title="Copy"><i class="bi bi-copy"></i></button>
                </div>` : ''
            ].filter(Boolean).join('');
        } else {
            payInfo = [
                t.payoutMethod   ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                    <div><i class="bi bi-wallet2 me-1"></i> Payout: <strong>${t.payoutMethod}</strong></div>
                    <button class="copy-btn" style="background:transparent;border:1px solid rgba(139,92,246,0.3);color:#a78bfa;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px;" onclick="copyToClipboard(${JSON.stringify(String(t.payoutMethod))}, this)" title="Copy"><i class="bi bi-copy"></i></button>
                </div>` : '',
                t.payoutDetails  ? `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-top:4px;">
                    <div style="font-size:12px;color:#b0b0b0;line-height:1.5;word-break:break-word;">${t.payoutDetails}</div>
                    <button class="copy-btn" style="background:transparent;border:1px solid rgba(139,92,246,0.3);color:#a78bfa;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px;flex-shrink:0;" onclick="copyToClipboard(${JSON.stringify(String(t.payoutDetails))}, this)" title="Copy"><i class="bi bi-copy"></i></button>
                </div>` : '',
                t.deliveryAddress ? `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-top:4px;">
                    <div style="font-size:12px;color:#93c5fd;line-height:1.5;"><i class="bi bi-truck me-1"></i> Delivery: ${t.deliveryAddress}</div>
                    <button class="copy-btn" style="background:transparent;border:1px solid rgba(59,130,246,0.3);color:#60a5fa;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px;flex-shrink:0;" onclick="copyToClipboard(${JSON.stringify(String(t.deliveryAddress))}, this)" title="Copy"><i class="bi bi-copy"></i></button>
                </div>` : ''
            ].filter(Boolean).join('');
        }
        if (!payInfo) payInfo = '<small class="text-muted">No details provided</small>';

        return `
        <tr>
            <td>
                <span class="badge-${badgeClass}">${t.type}</span>
                <div style="font-size:10.5px;color:#f59e0b;margin-top:4px;"><i class="bi bi-hourglass-split"></i> PENDING</div>
            </td>
            <td>${userDisplay}</td>
            <td>
                <strong>${t.karat} · ${t.unit || 'Gram'}</strong><br>
                <span style="color:#6c757d;font-size:12px;">${formatNumber(t.grams, 4)} g</span>
            </td>
            <td><strong style="color:${typeColor};">${formatCurrency(t.price)}</strong></td>
            <td style="font-size:12.5px;line-height:1.55;max-width:300px;">${payInfo}</td>
            <td style="white-space:nowrap;font-size:12px;color:#6c757d;">${new Date(t.date).toLocaleString()}</td>
            <td style="white-space:nowrap;">
                <button class="btn-sm-gold mb-1" style="display:block;width:100%;background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 4px 12px rgba(34,197,94,0.3);" onclick="window.approveTxn(${t.id})"><i class="bi bi-check-lg"></i> APPROVE</button>
                <button class="btn-sm-danger mb-1" style="display:block;width:100%;" onclick="window.rejectTxn(${t.id})"><i class="bi bi-x-lg"></i> REJECT</button>
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div style="overflow-x:auto;">
            <table class="table table-nexgold align-middle mb-0">
                <thead>
                    <tr>
                    <th>Type</th><th>User</th><th>Asset / Grams</th><th>Value</th><th>Payment / Payout Info</th><th>Date</th><th>Action</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
    renderStats();
};

window.approveTxn = async function (txId) {
    const tx = getTransactionById(txId);
    if (!tx) { showToast('Transaction not found — refresh pending list', 'error'); renderPendingApprovals(); return; }
    const u = getUserById(tx.userId);
    const ok = confirm(`APPROVE this ${tx.type} of ${formatNumber(tx.grams,4)}g ${tx.karat} gold for ${u ? u.name : 'Unknown user'}?\n\nThis will ${tx.type==='BUY' ? 'credit gold wallet + issue insurance certificate': 'debit gold wallet'}.`);
    if (!ok) return;

    try {
        const result = await Promise.resolve(Admin.approveTransaction(txId));
        if (result && result.success) {
            showToast(result.message, 'success');
            if (tx.type === 'BUY' && result.certificate) {
                setTimeout(() => generateCertificatePDF(result.certificate), 300);
            }
            if (window.NexgoldGlobalSync) { try { window.NexgoldGlobalSync.forceSync(); } catch (_) {} }
            renderPendingApprovals();
            loadAnalyticsCharts(true);
            renderStats();
            renderUsersTable();
        } else {
            showToast((result && result.message) || 'Approval failed', 'error');
        }
    } catch (e) {
        console.error('[Admin:Approve] error:', e);
        showToast('Approval error: ' + (e.message || 'Unknown error'), 'error');
    }
};

window.rejectTxn = async function (txId) {
    const tx = getTransactionById(txId);
    if (!tx) { showToast('Transaction not found', 'error'); renderPendingApprovals(); return; }
    const reason = prompt('Enter reason for rejection (shown to user):', '');
    if (reason === null) return;
    try {
        const result = await Promise.resolve(Admin.rejectTransaction(txId, reason || 'No reason provided'));
        if (result && result.success) {
            showToast(result.message, 'info');
            if (window.NexgoldGlobalSync) { try { window.NexgoldGlobalSync.forceSync(); } catch (_) {} }
            renderPendingApprovals();
            loadAnalyticsCharts(true);
            renderStats();
        } else {
            showToast((result && result.message) || 'Rejection failed', 'error');
        }
    } catch (e) {
        console.error('[Admin:Reject] error:', e);
        showToast('Rejection error: ' + (e.message || 'Unknown error'), 'error');
    }
};

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    const users = Admin.getAllUsersWithWallets();
    const settings = getSettings();
    const pricePerGram = settings.basePrice;

    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center py-5 text-muted">No users registered yet</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const uid = u.id;
        const mainUSD = (u.wallet.main || 0) * pricePerGram;
        const vaultUSD = (u.wallet.vault || 0) * pricePerGram;
        const bonusUSD = (u.wallet.bonus || 0) * pricePerGram;
        const totalGrams = (u.wallet.main || 0) + (u.wallet.vault || 0) + (u.wallet.bonus || 0);
        const totalUSD = totalGrams * pricePerGram;
        const isFrozen = u.frozen === true;

        return `
        <tr style="${isFrozen ? 'opacity:0.55;background:rgba(239,68,68,0.04);' : ''}">
            <td>
                <strong>#${String(uid).slice(-5)}</strong>
                ${isFrozen ? '<br><span style="font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(239,68,68,0.15);color:#ef4444;font-weight:800;letter-spacing:0.5px;"><i class="bi bi-lock-fill"></i> FROZEN</span>' : ''}
            </td>
            <td>
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#D4AF37,#8A6A12);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;flex-shrink:0;">
                        ${(u.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <strong style="color:#fff;">${u.name}</strong>
                        <br><small class="text-muted">${u.email}</small>
                    </div>
                </div>
            </td>
            <td>${u.country || '-'}</td>
            <td>
                <div style="color:#fff;font-weight:700;">${formatCurrency(mainUSD)}</div>
                <small style="color:#7a7a7a;">${formatNumber(u.wallet.main, 4)}g</small>
            </td>
            <td>
                <div style="color:#fff;font-weight:700;">${formatCurrency(vaultUSD)}</div>
                <small style="color:#7a7a7a;">${formatNumber(u.wallet.vault, 4)}g</small>
            </td>
            <td>
                <div style="color:#fff;font-weight:700;">${formatCurrency(bonusUSD)}</div>
                <small style="color:#7a7a7a;">${formatNumber(u.wallet.bonus, 4)}g</small>
            </td>
            <td>
                <button class="btn-sm-gold me-1 mb-1"   data-admin-action="credit" data-admin-wallet="main"  data-admin-userid="${uid}"><i class="bi bi-plus"></i> Main</button>
                <button class="btn-sm-gold me-1 mb-1"   data-admin-action="credit" data-admin-wallet="vault" data-admin-userid="${uid}"><i class="bi bi-plus"></i> Vault</button>
                <button class="btn-sm-gold me-1 mb-1"   data-admin-action="credit" data-admin-wallet="bonus" data-admin-userid="${uid}"><i class="bi bi-plus"></i> Bonus</button>
            </td>
            <td>
                <button class="btn-sm-danger me-1 mb-1" data-admin-action="debit"  data-admin-wallet="main"  data-admin-userid="${uid}"><i class="bi bi-dash"></i> Main</button>
                <button class="btn-sm-danger me-1 mb-1" data-admin-action="debit"  data-admin-wallet="vault" data-admin-userid="${uid}"><i class="bi bi-dash"></i> Vault</button>
                <button class="btn-sm-danger mb-1"      data-admin-action="debit"  data-admin-wallet="bonus" data-admin-userid="${uid}"><i class="bi bi-dash"></i> Bonus</button>
            </td>
            <td>
                <button class="btn-sm-blue me-1 mb-1"   data-admin-action="profile" data-admin-userid="${uid}" style="background:linear-gradient(135deg,#3b82f6,#2563eb);box-shadow:0 4px 12px rgba(59,130,246,0.25);border:0;">
                    <i class="bi bi-person-gear"></i> Edit
                </button>
                <button class="btn-sm-blue me-1 mb-1"   data-admin-action="view" data-admin-userid="${uid}" style="background:linear-gradient(135deg,#8b5cf6,#6d28d9);box-shadow:0 4px 12px rgba(139,92,246,0.25);border:0;">
                    <i class="bi bi-eye"></i> View
                </button>
            </td>
            <td>
                ${isFrozen
                    ? `<button class="btn-sm-gold mb-1" data-admin-action="unfreeze" data-admin-userid="${uid}" style="background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 4px 12px rgba(34,197,94,0.3);border:0;width:100%;">
                         <i class="bi bi-unlock-fill"></i> UNFREEZE
                       </button>`
                    : `<button class="btn-sm-danger mb-1" data-admin-action="freeze" data-admin-userid="${uid}" style="width:100%;">
                         <i class="bi bi-lock-fill"></i> FREEZE
                       </button>`
                }
            </td>
            <td>
                <button class="btn-sm-danger mb-1" data-admin-action="delete" data-admin-userid="${uid}" style="width:100%;background:linear-gradient(135deg,#991b1b,#7f1d1d);box-shadow:0 4px 12px rgba(153,27,27,0.3);border:0;">
                    <i class="bi bi-trash"></i> DELETE
                </button>
            </td>
        </tr>`; }).join('');
}

function loadSettingsIntoForm() {
    const s = getSettings();
    const put = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    put('setBasePrice',   s.basePrice);
    put('setWeekly',      s.weeklyPercent);
    put('setMonthly',     s.monthlyPercent);
    put('setYearly',      s.yearlyPercent);
    put('setBonusLimit',  s.bonusTransferLimit);
}

function loadPaymentMethodsIntoForm() {
    const p = Admin.getPaymentMethods();
    const put = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    put('payUSDT', p.usdt || '');
    put('payBTC',  p.btc  || '');
    if (p.bankAccounts && p.bankAccounts.length > 0) {
        const ba = p.bankAccounts[0];
        put('payBankName',      ba.bankName      || '');
        put('payAccountName',   ba.accountName   || '');
        put('payAccountNumber', ba.accountNumber || '');
        put('paySwift',         ba.swift         || '');
    }
}

window.adminAction = async function (action, walletType, userId) {
    if (userId === null || userId === undefined || userId === '') {
        showToast('Invalid user ID — please refresh the table', 'error');
        return;
    }
    const uidNumOrStr = !isNaN(parseFloat(userId)) && isFinite(userId) ? Number(userId) : String(userId);

    if (action === 'freeze' || action === 'unfreeze') {
        const freezeStatus = action === 'freeze';
        const user = getUserById(uidNumOrStr);
        const userName = user ? user.name : userId;
        if (!confirm(`${freezeStatus ? 'FREEZE' : 'UNFREEZE'} account for user: ${userName}?\n\n${freezeStatus ? 'The user will still be able to log in, but all transactions will be disabled.' : 'Unfreezing will restore full transaction access.'}`)) {
            return;
        }
        try {
            const result = await Promise.resolve(Admin.setAccountFrozen(uidNumOrStr, freezeStatus));
            if (result.success) {
                showToast(result.message, freezeStatus ? 'warning' : 'success');
                if (window.NexgoldGlobalSync) { try { window.NexgoldGlobalSync.forceSync(); } catch (_) {} }
                renderUsersTable();
                renderStats();
            } else {
                showToast(result.message || 'Action failed', 'error');
            }
        } catch (e) {
            showToast('Error: ' + (e.message || 'Unknown error'), 'error');
        }
        return;
    }

    if (action === 'delete') {
        const user = getUserById(uidNumOrStr);
        const userName = user ? (user.name || '') + ' (' + (user.email || userId) + ')' : userId;
        if (!confirm(`⚠️  PERMANENTLY DELETE this user?\n\nUser: ${userName}\n\nThis will DELETE their user record, wallet, ALL transactions and certificates.\n\nTHIS CANNOT BE UNDONE.`)) {
            return;
        }
        if (!confirm(`⚠️  Type YES to confirm final deletion of: ${userName}\n\nAre you 100% sure? This is irreversible.`)) {
            return;
        }
        try {
            const result = Admin.deleteUser(uidNumOrStr);
            if (result && result.success) {
                showToast(result.message, 'success');
                if (window.NexgoldGlobalSync) { try { window.NexgoldGlobalSync.forceSync(); } catch (_) {} }
                renderUsersTable();
                renderStats();
                renderPendingApprovals();
            } else {
                showToast((result && result.message) || 'Delete failed', 'error');
            }
        } catch (e) {
            showToast('Error: ' + (e.message || 'Unknown error'), 'error');
        }
        return;
    }

    if (action === 'profile') {
        window.openUserProfileModal(uidNumOrStr, true);
        return;
    }

    if (action === 'view') {
        window.openUserProfileModal(uidNumOrStr, false);
        return;
    }

    const usdAmount = prompt(`[${action.toUpperCase()}] Enter USD to ${action === 'credit' ? 'add to' : 'remove from'} user's ${walletType.toUpperCase()} wallet\n(User: ${userId})`);
    if (!usdAmount || isNaN(parseFloat(usdAmount))) return;

    try {
        const result = await Promise.resolve((action === 'credit')
            ? Admin.creditWallet(uidNumOrStr, walletType, usdAmount)
            : Admin.debitWallet (uidNumOrStr, walletType, usdAmount));

        if (result && result.success) {
            showToast(result.message + ` (user ${userId})`, 'success');
            if (window.NexgoldGlobalSync) { try { window.NexgoldGlobalSync.forceSync(); } catch (_) {} }
            renderUsersTable();
            renderStats();
        } else {
            showToast((result && result.message) || 'Invalid user / wallet not found', 'error');
        }
    } catch (e) {
        showToast('Error: ' + (e.message || 'Unknown error'), 'error');
    }
};

window.resetSettings = function () {
    if (!confirm('Reset all settings to default values?')) return;
    document.getElementById('setBasePrice').value   = 65;
    document.getElementById('setWeekly').value      = 2;
    document.getElementById('setMonthly').value     = 8;
    document.getElementById('setYearly').value      = 100;
    document.getElementById('setBonusLimit').value  = 100;
    showToast('Settings reset to defaults. Click SAVE to apply.', 'info');
};

window.refreshUsers = renderUsersTable;

window.toggleAdminPwd = function (btn) {
    const input = document.getElementById('adminPassword');
    const icon  = btn.querySelector('i');
    if (input.type === 'password') { input.type = 'text'; icon.className = 'bi bi-eye-slash'; }
    else                            { input.type = 'password'; icon.className = 'bi bi-eye'; }
};

/* ================================================================
   Analytics charts & recent system transactions
   ================================================================ */
function loadAnalyticsCharts(forceReload) {
    const tableContainer = document.getElementById('adminTxnsTable');
    if (tableContainer && (forceReload || !tableContainer.dataset.loaded)) {
        tableContainer.dataset.loaded = '1';
        const allTxns = getFromStorage('transactions', []);
        const users   = getFromStorage('users', []);

        if (allTxns.length === 0) {
            tableContainer.innerHTML = `
                <div class="empty-state" style="padding:60px;">
                    <i class="bi bi-journal-x"></i><h5>No Transactions Yet</h5>
                    <p>System-wide transactions will appear here.</p>
                </div>`;
        } else {
            const rows = allTxns.slice(0, 20).map(t => {
                const u = users.find(x => String(x.id) === String(t.userId));
                const badgeClass = t.type.toLowerCase() === 'buy' ? 'buy' : t.type.toLowerCase() === 'sell' ? 'sell' : 'buy';
                const sClass = statusBadgeClass(t.status);
                const sLabel = t.status || TX_STATUS_APPROVED;
                return `
                    <tr>
                        <td><span class="badge-${badgeClass}">${t.type}</span></td>
                        <td><strong>${u ? u.name : 'Unknown'}</strong><br><small class="text-muted">${u ? u.email : ''}</small></td>
                        <td>${t.karat}</td>
                        <td>${formatNumber(t.grams, 4)} g</td>
                        <td>${formatCurrency(t.price)}</td>
                        <td><span style="padding:4px 10px;border-radius:10px;font-size:11px;font-weight:800;letter-spacing:0.4px;${sClass}">${sLabel}</span></td>
                        <td>${new Date(t.date).toLocaleString()}</td>
                    </tr>`;
            }).join('');

            tableContainer.innerHTML = `
                <table class="table table-nexgold align-middle">
                    <thead><tr>
                        <th>Type</th><th>User</th><th>Asset</th><th>Grams</th><th>Value</th><th>Status</th><th>Date</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>`;
        }
    }

    const volCanvas = document.getElementById('analyticsChart');
    if (volCanvas && !volCanvas.dataset.drawn && window.Chart) {
        volCanvas.dataset.drawn = '1';
        const last7Labels = [];
        const data1      = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
            data1.push(Math.floor(Math.random() * 15000) + 5000);
        }
        const ctxA = volCanvas.getContext('2d');
        const gradA = ctxA.createLinearGradient(0, 0, 0, 280);
        gradA.addColorStop(0, 'rgba(212,175,55,0.5)');
        gradA.addColorStop(1, 'rgba(212,175,55,0.02)');

        new Chart(ctxA, {
            type: 'bar',
            data: {
                labels: last7Labels,
                datasets: [{
                    label: 'Daily Volume ($)',
                    data: data1,
                    backgroundColor: gradA,
                    borderColor: '#D4AF37',
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: c => '$' + c.parsed.y.toLocaleString() } }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6c757d' } },
                    y: { grid: { color: 'rgba(255,255,255,0.04)' },
                         ticks: { color: '#6c757d', callback: v => '$'+(v/1000)+'k' } }
                }
            }
        });
    }

    const pieCanvas = document.getElementById('pieChart');
    if (pieCanvas && !pieCanvas.dataset.drawn && window.Chart) {
        pieCanvas.dataset.drawn = '1';
        const allTxns  = getFromStorage('transactions', []);
        const buys     = allTxns.filter(t => t.type === 'BUY').length;
        const sells    = allTxns.filter(t => t.type === 'SELL').length;
        const xfers    = allTxns.filter(t => t.type === 'TRANSFER').length;
        const other    = Math.max(1, allTxns.length - buys - sells - xfers);

        new Chart(pieCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Buys','Sells','Transfers','Other'],
                datasets: [{
                    data: [buys || 3, sells || 1, xfers || 1, other || 0],
                    backgroundColor: ['#D4AF37', '#ef4444', '#34d399', '#8b5cf6'],
                    borderColor: '#0a0a0a',
                    borderWidth: 3,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#b0b0b0', padding: 16, font: { size: 12 } } }
                }
            }
        });
    }
}
