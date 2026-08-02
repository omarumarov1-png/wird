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

  const CARDS_KEY = "wird-cards-v1";
  const SETTINGS_KEY = "wird-settings-v1";
  const STATS_KEY = "wird-stats-v1";

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

  let surahList = [];       // [{number, name, englishName, englishNameTranslation, numberOfAyahs, revelationType}]
  let cards = {};           // "surah:ayah" -> card object
  let settings = { mode: DEFAULT_STUDY_MODE };
  function currentModeConfig() { return STUDY_MODES[settings.mode] || STUDY_MODES[DEFAULT_STUDY_MODE]; }
  let stats = { streak: 0, lastStudyDate: null, totalReviews: 0 };
  let surahCache = {};      // "surahNum" -> {ar: [...], en: [...], audio: [...]}
  let wordsCache = {};      // "surah:ayah" -> [{ar, tr, en}, ...] (word-by-word, quran.com)
  let segmentsCache = {};   // "surahNum" -> { ayahNum: [[wordPos, startMsRelative, endMsRelative], ...] }
  let muraja = {};          // "surahNum" -> {lastFullReviewDate, cycleDays, lastRating}
  let currentReciter = localStorage.getItem(RECITER_KEY) || "alafasy";

  function pad3(n) { return String(n).padStart(3, "0"); }
  function audioUrlFor(surah, ayah) {
    const folder = (RECITERS[currentReciter] || RECITERS.alafasy).folder;
    return `https://everyayah.com/data/${folder}/${pad3(surah)}${pad3(ayah)}.mp3`;
  }
  function setReciter(id) {
    if (!RECITERS[id]) return;
    currentReciter = id;
    localStorage.setItem(RECITER_KEY, id);
    pushToCloud();
  }

  let session = null;       // { queue: [card,...], idx, total, revealed, currentMode }
  let currentAudio = null;
  let sardSession = null;   // { surah, verses: [card,...], idx, stumbles: Set, playing }
  let vocabSession = null;  // { queue: [vocabCard,...], idx, total }

  // ---------- persistence ----------
  function load(key, fallback) {
    try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw); } catch (e) {}
    return fallback;
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  function loadAll() {
    cards = load(CARDS_KEY, {});
    settings = Object.assign({ mode: DEFAULT_STUDY_MODE }, load(SETTINGS_KEY, {}));
    if (!STUDY_MODES[settings.mode]) settings.mode = DEFAULT_STUDY_MODE;
    stats = Object.assign({ streak: 0, lastStudyDate: null, totalReviews: 0 }, load(STATS_KEY, {}));
    surahCache = load(SURAH_CACHE_KEY, {});
    wordsCache = load(WORDS_CACHE_KEY, {});
    segmentsCache = load(SEGMENTS_CACHE_KEY, {});
    muraja = load(MURAJA_KEY, {});
    vocabCards = load(VOCAB_CARDS_KEY, {});
  }
  function saveCards() { save(CARDS_KEY, cards); pushToCloud(); }
  function saveSettings() { save(SETTINGS_KEY, settings); pushToCloud(); }
  function saveStats() { save(STATS_KEY, stats); pushToCloud(); }
  function saveSurahCache() { save(SURAH_CACHE_KEY, surahCache); }
  function saveWordsCache() { save(WORDS_CACHE_KEY, wordsCache); }
  function saveSegmentsCache() { save(SEGMENTS_CACHE_KEY, segmentsCache); }
  function saveVocabCards() { save(VOCAB_CARDS_KEY, vocabCards); pushToCloud(); }
  function saveMuraja() { save(MURAJA_KEY, muraja); pushToCloud(); }

  // ---------- date helpers ----------
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function addDaysISO(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
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

  // ---------- API ----------
  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Fetch failed: " + url);
    return res.json();
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
  }
  function wireWordTooltips(container) {
    if (!container) return;
    container.querySelectorAll(".word-tap").forEach(el => {
      el.addEventListener("mouseenter", () => showWordTooltip(el));
      el.addEventListener("mouseleave", hideWordTooltip);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const isSame = wordTooltipEl && wordTooltipEl.classList.contains("visible") && wordTooltipEl.dataset.forEl === el;
        hideWordTooltip();
        if (!isSame) { showWordTooltip(el); if (wordTooltipEl) wordTooltipEl.dataset.forEl = el; }
      });
    });
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".word-tap")) hideWordTooltip();
  });

  // ---------- SRS ----------
  function newCard(surah, ayah, ayahData) {
    return {
      surah, ayah,
      text: ayahData.text, translation: ayahData.translation,
      page: ayahData.page, juz: ayahData.juz,
      interval: 0, ease: 2.5, reps: 0,
      dueDate: todayISO(),
      addedDate: todayISO(),
    };
  }

  function applyRating(card, rating) {
    if (rating === "again") {
      card.reps = 0;
      card.interval = 0;
      card.ease = Math.max(1.3, card.ease - 0.2);
      card.dueDate = todayISO();
    } else {
      card.reps = (card.reps || 0) + 1;
      if (card.reps === 1) card.interval = 1;
      else if (card.reps === 2) card.interval = 3;
      else card.interval = Math.round(card.interval * card.ease);
      if (rating === "hard") { card.ease = Math.max(1.3, card.ease - 0.15); card.interval = Math.max(1, Math.round(card.interval * 0.8)); }
      if (rating === "easy") { card.ease = card.ease + 0.15; card.interval = Math.round(card.interval * 1.35); }
      card.dueDate = addDaysISO(card.interval);
    }
    if (rating === "again" || rating === "hard") card.struggleCount = (card.struggleCount || 0) + 1;
    stats.totalReviews++;
    saveStats();
  }

  function masteryStage(card) {
    if (card.reps === 0) return "new";
    if (card.interval < 7) return "learning";
    if (card.interval < 21) return "young";
    return "mature";
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
    const yestISO = yest.toISOString().slice(0, 10);
    stats.streak = stats.lastStudyDate === yestISO ? stats.streak + 1 : 1;
    stats.lastStudyDate = today;
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
              <div class="glyph">✓</div>
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
  }

  function starSvg() {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.5 7.5L22 8l-6 4.5L18 20l-6-4-6 4 2-7.5-6-4.5 7.5-.5z"/></svg>`;
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
      return `
        <button class="surah-row" data-surah="${s.number}">
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
        <div class="juz-group">
          <div class="juz-heading">Juz 'Amma — recommended starting point</div>
          <div class="surah-list">${amma.map(row).join("")}</div>
        </div>
        <div class="juz-group">
          <div class="juz-heading">The rest of the Qur'an</div>
          <div class="surah-list">${rest.map(row).join("")}</div>
        </div>
      </div>
    `;
    document.querySelectorAll(".surah-row").forEach(btn => {
      btn.addEventListener("click", () => renderSurahBrowser(Number(btn.dataset.surah)));
    });
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
            <button class="add-toggle ${added ? "added" : ""}" data-ayah="${a.numberInSurah}">${added ? "Added ✓" : "Add to Wird"}</button>
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
        const matureCt = cs.filter(c => masteryStage(c) === "mature").length;
        const ratio = matureCt / cs.length;
        bg = ratio > 0.66 ? "var(--good-soft)" : ratio > 0.33 ? "var(--gold-soft)" : "var(--surface-2)";
        col = ratio > 0.66 ? "var(--good)" : ratio > 0.33 ? "var(--gold)" : "var(--text-muted)";
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
          <button class="play-btn" id="listenPlayBtn">▶</button>
          <button class="secondary-btn" id="listenPrevBtn">◂ Prev</button>
          <button class="secondary-btn" id="listenNextBtn">Next ▸</button>
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
      btn.textContent = "▶";
      btn.classList.remove("playing");
      return;
    }
    pageListenState.playing = true;
    btn.textContent = "⏸";
    btn.classList.add("playing");
    playCurrentPageListenVerse();
  }
  function playCurrentPageListenVerse() {
    if (!pageListenState || !pageListenState.playing) return;
    const v = pageListenState.verses[pageListenState.idx];
    const container = document.querySelector(".listen-line.current .listen-line-arabic");
    playAudioWithHighlight(v.surah, v.ayah, container, () => {
      if (!pageListenState || !pageListenState.playing) return;
      if (pageListenState.idx >= pageListenState.verses.length - 1) {
        pageListenState.playing = false;
        const btn = document.getElementById("listenPlayBtn");
        if (btn) { btn.textContent = "▶"; btn.classList.remove("playing"); }
        return;
      }
      pageListenState.idx++;
      drawPageListen();
      const btn = document.getElementById("listenPlayBtn");
      if (btn) { btn.textContent = "⏸"; btn.classList.add("playing"); }
      playCurrentPageListenVerse();
    });
  }
  function stepPageListen(delta) {
    cancelAudio();
    pageListenState.playing = false;
    pageListenState.idx = Math.max(0, Math.min(pageListenState.verses.length - 1, pageListenState.idx + delta));
    drawPageListen();
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
    screenEl.innerHTML = `
      <div class="review-bar">
        <button class="exit-btn" id="exitReviewBtn">&times;</button>
        <div class="progress-track"><div class="progress-fill" id="reviewProgressFill" style="width:0%"></div></div>
      </div>
      <div id="reviewHost"></div>
    `;
    document.getElementById("exitReviewBtn").addEventListener("click", () => { cancelAudio(); renderHome(); });
  }
  function updateReviewProgress() {
    const pct = session.total ? Math.round((session.idx / session.total) * 100) : 0;
    const fill = document.getElementById("reviewProgressFill");
    if (fill) fill.style.width = pct + "%";
  }

  function cancelAudio() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  }
  // Called at the top of every top-level screen render so leftover state
  // from whichever session-like flow (verse review, sard, page-listen,
  // vocab review) the user was in doesn't leak into the next screen.
  function resetActiveSessions() {
    session = null;
    sardSession = null;
    pageListenState = null;
    vocabSession = null;
  }
  function playAudio(url, rate, onEnd) {
    cancelAudio();
    const audio = new Audio(url);
    audio.playbackRate = rate || 1;
    currentAudio = audio;
    audio.addEventListener("ended", () => { if (onEnd) onEnd(); }, { once: true });
    audio.play().catch(() => { if (onEnd) onEnd(); });
    return audio;
  }

  // Plays a verse's audio while highlighting the word currently being
  // recited, using real per-word timing (see ensureSegmentsLoaded) rather
  // than a guessed/animated approximation. Only lights up when both a
  // timing source exists (Alafasy only) AND the container actually has
  // data-pos word spans (i.e. word data was loaded) -- silently falls
  // back to plain playback otherwise, same graceful-degradation spirit
  // as every other optional-data feature in this app.
  async function playAudioWithHighlight(surah, ayah, containerEl, onEnd) {
    const segByAyah = await ensureSegmentsLoaded(surah).catch(() => null);
    const segments = segByAyah && segByAyah[ayah];
    cancelAudio();
    const audio = new Audio(audioUrlFor(surah, ayah));
    currentAudio = audio;
    let rafId = null;
    function clearHighlight() {
      if (containerEl) containerEl.querySelectorAll(".word-playing").forEach(el => el.classList.remove("word-playing"));
    }
    function tick() {
      if (!currentAudio || currentAudio !== audio) { clearHighlight(); return; } // superseded/paused externally (e.g. cancelAudio() from a manual pause) -- clean up our own highlight rather than leaving it stuck
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
    const settle = () => { if (rafId) cancelAnimationFrame(rafId); clearHighlight(); if (onEnd) onEnd(); };
    audio.addEventListener("ended", settle, { once: true });
    audio.addEventListener("error", settle, { once: true });
    audio.play().catch(settle);
    return audio;
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
    const host = document.getElementById("reviewHost");
    if (!host) return;

    // opportunistic mutashabih check: only offer if we find a real match in the user's set
    const mutashabihMatch = findMutashabih(card);
    let mode = await pickMode(card);
    if (mutashabihMatch && masteryStage(card) !== "new" && Math.random() < 0.4) mode = "mutashabih";

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

  function refBadge(card) {
    const meta = surahList.find(s => s.number === card.surah);
    const name = meta ? meta.englishName : `Surah ${card.surah}`;
    return `${name} ${card.ayah}`;
  }

  function ratingRowHtml() {
    return `
      <div class="rating-row" id="ratingRow" style="display:none">
        <button class="rate-btn again" data-r="again">Again<span class="sub">forgot</span></button>
        <button class="rate-btn hard" data-r="hard">Hard<span class="sub">struggled</span></button>
        <button class="rate-btn good" data-r="good">Good<span class="sub">recalled</span></button>
        <button class="rate-btn easy" data-r="easy">Easy<span class="sub">instant</span></button>
        <div class="rating-hint">Swipe right/left (Good/Again), or ←/→ · 1–4</div>
      </div>
    `;
  }
  // Shared by every rating row (verse review + vocab review). Two input
  // paths beyond plain tapping:
  //  - touch/mouse: swipe the row itself right (Good) or left (Again) --
  //    exactly two directions, no need to hit a specific button.
  //  - desktop keyboard: Left/Right arrows mirror the same two swipes;
  //    1-4 still give precise access to all four ratings.
  // `rate(key)` is the single call site every input path funnels through,
  // so there is exactly one place that ever applies a rating -- no risk
  // of a swipe's synthetic action and the browser's own trailing native
  // click both firing for the same gesture.
  // Generic 2-direction drag gesture, reused by both the compact rating
  // row and the full story-card. Drags `el` itself (translate + tilt +
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
      }
      if (moved) { deltaX = dx; applyVisual(dx); }
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
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
    el.addEventListener("pointercancel", () => { dragging = false; el.classList.remove("swiping"); resetVisual(); moved = false; });
    return { wasRecentlyDragged: () => moved };
  }
  // Shared by every rating row (verse review + vocab review). Two input
  // paths beyond plain tapping:
  //  - touch/mouse: swipe the row itself right (Good) or left (Again) --
  //    exactly two directions, no need to hit a specific button.
  //  - desktop keyboard: Left/Right arrows mirror the same two swipes;
  //    1-4 still give precise access to all four ratings.
  // `rate(key)` is the single call site every input path funnels through,
  // so there is exactly one place that ever applies a rating -- no risk
  // of a swipe's synthetic action and the browser's own trailing native
  // click both firing for the same gesture.
  function wireRatingRowInteractions(row, rate) {
    const buttons = Array.from(row.querySelectorAll(".rate-btn"));
    let applied = false;
    function fire(ratingKey) {
      if (applied) return;
      applied = true;
      document.removeEventListener("keydown", onKeydown);
      rate(ratingKey);
    }
    const swipe = wireHorizontalSwipe(row, { onRight: () => fire("good"), onLeft: () => fire("again") });
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        if (swipe.wasRecentlyDragged()) return; // tail end of a swipe gesture, already handled
        fire(btn.dataset.r);
      });
    });
    function onKeydown(e) {
      const active = document.activeElement;
      if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); fire("good"); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); fire("again"); return; }
      const idx = { "1": 0, "2": 1, "3": 2, "4": 3 }[e.key];
      if (idx === undefined) return;
      const btn = buttons[idx];
      if (btn && !btn.disabled) { e.preventDefault(); fire(btn.dataset.r); }
    }
    document.addEventListener("keydown", onKeydown);
    // Lets an external gesture (e.g. the story-card's whole-zone swipe)
    // that committed a rating through its own path shut this row's
    // listeners down too, so its keydown handler can't double-apply a
    // rating during the brief transition before the next card renders.
    return { disable: () => { applied = true; document.removeEventListener("keydown", onKeydown); } };
  }
  function wireRatingRow(card, onDone) {
    const row = document.getElementById("ratingRow");
    row.style.display = "grid";
    return wireRatingRowInteractions(row, (ratingKey) => {
      applyRating(card, ratingKey);
      saveCards();
      session.idx++;
      onDone ? onDone() : renderNextCard();
    });
  }

  // -- mode: listen & recall --
  // Listen & Recall as an immersive, story-style card: the recitation
  // auto-plays and loops -- keeps repeating -- until you swipe. Swipe
  // right ("it's fine") reveals + rates Good and moves on; swipe left
  // ("I don't have this") reveals + rates Again and moves on. Tapping to
  // peek early, the 4-way rating row, and keyboard shortcuts all still
  // work exactly as before -- the loop/swipe is a faster path layered on
  // top, not a replacement for them.
  function renderListenRecall(host, card) {
    let revealed = false;
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
            <div class="story-loop-indicator" id="loopIndicator"><span class="pulse-dot"></span>On loop &mdash; swipe when ready</div>
            <div id="revealArea">
              <button class="reveal-btn" id="revealBtn">Tap to peek</button>
            </div>
          </div>
        </div>
        ${ratingRowHtml()}
      </div>
    `;
    const zone = document.getElementById("storySwipeZone");
    const row = document.getElementById("ratingRow");

    function revealNow() {
      if (revealed) return;
      revealed = true;
      document.getElementById("revealArea").innerHTML = `
        <div class="card-arabic-box"><div class="card-arabic">${arabicHtmlFor(card)}</div></div>
        <div class="card-translation">${escapeHtml(card.translation)}</div>
      `;
      wireWordTooltips(document.getElementById("revealArea"));
    }
    function loopPlay() {
      if (settled) return;
      const container = revealed ? document.querySelector("#revealArea .card-arabic") : null;
      const indicator = document.getElementById("loopIndicator");
      if (indicator) indicator.classList.add("playing");
      const onEnd = () => {
        if (indicator) indicator.classList.remove("playing");
        if (settled) return;
        setTimeout(() => { if (!settled) loopPlay(); }, 650);
      };
      if (container) playAudioWithHighlight(card.surah, card.ayah, container, onEnd);
      else playAudio(audioUrlFor(card.surah, card.ayah), 1, onEnd);
    }
    loopPlay();

    document.getElementById("revealBtn").addEventListener("click", revealNow);

    const ratingRowCtl = wireRatingRow(card, () => { settled = true; renderNextCard(); });
    wireHorizontalSwipe(zone, {
      onRight: () => commit("good"),
      onLeft: () => commit("again"),
    });
    function commit(ratingKey) {
      if (settled) return;
      settled = true;
      cancelAudio();
      ratingRowCtl.disable();
      row.style.pointerEvents = "none";
      revealNow();
      zone.classList.add(ratingKey === "good" ? "story-committed-good" : "story-committed-again");
      applyRating(card, ratingKey);
      saveCards();
      session.idx++;
      setTimeout(() => renderNextCard(), 480);
    }
  }

  // -- mode: fade recall --
  function renderFadeRecall(host, card) {
    const stage = masteryStage(card);
    const fadeLevel = stage === "learning" ? 0.15 : stage === "young" ? 0.45 : 0.75;
    const words = card.text.split(" ");
    const faded = words.map(w => Math.random() < fadeLevel
      ? `<span class="hidden-word">${"ـ".repeat(Math.min(4, Math.max(2, w.length)))}</span>`
      : escapeHtml(w)
    ).join(" ");
    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Fade Recall</div>
        <div class="mode-hint">Recite the missing words from memory, then reveal to check.</div>
        <div class="ref-badge">${escapeHtml(refBadge(card))}</div>
        <div class="card-arabic-box"><div class="card-arabic" id="fadeArabic">${faded}</div></div>
        <div class="audio-row"><button class="play-btn" id="playBtn">▶</button></div>
        <button class="reveal-btn" id="revealBtn">Reveal full verse</button>
        <div id="fullArea"></div>
        ${ratingRowHtml()}
      </div>
    `;
    document.getElementById("playBtn").addEventListener("click", (e) => {
      e.currentTarget.classList.add("playing");
      playAudio(audioUrlFor(card.surah, card.ayah), 1, () => e.currentTarget.classList.remove("playing"));
    });
    document.getElementById("revealBtn").addEventListener("click", (e) => {
      document.getElementById("fadeArabic").innerHTML = arabicHtmlFor(card);
      wireWordTooltips(document.getElementById("fadeArabic"));
      document.getElementById("fullArea").innerHTML = `<div class="card-translation">${escapeHtml(card.translation)}</div>`;
      e.currentTarget.style.display = "none";
      wireRatingRow(card);
    });
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
        <div class="audio-row"><button class="play-btn" id="playBtn">▶ Play this verse</button></div>
        <div class="chain-options" id="chainOptions">
          ${options.map((t, i) => `<button class="chain-opt" data-i="${i}">${escapeHtml(t)}</button>`).join("")}
        </div>
        <div id="chainFeedback"></div>
        ${ratingRowHtml()}
      </div>
    `;
    document.getElementById("playBtn").addEventListener("click", (e) => {
      e.currentTarget.classList.add("playing");
      playAudio(audioUrlFor(card.surah, card.ayah), 1, () => e.currentTarget.classList.remove("playing"));
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
        wireRatingRow(card);
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
    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Look-Alike Challenge</div>
        <div class="mode-hint">These two verses closely resemble each other. Which one is <b>${escapeHtml(refBadge(card))}</b>?</div>
        <div class="audio-row"><button class="play-btn" id="playBtn">▶ Play the target verse</button></div>
        <div class="mutashabih-pair" id="mutashabihPair">
          ${options.map((c, i) => `
            <div class="mutashabih-card" data-i="${i}">
              <div class="arabic">${arabicHtmlFor(c)}</div>
            </div>
          `).join("")}
        </div>
        <div id="mutashabihFeedback"></div>
        ${ratingRowHtml()}
      </div>
    `;
    wireWordTooltips(document.getElementById("mutashabihPair"));
    document.getElementById("playBtn").addEventListener("click", (e) => {
      e.currentTarget.classList.add("playing");
      playAudio(audioUrlFor(card.surah, card.ayah), 1, () => e.currentTarget.classList.remove("playing"));
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
        wireRatingRow(card);
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
        <div class="card-arabic-box"><div class="card-arabic">${arabicHtmlFor(card)}</div></div>
        <div class="audio-row"><button class="play-btn" id="playBtn">▶</button></div>
        <div class="page-picker" id="pagePicker">
          ${choices.map(p => `<button class="page-cell" data-p="${p}">${p}</button>`).join("")}
        </div>
        <div id="pageFeedback"></div>
        ${ratingRowHtml()}
      </div>
    `;
    wireWordTooltips(host.querySelector(".card-arabic-box"));
    document.getElementById("playBtn").addEventListener("click", (e) => {
      e.currentTarget.classList.add("playing");
      playAudio(audioUrlFor(card.surah, card.ayah), 1, () => e.currentTarget.classList.remove("playing"));
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
        wireRatingRow(card);
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
        <div class="audio-row"><button class="play-btn" id="playBtn">▶ Play</button></div>
        <div class="options" id="blindOptions">
          ${options.map((c, i) => `<button class="option" data-i="${i}">${escapeHtml(refBadge(c))}</button>`).join("")}
        </div>
        <div id="blindFeedback"></div>
        ${ratingRowHtml()}
      </div>
    `;
    document.getElementById("playBtn").addEventListener("click", (e) => {
      e.currentTarget.classList.add("playing");
      playAudio(audioUrlFor(card.surah, card.ayah), 1, () => e.currentTarget.classList.remove("playing"));
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
        wireRatingRow(card);
      });
    });
  }

  // -- mode: assemble (word order) --
  // Uses the real per-word breakdown (quran.com), not a naive whitespace
  // split of card.text -- word boundaries from the authoritative
  // word-by-word source avoid any mismatch with diacritic/whitespace
  // quirks a manual split could introduce.
  function renderAssemble(host, card) {
    const wordData = wordDataFor(card);
    if (!wordData) return renderFadeRecall(host, card);
    const bank = shuffled(wordData.map((w, i) => ({ ...w, id: i })));
    const placed = [];

    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Word Order</div>
        <div class="mode-hint">Tap the words in the right order to rebuild the verse.</div>
        <div class="ref-badge">${escapeHtml(refBadge(card))}</div>
        <div class="audio-row"><button class="play-btn" id="playBtn">▶</button></div>
        <div class="wb-target" id="assembleTarget" dir="rtl"></div>
        <div class="wb-bank" id="assembleBank">
          ${bank.map(w => `<button class="wb-chip" data-id="${w.id}" data-ar="${escapeHtml(w.ar)}">${escapeHtml(w.ar)}</button>`).join("")}
        </div>
        <button class="primary-btn" id="assembleCheckBtn" disabled>Check</button>
        <div id="assembleFeedback"></div>
        ${ratingRowHtml()}
      </div>
    `;
    document.getElementById("playBtn").addEventListener("click", (e) => {
      e.currentTarget.classList.add("playing");
      playAudio(audioUrlFor(card.surah, card.ayah), 1, () => e.currentTarget.classList.remove("playing"));
    });

    const targetEl = document.getElementById("assembleTarget");
    const checkBtn = document.getElementById("assembleCheckBtn");
    function renderTarget() {
      targetEl.innerHTML = placed.map(w => `<button class="wb-chip in-target" data-id="${w.id}">${escapeHtml(w.ar)}</button>`).join("");
      checkBtn.disabled = placed.length !== wordData.length;
      targetEl.querySelectorAll(".wb-chip").forEach(chip => {
        chip.addEventListener("click", () => {
          const id = Number(chip.dataset.id);
          const idx = placed.findIndex(p => p.id === id);
          if (idx >= 0) placed.splice(idx, 1);
          const bankChip = document.querySelector(`#assembleBank .wb-chip[data-id="${id}"]`);
          if (bankChip) bankChip.classList.remove("placed");
          renderTarget();
        });
      });
    }
    document.getElementById("assembleBank").querySelectorAll(".wb-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        if (chip.classList.contains("placed")) return;
        const id = Number(chip.dataset.id);
        placed.push(wordData.find((w, i) => i === id));
        placed[placed.length - 1].id = id;
        chip.classList.add("placed");
        renderTarget();
      });
    });
    checkBtn.addEventListener("click", () => {
      checkBtn.disabled = true;
      const correct = placed.every((w, i) => w.id === i);
      document.querySelectorAll("#assembleBank .wb-chip").forEach(c => c.style.pointerEvents = "none");
      document.querySelectorAll("#assembleTarget .wb-chip").forEach(c => c.style.pointerEvents = "none");
      document.getElementById("assembleFeedback").innerHTML = correct
        ? `<div class="feedback-line correct">Correct order.</div>`
        : `<div class="feedback-line incorrect">Not quite. Correct order:</div><div class="card-arabic-box" style="margin-top:10px"><div class="card-arabic">${arabicHtmlFor(card)}</div></div>`;
      if (!correct) wireWordTooltips(document.getElementById("assembleFeedback"));
      wireRatingRow(card);
    });
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
        ${ratingRowHtml()}
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
          wireRatingRow(card);
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
      ? `<span class="hidden-word">____</span>`
      : `<span class="word-tap" data-tr="${escapeHtml(w.tr)}" data-en="${escapeHtml(w.en)}">${escapeHtml(w.ar)}</span>`
    ).join(" ");

    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Missing Word</div>
        <div class="mode-hint">Which word belongs in the gap?</div>
        <div class="ref-badge">${escapeHtml(refBadge(card))}</div>
        <div class="card-arabic-box"><div class="card-arabic">${withBlank}</div></div>
        <div class="audio-row"><button class="play-btn" id="playBtn">▶</button></div>
        <div class="options" id="clozeOptions">
          ${options.map((w, i) => `<button class="option" data-i="${i}" dir="rtl" style="text-align:right;font-family:var(--font-arabic);font-size:1.3rem">${escapeHtml(w.ar)}</button>`).join("")}
        </div>
        <div id="clozeFeedback"></div>
        ${ratingRowHtml()}
      </div>
    `;
    wireWordTooltips(host.querySelector(".card-arabic-box"));
    document.getElementById("playBtn").addEventListener("click", (e) => {
      e.currentTarget.classList.add("playing");
      playAudio(audioUrlFor(card.surah, card.ayah), 1, () => e.currentTarget.classList.remove("playing"));
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
        wireRatingRow(card);
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
    sardSession = { surah: surahNum, verses, idx: 0, stumbles: new Set(), playing: false };
    renderSardScreen();
  }

  function renderSardScreen() {
    const meta = surahList.find(s => s.number === sardSession.surah);
    const rows = sardSession.verses.map((v, i) => `
      <div class="sard-line ${i === sardSession.idx ? "current" : i < sardSession.idx ? "done" : ""}" data-i="${i}">
        <span class="sard-num">${v.ayah}</span>
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
          <h1 style="font-size:1.5rem">${meta ? escapeHtml(meta.englishName) : "Surah " + sardSession.surah}</h1>
          <p>Recite from memory, verse by verse, without stopping. Text stays hidden — this tests the whole chain, not one link at a time.</p>
        </div>
        <div class="sard-controls">
          <button class="play-btn" id="sardPlayBtn">▶</button>
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
      btn.textContent = "▶";
      btn.classList.remove("playing");
      return;
    }
    sardSession.playing = true;
    btn.textContent = "⏸";
    btn.classList.add("playing");
    playCurrentSardVerse();
  }
  function playCurrentSardVerse() {
    if (!sardSession || !sardSession.playing) return;
    if (sardSession.idx >= sardSession.verses.length) { sardSession.playing = false; return; }
    const v = sardSession.verses[sardSession.idx];
    playAudio(audioUrlFor(v.surah, v.ayah), 1, () => {
      if (!sardSession || !sardSession.playing) return;
      advanceSard(true);
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
      if (btn) { btn.textContent = "⏸"; btn.classList.add("playing"); }
      playCurrentSardVerse();
    }
  }

  function finishSard() {
    cancelAudio();
    const { surah, verses, stumbles } = sardSession;
    const meta = surahList.find(s => s.number === surah);
    screenEl.innerHTML = `
      <div class="container">
        <div class="complete-screen">
          <div class="complete-emoji">﴾ ﴿</div>
          <h2>How did that sard feel?</h2>
          <p>${meta ? escapeHtml(meta.englishName) : "This surah"} — ${verses.length} verses${stumbles.size ? `, ${stumbles.size} marked as rough` : ""}. Your honest answer sets when this surah comes back around.</p>
          <div class="sard-rating-row">
            ${Object.entries(SARD_RATINGS).map(([key, r]) => `
              <button class="rate-btn sard-rate-btn" data-rating="${key}">${r.label}<span class="sub">${r.sub}</span></button>
            `).join("")}
          </div>
        </div>
      </div>
    `;
    document.querySelectorAll(".sard-rate-btn").forEach(btn => {
      btn.addEventListener("click", () => {
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
    return { id, interval: 0, ease: 2.5, reps: 0, dueDate: todayISO(), addedDate: todayISO() };
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
              <div class="glyph">✓</div>
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
          <button class="add-toggle ${added ? "added" : ""}" data-id="${escapeHtml(w.id)}">${added ? "Added ✓" : "Add"}</button>
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
        btn.textContent = vocabCards[id] ? "Added ✓" : "Add";
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
    screenEl.innerHTML = `
      <div class="review-bar">
        <button class="exit-btn" id="exitVocabBtn">&times;</button>
        <div class="progress-track"><div class="progress-fill" id="vocabProgressFill" style="width:0%"></div></div>
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
  function wireVocabRatingRow(card) {
    const row = document.getElementById("ratingRow");
    row.style.display = "grid";
    wireRatingRowInteractions(row, (ratingKey) => {
      applyRating(card, ratingKey);
      saveVocabCards();
      vocabSession.idx++;
      renderNextVocabCard();
    });
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
    if (mode === "flash") return renderVocabFlash(host, card, word);
    if (mode === "mc-meaning") return renderVocabMcMeaning(host, card, word);
    if (mode === "mc-arabic") return renderVocabMcArabic(host, card, word);
    if (mode === "context") return renderVocabContext(host, card, word);
    if (mode === "audio-rec") return renderVocabAudioRec(host, card, word);
    return renderVocabFlash(host, card, word);
  }

  function vocabPlayBtnHtml(id) { return `<div class="audio-row"><button class="play-btn" id="vocabPlayBtn">▶</button></div>`; }
  function wireVocabPlay(word) {
    const btn = document.getElementById("vocabPlayBtn");
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.currentTarget.classList.add("playing");
      const url = word.au ? `https://audio.qurancdn.com/${word.au}` : null;
      if (url) playAudio(url, 1, () => e.currentTarget.classList.remove("playing"));
      else e.currentTarget.classList.remove("playing");
    });
  }

  // -- vocab mode: flashcard --
  function renderVocabFlash(host, card, word) {
    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Flashcard</div>
        <div class="mode-hint">Recall the meaning, then reveal to check.</div>
        <div class="ref-badge">Rank ${word.rk} · seen ${word.n}×</div>
        <div class="card-arabic-box"><div class="card-arabic" dir="rtl">${escapeHtml(word.ar)}</div></div>
        ${vocabPlayBtnHtml()}
        <div id="vocabRevealArea">
          <button class="reveal-btn" id="vocabRevealBtn">Tap to reveal meaning</button>
        </div>
        ${ratingRowHtml()}
      </div>
    `;
    wireVocabPlay(word);
    document.getElementById("vocabRevealBtn").addEventListener("click", () => {
      document.getElementById("vocabRevealArea").innerHTML = `
        <div class="card-translation" style="font-size:1.05rem;font-weight:600;color:var(--text)">${escapeHtml(word.tr)}</div>
        <div class="card-translation">${word.en.map(escapeHtml).join(" · ")}</div>
      `;
      wireVocabRatingRow(card);
    });
  }

  // -- vocab mode: multiple choice, Arabic -> meaning --
  function renderVocabMcMeaning(host, card, word) {
    const others = sample(vocabBank.filter(w => w.id !== word.id), 3);
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
        ${ratingRowHtml()}
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
        wireVocabRatingRow(card);
      });
    });
  }

  // -- vocab mode: multiple choice, meaning -> Arabic --
  function renderVocabMcArabic(host, card, word) {
    const others = sample(vocabBank.filter(w => w.id !== word.id), 3);
    const options = shuffled([word, ...others]);
    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Find The Word</div>
        <div class="mode-hint">Which word means "${escapeHtml(word.en[0])}"?</div>
        <div class="options" id="vocabMcOptions2">
          ${options.map((w, i) => `<button class="option" data-i="${i}" dir="rtl" style="text-align:right;font-family:var(--font-arabic);font-size:1.3rem">${escapeHtml(w.ar)}</button>`).join("")}
        </div>
        <div id="vocabMcFeedback2"></div>
        ${ratingRowHtml()}
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
        wireVocabRatingRow(card);
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

    const others = sample(vocabBank.filter(w => w.id !== word.id), 3);
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
        ${ratingRowHtml()}
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
        wireVocabRatingRow(card);
      });
    });
  }

  // -- vocab mode: audio recognition --
  function renderVocabAudioRec(host, card, word) {
    if (!word.au) return renderVocabMcMeaning(host, card, word);
    const others = sample(vocabBank.filter(w => w.id !== word.id), 3);
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
        ${ratingRowHtml()}
      </div>
    `;
    wireVocabPlay(word);
    document.getElementById("vocabPlayBtn").click();
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
        wireVocabRatingRow(card);
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
  function switchScreen(name) {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.screen === name));
    if (name === "home") renderHome();
    else if (name === "library") renderLibrary();
    else if (name === "mushaf") renderMushaf();
    else if (name === "vocab") renderVocabHome();
  }

  function renderReciterSelect() {
    const sel = document.getElementById("reciterSelect");
    sel.innerHTML = Object.entries(RECITERS).map(([id, r]) =>
      `<option value="${id}" ${id === currentReciter ? "selected" : ""}>${escapeHtml(r.name)}</option>`
    ).join("");
    sel.addEventListener("change", () => setReciter(sel.value));
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
    return { cards, muraja, stats, settings, reciter: currentReciter, vocabCards };
  }

  // Merge, not overwrite: this app's whole reason for syncing is that a
  // user may ALREADY have divergent, real progress on two unsynced devices
  // by the time they first sign in on the second one. A naive "cloud wins"
  // or "local wins" would silently drop real SM-2 scheduling history on
  // whichever side loses. Per verse, keep whichever side has more actual
  // study investment (higher reps; later dueDate as a tiebreak) rather than
  // picking a side wholesale.
  function mergeCards(local, remote) {
    const merged = Object.assign({}, local);
    Object.keys(remote || {}).forEach(key => {
      const r = remote[key];
      const l = merged[key];
      if (!l) { merged[key] = r; return; }
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
  function applyProgressPayload(remote) {
    if (!remote) return;
    cards = mergeCards(cards, remote.cards || {});
    vocabCards = mergeCards(vocabCards, remote.vocabCards || {});
    muraja = mergeMuraja(muraja, remote.muraja || {});
    if (remote.stats) {
      if ((remote.stats.lastStudyDate || "") >= (stats.lastStudyDate || "")) {
        stats = Object.assign({}, stats, remote.stats, {
          totalReviews: Math.max(stats.totalReviews || 0, remote.stats.totalReviews || 0),
        });
      } else {
        stats.totalReviews = Math.max(stats.totalReviews || 0, remote.stats.totalReviews || 0);
      }
    }
    if (remote.settings && STUDY_MODES[remote.settings.mode]) settings = Object.assign({}, settings, remote.settings);
    if (remote.reciter && RECITERS[remote.reciter]) currentReciter = remote.reciter;
    save(CARDS_KEY, cards);
    save(VOCAB_CARDS_KEY, vocabCards);
    save(MURAJA_KEY, muraja);
    save(STATS_KEY, stats);
    save(SETTINGS_KEY, settings);
    localStorage.setItem(RECITER_KEY, currentReciter);
  }
  function pushToCloud() {
    if (window.CloudSync && window.CloudSync.user) window.CloudSync.pushProgress(buildProgressPayload());
  }

  async function boot() {
    loadAll();
    topnavEl.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => switchScreen(btn.dataset.screen));
    });
    document.getElementById("brandBtn").addEventListener("click", () => switchScreen("home"));
    document.getElementById("settingsBtn").addEventListener("click", openSettingsModal);
    renderReciterSelect();

    if (window.CloudSync && window.CloudSync.user) {
      try {
        const remote = await window.CloudSync.pullProgress();
        if (remote) applyProgressPayload(remote);
        renderReciterSelect();
        pushToCloud();
      } catch (e) { /* offline -- continue with local state */ }
    }

    renderHome();
  }

  window.__appReady = boot;
})();
