/* ========================================
   FIREBASE INITIALIZATION
   Loaded BEFORE app.js on all pages
   Exports: window.FB = { app, auth, db, analytics, enabled }
   ======================================== */
(function () {
    // Firebase SDK loader (v10.x compatible script-tags fallback)
    const LOADED_SCRIPTS = [];
    function loadFirebaseScript(name) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-fb-module="${name}"]`);
            if (existing) return resolve();
            const s = document.createElement('script');
            s.src = `https://www.gstatic.com/firebasejs/10.12.5/firebase-${name}.js`;
            s.type = 'text/javascript';
            s.async = false;
            s.setAttribute('data-fb-module', name);
            s.onerror = reject;
            s.onload  = resolve;
            document.head.appendChild(s);
            LOADED_SCRIPTS.push(s);
        });
    }

    const firebaseConfig = {
        apiKey:            "AIzaSyAASqaO-Y2EN303GXGSfdBH2SGv5BI6ITk",
        authDomain:        "nexgoldxchange.firebaseapp.com",
        projectId:         "nexgoldxchange",
        storageBucket:     "nexgoldxchange.firebasestorage.app",
        messagingSenderId: "817253486036",
        appId:             "1:817253486036:web:99dbb85b80978b0e259a41",
        measurementId:     "G-3GPEVR0Y8W"
    };

    // Load core + auth + firestore + analytics in sequence
    (async function initFB() {
        try {
            await loadFirebaseScript('app');
            await loadFirebaseScript('auth');
            await loadFirebaseScript('firestore');
            await loadFirebaseScript('analytics');

            if (!window.firebase || !firebase.initializeApp) {
                console.warn('[Firebase] SDK failed to load; using localStorage-only mode.');
                window.FB = { enabled: false };
                return;
            }

            const app       = firebase.initializeApp(firebaseConfig, '[DEFAULT]');
            const auth      = firebase.auth();
            const db        = firebase.firestore();
            let analytics   = null;

            try {
                analytics = firebase.analytics();
            } catch (e) {
                // Analytics optional on file:// protocol
            }

            window.FB = { app, auth, db, analytics, enabled: true, config: firebaseConfig };
            window.dispatchEvent(new Event('firebase-ready'));
            console.info('[Firebase] Ready:', firebaseConfig.projectId);
        } catch (err) {
            console.warn('[Firebase] Init failed → localStorage fallback:', err.message);
            window.FB = { enabled: false };
        }
    })();
})();
