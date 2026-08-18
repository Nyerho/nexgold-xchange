/* ========================================
   DASHBOARD PAGE SCRIPT - dashboard.html only
   ======================================== */

document.addEventListener('DOMContentLoaded', function () {
    const userId = Auth.checkSession();
    if (!userId) return;

    initializeDashboard();
});

function initializeDashboard() {
    const userId = Auth.getCurrentUserId();
    if (!userId) return;
    const user   = Auth.getCurrentUser();

    // ---------------------------------------------------------------
    // 1. Wallet cards + quick stats
    // ---------------------------------------------------------------
    renderWalletCards(userId);

    // Avatar initial
    const avatar = document.getElementById('userAvatar');
    if (avatar && user) avatar.textContent = user.name.charAt(0).toUpperCase();

    // Welcome header
    const welcomeHeader = document.getElementById('welcomeHeader');
    if (welcomeHeader && user) welcomeHeader.textContent = user.name;

    // Live sell-available balance
    updateTransferAndSellBalances();

    // ---------------------------------------------------------------
    // 2. BUY / SELL calculators (different prefixes)
    // ---------------------------------------------------------------
    setupCalculator('buy');
    setupCalculator('sell');

    // Sync big display totals
    setInterval(() => {
        const buyTotal    = document.getElementById('buytotalPrice');
        const buyDisplay  = document.getElementById('buyDisplayTotal');
        if (buyTotal && buyDisplay && buyDisplay.textContent !== buyTotal.value) {
            buyDisplay.textContent = buyTotal.value;
        }
        const sellTotal   = document.getElementById('selltotalPrice');
        const sellDisplay = document.getElementById('sellDisplayTotal');
        if (sellTotal && sellDisplay && sellDisplay.textContent !== sellTotal.value) {
            sellDisplay.textContent = sellTotal.value;
        }
    }, 100);

    // ---------------------------------------------------------------
    // 3. Transaction history & recent activity
    // ---------------------------------------------------------------
    renderTransactionHistory(userId, 'transactionHistory', 10);

    const recentInterval = setInterval(() => {
        const recentEl = document.getElementById('recentActivityList');
        if (!recentEl) return;
        clearInterval(recentInterval);

        const allTxns = getUserTransactions(userId, 5);
        if (allTxns.length === 0) {
            recentEl.innerHTML = `
                <div class="empty-state" style="padding:40px 20px;">
                    <i class="bi bi-journal-x"></i><h5>No Activity Yet</h5>
                    <p style="font-size:13px;">Buy gold to see your transactions here.</p>
                </div>`;
            return;
        }
        recentEl.innerHTML = allTxns.map(t => {
            const isBuy    = t.type === 'BUY';
            const isSell   = t.type === 'SELL';
            const accentC  = isBuy ? '#22c55e' : isSell ? '#ef4444' : '#D4AF37';
            const accentBg = isBuy ? 'rgba(34,197,94,0.1)' : isSell ? 'rgba(239,68,68,0.1)' : 'rgba(212,175,55,0.1)';
            const accentBd = isBuy ? 'rgba(34,197,94,0.3)' : isSell ? 'rgba(239,68,68,0.3)' : 'rgba(212,175,55,0.3)';
            const icon     = isBuy ? 'cart-plus' : isSell ? 'cart-dash' : 'arrow-left-right';
            const sign     = isBuy ? '+' : isSell ? '-' : '↔';
            return `
                <div style="display:flex;align-items:center;gap:14px;padding:16px 28px;border-bottom:1px solid var(--border-color);">
                    <div style="width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:${accentBg};border:1px solid ${accentBd};">
                        <i class="bi bi-${icon}" style="font-size:18px;color:${accentC};"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div style="display:flex;justify-content:space-between;align-items:baseline;">
                            <h6 style="margin:0;font-size:14px;font-weight:700;">${t.type} ${t.karat} Gold</h6>
                            <span style="font-weight:700;color:${accentC};font-size:14px;">
                                ${sign} ${formatNumber(t.grams, 4)} g
                            </span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-top:4px;">
                            <span style="font-size:12px;color:#6c757d;">${new Date(t.date).toLocaleDateString()}</span>
                            <span style="font-size:12px;color:#b0b0b0;">
                                ${t.type === 'TRANSFER' ? 'Internal' : formatCurrency(t.price)}
                            </span>
                        </div>
                    </div>
                </div>`;
        }).join('');
    }, 200);

    // Full tx history (lower section)
    const histFullInterval = setInterval(() => {
        const full = document.getElementById('fullTransactionHistory');
        const brief = document.getElementById('transactionHistory');
        if (!full || !brief || !brief.innerHTML) return;
        clearInterval(histFullInterval);
        full.innerHTML = brief.innerHTML.replace('Last 10 transactions', '');
    }, 300);

    // ---------------------------------------------------------------
    // 4. Certificates
    // ---------------------------------------------------------------
    renderCertificatesList(userId, 'certificatesList');
    updateCertificatesStats(userId);

    // ---------------------------------------------------------------
    // 5. BUY submit (Promise-aware)
    // ---------------------------------------------------------------
    const buySubmitBtn = document.getElementById('buySubmitBtn');
    if (buySubmitBtn) {
        buySubmitBtn.addEventListener('click', async function () {
            const karat = document.getElementById('buykarat').value;
            const unit  = document.getElementById('buyunit').value;
            const qty   = document.getElementById('buyquantity').value;

            if (parseFloat(qty) <= 0) { showToast('Please enter a valid quantity', 'error'); return; }

            const original = buySubmitBtn.innerHTML;
            buySubmitBtn.disabled = true;
            buySubmitBtn.innerHTML = '<i class="bi bi-arrow-repeat spin me-2"></i>BUYING...';
            try {
                const result = await Promise.resolve(buyGold(karat, unit, qty));
                if (result && result.success) {
                    showToast(result.message + ' Certificate downloading...', 'success');
                    refreshDashboardViews(userId);
                    if (result.certificate) setTimeout(() => generateCertificatePDF(result.certificate), 600);
                } else {
                    showToast((result && result.message) || 'Buy failed', 'error');
                }
            } catch (e) { showToast(e.message || 'Buy failed', 'error'); }
            buySubmitBtn.disabled = false;
            buySubmitBtn.innerHTML = original;
        });
    }

    // ---------------------------------------------------------------
    // 6. SELL submit (Promise-aware)
    // ---------------------------------------------------------------
    const sellSubmitBtn = document.getElementById('sellSubmitBtn');
    if (sellSubmitBtn) {
        sellSubmitBtn.addEventListener('click', async function () {
            const karat = document.getElementById('sellkarat').value;
            const unit  = document.getElementById('sellunit').value;
            const qty   = document.getElementById('sellquantity').value;

            if (parseFloat(qty) <= 0) { showToast('Please enter a valid quantity', 'error'); return; }

            const original = sellSubmitBtn.innerHTML;
            sellSubmitBtn.disabled = true;
            sellSubmitBtn.innerHTML = '<i class="bi bi-arrow-repeat spin me-2"></i>SELLING...';
            try {
                const result = await Promise.resolve(sellGold(karat, unit, qty));
                if (result && result.success) {
                    showToast(result.message, 'success');
                    refreshDashboardViews(userId);
                } else {
                    showToast((result && result.message) || 'Sell failed', 'error');
                }
            } catch (e) { showToast(e.message || 'Sell failed', 'error'); }
            sellSubmitBtn.disabled = false;
            sellSubmitBtn.innerHTML = original;
        });
    }

    // ---------------------------------------------------------------
    // 7. Investment calculator
    // ---------------------------------------------------------------
    const invCalcBtn = document.getElementById('invCalculateBtn');
    if (invCalcBtn) {
        const runCalc = () => {
            const amount     = document.getElementById('invAmount').value;
            const periodType = document.getElementById('invPeriodType').value;
            const periods    = document.getElementById('invPeriods').value;
            const result     = calculateInvestment(amount, periodType, periods);

            document.getElementById('invProjection').textContent = formatCurrency(result.projection);
            document.getElementById('invGrowth').textContent     = '+' + formatCurrency(result.growth) + ' (' + result.growthPercent.toFixed(2) + '%)';
            document.getElementById('invRate').textContent       = result.rate + '% ' + result.periodType;

            renderInvestmentChart(result.chartData);
        };
        invCalcBtn.addEventListener('click', runCalc);
        document.getElementById('invAmount')?.addEventListener('input', runCalc);
        document.getElementById('invPeriodType')?.addEventListener('change', runCalc);
        document.getElementById('invPeriods')?.addEventListener('input', runCalc);
        runCalc();
    }

    // ---------------------------------------------------------------
    // 8. Bonus → Main transfer (Promise-aware)
    // ---------------------------------------------------------------
    const transferBtn = document.getElementById('transferBonusBtn');
    if (transferBtn) {
        transferBtn.addEventListener('click', async function () {
            const grams  = document.getElementById('transferAmount').value;
            const original = transferBtn.innerHTML;
            transferBtn.disabled = true;
            transferBtn.innerHTML = '<i class="bi bi-arrow-repeat spin me-2"></i>TRANSFERRING...';
            try {
                const result = await Promise.resolve(transferBonusToMain(grams));
                if (result && result.success) {
                    showToast(result.message, 'success');
                    refreshDashboardViews(userId);
                    document.getElementById('transferAmount').value = '';
                } else {
                    showToast((result && result.message) || 'Transfer failed', 'error');
                }
            } catch (e) { showToast(e.message || 'Transfer failed', 'error'); }
            transferBtn.disabled = false;
            transferBtn.innerHTML = original;
        });
    }

    // ---------------------------------------------------------------
    // 9. Sidebar navigation
    // ---------------------------------------------------------------
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const target = this.dataset.target;
            if (!target) return;

            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('.dashboard-section').forEach(s => s.style.display = 'none');
            const section = document.getElementById(target);
            if (section) section.style.display = 'block';

            document.getElementById('sidebar')?.classList.remove('open');
        });
    });
    document.getElementById('mobileMenuToggle')?.addEventListener('click', function () {
        document.getElementById('sidebar')?.classList.toggle('open');
    });

    // ---------------------------------------------------------------
    // 10. Portfolio sparkline chart
    // ---------------------------------------------------------------
    setTimeout(drawPortfolioChart, 400);
}

/* ================================================================
   Helpers - dashboard-only
   ================================================================ */
function refreshDashboardViews(userId) {
    renderWalletCards(userId);
    renderTransactionHistory(userId, 'transactionHistory', 10);
    renderCertificatesList(userId, 'certificatesList');
    updateTransferAndSellBalances();
    updateCertificatesStats(userId);
}

function updateTransferAndSellBalances() {
    const userId = Auth.getCurrentUserId();
    const wallet = getUserWallet(userId);
    const settings = getSettings();
    if (!wallet) return;

    const tBonus  = document.getElementById('transferBonusBal');
    const tLimit  = document.getElementById('transferLimit');
    const sellAv  = document.getElementById('sellAvailable');
    if (tBonus) tBonus.textContent = formatNumber(wallet.bonus, 4) + ' g';
    if (tLimit) tLimit.textContent = settings.bonusTransferLimit + ' g';
    if (sellAv) sellAv.textContent  = formatNumber(wallet.main, 4) + ' g';

    // Rate labels on investment page
    const s = getSettings();
    const rw = document.getElementById('rateWeekly');
    const rm = document.getElementById('rateMonthly');
    const ry = document.getElementById('rateYearly');
    if (rw) rw.textContent = s.weeklyPercent + '%';
    if (rm) rm.textContent = s.monthlyPercent + '%';
    if (ry) ry.textContent = s.yearlyPercent + '%';
}

function updateCertificatesStats(userId) {
    const certs = getUserCertificates(userId);
    const totalGold = certs.reduce((s, c) => s + c.grams, 0);
    const totalVal  = certs.reduce((s, c) => s + c.value, 0);
    const cCount = document.getElementById('certCount');
    const cGold  = document.getElementById('certGold');
    const cCov   = document.getElementById('certCoverage');
    if (cCount) cCount.textContent = certs.length;
    if (cGold)  cGold.textContent  = formatNumber(totalGold, 2) + 'g';
    if (cCov)   cCov.textContent   = '$' + totalVal.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function drawPortfolioChart() {
    const canvas = document.getElementById('portfolioChart');
    if (!canvas || !window.Chart) return;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 220);
    grad.addColorStop(0, 'rgba(212,175,55,0.4)');
    grad.addColorStop(1, 'rgba(212,175,55,0.01)');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
            datasets: [{
                label: 'Portfolio Value',
                data: [950, 980, 960, 1020, 1050, 1030, 1100],
                borderColor: '#D4AF37',
                backgroundColor: grad,
                fill: true,
                tension: 0.45,
                borderWidth: 3,
                pointBackgroundColor: '#D4AF37',
                pointBorderColor: '#000',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 7
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
                     ticks: { color: '#6c757d', callback: v => '$'+v } }
            }
        }
    });
}
