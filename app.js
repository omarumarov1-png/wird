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
  const SURAH_CACHE_KEY = "wird-surah-cache-v1";

  const JUZ_AMMA_START = 78; // verified live against api.alquran.cloud: surah 77 last ayah = juz 29, surah 78-114 = juz 30
  const JUZ_AMMA_END = 114;

  const screenEl = document.getElementById("screen");
  const topnavEl = document.getElementById("topnav");

  let surahList = [];       // [{number, name, englishName, englishNameTranslation, numberOfAyahs, revelationType}]
  let cards = {};           // "surah:ayah" -> card object
  let settings = { newPerDay: 5, reviewCap: 40 };
  let stats = { streak: 0, lastStudyDate: null, totalReviews: 0 };
  let surahCache = {};      // "surahNum" -> {ar: [...], en: [...], audio: [...]}
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
  }

  let session = null;       // { queue: [card,...], idx, total, revealed, currentMode }
  let currentAudio = null;

  // ---------- persistence ----------
  function load(key, fallback) {
    try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw); } catch (e) {}
    return fallback;
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  function loadAll() {
    cards = load(CARDS_KEY, {});
    settings = Object.assign({ newPerDay: 5, reviewCap: 40 }, load(SETTINGS_KEY, {}));
    stats = Object.assign({ streak: 0, lastStudyDate: null, totalReviews: 0 }, load(STATS_KEY, {}));
    surahCache = load(SURAH_CACHE_KEY, {});
  }
  function saveCards() { save(CARDS_KEY, cards); }
  function saveSettings() { save(SETTINGS_KEY, settings); }
  function saveStats() { save(STATS_KEY, stats); }
  function saveSurahCache() { save(SURAH_CACHE_KEY, surahCache); }

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
    stats.totalReviews++;
    saveStats();
  }

  function masteryStage(card) {
    if (card.reps === 0) return "new";
    if (card.interval < 7) return "learning";
    if (card.interval < 21) return "young";
    return "mature";
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
    return {
      due: due.slice(0, settings.reviewCap),
      fresh: fresh.slice(0, settings.newPerDay),
    };
  }

  async function renderHome() {
    cancelAudio();
    session = null;
    await ensureSurahList();
    const { due, fresh } = computeQueue();
    const total = due.length + fresh.length;
    const allCards = Object.values(cards);
    const matureCt = allCards.filter(c => masteryStage(c) === "mature").length;

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
  }

  function starSvg() {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.5 7.5L22 8l-6 4.5L18 20l-6-4-6 4 2-7.5-6-4.5 7.5-.5z"/></svg>`;
  }

  // ---------- library ----------
  async function renderLibrary() {
    cancelAudio(); session = null;
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
      data = await ensureSurahLoaded(surahNum);
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
          <div class="ayah-arabic">${escapeHtml(a.text)}</div>
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
  async function renderMushaf() {
    cancelAudio(); session = null;
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
    const pages = {};
    allCards.forEach(c => { (pages[c.page] = pages[c.page] || []).push(c); });
    const pageNums = Object.keys(pages).map(Number).sort((a, b) => a - b);
    const cells = pageNums.map(p => {
      const cs = pages[p];
      const matureCt = cs.filter(c => masteryStage(c) === "mature").length;
      const ratio = matureCt / cs.length;
      const bg = ratio > 0.66 ? "var(--good-soft)" : ratio > 0.33 ? "var(--gold-soft)" : "var(--surface-2)";
      const col = ratio > 0.66 ? "var(--good)" : ratio > 0.33 ? "var(--gold)" : "var(--text-muted)";
      return `<div class="mushaf-page-cell has-verses" style="background:${bg};color:${col};border-color:${col}" title="${cs.length} verse(s) on page ${p}">${p}</div>`;
    }).join("");

    screenEl.innerHTML = `
      <div class="container">
        <div class="hero" style="padding-top:0">
          <h1 style="font-size:1.6rem">Mushaf</h1>
          <p>Each square is a real mushaf page containing verses you're memorizing. Color shows how mature that page is — this is the same spatial "where on the page" memory ḥuffāẓ rely on.</p>
        </div>
        <div class="mushaf-grid">${cells}</div>
        <div class="mushaf-legend">
          <span><span class="legend-swatch" style="background:var(--surface-2)"></span>New/learning</span>
          <span><span class="legend-swatch" style="background:var(--gold-soft)"></span>Young</span>
          <span><span class="legend-swatch" style="background:var(--good-soft)"></span>Mature</span>
        </div>
      </div>
    `;
  }

  // ---------- review session ----------
  async function startWird() {
    const { due, fresh } = computeQueue();
    const queue = [...due, ...fresh];
    if (!queue.length) return renderHome();
    updateStreak();
    session = { queue, total: queue.length, idx: 0 };
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
  function playAudio(url, rate, onEnd) {
    cancelAudio();
    const audio = new Audio(url);
    audio.playbackRate = rate || 1;
    currentAudio = audio;
    audio.addEventListener("ended", () => { if (onEnd) onEnd(); }, { once: true });
    audio.play().catch(() => { if (onEnd) onEnd(); });
    return audio;
  }

  function eligibleModes(card) {
    const stage = masteryStage(card);
    const modes = ["listen"];
    if (stage !== "new") modes.push("fade");
    if (stage === "young" || stage === "mature") {
      modes.push("chain");
      modes.push("page");
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
      </div>
    `;
  }
  function wireRatingRow(card, onDone) {
    const row = document.getElementById("ratingRow");
    row.style.display = "grid";
    row.querySelectorAll(".rate-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        applyRating(card, btn.dataset.r);
        saveCards();
        session.idx++;
        onDone ? onDone() : renderNextCard();
      });
    });
  }

  // -- mode: listen & recall --
  function renderListenRecall(host, card) {
    host.innerHTML = `
      <div class="review-stage">
        <div class="mode-kicker">Listen &amp; Recall</div>
        <div class="mode-hint">Play the recitation, try to recall it, then reveal.</div>
        <div class="ref-badge">${escapeHtml(refBadge(card))}</div>
        <div class="audio-row">
          <button class="play-btn" id="playBtn">▶</button>
        </div>
        <div id="revealArea">
          <button class="reveal-btn" id="revealBtn">Tap to reveal text</button>
        </div>
        ${ratingRowHtml()}
      </div>
    `;
    document.getElementById("playBtn").addEventListener("click", (e) => {
      e.currentTarget.classList.add("playing");
      playAudio(audioUrlFor(card.surah, card.ayah), 1, () => e.currentTarget.classList.remove("playing"));
    });
    document.getElementById("revealBtn").addEventListener("click", () => {
      document.getElementById("revealArea").innerHTML = `
        <div class="card-arabic-box"><div class="card-arabic">${escapeHtml(card.text)}</div></div>
        <div class="card-translation">${escapeHtml(card.translation)}</div>
      `;
      wireRatingRow(card);
    });
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
      document.getElementById("fadeArabic").innerHTML = escapeHtml(card.text);
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
              <div class="arabic">${escapeHtml(c.text)}</div>
            </div>
          `).join("")}
        </div>
        <div id="mutashabihFeedback"></div>
        ${ratingRowHtml()}
      </div>
    `;
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
        <div class="card-arabic-box"><div class="card-arabic">${escapeHtml(card.text)}</div></div>
        <div class="audio-row"><button class="play-btn" id="playBtn">▶</button></div>
        <div class="page-picker" id="pagePicker">
          ${choices.map(p => `<button class="page-cell" data-p="${p}">${p}</button>`).join("")}
        </div>
        <div id="pageFeedback"></div>
        ${ratingRowHtml()}
      </div>
    `;
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

  function renderSessionComplete() {
    cancelAudio();
    screenEl.innerHTML = `
      <div class="container">
        <div class="complete-screen">
          <div class="complete-emoji">﴾ ﴿</div>
          <h2>Wird complete</h2>
          <p>Alhamdulillāh — you've completed today's portion. Come back tomorrow for what's next due.</p>
          <button class="primary-btn" id="backHomeBtn2" style="max-width:280px;margin:0 auto">Back to Today</button>
        </div>
      </div>
    `;
    document.getElementById("backHomeBtn2").addEventListener("click", renderHome);
  }

  // ---------- nav ----------
  function switchScreen(name) {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.screen === name));
    if (name === "home") renderHome();
    else if (name === "library") renderLibrary();
    else if (name === "mushaf") renderMushaf();
  }

  function renderReciterSelect() {
    const sel = document.getElementById("reciterSelect");
    sel.innerHTML = Object.entries(RECITERS).map(([id, r]) =>
      `<option value="${id}" ${id === currentReciter ? "selected" : ""}>${escapeHtml(r.name)}</option>`
    ).join("");
    sel.addEventListener("change", () => setReciter(sel.value));
  }

  function boot() {
    loadAll();
    topnavEl.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => switchScreen(btn.dataset.screen));
    });
    document.getElementById("brandBtn").addEventListener("click", () => switchScreen("home"));
    renderReciterSelect();
    renderHome();
  }

  boot();
})();
