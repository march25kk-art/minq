const TAGS = [
  "ニュース", "政治", "投資", "お金", "仕事", "恋愛", "ゲーム", "食べ物", "生活", "勉強",
  "音楽", "趣味", "自転車・バイク", "美容・コスメ", "科学", "動物", "ペット", "季節",
  "AI", "環境", "法律", "相談", "歴史", "本・読書", "映画", "ドラマ", "アニメ", "料理", "心理",
  "日常", "旅行", "教育", "海外", "社会", "悩み", "子育て・育児", "飲食店",
  "医療", "健康", "ダイエット", "住まい・不動産", "人間関係", "酒", "ファッション",
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
  const questionsDiv = document.getElementById("questions");
  if (questionsDiv) {
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

  (all ? TAGS : TAGS.slice(0, 7)).forEach(tag => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category${state.currentTag === tag ? " active" : ""}`;
    button.textContent = tag;
    button.onclick = () => searchTag(tag);
    tagArea.appendChild(button);
  });

  if (state.currentTag) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "category";
    clear.textContent = "絞り込み解除";
    clear.onclick = clearTag;
    tagArea.appendChild(clear);
  }

  const toggleBtn = document.getElementById("toggleTagsBtn");
  if (toggleBtn) toggleBtn.textContent = all ? "閉じる" : "もっと見る ›";
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
    })}`, { signal });
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
    state.latestQuestions.forEach(q => fragment.appendChild(createQuestionCard(q)));
    div.replaceChildren(fragment);
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

function createQuestionCard(q) {
  const total = Number(q.totalVotes || 0);
  const comments = Number(q.commentCount || (Array.isArray(q.comments) ? q.comments.length : 0));
  const views = Number(q.views || 0);
  const card = document.createElement("article");
  card.className = "thread";
  card.onclick = () => openDetail(q.id);
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
    const row = document.createElement("button");
    row.type = "button";
    row.className = "ranking-item";
    row.onclick = () => openDetail(q.id);
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

    const [checkRes, questionRes] = await Promise.all([
      fetch(`/check-vote/${encodeURIComponent(id)}`),
      fetch(`/questions/${encodeURIComponent(id)}`)
    ]);
    const check = await checkRes.json();
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
    if (check.voted) renderResultsScreen(div, q, id);
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
      <p class="question-meta result-meta"><span>● ${total}回答</span><span>◇ ${Number(q.commentCount || 0)}コメント</span><span>◉ ${Number(q.views || 0)}閲覧</span></p>
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

    <section class="result-answer-cta">
      <div><strong>あなたも質問を作ってみませんか？</strong><p>みんなの考えを知ることで、新しい発見があるかもしれません。</p></div>
      <button class="primary-btn" type="button" onclick="location.href='create.html'">質問を作成する <span>›</span></button>
    </section>
  `;
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
  const q = await (await fetch(`/questions/${encodeURIComponent(id)}`)).json();
  renderResultsScreen(document.getElementById("questionArea") || document.getElementById("detail"), q, id);
}

async function addCommentAndReload(id) {
  const text = document.getElementById("commentText")?.value.trim() || "";
  const name = document.getElementById("commentName")?.value.trim() || "";
  if (!text) return alert("コメントを入力してください。");

  const res = await fetch(`/questions/${encodeURIComponent(id)}/comment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, name, age: "回答しない", gender: "回答しない" })
  });
  const data = await res.json();
  if (data.error) return alert(data.message || "コメント投稿に失敗しました。");
  location.reload();
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
