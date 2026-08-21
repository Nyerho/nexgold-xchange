/* ========================================
   ADMIN PAGE SCRIPT - admin.html only
   ======================================== */

document.addEventListener('DOMContentLoaded', initializeAdmin);

function initializeAdmin() {
    const loginScreen = document.getElementById('adminLoginScreen');
    const mainScreen  = document.getElementById('adminMainScreen');
    const isAdmin     = Auth.checkAdminSession(false);

    if (!isAdmin) {
        loginScreen.style.display = 'flex';
        mainScreen.style.display  = 'none';

        document.getElementById('adminLoginBtn')?.addEventListener('click', function () {
            const email = document.getElementById('adminEmailAdmin').value;
            const pw = document.getElementById('adminPassword').value.trim();
            const result = Auth.adminLogin(email, pw);
            if (result.success) {
                showToast('Admin access granted', 'success');
                setTimeout(() => location.reload(), 500);
            } else {
                showToast(result.message, 'error');
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

    renderStats();
    renderPendingApprovals();
    renderUsersTable();
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
}

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
                t.paymentMethod   ? `<div><i class="bi bi-credit-card me-1"></i> Method: <strong>${t.paymentMethod}</strong></div>` : '',
                t.paymentDetails  ? `<div style="font-size:12px;color:#b0b0b0;margin-top:2px;">${t.paymentDetails}</div>` : ''
            ].filter(Boolean).join('');
        } else {
            payInfo = [
                t.payoutMethod   ? `<div><i class="bi bi-wallet2 me-1"></i> Payout: <strong>${t.payoutMethod}</strong></div>` : '',
                t.payoutDetails  ? `<div style="font-size:12px;color:#b0b0b0;margin-top:2px;word-break:break-word;">${t.payoutDetails}</div>` : '',
                t.deliveryAddress ? `<div style="font-size:12px;color:#93c5fd;margin-top:4px;"><i class="bi bi-truck me-1"></i> Delivery: ${t.deliveryAddress}</div>` : ''
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

window.approveTxn = function (txId) {
    const tx = getTransactionById(txId);
    if (!tx) { showToast('Transaction not found — refresh pending list', 'error'); renderPendingApprovals(); return; }
    const u = getUserById(tx.userId);
    const ok = confirm(`APPROVE this ${tx.type} of ${formatNumber(tx.grams,4)}g ${tx.karat} gold for ${u ? u.name : 'Unknown user'}?\n\nThis will ${tx.type==='BUY' ? 'credit gold wallet + issue insurance certificate': 'debit gold wallet'}.`);
    if (!ok) return;

    const result = Admin.approveTransaction(txId);
    if (result.success) {
        showToast(result.message, 'success');
        if (tx.type === 'BUY' && result.certificate) {
            setTimeout(() => generateCertificatePDF(result.certificate), 300);
        }
        renderPendingApprovals();
        loadAnalyticsCharts(true);
        renderStats();
    } else {
        showToast(result.message || 'Approval failed', 'error');
    }
};

window.rejectTxn = function (txId) {
    const tx = getTransactionById(txId);
    if (!tx) { showToast('Transaction not found', 'error'); renderPendingApprovals(); return; }
    const reason = prompt('Enter reason for rejection (shown to user):', '');
    if (reason === null) return;
    const result = Admin.rejectTransaction(txId, reason || 'No reason provided');
    if (result.success) {
        showToast(result.message, 'info');
        renderPendingApprovals();
        loadAnalyticsCharts(true);
        renderStats();
    } else {
        showToast(result.message || 'Rejection failed', 'error');
    }
};

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    const users = Admin.getAllUsersWithWallets();
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">No users registered yet</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const uid = u.id;
        return `
        <tr>
            <td><strong>#${String(uid).slice(-5)}</strong></td>
            <td>${u.name}<br><small class="text-muted">${u.email}</small></td>
            <td>${u.country || '-'}</td>
            <td><strong class="text-gold">${formatNumber(u.wallet.main, 4)}g</strong></td>
            <td><strong style="color:#60a5fa;">${formatNumber(u.wallet.vault, 4)}g</strong></td>
            <td><strong style="color:#34d399;">${formatNumber(u.wallet.bonus, 4)}g</strong></td>
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

window.adminAction = function (action, walletType, userId) {
    if (userId === null || userId === undefined || userId === '') {
        showToast('Invalid user ID — please refresh the table', 'error');
        return;
    }
    const uidNumOrStr = !isNaN(parseFloat(userId)) && isFinite(userId) ? Number(userId) : String(userId);

    const grams = prompt(`[${action.toUpperCase()}] Enter GRAMS to add/remove from user's ${walletType.toUpperCase()} wallet\n(User: ${userId})`);
    if (!grams || isNaN(parseFloat(grams))) return;

    const result = (action === 'credit')
        ? Admin.creditWallet(uidNumOrStr, walletType, grams)
        : Admin.debitWallet (uidNumOrStr, walletType, grams);

    if (result.success) {
        showToast(result.message + ` (user ${userId})`, 'success');
        renderUsersTable();
        renderStats();
    } else {
        showToast(result.message || 'Invalid user / wallet not found', 'error');
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
