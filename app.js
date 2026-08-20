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

// ========================================
// STORAGE HELPERS
// ========================================
function getFromStorage(key, defaultValue) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
}
function saveToStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
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
function createDemoUser(autoLogin = false) {
    const email    = 'demo@nexgold.exchange';
    const password = 'Demo@123';
    const users    = getFromStorage('users', []);
    if (!users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        const reg = Auth.register('Demo Investor', email, password, 'United States', '1 Demo Way, New York, NY 10001');
        if (reg && reg.success && reg.user) {
            const wallet = getUserWallet(reg.user.id);
            if (wallet) {
                wallet.main  = 10.5;
                wallet.vault = 5.25;
                wallet.bonus = 2.1;
                saveWallet(wallet);
                const txns = [
                    { id: Date.now() - 86400000 * 6, userId: reg.user.id, type: 'BUY',  karat: '24K', grams: 5.0,  price: 5 * getSettings().basePrice,        date: new Date(Date.now() - 86400000 * 6).toISOString() },
                    { id: Date.now() - 86400000 * 3, userId: reg.user.id, type: 'BUY',  karat: '22K', grams: 5.5,  price: 5.5 * getSettings().basePrice * 0.916, date: new Date(Date.now() - 86400000 * 3).toISOString() },
                    { id: Date.now() - 86400000 * 1, userId: reg.user.id, type: 'SELL', karat: '24K', grams: 0.25, price: 0.25 * getSettings().basePrice,      date: new Date(Date.now() - 86400000 * 1).toISOString() }
                ];
                txns.forEach(saveTransaction);
                if (autoLogin) Auth.login(email, password);
                return { success: true, message: 'Demo account created' };
            }
        }
    } else if (autoLogin) {
        Auth.login(email, password);
    }
    return { success: false, message: 'Demo user exists' };
}

(function initializeData() {
    if (!localStorage.getItem('users'))          saveToStorage('users', []);
    if (!localStorage.getItem('wallets'))        saveToStorage('wallets', []);
    if (!localStorage.getItem('transactions'))   saveToStorage('transactions', []);
    if (!localStorage.getItem('certificates'))   saveToStorage('certificates', []);
    if (!localStorage.getItem('paymentMethods')) saveToStorage('paymentMethods', { usdt: '', btc: '', bankAccounts: [] });
    if (!localStorage.getItem('settings')) {
        saveToStorage('settings', {
            basePrice: 65,
            weeklyPercent: 2,
            monthlyPercent: 8,
            yearlyPercent: 100,
            bonusTransferLimit: 100
        });
    }
    const users = getFromStorage('users', []);
    if (users.length === 0) createDemoUser(false);
})();

// ========================================
// FORMATTING HELPERS
// ========================================
function formatCurrency(amount) {
    return '$' + parseFloat(amount).toFixed(2) + ' USD';
}
function formatNumber(num, decimals = 4) {
    return parseFloat(num).toLocaleString('en-US', {
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
    const totalGrams      = parseFloat(quantity) * unitMultiplier;
    const pricePerGram    = basePrice * karatMultiplier;
    const totalPrice      = totalGrams * pricePerGram;
    return { basePrice, karatMultiplier, unitMultiplier, totalGrams, pricePerGram, totalPrice };
}

// Reusable calculator setup (can be called from any page)
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
const Auth = {
    getCurrentUser() {
        const userId = localStorage.getItem('currentUserId');
        if (!userId) return null;
        const users = getFromStorage('users', []);
        return users.find(u => u.id == userId) || null;
    },
    getCurrentUserId() {
        return parseInt(localStorage.getItem('currentUserId')) || null;
    },
    checkSession(redirect = true) {
        const user = this.getCurrentUser();
        if (!user && redirect) window.location.href = 'auth.html';
        return user;
    },
    register(name, email, password, country, address) {
        const users = getFromStorage('users', []);
        const tEmail = String(email).trim().toLowerCase();
        if (users.find(u => u.email.toLowerCase() === tEmail)) {
            return { success: false, message: 'Email already registered' };
        }
        const newUser = { id: Date.now(), name: String(name).trim(), email: tEmail, password, country: String(country || '').trim(), address: String(address || '').trim() };
        //TODO: Connect real API here - hash passwords on backend
        users.push(newUser);
        saveToStorage('users', users);

        const wallets = getFromStorage('wallets', []);
        wallets.push({ userId: newUser.id, main: 0, vault: 0, bonus: 0 });
        saveToStorage('wallets', wallets);

        return { success: true, user: newUser, message: 'Registration successful!' };
    },
    login(email, password) {
        const users = getFromStorage('users', []);
        const tEmail = String(email).trim().toLowerCase();
        const user = users.find(u => u.email.toLowerCase() === tEmail && u.password === password);
        if (!user) return { success: false, message: 'Invalid email or password' };
        localStorage.setItem('currentUserId', user.id);
        return { success: true, user, message: 'Login successful!' };
    },
    logout() {
        localStorage.removeItem('currentUserId');
        localStorage.removeItem('adminLoggedIn');
        window.location.href = 'index.html';
    },
    adminLogin(password) {
        const tPwd = String(password).trim();
        if (tPwd === ADMIN_PASSWORD) {
            localStorage.setItem('adminLoggedIn', 'true');
            return { success: true };
        }
        return { success: false, message: 'Invalid admin password' };
    },
    checkAdminSession(redirect = true) {
        const isAdmin = localStorage.getItem('adminLoggedIn') === 'true';
        if (!isAdmin && redirect) window.location.href = 'admin.html';
        return isAdmin;
    }
};

// ========================================
// WALLET & TRANSACTION HELPERS
// ========================================
function getUserWallet(userId) {
    return getFromStorage('wallets', []).find(w => w.userId === userId);
}
function saveWallet(wallet) {
    const wallets = getFromStorage('wallets', []);
    const idx = wallets.findIndex(w => w.userId === wallet.userId);
    idx >= 0 ? (wallets[idx] = wallet) : wallets.push(wallet);
    saveToStorage('wallets', wallets);
}
function saveTransaction(tx) {
    const transactions = getFromStorage('transactions', []);
    transactions.unshift(tx);
    saveToStorage('transactions', transactions);
}

function buyGold(karat, unit, quantity) {
    const userId = Auth.getCurrentUserId();
    if (!userId) return { success: false, message: 'Please login first', requiresAuth: true };

    const qty = parseFloat(quantity);
    if (qty <= 0) return { success: false, message: 'Please enter a valid quantity' };

    const calc   = calculatePrice(karat, unit, quantity);
    const user   = Auth.getCurrentUser();
    const wallet = getUserWallet(userId);
    if (!wallet) return { success: false, message: 'Wallet not found' };

    wallet.main += calc.totalGrams;
    saveWallet(wallet);

    const transaction = {
        id: Date.now(), userId, type: 'BUY', karat,
        grams: calc.totalGrams, price: calc.totalPrice, date: new Date().toISOString()
    };
    saveTransaction(transaction);

    const certificate = generateCertificateData(user, transaction, calc);
    //TODO: Connect real API here - process actual payment
    return { success: true, message: 'Purchase successful!', transaction, certificate, wallet };
}

function sellGold(karat, unit, quantity) {
    const userId = Auth.getCurrentUserId();
    if (!userId) return { success: false, message: 'Please login first', requiresAuth: true };

    const qty = parseFloat(quantity);
    if (qty <= 0) return { success: false, message: 'Please enter a valid quantity' };

    const calc   = calculatePrice(karat, unit, quantity);
    const wallet = getUserWallet(userId);
    if (!wallet || wallet.main < calc.totalGrams) {
        return { success: false, message: 'Insufficient gold balance in Main wallet' };
    }
    wallet.main -= calc.totalGrams;
    saveWallet(wallet);

    const transaction = {
        id: Date.now(), userId, type: 'SELL', karat,
        grams: calc.totalGrams, price: calc.totalPrice, date: new Date().toISOString()
    };
    saveTransaction(transaction);
    //TODO: Connect real API here - process actual payout
    return { success: true, message: 'Sell order placed successfully!', transaction };
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
    wallet.bonus -= transferGrams;
    wallet.main  += transferGrams;
    saveWallet(wallet);

    saveTransaction({
        id: Date.now(), userId, type: 'TRANSFER', karat: '24K',
        grams: transferGrams, price: 0, date: new Date().toISOString(), note: 'Bonus → Main'
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
function generateCertificateData(user, transaction) {
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
    const cert = getFromStorage('certificates', []).find(c => c.id === certId);
    if (cert) generateCertificatePDF(cert);
}
function generateCertificatePDF(cert) {
    //TODO: Connect real API here - generate PDF on backend
    const { jsPDF } = window.jspdf;
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
    doc.text(`• Storage: Fully Segregated, Audited Monthly`, margin, currentY); currentY += 5;
    doc.text(`• Insurance: All-risk, Full Replacement Value`, margin, currentY); currentY += 5;
    doc.text(`• Audit: Quarterly Independent Third-Party`, margin, currentY); currentY += 5;
    doc.text(`• Redemption: Physical Delivery Available`, margin, currentY);

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
    return cert;
}

// ========================================
// DASHBOARD HELPERS (shared rendering functions)
// ========================================
function getUserTransactions(userId, limit = 10) {
    return getFromStorage('transactions', []).filter(t => t.userId === userId).slice(0, limit);
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
            <thead><tr><th>Type</th><th>Asset</th><th>Grams</th><th>Value</th><th>Date</th></tr></thead>
            <tbody>${transactions.map(t => `
                <tr>
                    <td><span class="badge-${t.type.toLowerCase() === 'buy' ? 'buy' : t.type.toLowerCase() === 'sell' ? 'sell' : 'buy'}">${t.type}</span></td>
                    <td>${t.karat} Gold</td>
                    <td>${formatNumber(t.grams, 4)} g</td>
                    <td>${t.type === 'TRANSFER' ? '-' : formatCurrency(t.price)}</td>
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
                <p>Purchase gold to receive your insurance & custody certificates.</p>
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
        mainCard.querySelector('.wallet-balance-grams').textContent      = formatNumber(wallet.main, 4);
        mainCard.querySelector('.wallet-balance-usd .amount').textContent = formatCurrency(mainUSD);
    }
    if (vaultCard) {
        vaultCard.querySelector('.wallet-balance-grams').textContent      = formatNumber(wallet.vault, 4);
        vaultCard.querySelector('.wallet-balance-usd .amount').textContent = formatCurrency(vaultUSD);
    }
    if (bonusCard) {
        bonusCard.querySelector('.wallet-balance-grams').textContent      = formatNumber(wallet.bonus, 4);
        bonusCard.querySelector('.wallet-balance-usd .amount').textContent = formatCurrency(bonusUSD);
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
        const buys         = transactions.filter(t => t.type === 'BUY');
        const wallets      = getFromStorage('wallets', []);
        return {
            totalUsers:        users.length,
            totalTransactions: transactions.length,
            totalGoldSold:     buys.reduce((sum, t) => sum + t.grams, 0),
            totalVolume:       buys.reduce((sum, t) => sum + t.price, 0),
            totalGoldHeld:     wallets.reduce((sum, w) => sum + w.main + w.vault + w.bonus, 0)
        };
    },
    getAllUsersWithWallets() {
        const users   = getFromStorage('users', []);
        const wallets = getFromStorage('wallets', []);
        return users.map(u => ({
            ...u,
            wallet: wallets.find(w => w.userId === u.id) || { main: 0, vault: 0, bonus: 0 }
        }));
    },
    creditWallet(userId, walletType, grams) {
        // Accept numeric local userId OR Firebase string UID (find by email/uid)
        let wallet = getUserWallet(userId);
        if (!wallet) {
            const wallets = getFromStorage('wallets', []);
            const users   = getFromStorage('users', []);
            const uByUid  = users.find(u => String(u.fbUid || '') === String(userId)) ||
                            users.find(u => String(u.id) === String(userId));
            if (uByUid) wallet = wallets.find(w => w.userId === uByUid.id);
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
            if (uByUid) wallet = wallets.find(w => w.userId === uByUid.id);
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
    }, 3500);
}

function showAuthModal(type = 'login') {
    window.location.href = 'auth.html?tab=' + type;
}

// ========================================
// GLOBAL EXPORTS (for inline onclick handlers)
// ========================================
Object.assign(window, {
    Auth, Admin, calculatePrice, buyGold, sellGold, transferBonusToMain,
    generateCertificatePDF, downloadCertificate, calculateInvestment,
    formatCurrency, formatNumber, showToast,
    setupCalculator, renderWalletCards, renderTransactionHistory, renderCertificatesList
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
   (Non-blocking. Falls back to localStorage.)
   ======================================== */
(function attachFirebaseLayer() {
    const onReady = () => {
        const FB = window.FB || {};
        if (!FB.enabled) return;
        const { auth, db, analytics } = FB;

        // ========================================
        // 1. Auth wrappers — use Firebase Auth + local record
        // ========================================
        const _localRegister = Auth.register.bind(Auth);
        const _localLogin    = Auth.login.bind(Auth);
        const _localLogout   = Auth.logout.bind(Auth);

        Auth.register = async function (name, email, password, country, address) {
            const trimmedEmail = String(email).trim().toLowerCase();
            const trimmedName = String(name).trim();
            const trimmedCountry = String(country || '').trim();
            const trimmedAddress = String(address || '').trim();
            try {
                const uc = await auth.createUserWithEmailAndPassword(trimmedEmail, password);
                const fbUid = uc.user.uid;
                const local = _localRegister(trimmedName, trimmedEmail, password, trimmedCountry, trimmedAddress);
                if (!local.success) {
                    try { await uc.user.delete(); } catch (_) {}
                    return local;
                }
                try {
                    const fbProfile = { name: trimmedName, email: trimmedEmail, country: trimmedCountry, address: trimmedAddress, localUserId: local.user.id, role: 'user', createdAt: new Date().toISOString() };
                    await db.collection('users').doc(fbUid).set(fbProfile);
                    await db.collection('wallets').doc(fbUid).set({ userId: local.user.id, main: 0, vault: 0, bonus: 0, updatedAt: new Date().toISOString() });
                    if (analytics) analytics.logEvent('sign_up', { method: 'email' });
                } catch (e) {
                    console.warn('[Firebase] write user failed (local OK):', e.message);
                }
                return local;
            } catch (e) {
                if (e.code === 'auth/email-already-in-use') {
                    const local = _localRegister(trimmedName, trimmedEmail, password, trimmedCountry, trimmedAddress);
                    if (local.success || (local.message && local.message.includes('already registered'))) {
                        return local;
                    }
                    return { success: false, message: 'Email already registered' };
                }
                if (e.code && String(e.code).startsWith('auth/')) {
                    const local = _localRegister(trimmedName, trimmedEmail, password, trimmedCountry, trimmedAddress);
                    if (local.success) return local;
                    return { success: false, message: local.message || 'Registration failed' };
                }
                return _localRegister(trimmedName, trimmedEmail, password, trimmedCountry, trimmedAddress);
            }
        };

        Auth.login = async function (email, password) {
            const trimmedEmail = String(email).trim().toLowerCase();
            const trimmedPassword = String(password);
            try {
                const uc = await auth.signInWithEmailAndPassword(trimmedEmail, trimmedPassword);
                const fbUid = uc.user.uid;
                let local = _localLogin(trimmedEmail, trimmedPassword);
                if (!local.success) {
                    try {
                        const snap = await db.collection('users').doc(fbUid).get();
                        const doc = snap.data() || {};
                        local = _localRegister(doc.name || trimmedEmail.split('@')[0], trimmedEmail, trimmedPassword, doc.country || '', doc.address || '');
                        if (local.success) local = _localLogin(trimmedEmail, trimmedPassword);
                    } catch (_) {}
                }
                if (!local.success) {
                    localStorage.setItem('currentUserId', fbUid);
                    local = { success: true, user: { id: fbUid, email: trimmedEmail, name: trimmedEmail.split('@')[0] }, message: 'Firebase login successful!' };
                }
                if (local.success && analytics) analytics.logEvent('login', { method: 'email' });
                return local;
            } catch (e) {
                if (e.code && String(e.code).startsWith('auth/')) {
                    const local = _localLogin(trimmedEmail, trimmedPassword);
                    if (local.success) return local;
                    return { success: false, message: 'Invalid email or password' };
                }
                return _localLogin(trimmedEmail, trimmedPassword);
            }
        };

        Auth.logout = async function () {
            try { await auth.signOut(); } catch (_) {}
            _localLogout();
        };

        auth.onAuthStateChanged(user => {
            if (!user) {
                if (localStorage.getItem('currentUserId')) localStorage.removeItem('currentUserId');
            }
        });

        // ========================================
        // 2. Firestore mirror of writes (best-effort)
        // ========================================
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

        // Admin panel stats mirror
        const _credit = Admin.creditWallet.bind(Admin);
        Admin.creditWallet = async function (userId, walletType, grams) {
            const r = _credit(userId, walletType, grams);
            if (analytics) analytics.logEvent('admin_credit', { userId, walletType, grams });
            return r;
        };

        console.info('[Firebase] Layer attached ✔');
    };

    if (window.FB && window.FB.enabled) onReady();
    else window.addEventListener('firebase-ready', onReady, { once: true });
})();

/* ========================================
   DEMO USER SEEDER (console + auth page banner)
   Credentials printed to browser console, plus helper:
       createDemoUser() → seeded in localStorage + Firebase Auth
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
    // Try Firebase first, fall back to local
    try {
        const r = await Auth.register(DEMO_USER.name, DEMO_USER.email, DEMO_USER.password, DEMO_USER.country, DEMO_USER.address);
        if (!r.success && (r.message || '').includes('already registered')) {
            const l = await Auth.login(DEMO_USER.email, DEMO_USER.password);
            console.log('[DEMO] Already existed → logged in.');
            return l;
        }
        // Seed a small wallet balance + demo transactions for first-time demo
        if (r && r.success) {
            const uid = r.user.id;
            const wallets = getFromStorage('wallets', []);
            const w = wallets.find(x => x.userId === uid);
            if (w) {
                w.main  = parseFloat((w.main + 1.5).toFixed(4));
                w.bonus = parseFloat((w.bonus + 0.5).toFixed(4));
                saveWallet(w);
                saveTransaction({
                    id: Date.now() - 1000, userId: uid, type: 'BUY', karat: '24K',
                    grams: 1.5, price: 1.5 * getSettings().basePrice, date: new Date(Date.now() - 86400000).toISOString(),
                    note: 'Demo seed'
                });
            }
        }
        return r;
    } catch (e) {
        console.error('[DEMO] create failed:', e);
        return { success: false, message: e.message };
    }
};
console.log('%c 🪙 NEXGOLD DEMO CREDENTIALS', 'background:#000;color:#D4AF37;font-size:16px;font-weight:900;padding:12px 18px;border:2px solid #D4AF37;border-radius:8px;');
console.log('%c Email:    demo@nexgold.exchange\n Password: Demo@123\n Admin PW: admin123\n Run `await createDemoUser()` in console to seed.', 'font-family:monospace;font-size:13px;color:#D4AF37;');
