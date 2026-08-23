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

    renderWalletCards(userId);

    const letter = (user && user.name) ? String(user.name).charAt(0).toUpperCase() : 'I';
    ['userAvatar', 'userAvatarBig'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = letter;
            if (id === 'userAvatarBig') { el.setAttribute('data-letter', letter); }
        }
    });

    const welcomeHeader = document.getElementById('welcomeHeader');
    if (welcomeHeader && user) welcomeHeader.textContent = user.name;
    ['welcomeName', 'welcomeNameBig'].forEach(id => {
        const el = document.getElementById(id);
        if (el && user) el.textContent = user.name;
    });
    const emailEl = document.getElementById('userEmail');
    if (emailEl && user) emailEl.textContent = user.email;
    document.querySelectorAll('#userEmailCopy').forEach(el => {
        if (user) el.textContent = user.email;
    });

    updateTransferAndSellBalances();

    setupCalculator('buy');
    setupCalculator('sell');

    setupPaymentMethodDisplay();

    setInterval(() => {
        const buyTotal    = document.getElementById('buytotalPrice');
        const buyDisplay  = document.getElementById('buyDisplayTotal');
        const buyVal = buyTotal ? (buyTotal.value || buyTotal.textContent) : '';
        if (buyTotal && buyDisplay && buyDisplay.textContent !== buyVal) {
            buyDisplay.textContent = buyVal;
        }
        const buy2 = document.getElementById('buyDisplayTotal2');
        if (buyTotal && buy2) {
            const rawVal = (buyTotal.value || buyTotal.textContent || '').replace(/[^0-9.]/g, '');
            if (rawVal) buy2.textContent = '$' + parseFloat(rawVal).toFixed(2);
        }
        const sellTotal   = document.getElementById('selltotalPrice');
        const sellDisplay = document.getElementById('sellDisplayTotal');
        const sellVal = sellTotal ? (sellTotal.value || sellTotal.textContent) : '';
        if (sellTotal && sellDisplay && sellDisplay.textContent !== sellVal) {
            sellDisplay.textContent = sellVal;
        }
        const sell2 = document.getElementById('sellDisplayTotal2');
        if (sellTotal && sell2) {
            const rawVal = (sellTotal.value || sellTotal.textContent || '').replace(/[^0-9.]/g, '');
            if (rawVal) sell2.textContent = '$' + parseFloat(rawVal).toFixed(2);
        }
    }, 100);

    renderTransactionHistory(userId, 'transactionHistory', 10);

    const recentInterval = setInterval(() => {
        const recentEl = document.getElementById('recentActivityList');
        if (!recentEl) return;
        clearInterval(recentInterval);
        renderRecentActivity(recentEl, userId);
    }, 200);

    setTimeout(() => {
        const full = document.getElementById('fullTransactionHistory');
        const brief = document.getElementById('transactionHistory');
        if (full && brief && brief.innerHTML && full.querySelector('#transactionHistory')) {
            brief.style.display = '';
        }
    }, 300);

    renderCertificatesList(userId, 'certificatesList');
    updateCertificatesStats(userId);

    setupBuySubmit(userId);
    setupSellSubmit(userId);

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
            document.getElementById('sidebarBackdrop')?.classList.remove('show');
        });
    });
    document.getElementById('mobileMenuToggle')?.addEventListener('click', function () {
        document.getElementById('sidebar')?.classList.toggle('open');
        document.getElementById('sidebarBackdrop')?.classList.toggle('show');
    });
    document.getElementById('sidebarBackdrop')?.addEventListener('click', function () {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebarBackdrop')?.classList.remove('show');
    });

    document.querySelectorAll('.switchToBuy, .switchToSell, .switchToInvest, .switchToTransfer').forEach(btn => {
        btn.addEventListener('click', function (e) {
            const target = this.dataset.target;
            if (!target) return;
            e.preventDefault();
            const sidebarLink = document.querySelector(`.sidebar-link[data-target="${target}"]`);
            if (sidebarLink) sidebarLink.click();
        });
    });

    setTimeout(drawPortfolioChart, 400);

    function debounce(fn, wait) {
        let t;
        return function () {
            clearTimeout(t);
            t = setTimeout(fn, wait);
        };
    }

    const refreshDashboard = debounce(function () {
        refreshDashboardViews(userId);
        updateTransferAndSellBalances();
    }, 120);

    if (window.Sync) {
        Sync.on('wallets', refreshDashboard);
        Sync.on('walletUpdated', refreshDashboard);
        Sync.on('transactions', refreshDashboard);
        Sync.on('certificates', function () {
            renderCertificatesList(userId, 'certificatesList');
            updateCertificatesStats(userId);
        });
        Sync.on('settings', function () {
            setupCalculator('buy');
            setupCalculator('sell');
            refreshDashboard();
        });
        Sync.on('paymentMethods', function () {
            setupPaymentMethodDisplay();
        });

        Sync.on('transactionUpdated', function (tx) {
            if (!tx) return;
            if (String(tx.userId) !== String(userId)) return;
            refreshDashboard();
            if (tx.status === TX_STATUS_APPROVED) {
                if (tx.type === 'BUY') {
                    showToast('🎉 Your BUY of ' + formatNumber(tx.grams, 4) + 'g has been APPROVED! Gold credited to wallet.', 'success');
                    const btn = document.getElementById('buySubmitBtn');
                    if (btn) {
                        btn.disabled = false;
                        btn.style.background = '';
                        btn.style.boxShadow = '';
                        btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> I HAVE MADE PAYMENT · <span id="buyDisplayTotal2">$0.00</span>';
                    }
                } else if (tx.type === 'SELL') {
                    showToast('🎉 Your SELL of ' + formatNumber(tx.grams, 4) + 'g has been APPROVED! Payout processing.', 'success');
                    const btn = document.getElementById('sellSubmitBtn');
                    if (btn) {
                        btn.disabled = false;
                        btn.style.background = '';
                        btn.style.boxShadow = '';
                        btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> I HAVE MADE PAYMENT · <span id="sellDisplayTotal2">$0.00</span>';
                    }
                }
            } else if (tx.status === TX_STATUS_REJECTED) {
                const reason = tx.rejectionReason ? (' Reason: ' + tx.rejectionReason) : '';
                if (tx.type === 'BUY') {
                    showToast('❌ Your BUY order was REJECTED.' + reason, 'error');
                    const btn = document.getElementById('buySubmitBtn');
                    if (btn) {
                        btn.disabled = false;
                        btn.style.background = '';
                        btn.style.boxShadow = '';
                        btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> I HAVE MADE PAYMENT · <span id="buyDisplayTotal2">$0.00</span>';
                    }
                } else if (tx.type === 'SELL') {
                    showToast('❌ Your SELL order was REJECTED.' + reason, 'error');
                    const btn = document.getElementById('sellSubmitBtn');
                    if (btn) {
                        btn.disabled = false;
                        btn.style.background = '';
                        btn.style.boxShadow = '';
                        btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> I HAVE MADE PAYMENT · <span id="sellDisplayTotal2">$0.00</span>';
                    }
                }
            }
        });

        Sync.on('transactionAdded', function (tx) {
            if (!tx || String(tx.userId) !== String(userId)) return;
            refreshDashboard();
        });
    }

    (function applyPendingButtonStates() {
        const myTxns = getUserTransactions(userId, 50);
        const pendingBuys  = myTxns.filter(t => t.type === 'BUY'  && t.status === TX_STATUS_PENDING);
        const pendingSells = myTxns.filter(t => t.type === 'SELL' && t.status === TX_STATUS_PENDING);
        if (pendingBuys.length > 0) {
            const btn = document.getElementById('buySubmitBtn');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>PENDING · Awaiting Admin Approval';
                btn.style.background = 'linear-gradient(135deg,#f59e0b,#d97706 55%,#92400e 100%)';
                btn.style.boxShadow = '0 14px 34px rgba(245,158,11,0.3),inset 0 1px 0 rgba(255,255,255,0.35)';
            }
        }
        if (pendingSells.length > 0) {
            const btn = document.getElementById('sellSubmitBtn');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>PENDING · Awaiting Admin Approval';
                btn.style.background = 'linear-gradient(135deg,#f59e0b,#d97706 55%,#92400e 100%)';
                btn.style.boxShadow = '0 14px 34px rgba(245,158,11,0.3),inset 0 1px 0 rgba(255,255,255,0.35)';
            }
        }
    })();

    (function refreshLivePricesFromSettings() {
        try {
            const s = getSettings();
            document.querySelectorAll('.live-price').forEach(el => {
                el.textContent = formatCurrency(s.basePrice) + '/g (24K)';
            });
        } catch (_) {}
    })();
}

function copyToClipboard(text, btnEl) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        if (btnEl) {
            const original = btnEl.innerHTML;
            btnEl.innerHTML = '<i class="bi bi-check2"></i>';
            btnEl.style.color = '#22c55e';
            setTimeout(() => {
                btnEl.innerHTML = original;
                btnEl.style.color = '';
            }, 1500);
        }
        showToast('Copied to clipboard!', 'success');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); showToast('Copied to clipboard!', 'success'); } catch(e) {}
        document.body.removeChild(ta);
    });
}

function setupPaymentMethodDisplay() {
    const methods = Admin.getPaymentMethods();
    const sel = document.getElementById('buyPaymentMethod');
    const infoDiv = document.getElementById('buyPaymentInfo');
    if (!sel || !infoDiv) return;

    const renderInfo = () => {
        const m = sel.value;
        let html = '';
        if (m === 'Bank Wire') {
            if (methods.bankAccounts && methods.bankAccounts.length > 0) {
                const b = methods.bankAccounts[0];
                html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <strong style="color:#fff;">Bank Wire Details:</strong>
                        </div>` +
                    (b.bankName ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;">
                        <span><i class="bi bi-bank me-1"></i> Bank: ${b.bankName}</span>
                        <button class="copy-btn" style="background:transparent;border:1px solid rgba(212,175,55,0.3);color:#D4AF37;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:12px;" onclick="copyToClipboard(${JSON.stringify(String(b.bankName))}, this)" title="Copy"><i class="bi bi-copy"></i></button>
                    </div>` : '') +
                    (b.accountName ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;">
                        <span><i class="bi bi-person me-1"></i> Beneficiary: ${b.accountName}</span>
                        <button class="copy-btn" style="background:transparent;border:1px solid rgba(212,175,55,0.3);color:#D4AF37;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:12px;" onclick="copyToClipboard(${JSON.stringify(String(b.accountName))}, this)" title="Copy"><i class="bi bi-copy"></i></button>
                    </div>` : '') +
                    (b.accountNumber ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;">
                        <span><i class="bi bi-credit-card me-1"></i> Account / IBAN: <code style="background:rgba(0,0,0,0.4);padding:2px 6px;border-radius:4px;">${b.accountNumber}</code></span>
                        <button class="copy-btn" style="background:transparent;border:1px solid rgba(212,175,55,0.3);color:#D4AF37;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:12px;" onclick="copyToClipboard(${JSON.stringify(String(b.accountNumber))}, this)" title="Copy"><i class="bi bi-copy"></i></button>
                    </div>` : '') +
                    (b.swift ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;">
                        <span><i class="bi bi-globe me-1"></i> SWIFT / BIC: <code style="background:rgba(0,0,0,0.4);padding:2px 6px;border-radius:4px;">${b.swift}</code></span>
                        <button class="copy-btn" style="background:transparent;border:1px solid rgba(212,175,55,0.3);color:#D4AF37;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:12px;" onclick="copyToClipboard(${JSON.stringify(String(b.swift))}, this)" title="Copy"><i class="bi bi-copy"></i></button>
                    </div>` : '') +
                    `<br><small style="color:#8a8a8a;">Please include your full name & email in transfer reference.</small>`;
            } else {
                html = `<span style="color:#f59e0b;"><i class="bi bi-exclamation-triangle me-1"></i> Bank details pending — admin will provide wire instructions upon review.</span>`;
            }
        } else if (m === 'USDT') {
            if (methods.usdt) {
                html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <strong style="color:#fff;">USDT Wallet (TRC20 / ERC20):</strong>
                            <button class="copy-btn" style="background:transparent;border:1px solid rgba(38,162,105,0.4);color:#34d399;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;" onclick="copyToClipboard(${JSON.stringify(String(methods.usdt))}, this)" title="Copy address"><i class="bi bi-copy"></i> Copy</button>
                        </div>` +
                    `<div style="margin-top:6px;padding:10px 14px;background:rgba(0,0,0,0.5);border:1px solid rgba(38,162,105,0.3);border-radius:8px;word-break:break-all;font-family:monospace;font-size:12.5px;color:#34d399;position:relative;">${methods.usdt}</div>` +
                    `<small style="color:#8a8a8a;margin-top:6px;display:block;">Network: TRC20 (preferred) or ERC20 · Send exact amount</small>`;
            } else {
                html = `<span style="color:#f59e0b;"><i class="bi bi-exclamation-triangle me-1"></i> USDT address pending — admin will provide wallet upon review.</span>`;
            }
        } else if (m === 'BTC') {
            if (methods.btc) {
                html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <strong style="color:#fff;">Bitcoin (BTC) Wallet:</strong>
                            <button class="copy-btn" style="background:transparent;border:1px solid rgba(247,147,26,0.4);color:#f7931a;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;" onclick="copyToClipboard(${JSON.stringify(String(methods.btc))}, this)" title="Copy address"><i class="bi bi-copy"></i> Copy</button>
                        </div>` +
                    `<div style="margin-top:6px;padding:10px 14px;background:rgba(0,0,0,0.5);border:1px solid rgba(247,147,26,0.3);border-radius:8px;word-break:break-all;font-family:monospace;font-size:12.5px;color:#f7931a;position:relative;">${methods.btc}</div>` +
                    `<small style="color:#8a8a8a;margin-top:6px;display:block;">On-chain Bitcoin · 1 confirmation required</small>`;
            } else {
                html = `<span style="color:#f59e0b;"><i class="bi bi-exclamation-triangle me-1"></i> BTC address pending — admin will provide wallet upon review.</span>`;
            }
        }
        if (!html) html = `<span style="color:#8a8a8a;">Select a payment method to see account details.</span>`;
        infoDiv.innerHTML = html;
    };

    sel.addEventListener('change', renderInfo);
    renderInfo();
}

function renderRecentActivity(recentEl, userId) {
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
        const sign     = isBuy ? '+' : isSell ? '-' : '\u2194';
        const statusStyle = statusBadgeClass(t.status);
        const statusLabel = t.status || TX_STATUS_APPROVED;
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
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;flex-wrap:wrap;gap:6px;">
                        <span style="font-size:12px;color:#6c757d;">${new Date(t.date).toLocaleDateString()}</span>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="font-size:12px;color:#b0b0b0;">
                                ${t.type === 'TRANSFER' ? 'Internal' : formatCurrency(t.price)}
                            </span>
                            <span style="padding:3px 10px;border-radius:12px;font-size:10.5px;font-weight:700;letter-spacing:0.4px;${statusStyle}">${statusLabel}</span>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function setupBuySubmit(userId) {
    const buySubmitBtn = document.getElementById('buySubmitBtn');
    if (!buySubmitBtn) return;
    buySubmitBtn.addEventListener('click', async function () {
        const karat = document.getElementById('buykarat').value;
        const unit  = document.getElementById('buyunit').value;
        const qty   = document.getElementById('buyquantity').value;
        const payMethod = document.getElementById('buyPaymentMethod')?.value || '';
        const payRef    = document.getElementById('buyPaymentRef')?.value || '';
        const details   = payRef ? (`Reference: ${payRef}`) : '';

        if (parseFloat(qty) <= 0) { showToast('Please enter a valid quantity', 'error'); return; }

        const original = buySubmitBtn.innerHTML;
        buySubmitBtn.disabled = true;
        buySubmitBtn.innerHTML = '<i class="bi bi-arrow-repeat spin me-2"></i>PROCESSING...';
        try {
            const result = await Promise.resolve(buyGold(karat, unit, qty, payMethod, details));
            if (result && result.success) {
                if (result.pending) {
                    showToast(result.message + ' You will be notified once approved.', 'warning');
                    buySubmitBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>PENDING · Awaiting Admin Approval';
                    buySubmitBtn.style.background = 'linear-gradient(135deg,#f59e0b,#d97706 55%,#92400e 100%)';
                    buySubmitBtn.style.boxShadow = '0 14px 34px rgba(245,158,11,0.3),inset 0 1px 0 rgba(255,255,255,0.35)';
                } else {
                    showToast(result.message, 'success');
                    if (result.certificate) setTimeout(() => generateCertificatePDF(result.certificate), 600);
                    buySubmitBtn.disabled = false;
                    buySubmitBtn.innerHTML = original;
                }
                refreshDashboardViews(userId);
            } else {
                showToast((result && result.message) || 'Buy failed', 'error');
                buySubmitBtn.disabled = false;
                buySubmitBtn.innerHTML = original;
            }
        } catch (e) { showToast(e.message || 'Buy failed', 'error'); buySubmitBtn.disabled = false; buySubmitBtn.innerHTML = original; }
    });
}

function setupSellSubmit(userId) {
    const sellSubmitBtn = document.getElementById('sellSubmitBtn');
    if (!sellSubmitBtn) return;
    sellSubmitBtn.addEventListener('click', async function () {
        const karat  = document.getElementById('sellkarat').value;
        const unit   = document.getElementById('sellunit').value;
        const qty    = document.getElementById('sellquantity').value;
        const payout = document.getElementById('sellPayoutMethod')?.value || '';
        const payDet = document.getElementById('sellPayoutDetails')?.value || '';
        const deliv  = document.getElementById('sellDeliveryAddress')?.value || '';

        if (parseFloat(qty) <= 0) { showToast('Please enter a valid quantity', 'error'); return; }
        if (!payDet.trim()) { showToast('Please enter your payout wallet or bank account details', 'error'); return; }

        const original = sellSubmitBtn.innerHTML;
        sellSubmitBtn.disabled = true;
        sellSubmitBtn.innerHTML = '<i class="bi bi-arrow-repeat spin me-2"></i>PROCESSING...';
        try {
            const result = await Promise.resolve(sellGold(karat, unit, qty, payout, deliv, payDet));
            if (result && result.success) {
                if (result.pending) {
                    showToast(result.message + ' Admin will verify your gold balance before payout.', 'warning');
                    sellSubmitBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>PENDING · Awaiting Admin Approval';
                    sellSubmitBtn.style.background = 'linear-gradient(135deg,#f59e0b,#d97706 55%,#92400e 100%)';
                    sellSubmitBtn.style.boxShadow = '0 14px 34px rgba(245,158,11,0.3),inset 0 1px 0 rgba(255,255,255,0.35)';
                } else {
                    showToast(result.message, 'success');
                    sellSubmitBtn.disabled = false;
                    sellSubmitBtn.innerHTML = original;
                }
                refreshDashboardViews(userId);
            } else {
                showToast((result && result.message) || 'Sell failed', 'error');
                sellSubmitBtn.disabled = false;
                sellSubmitBtn.innerHTML = original;
            }
        } catch (e) { showToast(e.message || 'Sell failed', 'error'); sellSubmitBtn.disabled = false; sellSubmitBtn.innerHTML = original; }
    });
}

function refreshDashboardViews(userId) {
    renderWalletCards(userId);
    renderTransactionHistory(userId, 'transactionHistory', 10);
    renderCertificatesList(userId, 'certificatesList');
    updateTransferAndSellBalances();
    updateCertificatesStats(userId);
    const recentEl = document.getElementById('recentActivityList');
    if (recentEl) renderRecentActivity(recentEl, userId);
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
