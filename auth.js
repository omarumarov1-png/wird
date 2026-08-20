// auth.js — sign-in gate + Firestore progress sync.
//
// Loaded as a plain classic script, AFTER app.js. app.js no longer calls
// boot() itself; it assigns `window.__appReady = boot`. This file decides
// when to actually call it: immediately, in local-only mode, if Firebase
// isn't configured yet or is unreachable, or once a user is signed in.
//
// This keeps the site working (local-only, exactly as before) at every
// point — before Firebase is set up, while it's being set up, and if the
// CDN/network is unavailable — and switches on the real account gate the
// moment a valid config is present and reachable. Ported from the same
// pattern already proven in Muḥkam and Flow (same shared Firebase
// project), not written from scratch.
(() => {
  "use strict";

  const APP_ID = "wird";
  const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";

  // Races any promise against a timeout, so a flaky/hanging connection
  // (e.g. Wi-Fi that's associated but has no real internet, DNS silently
  // stalling) behaves the same as a cleanly-rejected offline fetch instead
  // of leaving the loading screen up indefinitely. A genuinely offline
  // browser usually rejects fetch() fast on its own -- this exists for the
  // slower, ambiguous case in between.
  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), ms)),
    ]);
  }
  // Once a uid has been confirmed approved while genuinely online, that
  // fact is cached locally so a later offline launch can trust it instead
  // of either hanging on a Firestore read that will never resolve, or
  // wrongly bouncing an already-approved user to the "awaiting approval"
  // screen just because the network happened to be down at that moment. A
  // uid that was never successfully verified online stays gated exactly as
  // before -- this only ever widens what a PREVIOUSLY-confirmed user can do
  // offline, never what a never-verified one can.
  const APPROVED_CACHE_KEY = "wird-approved-uids-v1";
  function loadApprovedCache() {
    try { return JSON.parse(localStorage.getItem(APPROVED_CACHE_KEY) || "{}"); } catch (e) { return {}; }
  }
  function cacheApproved(uid) {
    try {
      const c = loadApprovedCache();
      c[uid] = true;
      localStorage.setItem(APPROVED_CACHE_KEY, JSON.stringify(c));
    } catch (e) { /* storage full/unavailable -- offline fallback just won't have this uid cached */ }
  }
  // The owner's account is always auto-approved (and self-heals if the
  // Firestore flag is ever accidentally left off) — everyone else who signs
  // in starts as "pending" until approved manually via the Firebase Console:
  // Firestore -> apps/wird/users/{uid} -> set approved: true.
  const OWNER_EMAIL = "omarumarov1@gmail.com";

  const gateEl = document.getElementById("authGate");
  const appRootEl = document.getElementById("app");
  const accountBtn = document.getElementById("accountToggle");
  const accountModal = document.getElementById("accountModal");
  const pendingEl = document.getElementById("pendingGate");
  const pendingEmailEl = document.getElementById("pendingEmail");
  const pendingSignOutBtn = document.getElementById("pendingSignOutBtn");
  const loadingEl = document.getElementById("appLoading");

  function hideLoading() {
    if (loadingEl) loadingEl.classList.add("hidden");
  }

  function showPending(user) {
    if (!pendingEl) return;
    if (pendingEmailEl) pendingEmailEl.textContent = user.email || user.displayName || "";
    pendingEl.classList.remove("hidden");
  }
  function hidePending() {
    if (pendingEl) pendingEl.classList.add("hidden");
  }

  function revealApp() {
    gateEl.classList.add("hidden");
    appRootEl.classList.remove("hidden");
  }

  function startApp() {
    if (window.__appStarted) return;
    window.__appStarted = true;
    window.__appReady && window.__appReady();
  }

  function localOnlyMode() {
    hideLoading();
    revealApp();
    if (accountBtn) accountBtn.classList.add("hidden");
    startApp();
  }

  const cfg = window.FIREBASE_CONFIG;
  const isConfigured = !!(cfg && cfg.apiKey && cfg.apiKey.indexOf("REPLACE_ME") === -1);
  if (!isConfigured) { localOnlyMode(); return; }

  (async () => {
    let firebaseApp, authApi, fsApi;
    try {
      const [{ initializeApp }, authNs, fsNs] = await withTimeout(Promise.all([
        import(SDK + "firebase-app.js"),
        import(SDK + "firebase-auth.js"),
        import(SDK + "firebase-firestore.js"),
      ]), 6000);
      authApi = authNs;
      fsApi = fsNs;
      firebaseApp = initializeApp(cfg);
    } catch (err) {
      console.warn("Firebase unavailable — continuing in local-only mode.", err);
      localOnlyMode();
      return;
    }

    const {
      getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
      createUserWithEmailAndPassword, signInWithEmailAndPassword,
      sendPasswordResetEmail, signOut, setPersistence, browserLocalPersistence,
    } = authApi;
    const { getFirestore, doc, getDoc, setDoc, serverTimestamp } = fsApi;

    const auth = getAuth(firebaseApp);
    const db = getFirestore(firebaseApp);
    try { await setPersistence(auth, browserLocalPersistence); } catch (e) { /* fall back to default persistence */ }

    const googleBtn = document.getElementById("authGoogleBtn");
    const form = document.getElementById("authForm");
    const emailInput = document.getElementById("authEmail");
    const passwordInput = document.getElementById("authPassword");
    const submitBtn = document.getElementById("authSubmitBtn");
    const modeToggleBtn = document.getElementById("authModeToggle");
    const forgotLink = document.getElementById("authForgotLink");
    const errorEl = document.getElementById("authError");
    const accountEmailEl = document.getElementById("accountEmail");
    const signOutBtn = document.getElementById("signOutBtn");

    let mode = "signin";
    let pushTimer = null;
    let pendingPushPayload = null;

    function setError(msg) { errorEl.textContent = msg || ""; }

    function setMode(next) {
      mode = next;
      submitBtn.textContent = mode === "signin" ? "Sign in" : "Create account";
      modeToggleBtn.textContent = mode === "signin"
        ? "New here? Create an account"
        : "Already have an account? Sign in";
      setError("");
    }

    function friendlyError(err) {
      const map = {
        "auth/invalid-email": "That email address doesn't look right.",
        "auth/user-not-found": "No account found with that email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/email-already-in-use": "An account already exists with that email — try signing in instead.",
        "auth/weak-password": "Password should be at least 6 characters.",
        "auth/popup-closed-by-user": "Sign-in window closed before completing.",
        "auth/network-request-failed": "Network error — check your connection and try again.",
      };
      return (err && map[err.code]) || (err && err.message) || "Something went wrong. Please try again.";
    }

    googleBtn.addEventListener("click", async () => {
      setError("");
      try { await signInWithPopup(auth, new GoogleAuthProvider()); }
      catch (err) { setError(friendlyError(err)); }
    });

    form.addEventListener("submit", async e => {
      e.preventDefault();
      setError("");
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) { setError("Enter an email and password."); return; }
      submitBtn.disabled = true;
      try {
        if (mode === "signin") await signInWithEmailAndPassword(auth, email, password);
        else await createUserWithEmailAndPassword(auth, email, password);
      } catch (err) {
        setError(friendlyError(err));
      } finally {
        submitBtn.disabled = false;
      }
    });

    modeToggleBtn.addEventListener("click", () => setMode(mode === "signin" ? "signup" : "signin"));

    forgotLink.addEventListener("click", async e => {
      e.preventDefault();
      const email = emailInput.value.trim();
      if (!email) { setError('Enter your email above first, then click "Forgot password?".'); return; }
      try {
        await sendPasswordResetEmail(auth, email);
        setError("Password reset email sent — check your inbox.");
      } catch (err) {
        setError(friendlyError(err));
      }
    });

    if (accountBtn) {
      accountBtn.addEventListener("click", () => {
        accountModal.classList.remove("hidden");
        // Shows the REAL last-write outcome, independent of whatever the
        // Sync now button's status text last said -- normal background
        // saves (completing a review) happen silently, and this is the
        // only place their actual success/failure is visible at all.
        const syncDiagEl = document.getElementById("lastSyncDiagnostic");
        if (syncDiagEl && window.CloudSync) {
          if (window.CloudSync.lastPushError) {
            syncDiagEl.textContent = `Last cloud save FAILED: ${window.CloudSync.lastPushError}`;
          } else if (window.CloudSync.lastPushAt) {
            const secs = Math.round((Date.now() - window.CloudSync.lastPushAt) / 1000);
            const ago = secs < 60 ? `${secs}s ago` : `${Math.round(secs / 60)}m ago`;
            syncDiagEl.textContent = `Last cloud save: successful, ${ago}.`;
          } else {
            syncDiagEl.textContent = "No cloud save has happened yet this session.";
          }
        }
      });
      document.getElementById("accountClose").addEventListener("click", () => accountModal.classList.add("hidden"));
      accountModal.addEventListener("click", e => { if (e.target === accountModal) accountModal.classList.add("hidden"); });
      signOutBtn.addEventListener("click", () => signOut(auth));
    }
    if (pendingSignOutBtn) {
      pendingSignOutBtn.addEventListener("click", () => signOut(auth));
    }

    window.CloudSync = {
      appId: APP_ID,
      user: null,
      lastPushError: null,
      lastPushAt: null,
      async pullProgress() {
        if (!this.user) return null;
        // Timeout-guarded for the same reason the approval check below is:
        // a getDoc() against an unreachable network with no persistence
        // cache can hang indefinitely instead of rejecting, which without
        // this would leave boot() (and the "Sync now" button) stuck
        // forever instead of falling back to local progress or surfacing
        // an error.
        const snap = await withTimeout(getDoc(doc(db, "apps", APP_ID, "users", this.user.uid)), 8000);
        if (!snap.exists()) return null;
        const data = snap.data();
        if (!data.progressJson) return null;
        try { return JSON.parse(data.progressJson); } catch (e) { return null; }
      },
      pushProgress(payload) {
        if (!this.user) return;
        pendingPushPayload = payload;
        clearTimeout(pushTimer);
        pushTimer = setTimeout(() => this.flushPush(), 800);
      },
      // The actual Firestore write, shared by the fire-and-forget debounced
      // path and the awaited manual path below.
      _writeToCloud(payload) {
        return setDoc(doc(db, "apps", APP_ID, "users", this.user.uid), {
          email: this.user.email || null,
          displayName: this.user.displayName || null,
          progressJson: JSON.stringify(payload),
          updatedAt: serverTimestamp(),
          // Flat fields (not buried in progressJson) so the Firestore
          // console's table view is scannable/sortable without opening
          // every document.
          versesMemorized: Object.keys(payload.cards || {}).length,
          streak: (payload.stats && payload.stats.streak) || 0,
          lastActiveDate: (payload.stats && payload.stats.lastStudyDate) || null,
        }, { merge: true }).then(() => {
          this.lastPushError = null;
          this.lastPushAt = Date.now();
        }).catch(err => {
          // Genuinely silent before -- the old comment here said "next
          // save will retry," which was simply false: nothing retried
          // unless the user happened to make more progress later. Now the
          // real reason is at least inspectable (Account modal), plus one
          // automatic retry for the common case of a brief network blip.
          this.lastPushError = (err && (err.code || err.message)) || "unknown error";
          console.warn("Wird cloud push failed:", err);
          throw err;
        });
      },
      // Writes whatever's pending right now, bypassing the debounce delay.
      // Called on the normal 800ms timer, and also on visibilitychange /
      // pagehide -- otherwise a tab closed or backgrounded within that
      // window loses the write entirely, which is exactly the kind of
      // silent gap that can make progress made on one device never
      // actually reach the cloud for another device to pull. Fire-and-
      // forget by design, with one automatic retry for a brief network blip.
      flushPush(isRetry) {
        clearTimeout(pushTimer);
        const payload = pendingPushPayload;
        pendingPushPayload = null;
        if (!payload || !this.user) return;
        this._writeToCloud(payload).catch(() => {
          if (!isRetry) {
            setTimeout(() => {
              if (pendingPushPayload === null) {
                pendingPushPayload = payload;
                this.flushPush(true);
              }
            }, 5000);
          }
        });
      },
      // Awaited variant for callers that need to know the real outcome
      // (the manual "Sync now" button) rather than just having a write
      // queued.
      async pushProgressNow(payload) {
        if (!this.user) throw new Error("not signed in");
        clearTimeout(pushTimer);
        pendingPushPayload = null;
        await this._writeToCloud(payload);
      },
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") window.CloudSync.flushPush();
    });
    window.addEventListener("pagehide", () => window.CloudSync.flushPush());

    let authEventToken = 0;
    onAuthStateChanged(auth, async user => {
      const myAuthToken = ++authEventToken;
      window.CloudSync.user = user;
      if (user) {
        const ref = doc(db, "apps", APP_ID, "users", user.uid);
        const isOwner = !!(user.email && user.email.toLowerCase() === OWNER_EMAIL);
        window.CloudSync.isOwner = isOwner;
        let approved = isOwner;
        try {
          // Timeout-guarded: a returning user with a cached Auth session
          // but no real network shouldn't sit on the loading screen
          // waiting for a Firestore read that's never going to resolve.
          const existing = await withTimeout(getDoc(ref), 5000);
          const patch = {
            email: user.email || null,
            displayName: user.displayName || null,
            lastSeen: serverTimestamp(),
          };
          if (!existing.exists()) {
            patch.createdAt = serverTimestamp();
            patch.approved = isOwner; // owner auto-approved; everyone else starts pending
          } else if (isOwner && existing.data().approved !== true) {
            patch.approved = true; // never let the owner get locked out
          }
          // Fire-and-forget: this is a profile "touch", nothing downstream
          // depends on it finishing, so it shouldn't be able to hang the
          // gate either.
          setDoc(ref, patch, { merge: true }).catch(() => { /* offline — profile touch skipped */ });
          approved = isOwner || (existing.exists() ? existing.data().approved === true : isOwner);
        } catch (e) {
          // Offline, or the read timed out -- fall back to the last time
          // this exact uid was confirmed approved while online, rather
          // than either hanging here or bouncing an already-approved user
          // to the pending screen just because the network is down right
          // now. A uid that was never successfully verified stays gated,
          // same as always.
          approved = isOwner || loadApprovedCache()[user.uid] === true;
        }
        // A newer auth event (e.g. the user hit Sign Out right after
        // signing in, before the getDoc above resolved) may have already
        // landed and put the UI in its own correct state -- if so, this
        // stale callback must not reveal/hide the app based on a user who
        // may no longer even be signed in.
        if (myAuthToken !== authEventToken) return;
        if (approved) cacheApproved(user.uid);

        if (!approved) {
          hideLoading();
          gateEl.classList.add("hidden");
          appRootEl.classList.add("hidden");
          showPending(user);
          return;
        }
        hidePending();

        hideLoading();
        revealApp();
        if (accountBtn) {
          accountBtn.classList.remove("hidden");
          accountEmailEl.textContent = user.email || user.displayName || "Signed in";
        }
        startApp();
      } else {
        window.CloudSync.isOwner = false;
        window.__appStarted = false;
        hidePending();
        hideLoading();
        gateEl.classList.remove("hidden");
        appRootEl.classList.add("hidden");
        if (accountBtn) accountBtn.classList.add("hidden");
        if (accountModal) accountModal.classList.add("hidden");
      }
    });
  })();
})();
