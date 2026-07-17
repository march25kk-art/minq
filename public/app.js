const TAGS = [
  "ニュース", "政治", "投資", "お金", "仕事", "恋愛", "ゲーム", "食べ物", "生活", "勉強",
  "音楽", "趣味", "自転車・バイク", "美容・コスメ", "科学", "動物", "ペット", "季節",
  "AI", "環境", "法律", "相談", "歴史", "本・読書", "映画", "ドラマ", "アニメ", "漫画", "料理", "心理",
  "日常", "旅行", "教育", "海外", "社会", "悩み", "子育て・育児", "飲食店",
  "医療", "介護", "健康", "ダイエット", "住まい・不動産", "人間関係", "酒", "ファッション",
  "ビジネス", "テクノロジー", "スポーツ", "エンタメ", "アート", "おもちゃ",
  "デザイン", "アダルト", "暇つぶし", "ギャンブル", "ストレス", "その他"
];

const AGE_GROUPS = ["回答しない", "10代", "20代", "30代", "40代", "50代", "60代以上"];
const GENDERS = ["回答しない", "男性", "女性"];
const CHART_COLORS = ["#12a05a", "#4d9de0", "#f2b705", "#ef6f6c", "#8a63d2", "#f28c28", "#15b8a6", "#e85d99"];

const state = {
  page: 1,
  totalPages: 1,
  currentSearch: "",
  currentTag: "",
  currentSort: "update",
  options: ["", ""],
  latestQuestions: [],
  showAllTags: false,
  loadController: null
};

const QUESTION_LIST_REFRESH_KEY = "minq:refresh-question-list";

function markQuestionListForRefresh() {
  try {
    sessionStorage.setItem(QUESTION_LIST_REFRESH_KEY, "1");
  } catch (_) {}
}

function consumeQuestionListRefresh() {
  try {
    if (sessionStorage.getItem(QUESTION_LIST_REFRESH_KEY) !== "1") return false;
    sessionStorage.removeItem(QUESTION_LIST_REFRESH_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

function resetToUpdatedQuestionList() {
  state.page = 1;
  state.currentSort = "update";
  state.currentSearch = "";
  state.currentTag = "";

  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";
  document.querySelectorAll(".sortMenu button").forEach(item => item.classList.remove("active"));
  document.getElementById("sort-update")?.classList.add("active");
  renderTopTags(state.showAllTags);
}

let deferredInstallPrompt = null;

function isAppInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function updateInstallButton() {
  const button = document.getElementById("installAppBtn");
  if (!button) return;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  button.hidden = isAppInstalled() || (!deferredInstallPrompt && !isIOS);
}

async function installApp() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    updateInstallButton();
    return;
  }

  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    alert("Safari下部の共有ボタンを押し、「ホーム画面に追加」を選んでください。");
  }
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButton();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updateInstallButton();
});

const sanitizeNode = document.createElement("div");
const plainNode = document.createElement("div");

function sanitize(value) {
  sanitizeNode.textContent = value == null ? "" : String(value);
  return sanitizeNode.innerHTML;
}

function plain(value) {
  plainNode.innerHTML = value == null ? "" : String(value);
  return plainNode.textContent || plainNode.innerText || "";
}

function optionText(option) {
  return plain(typeof option === "string" ? option : option?.text || "");
}

function createQueryParams(params) {
  return new URLSearchParams(params).toString();
}

window.addEventListener("DOMContentLoaded", () => {
  updateInstallButton();
  setupDiagnosisTabs();
  const questionsDiv = document.getElementById("questions");
  if (questionsDiv) {
    if (consumeQuestionListRefresh()) resetToUpdatedQuestionList();
    renderTopTags(false);
    loadQuestions();
  }

  const optionsDiv = document.getElementById("options");
  if (optionsDiv) {
    renderOptions();
    const tagSelect = document.getElementById("tags");
    if (tagSelect && tagSelect.children.length === 0) {
      tagSelect.appendChild(new Option("カテゴリを選択してください（任意）", ""));
      TAGS.forEach(tag => tagSelect.appendChild(new Option(tag, tag)));
    }
  }
});

window.addEventListener("pageshow", event => {
  if (!event.persisted || !document.getElementById("questions")) return;
  if (!consumeQuestionListRefresh()) return;
  resetToUpdatedQuestionList();
  loadQuestions();
});

function setupDiagnosisTabs() {
  const tabs = [...document.querySelectorAll("[data-diagnosis-tab]")];
  const cards = [...document.querySelectorAll("[data-diagnosis-groups]")];
  if (!tabs.length || !cards.length) return;

  const selectCategory = category => {
    tabs.forEach(tab => {
      const selected = tab.dataset.diagnosisTab === category;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    cards.forEach(card => {
      const groups = card.dataset.diagnosisGroups.split(" ");
      card.hidden = !groups.includes(category);
    });
  };

  tabs.forEach(tab => tab.addEventListener("click", () => selectCategory(tab.dataset.diagnosisTab)));
  selectCategory("recommended");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(error => {
      console.error("Service worker registration failed:", error);
    });
  });
}

function renderTopTags(all = false) {
  const tagArea = document.getElementById("tagArea");
  if (!tagArea) return;

  state.showAllTags = all;
  tagArea.classList.toggle("expanded", all);
  tagArea.innerHTML = "";

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `category${state.currentTag === "" ? " active" : ""}`;
  allButton.textContent = "全体";
  allButton.onclick = clearTag;
  tagArea.appendChild(allButton);

  TAGS.slice(0, 7).forEach(tag => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category${state.currentTag === tag ? " active" : ""}`;
    button.textContent = tag;
    button.onclick = () => searchTag(tag);
    tagArea.appendChild(button);
  });

  const toggleBtn = document.createElement("button");
  toggleBtn.id = "toggleTagsBtn";
  toggleBtn.type = "button";
  toggleBtn.className = "text-btn category-toggle";
  toggleBtn.textContent = all ? "閉じる" : "もっと見る ›";
  toggleBtn.onclick = toggleAllTags;

  if (all) TAGS.slice(7).forEach(tag => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category${state.currentTag === tag ? " active" : ""}`;
    button.textContent = tag;
    button.onclick = () => searchTag(tag);
    tagArea.appendChild(button);
  });

  tagArea.appendChild(toggleBtn);
}

function showAllTags() {
  renderTopTags(true);
}

function toggleAllTags() {
  renderTopTags(!state.showAllTags);
}

async function loadQuestions() {
  const div = document.getElementById("questions");
  if (!div) return;

  if (state.loadController) state.loadController.abort();
  state.loadController = new AbortController();
  const { signal } = state.loadController;
  div.innerHTML = '<div class="loading-state">アンケートを読み込み中...</div>';
  try {
    const res = await fetch(`/questions?${createQueryParams({
      page: String(state.page),
      search: state.currentSearch,
      tag: state.currentTag,
      sort: state.currentSort
    })}`, { signal, cache: "no-store" });
    const data = await res.json();
    if (data.error) throw new Error(data.message || "load failed");

    state.totalPages = data.totalPages || 1;
    state.latestQuestions = data.questions || [];

    if (state.latestQuestions.length === 0) {
      div.innerHTML = '<div class="empty-state">アンケートが見つかりませんでした。</div>';
      renderPopularQuestions([]);
      updatePagerButtons();
      return;
    }

    const fragment = document.createDocumentFragment();
    state.latestQuestions.forEach((q, index) => {
      fragment.appendChild(createQuestionCard(q));
      if (index === 3 && state.latestQuestions.length >= 5) {
        fragment.appendChild(createAdPlacement("homeInFeed", "ad-placement-in-feed"));
      }
    });
    div.replaceChildren(fragment);
    window.mountAdSenseAds?.(div);
    renderPopularQuestions(state.latestQuestions);

    const pageText = document.getElementById("pageText");
    if (pageText) pageText.textContent = `${state.page} / ${state.totalPages} ページ`;
    updatePagerButtons();
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error(err);
    div.innerHTML = '<div class="empty-state">データの読み込みに失敗しました。</div>';
  }
}

function createAdPlacement(name, modifierClass = "") {
  const placement = document.createElement("aside");
  placement.className = `ad-placement ${modifierClass}`.trim();
  placement.dataset.adPlacement = name;
  placement.setAttribute("aria-label", "スポンサー広告");
  return placement;
}

function createQuestionCard(q) {
  const total = Number(q.totalVotes || 0);
  const comments = Number(q.commentCount || (Array.isArray(q.comments) ? q.comments.length : 0));
  const views = Number(q.views || 0);
  const card = document.createElement("a");
  card.className = "thread";
  card.href = `/question?id=${encodeURIComponent(q.id)}`;
  card.innerHTML = `
    <span class="title-text">${sanitize(plain(q.title))}</span>
    <div class="thread-meta-line">
      <span>${compactCount(total)}回答</span>
      <span>${compactCount(comments)}コメント</span>
      <span class="view-date-group">
        <span class="view-count">${compactCount(views)}閲覧</span>
        <time class="postDate">${sanitize(q.updatedAt || q.createdAt || "")}</time>
      </span>
    </div>
  `;
  return card;
}

function compactCount(value) {
  const count = Math.max(0, Number(value) || 0);
  if (count < 1000) return String(Math.floor(count));

  const thousands = Math.floor(count / 100) / 10;
  return `${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1)}K`;
}

function renderPopularQuestions(list) {
  const target = document.getElementById("popularQuestions");
  if (!target) return;

  const ranked = [...list].sort((a, b) => Number(b.views || 0) - Number(a.views || 0)).slice(0, 5);
  target.innerHTML = ranked.length ? "" : '<div class="empty-state" style="padding:20px 0;">まだ質問がありません。</div>';
  const fragment = document.createDocumentFragment();
  ranked.forEach((q, index) => {
    const row = document.createElement("a");
    row.className = "ranking-item";
    row.href = `/question?id=${encodeURIComponent(q.id)}`;
    row.innerHTML = `
      <span class="rank-number">${index + 1}</span>
      <span class="rank-title">${sanitize(plain(q.title))}</span>
      <span class="rank-count">${Number(q.views || 0)}閲覧</span>
    `;
    fragment.appendChild(row);
  });
  target.appendChild(fragment);
}

function changeSort(sort) {
  state.currentSort = sort;
  state.page = 1;
  document.querySelectorAll(".sortMenu button").forEach(item => item.classList.remove("active"));
  const current = document.getElementById(`sort-${sort}`);
  if (current) current.classList.add("active");
  loadQuestions();
}

function openDetail(id) {
  location.href = `/question?id=${encodeURIComponent(id)}`;
}

function searchQuestions() {
  const input = document.getElementById("searchInput");
  state.currentSearch = input ? input.value.trim() : "";
  state.page = 1;
  loadQuestions();
}

function searchTag(tag) {
  state.currentTag = tag;
  state.page = 1;
  renderTopTags(state.showAllTags);
  loadQuestions();
}

function clearTag() {
  state.currentTag = "";
  state.page = 1;
  renderTopTags(state.showAllTags);
  loadQuestions();
}

function nextPage() {
  if (state.page < state.totalPages) {
    state.page += 1;
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    loadQuestions();
  }
}

function prevPage() {
  if (state.page > 1) {
    state.page -= 1;
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    loadQuestions();
  }
}

function updatePagerButtons() {
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  if (prevBtn) prevBtn.disabled = state.page <= 1;
  if (nextBtn) nextBtn.disabled = state.page >= state.totalPages;
}

function renderOptions() {
  const div = document.getElementById("options");
  if (!div) return;

  div.innerHTML = "";
  state.options.forEach((value, index) => {
    const row = document.createElement("div");
    row.className = "optionRow";

    const input = document.createElement("input");
    input.value = value;
    input.maxLength = 200;
    input.placeholder = `選択肢 ${index + 1}`;
    input.addEventListener("input", e => {
      state.options[index] = e.target.value;
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "deleteBtn";
    del.textContent = "削除";
    del.onclick = () => removeOption(index);

    row.append(input, del);
    div.appendChild(row);
  });
}

function addOption() {
  if (state.options.length >= 10) return alert("選択肢は10個までです。");
  state.options.push("");
  renderOptions();
}

function removeOption(index) {
  if (state.options.length <= 2) return alert("選択肢は2つ以上必要です。");
  state.options.splice(index, 1);
  renderOptions();
}

async function postQuestion() {
  const title = document.getElementById("title")?.value.trim() || "";
  const description = document.getElementById("description")?.value.trim() || "";
  const tag = document.getElementById("tags")?.value || "";
  const options = state.options.map(v => v.trim()).filter(Boolean);

  if (!title || options.length < 2) {
    alert("タイトルと2つ以上の選択肢を入力してください。");
    return;
  }

  const res = await fetch("/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, tags: tag ? [tag] : [], options })
  });
  const data = await res.json();
  if (data.error) return alert(data.message || "投稿に失敗しました。");
  location.href = "/";
}

async function loadCombinedQuestion() {
  const div = document.getElementById("questionArea") || document.getElementById("detail");
  if (!div) return;

  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    div.innerHTML = '<div class="detailCard"><p>質問が見つかりません。</p></div>';
    return;
  }

  try {
    fetch("/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    }).catch(() => {});

    const questionRes = await fetch(`/questions/${encodeURIComponent(id)}`, { cache: "no-store" });
    const q = await questionRes.json();
    if (q.error) throw new Error(q.message || "not found");

    const pageTitle = `${plain(q.title)} | みんQ`;
    const pageDescription = plain(q.description || q.title).slice(0, 120);
    const canonicalUrl = `${location.origin}/question?id=${encodeURIComponent(id)}`;
    document.title = pageTitle;
    const metaDescription = document.getElementById("metaDescription");
    const canonical = document.getElementById("canonical");
    const ogTitle = document.getElementById("ogTitle");
    const ogDescription = document.getElementById("ogDescription");
    const ogUrl = document.getElementById("ogUrl");
    if (metaDescription) metaDescription.content = pageDescription;
    if (canonical) canonical.href = canonicalUrl;
    if (ogTitle) ogTitle.content = pageTitle;
    if (ogDescription) ogDescription.content = pageDescription;
    if (ogUrl) ogUrl.content = canonicalUrl;
    if (q.voted) renderResultsScreen(div, q, id);
    else renderVotingScreen(div, q, id);
  } catch (err) {
    console.error(err);
    div.innerHTML = '<div class="detailCard"><p>データの読み込みに失敗しました。</p></div>';
  }
}

function renderVotingScreen(div, q, id) {
  div.innerHTML = `
    <section class="detailCard">
      <h1 class="createTitle">${sanitize(plain(q.title))}</h1>
      ${q.description ? `<p>${sanitize(plain(q.description))}</p>` : ""}
      <div class="optionsArea">
        ${(q.options || []).map((option, index) => `
          <label class="optionCard">
            <input type="radio" name="voteOption" value="${index}">
            <span class="optionText">${sanitize(optionText(option))}</span>
          </label>
        `).join("")}
      </div>
      <div class="voteInfoRow">
        <label><span class="voteLabel">年代</span><select id="age">${AGE_GROUPS.map(age => `<option>${age}</option>`).join("")}</select></label>
        <label><span class="voteLabel">性別</span><select id="gender">${GENDERS.map(g => `<option>${g}</option>`).join("")}</select></label>
      </div>
      <p class="vote-result-note"><span>✓</span>回答すると、みんなの回答結果をすぐに見ることができます。</p>
      <div class="vote-actions">
        <button class="voteSubmitBtn" type="button" onclick="voteAndReload('${sanitize(id)}')">投票する</button>
        <button class="reportBtn" type="button" onclick="reportQuestion('${sanitize(id)}')">通報</button>
      </div>
    </section>
  `;
}

function statPercent(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function renderOptionBars(options, q, total = 0) {
  return options.map((option, index) => {
    const percent = statPercent(q.genderStats?.[index]?.rawPercent);
    const votes = Math.round(total * percent / 100);
    return `
      <div class="stat-row result-option-row">
        <div class="stat-label">
          <strong>${sanitize(optionText(option))}</strong>
          <span class="result-percent">${percent}%</span>
        </div>
        <div class="bar"><div class="fill" style="width:${percent}%;background:${CHART_COLORS[index % CHART_COLORS.length]}"></div></div>
        <div class="result-votes">${votes}票</div>
      </div>
    `;
  }).join("");
}

function renderGenderBreakdown(options, q) {
  const genders = [
    { key: "male", label: "男性" },
    { key: "female", label: "女性" }
  ];

  return genders.map(gender => `
    <div class="breakdown-group gender-${gender.key}">
      <h3><span class="gender-mark">${gender.key === "male" ? "♂" : "♀"}</span>${gender.label}の回答</h3>
      ${options.map((option, index) => {
        const percent = statPercent(q.genderStats?.[index]?.[gender.key]);
        return `
          <div class="stat-row compact">
            <div class="stat-label">
              <strong>${sanitize(optionText(option))}</strong>
              <span>${percent}%</span>
            </div>
            <div class="bar"><div class="fill" style="width:${percent}%;background:${CHART_COLORS[index % CHART_COLORS.length]}"></div></div>
          </div>
        `;
      }).join("")}
    </div>
  `).join("");
}

function renderAgeBreakdown(options, q) {
  const ages = AGE_GROUPS.filter(age => age !== "回答しない");
  return ages.map(age => `
    <div class="breakdown-group">
      <h3>${age}</h3>
      ${options.map((option, index) => {
        const percent = statPercent(q.ageStats?.[index]?.[age]);
        return `
          <div class="stat-row compact">
            <div class="stat-label">
              <strong>${sanitize(optionText(option))}</strong>
              <span>${percent}%</span>
            </div>
            <div class="bar"><div class="fill" style="width:${percent}%;background:${CHART_COLORS[index % CHART_COLORS.length]}"></div></div>
          </div>
        `;
      }).join("")}
    </div>
  `).join("");
}

function renderResultsScreen(div, q, id) {
  const total = Number(q.totalVotes || 0);
  const options = q.options || [];
  const shareUrl = window.location.href;
  const shareText = `「${plain(q.title)}」のアンケート結果をチェック！ #みんQ`;
  const encodedShareUrl = encodeURIComponent(shareUrl);
  const encodedShareText = encodeURIComponent(shareText);
  const topIndex = options.reduce((best, _, index) =>
    statPercent(q.genderStats?.[index]?.rawPercent) > statPercent(q.genderStats?.[best]?.rawPercent) ? index : best, 0);
  const topOption = options[topIndex] ? optionText(options[topIndex]) : "まだ回答がありません";
  const topPercent = options[topIndex] ? statPercent(q.genderStats?.[topIndex]?.rawPercent) : 0;
  div.classList.add("results-dashboard");

  div.innerHTML = `
    <section class="detailCard result-question-card">
      <div class="result-title-row">
        <span class="result-question-icon">Q</span>
        <h1 class="createTitle">${sanitize(plain(q.title))}</h1>
      </div>
      ${q.description ? `<p>${sanitize(plain(q.description))}</p>` : ""}
      <div class="result-meta-share-row">
        <p class="question-meta result-meta"><span>● ${total}回答</span><span>◇ ${Number(q.commentCount || 0)}コメント</span><span>◉ ${Number(q.views || 0)}閲覧</span></p>
        <div class="result-share-panel" data-share-url="${sanitize(shareUrl)}" data-share-text="${sanitize(shareText)}">
          <div class="result-share-actions">
          <a class="result-share-btn share-x" href="https://twitter.com/intent/tweet?url=${encodedShareUrl}&text=${encodedShareText}" target="_blank" rel="noopener noreferrer" aria-label="Xでシェア">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>
          </a>
          <button class="result-share-btn share-instagram" type="button" onclick="shareResultToInstagram(this)" aria-label="Instagram用にコピー">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm10.5 1.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>
          </button>
          <a class="result-share-btn share-line" href="https://social-plugins.line.me/lineit/share?url=${encodedShareUrl}" target="_blank" rel="noopener noreferrer" aria-label="LINEでシェア"><span class="line-logo">LINE</span></a>
          <a class="result-share-btn share-facebook" href="https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Facebookでシェア">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8.5V6.8c0-.8.5-1 1-1h2.8V2.1L14.6 2C11.4 2 10 3.9 10 6.5v2H7v4h3V22h4v-9.5h3.4l.6-4H14Z"/></svg>
          </a>
          <a class="result-share-btn share-threads" href="https://www.threads.net/intent/post?text=${encodedShareText}%20${encodedShareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Threadsでシェア"><span class="threads-mark">@</span></a>
          <button class="result-share-btn share-copy" type="button" onclick="copyResultShare(this)" aria-label="シェアURLをコピー">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-2v3a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3h3Zm2 0h4a3 3 0 0 1 3 3v4h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-8a1 1 0 0 0-1 1v2Zm-5 2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5Z"/></svg><span>コピー</span>
          </button>
          </div>
          <span class="share-feedback" role="status" aria-live="polite"></span>
        </div>
      </div>
    </section>

    <section class="resultGrid-top result-summary-grid">
      <div class="resultCard overall-result-card">
        <div class="result-card-heading">
          <h2>全体の回答結果</h2>
          <span class="result-total">総投票数：${total}票</span>
        </div>
        <div class="overallStats">${renderOptionBars(options, q, total)}</div>
        <div class="result-insight"><span>💡</span><p><strong>みんなの回答</strong><br>「${sanitize(topOption)}」が${topPercent}%で、もっとも多く選ばれています。</p></div>
      </div>
      <div class="resultCard gender-summary-card">
        <h2>男女別の回答</h2>
        <div class="gender-summary-list">${renderGenderBreakdown(options, q)}</div>
      </div>
    </section>

    <aside class="ad-placement ad-placement-result" data-ad-placement="resultInline" aria-label="スポンサー広告"></aside>

    <section class="resultCard result-wide-card">
      <h2>年代別の回答内訳</h2>
      <div class="age-grid result-age-grid">${renderAgeBreakdown(options, q)}</div>
    </section>

    <section class="resultCard result-wide-card comments-card">
      <div class="result-card-heading"><h2>みんなのコメント</h2><span class="result-total">${Number(q.commentCount || 0)}件</span></div>
      <div class="comment-compose">
        <div class="comment-inputs">
          <input id="commentName" type="text" maxlength="30" placeholder="名前（任意）">
          <textarea id="commentText" placeholder="あなたの意見を入力してください"></textarea>
        </div>
        <button class="commentBtn" type="button" onclick="addCommentAndReload('${sanitize(id)}')">投稿する</button>
      </div>
      <div id="commentList" class="result-comment-list">
        ${(q.comments || []).map((comment, index) => `
          <div class="comment">
            <span class="comment-avatar">${index + 1}</span>
            <div><div class="comment-author">${sanitize(plain(comment.name) || "みんQユーザー")} <span>${sanitize(comment.createdAt || "")}</span></div><p>${sanitize(plain(comment.text))}</p></div>
          </div>
        `).join("") || '<p class="empty-comments">まだコメントはありません。最初の意見を投稿してみましょう。</p>'}
      </div>
    </section>

    <section id="questionRecommendations" class="resultCard result-wide-card result-recommendations" hidden>
      <h2>あなたにおすすめのアンケート</h2>
      <div class="recommendation-grid"></div>
    </section>

    <section class="result-answer-cta">
      <div><strong>あなたも質問を作ってみませんか？</strong><p>みんなの考えを知ることで、新しい発見があるかもしれません。</p></div>
      <button class="primary-btn" type="button" onclick="location.href='create.html'">質問を作成する <span>›</span></button>
    </section>
  `;
  window.renderQuestionRecommendations?.("questionRecommendations", q, id);
  window.mountAdSenseAds?.(div);
}

async function writeShareClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function showShareFeedback(button, message) {
  const panel = button.closest(".result-share-panel");
  const feedback = panel?.querySelector(".share-feedback");
  if (!feedback) return;
  feedback.textContent = message;
  clearTimeout(feedback.hideTimer);
  feedback.hideTimer = setTimeout(() => { feedback.textContent = ""; }, 3000);
}

async function copyResultShare(button) {
  const panel = button.closest(".result-share-panel");
  try {
    await writeShareClipboard(`${panel.dataset.shareText}\n${panel.dataset.shareUrl}`);
    showShareFeedback(button, "✓ シェア文とURLをコピーしました");
  } catch {
    showShareFeedback(button, "コピーできませんでした");
  }
}

async function shareResultToInstagram(button) {
  window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  await copyResultShare(button);
}

async function voteAndReload(id) {
  const selected = document.querySelector('input[name="voteOption"]:checked');
  if (!selected) return alert("選択肢を選んでください。");

  const res = await fetch("/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      index: Number(selected.value),
      age: document.getElementById("age")?.value || "回答しない",
      gender: document.getElementById("gender")?.value || "回答しない"
    })
  });
  const data = await res.json();
  if (data.error) return alert(data.message || "投票に失敗しました。");
  markQuestionListForRefresh();
  const q = await (await fetch(`/questions/${encodeURIComponent(id)}`, { cache: "no-store" })).json();
  renderResultsScreen(document.getElementById("questionArea") || document.getElementById("detail"), q, id);
}

async function addCommentAndReload(id) {
  const text = document.getElementById("commentText")?.value.trim() || "";
  const name = document.getElementById("commentName")?.value.trim() || "";
  if (!text) return alert("コメントを入力してください。");

  const button = document.querySelector(".comments-card .commentBtn");
  if (button) {
    button.disabled = true;
    button.textContent = "投稿中...";
  }

  try {
    const res = await fetch(`/questions/${encodeURIComponent(id)}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, name, age: "回答しない", gender: "回答しない" })
    });
    const data = await res.json();
    if (data.error) return alert(data.message || "コメント投稿に失敗しました。");

    appendPostedComment(data.comment || { text, name });
    const textInput = document.getElementById("commentText");
    const nameInput = document.getElementById("commentName");
    if (textInput) textInput.value = "";
    if (nameInput) nameInput.value = "";
  } catch (error) {
    console.error(error);
    alert("コメント投稿に失敗しました。通信状態を確認して再度お試しください。");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "投稿する";
    }
  }
}

function appendPostedComment(comment) {
  const list = document.getElementById("commentList");
  if (!list) return;

  list.querySelector(".empty-comments")?.remove();
  const number = list.querySelectorAll(".comment").length + 1;
  const item = document.createElement("div");
  item.className = "comment";

  const avatar = document.createElement("span");
  avatar.className = "comment-avatar";
  avatar.textContent = String(number);

  const body = document.createElement("div");
  const author = document.createElement("div");
  author.className = "comment-author";
  author.append(document.createTextNode(comment.name || "みんQユーザー"));
  const date = document.createElement("span");
  date.textContent = comment.createdAt || "";
  author.append(" ", date);

  const message = document.createElement("p");
  message.textContent = comment.text || "";
  body.append(author, message);
  item.append(avatar, body);
  list.appendChild(item);

  const countBadge = document.querySelector(".comments-card .result-card-heading .result-total");
  const currentCount = Number.parseInt(countBadge?.textContent || "0", 10) || 0;
  const updatedCount = currentCount + 1;
  if (countBadge) countBadge.textContent = `${updatedCount}件`;
  const metaComment = document.querySelector(".result-meta span:nth-child(2)");
  if (metaComment) metaComment.textContent = `◇ ${updatedCount}コメント`;
}

async function reportQuestion(id) {
  const res = await fetch("/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });
  const data = await res.json();
  alert(data.error ? (data.message || "通報に失敗しました。") : "通報しました。");
}

async function loadAdmin() {
  const div = document.getElementById("adminQuestions");
  const password = document.getElementById("password")?.value || "";
  if (!div) return;
  if (!password) {
    div.innerHTML = "<p>管理パスワードを入力してください。</p>";
    return;
  }

  const data = await (await fetch("/questions")).json();
  div.innerHTML = "";
  (data.questions || []).forEach(q => {
    const item = document.createElement("div");
    item.className = "thread";
    item.innerHTML = `<div class="question-main"><span class="title-text">${sanitize(plain(q.title))}</span></div><button class="deleteBtn" type="button">削除</button>`;
    item.querySelector("button").onclick = () => deleteQuestion(q.id);
    div.appendChild(item);
  });
}

async function deleteQuestion(id) {
  const password = document.getElementById("password")?.value || "";
  const data = await (await fetch("/admin/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, password })
  })).json();
  if (data.error) return alert(data.message || "削除できませんでした。");
  loadAdmin();
}

async function deleteComment(id) {
  const password = document.getElementById("password")?.value || "";
  const data = await (await fetch("/admin/delete-comment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, password })
  })).json();
  if (data.error) return alert(data.message || "削除できませんでした。");
  loadAdmin();
}
