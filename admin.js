/* ========================================
   ADMIN PAGE SCRIPT - admin.html only
   ======================================== */

document.addEventListener('DOMContentLoaded', initializeAdmin);

function initializeAdmin() {
    const loginScreen = document.getElementById('adminLoginScreen');
    const mainScreen  = document.getElementById('adminMainScreen');
    const isAdmin     = Auth.checkAdminSession(false);

    // ---------------------------------------------------------------
    // 1. Gate: not logged in → show login screen
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // 2. Admin is logged in → show main admin panel
    // ---------------------------------------------------------------
    loginScreen.style.display = 'none';
    mainScreen.style.display  = 'block';

    renderStats();
    renderUsersTable();
    loadSettingsIntoForm();
    loadPaymentMethodsIntoForm();

    // ---------------------------------------------------------------
    // 3. Settings save button
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // 4. Payments save button
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // 5. Analytics charts & tables (load after render)
    // ---------------------------------------------------------------
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
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    const users = Admin.getAllUsersWithWallets();
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">No users registered yet</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const uid = JSON.stringify(String(u.id));
        return `
        <tr>
            <td><strong>#${String(u.id).slice(-5)}</strong></td>
            <td>${u.name}<br><small class="text-muted">${u.email}</small></td>
            <td>${u.country || '-'}</td>
            <td><strong class="text-gold">${formatNumber(u.wallet.main, 4)}g</strong></td>
            <td><strong style="color:#60a5fa;">${formatNumber(u.wallet.vault, 4)}g</strong></td>
            <td><strong style="color:#34d399;">${formatNumber(u.wallet.bonus, 4)}g</strong></td>
            <td>
                <button class="btn-sm-gold me-1 mb-1"   onclick="adminAction('credit','main',${uid})"><i class="bi bi-plus"></i> Main</button>
                <button class="btn-sm-gold me-1 mb-1"   onclick="adminAction('credit','vault',${uid})"><i class="bi bi-plus"></i> Vault</button>
                <button class="btn-sm-gold me-1 mb-1"   onclick="adminAction('credit','bonus',${uid})"><i class="bi bi-plus"></i> Bonus</button>
            </td>
            <td>
                <button class="btn-sm-danger me-1 mb-1" onclick="adminAction('debit','main',${uid})"><i class="bi bi-dash"></i> Main</button>
                <button class="btn-sm-danger me-1 mb-1" onclick="adminAction('debit','vault',${uid})"><i class="bi bi-dash"></i> Vault</button>
                <button class="btn-sm-danger mb-1"      onclick="adminAction('debit','bonus',${uid})"><i class="bi bi-dash"></i> Bonus</button>
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

/* ================================================================
   Global admin action (prompt + credit/debit)
   ================================================================ */
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
function loadAnalyticsCharts() {
    // System transactions table
    const tableContainer = document.getElementById('adminTxnsTable');
    if (tableContainer && !tableContainer.dataset.loaded) {
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
                const u = users.find(x => x.id === t.userId);
                const badgeClass = t.type.toLowerCase() === 'buy' ? 'buy' : t.type.toLowerCase() === 'sell' ? 'sell' : 'buy';
                return `
                    <tr>
                        <td><span class="badge-${badgeClass}">${t.type}</span></td>
                        <td><strong>${u ? u.name : 'Unknown'}</strong><br><small class="text-muted">${u ? u.email : ''}</small></td>
                        <td>${t.karat}</td>
                        <td>${formatNumber(t.grams, 4)} g</td>
                        <td>${formatCurrency(t.price)}</td>
                        <td>${new Date(t.date).toLocaleString()}</td>
                    </tr>`;
            }).join('');

            tableContainer.innerHTML = `
                <table class="table table-nexgold align-middle">
                    <thead><tr>
                        <th>Type</th><th>User</th><th>Asset</th><th>Grams</th><th>Value</th><th>Date</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>`;
        }
    }

    // Volume bar chart
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

    // Pie chart - Tx type distribution
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
