/* ========================================
   HOMEPAGE SCRIPT - index.html only
   ======================================== */

document.addEventListener('DOMContentLoaded', function () {
    // ---------------------------------------------------------------
    // 1. Initialize the buy calculator (prefix = '')
    // ---------------------------------------------------------------
    setupCalculator('');

    // ---------------------------------------------------------------
    // 2. Sync the calculated total to the big display field
    // ---------------------------------------------------------------
    setInterval(() => {
        const totalInput = document.getElementById('totalPrice');
        const display    = document.getElementById('displayTotal');
        if (totalInput && display && display.textContent !== totalInput.value) {
            display.textContent = totalInput.value;
        }
    }, 100);

    // ---------------------------------------------------------------
    // 3. BUY button click handler (Promise-aware)
    // ---------------------------------------------------------------
    const buyBtn = document.getElementById('buyGoldBtn');
    if (buyBtn) {
        buyBtn.addEventListener('click', async function () {
            const userId = Auth.getCurrentUserId();

            if (!userId) {
                showAuthModal('login');
                return;
            }

            const karat = document.getElementById('karat').value;
            const unit  = document.getElementById('unit').value;
            const qty   = document.getElementById('quantity').value;

            if (parseFloat(qty) <= 0) {
                showToast('Please enter a valid quantity', 'error');
                return;
            }

            const original = buyBtn.innerHTML;
            buyBtn.disabled = true;
            buyBtn.innerHTML = '<i class="bi bi-arrow-repeat spin me-2"></i>PROCESSING...';
            try {
                const result = await Promise.resolve(buyGold(karat, unit, qty));
                if (result && result.success) {
                    showToast(result.message, 'success');
                    if (result.certificate) {
                        setTimeout(() => {
                            generateCertificatePDF(result.certificate);
                            showToast('Redirecting to dashboard...', 'info');
                            setTimeout(() => window.location.href = 'dashboard.html', 1500);
                        }, 800);
                    }
                } else if (result && result.requiresAuth) {
                    showAuthModal('login');
                } else {
                    showToast((result && result.message) || 'Purchase failed', 'error');
                    buyBtn.disabled = false;
                    buyBtn.innerHTML = original;
                }
            } catch (err) {
                showToast(err.message || 'Purchase failed', 'error');
                buyBtn.disabled = false;
                buyBtn.innerHTML = original;
            }
        });
    }
});
