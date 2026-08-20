/* ========================================
   AUTH PAGE SCRIPT - auth.html only
   ======================================== */

document.addEventListener('DOMContentLoaded', handleAuthPage);

function handleAuthPage() {
    const params       = new URLSearchParams(window.location.search);
    const initialTab   = params.get('tab') || 'login';
    const loginForm    = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    // ---------------------------------------------------------------
    // 1. Set initial tab
    // ---------------------------------------------------------------
    document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.remove('active');
        if (t.dataset.tab === initialTab) t.classList.add('active');
    });
    if (loginForm)    loginForm.style.display    = initialTab === 'login'    ? 'block' : 'none';
    if (registerForm) registerForm.style.display = initialTab === 'register' ? 'block' : 'none';

    // ---------------------------------------------------------------
    // 2. Tab switching
    // ---------------------------------------------------------------
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            const tabName = this.dataset.tab;
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            if (loginForm)    loginForm.style.display    = tabName === 'login'    ? 'block' : 'none';
            if (registerForm) registerForm.style.display = tabName === 'register' ? 'block' : 'none';
        });
    });

    // ---------------------------------------------------------------
    // 3. Login form submit (AWAITS — Firebase layer is async)
    // ---------------------------------------------------------------
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const email    = document.getElementById('loginEmail').value.trim().toLowerCase();
            const password = document.getElementById('loginPassword').value;
            const submit   = loginForm.querySelector('button[type="submit"]');
            let originalHTML = '';
            if (submit) { submit.disabled = true; originalHTML = submit.innerHTML; submit.innerHTML = '<i class="bi bi-arrow-repeat spin me-2"></i>SIGNING IN...'; }
            try {
                const result = await Promise.resolve(Auth.login(email, password));
                if (result && result.success) {
                    showToast(result.message, 'success');
                    setTimeout(() => window.location.href = 'dashboard.html', 800);
                } else {
                    showToast((result && result.message) || 'Invalid email or password', 'error');
                    if (submit) { submit.disabled = false; submit.innerHTML = originalHTML; }
                }
            } catch (err) {
                showToast(err.message || 'Login failed', 'error');
                if (submit) { submit.disabled = false; submit.innerHTML = originalHTML; }
            }
        });
    }

    // ---------------------------------------------------------------
    // 4. Register form submit (AWAITS — Firebase layer is async)
    // ---------------------------------------------------------------
    if (registerForm) {
        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const name     = document.getElementById('regName').value.trim();
            const email    = document.getElementById('regEmail').value.trim().toLowerCase();
            const password = document.getElementById('regPassword').value;
            const country  = document.getElementById('regCountry').value.trim();
            const address  = document.getElementById('regAddress').value.trim();
            const submit   = registerForm.querySelector('button[type="submit"]');
            let originalHTML = '';
            if (submit) { submit.disabled = true; originalHTML = submit.innerHTML; submit.innerHTML = '<i class="bi bi-arrow-repeat spin me-2"></i>CREATING ACCOUNT...'; }
            try {
                const result = await Promise.resolve(Auth.register(name, email, password, country, address));
                if (result && result.success) {
                    showToast(result.message, 'success');
                    await Promise.resolve(Auth.login(email, password));
                    setTimeout(() => window.location.href = 'dashboard.html', 1000);
                } else {
                    showToast((result && result.message) || 'Registration failed', 'error');
                    if (submit) { submit.disabled = false; submit.innerHTML = originalHTML; }
                }
            } catch (err) {
                showToast(err.message || 'Registration failed', 'error');
                if (submit) { submit.disabled = false; submit.innerHTML = originalHTML; }
            }
        });
    }
}

// Password toggle helper (inline script depends on global)
window.togglePwd = function (id, btn) {
    const input = document.getElementById(id);
    const icon  = btn.querySelector('i');
    if (input.type === 'password') { input.type = 'text'; icon.className = 'bi bi-eye-slash'; }
    else                            { input.type = 'password'; icon.className = 'bi bi-eye'; }
};
