(() => {
  "use strict";

  const API = "https://api.alquran.cloud/v1";
  const TEXT_EDITION = "ar.uthmani";
  const TRANSLATION_EDITION = "en.sahih";

  // Per-ayah audio, computed from surah+ayah directly rather than fetched/
  // stored -- everyayah.com hosts every reciter below under the same
  // {surah:03d}{ayah:03d}.mp3 naming, verified live (distinct file sizes/
  // MD5s per reciter, confirmed not aliased to the same recording) before
  // wiring this up. Folder names confirmed against two independent sources
  // (everyayah.com's own directory listing, and mp3quran.net's official
  // reciter API labeling "Ghamadi" as reciter #30 "Saad Al-Ghamdi") --
  // not guessed from memory, since getting a reciter's identity wrong on
  // this kind of app would be a real quality problem.
  const RECITERS = {
    alafasy: { name: "Mishary Alafasy", folder: "Alafasy_128kbps" },
    ghamdi: { name: "Saad Al-Ghamdi", folder: "Ghamadi_40kbps" },
  };
  const RECITER_KEY = "wird-reciter-v1";

  // A small shared icon set (currentColor throughout, so each one just
  // inherits whatever color its container already sets) used in place of
  // emoji/glyph characters across the app -- those render inconsistently
  // across platforms and fonts, these don't.
  const ICON_PLAY = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>`;
  const ICON_PAUSE = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="4.5" width="4.5" height="15" rx="1" fill="currentColor"/><rect x="13.5" y="4.5" width="4.5" height="15" rx="1" fill="currentColor"/></svg>`;
  const ICON_SUN = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const ICON_MOON = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  const ICON_SPEAKER_ON = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 9a3.5 3.5 0 010 6M19 6.5a7 7 0 010 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const ICON_SPEAKER_MUTED = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const ICON_CHECK = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.3 4.3L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_SEARCH = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-4.5-4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const ICON_TRASH = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0v12a1 1 0 001 1h6a1 1 0 001-1V7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 3.5v11m0 0l-4.5-4.5M12 14.5L16.5 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 17.5v2a1 1 0 001 1h12a1 1 0 001-1v-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const ICON_MIC = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21m-3.5 0h7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const ICON_PREV = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_NEXT = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_RETRY = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M18 4v3.5h-3.5M6 20v-3.5h3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_ACCOUNT = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const ICON_SETTINGS = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3.5v2.3m0 12.4v2.3M20.5 12h-2.3M5.8 12H3.5M17.7 6.3l-1.6 1.6M7.9 16.1l-1.6 1.6M17.7 17.7l-1.6-1.6M7.9 7.9L6.3 6.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const ICON_CLOUD = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M7 18a4 4 0 01-.5-7.97A5 5 0 0116.9 9.1 3.5 3.5 0 0116.5 16H7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  const ICON_BOLT = `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor"/></svg>`;

  // ---------- theme ----------
  // CSS already carries :root[data-theme="dark"/"light"] overrides (used by
  // the system prefers-color-scheme fallback) -- this just adds an explicit
  // manual override on top, same two-theme cycle as the system already
  // supports, persisted so a choice survives reload.
  const THEME_KEY = "wird-theme";
  function currentEffectiveTheme() {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark" || attr === "light") return attr;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function initTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") document.documentElement.setAttribute("data-theme", stored);
    updateThemeToggleIcon();
  }
  function updateThemeToggleIcon() {
    const btn = document.getElementById("themeToggleBtn");
    if (btn) btn.innerHTML = currentEffectiveTheme() === "dark" ? ICON_SUN : ICON_MOON;
  }
  function toggleTheme() {
    const next = currentEffectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* private mode or quota exceeded -- theme still applies for this session */ }
    updateThemeToggleIcon();
  }
  initTheme();

  // The app already has real offline support built (blob caching, retry
  // logic, everything works without a network) -- but nothing ever told
  // the user THAT they were offline, so it was impossible to tell "this is
  // slow" from "this genuinely has no signal" from the UI alone.
  function wireOfflineIndicator() {
    const pill = document.getElementById("offlinePill");
    if (!pill) return;
    const update = () => pill.classList.toggle("hidden", navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
  }

  // Pull-to-refresh on the Today/Home screen only -- everywhere else
  // (mid-review, browsing the Library) a stray downward drag re-syncing
  // and re-rendering out from under the user would be actively disruptive,
  // not helpful. Whole-page scroll (no nested scroll container exists in
  // this layout) means "already at the top" is just window.scrollY <= 0.
  // syncFromCloud() already no-ops safely when signed out, so this never
  // needs its own guard for that case -- it just becomes a harmless
  // "nothing to pull" gesture.
  function wirePullToRefresh() {
    const indicator = document.getElementById("pullIndicator");
    if (!indicator) return;
    const THRESHOLD = 68;
    let startY = null, pulling = false, refreshing = false;
    document.addEventListener("touchstart", e => {
      if (activeScreenName !== "home" || window.scrollY > 0 || refreshing) { startY = null; return; }
      startY = e.touches[0].clientY;
      pulling = false;
    }, { passive: true });
    document.addEventListener("touchmove", e => {
      if (startY === null || refreshing) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) { pulling = false; indicator.style.transform = ""; indicator.classList.remove("armed"); return; }
      if (window.scrollY > 0) return; // scrolled away from top mid-gesture -- stop tracking
      pulling = true;
      const dist = Math.min(THRESHOLD * 1.6, dy * 0.5); // resistance, same damping feel as native pull-to-refresh
      indicator.style.transform = `translateY(${dist}px)`;
      indicator.classList.toggle("armed", dist >= THRESHOLD);
    }, { passive: true });
    document.addEventListener("touchend", async () => {
      if (!pulling) { startY = null; return; }
      pulling = false;
      const armed = indicator.classList.contains("armed");
      if (!armed) { indicator.style.transform = ""; startY = null; return; }
      refreshing = true;
      indicator.classList.add("spinning");
      indicator.style.transform = `translateY(${THRESHOLD}px)`;
      try { await syncFromCloud(); } catch (e) { /* offline or signed out -- pull-to-refresh just becomes a no-op */ }
      if (activeScreenName === "home") await renderHome();
      indicator.classList.remove("spinning", "armed");
      indicator.style.transform = "";
      refreshing = false;
      startY = null;
    });
  }

  // ---------- sound effects ----------
  // Same Web Audio approach as Muhkam (this app's sibling): pure generated
  // tones, no audio files. Ported rather than shared since the two apps
  // don't share any code, but the hard-won timing fixes carry over exactly
  // -- ctx.resume() is async, so scheduling a tone before it actually
  // resolves schedules it into a context that isn't running yet and it
  // never plays; iOS also suspends the context again after any idle gap,
  // so every call has to re-check, not just the first one ever made.
  const SOUND_KEY = "wird-sound";
  let soundEnabled = localStorage.getItem(SOUND_KEY) !== "off";
  let audioCtx = null;
  function updateSoundToggleIcon() {
    const btn = document.getElementById("soundToggleBtn");
    if (btn) btn.innerHTML = soundEnabled ? ICON_SPEAKER_ON : ICON_SPEAKER_MUTED;
  }
  function toggleSound() {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off"); } catch (e) { /* private mode or quota exceeded -- setting still applies for this session */ }
    updateSoundToggleIcon();
  }
  function getAudioCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  function withRunningAudioCtx(fn) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().then(() => fn(ctx)).catch(() => {});
    else fn(ctx);
  }
  // Mobile browsers suspend AudioContext until a genuine user gesture
  // unlocks it -- warm it up on the very first tap anywhere so the first
  // real rating isn't the one that gets silently dropped.
  document.addEventListener("pointerdown", getAudioCtx, { once: true, passive: true });
  function playTone(ctx, freq, startOffset, duration, gainPeak) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + startOffset;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }
  function playGoodSound() {
    if (!soundEnabled) return;
    withRunningAudioCtx(ctx => {
      playTone(ctx, 659.25, 0, 0.14, 0.16);
      playTone(ctx, 987.77, 0.08, 0.22, 0.14);
    });
  }
  function playAgainSound() {
    if (!soundEnabled) return;
    withRunningAudioCtx(ctx => {
      playTone(ctx, 207.65, 0, 0.24, 0.13);
      playTone(ctx, 174.61, 0.06, 0.3, 0.11);
    });
  }

  const CARDS_KEY = "wird-cards-v1";
  const SETTINGS_KEY = "wird-settings-v1";
  const STATS_KEY = "wird-stats-v1";
  const ACHIEVEMENTS_KEY = "wird-achievements-v1";

  // Study-mode presets: how many NEW verses get introduced per day, and a
  // matched review cap so due-reviews don't bottleneck behind a fixed
  // ceiling while new intake scales up -- unlimited new cards with a
  // small review cap would just build an uncleared backlog.
  const STUDY_MODES = {
    basic: { label: "Basic", newPerDay: 5, reviewCap: 20, blurb: "5 new verses a day — a steady, unhurried pace." },
    dedicated: { label: "Dedicated", newPerDay: 10, reviewCap: 40, blurb: "10 new verses a day — for consistent, focused progress." },
    ultimate: { label: "Ultimate", newPerDay: Infinity, reviewCap: Infinity, blurb: "No daily cap — take on as much as you can genuinely commit to reviewing." },
  };
  const DEFAULT_STUDY_MODE = "basic";
  const SURAH_CACHE_KEY = "wird-surah-cache-v1";
  const WORDS_API = "https://api.quran.com/api/v4";
  const WORDS_CACHE_KEY = "wird-words-cache-v1";
  // Real per-word timing, only available for reciter id 7 (Alafasy) via
  // quran.com's own segments endpoint -- verified live (format:
  // [wordPosition, startMs, endMs], absolute within the full chapter
  // file). Ghamdi has no equivalent data anywhere I could verify, so
  // highlighting is honestly Alafasy-only rather than faked.
  const SEGMENTS_RECITER_ID = 7;
  const SEGMENTS_CACHE_KEY = "wird-segments-cache-v1";
  const MURAJA_KEY = "wird-muraja-v1";

  // Sard fluency ratings and how each one reshapes that surah's next
  // rotation cycle -- self-adjusting, same spirit as the per-verse ease
  // factor but at surah granularity. A real muraja'ah program doesn't wait
  // for individual verses to come due one at a time; it re-visits the
  // WHOLE surah on its own cadence so the connective tissue between
  // verses (not just each verse in isolation) stays fresh.
  const SARD_RATINGS = {
    flawless: { label: "Flawless", sub: "no hesitation", mult: 1.35 },
    minor: { label: "A little rough", sub: "one or two pauses", mult: 1.05 },
    rough: { label: "Several stumbles", sub: "had to think hard", mult: 0.65 },
    lost: { label: "Lost my place", sub: "needs real work", mult: 0.35 },
  };
  const MIN_CYCLE_DAYS = 2;
  const MAX_CYCLE_DAYS = 30;
  const INITIAL_CYCLE_DAYS = 3;

  const JUZ_AMMA_START = 78; // verified live against api.alquran.cloud: surah 77 last ayah = juz 29, surah 78-114 = juz 30
  const JUZ_AMMA_END = 114;

  // ---------- vocabulary bank ----------
  // data/vocab-bank.json is a one-time offline computation over the ENTIRE
  // Qur'an's real word-by-word data (api.quran.com), not invented or
  // scraped from an unverifiable third party -- every entry's frequency
  // count, translations, and occurrences trace back to actual text.
  // Categories were derived by exact-word matching against the real
  // (Saheeh International) translation text, not asserted Arabic semantic
  // knowledge. See scratchpad/build_vocab_bank.py and
  // build_vocab_categories.py for the full derivation + the collision bug
  // (alif-folding merging unrelated words) caught and fixed before shipping.
  const VOCAB_BANK_PATH = "data/vocab-bank.json";
  const VOCAB_CARDS_KEY = "wird-vocab-cards-v1";
  const VOCAB_TIERS = [
    { id: "top100", label: "Top 100", from: 1, to: 100, blurb: "The most frequent words in the Qur'an — this alone covers roughly half of its running text." },
    { id: "top300", label: "101–300", from: 101, to: 300, blurb: "The next tier of high-frequency words." },
    { id: "top1000", label: "301–1000", from: 301, to: 1000, blurb: "Solid intermediate vocabulary." },
    { id: "top3000", label: "1001–3000", from: 1001, to: 3000, blurb: "Broader working vocabulary." },
    { id: "rest", label: "3001+", from: 3001, to: Infinity, blurb: "Everything else — rarer words, right down to those appearing only once." },
  ];
  let vocabBank = [];       // [{id, ar, tr, en:[...], n, rk, occ:[[surah,ayah],...], au, cat:[...]}]
  let vocabById = {};       // id -> entry, built once vocabBank loads
  let vocabCards = {};      // id -> {interval, ease, reps, dueDate, addedDate, struggleCount}

  const screenEl = document.getElementById("screen");
  const topnavEl = document.getElementById("topnav");

  // Voice Mirror needs real device APIs that not every browser has (older
  // Safari in particular has patchy MediaRecorder support) -- checked once
  // at load so the mic button simply never appears anywhere it wouldn't
  // work, rather than appearing and failing.
  const VOICE_MIRROR_SUPPORTED = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

  let surahList = [];       // [{number, name, englishName, englishNameTranslation, numberOfAyahs, revelationType}]
  let cards = {};           // "surah:ayah" -> card object
  let settings = { mode: DEFAULT_STUDY_MODE };
  function currentModeConfig() { return STUDY_MODES[settings.mode] || STUDY_MODES[DEFAULT_STUDY_MODE]; }
  let stats = { streak: 0, lastStudyDate: null, totalReviews: 0, longestStreak: 0, dailyLog: {} };
  let achievements = { completedSurahs: [], completedJuz: [] }; // numbers, each recorded once, the moment every ayah the user added for that surah/juz is mature
  let surahCache = {};      // "surahNum" -> {ar: [...], en: [...], audio: [...]}
  let wordsCache = {};      // "surah:ayah" -> [{ar, tr, en}, ...] (word-by-word, quran.com)
  let segmentsCache = {};   // "surahNum" -> { ayahNum: [[wordPos, startMsRelative, endMsRelative], ...] }
  let muraja = {};          // "surahNum" -> {lastFullReviewDate, cycleDays, lastRating}
  let currentReciter = localStorage.getItem(RECITER_KEY) || "alafasy";

  function pad3(n) { return String(n).padStart(3, "0"); }
  function audioUrlForReciter(reciterId, surah, ayah) {
    const folder = (RECITERS[reciterId] || RECITERS.alafasy).folder;
    return `https://everyayah.com/data/${folder}/${pad3(surah)}${pad3(ayah)}.mp3`;
  }
  function audioUrlFor(surah, ayah) {
    return audioUrlForReciter(currentReciter, surah, ayah);
  }
  function setReciter(id) {
    if (!RECITERS[id]) return;
    currentReciter = id;
    try { localStorage.setItem(RECITER_KEY, id); } catch (e) { /* private mode or quota exceeded -- setting still applies for this session */ }
    pushToCloud();
  }

  let activeScreenName = "home"; // boot() renders Home directly rather than through switchScreen(), so this has to start pre-set to match
  let session = null;       // { queue: [card,...], idx, total, revealed, currentMode }
  let currentReviewCard = null; // whatever verse card is on screen right now, for Voice Mirror
  let currentAudio = null;
  let sardSession = null;   // { surah, verses: [card,...], idx, stumbles: Set, playing }
  let vocabSession = null;  // { queue: [vocabCard,...], idx, total }

  // ---------- persistence ----------
  function load(key, fallback) {
    try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw); } catch (e) {}
    return fallback;
  }
  // Unguarded localStorage.setItem throws in two real, non-rare situations:
  // Safari private browsing (throws on EVERY setItem call, by design) and a
  // genuinely full quota (QuotaExceededError -- more likely now that the
  // Downloads screen can put real pressure on device storage). Every
  // caller here (saveCards/saveSettings/saveStats/etc.) runs inline in
  // click handlers with no try/catch of their own, so an uncaught throw
  // here would silently abort whatever the user just did partway through
  // -- swallowing it, same as load() already does above, means a save
  // that can't persist just doesn't persist instead of breaking the
  // interaction that triggered it.
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* private mode or quota exceeded -- nothing more to do here */ }
  }
  function loadAll() {
    cards = load(CARDS_KEY, {});
    settings = Object.assign({ mode: DEFAULT_STUDY_MODE }, load(SETTINGS_KEY, {}));
    if (!STUDY_MODES[settings.mode]) settings.mode = DEFAULT_STUDY_MODE;
    stats = Object.assign({ streak: 0, lastStudyDate: null, totalReviews: 0, longestStreak: 0, dailyLog: {} }, load(STATS_KEY, {}));
    surahCache = load(SURAH_CACHE_KEY, {});
    wordsCache = load(WORDS_CACHE_KEY, {});
    segmentsCache = load(SEGMENTS_CACHE_KEY, {});
    muraja = load(MURAJA_KEY, {});
    vocabCards = load(VOCAB_CARDS_KEY, {});
    achievements = Object.assign({ completedSurahs: [], completedJuz: [] }, load(ACHIEVEMENTS_KEY, {}));
  }
  function saveCards() { save(CARDS_KEY, cards); pushToCloud(); }
  function saveSettings() { save(SETTINGS_KEY, settings); pushToCloud(); }
  function saveStats() { save(STATS_KEY, stats); pushToCloud(); }
  function saveAchievements() { save(ACHIEVEMENTS_KEY, achievements); pushToCloud(); }
  function saveSurahCache() { save(SURAH_CACHE_KEY, surahCache); }
  function saveWordsCache() { save(WORDS_CACHE_KEY, wordsCache); }
  function saveSegmentsCache() { save(SEGMENTS_CACHE_KEY, segmentsCache); }
  function saveVocabCards() { save(VOCAB_CARDS_KEY, vocabCards); pushToCloud(); }
  function saveMuraja() { save(MURAJA_KEY, muraja); pushToCloud(); }

  // ---------- date helpers ----------
  // Deliberately local calendar date, not UTC: toISOString() reports the
  // UTC date, which silently drifts a day off the user's own "today" for
  // roughly a third of the clock (the hours near their local midnight,
  // wider the further they sit from UTC+0) -- exactly the hours a lot of
  // real study happens (late at night, first thing in the morning). Every
  // dueDate/addedDate/streak comparison in the app is a same-day check, so
  // that drift silently misfires review scheduling and the daily streak.
  function localISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function todayISO() { return localISO(new Date()); }
  function addDaysISO(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return localISO(d);
  }

  // ---------- arabic text helpers ----------
  function normalizeArabic(text) {
    // Numeric \uXXXX escapes (verified against the real Unicode Arabic
    // block, not typed glyphs) so nothing here depends on a character
    // rendering correctly to be verifiable.
    return text
      .replace(/[\u064B-\u0652\u0670\u06D6-\u06ED\u08F0-\u08FF]/g, "") // harakat, dagger alif, waqf marks, extended diacritics
      .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627") // alif variants -> bare alif
      .replace(/\u0629/g, "\u0647") // ta marbuta -> ha
      .replace(/\u0649/g, "\u064A") // alif maksura -> ya
      .replace(/\s+/g, " ")
      .trim();
  }

  function wordsOf(text) {
    return normalizeArabic(text).split(" ").filter(w => w.length > 1);
  }
  function wordOverlapRatio(a, b) {
    const wa = wordsOf(a), wb = wordsOf(b);
    if (!wa.length || !wb.length) return { ratio: 0, count: 0 };
    const setB = new Set(wb);
    let inter = 0;
    wa.forEach(w => { if (setB.has(w)) inter++; });
    return { ratio: inter / Math.min(wa.length, wb.length), count: inter };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function sample(arr, n) { return shuffled(arr).slice(0, n); }
  // Plain random sampling across the whole 15,420-word bank let a target
  // like "من" (a one-word "from") land next to distractors like "they
  // will steal" or "And We drowned" -- full-phrase translations of much
  // rarer words. The correct answer became guessable purely by being the
  // shortest option, with zero actual vocabulary recall involved. Biasing
  // toward distractors whose translation is a comparable number of words
  // keeps the choice about meaning, not phrase length; falls back to the
  // unrestricted pool if the bank doesn't have enough close matches so a
  // rare/unusually-worded entry never comes up short on distractors.
  function vocabWordCount(w) { return ((w.en && w.en[0]) || "").split(/\s+/).filter(Boolean).length || 1; }
  function sampleVocabDistractors(target, n) {
    const pool = vocabBank.filter(w => w.id !== target.id);
    const targetWc = vocabWordCount(target);
    const close = pool.filter(w => Math.abs(vocabWordCount(w) - targetWc) <= 1);
    return sample(close.length >= n ? close : pool, n);
  }

  // ---------- API ----------
  // Retries transient failures (a dropped request, a slow DNS lookup) up to
  // twice more, same RETRY_DELAYS backoff already used for audio playback
  // in playAudio(). Previously a single fetch() with no retry at all --
  // callers like ensureSegmentsLoaded()/ensureWordsLoaded() already treat
  // any failure as "silently degrade, no timing data" (by design, for a
  // genuinely offline or unsupported case), but that same silent-degrade
  // was also swallowing ordinary one-off network blips, which is why the
  // per-word karaoke highlight during recitation would sometimes just
  // never show up for no visible reason -- the audio itself has its own
  // retry logic and kept playing fine, so nothing looked broken.
  async function fetchJson(url) {
    const RETRY_DELAYS = [500, 1500];
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Fetch failed: " + url);
        return await res.json();
      } catch (e) {
        if (attempt >= RETRY_DELAYS.length) throw e;
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }

  async function ensureSurahList() {
    if (surahList.length) return surahList;
    const cached = load("wird-surah-list-v1", null);
    if (cached && cached.length === 114) { surahList = cached; return surahList; }
    const data = await fetchJson(`${API}/surah`);
    surahList = data.data;
    save("wird-surah-list-v1", surahList);
    return surahList;
  }

  async function ensureSurahLoaded(surahNum) {
    const key = String(surahNum);
    if (surahCache[key]) return surahCache[key];
    const [arRes, enRes] = await Promise.all([
      fetchJson(`${API}/surah/${surahNum}/${TEXT_EDITION}`),
      fetchJson(`${API}/surah/${surahNum}/${TRANSLATION_EDITION}`),
    ]);
    const arAyahs = arRes.data.ayahs;
    const enAyahs = enRes.data.ayahs;
    const entry = {
      englishName: arRes.data.englishName,
      englishNameTranslation: arRes.data.englishNameTranslation,
      ayahs: arAyahs.map((a, i) => ({
        numberInSurah: a.numberInSurah,
        text: a.text.trim(),
        translation: (enAyahs[i] && enAyahs[i].text) || "",
        page: a.page,
        juz: a.juz,
      })),
    };
    surahCache[key] = entry;
    saveSurahCache();
    return entry;
  }

  function cardKey(surah, ayah) { return `${surah}:${ayah}`; }

  // ---------- word-by-word (transliteration on hover/tap) ----------
  // Fetched from quran.com's own word-by-word API (real Uthmani per-word
  // text + transliteration + translation, verified live) rather than
  // guessed -- getting a word's transliteration wrong on this kind of app
  // is the same class of risk as everything else here.
  const wordsInFlight = {};
  async function ensureWordsLoaded(surahNum) {
    const key = String(surahNum);
    if (wordsCache[key]) return wordsCache[key];
    if (wordsInFlight[key]) return wordsInFlight[key];
    wordsInFlight[key] = (async () => {
      try {
        const data = await fetchJson(`${WORDS_API}/verses/by_chapter/${surahNum}?words=true&word_fields=text_uthmani,transliteration,translation&per_page=300`);
        const byAyah = {};
        (data.verses || []).forEach(v => {
          const ayahNum = Number(v.verse_key.split(":")[1]);
          byAyah[ayahNum] = (v.words || [])
            .filter(w => w.char_type_name === "word")
            .map(w => ({
              ar: w.text_uthmani || w.text || "",
              tr: (w.transliteration && w.transliteration.text) || "",
              en: (w.translation && w.translation.text) || "",
            }));
        });
        wordsCache[key] = byAyah;
        saveWordsCache();
        return byAyah;
      } catch (e) {
        return null; // silent -- falls back to plain (non-tappable) text
      } finally {
        delete wordsInFlight[key];
      }
    })();
    return wordsInFlight[key];
  }

  const segmentsInFlight = {};
  async function ensureSegmentsLoaded(surahNum) {
    if (currentReciter !== "alafasy") return null; // no verified timing source for other reciters
    const key = String(surahNum);
    if (segmentsCache[key]) return segmentsCache[key];
    if (segmentsInFlight[key]) return segmentsInFlight[key];
    segmentsInFlight[key] = (async () => {
      try {
        const data = await fetchJson(`${WORDS_API}/chapter_recitations/${SEGMENTS_RECITER_ID}/${surahNum}?segments=true`);
        const byAyah = {};
        ((data.audio_file && data.audio_file.timestamps) || []).forEach(t => {
          const ayahNum = Number(t.verse_key.split(":")[1]);
          const from = t.timestamp_from || 0;
          // Segments are absolute within the full chapter file; rebase to
          // ayah-relative so they line up with this app's per-ayah audio
          // files (everyayah.com), not the single giant chapter file the
          // API itself points to. Clamp negatives -- real-world boundary
          // rounding between verses can put a segment start a few ms
          // before its verse's own timestamp_from.
          byAyah[ayahNum] = (t.segments || []).map(([pos, start, end]) => [pos, Math.max(0, start - from), Math.max(0, end - from)]);
        });
        segmentsCache[key] = byAyah;
        saveSegmentsCache();
        return byAyah;
      } catch (e) {
        return null; // silent -- falls back to plain (non-highlighted) playback
      } finally {
        delete segmentsInFlight[key];
      }
    })();
    return segmentsInFlight[key];
  }

  function arabicHtmlRaw(surah, ayah, fallbackText) {
    const bySurah = wordsCache[String(surah)];
    const words = bySurah && bySurah[ayah];
    if (!words || !words.length) return escapeHtml(fallbackText);
    // data-pos (1-indexed) lines up with real-time word highlighting during
    // playback -- both this list and the timing segments come from the
    // same quran.com per-ayah word ordering (real recited words only,
    // excluding the ayah-number mushaf ornament), so position N here is
    // position N in the segment data.
    return words.map((w, i) =>
      `<span class="word-tap" data-pos="${i + 1}" data-tr="${escapeHtml(w.tr)}" data-en="${escapeHtml(w.en)}">${escapeHtml(w.ar)}</span>`
    ).join(" ");
  }
  function arabicHtmlFor(card) { return arabicHtmlRaw(card.surah, card.ayah, card.text); }

  // Single shared tooltip element, positioned near whichever word was
  // hovered (desktop) or tapped (mobile) -- one mechanism for both, rather
  // than a CSS-only :hover tooltip that wouldn't work on touch at all.
  let wordTooltipEl = null;
  let wordTooltipForEl = null; // which .word-tap the tooltip currently belongs to, for tap-to-toggle
  function ensureWordTooltipEl() {
    if (wordTooltipEl) return wordTooltipEl;
    wordTooltipEl = document.createElement("div");
    wordTooltipEl.className = "word-tooltip";
    document.body.appendChild(wordTooltipEl);
    return wordTooltipEl;
  }
  function showWordTooltip(target) {
    const tr = target.dataset.tr, en = target.dataset.en;
    if (!tr && !en) return;
    const el = ensureWordTooltipEl();
    el.innerHTML = `<span class="wt-tr">${escapeHtml(tr)}</span>${en ? `<span class="wt-en">${escapeHtml(en)}</span>` : ""}`;
    el.classList.add("visible");
    const rect = target.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - elRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - elRect.width - 8));
    const top = rect.top - elRect.height - 10;
    el.style.left = `${left + window.scrollX}px`;
    el.style.top = `${(top < 0 ? rect.bottom + 10 : top) + window.scrollY}px`;
  }
  function hideWordTooltip() {
    if (wordTooltipEl) wordTooltipEl.classList.remove("visible");
    wordTooltipForEl = null;
  }
  function wireWordTooltips(container) {
    if (!container) return;
    container.querySelectorAll(".word-tap").forEach(el => {
      el.addEventListener("mouseenter", () => showWordTooltip(el));
      el.addEventListener("mouseleave", hideWordTooltip);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const isSame = wordTooltipForEl === el && wordTooltipEl && wordTooltipEl.classList.contains("visible");
        hideWordTooltip();
        if (!isSame) { showWordTooltip(el); wordTooltipForEl = el; }
      });
    });
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".word-tap")) hideWordTooltip();
  });

  // ---------- SRS ----------
  // Three-phase engine (verse cards and vocab cards both run through this
  // same code, since a "verse" and a "word" are just two card shapes with
  // identical scheduling needs):
  //   1. learning  -- must string together 7 CONSECUTIVE successful
  //      encounters on a short, growing ladder. Any "again" restarts the
  //      ladder from the top -- true mastery means 7 in a row, not 7
  //      total exposures with lapses forgiven.
  //   2. reviewing -- once learning graduates, 2 more consecutive
  //      successes at longer intervals confirm the material actually
  //      survived real time, not just short-term learning-phase memory.
  //   3. mature -- graduated fully; normal ease-factor-driven SM-2 growth
  //      takes over indefinitely. A lapse here demotes back into
  //      "reviewing" (not all the way to "learning") since forgetting a
  //      long-held item is a weaker signal than forgetting a new one.
  // Both ladders are day-based (this app's natural grain -- reviews
  // happen once daily), Fibonacci-ish so early gaps are short (fast
  // exposure) and later gaps widen (efficient -- no rote back-to-back
  // repeats once a step has already stuck).
  const LEARNING_GAPS = [0, 1, 1, 2, 3, 5]; // gap in days *after* each of the first 6 learning successes, before the next
  const REVIEWING_GAPS = [14, 30]; // gap before the 1st, then the 2nd, reviewing-phase confirmation
  const LEARNING_ENCOUNTERS = LEARNING_GAPS.length + 1; // 7
  const REVIEWING_ENCOUNTERS = REVIEWING_GAPS.length; // 2

  // Old cards (pre-dating this phase model) only have interval/reps/ease.
  // Infer a reasonable phase/step from where they already stood, rather
  // than unfairly resetting real progress back to the start of a new
  // 7-step ladder. Idempotent -- a no-op once a card carries `phase`.
  function ensurePhaseFields(card) {
    if (card.phase) return card;
    if (!card.reps) {
      card.phase = "learning"; card.learningStep = 0; card.reviewStep = 0;
    } else if (card.interval >= 21) {
      card.phase = "mature"; card.learningStep = LEARNING_ENCOUNTERS; card.reviewStep = REVIEWING_ENCOUNTERS;
    } else if (card.interval >= 7) {
      card.phase = "reviewing"; card.learningStep = LEARNING_ENCOUNTERS; card.reviewStep = 1;
    } else {
      card.phase = "learning";
      card.learningStep = Math.max(0, Math.min(LEARNING_ENCOUNTERS - 1, card.reps));
      card.reviewStep = 0;
    }
    return card;
  }

  function newCard(surah, ayah, ayahData) {
    return {
      surah, ayah,
      text: ayahData.text, translation: ayahData.translation,
      page: ayahData.page, juz: ayahData.juz,
      interval: 0, ease: 2.5, reps: 0,
      phase: "learning", learningStep: 0, reviewStep: 0,
      dueDate: todayISO(),
      addedDate: todayISO(),
    };
  }

  // Vibration API has no iOS Safari support at all (silently a no-op
  // there) and needs a real user gesture on Android -- both cases the
  // try/catch + feature check below already cover, so every call site can
  // just fire-and-forget without its own guard.
  function haptic(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* unsupported or blocked -- silently skip */ }
  }
  function applyRating(card, rating) {
    haptic(rating === "again" ? 35 : 12);
    rating === "again" ? playAgainSound() : playGoodSound();
    ensurePhaseFields(card);
    if (rating === "again") {
      if (card.phase === "learning") card.learningStep = 0;
      else if (card.phase === "reviewing") card.reviewStep = 0;
      else { card.phase = "reviewing"; card.reviewStep = 0; } // mature lapse: reconfirm, don't nuke back to scratch
      // reps deliberately does NOT reset here -- it's a monotonic "has
      // this ever been reviewed" counter (computeQueue's fresh/due split,
      // muraja'ah eligibility, and cloud-merge all key off it), while
      // learningStep/reviewStep above already carry the actual "how far
      // into the current streak" state that a lapse needs to rewind.
      card.interval = 0;
      card.ease = Math.max(1.3, card.ease - 0.2);
      card.dueDate = todayISO();
    } else {
      card.reps = (card.reps || 0) + 1;
      if (card.phase === "learning") {
        card.learningStep++;
        if (card.learningStep >= LEARNING_ENCOUNTERS) {
          card.phase = "reviewing";
          card.reviewStep = 0;
          card.interval = REVIEWING_GAPS[0];
        } else {
          card.interval = LEARNING_GAPS[card.learningStep - 1];
        }
      } else if (card.phase === "reviewing") {
        card.reviewStep++;
        if (card.reviewStep >= REVIEWING_ENCOUNTERS) {
          card.phase = "mature";
          card.interval = Math.round((card.interval || REVIEWING_GAPS[REVIEWING_GAPS.length - 1]) * card.ease);
          if (card.surah !== undefined) checkSurahMastery(card.surah);
          if (card.juz !== undefined) checkJuzMastery(card.juz);
        } else {
          card.interval = REVIEWING_GAPS[card.reviewStep];
        }
      } else {
        card.interval = Math.round(card.interval * card.ease);
      }
      if (rating === "hard") { card.ease = Math.max(1.3, card.ease - 0.15); card.interval = Math.max(1, Math.round(card.interval * 0.8)); }
      if (rating === "easy") { card.ease = card.ease + 0.15; card.interval = Math.round(card.interval * 1.35); }
      card.dueDate = addDaysISO(card.interval);
    }
    if (rating === "again" || rating === "hard") card.struggleCount = (card.struggleCount || 0) + 1;
    stats.totalReviews++;
    logDailyActivity();
    saveStats();
  }

  // Per-day review counts, kept for the last 90 days only -- powers the
  // Progress page's activity heatmap. Pruned on every write so the payload
  // synced to Firestore doesn't grow without bound over months of use.
  function logDailyActivity() {
    stats.dailyLog = stats.dailyLog || {};
    const today = todayISO();
    stats.dailyLog[today] = (stats.dailyLog[today] || 0) + 1;
    const cutoff = addDaysISO(-90);
    Object.keys(stats.dailyLog).forEach(d => { if (d < cutoff) delete stats.dailyLog[d]; });
  }

  // Every "again" rating, and a card's very first learning success
  // (LEARNING_GAPS[0] === 0), sets dueDate to *today* -- meant to be
  // re-encountered in this same sitting, not stranded until the user
  // happens to manually restart a session. session.queue/vocabSession.queue
  // are otherwise frozen at session start (built once by computeQueue()/
  // computeVocabQueue() in startWird()/startVocabReview()), so without this
  // a same-day repeat would just silently vanish -- the session would end
  // and tell the user to "come back tomorrow" while a same-day repeat sat
  // unseen, undermining the whole "encounter N times while learning" model.
  function requeueIfDueToday(sess, card) {
    if (sess && card.dueDate <= todayISO()) {
      sess.queue.push(card);
      sess.total++;
    }
  }

  function masteryStage(card) {
    ensurePhaseFields(card);
    if (card.reps === 0) return "new";
    if (card.phase === "learning") return "learning";
    if (card.phase === "reviewing") return "young";
    return "mature";
  }

  // Fires the moment a card's own graduation to "mature" happens to be the
  // LAST missing piece of its surah -- every ayah the user ever added for
  // that surah, and not just this one, has to be mature too. Checked from
  // real surahList.numberOfAyahs (fetched live from the Qur'an API), so a
  // surah only counts complete when the user has genuinely added and
  // matured every one of its verses, not just however many happen to be
  // in their set.
  function checkSurahMastery(surahNum) {
    if (achievements.completedSurahs.includes(surahNum)) return;
    const meta = surahList.find(s => s.number === surahNum);
    if (!meta) return;
    const surahCards = Object.values(cards).filter(c => c.surah === surahNum);
    if (surahCards.length !== meta.numberOfAyahs) return;
    if (!surahCards.every(c => masteryStage(c) === "mature")) return;
    achievements.completedSurahs.push(surahNum);
    saveAchievements();
    achievementQueue.push({ type: "surah", number: surahNum, name: meta.name, englishName: meta.englishName, count: meta.numberOfAyahs });
    setTimeout(processAchievementQueue, 850);
  }
  // Where each of the 30 juz begins ([surah, ayah]) -- sourced live from
  // api.alquran.cloud's own /meta endpoint (juzs.references), the same API
  // this app already trusts for surah/ayah text, not guessed from memory:
  // getting a juz boundary wrong in a Qur'an app would be a real quality
  // problem, the same standard already applied to the reciter folder names
  // (see the comment above RECITERS).
  const JUZ_START = [
    [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111],
    [7, 88], [8, 41], [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75],
    [21, 1], [23, 1], [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32],
    [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
  ];
  // Total ayahs belonging to juz N -- every ayah from its own start up to
  // (but not including) the next juz's start, computed from surahList's
  // real per-surah ayah counts rather than a second hardcoded table, so it
  // can never drift out of sync with JUZ_START above.
  function juzAyahCount(juzNum) {
    const [startSurah, startAyah] = JUZ_START[juzNum - 1];
    const next = JUZ_START[juzNum]; // undefined for juz 30 -- runs to the Quran's end
    let count = 0;
    let s = startSurah, a = startAyah;
    while (true) {
      if (next && s === next[0] && a >= next[1]) break;
      const meta = surahList.find(m => m.number === s);
      if (!meta) break; // surahList not loaded yet -- caller treats a 0/uncertain count as "not complete"
      if (next && s === next[0]) {
        count += next[1] - a;
        break;
      }
      count += meta.numberOfAyahs - a + 1;
      s++; a = 1;
      if (s > 114) break;
    }
    return count;
  }
  // Same shape as checkSurahMastery(), but for a full juz spanning however
  // many surahs it covers -- a card only counts toward a juz if BOTH its
  // surah and ayah fall within that juz's real boundaries (card.juz, set
  // from the API's own per-ayah juz field when the card was added, is
  // trusted directly rather than recomputed here).
  function checkJuzMastery(juzNum) {
    if (achievements.completedJuz.includes(juzNum)) return;
    const total = juzAyahCount(juzNum);
    if (!total) return;
    const juzCards = Object.values(cards).filter(c => c.juz === juzNum);
    if (juzCards.length !== total) return;
    if (!juzCards.every(c => masteryStage(c) === "mature")) return;
    achievements.completedJuz.push(juzNum);
    saveAchievements();
    achievementQueue.push({ type: "juz", number: juzNum, count: total });
    setTimeout(processAchievementQueue, 850);
  }
  // Cards from several surahs are routinely interleaved in one day's
  // queue, so it's entirely realistic for a second surah to complete
  // just a rating or two after the first. Each completion used to just
  // overwrite the overlay's innerHTML outright -- if a second one landed
  // before the first was dismissed, the FIRST celebration was silently
  // replaced and that achievement was never actually seen. A real queue
  // means every completion gets shown, one at a time, in order.
  let achievementQueue = [];
  let achievementShowing = false;
  function processAchievementQueue() {
    if (achievementShowing || !achievementQueue.length) return;
    const meta = achievementQueue.shift();
    achievementShowing = true;
    showMasteryCelebration(meta, () => {
      achievementShowing = false;
      if (achievementQueue.length) setTimeout(processAchievementQueue, 500);
    });
  }
  // A one-shot canvas burst, not a library -- consistent with the rest of
  // this app's zero-dependency, no-build-step approach (same spirit as the
  // hand-built SVG growth chart on the Progress page). Removes its own
  // canvas once the burst finishes, and does nothing at all under
  // prefers-reduced-motion.
  function fireConfetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = document.createElement("canvas");
    canvas.className = "confetti-canvas";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) { canvas.remove(); return; }
    const colors = ["#a97e1f", "#d4af37", "#0e6d59", "#2ba184", "#9c3b3b"];
    const particles = Array.from({ length: 70 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 140,
      y: canvas.height * 0.32 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 9 - 4,
      size: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.3,
    }));
    const gravity = 0.28;
    const duration = 1700;
    const start = performance.now();
    function frame(now) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      if (elapsed < duration) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  }
  function showMasteryCelebration(meta, onClose) {
    const overlay = document.getElementById("achievementOverlay");
    if (!overlay) { if (onClose) onClose(); return; }
    const isJuz = meta.type === "juz";
    overlay.innerHTML = `
      <div class="achieve-card">
        <div class="achieve-seal">﴾ ﴿</div>
        <div class="achieve-kicker">${isJuz ? "Juz Complete" : "Surah Complete"}</div>
        <div class="achieve-name">${isJuz ? `Juz ${meta.number}` : escapeHtml(meta.name)}</div>
        <div class="achieve-sub">${isJuz ? "" : `${escapeHtml(meta.englishName)} &middot; `}${meta.count} verses, fully matured</div>
        <p class="achieve-note">${isJuz
          ? "An entire juz, cover to cover — every verse has passed its full cure, seven encounters to learn, two more to confirm it held. This one is yours now."
          : "Every verse has passed its full cure — seven encounters to learn, two more to confirm it held. This one is yours now."}</p>
        <button class="primary-btn" id="achieveCloseBtn" style="max-width:240px;margin:18px auto 0">Alhamdulillah</button>
      </div>
    `;
    overlay.classList.add("visible");
    fireConfetti();
    haptic([20, 40, 20, 40, 40]);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      overlay.classList.remove("visible");
      overlay.innerHTML = "";
      if (onClose) onClose();
    };
    document.getElementById("achieveCloseBtn").addEventListener("click", close);
    overlay.addEventListener("click", function backdropClick(e) {
      if (e.target !== overlay) return;
      overlay.removeEventListener("click", backdropClick);
      close();
    });
  }
  // "3/7" while learning, "1/2" while reviewing, or null once mature/new
  // -- surfaced next to the rating row so the encounter-count rule stays
  // visible and legible, not just an invisible internal mechanic.
  function phaseProgressLabel(card) {
    ensurePhaseFields(card);
    if (card.reps === 0) return null;
    if (card.phase === "learning") return `Learning ${card.learningStep}/${LEARNING_ENCOUNTERS}`;
    if (card.phase === "reviewing") return `Reviewing ${card.reviewStep}/${REVIEWING_ENCOUNTERS}`;
    return null;
  }

  // ---------- muraja'ah rotation & sard (whole-surah recitation) ----------
  // Per-verse SM-2 (above) is excellent for individual-ayah retention, but
  // it lets due-dates fragment across a surah -- verse 5 due Tuesday,
  // verse 12 due next month -- which is NOT how real hifz maintenance
  // works. This is a second, independent scheduler at surah granularity:
  // every surah with memorized verses gets its own rotating "full
  // recitation" cycle, self-adjusting from how a real sard actually went,
  // completely separate from any individual card's due date.
  function surahsWithCards() {
    const bySurah = {};
    Object.values(cards).forEach(c => { (bySurah[c.surah] = bySurah[c.surah] || []).push(c); });
    return bySurah;
  }
  function ensureMurajaEntry(surahNum) {
    const key = String(surahNum);
    if (!muraja[key]) {
      muraja[key] = { lastFullReviewDate: null, cycleDays: INITIAL_CYCLE_DAYS, lastRating: null };
    }
    return muraja[key];
  }
  function daysBetween(isoA, isoB) {
    return Math.round((new Date(isoB) - new Date(isoA)) / 86400000);
  }
  function computeMurajaDue() {
    const bySurah = surahsWithCards();
    const today = todayISO();
    const due = [];
    Object.keys(bySurah).forEach(key => {
      const surahCards = bySurah[key];
      // only surahs where every added verse has been through at least one
      // real review are muraja'ah-eligible -- reviewing a surah's sard
      // before you've even learned every added verse once isn't a
      // meaningful test yet.
      if (!surahCards.every(c => c.reps > 0)) return;
      const entry = ensureMurajaEntry(key);
      const overdue = !entry.lastFullReviewDate || daysBetween(entry.lastFullReviewDate, today) >= entry.cycleDays;
      if (overdue) {
        const daysSince = entry.lastFullReviewDate ? daysBetween(entry.lastFullReviewDate, today) : null;
        due.push({ surah: Number(key), verseCount: surahCards.length, daysSince, cycleDays: entry.cycleDays });
      }
    });
    due.sort((a, b) => (b.daysSince || 999) - (a.daysSince || 999));
    return due;
  }
  function applySardRating(surahNum, ratingKey) {
    const entry = ensureMurajaEntry(surahNum);
    const r = SARD_RATINGS[ratingKey];
    const prevCycle = entry.cycleDays;
    entry.cycleDays = Math.max(MIN_CYCLE_DAYS, Math.min(MAX_CYCLE_DAYS, Math.round(prevCycle * r.mult)));
    entry.lastFullReviewDate = todayISO();
    entry.lastRating = ratingKey;
    saveMuraja();
  }

  // ---------- home / today ----------
  function updateStreak() {
    const today = todayISO();
    if (stats.lastStudyDate === today) return;
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yestISO = localISO(yest);
    stats.streak = stats.lastStudyDate === yestISO ? stats.streak + 1 : 1;
    stats.lastStudyDate = today;
    stats.longestStreak = Math.max(stats.longestStreak || 0, stats.streak);
    saveStats();
  }

  function computeQueue() {
    const today = todayISO();
    const all = Object.values(cards);
    const due = all.filter(c => c.reps > 0 && c.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const fresh = all.filter(c => c.reps === 0).sort((a, b) => a.addedDate.localeCompare(b.addedDate));
    const mode = currentModeConfig();
    return {
      due: due.slice(0, mode.reviewCap),
      fresh: fresh.slice(0, mode.newPerDay),
    };
  }

  async function renderHome() {
    cancelAudio();
    resetActiveSessions();
    await ensureSurahList();
    const { due, fresh } = computeQueue();
    const total = due.length + fresh.length;
    const allCards = Object.values(cards);
    const matureCt = allCards.filter(c => masteryStage(c) === "mature").length;
    const murajaDue = computeMurajaDue();

    screenEl.innerHTML = `
      <div class="container">
        <div class="hero">
          <div class="hero-eyebrow">Bismillāh</div>
          <h1>Today's Wird</h1>
          <p>A living portion drawn fresh each day from what's due for review and what's new to begin — not a fixed lesson plan.</p>
        </div>
        <div class="today-card">
          ${total > 0 ? `
            <div class="today-count">${total}</div>
            <div class="today-label">verses in today's portion</div>
            <div class="today-breakdown">
              <span><b>${due.length}</b> due for review</span>
              <span><b>${fresh.length}</b> new</span>
            </div>
            <button class="primary-btn" id="startWirdBtn">Begin Today's Wird</button>
          ` : allCards.length === 0 ? `
            <div class="empty-state">
              <div class="glyph">﴾ ﴿</div>
              <p>You haven't started memorizing anything yet. Visit the Library to add your first verses — Juz 'Amma is the traditional starting point.</p>
            </div>
            <button class="secondary-btn" id="goLibraryBtn">Open Library</button>
          ` : `
            <div class="empty-state">
              <div class="glyph"><svg viewBox="0 0 24 24" width="38" height="38" aria-hidden="true"><path d="M4 12.5l6 6L20 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
              <p>Nothing due right now. Come back tomorrow, or add more verses to memorize from the Library.</p>
            </div>
            <button class="secondary-btn" id="goLibraryBtn">Open Library</button>
          `}
        </div>
        <div class="stat-row">
          <div class="stat-box"><b>${stats.streak}</b><span>day streak</span></div>
          <div class="stat-box"><b>${allCards.length}</b><span>in memorization</span></div>
          <div class="stat-box"><b>${matureCt}</b><span>mature</span></div>
        </div>
        ${achievements.completedSurahs.length ? `
          <div class="star-divider">${starSvg()}</div>
          <div class="achievements-section">
            <div class="muraja-heading">Completed Surahs</div>
            <p class="muraja-sub">Every verse fully cured — seven encounters to learn, two more to confirm.</p>
            <div class="badge-row">
              ${achievements.completedSurahs.map(num => {
                const meta = surahList.find(s => s.number === num);
                if (!meta) return "";
                return `
                  <button class="surah-badge" data-surah="${num}" title="${escapeHtml(meta.englishName)} — start a sard">
                    <span class="badge-ar">${escapeHtml(meta.name)}</span>
                    <span class="badge-en">${escapeHtml(meta.englishName)}</span>
                  </button>
                `;
              }).join("")}
            </div>
          </div>
        ` : ""}
        ${achievements.completedJuz.length ? `
          <div class="star-divider">${starSvg()}</div>
          <div class="achievements-section">
            <div class="muraja-heading">Completed Juz</div>
            <p class="muraja-sub">A full juz, cover to cover, every verse fully cured.</p>
            <div class="badge-row">
              ${achievements.completedJuz.slice().sort((a, b) => a - b).map(num => `
                <button class="surah-badge" data-juz="${num}" title="Juz ${num} — start a sard">
                  <span class="badge-en">Juz ${num}</span>
                </button>
              `).join("")}
            </div>
          </div>
        ` : ""}
        ${murajaDue.length ? `
          <div class="star-divider">${starSvg()}</div>
          <div class="muraja-section">
            <div class="muraja-heading">Muraja'ah Rotation</div>
            <p class="muraja-sub">Whole-surah recitation, on its own cycle — separate from per-verse review, the way real ḥifẓ maintenance actually works.</p>
            <div class="muraja-list">
              ${murajaDue.map(m => {
                const meta = surahList.find(s => s.number === m.surah);
                const urgent = m.daysSince && m.daysSince >= m.cycleDays * 2;
                return `
                  <button class="muraja-row ${urgent ? "urgent" : ""}" data-surah="${m.surah}">
                    <div class="muraja-row-info">
                      <div class="en">${meta ? escapeHtml(meta.englishName) : "Surah " + m.surah}</div>
                      <div class="sub">${m.verseCount} verses · ${m.daysSince === null ? "never reviewed as a whole" : `${m.daysSince} days since last sard`}</div>
                    </div>
                    <div class="muraja-cta">Start Sard →</div>
                  </button>
                `;
              }).join("")}
            </div>
          </div>
        ` : ""}
        <div class="star-divider">${starSvg()}</div>
        <div style="text-align:center;color:var(--text-muted);font-size:0.82rem;line-height:1.6;max-width:440px;margin:0 auto;">
          Reviews use real spaced repetition — you rate your own recall (Again / Hard / Good / Easy) and the schedule adapts, the same way serious ḥifẓ tracking has always worked, just automated.
        </div>
      </div>
    `;
    const startBtn = document.getElementById("startWirdBtn");
    if (startBtn) startBtn.addEventListener("click", startWird);
    const libBtn = document.getElementById("goLibraryBtn");
    if (libBtn) libBtn.addEventListener("click", () => switchScreen("library"));
    document.querySelectorAll(".muraja-row").forEach(btn => {
      btn.addEventListener("click", () => startSard(Number(btn.dataset.surah)));
    });
    document.querySelectorAll(".surah-badge").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.dataset.juz != null) startJuzSard(Number(btn.dataset.juz));
        else startSard(Number(btn.dataset.surah));
      });
    });
  }

  function starSvg() {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.5 7.5L22 8l-6 4.5L18 20l-6-4-6 4 2-7.5-6-4.5 7.5-.5z"/></svg>`;
  }

  // ---------- progress ----------
  // Every number here is derived from data the app already tracks for
  // other reasons (card.addedDate, card.juz, masteryStage(), stats,
  // achievements) -- nothing new to log, so this is useful immediately
  // for existing users, not just something that starts paying off weeks
  // from now. The one thing genuinely NOT available is a timestamped
  // history of achievement completions (completedSurahs/completedJuz are
  // bare number arrays) or of individual reviews, so there's no "reviews
  // per day" or "when did I finish Juz 5" chart here -- would need a real
  // log to be added first rather than backfilled.
  function cumulativeGrowthPoints(allCards) {
    const dateCounts = {};
    allCards.forEach(c => {
      if (c.addedDate) dateCounts[c.addedDate] = (dateCounts[c.addedDate] || 0) + 1;
    });
    const dates = Object.keys(dateCounts).sort();
    if (dates.length < 2) return null; // one data point can't draw a line
    let running = 0;
    const points = dates.map(d => { running += dateCounts[d]; return { date: d, total: running }; });
    return points;
  }

  // A time-scaled (not entry-scaled) SVG line+area chart, plain path data,
  // no charting dependency. X-axis spans real calendar days from the first
  // added verse to today, so a slow stretch actually LOOKS slow rather
  // than being compressed away -- an entry-indexed x-axis would silently
  // misrepresent pacing for anyone whose adding has been uneven.
  function growthChartSvg(points) {
    const W = 600, H = 170, PAD_L = 34, PAD_R = 12, PAD_T = 14, PAD_B = 24;
    const firstDate = new Date(points[0].date + "T00:00:00");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const totalDays = Math.max(1, Math.round((today - firstDate) / 86400000));
    const maxTotal = points[points.length - 1].total;
    const x = (d) => PAD_L + (Math.round((new Date(d + "T00:00:00") - firstDate) / 86400000) / totalDays) * (W - PAD_L - PAD_R);
    const y = (v) => PAD_T + (1 - v / maxTotal) * (H - PAD_T - PAD_B);
    const linePts = points.map(p => `${x(p.date).toFixed(1)},${y(p.total).toFixed(1)}`);
    // extend the line flat to "today" so the chart doesn't look like it
    // stops short even if the last addition was a while ago
    linePts.push(`${(W - PAD_R).toFixed(1)},${y(maxTotal).toFixed(1)}`);
    const linePath = "M" + linePts.join(" L");
    const areaPath = `${linePath} L${(W - PAD_R).toFixed(1)},${(H - PAD_B).toFixed(1)} L${PAD_L},${(H - PAD_B).toFixed(1)} Z`;
    const gridY = [0, 0.5, 1].map(f => PAD_T + f * (H - PAD_T - PAD_B));
    return `
      <svg class="growth-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Verses memorized over time, from ${points[0].total} to ${maxTotal}">
        ${gridY.map(gy => `<line x1="${PAD_L}" y1="${gy.toFixed(1)}" x2="${W - PAD_R}" y2="${gy.toFixed(1)}" class="growth-grid"/>`).join("")}
        <path d="${areaPath}" class="growth-area"/>
        <path d="${linePath}" class="growth-line"/>
      </svg>
      <div class="growth-axis">
        <span>${escapeHtml(formatShortDate(points[0].date))}</span>
        <span>${escapeHtml(formatShortDate(today.toISOString().slice(0, 10)))}</span>
      </div>
    `;
  }

  // Last 28 days of review activity as a GitHub-style intensity grid.
  // dailyLog only starts recording from whenever this feature shipped, so
  // days before that (or before the user's first-ever review) just read as
  // empty -- an honest "no data yet" rather than a guessed backfill.
  function activityHeatmapHtml(dailyLog) {
    const days = [];
    for (let i = 27; i >= 0; i--) {
      const date = addDaysISO(-i);
      days.push({ date, count: (dailyLog && dailyLog[date]) || 0 });
    }
    const max = Math.max(1, ...days.map(d => d.count));
    const cells = days.map(d => {
      const level = d.count === 0 ? 0 : Math.min(4, Math.ceil((d.count / max) * 4));
      return `<div class="heat-cell heat-level-${level}" title="${escapeHtml(formatShortDate(d.date))}: ${d.count} review${d.count === 1 ? "" : "s"}"></div>`;
    });
    return `<div class="heat-grid">${cells.join("")}</div>`;
  }

  function formatShortDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function masteryBarHtml(counts) {
    const total = counts.new + counts.learning + counts.young + counts.mature;
    if (!total) return `<p class="muraja-sub">Nothing added yet.</p>`;
    const segs = [
      { key: "mature", label: "Mature", n: counts.mature },
      { key: "young", label: "Reviewing", n: counts.young },
      { key: "learning", label: "Learning", n: counts.learning },
      { key: "new", label: "Not started", n: counts.new },
    ];
    return `
      <div class="mastery-bar">
        ${segs.filter(s => s.n > 0).map(s => `<div class="mastery-seg mastery-${s.key}" style="flex:${s.n}" title="${s.label}: ${s.n}"></div>`).join("")}
      </div>
      <div class="mastery-legend">
        ${segs.map(s => `<span class="mastery-legend-item"><i class="mastery-dot mastery-${s.key}"></i>${s.label} <b>${s.n}</b></span>`).join("")}
      </div>
    `;
  }

  function juzGridHtml(allCards) {
    const cells = [];
    for (let j = 1; j <= 30; j++) {
      const total = juzAyahCount(j);
      const juzCards = allCards.filter(c => c.juz === j);
      const have = juzCards.length;
      const matureN = juzCards.filter(c => masteryStage(c) === "mature").length;
      const pct = total ? Math.round((have / total) * 100) : 0;
      const complete = achievements.completedJuz.includes(j);
      const cls = complete ? "complete" : have === 0 ? "empty" : matureN === have ? "mature" : "partial";
      const clickable = have > 0;
      cells.push(`
        <div class="juz-cell juz-cell-${cls}${clickable ? " juz-cell-clickable" : ""}" ${clickable ? `data-juz="${j}"` : ""} title="Juz ${j}: ${have}/${total || "?"} verses added${matureN ? `, ${matureN} mature` : ""}${clickable ? " — tap to start a sard" : ""}">
          <span class="juz-cell-num">${j}</span>
          <span class="juz-cell-pct">${have ? pct + "%" : "—"}</span>
        </div>
      `);
    }
    return `<div class="juz-progress-grid">${cells.join("")}</div>`;
  }

  // Surahs the user has started but not yet finished mastering -- ranked by
  // how close they are (mature verses / the surah's real total), so the
  // nearest-to-complete ones surface first. Deliberately excludes anything
  // already in achievements.completedSurahs (that's Home's job to celebrate)
  // and anything with zero mature verses yet (not "almost" anything).
  function inProgressSurahs(allCards) {
    const bySurah = {};
    allCards.forEach(c => { (bySurah[c.surah] ||= []).push(c); });
    return Object.keys(bySurah)
      .map(Number)
      .filter(num => !achievements.completedSurahs.includes(num))
      .map(num => {
        const meta = surahList.find(s => s.number === num);
        if (!meta) return null;
        const list = bySurah[num];
        const matureN = list.filter(c => masteryStage(c) === "mature").length;
        const total = meta.numberOfAyahs;
        return { num, meta, have: list.length, total, matureN, pct: Math.round((matureN / total) * 100) };
      })
      .filter(s => s && s.matureN > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }

  async function renderProgress() {
    cancelAudio(); resetActiveSessions();
    await ensureSurahList();
    const allCards = Object.values(cards);
    const counts = { new: 0, learning: 0, young: 0, mature: 0 };
    allCards.forEach(c => { counts[masteryStage(c)]++; });
    const growthPoints = cumulativeGrowthPoints(allCards);
    const daysActive = allCards.length
      ? Math.max(1, Math.round((new Date() - new Date(allCards.reduce((min, c) => c.addedDate && c.addedDate < min ? c.addedDate : min, allCards[0].addedDate || "9999-99-99") + "T00:00:00")) / 86400000) + 1)
      : 0;
    const almostThere = inProgressSurahs(allCards);

    screenEl.innerHTML = `
      <div class="container">
        <div class="hero">
          <div class="hero-eyebrow">Sīrah</div>
          <h1>Your Progress</h1>
          <p>The whole picture — how far you've come, not just what's due today.</p>
        </div>
        <div class="stat-row" style="grid-template-columns:repeat(4,1fr)">
          <div class="stat-box"><b data-count="${stats.streak}">0</b><span>day streak${stats.longestStreak > stats.streak ? `<br><i class="stat-best">best ${stats.longestStreak}</i>` : ""}</span></div>
          <div class="stat-box"><b data-count="${allCards.length}">0</b><span>total verses</span></div>
          <div class="stat-box"><b data-count="${counts.mature}">0</b><span>mature</span></div>
          <div class="stat-box"><b data-count="${stats.totalReviews}">0</b><span>reviews done</span></div>
        </div>
        ${allCards.length === 0 ? `
          <div class="empty-state">
            <div class="glyph">﴾ ﴿</div>
            <p>Nothing to show yet — add verses from the Library and your progress will build up here.</p>
          </div>
        ` : `
          ${almostThere.length ? `
            <div class="star-divider">${starSvg()}</div>
            <div class="progress-section">
              <div class="muraja-heading">Almost There</div>
              <p class="muraja-sub">Surahs you've already started — closest to fully mastered first.</p>
              <div class="muraja-list">
                ${almostThere.map(s => `
                  <button class="muraja-row" data-surah="${s.num}">
                    <div class="muraja-row-info">
                      <div class="en">${escapeHtml(s.meta.englishName)}</div>
                      <div class="sub">${s.matureN}/${s.total} mature · ${s.pct}% there</div>
                    </div>
                    <div class="muraja-cta">Start Sard →</div>
                  </button>
                `).join("")}
              </div>
            </div>
          ` : ""}
          ${growthPoints ? `
            <div class="star-divider">${starSvg()}</div>
            <div class="progress-section">
              <div class="muraja-heading">Growth Over Time</div>
              <p class="muraja-sub">${allCards.length} verses added across ${daysActive} day${daysActive === 1 ? "" : "s"}.</p>
              ${growthChartSvg(growthPoints)}
            </div>
          ` : ""}
          <div class="star-divider">${starSvg()}</div>
          <div class="progress-section">
            <div class="muraja-heading">Recent Activity</div>
            <p class="muraja-sub">Reviews over the last 28 days.</p>
            ${activityHeatmapHtml(stats.dailyLog)}
          </div>
          <div class="star-divider">${starSvg()}</div>
          <div class="progress-section">
            <div class="muraja-heading">Mastery Breakdown</div>
            <p class="muraja-sub">Where every verse you've added currently stands.</p>
            ${masteryBarHtml(counts)}
          </div>
          <div class="star-divider">${starSvg()}</div>
          <div class="progress-section">
            <div class="muraja-heading">Progress by Juz</div>
            <p class="muraja-sub">Each cell is one of the 30 traditional divisions — filled in as you add and master its verses.</p>
            ${juzGridHtml(allCards)}
          </div>
        `}
      </div>
    `;
    document.querySelectorAll("#screen .muraja-row").forEach(btn => {
      btn.addEventListener("click", () => startSard(Number(btn.dataset.surah)));
    });
    document.querySelectorAll("#screen .juz-cell-clickable").forEach(cell => {
      cell.addEventListener("click", () => startJuzSard(Number(cell.dataset.juz)));
    });
    animateCountUps(screenEl);
  }

  // Animates every [data-count] element's textContent from 0 up to its
  // target integer -- purely decorative, so a reduced-motion preference
  // just snaps straight to the final value instead of skipping the
  // element entirely (the number still needs to actually show).
  function animateCountUps(container) {
    const els = container.querySelectorAll("[data-count]");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    els.forEach(el => {
      const target = Number(el.dataset.count) || 0;
      if (reduce || target === 0) { el.textContent = target; return; }
      const duration = Math.min(900, 250 + target * 12);
      const start = performance.now();
      function tick(now) {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(eased * target);
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  // ---------- library ----------
  async function renderLibrary() {
    cancelAudio(); resetActiveSessions();
    await ensureSurahList();
    const amma = surahList.filter(s => s.number >= JUZ_AMMA_START && s.number <= JUZ_AMMA_END);
    const rest = surahList.filter(s => s.number < JUZ_AMMA_START);

    function row(s) {
      const inSet = Object.keys(cards).some(k => k.startsWith(s.number + ":"));
      const count = Object.keys(cards).filter(k => k.startsWith(s.number + ":")).length;
      const search = `${s.number} ${s.englishName} ${s.englishNameTranslation} ${s.name}`.toLowerCase();
      return `
        <button class="surah-row" data-surah="${s.number}" data-search="${escapeHtml(search)}">
          <div class="surah-num">${s.number}</div>
          <div class="surah-meta">
            <div class="en">${escapeHtml(s.englishName)} <span style="color:var(--text-muted);font-weight:400">— ${escapeHtml(s.englishNameTranslation)}</span></div>
            <div class="sub">${s.numberOfAyahs} verses · ${s.revelationType}</div>
          </div>
          <div class="surah-ar">${escapeHtml(s.name)}</div>
          ${inSet ? `<div class="surah-progress-pill">${count} added</div>` : ""}
        </button>
      `;
    }

    screenEl.innerHTML = `
      <div class="container">
        <div class="hero" style="padding-top:0">
          <h1 style="font-size:1.6rem">Library</h1>
          <p>Browse the Qur'an and add verses to your memorization set.</p>
        </div>
        <div class="lib-search-wrap">
          <span class="lib-search-ic">${ICON_SEARCH}</span>
          <input id="libSearch" placeholder="Search by name or number…" autocomplete="off"/>
        </div>
        <div class="juz-group" id="libAmmaGroup">
          <div class="juz-heading">Juz 'Amma — recommended starting point</div>
          <div class="surah-list">${amma.map(row).join("")}</div>
        </div>
        <div class="juz-group" id="libRestGroup">
          <div class="juz-heading">The rest of the Qur'an</div>
          <div class="surah-list">${rest.map(row).join("")}</div>
        </div>
        <div class="empty-state hidden" id="libSearchEmpty">
          <div class="glyph">﴾ ﴿</div>
          <p>No surahs match "<span id="libSearchEmptyQ"></span>".</p>
        </div>
      </div>
    `;
    document.querySelectorAll(".surah-row").forEach(btn => {
      btn.addEventListener("click", () => renderSurahBrowser(Number(btn.dataset.surah)));
    });
    wireLibrarySearch();
  }

  function wireLibrarySearch() {
    const input = document.getElementById("libSearch");
    if (!input) return;
    const rows = Array.from(document.querySelectorAll(".surah-row"));
    const groups = [document.getElementById("libAmmaGroup"), document.getElementById("libRestGroup")];
    const emptyEl = document.getElementById("libSearchEmpty");
    const emptyQEl = document.getElementById("libSearchEmptyQ");
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      let anyVisible = false;
      rows.forEach(r => {
        const match = !q || r.dataset.search.includes(q);
        r.classList.toggle("hidden", !match);
        if (match) anyVisible = true;
      });
      groups.forEach(g => {
        const hasVisible = g.querySelector(".surah-row:not(.hidden)");
        g.classList.toggle("hidden", !hasVisible);
      });
      emptyEl.classList.toggle("hidden", anyVisible || !q);
      if (emptyQEl) emptyQEl.textContent = input.value.trim();
    });
  }

  // ---------- Downloads: explicit, user-controlled offline audio ----------
  // Deliberately NOT automatic. A full reciter is 400MB-1.5GB (every ayah
  // is a separate file at everyayah.com) -- silently pulling that much
  // data on install would be a real surprise on mobile data. This screen
  // is the only thing that ever triggers a bulk download; ordinary
  // listening still opportunistically persists played ayahs too (see
  // warmAudioCache's IndexedDB write) but never in bulk.
  const AUDIO_SIZES_PATH = "data/audio-sizes.json";
  const AUDIO_SIZES_PER_AYAH_PATH = "data/audio-sizes-per-ayah.json";
  let audioSizes = null; // { reciterId: { "surahNum": totalBytes } }
  let audioSizesPerAyah = null; // { reciterId: { "surahNum": [bytesForAyah1, bytesForAyah2, ...] } }
  async function ensureAudioSizes() {
    if (audioSizes) return audioSizes;
    const res = await fetch(AUDIO_SIZES_PATH);
    if (!res.ok) throw new Error("Failed to load audio size table");
    audioSizes = await res.json();
    return audioSizes;
  }
  // Separate from the per-surah table above (which is enough for the
  // surah list and the two whole-range quick actions) because a juz
  // doesn't align to surah boundaries -- getting an exact "how big is
  // Juz 12" figure needs real per-ayah numbers, not a prorated guess.
  async function ensureAudioSizesPerAyah() {
    if (audioSizesPerAyah) return audioSizesPerAyah;
    const res = await fetch(AUDIO_SIZES_PER_AYAH_PATH);
    if (!res.ok) throw new Error("Failed to load per-ayah audio size table");
    audioSizesPerAyah = await res.json();
    return audioSizesPerAyah;
  }
  function bytesForJuz(reciterId, juzNum) {
    const table = audioSizesPerAyah && audioSizesPerAyah[reciterId];
    if (!table) return null;
    return ayahsInJuz(juzNum).reduce((sum, { surah, ayah }) => {
      const arr = table[String(surah)];
      return sum + (arr && arr[ayah - 1] ? arr[ayah - 1] : 0);
    }, 0);
  }
  function fmtBytes(n) {
    if (!n) return "0 MB";
    if (n >= 1024 * 1024 * 1024) return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
    if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
    if (n >= 1024) return Math.round(n / 1024) + " KB";
    return n + " B";
  }
  // Every {surah,ayah} pair belonging to a given juz. Mirrors
  // juzAyahCount()'s exact boundary logic (same JUZ_START table) instead
  // of re-deriving juz ranges a second way that could drift out of sync.
  function ayahsInJuz(juzNum) {
    const [startSurah, startAyah] = JUZ_START[juzNum - 1];
    const next = JUZ_START[juzNum]; // undefined for juz 30 -- runs to the end
    const list = [];
    let s = startSurah, a = startAyah;
    while (true) {
      if (next && s === next[0] && a >= next[1]) break;
      const meta = surahList.find(m => m.number === s);
      if (!meta) break;
      if (next && s === next[0]) {
        for (let x = a; x < next[1]; x++) list.push({ surah: s, ayah: x });
        break;
      }
      for (let x = a; x <= meta.numberOfAyahs; x++) list.push({ surah: s, ayah: x });
      s++; a = 1;
      if (s > 114) break;
    }
    return list;
  }
  function allAyahsInSurah(surahNum) {
    const meta = surahList.find(m => m.number === surahNum);
    if (!meta) return [];
    const list = [];
    for (let a = 1; a <= meta.numberOfAyahs; a++) list.push({ surah: surahNum, ayah: a });
    return list;
  }

  const DOWNLOAD_CONCURRENCY = 5;
  const downloadState = {
    active: false, cancelled: false, reciter: null, label: "",
    total: 0, done: 0, failed: 0, bytesTotal: 0, bytesDone: 0,
  };
  // Deliberately a plain array of callbacks rather than a full event-bus --
  // the only subscriber is ever the currently-rendered Downloads screen
  // itself, cleared every time that screen re-renders from scratch.
  let downloadProgressListeners = [];
  function notifyDownloadProgress() { downloadProgressListeners.forEach(fn => { try { fn(); } catch (e) {} }); }

  // One batch at a time by design -- running two concurrent batches would
  // just make both slower (same CDN, same concurrency budget) and make
  // progress reporting/cancellation ambiguous for no real benefit.
  async function downloadAyahList(reciterId, pairs, bytesHint) {
    if (downloadState.active) return;
    downloadState.active = true;
    downloadState.cancelled = false;
    downloadState.reciter = reciterId;
    downloadState.total = pairs.length;
    downloadState.done = 0;
    downloadState.failed = 0;
    downloadState.bytesTotal = bytesHint || 0;
    downloadState.bytesDone = 0;
    notifyDownloadProgress();

    let idx = 0;
    async function worker() {
      while (idx < pairs.length) {
        if (downloadState.cancelled) return;
        const mine = idx++;
        const { surah, ayah } = pairs[mine];
        const url = audioUrlForReciter(reciterId, surah, ayah);
        try {
          const existing = await idbGet(url);
          if (existing && existing.blob) {
            downloadState.bytesDone += existing.bytes || 0;
          } else {
            const res = await fetch(url, { mode: "cors" });
            if (!res.ok) throw new Error("HTTP " + res.status);
            const blob = await res.blob();
            if (!blob || !blob.size) throw new Error("empty response");
            await idbPut({ url, reciter: reciterId, surah, ayah, bytes: blob.size, cachedAt: Date.now(), blob });
            downloadState.bytesDone += blob.size;
          }
        } catch (e) {
          downloadState.failed++;
        }
        downloadState.done++;
        notifyDownloadProgress();
      }
    }
    await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker));
    downloadState.active = false;
    notifyDownloadProgress();
    // "Downloaded" should mean usable with zero network -- make sure every
    // touched surah's text/translation is cached too, not just its audio.
    // ensureSurahLoaded() already persists to localStorage on success and
    // is a no-op if a surah is already cached, so this is cheap to call
    // even when most of the surahs involved were already loaded before.
    const surahs = [...new Set(pairs.map(p => p.surah))];
    for (const s of surahs) { try { await ensureSurahLoaded(s); } catch (e) { /* text will just re-fetch live next time it's opened */ } }
  }
  function cancelDownload() { downloadState.cancelled = true; }

  async function storageUsedByReciter(reciterId) {
    const records = await idbGetAllByReciter(reciterId);
    const bytes = records.reduce((sum, r) => sum + (r.bytes || 0), 0);
    const surahs = new Set(records.map(r => r.surah));
    const ayahKeys = new Set(records.map(r => `${r.surah}:${r.ayah}`));
    return { count: records.length, bytes, surahs, ayahKeys };
  }

  async function renderDownloads() {
    cancelAudio(); resetActiveSessions();
    downloadProgressListeners = [];
    await Promise.all([
      ensureSurahList(),
      ensureAudioSizes().catch(() => { audioSizes = null; }),
      ensureAudioSizesPerAyah().catch(() => { audioSizesPerAyah = null; }),
    ]);

    let selectedReciter = currentReciter;
    let quotaEstimate = null;
    try { quotaEstimate = await navigator.storage.estimate(); } catch (e) { /* not supported -- just don't show device totals */ }

    async function draw() {
      const usage = await storageUsedByReciter(selectedReciter).catch(() => ({ count: 0, bytes: 0, surahs: new Set() }));
      const sizes = (audioSizes && audioSizes[selectedReciter]) || null;
      const wholeQuranBytes = sizes ? Object.values(sizes).reduce((a, b) => a + b, 0) : null;
      const juzAmmaBytes = sizes ? surahList.filter(s => s.number >= JUZ_AMMA_START && s.number <= JUZ_AMMA_END)
        .reduce((sum, s) => sum + (sizes[String(s.number)] || 0), 0) : null;

      const quotaLine = quotaEstimate && quotaEstimate.quota
        ? `${fmtBytes(quotaEstimate.usage)} used of ${fmtBytes(quotaEstimate.quota)} available on this device`
        : "";

      screenEl.innerHTML = `
        <div class="container">
          <div class="hero" style="padding-top:0">
            <h1 style="font-size:1.6rem">Downloads</h1>
            <p>Save recitation audio to this device so Wird works with no connection at all. Downloads are per reciter -- pick which one below.</p>
          </div>

          <div class="dl-reciter-tabs">
            ${Object.entries(RECITERS).map(([id, r]) => `
              <button class="dl-reciter-tab ${id === selectedReciter ? "active" : ""}" data-reciter="${id}">${escapeHtml(r.name)}</button>
            `).join("")}
          </div>

          <div class="dl-summary-card">
            <div class="dl-summary-main">
              <strong>${fmtBytes(usage.bytes)}</strong> downloaded
              <span class="dl-summary-sub">${usage.surahs.size} of 114 surahs have at least one saved verse</span>
            </div>
            ${quotaLine ? `<div class="dl-summary-quota">${quotaLine}</div>` : ""}
            ${usage.bytes > 0 ? `<button class="secondary-btn dl-delete-all" id="dlDeleteAll" type="button">Delete all downloaded audio for this reciter</button>` : ""}
          </div>

          <div class="dl-progress-card hidden" id="dlProgressCard">
            <div class="dl-progress-label" id="dlProgressLabel"></div>
            <div class="dl-progress-bar"><div class="dl-progress-fill" id="dlProgressFill"></div></div>
            <div class="dl-progress-sub" id="dlProgressSub"></div>
            <button class="secondary-btn" id="dlCancelBtn" type="button">Cancel</button>
          </div>

          <div class="dl-quick-actions">
            <button class="mode-card" id="dlJuzAmma" type="button" ${downloadState.active ? "disabled" : ""}>
              <div class="mode-card-top">
                <span class="mode-card-label">Juz 'Amma</span>
                <span class="mode-card-count">${juzAmmaBytes != null ? fmtBytes(juzAmmaBytes) : "…"}</span>
              </div>
              <p class="mode-card-blurb">Surahs 78-114 -- the recommended starting point.</p>
            </button>
            <button class="mode-card" id="dlWholeQuran" type="button" ${downloadState.active ? "disabled" : ""}>
              <div class="mode-card-top">
                <span class="mode-card-label">Whole Qur'an</span>
                <span class="mode-card-count">${wholeQuranBytes != null ? fmtBytes(wholeQuranBytes) : "…"}</span>
              </div>
              <p class="mode-card-blurb">All 114 surahs for this reciter. This is a large download -- Wi-Fi recommended.</p>
            </button>
          </div>

          <div class="juz-heading">By juz</div>
          <div class="juz-progress-grid" id="dlJuzGrid">
            ${Array.from({ length: 30 }, (_, i) => i + 1).map(j => {
              const juzPairs = ayahsInJuz(j);
              const complete = juzPairs.length > 0 && juzPairs.every(({ surah, ayah }) => usage.ayahKeys.has(`${surah}:${ayah}`));
              const juzBytes = bytesForJuz(selectedReciter, j);
              return `
                <button class="juz-cell dl-juz-cell ${complete ? "juz-cell-complete" : "juz-cell-empty"}" data-juz="${j}"
                  title="Juz ${j}${juzBytes != null ? ` — ${fmtBytes(juzBytes)}` : ""}${complete ? " — fully downloaded, tap to delete" : " — tap to download"}"
                  aria-label="Juz ${j}${juzBytes != null ? `, ${fmtBytes(juzBytes)}` : ""}${complete ? ", fully downloaded, tap to delete" : ", tap to download"}"
                  ${downloadState.active ? "disabled" : ""}>
                  <span class="juz-cell-num">${j}</span>
                  <span class="juz-cell-pct">${complete ? ICON_CHECK : juzBytes != null ? fmtBytes(juzBytes) : ""}</span>
                </button>
              `;
            }).join("")}
          </div>

          <div class="juz-heading">By surah</div>
          <div class="surah-list" id="dlSurahList">
            ${surahList.map(s => {
              const has = usage.surahs.has(s.number);
              const size = sizes ? sizes[String(s.number)] : null;
              return `
                <div class="surah-row dl-surah-row" data-surah="${s.number}">
                  <div class="surah-num">${s.number}</div>
                  <div class="surah-meta">
                    <div class="en">${escapeHtml(s.englishName)}</div>
                    <div class="sub">${size != null ? fmtBytes(size) : `${s.numberOfAyahs} verses`}</div>
                  </div>
                  ${has
                    ? `<button class="dl-row-btn dl-row-delete" data-surah="${s.number}" title="Delete downloaded audio" aria-label="Delete downloaded audio for ${escapeHtml(s.englishName)}" ${downloadState.active ? "disabled" : ""}>${ICON_TRASH}</button>`
                    : `<button class="dl-row-btn dl-row-download" data-surah="${s.number}" title="Download this surah" aria-label="Download audio for ${escapeHtml(s.englishName)}" ${downloadState.active ? "disabled" : ""}>${ICON_DOWNLOAD}</button>`}
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;

      document.querySelectorAll(".dl-reciter-tab").forEach(btn => {
        btn.addEventListener("click", () => { selectedReciter = btn.dataset.reciter; draw(); });
      });
      const deleteAllBtn = document.getElementById("dlDeleteAll");
      if (deleteAllBtn) {
        deleteAllBtn.addEventListener("click", async () => {
          deleteAllBtn.disabled = true;
          deleteAllBtn.textContent = "Deleting…";
          await idbDeleteByReciter(selectedReciter);
          draw();
        });
      }
      const juzAmmaBtn = document.getElementById("dlJuzAmma");
      if (juzAmmaBtn) juzAmmaBtn.addEventListener("click", () => {
        const pairs = surahList.filter(s => s.number >= JUZ_AMMA_START && s.number <= JUZ_AMMA_END)
          .flatMap(s => allAyahsInSurah(s.number));
        runDownload(pairs, juzAmmaBytes);
      });
      const wholeBtn = document.getElementById("dlWholeQuran");
      if (wholeBtn) wholeBtn.addEventListener("click", () => {
        const pairs = surahList.flatMap(s => allAyahsInSurah(s.number));
        runDownload(pairs, wholeQuranBytes);
      });
      document.querySelectorAll(".dl-row-download").forEach(btn => {
        btn.addEventListener("click", () => {
          const surahNum = Number(btn.dataset.surah);
          const size = sizes ? sizes[String(surahNum)] : null;
          runDownload(allAyahsInSurah(surahNum), size);
        });
      });
      document.querySelectorAll(".dl-row-delete").forEach(btn => {
        btn.addEventListener("click", async () => {
          const surahNum = Number(btn.dataset.surah);
          btn.disabled = true;
          await idbDeleteByReciterSurah(selectedReciter, surahNum);
          draw();
        });
      });
      document.querySelectorAll(".dl-juz-cell").forEach(btn => {
        btn.addEventListener("click", async () => {
          const juzNum = Number(btn.dataset.juz);
          if (btn.classList.contains("juz-cell-complete")) {
            btn.disabled = true;
            // Deletes exactly this juz's ayahs, not by whole surah -- a juz
            // boundary regularly falls mid-surah, and deleting the entire
            // surah here would also wipe audio belonging to the NEXT juz
            // if it happens to share that surah.
            const pairs = ayahsInJuz(juzNum);
            await Promise.all(pairs.map(({ surah, ayah }) => idbDelete(audioUrlForReciter(selectedReciter, surah, ayah))));
            draw();
          } else {
            runDownload(ayahsInJuz(juzNum), bytesForJuz(selectedReciter, juzNum));
          }
        });
      });

      function runDownload(pairs, bytesHint) {
        if (downloadState.active || !pairs.length) return;
        const progressCard = document.getElementById("dlProgressCard");
        const label = document.getElementById("dlProgressLabel");
        const fill = document.getElementById("dlProgressFill");
        const sub = document.getElementById("dlProgressSub");
        progressCard.classList.remove("hidden");
        downloadProgressListeners.push(() => {
          const pct = downloadState.total ? Math.round((downloadState.done / downloadState.total) * 100) : 0;
          label.textContent = downloadState.active
            ? `Downloading… ${downloadState.done} / ${downloadState.total} verses`
            : `Done — ${downloadState.done} / ${downloadState.total} verses saved${downloadState.failed ? ` (${downloadState.failed} failed, will retry next time)` : ""}`;
          fill.style.width = pct + "%";
          sub.textContent = downloadState.bytesTotal ? `${fmtBytes(downloadState.bytesDone)} of ~${fmtBytes(downloadState.bytesTotal)}` : fmtBytes(downloadState.bytesDone);
          if (!downloadState.active) {
            document.getElementById("dlCancelBtn").classList.add("hidden");
            setTimeout(() => { if (!downloadState.active) draw(); }, 900);
          }
        });
        document.getElementById("dlCancelBtn").classList.remove("hidden");
        document.getElementById("dlCancelBtn").addEventListener("click", cancelDownload, { once: true });
        downloadAyahList(selectedReciter, pairs, bytesHint);
      }

      // A download already running when this screen opens (e.g. navigated
      // away and back) should keep reflecting live progress, not show a
      // stale/empty progress card.
      if (downloadState.active && downloadState.reciter === selectedReciter) {
        runDownload.__resume = true;
        document.getElementById("dlProgressCard").classList.remove("hidden");
        document.getElementById("dlProgressLabel").textContent = `Downloading… ${downloadState.done} / ${downloadState.total} verses`;
        document.getElementById("dlCancelBtn").addEventListener("click", cancelDownload, { once: true });
        downloadProgressListeners.push(() => {
          const pct = downloadState.total ? Math.round((downloadState.done / downloadState.total) * 100) : 0;
          document.getElementById("dlProgressFill").style.width = pct + "%";
          document.getElementById("dlProgressLabel").textContent = downloadState.active
            ? `Downloading… ${downloadState.done} / ${downloadState.total} verses`
            : `Done — ${downloadState.done} / ${downloadState.total} verses saved`;
          document.getElementById("dlProgressSub").textContent = downloadState.bytesTotal ? `${fmtBytes(downloadState.bytesDone)} of ~${fmtBytes(downloadState.bytesTotal)}` : fmtBytes(downloadState.bytesDone);
        });
      }
    }

    await draw();
  }

  async function renderSurahBrowser(surahNum) {
    screenEl.innerHTML = `<div class="container"><p style="text-align:center;color:var(--text-muted)">Loading…</p></div>`;
    let data;
    try {
      [data] = await Promise.all([ensureSurahLoaded(surahNum), ensureWordsLoaded(surahNum)]);
    } catch (e) {
      screenEl.innerHTML = `<div class="container"><p style="text-align:center;color:var(--bad)">Couldn't load this surah. Check your connection and try again.</p><button class="back-btn" id="backLibBtn">&larr; Library</button></div>`;
      document.getElementById("backLibBtn").addEventListener("click", renderLibrary);
      return;
    }
    const meta = surahList.find(s => s.number === surahNum);
    const rows = data.ayahs.map(a => {
      const key = cardKey(surahNum, a.numberInSurah);
      const added = !!cards[key];
      return `
        <div class="ayah-row">
          <div class="ayah-row-top">
            <span class="ayah-num-badge">Verse ${a.numberInSurah} · Page ${a.page}</span>
            <button class="add-toggle ${added ? "added" : ""}" data-ayah="${a.numberInSurah}">${added ? `Added ${ICON_CHECK}` : "Add to Wird"}</button>
          </div>
          <div class="ayah-arabic">${arabicHtmlRaw(surahNum, a.numberInSurah, a.text)}</div>
          <div class="ayah-translation">${escapeHtml(a.translation)}</div>
        </div>
      `;
    }).join("");

    screenEl.innerHTML = `
      <div class="container">
        <button class="back-btn" id="backLibBtn">&larr; Library</button>
        <div class="hero" style="padding-top:0">
          <h1 style="font-size:1.5rem">${escapeHtml(meta.englishName)}</h1>
          <p>${escapeHtml(meta.englishNameTranslation)} · ${data.ayahs.length} verses</p>
        </div>
        <button class="primary-btn" id="addAllBtn" style="margin-bottom:20px">Add entire surah to Wird</button>
        <div class="ayah-browser">${rows}</div>
      </div>
    `;
    wireWordTooltips(document.querySelector(".ayah-browser"));
    document.getElementById("backLibBtn").addEventListener("click", renderLibrary);
    document.getElementById("addAllBtn").addEventListener("click", () => {
      data.ayahs.forEach(a => addVerse(surahNum, a.numberInSurah, a));
      renderSurahBrowser(surahNum);
    });
    document.querySelectorAll(".add-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const ayahNum = Number(btn.dataset.ayah);
        const key = cardKey(surahNum, ayahNum);
        if (cards[key]) { delete cards[key]; saveCards(); }
        else { const a = data.ayahs.find(x => x.numberInSurah === ayahNum); addVerse(surahNum, ayahNum, a); }
        renderSurahBrowser(surahNum);
      });
    });
  }

  function addVerse(surah, ayah, ayahData) {
    const key = cardKey(surah, ayah);
    if (cards[key]) return;
    cards[key] = newCard(surah, ayah, ayahData);
    saveCards();
  }

  // ---------- mushaf page view ----------
  let mushafViewMode = "mastery"; // "mastery" | "weak"

  async function renderMushaf() {
    cancelAudio(); resetActiveSessions();
    const allCards = Object.values(cards);
    if (!allCards.length) {
      screenEl.innerHTML = `
        <div class="container">
          <div class="hero" style="padding-top:0"><h1 style="font-size:1.6rem">Mushaf</h1><p>A page-by-page view of your memorization, once you've added verses.</p></div>
          <div class="empty-state"><div class="glyph">﴾ ﴿</div><p>Nothing here yet — add verses from the Library first.</p></div>
        </div>
      `;
      return;
    }
    await ensureSurahList();
    const pages = {};
    allCards.forEach(c => { (pages[c.page] = pages[c.page] || []).push(c); });
    const pageNums = Object.keys(pages).map(Number).sort((a, b) => a - b);
    const maxStruggle = Math.max(1, ...allCards.map(c => c.struggleCount || 0));

    const cells = pageNums.map(p => {
      const cs = pages[p];
      let bg, col;
      if (mushafViewMode === "weak") {
        const pageStruggle = cs.reduce((sum, c) => sum + (c.struggleCount || 0), 0);
        const ratio = pageStruggle / maxStruggle;
        bg = pageStruggle === 0 ? "var(--surface-2)" : ratio > 0.6 ? "var(--bad-soft)" : "var(--gold-soft)";
        col = pageStruggle === 0 ? "var(--text-muted)" : ratio > 0.6 ? "var(--bad)" : "var(--gold)";
      } else {
        // Weighted by actual mastery stage, not just a mature/not-mature
        // split -- a page sitting entirely at "young" used to average out
        // identical to a page of untouched new cards (both have zero
        // MATURE cards), which silently contradicted the legend's own
        // three-tier promise right above this grid.
        const stageWeight = c => { const st = masteryStage(c); return st === "mature" ? 1 : st === "young" ? 0.55 : 0; };
        const avgWeight = cs.reduce((sum, c) => sum + stageWeight(c), 0) / cs.length;
        bg = avgWeight > 0.7 ? "var(--good-soft)" : avgWeight > 0.3 ? "var(--gold-soft)" : "var(--surface-2)";
        col = avgWeight > 0.7 ? "var(--good)" : avgWeight > 0.3 ? "var(--gold)" : "var(--text-muted)";
      }
      return `<button class="mushaf-page-cell has-verses" data-page="${p}" style="background:${bg};color:${col};border-color:${col}" title="Tap to listen — ${cs.length} verse(s) on page ${p}">${p}</button>`;
    }).join("");

    const topStruggles = allCards
      .filter(c => (c.struggleCount || 0) > 0)
      .sort((a, b) => (b.struggleCount || 0) - (a.struggleCount || 0))
      .slice(0, 8);

    screenEl.innerHTML = `
      <div class="container">
        <div class="hero" style="padding-top:0">
          <h1 style="font-size:1.6rem">Mushaf</h1>
          <p>${mushafViewMode === "weak"
            ? "Where you've actually struggled — built from your own Again/Hard ratings and sard stumble taps, not guessed."
            : 'Each square is a real mushaf page containing verses you\'re memorizing. Color shows how mature that page is — the same spatial "where on the page" memory ḥuffāẓ rely on.'}</p>
        </div>
        <div class="mushaf-toggle">
          <button class="mushaf-toggle-btn ${mushafViewMode === "mastery" ? "active" : ""}" data-mode="mastery">Mastery</button>
          <button class="mushaf-toggle-btn ${mushafViewMode === "weak" ? "active" : ""}" data-mode="weak">Weak Points</button>
        </div>
        <div class="mushaf-grid">${cells}</div>
        ${mushafViewMode === "weak" ? `
          <div class="mushaf-legend">
            <span><span class="legend-swatch" style="background:var(--surface-2)"></span>No struggle logged</span>
            <span><span class="legend-swatch" style="background:var(--gold-soft)"></span>Some struggle</span>
            <span><span class="legend-swatch" style="background:var(--bad-soft)"></span>Frequent struggle</span>
          </div>
          ${topStruggles.length ? `
            <div class="weak-list">
              <div class="weak-list-heading">Your top struggle verses</div>
              ${topStruggles.map(c => `
                <button class="weak-row" data-key="${cardKey(c.surah, c.ayah)}">
                  <div class="weak-row-info">
                    <div class="en">${escapeHtml(refBadge(c))}</div>
                    <div class="sub">${c.struggleCount} struggle${c.struggleCount === 1 ? "" : "s"} logged</div>
                  </div>
                  <div class="weak-cta">Drill now →</div>
                </button>
              `).join("")}
            </div>
          ` : `<p style="text-align:center;color:var(--text-muted);font-size:0.85rem;margin-top:16px">No struggles logged yet — that's a good thing.</p>`}
        ` : `
          <div class="mushaf-legend">
            <span><span class="legend-swatch" style="background:var(--surface-2)"></span>New/learning</span>
            <span><span class="legend-swatch" style="background:var(--gold-soft)"></span>Young</span>
            <span><span class="legend-swatch" style="background:var(--good-soft)"></span>Mature</span>
          </div>
        `}
      </div>
    `;
    document.querySelectorAll(".mushaf-toggle-btn").forEach(btn => {
      btn.addEventListener("click", () => { mushafViewMode = btn.dataset.mode; renderMushaf(); });
    });
    document.querySelectorAll(".weak-row").forEach(btn => {
      btn.addEventListener("click", () => startDrill(btn.dataset.key));
    });
    document.querySelectorAll(".mushaf-page-cell.has-verses").forEach(btn => {
      btn.addEventListener("click", () => renderPageListen(Number(btn.dataset.page)));
    });
  }

  // ---------- page listen (passive, follow-along recitation) ----------
  // Deliberately the opposite of Sard: text stays fully visible throughout,
  // there's no rating and no "stumbled" tracking -- this is for following
  // along and reinforcing familiarity, not testing recall. Tapping any page
  // in the Mushaf grid (either view) opens straight into this.
  let pageListenState = null; // { page, verses, idx, playing }

  async function renderPageListen(pageNum) {
    const verses = Object.values(cards)
      .filter(c => c.page === pageNum)
      .sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
    if (!verses.length) return renderMushaf();
    cancelAudio();
    pageListenState = { page: pageNum, verses, idx: 0, playing: false };
    // Prefetch word data (for tap/highlight spans) and real timing
    // segments (for the highlight itself) up front, rather than relying
    // on them already being cached from an earlier Library visit.
    const surahs = [...new Set(verses.map(v => v.surah))];
    await Promise.all(surahs.flatMap(s => [ensureWordsLoaded(s), ensureSegmentsLoaded(s)]));
    drawPageListen();
  }

  function drawPageListen() {
    const { page, verses, idx } = pageListenState;
    const lines = verses.map((v, i) => `
      <div class="listen-line ${i === idx ? "current" : ""}" data-i="${i}">
        <div class="listen-line-ref">${escapeHtml(refBadge(v))}</div>
        <div class="listen-line-arabic">${arabicHtmlFor(v)}</div>
        <div class="listen-line-translation">${escapeHtml(v.translation)}</div>
      </div>
    `).join("");

    screenEl.innerHTML = `
      <div class="review-bar">
        <button class="exit-btn" id="exitListenBtn">&times;</button>
        <div class="progress-track"><div class="progress-fill" id="listenProgressFill" style="width:0%"></div></div>
      </div>
      <div class="container">
        <div class="hero" style="padding-top:12px;padding-bottom:4px">
          <div class="hero-eyebrow">Listen · Page ${page}</div>
          <h1 style="font-size:1.4rem">Follow along</h1>
          <p>Passive listening — text stays visible. Good for reinforcement and tadabbur, not a memory test.</p>
        </div>
        <div class="sard-controls">
          <button class="play-btn" id="listenPlayBtn">${ICON_PLAY}</button>
          <button class="secondary-btn" id="listenPrevBtn">${ICON_PREV} Prev</button>
          <button class="secondary-btn" id="listenNextBtn">Next ${ICON_NEXT}</button>
        </div>
        <div class="listen-lines" id="listenLines">${lines}</div>
      </div>
    `;
    wireWordTooltips(document.getElementById("listenLines"));
    document.getElementById("exitListenBtn").addEventListener("click", () => { cancelAudio(); pageListenState = null; renderMushaf(); });
    document.getElementById("listenPlayBtn").addEventListener("click", togglePageListenPlayback);
    document.getElementById("listenPrevBtn").addEventListener("click", () => stepPageListen(-1));
    document.getElementById("listenNextBtn").addEventListener("click", () => stepPageListen(1));
    document.querySelectorAll(".listen-line").forEach(el => {
      el.addEventListener("click", () => {
        cancelAudio();
        pageListenState.playing = false;
        pageListenState.idx = Number(el.dataset.i);
        drawPageListen();
      });
    });
    updatePageListenProgress();
    const current = document.querySelector(".listen-line.current");
    if (current) current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function updatePageListenProgress() {
    const { verses, idx } = pageListenState;
    const pct = Math.round((idx / Math.max(1, verses.length - 1)) * 100);
    const fill = document.getElementById("listenProgressFill");
    if (fill) fill.style.width = pct + "%";
  }

  function togglePageListenPlayback() {
    const btn = document.getElementById("listenPlayBtn");
    if (pageListenState.playing) {
      pageListenState.playing = false;
      cancelAudio();
      btn.innerHTML = ICON_PLAY;
      btn.classList.remove("playing");
      return;
    }
    pageListenState.playing = true;
    btn.innerHTML = ICON_PAUSE;
    btn.classList.add("playing");
    playCurrentPageListenVerse();
  }
  function playCurrentPageListenVerse() {
    if (!pageListenState || !pageListenState.playing) return;
    const v = pageListenState.verses[pageListenState.idx];
    const container = document.querySelector(".listen-line.current .listen-line-arabic");
    const btn = document.getElementById("listenPlayBtn");
    if (btn) clearPlayError(btn);
    // Prefetch the next verse while this one plays -- same reasoning as
    // Sard's own prefetch: a continuous playback feature is exactly where
    // a mid-stream network hiccup is most disruptive.
    const next = pageListenState.verses[pageListenState.idx + 1];
    if (next) warmAudioCache(audioUrlFor(next.surah, next.ayah), { reciter: currentReciter, surah: next.surah, ayah: next.ayah });
    playAudioWithHighlight(v.surah, v.ayah, container, () => {
      if (!pageListenState || !pageListenState.playing) return;
      if (pageListenState.idx >= pageListenState.verses.length - 1) {
        pageListenState.playing = false;
        const b = document.getElementById("listenPlayBtn");
        if (b) { b.innerHTML = ICON_PLAY; b.classList.remove("playing"); }
        return;
      }
      pageListenState.idx++;
      drawPageListen();
      const b = document.getElementById("listenPlayBtn");
      if (b) { b.innerHTML = ICON_PAUSE; b.classList.add("playing"); }
      playCurrentPageListenVerse();
    }, () => {
      // A genuine failure (retries already exhausted) used to fall
      // through to the same callback as a real completion, silently
      // advancing past the verse that actually failed -- see the matching
      // fix in Sard's playCurrentSardVerse() for the full reasoning.
      if (!pageListenState) return;
      pageListenState.playing = false;
      if (btn) { btn.innerHTML = ICON_PLAY; btn.classList.remove("playing"); showPlayError(btn); }
    });
  }
  function stepPageListen(delta) {
    cancelAudio();
    pageListenState.playing = false;
    pageListenState.idx = Math.max(0, Math.min(pageListenState.verses.length - 1, pageListenState.idx + delta));
    drawPageListen();
  }
  // Same move as stepPageListen(), but keeps playing at the new verse if
  // it was already playing -- what a lock-screen/Bluetooth previous/next
  // button actually means (skip within the stream), as opposed to the
  // in-app step buttons which deliberately stop for a manual, silent
  // browse.
  function pageListenStepAndContinue(delta) {
    if (!pageListenState) return;
    const wasPlaying = pageListenState.playing;
    cancelAudio();
    pageListenState.playing = false;
    pageListenState.idx = Math.max(0, Math.min(pageListenState.verses.length - 1, pageListenState.idx + delta));
    drawPageListen();
    if (wasPlaying) {
      pageListenState.playing = true;
      const btn = document.getElementById("listenPlayBtn");
      if (btn) { btn.innerHTML = ICON_PAUSE; btn.classList.add("playing"); }
      playCurrentPageListenVerse();
    }
  }

  function startDrill(key) {
    const card = cards[key];
    if (!card) return;
    cancelAudio();
    session = { queue: [card], total: 1, idx: 0, isDrill: true };
    renderReviewChrome();
    renderNextCard();
  }

  // ---------- review session ----------
  async function startWird() {
    const { due, fresh } = computeQueue();
    const queue = [...due, ...fresh];
    if (!queue.length) return renderHome();
    updateStreak();
    session = { queue, total: queue.length, idx: 0 };
    // Prefetch word-by-word data (tap-for-transliteration) and real
    // per-word timing (highlight-while-listening) for every surah in
    // today's queue, so both are ready immediately rather than only after
    // a separate Library visit -- fire in parallel, don't block the render.
    [...new Set(queue.map(c => c.surah))].forEach(s => { ensureWordsLoaded(s); ensureSegmentsLoaded(s); });
    renderReviewChrome();
    await renderNextCard();
  }

  function renderReviewChrome() {
    resetCombo();
    screenEl.innerHTML = `
      <div class="review-bar">
        <button class="exit-btn" id="exitReviewBtn">&times;</button>
        <div class="progress-track"><div class="progress-fill" id="reviewProgressFill" style="width:0%"></div></div>
        <span class="combo-badge" id="comboBadge"></span>
        ${VOICE_MIRROR_SUPPORTED ? `<button class="mic-btn" id="voiceMirrorBtn" aria-label="Voice Mirror — record and compare your own recitation" title="Voice Mirror">${ICON_MIC}</button>` : ""}
      </div>
      <div id="reviewHost"></div>
    `;
    document.getElementById("exitReviewBtn").addEventListener("click", () => { cancelAudio(); renderHome(); });
    const micBtn = document.getElementById("voiceMirrorBtn");
    if (micBtn) micBtn.addEventListener("click", () => { if (currentReviewCard) openVoiceMirror(currentReviewCard); });
  }
  function updateReviewProgress() {
    const pct = session.total ? Math.round((session.idx / session.total) * 100) : 0;
    const fill = document.getElementById("reviewProgressFill");
    if (fill) fill.style.width = pct + "%";
  }

  function cancelAudio() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    clearMediaSession();
  }

  // ---------- Media Session: lock-screen / Bluetooth / car controls ----------
  // A serious hifz app is routinely used with the phone locked or the
  // screen off -- in a pocket during a commute, with earbuds, over car
  // Bluetooth. Without this, the only way to pause or move between verses
  // is unlocking the phone and finding the right on-screen button again.
  // This wires real title/reciter metadata and play/pause/prev/next into
  // the same OS-level media surface every music and podcast app uses.
  function surahLabel(num) {
    const meta = surahList.find(s => s.number === num);
    return meta ? meta.englishName : `Surah ${num}`;
  }
  // Every ayah URL from audioUrlFor() ends in {surah:03d}{ayah:03d}.mp3 --
  // parsed back out here so playAudio()/playAudioWithHighlight() can tag
  // the media session from the URL alone, without threading surah/ayah
  // through every one of their many call sites. Non-ayah audio (vocab
  // words, Voice Mirror's own recording) just doesn't match and is
  // silently skipped, which is correct -- those aren't verses.
  function tagMediaSessionFromUrl(url) {
    const m = /(\d{3})(\d{3})\.mp3$/.exec(url);
    if (m) updateMediaSession(Number(m[1]), Number(m[2]));
  }
  function updateMediaSession(surah, ayah) {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${surahLabel(surah)} — Ayah ${ayah}`,
        artist: (RECITERS[currentReciter] && RECITERS[currentReciter].name) || "",
        album: "Wird",
        artwork: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });
      navigator.mediaSession.playbackState = "playing";
    } catch (e) { /* MediaMetadata unsupported/blocked -- this is a bonus, never required for playback itself */ }
  }
  function clearMediaSession() {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = "none";
  }
  function wireMediaSessionActions() {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setActionHandler) return;
    const safeHandler = (action, fn) => {
      try { navigator.mediaSession.setActionHandler(action, fn); }
      catch (e) { /* action not supported on this platform -- fine, it just won't appear */ }
    };
    safeHandler("play", () => {
      if (!currentAudio) return;
      currentAudio.play().catch(() => {});
      navigator.mediaSession.playbackState = "playing";
    });
    safeHandler("pause", () => {
      if (!currentAudio) return;
      currentAudio.pause();
      navigator.mediaSession.playbackState = "paused";
    });
    // Prev/next only make real sense inside a fixed verse sequence -- Sard
    // or the Mushaf page-listen view -- a lone review card has no "next"
    // to speak of, so these are silent no-ops otherwise rather than doing
    // something surprising.
    safeHandler("previoustrack", () => {
      if (sardSession) retreatSard();
      else if (pageListenState) pageListenStepAndContinue(-1);
    });
    safeHandler("nexttrack", () => {
      if (sardSession) advanceSard(sardSession.playing);
      else if (pageListenState) pageListenStepAndContinue(1);
    });
  }
  // Called at the top of every top-level screen render so leftover state
  // from whichever session-like flow (verse review, sard, page-listen,
  // vocab review) the user was in doesn't leak into the next screen.
  function resetActiveSessions() {
    session = null;
    sardSession = null;
    pageListenState = null;
    vocabSession = null;
    currentReviewCard = null;
    clearReviewKeydownCleanup();
  }
  // Every review card that wires its own document-level keydown listener
  // (rating row swipe/keys, story-card swipe/arrow keys) only removes it
  // when a rating is actually applied. If a card is abandoned instead --
  // the exit button, switching tabs, navigating elsewhere mid-card -- that
  // listener used to leak on `document` forever, and could fire again
  // later against its now-stale `card` closure, silently misapplying a
  // rating to whatever session happened to be active by then. Routing
  // every add/remove through this single tracked slot means wiring a new
  // listener always tears down whatever the previous one left behind, and
  // resetActiveSessions() (called on every top-level screen render) is a
  // catch-all backstop for every exit path at once.
  let activeReviewKeydownCleanup = null;
  function setReviewKeydownCleanup(fn) {
    if (activeReviewKeydownCleanup) activeReviewKeydownCleanup();
    activeReviewKeydownCleanup = fn;
  }
  function clearReviewKeydownCleanup() {
    if (activeReviewKeydownCleanup) { activeReviewKeydownCleanup(); activeReviewKeydownCleanup = null; }
  }
  // ---------- persistent offline audio storage (IndexedDB) ----------
  // A real, cross-reload offline cache -- what used to live here was an
  // in-memory Map that was gone the moment the tab reloaded, which meant
  // "offline support" only ever covered a live tab that happened to have
  // already played something earlier in the exact same session. This
  // layer is what makes the Downloads screen's explicit "save this for
  // offline" actually mean something. Keyed by the full audio URL (which
  // already encodes reciter+surah+ayah via audioUrlForReciter's folder
  // naming), so lookups never need to parse it back apart.
  const OFFLINE_DB_NAME = "wird-offline-v1";
  const OFFLINE_DB_VERSION = 1;
  const OFFLINE_STORE = "audio";
  let offlineDbPromise = null;
  function openOfflineDb() {
    if (offlineDbPromise) return offlineDbPromise;
    offlineDbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) { reject(new Error("no indexedDB")); return; }
      const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
          const store = db.createObjectStore(OFFLINE_STORE, { keyPath: "url" });
          store.createIndex("reciter", "reciter", { unique: false });
          store.createIndex("reciterSurah", ["reciter", "surah"], { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return offlineDbPromise;
  }
  function idbPut(record) {
    return openOfflineDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_STORE, "readwrite");
      tx.objectStore(OFFLINE_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }
  function idbGet(url) {
    return openOfflineDb().then((db) => new Promise((resolve, reject) => {
      const req = db.transaction(OFFLINE_STORE, "readonly").objectStore(OFFLINE_STORE).get(url);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    }));
  }
  function idbDelete(url) {
    return openOfflineDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_STORE, "readwrite");
      tx.objectStore(OFFLINE_STORE).delete(url);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }
  function idbGetAllByReciter(reciterId) {
    return openOfflineDb().then((db) => new Promise((resolve, reject) => {
      const idx = db.transaction(OFFLINE_STORE, "readonly").objectStore(OFFLINE_STORE).index("reciter");
      const req = idx.getAll(IDBKeyRange.only(reciterId));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }));
  }
  function idbGetAllByReciterSurah(reciterId, surah) {
    return openOfflineDb().then((db) => new Promise((resolve, reject) => {
      const idx = db.transaction(OFFLINE_STORE, "readonly").objectStore(OFFLINE_STORE).index("reciterSurah");
      const req = idx.getAll(IDBKeyRange.only([reciterId, surah]));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }));
  }
  function idbDeleteByReciterSurah(reciterId, surah) {
    return openOfflineDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_STORE, "readwrite");
      const idx = tx.objectStore(OFFLINE_STORE).index("reciterSurah");
      const cursorReq = idx.openCursor(IDBKeyRange.only([reciterId, surah]));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }
  function idbDeleteByReciter(reciterId) {
    return openOfflineDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_STORE, "readwrite");
      const idx = tx.objectStore(OFFLINE_STORE).index("reciter");
      const cursorReq = idx.openCursor(IDBKeyRange.only(reciterId));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }

  // Offline audio, done carefully this time. The earlier attempt broke
  // playback outright (online included) by gating every single play() on a
  // fetch()-then-blob step FIRST -- meaning any hiccup in that step delayed
  // or blocked the primary path itself. This version never does that: the
  // primary path is always a plain <audio src>, played directly, exactly
  // as it's always reliably worked. Caching is entirely a SIDE EFFECT that
  // can never block or compete with real playback:
  //   - proactively, only when navigator.onLine is already false, so a
  //     genuinely-offline session skips a doomed network attempt and goes
  //     straight to whatever's cached, instead of adding a stall+fallback;
  //   - reactively, on a real 'error' event, in case onLine lied;
  //   - and the cache itself is only ever warmed AFTER a play finishes
  //     successfully (the 'ended' event), never alongside a live stream,
  //     so it can't contend for bandwidth with the audio someone is
  //     actually listening to right now.
  // Explicit CORS mode, not no-cors -- everyayah.com and audio.qurancdn.com
  // both send Access-Control-Allow-Origin: * (verified live), and no-cors
  // was a real, silent mistake here: an opaque response's blob() ALWAYS
  // resolves with size 0 (verified live too -- the browser deliberately
  // blocks JS from reading any opaque response body, not just its
  // headers/status), so this fallback path was dead code from day one --
  // it always deleted its own cache entry a moment after "warming" it,
  // never actually storing a playable blob for cachedBlobFor() to return.
  // Each unique URL is only ever warmed once per page load in-memory;
  // successful warms also persist to IndexedDB (fire-and-forget, never
  // awaited) so casual online listening quietly builds up real offline
  // coverage over time, on top of whatever the Downloads screen explicitly
  // saved.
  const audioBlobUrlCache = new Map();
  function warmAudioCache(url, meta) {
    if (audioBlobUrlCache.has(url)) return;
    audioBlobUrlCache.set(url, "pending");
    fetch(url, { mode: "cors" }).then((res) => {
      if (!res.ok) { audioBlobUrlCache.delete(url); return null; }
      return res.blob();
    }).then((blob) => {
      if (blob && blob.size) {
        audioBlobUrlCache.set(url, URL.createObjectURL(blob));
        if (meta) {
          idbPut({ url, reciter: meta.reciter, surah: meta.surah, ayah: meta.ayah, bytes: blob.size, cachedAt: Date.now(), blob }).catch(() => {});
        }
      }
      else audioBlobUrlCache.delete(url);
    }).catch(() => audioBlobUrlCache.delete(url));
  }
  function cachedBlobFor(url) {
    const v = audioBlobUrlCache.get(url);
    return v && v !== "pending" ? v : null;
  }
  // Async persistent-cache lookup, used when the in-memory Map above (which
  // only remembers what's been warmed THIS session) misses -- e.g. a fresh
  // offline reload where nothing has played yet this session but was
  // explicitly downloaded (or opportunistically cached) in a past one.
  // Deliberately fire-and-forget: it just populates audioBlobUrlCache so
  // the EXISTING synchronous cachedBlobFor()/retry-fallback logic already
  // proven in playAudio()/playAudioWithHighlight() picks it up naturally
  // on the next retry tick, rather than making those functions async.
  function warmFromPersistentCache(url) {
    if (audioBlobUrlCache.has(url)) return;
    idbGet(url).then((record) => {
      if (record && record.blob && !audioBlobUrlCache.has(url)) {
        audioBlobUrlCache.set(url, URL.createObjectURL(record.blob));
      }
    }).catch(() => {});
  }
  // Reverse-maps an everyayah.com URL back into {reciter, surah, ayah} so
  // the generic playAudio(url) -- used for plenty of non-Quran audio too
  // (vocab recordings, etc.) -- can still persist a successful play to
  // IndexedDB without needing its signature to carry that context through
  // every call site. Returns null for anything that doesn't match the
  // exact everyayah.com/data/<folder>/SSSAAA.mp3 shape, which is always
  // safe: no metadata just means that particular warm() doesn't persist,
  // never an error.
  const RECITER_FOLDER_TO_ID = Object.fromEntries(Object.entries(RECITERS).map(([id, r]) => [r.folder, id]));
  function parseAyahMetaFromUrl(url) {
    const m = /everyayah\.com\/data\/([^/]+)\/(\d{3})(\d{3})\.mp3$/.exec(url);
    if (!m) return null;
    const reciter = RECITER_FOLDER_TO_ID[m[1]];
    if (!reciter) return null;
    return { reciter, surah: parseInt(m[2], 10), ayah: parseInt(m[3], 10) };
  }

  // onError (optional) fires only once retry has genuinely been exhausted,
  // so a caller that wants to show a real "couldn't play" state can (see
  // the story-mode play buttons below) -- callers that don't pass one just
  // get onEnd either way, same as before.
  function playAudio(url, rate, onEnd, onError) {
    cancelAudio();
    const offlineBlob = !navigator.onLine ? cachedBlobFor(url) : null;
    if (!navigator.onLine && !offlineBlob) warmFromPersistentCache(url);
    const audio = new Audio(offlineBlob || url);
    audio.playbackRate = rate || 1;
    currentAudio = audio;
    let settled = false;
    let retryCount = 0;
    let usedCacheFallback = false;
    // Two retries (three attempts total) with increasing backoff -- a
    // single retry only survives one transient blip; real-world CDN
    // hiccups can string together more than one failure in a row.
    const RETRY_DELAYS = [500, 1500];
    const MAX_RETRIES = RETRY_DELAYS.length;
    // A failed load fires BOTH the play() promise rejection AND the
    // element's own 'error' event -- without this guard, handleError runs
    // twice for what is really just one failed attempt, consuming a retry
    // before the real retry ever gets to execute.
    let handledThisAttempt = false;
    const finish = () => { if (settled) return; settled = true; if (onEnd) onEnd(); };
    // Once an <audio> element's src has already failed, calling .play()
    // again on it does NOT re-issue a network request at all -- it just
    // immediately re-rejects based on the element's already-errored state.
    // .load() is what actually resets it and triggers a fresh fetch;
    // without this the "retry" was never really retrying anything (caught
    // via a direct test: the mocked network layer only ever saw the one
    // original request, never a second one, even though the retry path
    // was genuinely executing).
    function retryPlay() {
      handledThisAttempt = false;
      audio.load();
      audio.play().catch(handleError);
    }
    // Reported real-world symptom: plays "sometimes, not others" while
    // fully online, in both the installed app and a plain Safari tab --
    // not a gesture/autoplay-policy issue (Safari tabs aren't strict about
    // that), just an occasional transient failure (weak signal, a dropped
    // request, a slow DNS lookup) that used to fail completely silently --
    // the button's "playing" state just quietly reverted with no
    // indication anything went wrong and no way to retry short of
    // guessing to tap again. Automatic retries clear the large majority
    // of those on their own; if they ALSO all fail, onError lets the
    // caller show something the user can actually act on.
    function handleError() {
      if (currentAudio !== audio || settled || handledThisAttempt) return;
      handledThisAttempt = true;
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount];
        retryCount++;
        const cached = !offlineBlob && !usedCacheFallback && cachedBlobFor(url);
        if (cached) { usedCacheFallback = true; audio.src = cached; retryPlay(); }
        else setTimeout(() => { if (currentAudio === audio && !settled) retryPlay(); }, delay);
        return;
      }
      settled = true;
      if (onError) onError(); else if (onEnd) onEnd();
    }
    audio.addEventListener("ended", () => {
      finish();
      if (!offlineBlob) warmAudioCache(url, parseAyahMetaFromUrl(url));
    });
    audio.addEventListener("error", handleError);
    audio.play().catch(handleError);
    tagMediaSessionFromUrl(url);
    return audio;
  }

  // Plays a verse's audio while highlighting the word currently being
  // recited, using real per-word timing (see ensureSegmentsLoaded) rather
  // than a guessed/animated approximation. Only lights up when both a
  // timing source exists (Alafasy only) AND the container actually has
  // data-pos word spans (i.e. word data was loaded) -- silently falls
  // back to plain playback otherwise, same graceful-degradation spirit
  // as every other optional-data feature in this app. Same offline
  // caching approach as playAudio() above -- see the note there.
  async function playAudioWithHighlight(surah, ayah, containerEl, onEnd, onError) {
    const segByAyah = await ensureSegmentsLoaded(surah).catch(() => null);
    const segments = segByAyah && segByAyah[ayah];
    cancelAudio();
    const url = audioUrlFor(surah, ayah);
    const offlineBlob = !navigator.onLine ? cachedBlobFor(url) : null;
    if (!navigator.onLine && !offlineBlob) warmFromPersistentCache(url);
    const audio = new Audio(offlineBlob || url);
    currentAudio = audio;
    let rafId = null;
    let settled = false;
    let retryCount = 0;
    let usedCacheFallback = false;
    const RETRY_DELAYS = [500, 1500]; // see the matching note in playAudio()
    const MAX_RETRIES = RETRY_DELAYS.length;
    let handledThisAttempt = false; // see the matching note in playAudio() -- a failed load fires both the play() rejection and the 'error' event for the same attempt
    // .load() is required to actually re-trigger a fresh network fetch on
    // retry -- see the matching note in playAudio().
    function retryPlay() {
      handledThisAttempt = false;
      audio.load();
      audio.play().catch(handleError);
    }
    function clearHighlight() {
      if (containerEl) containerEl.querySelectorAll(".word-playing").forEach(el => el.classList.remove("word-playing"));
    }
    function tick() {
      if (!currentAudio || currentAudio !== audio) { clearHighlight(); return; } // superseded/paused externally (e.g. cancelAudio() from a manual pause) -- clean up our own highlight rather than leaving it stuck
      // If playback paused/stalled without going through cancelAudio() --
      // a lock-screen/Bluetooth pause, the tab backgrounding, a network
      // stall that never reaches 'ended' or 'error' -- stop rescheduling
      // rather than spinning this rAF loop at full speed forever. The
      // existing "play" listener below already re-kicks tick() if
      // playback resumes, so this doesn't need its own resume handling.
      if (audio.paused) return;
      if (segments && containerEl) {
        const ms = audio.currentTime * 1000;
        const seg = segments.find(([, start, end]) => ms >= start && ms < end);
        clearHighlight();
        if (seg) {
          const el = containerEl.querySelector(`[data-pos="${seg[0]}"]`);
          if (el) el.classList.add("word-playing");
        }
      }
      rafId = requestAnimationFrame(tick);
    }
    audio.addEventListener("play", () => { if (segments) rafId = requestAnimationFrame(tick); });
    const settle = () => { if (settled) return; settled = true; if (rafId) cancelAnimationFrame(rafId); clearHighlight(); if (onEnd) onEnd(); };
    // Same one-automatic-retry-then-report approach as playAudio() -- see
    // the note there.
    function handleError() {
      if (currentAudio !== audio || settled || handledThisAttempt) return;
      handledThisAttempt = true;
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount];
        retryCount++;
        const cached = !offlineBlob && !usedCacheFallback && cachedBlobFor(url);
        if (cached) { usedCacheFallback = true; audio.src = cached; retryPlay(); }
        else setTimeout(() => { if (currentAudio === audio && !settled) retryPlay(); }, delay);
        return;
      }
      settled = true;
      if (rafId) cancelAnimationFrame(rafId);
      clearHighlight();
      if (onError) onError(); else if (onEnd) onEnd();
    }
    audio.addEventListener("ended", () => {
      settle();
      if (!offlineBlob) warmAudioCache(url, parseAyahMetaFromUrl(url));
    });
    audio.addEventListener("error", handleError);
    audio.play().catch(handleError);
    tagMediaSessionFromUrl(url);
    return audio;
  }

  // Visible feedback for the story-mode play buttons specifically, once
  // playAudio()/playAudioWithHighlight() have genuinely exhausted their
  // retry and given up -- turns a silent, easy-to-miss failure into
  // something the user can see and immediately act on with another tap
  // (clearPlayError runs at the start of every new attempt, so it never
  // lingers past a subsequent success).
  function showPlayError(btn) {
    if (!btn) return;
    btn.classList.add("play-error");
    btn.innerHTML = ICON_RETRY;
    btn.setAttribute("aria-label", "Couldn't play — tap to retry");
  }
  function clearPlayError(btn) {
    if (!btn || !btn.classList.contains("play-error")) return;
    btn.classList.remove("play-error");
    btn.innerHTML = ICON_PLAY;
    btn.setAttribute("aria-label", btn.dataset.playLabel || "Play recitation");
  }

  function wordDataFor(card) {
    const bySurah = wordsCache[String(card.surah)];
    return (bySurah && bySurah[card.ayah]) || null;
  }
  function hasConsecutiveTriple(card) {
    const key1 = cardKey(card.surah, card.ayah + 1);
    const key2 = cardKey(card.surah, card.ayah + 2);
    return !!(cards[key1] && cards[key2]);
  }
  function countAvailableDistractorWords(excludeSurah, excludeAyah) {
    let n = 0;
    Object.values(cards).forEach(c => {
      if (c.surah === excludeSurah && c.ayah === excludeAyah) return;
      const wd = wordDataFor(c);
      if (wd) n += wd.length;
    });
    return n;
  }

  function eligibleModes(card) {
    const stage = masteryStage(card);
    const modes = ["listen"];
    if (stage !== "new") modes.push("fade");
    const wordData = wordDataFor(card);
    if (stage === "learning" || stage === "young" || stage === "mature") {
      if (wordData && wordData.length >= 2 && wordData.length <= 12) modes.push("assemble");
    }
    if (stage === "young" || stage === "mature") {
      modes.push("chain");
      modes.push("page");
      if (Object.keys(cards).length >= 6) modes.push("blindspot");
      if (hasConsecutiveTriple(card)) modes.push("sequence");
      if (wordData && wordData.length >= 3 && countAvailableDistractorWords(card.surah, card.ayah) >= 2) modes.push("cloze");
    }
    return modes;
  }

  async function pickMode(card) {
    const modes = eligibleModes(card);
    let mode = modes[Math.floor(Math.random() * modes.length)];
    if (mode === "chain") {
      const meta = surahList.find(s => s.number === card.surah);
      if (!meta || card.ayah >= meta.numberOfAyahs) mode = "fade"; // no next verse to chain to
    }
    return mode;
  }

  async function renderNextCard() {
    if (session.idx >= session.total) return renderSessionComplete();
    updateReviewProgress();
    const card = session.queue[session.idx];
    currentReviewCard = card;
    const host = document.getElementById("reviewHost");
    if (!host) return;

    // opportunistic mutashabih check: only offer if we find a real match in the user's set
    const mutashabihMatch = findMutashabih(card);
    let mode = await pickMode(card);
    if (mutashabihMatch && masteryStage(card) !== "new" && Math.random() < 0.4) mode = "mutashabih";
    renderCardInMode(host, card, mode, mutashabihMatch);
  }

  function renderCardInMode(host, card, mode, mutashabihMatch) {
    if (mode === "listen") return renderListenRecall(host, card);
    if (mode === "fade") return renderFadeRecall(host, card);
    if (mode === "chain") return renderChainTest(host, card);
    if (mode === "page") return renderPageSense(host, card);
    if (mode === "mutashabih") return renderMutashabih(host, card, mutashabihMatch);
    if (mode === "blindspot") return renderBlindSpot(host, card);
    if (mode === "assemble") return renderAssemble(host, card);
    if (mode === "sequence") return renderSequence(host, card);
    if (mode === "cloze") return renderCloze(host, card);
    return renderListenRecall(host, card);
  }

  // The two "story" modes autoplay recitation audio the instant they render
  // (Listen & Recall loops it, Fade Recall plays it once) -- genuinely
  // disruptive if the user can't have sound on right now (a quiet room, a
  // public place). "Can't listen now" re-rolls the SAME card into whichever
  // of its other eligible modes doesn't autoplay audio, with no rating
  // applied (the user never got a fair attempt at this one). A brand-new
  // card has no non-audio mode at all -- Listen & Recall is deliberately
  // the only way new material gets introduced -- so there's nothing fair to
  // swap in; skip the whole card for this sitting instead. Either way this
  // never touches the card's schedule, so it comes right back once the user
  // can actually listen again.
  const AUDIO_VERSE_MODES = ["listen", "fade"];
  function skipListeningExercise(card) {
    cancelAudio();
    clearReviewKeydownCleanup();
    const host = document.getElementById("reviewHost");
    if (!host) return;
    const silent = eligibleModes(card).filter(m => !AUDIO_VERSE_MODES.includes(m));
    if (!silent.length) {
      session.idx++;
      renderNextCard();
      return;
    }
    const mode = silent[Math.floor(Math.random() * silent.length)];
    renderCardInMode(host, card, mode, null);
  }
  function cantListenBtnHtml() {
    return `<button type="button" class="cant-listen-btn" id="cantListenBtn">Can't listen right now</button>`;
  }
  // ArrowLeft/ArrowRight rating shortcuts already existed on every one of
  // these cards but had zero visible hint anywhere -- hidden entirely
  // unless someone happened to try an arrow key. CSS-gated to
  // hover:hover+pointer:fine so it doesn't show up on touch-only devices,
  // where these keys don't apply at all.
  function kbdHintHtml() {
    return `<div class="kbd-hint"><kbd>&larr;</kbd> again &nbsp;&middot;&nbsp; good <kbd>&rarr;</kbd></div>`;
  }
  // onSettle lets the caller flip its own local `settled` flag first, so a
  // loop/timer chain already in flight (Listen & Recall's replay loop,
  // Fade Recall's single autoplay) doesn't fire again into whatever
  // different, non-audio exercise gets swapped in underneath it.
  function wireCantListenBtn(card, onSettle) {
    const btn = document.getElementById("cantListenBtn");
    if (btn) btn.addEventListener("click", () => { if (onSettle) onSettle(); skipListeningExercise(card); });
  }

  function refBadge(card) {
    const meta = surahList.find(s => s.number === card.surah);
    const name = meta ? meta.englishName : `Surah ${card.surah}`;
    return `${name} ${card.ayah}`;
  }

  // Generic 2-direction drag gesture, used by every review card's
  // story-swipe-zone. Drags `el` itself (translate + tilt +
  // tint), commits to onRight/onLeft once dragged past `threshold`,
  // snaps back below it. A plain tap (no real horizontal movement) never
  // touches these callbacks, so any nested clickable child (a button,
  // the reveal area) keeps its native click working untouched --
  // `wasRecentlyDragged()` lets a caller with such children double-check
  // before treating a click as a real, independent tap.
  function wireHorizontalSwipe(el, { onLeft, onRight, threshold = 64, maxVisual = 160, moveThreshold = 10 } = {}) {
    let dragging = false, moved = false, startX = 0, startY = 0, deltaX = 0;
    function applyVisual(dx) {
      const clamped = Math.max(-maxVisual, Math.min(maxVisual, dx));
      el.style.transform = `translateX(${clamped}px) rotate(${(clamped / 30).toFixed(2)}deg)`;
      el.classList.toggle("swipe-right", dx > threshold);
      el.classList.toggle("swipe-left", dx < -threshold);
    }
    function resetVisual() {
      el.style.transform = "";
      el.classList.remove("swipe-right", "swipe-left");
    }
    el.addEventListener("pointerdown", (e) => {
      dragging = true; moved = false; startX = e.clientX; startY = e.clientY; deltaX = 0;
    });
    el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (!moved && Math.abs(dx) > moveThreshold && Math.abs(dx) > Math.abs(dy)) {
        moved = true;
        el.classList.add("swiping");
        // Capture only once a real drag is confirmed, not on every
        // pointerdown -- capturing unconditionally would redirect a
        // plain stationary tap's resulting click away from whatever
        // nested element (a reveal area, a word) it actually landed on.
        // Without this, the element translating out from under the
        // cursor mid-drag can leave it hovering over something else (or
        // nothing) by release time, and pointerup would silently never
        // reach this listener at all.
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* unsupported pointer type -- fine, falls back to normal hit-testing */ }
      }
      if (moved) { deltaX = dx; applyVisual(dx); }
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      if (e && e.pointerId !== undefined) { try { el.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ } }
      el.classList.remove("swiping");
      const finalDx = deltaX, wasMoved = moved;
      resetVisual();
      if (wasMoved) {
        // A real drag re-settles the pointer over whatever it started
        // on (the whole element translates with it), which WOULD also
        // fire a native click there -- callers check wasRecentlyDragged()
        // before treating that trailing click as independent input.
        if (finalDx > threshold && onRight) onRight();
        else if (finalDx < -threshold && onLeft) onLeft();
        setTimeout(() => { moved = false; }, 0);
      }
    }
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", (e) => {
      // An aborted gesture (not a real release) never commits, even if
      // it had already crossed the threshold -- only endDrag's pointerup
      // path does that.
      if (!dragging) return;
      dragging = false;
      if (e && e.pointerId !== undefined) { try { el.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ } }
      el.classList.remove("swiping");
      resetVisual();
      moved = false;
    });
    return { wasRecentlyDragged: () => moved };
  }
  // Every review card (verse or vocab) wires its own onRight/onLeft
  // directly against wireHorizontalSwipe -- touch/mouse swipe right/left,
  // or Left/Right arrow keys on desktop. There is no shared rating-row
  // component anymore: every mode is now either buttonless (swipe only)
  // or fully auto-graded (see commitVerseObjective/commitVocabObjective
  // below).

  // "4/7" while learning, "2/2" while reviewing -- shown on every
  // objectively-graded exercise below, so the encounter-count rule stays
  // visible even where there's nothing left for the user to tap.
  function phaseProgressHtml(card) {
    const label = phaseProgressLabel(card);
    return label ? `<div class="phase-progress">${escapeHtml(label)}</div>` : "";
  }

  // Every exercise below (word order, missing word, chain test, etc.) has
  // a real, checkable right answer -- the app already knows whether the
  // user got it right. Asking them to ALSO self-rate Again/Hard/Good/Easy
  // on top of that would just let a wrong answer get rated "Good" (or a
  // right one get rated "Again") on nothing but feeling -- exactly the
  // "subjective self-correction" this replaces. Correct maps straight to
  // "good", incorrect to "again"; grading happens the instant the answer
  // is checked, with a short pause to let the feedback + combo register
  // before the next card loads.
  let comboStreak = 0;
  function resetCombo() { comboStreak = 0; updateComboBadge(); }
  function updateComboBadge() {
    const el = document.getElementById("comboBadge");
    if (!el) return;
    if (comboStreak >= 2) { el.textContent = `\u{1F525} ${comboStreak}`; el.classList.add("show"); }
    else { el.classList.remove("show"); }
  }
  function bumpCombo(correct) {
    comboStreak = correct ? comboStreak + 1 : 0;
    updateComboBadge();
  }
  function commitVerseObjective(card, correct) {
    bumpCombo(correct);
    applyRating(card, correct ? "good" : "again");
    saveCards();
    requeueIfDueToday(session, card);
    session.idx++;
    setTimeout(() => renderNextCard(), correct ? 850 : 1500);
  }
  function commitVocabObjective(card, correct) {
    bumpCombo(correct);
    applyRating(card, correct ? "good" : "again");
    saveVocabCards();
    requeueIfDueToday(vocabSession, card);
    vocabSession.idx++;
    setTimeout(() => renderNextVocabCard(), correct ? 850 : 1500);
  }

  // -- mode: listen & recall --
  // Listen & Recall as an immersive, story-style card: the recitation
  // auto-plays and loops -- keeps repeating -- until you swipe. Swipe
  // right ("it's fine") reveals + rates Good and moves on; swipe left
  // ("I don't have this") reveals + rates Again and moves on. Tapping to
  // peek early, the 4-way rating row, and keyboard shortcuts all still
  // work exactly as before -- the swipe is a faster path layered on top,
  // not a replacement for them.
  // Playback is tap-only -- no autoplay, no loop. Browsers (iOS Safari
  // especially, including the installed-PWA WKWebView this app runs in
  // once added to the home screen) only reliably allow audio.play() when
  // it's called synchronously from a real user gesture; a card that tries
  // to start playing itself the instant it renders has no such gesture to
  // point to, which is exactly the kind of silent, hard-to-diagnose
  // failure this app kept running into. A direct tap on the play button
  // always has one.
  function renderListenRecall(host, card) {
    let settled = false;
    host.innerHTML = `
      <div class="review-stage story-mode">
        <div class="story-swipe-zone" id="storySwipeZone">
          <div class="story-bg" aria-hidden="true"></div>
          <div class="story-swipe-hint hint-left">Again</div>
          <div class="story-swipe-hint hint-right">Good</div>
          <div class="story-content">
            <div class="mode-kicker">Listen &amp; Recall</div>
            <div class="ref-badge">${escapeHtml(refBadge(card))}</div>
            <button type="button" class="play-btn story-play-btn" id="storyPlayBtn" aria-label="Play recitation">${ICON_PLAY}</button>
            <div class="story-loop-indicator" id="loopIndicator"><span class="pulse-dot"></span>Tap to listen, swipe when ready</div>
            <div class="card-arabic-box story-arabic-box"><div class="card-arabic">${arabicHtmlFor(card)}</div></div>
            <div class="card-translation">${escapeHtml(card.translation)}</div>
            ${cantListenBtnHtml()}
            ${kbdHintHtml()}
          </div>
        </div>
      </div>
    `;
    const zone = document.getElementById("storySwipeZone");
    wireWordTooltips(zone);
    wireCantListenBtn(card, () => { settled = true; });

    const playBtn = document.getElementById("storyPlayBtn");
    playBtn.addEventListener("click", () => {
      if (settled) return;
      const container = document.querySelector(".story-arabic-box .card-arabic");
      const indicator = document.getElementById("loopIndicator");
      clearPlayError(playBtn);
      playBtn.classList.add("playing");
      if (indicator) indicator.classList.add("playing");
      const onEnd = () => {
        playBtn.classList.remove("playing");
        if (indicator) indicator.classList.remove("playing");
      };
      const onError = () => { onEnd(); showPlayError(playBtn); };
      if (container) playAudioWithHighlight(card.surah, card.ayah, container, onEnd, onError);
      else playAudio(audioUrlFor(card.surah, card.ayah), 1, onEnd, onError);
    });

    wireHorizontalSwipe(zone, {
      onRight: () => commit("good"),
      onLeft: () => commit("again"),
    });
    function onKeydown(e) {
      const active = document.activeElement;
      if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); commit("good"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); commit("again"); }
    }
    document.addEventListener("keydown", onKeydown);
    setReviewKeydownCleanup(() => document.removeEventListener("keydown", onKeydown));

    function commit(ratingKey) {
      if (settled) return;
      settled = true;
      clearReviewKeydownCleanup();
      cancelAudio();
      bumpCombo(ratingKey === "good");
      zone.classList.add(ratingKey === "good" ? "story-committed-good" : "story-committed-again");
      applyRating(card, ratingKey);
      requeueIfDueToday(session, card);
      saveCards();
      session.idx++;
      setTimeout(() => renderNextCard(), 340);
    }
  }

  // -- mode: fade recall --
  // Buttonless, same swipe language as Listen & Recall: some words are
  // hidden, tap to peek and check yourself (that's the exercise, not a
  // rating), then swipe right ("I recalled it") or left ("I didn't") --
  // no rating row.
  function renderFadeRecall(host, card) {
    const stage = masteryStage(card);
    const fadeLevel = stage === "learning" ? 0.15 : stage === "young" ? 0.45 : 0.75;
    // Real per-word spans (same data-pos scheme as arabicHtmlRaw), not
    // plain text -- this used to just split card.text on spaces into
    // dashes or bare escaped words, with no .word-tap markup on ANY of
    // them (hidden or shown). That meant playAudioWithHighlight() had
    // nothing to find a match against, so this mode never had per-word
    // playback highlighting at all, structurally, regardless of what the
    // play button called. Falls back to the old plain-text behavior only
    // if word-by-word data genuinely hasn't loaded yet.
    const bySurah = wordsCache[String(card.surah)];
    const wordData = bySurah && bySurah[card.ayah];
    let faded;
    if (wordData && wordData.length) {
      faded = wordData.map((w, i) => {
        const hide = Math.random() < fadeLevel;
        const dashes = "ـ".repeat(Math.min(4, Math.max(2, w.ar.length)));
        return `<span class="word-tap${hide ? " hidden-word" : ""}" data-pos="${i + 1}" data-tr="${escapeHtml(w.tr)}" data-en="${escapeHtml(w.en)}"${hide ? ` data-real="${escapeHtml(w.ar)}"` : ""}>${hide ? dashes : escapeHtml(w.ar)}</span>`;
      }).join(" ");
    } else {
      const words = card.text.split(" ");
      faded = words.map(w => Math.random() < fadeLevel
        ? `<span class="hidden-word">${"ـ".repeat(Math.min(4, Math.max(2, w.length)))}</span>`
        : escapeHtml(w)
      ).join(" ");
    }
    let settled = false;
    host.innerHTML = `
      <div class="review-stage story-mode">
        <div class="story-swipe-zone" id="storySwipeZone">
          <div class="story-bg" aria-hidden="true"></div>
          <div class="story-swipe-hint hint-left">Again</div>
          <div class="story-swipe-hint hint-right">Good</div>
          <div class="story-content">
            <div class="mode-kicker">Fade Recall</div>
            <div class="ref-badge">${escapeHtml(refBadge(card))}</div>
            <button type="button" class="play-btn story-play-btn" id="storyPlayBtn" aria-label="Play recitation">${ICON_PLAY}</button>
            <div class="story-loop-indicator">Recite the missing words, tap to check</div>
            <div class="card-arabic-box story-arabic-box"><div class="card-arabic tap-to-check" id="fadeArabic">${faded}</div></div>
            <div class="card-translation" id="fadeTranslation"></div>
            ${cantListenBtnHtml()}
            ${kbdHintHtml()}
          </div>
        </div>
      </div>
    `;
    const zone = document.getElementById("storySwipeZone");
    wireWordTooltips(zone);
    wireCantListenBtn(card, () => { settled = true; });
    const playBtn = document.getElementById("storyPlayBtn");
    playBtn.addEventListener("click", () => {
      clearPlayError(playBtn);
      playBtn.classList.add("playing");
      const onEnd = () => playBtn.classList.remove("playing");
      const onError = () => { onEnd(); showPlayError(playBtn); };
      const container = document.getElementById("fadeArabic");
      if (container) playAudioWithHighlight(card.surah, card.ayah, container, onEnd, onError);
      else playAudio(audioUrlFor(card.surah, card.ayah), 1, onEnd, onError);
    });
    document.getElementById("fadeArabic").addEventListener("click", (e) => {
      e.currentTarget.classList.remove("tap-to-check");
      // Un-mask in place (drop .hidden-word, restore the real text) rather
      // than replacing the whole container's innerHTML -- that used to
      // wipe out whatever .word-playing highlight was already mid-flight
      // from a tap that landed while audio was still playing.
      const hiddenSpans = e.currentTarget.querySelectorAll(".hidden-word");
      if (hiddenSpans.length) {
        hiddenSpans.forEach(el => {
          if (el.dataset.real) el.textContent = el.dataset.real;
          el.classList.remove("hidden-word");
        });
      } else if (!e.currentTarget.querySelector(".word-tap")) {
        // Word data wasn't loaded when this card first rendered (the
        // plain-text fallback above) -- nothing here is real markup to
        // patch, so fall back to the old full replace.
        e.currentTarget.innerHTML = arabicHtmlFor(card);
        wireWordTooltips(e.currentTarget);
      }
      document.getElementById("fadeTranslation").textContent = card.translation;
      playAudio(audioUrlFor(card.surah, card.ayah), 1);
    }, { once: true });

    wireHorizontalSwipe(zone, { onRight: () => commit("good"), onLeft: () => commit("again") });
    function onKeydown(e) {
      const active = document.activeElement;
      if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); commit("good"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); commit("again"); }
    }
    document.addEventListener("keydown", onKeydown);
    setReviewKeydownCleanup(() => document.removeEventListener("keydown", onKeydown));

    function commit(ratingKey) {
      if (settled) return;
      settled = true;
      clearReviewKeydownCleanup();
      cancelAudio();
      bumpCombo(ratingKey === "good");
      zone.classList.add(ratingKey === "good" ? "story-committed-good" : "story-committed-again");
      applyRating(card, ratingKey);
      requeueIfDueToday(session, card);
      saveCards();
      session.idx++;
      setTimeout(() => renderNextCard(), 340);
    }
  }

  // -- mode: chain test --
  async function renderChainTest(host, card) {
    let nextData;
    try {
      const surahData = await ensureSurahLoaded(card.surah);
      nextData = surahData.ayahs.find(a => a.numberInSurah === card.ayah + 1);
    } catch (e) { /* fall through */ }
    if (!nextData) return renderFadeRecall(host, card);

    const otherCards = Object.values(cards).filter(c => !(c.surah === card.surah && c.ayah === card.ayah + 1));
    const distractors = sample(otherCards, 2).map(c => c.text);
    const options = shuffled([nextData.text, ...distractors]);

    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Chain Test</div>
        <div class="mode-hint">Which verse comes right after this one?</div>
        <div class="ref-badge">${escapeHtml(refBadge(card))}</div>
        <div class="chain-context">
          <div class="label">End of this verse</div>
          <div class="arabic-frag">…${escapeHtml(card.text.split(" ").slice(-4).join(" "))}</div>
        </div>
        <div class="audio-row"><button class="play-btn" id="playBtn">${ICON_PLAY}</button></div>
        <div class="chain-options" id="chainOptions">
          ${options.map((t, i) => `<button class="chain-opt" data-i="${i}">${escapeHtml(t)}</button>`).join("")}
        </div>
        <div id="chainFeedback"></div>
        ${phaseProgressHtml(card)}
      </div>
    `;
    document.getElementById("playBtn").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      clearPlayError(btn);
      btn.classList.add("playing");
      const onEnd = () => btn.classList.remove("playing");
      playAudio(audioUrlFor(card.surah, card.ayah), 1, onEnd, () => { onEnd(); showPlayError(btn); });
    });
    let answered = false;
    document.querySelectorAll(".chain-opt").forEach(btn => {
      btn.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const correct = options[Number(btn.dataset.i)] === nextData.text;
        document.querySelectorAll(".chain-opt").forEach(b => b.disabled = true);
        btn.classList.add(correct ? "correct" : "incorrect");
        if (!correct) {
          document.querySelectorAll(".chain-opt").forEach(b => {
            if (options[Number(b.dataset.i)] === nextData.text) b.classList.add("correct");
          });
        }
        document.getElementById("chainFeedback").innerHTML = `<div class="feedback-line ${correct ? "correct" : "incorrect"}">${correct ? "Correct — the chain holds." : "Not quite — review the transition."}</div>`;
        commitVerseObjective(card, correct);
      });
    });
  }

  // -- mode: mutashabih (look-alike verses) --
  function findMutashabih(card) {
    const others = Object.values(cards).filter(c => !(c.surah === card.surah && c.ayah === card.ayah));
    for (const other of others) {
      const { ratio, count } = wordOverlapRatio(card.text, other.text);
      if (ratio >= 0.55 && count >= 3) return other;
    }
    return null;
  }
  function renderMutashabih(host, card, match) {
    const options = shuffled([card, match]);
    const cardIdx = options.indexOf(card);
    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Look-Alike Challenge</div>
        <div class="mode-hint">These two verses closely resemble each other. Which one is <b>${escapeHtml(refBadge(card))}</b>?</div>
        <div class="audio-row"><button class="play-btn" id="playBtn">${ICON_PLAY}</button></div>
        <div class="mutashabih-pair" id="mutashabihPair">
          ${options.map((c, i) => `
            <div class="mutashabih-card" data-i="${i}">
              <div class="arabic">${arabicHtmlFor(c)}</div>
            </div>
          `).join("")}
        </div>
        <div id="mutashabihFeedback"></div>
        ${phaseProgressHtml(card)}
      </div>
    `;
    wireWordTooltips(document.getElementById("mutashabihPair"));
    document.getElementById("playBtn").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      clearPlayError(btn);
      btn.classList.add("playing");
      const onEnd = () => btn.classList.remove("playing");
      const onError = () => { onEnd(); showPlayError(btn); };
      // Highlight only the card matching `card` -- the OTHER shuffled slot
      // is a different verse entirely, whose words would never line up
      // with this audio's timing data.
      const container = document.querySelectorAll(".mutashabih-card .arabic")[cardIdx];
      if (container) playAudioWithHighlight(card.surah, card.ayah, container, onEnd, onError);
      else playAudio(audioUrlFor(card.surah, card.ayah), 1, onEnd, onError);
    });
    let answered = false;
    document.querySelectorAll(".mutashabih-card").forEach(el => {
      el.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const chosen = options[Number(el.dataset.i)];
        const correct = chosen.surah === card.surah && chosen.ayah === card.ayah;
        document.querySelectorAll(".mutashabih-card").forEach(c => c.classList.add("locked"));
        el.classList.add(correct ? "correct" : "incorrect");
        if (!correct) {
          document.querySelectorAll(".mutashabih-card").forEach((c, i) => {
            if (options[i].surah === card.surah && options[i].ayah === card.ayah) c.classList.add("correct");
          });
        }
        document.getElementById("mutashabihFeedback").innerHTML = `<div class="feedback-line ${correct ? "correct" : "incorrect"}">${correct ? "Correct — you told them apart." : "These two are easy to mix up — worth extra review."}</div>`;
        commitVerseObjective(card, correct);
      });
    });
  }

  // -- mode: page position sense --
  function renderPageSense(host, card) {
    const allPages = [...new Set(Object.values(cards).map(c => c.page))].sort((a, b) => a - b);
    let choices = allPages.filter(p => Math.abs(p - card.page) <= 3);
    if (choices.length < 6) {
      const extra = allPages.filter(p => !choices.includes(p));
      choices = [...choices, ...sample(extra, Math.min(6 - choices.length, extra.length))];
    }
    choices = [...new Set(choices)].sort((a, b) => a - b);

    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Page Position Sense</div>
        <div class="mode-hint">Which mushaf page is this verse on?</div>
        <div class="ref-badge">${escapeHtml(refBadge(card))}</div>
        <div class="card-arabic-box"><div class="card-arabic" id="pageSenseArabic">${arabicHtmlFor(card)}</div></div>
        <div class="audio-row"><button class="play-btn" id="playBtn">${ICON_PLAY}</button></div>
        <div class="page-picker" id="pagePicker">
          ${choices.map(p => `<button class="page-cell" data-p="${p}">${p}</button>`).join("")}
        </div>
        <div id="pageFeedback"></div>
        ${phaseProgressHtml(card)}
      </div>
    `;
    wireWordTooltips(host.querySelector(".card-arabic-box"));
    document.getElementById("playBtn").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      clearPlayError(btn);
      btn.classList.add("playing");
      const onEnd = () => btn.classList.remove("playing");
      const onError = () => { onEnd(); showPlayError(btn); };
      const container = document.getElementById("pageSenseArabic");
      if (container) playAudioWithHighlight(card.surah, card.ayah, container, onEnd, onError);
      else playAudio(audioUrlFor(card.surah, card.ayah), 1, onEnd, onError);
    });
    let answered = false;
    document.querySelectorAll(".page-cell").forEach(btn => {
      btn.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const correct = Number(btn.dataset.p) === card.page;
        document.querySelectorAll(".page-cell").forEach(b => b.disabled = true);
        btn.classList.add(correct ? "correct" : "incorrect");
        if (!correct) document.querySelector(`.page-cell[data-p="${card.page}"]`).classList.add("correct");
        document.getElementById("pageFeedback").innerHTML = `<div class="feedback-line ${correct ? "correct" : "incorrect"}">${correct ? "Correct page." : `This verse is on page ${card.page}.`}</div>`;
        commitVerseObjective(card, correct);
      });
    });
  }

  // -- mode: blind spot (random-access recall) --
  // Chain Test proves you know what comes NEXT in sequence. This tests a
  // genuinely different skill: given only audio and no reference, can you
  // place a verse from ANYWHERE in your memorized set at all -- the same
  // thing a real listener does by opening the mushaf at random, rather
  // than always starting recitation from a fixed point.
  function renderBlindSpot(host, card) {
    const others = Object.values(cards).filter(c => !(c.surah === card.surah && c.ayah === card.ayah));
    if (others.length < 2) return renderListenRecall(host, card);
    const distractors = sample(others, 2);
    const options = shuffled([card, ...distractors]);

    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Blind Spot</div>
        <div class="mode-hint">No reference shown. Listen, then place this verse among your own memorized set.</div>
        <div class="audio-row"><button class="play-btn" id="playBtn">${ICON_PLAY}</button></div>
        <div class="options" id="blindOptions">
          ${options.map((c, i) => `<button class="option" data-i="${i}">${escapeHtml(refBadge(c))}</button>`).join("")}
        </div>
        <div id="blindFeedback"></div>
        ${phaseProgressHtml(card)}
      </div>
    `;
    document.getElementById("playBtn").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      clearPlayError(btn);
      btn.classList.add("playing");
      const onEnd = () => btn.classList.remove("playing");
      playAudio(audioUrlFor(card.surah, card.ayah), 1, onEnd, () => { onEnd(); showPlayError(btn); });
    });
    let answered = false;
    document.querySelectorAll("#blindOptions .option").forEach(btn => {
      btn.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const chosen = options[Number(btn.dataset.i)];
        const correct = chosen.surah === card.surah && chosen.ayah === card.ayah;
        document.querySelectorAll("#blindOptions .option").forEach(b => b.disabled = true);
        btn.classList.add(correct ? "correct" : "incorrect");
        if (!correct) {
          document.querySelectorAll("#blindOptions .option").forEach((b, i) => {
            if (options[i].surah === card.surah && options[i].ayah === card.ayah) b.classList.add("correct");
          });
        }
        document.getElementById("blindFeedback").innerHTML = `
          <div class="feedback-line ${correct ? "correct" : "incorrect"}">${correct ? "Placed correctly." : "This was " + escapeHtml(refBadge(card)) + "."}</div>
          <div class="card-arabic-box" style="margin-top:14px"><div class="card-arabic">${arabicHtmlFor(card)}</div></div>
          <div class="card-translation">${escapeHtml(card.translation)}</div>
        `;
        wireWordTooltips(document.getElementById("blindFeedback"));
        commitVerseObjective(card, correct);
      });
    });
  }

  // -- mode: assemble (word order) --
  // Uses the real per-word breakdown (quran.com), not a naive whitespace
  // split of card.text -- word boundaries from the authoritative
  // word-by-word source avoid any mismatch with diacritic/whitespace
  // quirks a manual split could introduce.
  // Duolingo-style sentence building: tap a word and it's gone from the
  // bank immediately (not dimmed-but-lingering), reflowing the rest of
  // the bank naturally. No Check button either -- placing the last word
  // grades automatically, same instant-feedback language as every other
  // exercise here.
  function renderAssemble(host, card) {
    const wordData = wordDataFor(card);
    if (!wordData) return renderFadeRecall(host, card);
    const bank = shuffled(wordData.map((w, i) => ({ ...w, id: i })));
    const placed = [];
    let checked = false;

    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Word Order</div>
        <div class="mode-hint">Tap the words in the right order to rebuild the verse.</div>
        <div class="ref-badge">${escapeHtml(refBadge(card))}</div>
        <div class="audio-row"><button class="play-btn" id="playBtn">${ICON_PLAY}</button></div>
        <div class="wb-target" id="assembleTarget" dir="rtl"></div>
        <div class="wb-bank" id="assembleBank">
          ${bank.map(w => `<button class="wb-chip" data-id="${w.id}" data-ar="${escapeHtml(w.ar)}">${escapeHtml(w.ar)}</button>`).join("")}
        </div>
        <div id="assembleFeedback"></div>
        ${phaseProgressHtml(card)}
      </div>
    `;
    document.getElementById("playBtn").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      clearPlayError(btn);
      btn.classList.add("playing");
      const onEnd = () => btn.classList.remove("playing");
      playAudio(audioUrlFor(card.surah, card.ayah), 1, onEnd, () => { onEnd(); showPlayError(btn); });
    });

    const targetEl = document.getElementById("assembleTarget");
    function renderTarget() {
      targetEl.innerHTML = placed.map(w => `<button class="wb-chip in-target" data-id="${w.id}">${escapeHtml(w.ar)}</button>`).join("");
      targetEl.querySelectorAll(".wb-chip").forEach(chip => {
        chip.addEventListener("click", () => {
          if (checked) return;
          const id = Number(chip.dataset.id);
          const idx = placed.findIndex(p => p.id === id);
          if (idx >= 0) placed.splice(idx, 1);
          const bankChip = document.querySelector(`#assembleBank .wb-chip[data-id="${id}"]`);
          if (bankChip) bankChip.classList.remove("placed");
          renderTarget();
        });
      });
      if (placed.length === wordData.length) setTimeout(checkAnswer, 220);
    }
    document.getElementById("assembleBank").querySelectorAll(".wb-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        if (checked || chip.classList.contains("placed")) return;
        const id = Number(chip.dataset.id);
        placed.push(wordData.find((w, i) => i === id));
        placed[placed.length - 1].id = id;
        chip.classList.add("placed");
        renderTarget();
      });
    });
    function checkAnswer() {
      if (checked) return;
      checked = true;
      const correct = placed.every((w, i) => w.id === i);
      document.querySelectorAll("#assembleBank .wb-chip").forEach(c => c.style.pointerEvents = "none");
      document.querySelectorAll("#assembleTarget .wb-chip").forEach(c => {
        c.style.pointerEvents = "none";
        c.classList.add(correct ? "correct" : "incorrect");
      });
      document.getElementById("assembleFeedback").innerHTML = correct
        ? `<div class="feedback-line correct">Correct order.</div>`
        : `<div class="feedback-line incorrect">Not quite. Correct order:</div><div class="card-arabic-box" style="margin-top:10px"><div class="card-arabic">${arabicHtmlFor(card)}</div></div>`;
      if (!correct) wireWordTooltips(document.getElementById("assembleFeedback"));
      commitVerseObjective(card, correct);
    }
  }

  // -- mode: sequence (verse stitching) --
  // Tests whether you know the ORDER of several consecutive verses, not
  // just each verse's own words -- a different structural test than
  // Chain Test's single-pair "what comes next," closer to reciting a
  // real passage rather than isolated verses.
  function renderSequence(host, card) {
    const triple = [card, cards[cardKey(card.surah, card.ayah + 1)], cards[cardKey(card.surah, card.ayah + 2)]];
    if (triple.some(v => !v)) return renderFadeRecall(host, card);
    const shuffledTriple = shuffled(triple.map((v, i) => ({ ...v, correctPos: i })));
    const placed = [];

    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Verse Stitching</div>
        <div class="mode-hint">Tap these three verses in the order they actually appear.</div>
        <div class="ref-badge">${escapeHtml(refBadge(card))} — ${card.ayah + 2}</div>
        <div class="wb-target" id="seqTarget" dir="rtl" style="flex-direction:column;align-items:stretch"></div>
        <div class="options" id="seqBank">
          ${shuffledTriple.map((v, i) => `<button class="option" data-i="${i}">${escapeHtml(v.text)}</button>`).join("")}
        </div>
        <div id="seqFeedback"></div>
        ${phaseProgressHtml(card)}
      </div>
    `;

    const targetEl = document.getElementById("seqTarget");
    function renderTarget() {
      targetEl.innerHTML = placed.map(v => `<div class="wb-chip in-target" dir="rtl" style="width:100%;text-align:right;white-space:normal">${escapeHtml(v.text)}</div>`).join("");
    }
    let answered = false;
    document.querySelectorAll("#seqBank .option").forEach(btn => {
      btn.addEventListener("click", () => {
        if (answered || btn.disabled) return;
        const i = Number(btn.dataset.i);
        placed.push(shuffledTriple[i]);
        btn.disabled = true;
        btn.style.opacity = "0.35";
        renderTarget();
        if (placed.length === 3) {
          answered = true;
          const correct = placed.every((v, i) => v.correctPos === i);
          document.getElementById("seqFeedback").innerHTML = correct
            ? `<div class="feedback-line correct">Correct sequence.</div>`
            : `<div class="feedback-line incorrect">Not quite the right order — review the transitions between these three.</div>`;
          commitVerseObjective(card, correct);
        }
      });
    });
  }

  // -- mode: cloze (missing word) --
  // Distractor words are always drawn from OTHER real, already-memorized
  // verses in the user's own set -- never invented -- same discipline as
  // every other exercise here.
  function renderCloze(host, card) {
    const wordData = wordDataFor(card);
    if (!wordData) return renderFadeRecall(host, card);
    const blankIdx = 1 + Math.floor(Math.random() * (wordData.length - 1)); // avoid blanking the very first word
    const correctWord = wordData[blankIdx];

    const otherWords = [];
    Object.values(cards).forEach(c => {
      if (c.surah === card.surah && c.ayah === card.ayah) return;
      const wd = wordDataFor(c);
      if (wd) wd.forEach(w => { if (w.ar !== correctWord.ar) otherWords.push(w); });
    });
    const distractors = sample(otherWords, 2);
    if (distractors.length < 2) return renderFadeRecall(host, card);
    const options = shuffled([correctWord, ...distractors]);

    const withBlank = wordData.map((w, i) => i === blankIdx
      ? `<span class="word-tap hidden-word" data-pos="${i + 1}" data-tr="${escapeHtml(w.tr)}" data-en="${escapeHtml(w.en)}">____</span>`
      : `<span class="word-tap" data-pos="${i + 1}" data-tr="${escapeHtml(w.tr)}" data-en="${escapeHtml(w.en)}">${escapeHtml(w.ar)}</span>`
    ).join(" ");

    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Missing Word</div>
        <div class="mode-hint">Which word belongs in the gap?</div>
        <div class="ref-badge">${escapeHtml(refBadge(card))}</div>
        <div class="card-arabic-box"><div class="card-arabic" id="clozeArabic">${withBlank}</div></div>
        <div class="audio-row"><button class="play-btn" id="playBtn">${ICON_PLAY}</button></div>
        <div class="options" id="clozeOptions">
          ${options.map((w, i) => `<button class="option" data-i="${i}" dir="rtl" style="text-align:right;font-family:var(--font-arabic);font-size:1.3rem">${escapeHtml(w.ar)}</button>`).join("")}
        </div>
        <div id="clozeFeedback"></div>
        ${phaseProgressHtml(card)}
      </div>
    `;
    wireWordTooltips(host.querySelector(".card-arabic-box"));
    document.getElementById("playBtn").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      clearPlayError(btn);
      btn.classList.add("playing");
      const onEnd = () => btn.classList.remove("playing");
      const onError = () => { onEnd(); showPlayError(btn); };
      const container = document.getElementById("clozeArabic");
      if (container) playAudioWithHighlight(card.surah, card.ayah, container, onEnd, onError);
      else playAudio(audioUrlFor(card.surah, card.ayah), 1, onEnd, onError);
    });
    let answered = false;
    document.querySelectorAll("#clozeOptions .option").forEach(btn => {
      btn.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const correct = options[Number(btn.dataset.i)].ar === correctWord.ar;
        document.querySelectorAll("#clozeOptions .option").forEach(b => b.disabled = true);
        btn.classList.add(correct ? "correct" : "incorrect");
        if (!correct) {
          document.querySelectorAll("#clozeOptions .option").forEach((b, i) => {
            if (options[i].ar === correctWord.ar) b.classList.add("correct");
          });
        }
        document.getElementById("clozeFeedback").innerHTML = `<div class="feedback-line ${correct ? "correct" : "incorrect"}">${correct ? "Correct." : "The missing word was " + escapeHtml(correctWord.ar) + "."}</div>`;
        commitVerseObjective(card, correct);
      });
    });
  }

  function renderSessionComplete() {
    cancelAudio();
    const isDrill = session && session.isDrill;
    screenEl.innerHTML = `
      <div class="container">
        <div class="complete-screen">
          <div class="complete-emoji">﴾ ﴿</div>
          <h2>${isDrill ? "Drill complete" : "Wird complete"}</h2>
          <p>${isDrill
            ? "That struggle point just got a fresh review. Keep drilling weak spots or head back to the Mushaf."
            : "Alhamdulillāh — you've completed today's portion. Come back tomorrow for what's next due."}</p>
          <button class="primary-btn" id="backHomeBtn2" style="max-width:280px;margin:0 auto">${isDrill ? "Back to Mushaf" : "Back to Today"}</button>
        </div>
      </div>
    `;
    document.getElementById("backHomeBtn2").addEventListener("click", isDrill ? renderMushaf : renderHome);
  }

  // ---------- sard (continuous whole-surah recitation) ----------
  // Deliberately NOT card-by-card like the review session -- this is a
  // single continuous pass through every memorized verse of a surah in
  // order, text hidden throughout, closer to how a real sami' (listener)
  // tests a hafiz: you recite the whole thing, they only step in if you
  // genuinely lose the thread. The "stumbled here" button lets you flag a
  // rough spot WITHOUT breaking flow -- stopping to rate each verse would
  // defeat the point of testing continuous recall.
  function startSard(surahNum) {
    const verses = Object.values(cards)
      .filter(c => c.surah === surahNum)
      .sort((a, b) => a.ayah - b.ayah);
    if (!verses.length) return renderHome();
    cancelAudio();
    sardSession = { surah: surahNum, juz: null, verses, idx: 0, stumbles: new Set(), playing: false };
    renderSardScreen();
  }
  // Same continuous-recitation flow as startSard(), but scoped to a whole
  // juz instead of a single surah -- reuses every bit of the surah
  // version's hardening (prefetch, retry, Media Session, double-tap
  // guard) since it's the exact same session/render machinery, just
  // sorted across surah boundaries instead of within one. Juz completion
  // has no muraja'ah cycle of its own (that system is keyed per-surah),
  // so finishSard() skips the rating step entirely for a juz session --
  // see there.
  function startJuzSard(juzNum) {
    const verses = Object.values(cards)
      .filter(c => c.juz === juzNum)
      .sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
    if (!verses.length) return renderHome();
    cancelAudio();
    sardSession = { surah: null, juz: juzNum, verses, idx: 0, stumbles: new Set(), playing: false };
    renderSardScreen();
  }

  function renderSardScreen() {
    const meta = sardSession.juz == null ? surahList.find(s => s.number === sardSession.surah) : null;
    const title = sardSession.juz != null
      ? `Juz ${sardSession.juz}`
      : (meta ? escapeHtml(meta.englishName) : "Surah " + sardSession.surah);
    // A juz spans multiple surahs, so the ayah number alone (which resets
    // per surah) would be ambiguous -- label those rows "surah:ayah"
    // instead of just the bare ayah number.
    const rows = sardSession.verses.map((v, i) => `
      <div class="sard-line ${i === sardSession.idx ? "current" : i < sardSession.idx ? "done" : ""}" data-i="${i}">
        <span class="sard-num">${sardSession.juz != null ? `${v.surah}:${v.ayah}` : v.ayah}</span>
        <span class="sard-dots">${i < sardSession.idx ? "recited" : i === sardSession.idx ? "reciting now" : ""}</span>
      </div>
    `).join("");

    screenEl.innerHTML = `
      <div class="review-bar">
        <button class="exit-btn" id="exitSardBtn">&times;</button>
        <div class="progress-track"><div class="progress-fill" id="sardProgressFill" style="width:0%"></div></div>
      </div>
      <div class="container">
        <div class="hero" style="padding-top:12px;padding-bottom:4px">
          <div class="hero-eyebrow">Sard · Continuous Recitation</div>
          <h1 style="font-size:1.5rem">${title}</h1>
          <p>Recite from memory, verse by verse, without stopping. Text stays hidden — this tests the whole chain, not one link at a time.</p>
        </div>
        <div class="sard-controls">
          <button class="play-btn" id="sardPlayBtn">${ICON_PLAY}</button>
          <button class="secondary-btn" id="sardNextBtn">Next verse (silent)</button>
        </div>
        <button class="stumble-btn" id="sardStumbleBtn">I stumbled here — keep going</button>
        <div class="sard-list" id="sardList">${rows}</div>
        <button class="primary-btn" id="sardFinishBtn">Finish Sard</button>
      </div>
    `;
    document.getElementById("exitSardBtn").addEventListener("click", () => { cancelAudio(); sardSession = null; renderHome(); });
    document.getElementById("sardPlayBtn").addEventListener("click", toggleSardPlayback);
    document.getElementById("sardNextBtn").addEventListener("click", () => advanceSard(false));
    document.getElementById("sardStumbleBtn").addEventListener("click", () => {
      sardSession.stumbles.add(sardSession.idx);
      document.getElementById("sardStumbleBtn").textContent = "Marked — keep reciting";
      setTimeout(() => {
        const btn = document.getElementById("sardStumbleBtn");
        if (btn) btn.textContent = "I stumbled here — keep going";
      }, 900);
    });
    document.getElementById("sardFinishBtn").addEventListener("click", finishSard);
    updateSardProgress();
  }

  function updateSardProgress() {
    const pct = Math.round((sardSession.idx / sardSession.verses.length) * 100);
    const fill = document.getElementById("sardProgressFill");
    if (fill) fill.style.width = pct + "%";
  }

  function toggleSardPlayback() {
    const btn = document.getElementById("sardPlayBtn");
    if (sardSession.playing) {
      sardSession.playing = false;
      cancelAudio();
      btn.innerHTML = ICON_PLAY;
      btn.classList.remove("playing");
      return;
    }
    sardSession.playing = true;
    btn.innerHTML = ICON_PAUSE;
    btn.classList.add("playing");
    playCurrentSardVerse();
  }
  function playCurrentSardVerse() {
    if (!sardSession || !sardSession.playing) return;
    if (sardSession.idx >= sardSession.verses.length) { sardSession.playing = false; return; }
    const v = sardSession.verses[sardSession.idx];
    const btn = document.getElementById("sardPlayBtn");
    if (btn) clearPlayError(btn);
    // Warm the NEXT verse's cache while this one is still playing, not
    // after it ends -- a continuous recitation feature is exactly where a
    // mid-playback network hiccup is most disruptive (it breaks the flow
    // Sard exists to test), so having the next verse already cached by the
    // time it's needed makes that moment far less likely to ever hit a
    // live network request at all, retry logic or not.
    const next = sardSession.verses[sardSession.idx + 1];
    if (next) warmAudioCache(audioUrlFor(next.surah, next.ayah), { reciter: currentReciter, surah: next.surah, ayah: next.ayah });
    playAudio(audioUrlFor(v.surah, v.ayah), 1, () => {
      if (!sardSession || !sardSession.playing) return;
      advanceSard(true);
    }, () => {
      // A genuine failure (the automatic retry inside playAudio() already
      // exhausted) used to fall through to the same onEnd callback as a
      // real completion, which silently advanced to the next verse as if
      // this one had actually played -- in a continuous whole-surah
      // recitation feature, that means verses could get skipped with zero
      // indication. Stop autoplay and show the error instead.
      if (!sardSession) return;
      sardSession.playing = false;
      if (btn) { btn.innerHTML = ICON_PLAY; btn.classList.remove("playing"); showPlayError(btn); }
    });
  }
  function advanceSard(fromPlayback) {
    if (!sardSession) return;
    sardSession.idx++;
    if (sardSession.idx >= sardSession.verses.length) {
      sardSession.playing = false;
      cancelAudio();
      return finishSard();
    }
    renderSardScreen();
    if (fromPlayback && sardSession.playing) {
      const btn = document.getElementById("sardPlayBtn");
      if (btn) { btn.innerHTML = ICON_PAUSE; btn.classList.add("playing"); }
      playCurrentSardVerse();
    }
  }
  // Mirror of advanceSard(), for the lock-screen/Bluetooth "previous
  // track" control -- restarts the current verse if already at the start
  // of the surah, same as a real previous-track button on a short track.
  function retreatSard() {
    if (!sardSession) return;
    if (sardSession.idx > 0) sardSession.idx--;
    renderSardScreen();
    if (sardSession.playing) {
      const btn = document.getElementById("sardPlayBtn");
      if (btn) { btn.innerHTML = ICON_PAUSE; btn.classList.add("playing"); }
      playCurrentSardVerse();
    }
  }

  function finishSard() {
    cancelAudio();
    const { surah, juz, verses, stumbles } = sardSession;
    // Juz completion has no muraja'ah cycle of its own -- that scheduler
    // is keyed per-surah (see applySardRating/muraja above) and a juz
    // spans multiple surahs, so there's no single cycle to adjust. Record
    // the stumbled verses same as a surah sard, but skip straight to a
    // plain completion screen instead of a rating that wouldn't actually
    // go anywhere.
    if (juz != null) {
      stumbles.forEach(i => {
        const v = verses[i];
        const key = cardKey(v.surah, v.ayah);
        if (cards[key]) cards[key].struggleCount = (cards[key].struggleCount || 0) + 1;
      });
      saveCards();
      screenEl.innerHTML = `
        <div class="container">
          <div class="complete-screen">
            <div class="complete-emoji">﴾ ﴿</div>
            <h2>Juz ${juz} — recited in full</h2>
            <p>${verses.length} verses${stumbles.size ? `, ${stumbles.size} marked as rough` : ""}. Alhamdulillah.</p>
            <button class="primary-btn" id="sardDoneBtn" style="max-width:280px;margin:18px auto 0">Continue</button>
          </div>
        </div>
      `;
      document.getElementById("sardDoneBtn").addEventListener("click", () => { sardSession = null; renderHome(); });
      return;
    }
    const meta = surahList.find(s => s.number === surah);
    screenEl.innerHTML = `
      <div class="container">
        <div class="complete-screen">
          <div class="complete-emoji">﴾ ﴿</div>
          <h2>How did that sard feel?</h2>
          <p>${meta ? escapeHtml(meta.englishName) : "This surah"} — ${verses.length} verses${stumbles.size ? `, ${stumbles.size} marked as rough` : ""}. Your honest answer sets when this surah comes back around.</p>
          <div class="sard-rating-row">
            ${Object.entries(SARD_RATINGS).map(([key, r]) => `
              <button class="sard-rate-btn" data-rating="${key}">${escapeHtml(r.label)}<span class="sub">${escapeHtml(r.sub)}</span></button>
            `).join("")}
          </div>
        </div>
      </div>
    `;
    // renderHome() below is async (it awaits ensureSurahList() before
    // replacing screenEl.innerHTML), so these buttons stay live and
    // clickable in the DOM for a real window after the first tap -- a
    // rushed double-tap (common enough on mobile) would otherwise call
    // applySardRating() a second time, compounding the cycle-day
    // adjustment twice instead of once. Every other answer/rating handler
    // in this app already guards against exactly this; this one didn't.
    let submitted = false;
    document.querySelectorAll(".sard-rate-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        if (submitted) return;
        submitted = true;
        applySardRating(surah, btn.dataset.rating);
        stumbles.forEach(i => {
          const v = verses[i];
          const key = cardKey(v.surah, v.ayah);
          if (cards[key]) cards[key].struggleCount = (cards[key].struggleCount || 0) + 1;
        });
        saveCards();
        sardSession = null;
        renderHome();
      });
    });
  }

  // ---------- vocabulary: data + SRS ----------
  let vocabBankLoaded = false;
  async function ensureVocabBank() {
    if (vocabBankLoaded) return vocabBank;
    const res = await fetch(VOCAB_BANK_PATH);
    if (!res.ok) throw new Error("Failed to load vocabulary bank");
    vocabBank = await res.json();
    vocabById = {};
    vocabBank.forEach(w => { vocabById[w.id] = w; });
    vocabBankLoaded = true;
    return vocabBank;
  }
  function newVocabCard(id) {
    return { id, interval: 0, ease: 2.5, reps: 0, phase: "learning", learningStep: 0, reviewStep: 0, dueDate: todayISO(), addedDate: todayISO() };
  }
  function addVocabWord(id) {
    if (vocabCards[id]) return;
    vocabCards[id] = newVocabCard(id);
    saveVocabCards();
  }
  function removeVocabWord(id) {
    if (!vocabCards[id]) return;
    delete vocabCards[id];
    saveVocabCards();
  }
  function computeVocabQueue() {
    const today = todayISO();
    const all = Object.values(vocabCards);
    const due = all.filter(c => c.reps > 0 && c.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const fresh = all.filter(c => c.reps === 0).sort((a, b) => a.addedDate.localeCompare(b.addedDate));
    const mode = currentModeConfig();
    return { due: due.slice(0, mode.reviewCap), fresh: fresh.slice(0, mode.newPerDay) };
  }

  // ---------- vocabulary: home / browse screens ----------
  async function renderVocabHome() {
    cancelAudio(); resetActiveSessions();
    await ensureVocabBank();
    const { due, fresh } = computeVocabQueue();
    const total = due.length + fresh.length;
    const allVocabCards = Object.values(vocabCards);
    const matureCt = allVocabCards.filter(c => masteryStage(c) === "mature").length;

    screenEl.innerHTML = `
      <div class="container">
        <div class="hero">
          <div class="hero-eyebrow">15,000+ real words, ranked by frequency</div>
          <h1>Vocabulary</h1>
          <p>Computed directly from the entire Qur'an's own text — the ~100 most frequent words alone cover roughly half of everything you'll ever read or hear recited.</p>
        </div>
        <div class="today-card">
          ${total > 0 ? `
            <div class="today-count">${total}</div>
            <div class="today-label">words in today's practice</div>
            <div class="today-breakdown">
              <span><b>${due.length}</b> due for review</span>
              <span><b>${fresh.length}</b> new</span>
            </div>
            <button class="primary-btn" id="startVocabBtn">Start Vocabulary Practice</button>
          ` : allVocabCards.length === 0 ? `
            <div class="empty-state">
              <div class="glyph">ب</div>
              <p>Browse by frequency tier or theme below and add words to start building your personal vocabulary set.</p>
            </div>
          ` : `
            <div class="empty-state">
              <div class="glyph"><svg viewBox="0 0 24 24" width="38" height="38" aria-hidden="true"><path d="M4 12.5l6 6L20 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
              <p>Nothing due right now. Browse below to add more words, or come back tomorrow.</p>
            </div>
          `}
        </div>
        <div class="stat-row">
          <div class="stat-box"><b>${allVocabCards.length}</b><span>words added</span></div>
          <div class="stat-box"><b>${matureCt}</b><span>mature</span></div>
          <div class="stat-box"><b>${vocabBank.length.toLocaleString()}</b><span>total in bank</span></div>
        </div>
        <div class="star-divider">${starSvg()}</div>
        <div class="muraja-heading">By Frequency</div>
        <p class="muraja-sub">The single most effective way to expand comprehension fast — highest-frequency words first.</p>
        <div class="vocab-tier-grid" id="vocabTierGrid">
          ${VOCAB_TIERS.map(t => `
            <button class="vocab-tier-card" data-tier="${t.id}">
              <div class="vocab-tier-label">${escapeHtml(t.label)}</div>
              <div class="vocab-tier-blurb">${escapeHtml(t.blurb)}</div>
            </button>
          `).join("")}
        </div>
        <div class="star-divider">${starSvg()}</div>
        <div class="muraja-heading">By Theme</div>
        <p class="muraja-sub">Categories derived from real translation text, not guessed — a word can belong to more than one.</p>
        <div class="vocab-cat-grid" id="vocabCatGrid"></div>
      </div>
    `;
    renderVocabCategoryGrid();
    const startBtn = document.getElementById("startVocabBtn");
    if (startBtn) startBtn.addEventListener("click", startVocabReview);
    document.querySelectorAll(".vocab-tier-card").forEach(btn => {
      btn.addEventListener("click", () => renderVocabTierBrowser(btn.dataset.tier));
    });
  }

  function allVocabCategories() {
    const counts = {};
    vocabBank.forEach(w => (w.cat || []).forEach(c => { counts[c] = (counts[c] || 0) + 1; }));
    return counts;
  }
  function renderVocabCategoryGrid() {
    const grid = document.getElementById("vocabCatGrid");
    if (!grid) return;
    const counts = allVocabCategories();
    const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    grid.innerHTML = cats.map(c => `
      <button class="vocab-tier-card" data-cat="${escapeHtml(c)}">
        <div class="vocab-tier-label">${escapeHtml(c)}</div>
        <div class="vocab-tier-blurb">${counts[c]} words</div>
      </button>
    `).join("");
    grid.querySelectorAll(".vocab-tier-card").forEach(btn => {
      btn.addEventListener("click", () => renderVocabCategoryBrowser(btn.dataset.cat));
    });
  }

  function vocabWordRowHtml(w) {
    const added = !!vocabCards[w.id];
    return `
      <div class="ayah-row">
        <div class="ayah-row-top">
          <span class="ayah-num-badge">Rank ${w.rk} · seen ${w.n}×</span>
          <button class="add-toggle ${added ? "added" : ""}" data-id="${escapeHtml(w.id)}">${added ? `Added ${ICON_CHECK}` : "Add"}</button>
        </div>
        <div class="ayah-arabic" dir="rtl" style="direction:rtl">${escapeHtml(w.ar)}</div>
        <div class="ayah-translation">${escapeHtml(w.tr)} — ${w.en.map(escapeHtml).join(", ")}</div>
      </div>
    `;
  }
  function wireVocabWordRows(container) {
    container.querySelectorAll(".add-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (vocabCards[id]) removeVocabWord(id); else addVocabWord(id);
        btn.classList.toggle("added");
        btn.innerHTML = vocabCards[id] ? `Added ${ICON_CHECK}` : "Add";
      });
    });
  }

  async function renderVocabTierBrowser(tierId) {
    await ensureVocabBank();
    const tier = VOCAB_TIERS.find(t => t.id === tierId);
    if (!tier) return renderVocabHome();
    const words = vocabBank.filter(w => w.rk >= tier.from && w.rk <= tier.to).slice(0, 500);
    screenEl.innerHTML = `
      <div class="container">
        <button class="back-btn" id="backVocabBtn">&larr; Vocabulary</button>
        <div class="hero" style="padding-top:0">
          <h1 style="font-size:1.5rem">${escapeHtml(tier.label)}</h1>
          <p>${escapeHtml(tier.blurb)}${words.length >= 500 ? " Showing the first 500." : ""}</p>
        </div>
        <button class="primary-btn" id="addAllTierBtn" style="margin-bottom:20px">Add all shown (${words.length}) to my vocabulary</button>
        <div class="ayah-browser">${words.map(vocabWordRowHtml).join("")}</div>
      </div>
    `;
    document.getElementById("backVocabBtn").addEventListener("click", renderVocabHome);
    document.getElementById("addAllTierBtn").addEventListener("click", () => {
      words.forEach(w => addVocabWord(w.id));
      renderVocabTierBrowser(tierId);
    });
    wireVocabWordRows(document.querySelector(".ayah-browser"));
  }

  async function renderVocabCategoryBrowser(cat) {
    await ensureVocabBank();
    const words = vocabBank.filter(w => (w.cat || []).includes(cat)).sort((a, b) => a.rk - b.rk).slice(0, 500);
    screenEl.innerHTML = `
      <div class="container">
        <button class="back-btn" id="backVocabBtn">&larr; Vocabulary</button>
        <div class="hero" style="padding-top:0">
          <h1 style="font-size:1.5rem">${escapeHtml(cat)}</h1>
          <p>${words.length} words${words.length >= 500 ? " (showing the first 500, ranked by frequency)" : ""}</p>
        </div>
        <button class="primary-btn" id="addAllCatBtn" style="margin-bottom:20px">Add all shown (${words.length}) to my vocabulary</button>
        <div class="ayah-browser">${words.map(vocabWordRowHtml).join("")}</div>
      </div>
    `;
    document.getElementById("backVocabBtn").addEventListener("click", renderVocabHome);
    document.getElementById("addAllCatBtn").addEventListener("click", () => {
      words.forEach(w => addVocabWord(w.id));
      renderVocabCategoryBrowser(cat);
    });
    wireVocabWordRows(document.querySelector(".ayah-browser"));
  }

  // ---------- vocabulary: review session ----------
  async function startVocabReview() {
    await ensureVocabBank();
    const { due, fresh } = computeVocabQueue();
    const queue = [...due, ...fresh];
    if (!queue.length) return renderVocabHome();
    vocabSession = { queue, total: queue.length, idx: 0 };
    renderVocabReviewChrome();
    await renderNextVocabCard();
  }
  function renderVocabReviewChrome() {
    resetCombo();
    screenEl.innerHTML = `
      <div class="review-bar">
        <button class="exit-btn" id="exitVocabBtn">&times;</button>
        <div class="progress-track"><div class="progress-fill" id="vocabProgressFill" style="width:0%"></div></div>
        <span class="combo-badge" id="comboBadge"></span>
      </div>
      <div id="vocabReviewHost"></div>
    `;
    document.getElementById("exitVocabBtn").addEventListener("click", () => { cancelAudio(); vocabSession = null; renderVocabHome(); });
  }
  function updateVocabProgress() {
    const pct = vocabSession.total ? Math.round((vocabSession.idx / vocabSession.total) * 100) : 0;
    const fill = document.getElementById("vocabProgressFill");
    if (fill) fill.style.width = pct + "%";
  }
  function vocabEligibleModes(card) {
    const stage = masteryStage(card);
    const modes = ["flash"];
    if (stage !== "new") { modes.push("mc-meaning"); modes.push("mc-arabic"); }
    if (stage === "young" || stage === "mature") { modes.push("context"); modes.push("audio-rec"); }
    return modes;
  }
  function pickVocabMode(card, word) {
    const modes = vocabEligibleModes(card);
    let mode = modes[Math.floor(Math.random() * modes.length)];
    if (mode === "context" && (!word.occ || !word.occ.length)) mode = "mc-meaning";
    return mode;
  }

  async function renderNextVocabCard() {
    if (vocabSession.idx >= vocabSession.total) return renderVocabSessionComplete();
    updateVocabProgress();
    const card = vocabSession.queue[vocabSession.idx];
    const word = vocabById[card.id];
    const host = document.getElementById("vocabReviewHost");
    if (!host) return;
    if (!word) { vocabSession.idx++; return renderNextVocabCard(); }
    const mode = pickVocabMode(card, word);
    renderVocabCardInMode(host, card, word, mode);
  }

  function renderVocabCardInMode(host, card, word, mode) {
    if (mode === "flash") return renderVocabFlash(host, card, word);
    if (mode === "mc-meaning") return renderVocabMcMeaning(host, card, word);
    if (mode === "mc-arabic") return renderVocabMcArabic(host, card, word);
    if (mode === "context") return renderVocabContext(host, card, word);
    if (mode === "audio-rec") return renderVocabAudioRec(host, card, word);
    return renderVocabFlash(host, card, word);
  }

  // Same "Can't listen now" escape hatch as the verse review side (see
  // skipListeningExercise), for the two vocab modes that autoplay the
  // word's audio: Flashcard and Listen & Identify.
  const AUDIO_VOCAB_MODES = ["flash", "audio-rec"];
  function skipListeningVocabExercise(card, word) {
    cancelAudio();
    clearReviewKeydownCleanup();
    const host = document.getElementById("vocabReviewHost");
    if (!host) return;
    const silent = vocabEligibleModes(card).filter(m => !AUDIO_VOCAB_MODES.includes(m));
    if (!silent.length) {
      vocabSession.idx++;
      renderNextVocabCard();
      return;
    }
    let mode = silent[Math.floor(Math.random() * silent.length)];
    if (mode === "context" && (!word.occ || !word.occ.length)) mode = "mc-meaning";
    renderVocabCardInMode(host, card, word, mode);
  }
  function wireCantListenBtnVocab(card, word, onSettle) {
    const btn = document.getElementById("cantListenBtn");
    if (btn) btn.addEventListener("click", () => { if (onSettle) onSettle(); skipListeningVocabExercise(card, word); });
  }

  function vocabPlayBtnHtml(id) { return `<div class="audio-row"><button class="play-btn" id="vocabPlayBtn">${ICON_PLAY}</button></div>`; }
  function wireVocabPlay(word) {
    const btn = document.getElementById("vocabPlayBtn");
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      const b = e.currentTarget;
      clearPlayError(b);
      b.classList.add("playing");
      const url = word.au ? `https://audio.qurancdn.com/${word.au}` : null;
      const onEnd = () => b.classList.remove("playing");
      if (url) playAudio(url, 1, onEnd, () => { onEnd(); showPlayError(b); });
      else onEnd();
    });
  }

  // -- vocab mode: flashcard --
  // Buttonless, same swipe language as the verse story-cards: the word's
  // audio plays on render, tap the word to reveal its meaning (that's
  // the exercise, not a rating), then swipe right/left -- no rating row.
  function renderVocabFlash(host, card, word) {
    let settled = false;
    host.innerHTML = `
      <div class="review-stage story-mode">
        <div class="story-swipe-zone" id="storySwipeZone">
          <div class="story-bg" aria-hidden="true"></div>
          <div class="story-swipe-hint hint-left">Again</div>
          <div class="story-swipe-hint hint-right">Good</div>
          <div class="story-content">
            <div class="mode-kicker">Flashcard</div>
            <div class="ref-badge">Rank ${word.rk} · seen ${word.n}×</div>
            ${word.au ? `<button type="button" class="play-btn story-play-btn" id="storyPlayBtn" aria-label="Play word">${ICON_PLAY}</button>` : ""}
            <div class="story-loop-indicator">Recall the meaning, tap to check</div>
            <div class="card-arabic-box story-arabic-box"><div class="card-arabic tap-to-check" dir="rtl" id="vocabFlashWord">${escapeHtml(word.ar)}</div></div>
            <div class="card-translation" id="vocabFlashMeaning"></div>
            ${cantListenBtnHtml()}
            ${kbdHintHtml()}
          </div>
        </div>
      </div>
    `;
    const zone = document.getElementById("storySwipeZone");
    wireCantListenBtnVocab(card, word, () => { settled = true; });
    const playWord = () => { if (word.au) playAudio(`https://audio.qurancdn.com/${word.au}`, 1); };
    const playBtn = document.getElementById("storyPlayBtn");
    if (playBtn) playBtn.addEventListener("click", () => {
      clearPlayError(playBtn);
      playBtn.classList.add("playing");
      const onEnd = () => playBtn.classList.remove("playing");
      playAudio(`https://audio.qurancdn.com/${word.au}`, 1, onEnd, () => { onEnd(); showPlayError(playBtn); });
    });
    document.getElementById("vocabFlashWord").addEventListener("click", (e) => {
      e.currentTarget.classList.remove("tap-to-check");
      document.getElementById("vocabFlashMeaning").innerHTML = `
        <span style="font-size:1.05rem;font-weight:600;color:#fff">${escapeHtml(word.tr)}</span><br>
        ${word.en.map(escapeHtml).join(" · ")}
      `;
      playWord();
    }, { once: true });

    wireHorizontalSwipe(zone, { onRight: () => commit("good"), onLeft: () => commit("again") });
    function onKeydown(e) {
      const active = document.activeElement;
      if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); commit("good"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); commit("again"); }
    }
    document.addEventListener("keydown", onKeydown);
    setReviewKeydownCleanup(() => document.removeEventListener("keydown", onKeydown));

    function commit(ratingKey) {
      if (settled) return;
      settled = true;
      clearReviewKeydownCleanup();
      cancelAudio();
      bumpCombo(ratingKey === "good");
      zone.classList.add(ratingKey === "good" ? "story-committed-good" : "story-committed-again");
      applyRating(card, ratingKey);
      requeueIfDueToday(vocabSession, card);
      saveVocabCards();
      vocabSession.idx++;
      setTimeout(() => renderNextVocabCard(), 340);
    }
  }

  // -- vocab mode: multiple choice, Arabic -> meaning --
  function renderVocabMcMeaning(host, card, word) {
    const others = sampleVocabDistractors(word, 3);
    const options = shuffled([word, ...others]);
    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Word Meaning</div>
        <div class="mode-hint">What does this word mean?</div>
        <div class="card-arabic-box"><div class="card-arabic" dir="rtl">${escapeHtml(word.ar)}</div></div>
        ${vocabPlayBtnHtml()}
        <div class="options" id="vocabMcOptions">
          ${options.map((w, i) => `<button class="option" data-i="${i}">${escapeHtml(w.en[0] || w.tr)}</button>`).join("")}
        </div>
        <div id="vocabMcFeedback"></div>
        ${phaseProgressHtml(card)}
      </div>
    `;
    wireVocabPlay(word);
    let answered = false;
    document.querySelectorAll("#vocabMcOptions .option").forEach(btn => {
      btn.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const correct = options[Number(btn.dataset.i)].id === word.id;
        document.querySelectorAll("#vocabMcOptions .option").forEach(b => b.disabled = true);
        btn.classList.add(correct ? "correct" : "incorrect");
        if (!correct) document.querySelectorAll("#vocabMcOptions .option").forEach((b, i) => { if (options[i].id === word.id) b.classList.add("correct"); });
        document.getElementById("vocabMcFeedback").innerHTML = `<div class="feedback-line ${correct ? "correct" : "incorrect"}">${correct ? "Correct." : escapeHtml(word.tr) + " = " + escapeHtml(word.en[0])}</div>`;
        commitVocabObjective(card, correct);
      });
    });
  }

  // -- vocab mode: multiple choice, meaning -> Arabic --
  function renderVocabMcArabic(host, card, word) {
    const others = sampleVocabDistractors(word, 3);
    const options = shuffled([word, ...others]);
    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Find The Word</div>
        <div class="mode-hint">Which word means "${escapeHtml(word.en[0])}"?</div>
        <div class="options" id="vocabMcOptions2">
          ${options.map((w, i) => `<button class="option" data-i="${i}" dir="rtl" style="text-align:right;font-family:var(--font-arabic);font-size:1.3rem">${escapeHtml(w.ar)}</button>`).join("")}
        </div>
        <div id="vocabMcFeedback2"></div>
        ${phaseProgressHtml(card)}
      </div>
    `;
    let answered = false;
    document.querySelectorAll("#vocabMcOptions2 .option").forEach(btn => {
      btn.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const correct = options[Number(btn.dataset.i)].id === word.id;
        document.querySelectorAll("#vocabMcOptions2 .option").forEach(b => b.disabled = true);
        btn.classList.add(correct ? "correct" : "incorrect");
        if (!correct) document.querySelectorAll("#vocabMcOptions2 .option").forEach((b, i) => { if (options[i].id === word.id) b.classList.add("correct"); });
        document.getElementById("vocabMcFeedback2").innerHTML = `<div class="feedback-line ${correct ? "correct" : "incorrect"}">${correct ? "Correct." : "That was " + escapeHtml(word.ar)}</div>`;
        commitVocabObjective(card, correct);
      });
    });
  }

  // -- vocab mode: word in context (real ayah, real occurrence) --
  async function renderVocabContext(host, card, word) {
    const [surahNum, ayahNum] = word.occ[Math.floor(Math.random() * word.occ.length)];
    let ayahData;
    try {
      const surahData = await ensureSurahLoaded(surahNum);
      ayahData = surahData.ayahs.find(a => a.numberInSurah === ayahNum);
    } catch (e) { /* fall through */ }
    if (!ayahData) return renderVocabMcMeaning(host, card, word);
    const meta = surahList.find(s => s.number === surahNum);

    const others = sampleVocabDistractors(word, 3);
    const options = shuffled([word, ...others]);
    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">In Context</div>
        <div class="mode-hint">This real ayah contains the word below. What does it mean?</div>
        <div class="ref-badge">${meta ? escapeHtml(meta.englishName) : "Surah " + surahNum} ${ayahNum}</div>
        <div class="card-arabic-box"><div class="card-arabic" style="font-size:1.5rem">${escapeHtml(ayahData.text)}</div></div>
        <div class="card-translation">${escapeHtml(ayahData.translation)}</div>
        <div class="chain-context" style="margin-top:14px">
          <div class="label">Find this word above</div>
          <div class="arabic-frag" dir="rtl">${escapeHtml(word.ar)}</div>
        </div>
        <div class="options" id="vocabCtxOptions">
          ${options.map((w, i) => `<button class="option" data-i="${i}">${escapeHtml(w.en[0] || w.tr)}</button>`).join("")}
        </div>
        <div id="vocabCtxFeedback"></div>
        ${phaseProgressHtml(card)}
      </div>
    `;
    let answered = false;
    document.querySelectorAll("#vocabCtxOptions .option").forEach(btn => {
      btn.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const correct = options[Number(btn.dataset.i)].id === word.id;
        document.querySelectorAll("#vocabCtxOptions .option").forEach(b => b.disabled = true);
        btn.classList.add(correct ? "correct" : "incorrect");
        if (!correct) document.querySelectorAll("#vocabCtxOptions .option").forEach((b, i) => { if (options[i].id === word.id) b.classList.add("correct"); });
        document.getElementById("vocabCtxFeedback").innerHTML = `<div class="feedback-line ${correct ? "correct" : "incorrect"}">${correct ? "Correct." : escapeHtml(word.tr) + " = " + escapeHtml(word.en[0])}</div>`;
        commitVocabObjective(card, correct);
      });
    });
  }

  // -- vocab mode: audio recognition --
  function renderVocabAudioRec(host, card, word) {
    if (!word.au) return renderVocabMcMeaning(host, card, word);
    const others = sampleVocabDistractors(word, 3);
    const options = shuffled([word, ...others]);
    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Listen &amp; Identify</div>
        <div class="mode-hint">Play the word, then pick what you heard.</div>
        ${vocabPlayBtnHtml()}
        <div class="options" id="vocabAudioOptions">
          ${options.map((w, i) => `<button class="option" data-i="${i}" dir="rtl" style="text-align:right;font-family:var(--font-arabic);font-size:1.3rem">${escapeHtml(w.ar)}</button>`).join("")}
        </div>
        <div id="vocabAudioFeedback"></div>
        ${cantListenBtnHtml()}
        ${phaseProgressHtml(card)}
      </div>
    `;
    wireVocabPlay(word);
    wireCantListenBtnVocab(card, word);
    let answered = false;
    document.querySelectorAll("#vocabAudioOptions .option").forEach(btn => {
      btn.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const correct = options[Number(btn.dataset.i)].id === word.id;
        document.querySelectorAll("#vocabAudioOptions .option").forEach(b => b.disabled = true);
        btn.classList.add(correct ? "correct" : "incorrect");
        if (!correct) document.querySelectorAll("#vocabAudioOptions .option").forEach((b, i) => { if (options[i].id === word.id) b.classList.add("correct"); });
        document.getElementById("vocabAudioFeedback").innerHTML = `<div class="feedback-line ${correct ? "correct" : "incorrect"}">${correct ? "Correct." : "That was " + escapeHtml(word.ar) + " (" + escapeHtml(word.tr) + ")"}</div>`;
        commitVocabObjective(card, correct);
      });
    });
  }

  function renderVocabSessionComplete() {
    cancelAudio();
    screenEl.innerHTML = `
      <div class="container">
        <div class="complete-screen">
          <div class="complete-emoji">ب</div>
          <h2>Vocabulary practice complete</h2>
          <p>Come back tomorrow for what's next due, or add more words from the Vocabulary tab.</p>
          <button class="primary-btn" id="backVocabBtn2" style="max-width:280px;margin:0 auto">Back to Vocabulary</button>
        </div>
      </div>
    `;
    document.getElementById("backVocabBtn2").addEventListener("click", renderVocabHome);
  }

  // ---------- nav ----------
  // Every render* function replaces #screen's innerHTML wholesale with no
  // transition at all -- a plain instant swap. Rather than touch every one
  // of them individually, this single choke point (every nav tap and the
  // brand-button "home" shortcut route through here) awaits whichever
  // render just ran, then replays a fade-in on the container -- removing
  // the class first and forcing a reflow (offsetWidth read) so the
  // animation restarts even for two taps on the same screen in a row,
  // where the class would otherwise already be present and no-op.
  let screenRenderToken = 0;
  async function switchScreen(name) {
    const myToken = ++screenRenderToken;
    activeScreenName = name;
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.screen === name));
    let renderPromise;
    if (name === "home") renderPromise = renderHome();
    else if (name === "library") renderPromise = renderLibrary();
    else if (name === "mushaf") renderPromise = renderMushaf();
    else if (name === "vocab") renderPromise = renderVocabHome();
    else if (name === "progress") renderPromise = renderProgress();
    else if (name === "downloads") renderPromise = renderDownloads();
    await renderPromise;
    // A newer switchScreen() call can start (and finish) while this one's
    // render was still awaiting a fetch/IndexedDB read -- if that happened,
    // this call's screenEl.innerHTML write would land after the newer
    // one's and silently revert the user back to the wrong screen. Just
    // bail out without painting -- no need to re-render from here: the
    // newer call is (by construction) always the last one whose token
    // still matches when IT finishes, since nothing increments the token
    // again after it, so it always paints the correct final screen itself.
    if (myToken !== screenRenderToken) return;
    screenEl.classList.remove("screen-fade-in");
    void screenEl.offsetWidth;
    screenEl.classList.add("screen-fade-in");
  }

  function renderReciterSelect() {
    const sel = document.getElementById("reciterSelect");
    // quran.com only publishes word-by-word timing for Alafasy -- surface
    // that as a tooltip (not inline option text, which overflowed the
    // pill on narrow phones) so the highlight feature doesn't just look
    // silently broken with any other pick.
    const noHighlightNote = "No word-by-word highlight available for this reciter";
    sel.innerHTML = Object.entries(RECITERS).map(([id, r]) =>
      `<option value="${id}" ${id === currentReciter ? "selected" : ""} ${id === "alafasy" ? "" : `title="${escapeHtml(noHighlightNote)}"`}>${escapeHtml(r.name)}</option>`
    ).join("");
    sel.title = currentReciter === "alafasy" ? "" : noHighlightNote;
    sel.addEventListener("change", () => {
      setReciter(sel.value);
      sel.title = sel.value === "alafasy" ? "" : noHighlightNote;
    });
  }

  // ---------- Voice Mirror: record yourself, A/B against the reciter ----------
  // Nothing here is ever saved or synced -- the whole point is a private,
  // throwaway mirror. The recording exists only as a local Blob for as
  // long as this modal is open; closing it revokes the object URL and
  // stops the microphone track. "Your take" gets a real waveform (decoded
  // straight from the local recording, same-origin, no restrictions).
  // The reciter's track intentionally does NOT attempt a real waveform --
  // that would mean feeding a cross-origin CDN file into a Web Audio
  // AnalyserNode, which needs CORS headers this app has no way to verify
  // everyayah.com actually sends, so a broken analysis would either throw
  // or silently show a flat line. A decorative equalizer that just
  // pulses while it plays is honest about being decorative and can't
  // ever misrepresent the audio.
  let voiceMirrorState = null;
  function pickRecorderMimeType() {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    for (let i = 0; i < candidates.length; i++) {
      if (window.MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
    }
    return "";
  }
  function openVoiceMirror(card) {
    cancelAudio();
    const overlay = document.getElementById("voiceMirrorOverlay");
    if (!overlay) return;
    voiceMirrorState = {
      card, stream: null, recorder: null, chunks: [], audioCtx: null, analyser: null,
      meterRafId: null, recordedUrl: null, recordTimer: null, mineAudio: null, reciterAudio: null,
    };
    overlay.innerHTML = `
      <div class="vm-card">
        <div class="vm-head">
          <div>
            <div class="vm-kicker">Voice Mirror</div>
            <div class="vm-ref">${escapeHtml(refBadge(card))}</div>
          </div>
          <button class="modal-close" id="vmCloseBtn" aria-label="Close">&times;</button>
        </div>
        <div class="card-arabic-box" style="margin:14px 0"><div class="card-arabic">${arabicHtmlFor(card)}</div></div>
        <div class="vm-record-zone" id="vmRecordZone">
          <button class="vm-record-btn" id="vmRecordBtn" aria-label="Start recording">
            <span class="vm-record-dot"></span>
          </button>
          <div class="vm-meter" id="vmMeter">${Array.from({ length: 20 }).map(() => `<span></span>`).join("")}</div>
          <div class="vm-hint" id="vmHint">Tap to record yourself reciting this verse</div>
        </div>
        <div class="vm-compare" id="vmCompare" style="display:none">
          <div class="vm-track">
            <button class="vm-play-btn" id="vmPlayMine" type="button">${ICON_PLAY}</button>
            <div class="vm-track-info">
              <div class="vm-track-label">Your take</div>
              <canvas class="vm-wave" id="vmWaveMine" width="240" height="34"></canvas>
            </div>
          </div>
          <div class="vm-track">
            <button class="vm-play-btn" id="vmPlayReciter" type="button">${ICON_PLAY}</button>
            <div class="vm-track-info">
              <div class="vm-track-label">Reciter</div>
              <div class="vm-eq" id="vmEqReciter"><span></span><span></span><span></span><span></span><span></span></div>
            </div>
          </div>
          <button class="vm-rerecord-btn" id="vmRerecordBtn" type="button">Record again</button>
        </div>
        <div class="vm-privacy">Nothing here is saved or uploaded — closing this discards the recording.</div>
      </div>
    `;
    overlay.classList.add("visible");
    document.getElementById("vmCloseBtn").addEventListener("click", closeVoiceMirror);
    overlay.addEventListener("click", function overlayClick(e) { if (e.target === overlay) closeVoiceMirror(); });
    document.getElementById("vmRecordBtn").addEventListener("click", toggleVoiceMirrorRecording);
  }
  function closeVoiceMirror() {
    const overlay = document.getElementById("voiceMirrorOverlay");
    if (!overlay) return;
    teardownVoiceMirrorRecording();
    if (voiceMirrorState) {
      if (voiceMirrorState.recordedUrl) URL.revokeObjectURL(voiceMirrorState.recordedUrl);
      if (voiceMirrorState.mineAudio) voiceMirrorState.mineAudio.pause();
      if (voiceMirrorState.reciterAudio) voiceMirrorState.reciterAudio.pause();
    }
    voiceMirrorState = null;
    overlay.classList.remove("visible");
    overlay.innerHTML = "";
  }
  // Stops the mic track / audio context / meter loop without discarding
  // a completed recording -- called both when actually done recording
  // and as a safety net when the modal closes mid-recording.
  function teardownVoiceMirrorRecording() {
    if (!voiceMirrorState) return;
    if (voiceMirrorState.meterRafId) cancelAnimationFrame(voiceMirrorState.meterRafId);
    voiceMirrorState.meterRafId = null;
    if (voiceMirrorState.recordTimer) clearTimeout(voiceMirrorState.recordTimer);
    voiceMirrorState.recordTimer = null;
    if (voiceMirrorState.stream) voiceMirrorState.stream.getTracks().forEach(t => t.stop());
    voiceMirrorState.stream = null;
    if (voiceMirrorState.audioCtx) voiceMirrorState.audioCtx.close().catch(() => {});
    voiceMirrorState.audioCtx = null;
    voiceMirrorState.analyser = null;
  }
  function toggleVoiceMirrorRecording() {
    if (!voiceMirrorState) return;
    if (voiceMirrorState.recorder && voiceMirrorState.recorder.state === "recording") {
      voiceMirrorState.recorder.stop();
    } else {
      startVoiceMirrorRecording();
    }
  }
  function startVoiceMirrorRecording() {
    // Captured once, locally, rather than read back off the module-level
    // voiceMirrorState inside the async callbacks below: getUserMedia is
    // a promise, and a MediaRecorder's dataavailable/stop events can
    // still be queued after the user has already closed the modal or
    // started a second recording (Record again). Reading the SHARED
    // mutable variable from inside those callbacks meant a stale event
    // from an earlier session could fire against a `null` or
    // already-superseded session and crash or corrupt state -- every
    // callback below now checks it's still operating on THIS session
    // (`voiceMirrorState === session`) before touching anything.
    const session = voiceMirrorState;
    if (!session) return;
    const hint = document.getElementById("vmHint");
    const recordBtn = document.getElementById("vmRecordBtn");
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      if (voiceMirrorState !== session) { stream.getTracks().forEach(t => t.stop()); return; } // superseded while permission was pending
      session.stream = stream;
      session.chunks = [];
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      session.recorder = recorder;
      recorder.addEventListener("dataavailable", function (e) {
        if (voiceMirrorState !== session) return;
        if (e.data && e.data.size > 0) session.chunks.push(e.data);
      });
      recorder.addEventListener("stop", function () { onVoiceMirrorRecordingStopped(session); });
      recorder.start();

      document.getElementById("vmRecordZone").classList.add("recording");
      recordBtn.classList.add("live");
      recordBtn.setAttribute("aria-label", "Stop recording");
      hint.textContent = "Recording — tap again to stop";

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      session.audioCtx = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      session.analyser = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const bars = document.getElementById("vmMeter").children;
      function tick() {
        if (voiceMirrorState !== session || !session.analyser) return;
        analyser.getByteFrequencyData(data);
        for (let i = 0; i < bars.length; i++) {
          const idx = Math.floor((i / bars.length) * data.length);
          const v = data[idx] / 255;
          bars[i].style.height = Math.max(10, v * 100) + "%";
        }
        session.meterRafId = requestAnimationFrame(tick);
      }
      tick();

      // hard cap so nobody accidentally leaves it running
      session.recordTimer = setTimeout(function () {
        if (recorder.state === "recording") recorder.stop();
      }, 30000);
    }).catch(function (err) {
      if (voiceMirrorState !== session) return;
      const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
      hint.textContent = denied
        ? "Microphone access was denied. Enable it in your browser's site settings to use Voice Mirror."
        : "Couldn't reach a microphone on this device.";
    });
  }
  function onVoiceMirrorRecordingStopped(session) {
    if (voiceMirrorState !== session) return; // superseded (modal closed, or already re-recording) -- ignore this stale event
    teardownVoiceMirrorRecording();
    const zone = document.getElementById("vmRecordZone");
    const recordBtn = document.getElementById("vmRecordBtn");
    if (zone) zone.classList.remove("recording");
    if (recordBtn) recordBtn.classList.remove("live");

    const mimeType = session.recorder ? session.recorder.mimeType : "";
    const blob = new Blob(session.chunks, mimeType ? { type: mimeType } : undefined);
    if (!blob.size) {
      const hint = document.getElementById("vmHint");
      if (hint) hint.textContent = "That recording came out empty — tap to try again.";
      return;
    }
    session.recordedUrl = URL.createObjectURL(blob);
    showVoiceMirrorCompare(blob);
  }
  function showVoiceMirrorCompare(blob) {
    const zone = document.getElementById("vmRecordZone");
    const compare = document.getElementById("vmCompare");
    if (zone) zone.style.display = "none";
    if (compare) compare.style.display = "";

    const mineAudio = new Audio(voiceMirrorState.recordedUrl);
    voiceMirrorState.mineAudio = mineAudio;
    // Same offline caching approach as playAudio() -- see the note there.
    const reciterUrl = audioUrlFor(voiceMirrorState.card.surah, voiceMirrorState.card.ayah);
    const reciterOfflineBlob = !navigator.onLine ? cachedBlobFor(reciterUrl) : null;
    if (!navigator.onLine && !reciterOfflineBlob) warmFromPersistentCache(reciterUrl);
    const reciterAudio = new Audio(reciterOfflineBlob || reciterUrl);
    voiceMirrorState.reciterAudio = reciterAudio;
    reciterAudio.addEventListener("ended", () => {
      if (!reciterOfflineBlob) {
        warmAudioCache(reciterUrl, { reciter: currentReciter, surah: voiceMirrorState.card.surah, ayah: voiceMirrorState.card.ayah });
      }
    });
    reciterAudio.addEventListener("error", () => {
      if (voiceMirrorState.reciterAudio !== reciterAudio) return;
      const cached = !reciterOfflineBlob && cachedBlobFor(reciterUrl);
      if (cached) reciterAudio.src = cached;
    });

    const playMineBtn = document.getElementById("vmPlayMine");
    const playReciterBtn = document.getElementById("vmPlayReciter");
    wirePlayToggle(playMineBtn, mineAudio, null, null);
    wirePlayToggle(playReciterBtn, reciterAudio, null, document.getElementById("vmEqReciter"));

    const rerecordBtn = document.getElementById("vmRerecordBtn");
    if (rerecordBtn) rerecordBtn.addEventListener("click", resetVoiceMirrorRecording);

    // draw the real waveform for "your take" from the actual recorded audio
    blob.arrayBuffer().then(function (arrayBuffer) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const decodeCtx = new AudioCtx();
      decodeCtx.decodeAudioData(arrayBuffer).then(function (audioBuffer) {
        const canvas = document.getElementById("vmWaveMine");
        if (canvas) drawWaveformOnCanvas(canvas, audioBuffer);
        decodeCtx.close().catch(function () {});
      }).catch(function () { decodeCtx.close().catch(function () {}); });
    }).catch(function () {});
  }
  // Voice Mirror's two tracks (the user's own recording, and the reciter's)
  // used to bypass playAudio() entirely with no retry and no visible error
  // state -- a failed play() just silently reset the button to look exactly
  // like "never tapped," indistinguishable from success. Rebuilt on the
  // same one-retry-then-visible-error pattern as playAudio(), driven off
  // the audio element's own 'playing'/'pause' events (not a hand-tracked
  // boolean) so the button state can't desync from reality across a retry.
  function wirePlayToggle(btn, audioEl, onPlay, eqEl) {
    if (!btn) return;
    let retried = false;
    let handledThisAttempt = false;
    audioEl.addEventListener("playing", () => {
      btn.innerHTML = ICON_PAUSE;
      if (eqEl) eqEl.classList.add("playing");
    });
    audioEl.addEventListener("pause", () => {
      btn.innerHTML = ICON_PLAY;
      if (eqEl) eqEl.classList.remove("playing");
    });
    audioEl.addEventListener("error", handleError);
    btn.addEventListener("click", function () {
      if (!audioEl.paused) { audioEl.pause(); return; }
      clearPlayError(btn);
      // only one of the two tracks plays at a time
      if (voiceMirrorState) {
        if (voiceMirrorState.mineAudio && voiceMirrorState.mineAudio !== audioEl) voiceMirrorState.mineAudio.pause();
        if (voiceMirrorState.reciterAudio && voiceMirrorState.reciterAudio !== audioEl) voiceMirrorState.reciterAudio.pause();
      }
      retried = false;
      handledThisAttempt = false;
      audioEl.currentTime = 0;
      audioEl.play().catch(handleError);
      if (onPlay) onPlay();
    });
    function handleError() {
      if (handledThisAttempt) return;
      handledThisAttempt = true;
      if (!retried) {
        retried = true;
        setTimeout(() => {
          handledThisAttempt = false;
          audioEl.load();
          audioEl.currentTime = 0;
          audioEl.play().catch(handleError);
        }, 500);
        return;
      }
      showPlayError(btn);
    }
  }
  function drawWaveformOnCanvas(canvas, audioBuffer) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const channel = audioBuffer.getChannelData(0);
    const bars = 44;
    const blockSize = Math.max(1, Math.floor(channel.length / bars));
    const cs = getComputedStyle(document.body);
    ctx.fillStyle = cs.getPropertyValue("--emerald").trim() || "#0e6d59";
    const barWidth = w / bars;
    for (let i = 0; i < bars; i++) {
      let max = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize; j++) {
        const v = Math.abs(channel[start + j] || 0);
        if (v > max) max = v;
      }
      const barH = Math.max(2, max * h);
      ctx.fillRect(i * barWidth, (h - barH) / 2, Math.max(1, barWidth - 1.5), barH);
    }
  }
  function resetVoiceMirrorRecording() {
    if (!voiceMirrorState) return;
    if (voiceMirrorState.recordedUrl) URL.revokeObjectURL(voiceMirrorState.recordedUrl);
    if (voiceMirrorState.mineAudio) voiceMirrorState.mineAudio.pause();
    if (voiceMirrorState.reciterAudio) voiceMirrorState.reciterAudio.pause();
    openVoiceMirror(voiceMirrorState.card);
  }

  // ---------- study-mode settings modal ----------
  function fmtCap(n) { return n === Infinity ? "Unlimited" : String(n); }
  function openSettingsModal() {
    const overlay = document.getElementById("settingsOverlay");
    overlay.classList.add("visible");
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-heading">Study Mode</div>
        <p class="modal-sub">How many new verses you take on per day. You can change this any time — it only shapes tomorrow's portion, not what's already scheduled.</p>
        <div class="mode-cards">
          ${Object.entries(STUDY_MODES).map(([id, m]) => `
            <button class="mode-card ${settings.mode === id ? "selected" : ""}" data-mode="${id}">
              <div class="mode-card-top">
                <span class="mode-card-label">${escapeHtml(m.label)}</span>
                <span class="mode-card-count">${fmtCap(m.newPerDay)} new/day</span>
              </div>
              <p class="mode-card-blurb">${escapeHtml(m.blurb)}</p>
              <div class="mode-card-sub">Review cap: ${fmtCap(m.reviewCap)} verses/day</div>
            </button>
          `).join("")}
        </div>
        <button class="secondary-btn" id="closeSettingsBtn" style="width:100%;margin-top:6px">Close</button>
      </div>
    `;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeSettingsModal(); });
    document.getElementById("closeSettingsBtn").addEventListener("click", closeSettingsModal);
    overlay.querySelectorAll(".mode-card").forEach(btn => {
      btn.addEventListener("click", () => {
        settings.mode = btn.dataset.mode;
        saveSettings();
        closeSettingsModal();
        if (document.querySelector(".today-card")) renderHome();
      });
    });
  }
  function closeSettingsModal() {
    const overlay = document.getElementById("settingsOverlay");
    overlay.classList.remove("visible");
    overlay.innerHTML = "";
  }

  // ---------- cloud sync (Firebase, via auth.js) ----------
  // auth.js exposes window.CloudSync once a user is signed in and approved.
  // Only cards/muraja/stats/settings/reciter are synced -- surahCache and
  // wordsCache are pure performance caches, always re-derivable from the
  // same public APIs, so syncing them would just waste Firestore writes.
  function buildProgressPayload() {
    return { cards, muraja, stats, settings, reciter: currentReciter, vocabCards, achievements };
  }
  // A completed surah is permanent -- keep the union from both sides
  // rather than picking one, so a badge earned on either device survives
  // a sync regardless of which side happens to be "newer."
  function mergeAchievements(local, remote) {
    const union = (a, b) => Array.from(new Set([...(a || []), ...(b || [])]));
    // Object.assign-based (not a literal object naming only the fields
    // this function knows about) so completedJuz -- or any future
    // achievement list -- survives a merge even if this function is never
    // updated for it, the same class of silent-field-drop bug already
    // found and fixed in Muhkam's own progress merge today.
    return Object.assign({}, remote, local, {
      completedSurahs: union(local && local.completedSurahs, remote && remote.completedSurahs),
      completedJuz: union(local && local.completedJuz, remote && remote.completedJuz),
    });
  }

  // How far into actual mastery a card has gotten -- mature always outranks
  // reviewing, which always outranks learning, and within a phase, further
  // along its own ladder (learningStep/reviewStep, or interval once mature)
  // outranks less far. Used ahead of raw reps to decide which side of a
  // sync a card's progress should come from: reps only counts how many
  // times a card was EVER reviewed, not how well it's actually going --
  // five encounters full of lapses (still stuck in early learning) isn't
  // more "invested" than two clean encounters that reached reviewing.
  function masteryRank(card) {
    ensurePhaseFields(card);
    if (card.phase === "mature") return 1000 + (card.interval || 0);
    if (card.phase === "reviewing") return 100 + (card.reviewStep || 0);
    return card.learningStep || 0;
  }
  // Merge, not overwrite: this app's whole reason for syncing is that a
  // user may ALREADY have divergent, real progress on two unsynced devices
  // by the time they first sign in on the second one. A naive "cloud wins"
  // or "local wins" would silently drop real SM-2 scheduling history on
  // whichever side loses. Per verse, keep whichever side has gotten
  // further in actual mastery, falling back to reps and then dueDate only
  // to break a genuine tie, rather than picking a side wholesale.
  function mergeCards(local, remote) {
    const merged = Object.assign({}, local);
    Object.keys(remote || {}).forEach(key => {
      const r = remote[key];
      const l = merged[key];
      if (!l) { merged[key] = r; return; }
      const rRank = masteryRank(r), lRank = masteryRank(l);
      if (rRank > lRank) { merged[key] = r; return; }
      if (rRank < lRank) return;
      const rReps = r.reps || 0, lReps = l.reps || 0;
      if (rReps > lReps) merged[key] = r;
      else if (rReps === lReps && (r.dueDate || "") > (l.dueDate || "")) merged[key] = r;
    });
    return merged;
  }
  function mergeMuraja(local, remote) {
    const merged = Object.assign({}, local);
    Object.keys(remote || {}).forEach(key => {
      const r = remote[key];
      const l = merged[key];
      if (!l || (r.lastFullReviewDate || "") > (l.lastFullReviewDate || "")) merged[key] = r;
    });
    return merged;
  }
  // Per-day counts merge by taking the higher count on each date rather
  // than summing -- summing would double-count every day both devices
  // already agree on every time a sync round-trips (same reasoning as
  // totalReviews' Math.max just above).
  function mergeDailyLog(local, remote) {
    const merged = Object.assign({}, local || {});
    Object.keys(remote || {}).forEach(date => {
      merged[date] = Math.max(merged[date] || 0, remote[date]);
    });
    return merged;
  }
  function applyProgressPayload(remote) {
    if (!remote) return;
    cards = mergeCards(cards, remote.cards || {});
    vocabCards = mergeCards(vocabCards, remote.vocabCards || {});
    muraja = mergeMuraja(muraja, remote.muraja || {});
    if (remote.stats) {
      const mergedDailyLog = mergeDailyLog(stats.dailyLog, remote.stats.dailyLog);
      if ((remote.stats.lastStudyDate || "") >= (stats.lastStudyDate || "")) {
        stats = Object.assign({}, stats, remote.stats, {
          totalReviews: Math.max(stats.totalReviews || 0, remote.stats.totalReviews || 0),
          longestStreak: Math.max(stats.longestStreak || 0, remote.stats.longestStreak || 0),
          dailyLog: mergedDailyLog,
        });
      } else {
        stats.totalReviews = Math.max(stats.totalReviews || 0, remote.stats.totalReviews || 0);
        stats.longestStreak = Math.max(stats.longestStreak || 0, remote.stats.longestStreak || 0);
        stats.dailyLog = mergedDailyLog;
      }
    }
    if (remote.settings && STUDY_MODES[remote.settings.mode]) settings = Object.assign({}, settings, remote.settings);
    if (remote.reciter && RECITERS[remote.reciter]) currentReciter = remote.reciter;
    achievements = mergeAchievements(achievements, remote.achievements);
    save(CARDS_KEY, cards);
    save(VOCAB_CARDS_KEY, vocabCards);
    save(MURAJA_KEY, muraja);
    save(STATS_KEY, stats);
    save(SETTINGS_KEY, settings);
    save(ACHIEVEMENTS_KEY, achievements);
    try { localStorage.setItem(RECITER_KEY, currentReciter); } catch (e) { /* private mode or quota exceeded */ }
  }
  function pushToCloud() {
    if (window.CloudSync && window.CloudSync.user) window.CloudSync.pushProgress(buildProgressPayload());
  }

  // Pulls the cloud copy and merges it into local progress, then always
  // pushes the merged result back up -- not only when the cloud had
  // nothing. A cloud document can exist with progress that's missing or
  // behind what this device already has (e.g. a push from this account
  // genuinely never landed) -- pulling alone would silently leave that
  // gap in place until the next review happens to trigger a save. Used
  // by both boot() (runs once automatically) and the "Sync now" button,
  // which exists because a device only ever auto-pulls once, at boot --
  // progress made on another device afterward never shows up here until
  // either a full reload or an explicit manual sync.
  async function syncFromCloud() {
    if (!(window.CloudSync && window.CloudSync.user)) return { found: false };
    const remote = await window.CloudSync.pullProgress();
    const found = !!remote;
    if (remote) applyProgressPayload(remote);
    // Awaited (not fire-and-forget): a caller reporting "uploaded" to the
    // user needs that to mean the write actually happened, not just that
    // it was scheduled.
    await window.CloudSync.pushProgressNow(buildProgressPayload());
    return { found, versesInCloud: found ? Object.keys(remote.cards || {}).length : 0 };
  }

  async function boot() {
    loadAll();
    topnavEl.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => switchScreen(btn.dataset.screen));
    });
    document.getElementById("brandBtn").addEventListener("click", () => switchScreen("home"));
    document.getElementById("settingsBtn").addEventListener("click", openSettingsModal);
    document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);
    document.getElementById("soundToggleBtn").addEventListener("click", toggleSound);
    updateSoundToggleIcon();
    wireOfflineIndicator();
    wirePullToRefresh();
    renderReciterSelect();
    wireMediaSessionActions();

    const syncNowBtn = document.getElementById("syncNowBtn");
    const syncStatusEl = document.getElementById("syncStatus");
    if (syncNowBtn) {
      syncNowBtn.addEventListener("click", async () => {
        if (!(window.CloudSync && window.CloudSync.user)) {
          if (syncStatusEl) syncStatusEl.textContent = "Not signed in.";
          return;
        }
        syncNowBtn.disabled = true;
        if (syncStatusEl) syncStatusEl.textContent = "Syncing…";
        try {
          const result = await syncFromCloud();
          renderReciterSelect();
          if (document.querySelector(".today-card")) renderHome();
          if (syncStatusEl) {
            syncStatusEl.textContent = result.found
              ? `Synced — found ${result.versesInCloud} verse(s) in the cloud; this device's progress was uploaded too.`
              : "The cloud had no saved progress for this account — this device's progress was uploaded.";
          }
        } catch (e) {
          // Show the real reason (e.g. Firestore's own error code, like
          // "permission-denied") instead of a generic guess.
          if (syncStatusEl) syncStatusEl.textContent = `Sync failed: ${(e && (e.code || e.message)) || "unknown error"}`;
        } finally {
          syncNowBtn.disabled = false;
        }
      });
    }

    if (window.CloudSync && window.CloudSync.user) {
      try {
        await syncFromCloud();
        renderReciterSelect();
      } catch (e) { /* offline -- continue with local state */ }
    }

    renderHome();
  }

  window.__appReady = boot;
})();
