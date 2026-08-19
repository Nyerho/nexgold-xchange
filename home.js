/* ========================================
   HOMEPAGE SCRIPT - index.html v2 only
   Calculator wiring, breakdown panel, ticker, BUY handler
   ======================================== */

document.addEventListener('DOMContentLoaded', function () {

    /* ============================================================
       1. CALCULATOR (IDs: calcKarat, calcUnit, calcQty)
          Updates breakdown panel + display total every change
       ============================================================ */
    const kSel  = document.getElementById('calcKarat');
    const uSel  = document.getElementById('calcUnit');
    const qIn   = document.getElementById('calcQty');
    const bSub  = document.getElementById('breakSubtotal');
    const bKar  = document.getElementById('breakKarat');
    const bKarA = document.getElementById('breakKaratAmt');
    const bSpr  = document.getElementById('breakSpread');
    const bIns  = document.getElementById('breakIns');
    const bTot  = document.getElementById('breakTotal');
    const bTotG = document.getElementById('breakTotalGrams');
    const dTot  = document.getElementById('displayTotal');

    const KARAT_TEXT = { 24: '24K · 100%', 22: '22K · 91.6%', 18: '18K · 75%' };

    function refreshCalculator() {
        if (!kSel || !uSel || !qIn) return;
        const karat = parseInt(kSel.value, 10) || 24;
        const unit  = uSel.value || 'g';
        const qty   = Math.max(0.0001, parseFloat(qIn.value) || 0);

        const r = calculatePrice(karat, unit, qty);

        const subtotal24 = r.basePriceUSD * qty * r.unitMultiplier;
        const karatAdj   = subtotal24 * (r.karatMultiplier - 1);
        const spread     = r.totalUSD * 0.003;
        const insurance  = r.totalUSD * 0.0004;
        const total      = r.totalUSD + spread + insurance;

        if (bSub)  bSub.textContent  = formatCurrency(subtotal24) + ' USD';
        if (bKar)  bKar.textContent  = KARAT_TEXT[karat] || '24K';
        if (bKarA) bKarA.textContent = (karatAdj >= 0 ? '-' : '') + formatCurrency(Math.abs(karatAdj)) + ' USD';
        if (bSpr)  bSpr.textContent  = formatCurrency(spread)     + ' USD';
        if (bIns)  bIns.textContent  = formatCurrency(insurance)  + ' USD';
        if (bTot)  bTot.textContent  = formatCurrency(total)      + ' USD';
        if (dTot)  dTot.textContent  = formatCurrency(total);
        if (bTotG) bTotG.textContent = '≈ ' + formatNumber(r.grams24k, 2) + ' grams gold credited to vault';
    }
    [kSel, uSel, qIn].forEach(el => el && el.addEventListener('input', refreshCalculator));
    [kSel, uSel].forEach(el => el && el.addEventListener('change', refreshCalculator));
    refreshCalculator();

    /* ============================================================
       2. LIVE TICKER STRIP (infinite scroll)
       ============================================================ */
    const tickerTrack = document.getElementById('tickerTrack');
    if (tickerTrack) {
        const tickerItems = [
            { s: 'XAU/USD', p: '$2,147.82', c: '+1.24%', up: true  },
            { s: 'XAG/USD', p: '$29.84',    c: '+0.86%', up: true  },
            { s: 'XPT/USD', p: '$942.11',   c: '-0.41%', up: false },
            { s: 'XPD/USD', p: '$1,208.64', c: '+2.07%', up: true  },
            { s: 'BTC/USD', p: '$68,421',   c: '+3.12%', up: true  },
            { s: 'ETH/USD', p: '$3,480',    c: '+2.05%', up: true  },
            { s: 'EUR/USD', p: '1.0842',    c: '-0.18%', up: false },
            { s: 'GBP/USD', p: '1.2718',    c: '+0.22%', up: true  },
            { s: 'DXY',     p: '104.32',    c: '+0.14%', up: true  },
            { s: 'US 10Y',  p: '4.218%',    c: '-0.03%', up: false },
            { s: 'OIL WTI', p: '$78.64',    c: '+1.02%', up: true  },
            { s: 'S&P 500', p: '5,482.18',  c: '+0.68%', up: true  },
        ];
        const chg = (up, c) => `<span class="${up ? 'tk-chg-up' : 'tk-chg-down'}">${up ? '▲' : '▼'} ${c}</span>`;
        const rowHtml = tickerItems.map(t =>
            `<div class="tk-item"><span class="tk-sym">${t.s}</span> <span class="tk-price">${t.p}</span> ${chg(t.up, t.c)}</div>`
        ).join('');
        tickerTrack.innerHTML = rowHtml + rowHtml;   // duplicate for seamless loop
    }

    /* ============================================================
       3. MARKET SWITCHER: XAU/XAG/XPT/XPD → spot prices + chart header
       ============================================================ */
    const SPOTS = {
        XAUUSD: { name: 'XAU/USD', price: '$2,147.82', priceSmall: '2147.82', diff: '+26.22', pct: '+1.24%', up: true,  cls: 'OANDA:XAUUSD', spot: '$2,147.82 <small>/ oz</small>' },
        XAGUSD: { name: 'XAG/USD', price: '$29.84',    priceSmall: '29.84',    diff: '+0.26',  pct: '+0.86%', up: true,  cls: 'OANDA:XAGUSD', spot: '$29.84 <small>/ oz</small>' },
        XPTUSD: { name: 'XPT/USD', price: '$942.11',   priceSmall: '942.11',   diff: '-3.88',  pct: '-0.41%', up: false, cls: 'OANDA:XPTUSD', spot: '$942.11 <small>/ oz</small>' },
        XPDUSD: { name: 'XPD/USD', price: '$1,208.64', priceSmall: '1208.64',  diff: '+24.51', pct: '+2.07%', up: true,  cls: 'OANDA:XPDUSD', spot: '$1,208.64 <small>/ oz</small>' },
    };
    const marketSwitcher = document.getElementById('marketSwitcher');
    const cfSymName     = document.getElementById('cfSymName');
    const cfSymPrice    = document.getElementById('cfSymPrice');
    const cfSymChange   = document.getElementById('cfSymChange');
    if (marketSwitcher) {
        marketSwitcher.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                marketSwitcher.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const key = btn.dataset.sym;
                const s   = SPOTS[key];
                if (!s) return;
                if (cfSymName)   cfSymName.textContent = s.name;
                if (cfSymPrice) {
                    cfSymPrice.textContent = s.price;
                    cfSymPrice.className = s.up ? 'cf-price-up' : 'cf-price-down';
                }
                if (cfSymChange) {
                    cfSymChange.textContent = s.diff + ' · ' + s.pct;
                    cfSymChange.className = s.up ? 'cf-spread-up' : 'cf-spread-down';
                }
                // Update spot card if present (first card just swaps label text for quick feedback)
                const spotNode = document.querySelector(`[data-spot="${key}"]`);
                if (spotNode) {
                    spotNode.innerHTML = s.spot;
                    spotNode.animate([{ opacity: 0.5 }, { opacity: 1 }], { duration: 300 });
                }
                // Rebuild TradingView widget? Very heavy — just show toast that the symbol switched
                showToast(`Market view switched to ${s.name}`, 'info');
            });
        });
    }

    /* ============================================================
       4. BUY button (auth-redirect + purchase + PDF certificate)
       ============================================================ */
    const buyBtn = document.getElementById('buyGoldBtn');
    if (buyBtn) {
        buyBtn.addEventListener('click', async function () {
            const userId = Auth.getCurrentUserId();

            if (!userId) {
                showAuthModal('login');
                return;
            }

            const karat = (document.getElementById('calcKarat') || {}).value || '24';
            const unit  = (document.getElementById('calcUnit')  || {}).value || 'g';
            const qty   = (document.getElementById('calcQty')   || {}).value || '1';

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
                    } else {
                        setTimeout(() => window.location.href = 'dashboard.html', 1200);
                    }
                } else if (result && result.requiresAuth) {
                    showAuthModal('login');
                    buyBtn.disabled = false;
                    buyBtn.innerHTML = original;
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
