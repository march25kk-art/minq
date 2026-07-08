// ==========================================
// 1. 定数・グローバル変数の定義
// ==========================================
const TAGS = [
  "ニュース", "政治", "投資", "お金", "仕事", "恋愛", "ゲーム", "食べ物", "生活", "勉強",
  "音楽", "趣味", "自転車・バイク", "美容・コスメ", "科学", "動物", "ペット", "季節",
  "AI", "環境", "法律", "相談", "歴史", "本・読書", "映画", "ドラマ", "料理", "心理",
  "日常", "旅行", "教育", "海外", "社会", "悩み", "子育て・育児", "飲食店",
  "医療", "健康", "住まい・不動産", "人間関係", "酒", "ファッション",
  "ビジネス", "テクノロジー", "スポーツ", "エンタメ", "アート", "おもちゃ",
  "デザイン", "アダルト", "暇つぶし", "ギャンブル", "ストレス", "その他"
];

const TOP_CATEGORIES = ["ニュース", "政治", "投資", "恋愛", "仕事", "ゲーム", "食べ物"];
const AGE_GROUPS = ["回答しない", "10代", "20代", "30代", "40代", "50代", "60代", "70代以上"];
const GENDERS = ["回答しない", "男性", "女性"];
const CHART_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f97316", "#a855f7", "#06b6d4", "#ec4899", "#84cc16", "#d946ef", "#14b8a6"];
const AGE_COLORS = ["#3b82f6", "#10b981", "#f97316", "#fbbf24", "#f43f5e", "#a855f7", "#ec4899"];

// 状態管理オブジェクト
const state = {
  page: 1,
  totalPages: 1,
  currentSearch: "",
  currentTag: "",
  currentSort: "update",
  options: ["", ""]
};

// キャッシュ
const cache = {
  questions: null,
  questionDetail: {}
};

// ==========================================
// 2. ユーティリティ関数
// ==========================================
function sanitize(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getOptimalHotTag(total, commentCount, createdAtStr) {
  if (createdAtStr) {
    const formattedStr = createdAtStr.replace(/-/g, "/");
    const postDate = new Date(formattedStr);
    const now = new Date();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    if (now.getTime() - postDate.getTime() > threeDaysMs) {
      return ""; 
    }
  }
  return "NEW";
}

function createQueryParams(params) {
  return new URLSearchParams(params).toString();
}

// ==========================================
// 3. 起動時の初期化
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
  const questionsDiv = document.getElementById("questions");
  if (questionsDiv) loadQuestions();

  const optionsDiv = document.getElementById("options");
  if (optionsDiv) {
    renderOptions();
    const tagSelect = document.getElementById("tags");
    if (tagSelect) {
      const fragment = document.createDocumentFragment();
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "カテゴリを選択してください（任意）";
      fragment.appendChild(defaultOption);
      TAGS.forEach(tag => {
        const option = document.createElement("option");
        option.value = tag;
        option.textContent = tag;
        fragment.appendChild(option);
      });
      tagSelect.appendChild(fragment);
    }
  }

  const adminDiv = document.getElementById("adminQuestions");
  if (adminDiv) loadAdmin();

  document.querySelectorAll("#topBtn, .topBtn").forEach(btn => {
    btn.addEventListener("click", () => { location.href = "/"; });
  });
});

// ==========================================
// 4. 質問投稿画面の制御
// ==========================================
function renderOptions() {
  const div = document.getElementById("options");
  if (!div) return;

  const fragment = document.createDocumentFragment();
  state.options.forEach((optionValue, index) => {
    const optionRow = document.createElement("div");
    optionRow.className = "optionRow";
    
    const input = document.createElement("input");
    input.value = sanitize(optionValue);
    input.placeholder = `選択肢 ${index + 1}`;
    input.addEventListener("input", (e) => { state.options[index] = e.target.value; });
    
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "deleteBtn";
    deleteBtn.type = "button";
    deleteBtn.textContent = "削除";
    deleteBtn.addEventListener("click", () => removeOption(index));
    
    optionRow.appendChild(input);
    optionRow.appendChild(deleteBtn);
    fragment.appendChild(optionRow);
  });
  
  div.innerHTML = "";
  div.appendChild(fragment);
}

function addOption() {
  if (state.options.length >= 10) return alert("選択肢は10個までです");
  state.options.push("");
  renderOptions();
}

function removeOption(index) {
  if (state.options.length <= 2) return alert("選択肢は2つ以上必要です");
  state.options.splice(index, 1);
  renderOptions();
}

async function postQuestion() {
  const titleEl = document.getElementById("title");
  const descriptionEl = document.getElementById("description");
  const tagsEl = document.getElementById("tags");

  const res = await fetch("/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: titleEl ? titleEl.value : "",
      description: descriptionEl ? descriptionEl.value : "",
      tags: tagsEl && tagsEl.value ? [tagsEl.value] : [],
      options: state.options
    })
  });

  const data = await res.json();
  if (data.error) return alert(data.message);

  alert("投稿しました");
  location.href = "/";
}

// ==========================================
// 5. トップページ（一覧画面）の制御
// ==========================================
async function loadQuestions() {
  const div = document.getElementById("questions");
  if (!div) return;

  div.innerHTML = `
  <div style="text-align: center; padding: 150px 40px; color: #666; font-size: 14px; min-height: 1200px; box-sizing: border-box;">
    アンケートを読み込み中...
  </div>
`;
  const params = {
    page: String(state.page),
    search: state.currentSearch,
    tag: state.currentTag,
    sort: state.currentSort
  };

  try {
    const res = await fetch(`/questions?${createQueryParams(params)}`);
    const data = await res.json();

    state.totalPages = data.totalPages || 1;
    const questionsList = data.questions || [];
    cache.questions = questionsList;

    if (questionsList.length === 0) {
      div.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">アンケートが見つかりませんでした。</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    
    questionsList.forEach(q => {
      const total = q.totalVotes || 0;
      const commentCount = (typeof q.commentCount === 'number' && q.commentCount >= 0) ? q.commentCount : 
                            (q.comments && Array.isArray(q.comments)) ? q.comments.length : 0;
      const viewsCount = q.views || 0;

      const hotTag = getOptimalHotTag(total, commentCount, q.createdAt);

      const thread = document.createElement("div");
      thread.className = "thread";
      thread.onclick = () => openDetail(q.id);
      
      thread.innerHTML = `
        <div class="threadRow custom-row">
          <div class="leftTitle custom-title">
            <span class="hotTag" style="${hotTag ? '' : 'background: transparent !important; color: transparent !important; border: none !important;'} display: inline-block; width: 32px; text-align: center; flex-shrink: 0; padding: 2px 0;">${hotTag || 'NEW'}</span>
            <span class="title-text">${sanitize(q.title)}</span>
          </div>
          <div class="rightMeta custom-meta">
            <span class="meta-item item-vote">${total}回答</span>
            <span class="meta-item item-comment">${commentCount}コメント</span>
            <span class="meta-item item-view">${viewsCount}閲覧</span>
            <span class="postDate">${q.updatedAt || q.createdAt || ""}</span>
          </div>
        </div>
      `;
      fragment.appendChild(thread);
    });
    
    div.innerHTML = "";
    div.appendChild(fragment);

    renderTopTags();

    const pageText = document.getElementById("pageText");
    if (pageText) pageText.innerText = `${state.page} / ${state.totalPages} ページ`;
    updatePagerButtons();
  } catch (err) {
    console.error("読み込みエラー:", err);
    div.innerHTML = '<div style="text-align:center; padding:40px; color:#ff4d4d;">データの読み込みに失敗しました。</div>';
  }
}

function renderTopTags() {
  const tagArea = document.getElementById("tagArea");
  if (!tagArea) return;

  const fragment = document.createDocumentFragment();
  
  TOP_CATEGORIES.forEach(tag => {
    const span = document.createElement("span");
    span.className = "category";
    span.textContent = tag;
    span.onclick = () => searchTag(tag);
    fragment.appendChild(span);
  });

  const moreBtn = document.createElement("button");
  moreBtn.className = "moreBtn";
  moreBtn.type = "button";
  moreBtn.textContent = "もっと表示";
  moreBtn.onclick = () => showAllTags();
  fragment.appendChild(moreBtn);

  if (state.currentTag) {
    const closeBtn = document.createElement("button");
    closeBtn.className = "closeBtn";
    closeBtn.type = "button";
    closeBtn.textContent = "絞り込み解除";
    closeBtn.onclick = () => clearTag();
    fragment.appendChild(closeBtn);
  }

  tagArea.innerHTML = "";
  tagArea.appendChild(fragment);
}

function changeSort(sort) {
  state.currentSort = sort;

  document.querySelectorAll(".sortMenu span").forEach(item => item.classList.remove("active"));
  const sortTab = document.getElementById(`sort-${sort}`);
  if (sortTab) sortTab.classList.add("active");
  
  state.page = 1;
  loadQuestions();
}

function openDetail(id) { location.href = `/question?id=${id}`; }
function searchQuestions() {
  const searchInput = document.getElementById("searchInput");
  state.currentSearch = searchInput ? searchInput.value : "";
  state.page = 1;
  loadQuestions();
}

async function searchTag(tag) {
  state.currentTag = tag;
  state.page = 1;
  
  const url = new URL(window.location.href);
  url.searchParams.set("tag", tag);
  url.searchParams.set("page", "1");
  window.history.pushState({}, "", url);
  
  await loadQuestions();
}

async function clearTag() {
  state.currentTag = "";
  state.page = 1;
  
  const url = new URL(window.location.href);
  url.searchParams.delete("tag");
  url.searchParams.set("page", "1");
  window.history.pushState({}, "", url);
  
  await loadQuestions();
}
function nextPage() { if (state.page < state.totalPages) { state.page++; loadQuestions(); } }
function prevPage() { if (state.page > 1) { state.page--; loadQuestions(); } }

function updatePagerButtons() {
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  if (prevBtn) prevBtn.disabled = state.page === 1;
  if (nextBtn) nextBtn.disabled = state.page >= state.totalPages;
}

// ==========================================
// 6. 詳細・結果 統合画面の制御 (💡 修正：画面遷移が絶対にバグらない安全設計に強化)
// ==========================================
async function loadCombinedQuestion() {
  const div = document.getElementById("questionArea");
  if (!div) return;

  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    div.innerHTML = `<div class="detailCard"><p>不正なURLです</p></div>`;
    return;
  }

  try {
    try {
      await fetch("/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
    } catch (e) {
      console.warn("View counter tracking failed, skipping...", e);
    }

    const [checkRes, questionRes] = await Promise.all([
      fetch(`/check-vote/${id}`),
      fetch(`/questions/${id}`)
    ]);

    const checkData = await checkRes.json();
    const q = await questionRes.json();

    // ===== SEO・タイトル更新 =====
    document.title = `${q.title} | みんQ`;

    const metaDesc = document.getElementById("metaDescription");
    if (metaDesc) {
      metaDesc.setAttribute(
       "content",
       q.description || `${q.title}のアンケートです。みんなの投票結果を見てみよう！`
      );
    }

    const canonical = document.getElementById("canonical");
    if (canonical) {
      canonical.href = `${location.origin}/question?id=${id}`;
    }

    const ogTitle = document.getElementById("ogTitle");
    if (ogTitle) {
      ogTitle.setAttribute("content", q.title);
    }

    const ogDesc = document.getElementById("ogDescription");
    if (ogDesc) {
      ogDesc.setAttribute(
        "content",
        q.description || `${q.title}のアンケート`
      );
    }

    const ogUrl = document.getElementById("ogUrl");
    if (ogUrl) {
      ogUrl.setAttribute("content", `${location.origin}/question?id=${id}`);
    }

    if (q.error) {
      div.innerHTML = `<div class="detailCard"><p>${sanitize(q.message)}</p></div>`;
      return;
    }

    cache.questionDetail[id] = q;

    if (checkData && checkData.voted === true) {
      renderResultsScreen(div, q, id);
    } else {
      renderVotingScreen(div, q, id);
    }

  } catch (err) {
    console.error("Error loading question:", err);
    div.innerHTML = `<div class="detailCard"><p>データの読み込みに失敗しました</p></div>`;
  }
}

function renderVotingScreen(div, q, id) {
  const fragment = document.createDocumentFragment();
  const container = document.createElement("div");
  container.className = "detailCard";
  container.style.cssText = "max-width: 640px; margin: 40px auto 0 auto; padding: 24px; position: relative;";

  const title = document.createElement("h1");
  title.style.cssText = "font-size: 24px; font-weight: bold; color: #333; margin: 0 0 16px 0; text-align: left;";
  title.textContent = sanitize(q.title);
  container.appendChild(title);

  if (q.description) {
    const desc = document.createElement("p");
    desc.style.cssText = "font-size: 14px; color: #666; margin-bottom: 16px; line-height: 1.5; text-align: left;";
    desc.textContent = sanitize(q.description);
    container.appendChild(desc);
  }

  const optionsArea = document.createElement("div");
  optionsArea.className = "optionsArea";
  optionsArea.style.marginBottom = "24px";
  
  const optionsFragment = document.createDocumentFragment();
  q.options.forEach((option, index) => {
    const optionText = typeof option === "string" ? option : (option.text || "");
    const label = document.createElement("label");
    label.className = "optionCard";
    label.style.cssText = "display: flex; align-items: center; background: #fff; padding: 10px 20px; border-radius: 12px; margin-bottom: 10px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: background 0.2s;";
    
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "voteOption";
    input.value = String(index);
    input.style.cssText = "margin-right: 14px; width: 18px; height: 18px; cursor: pointer;";
    label.appendChild(input);
    
    const span = document.createElement("span");
    span.className = "optionText";
    span.style.cssText = "font-size: 16px; color: #333; font-weight: bold;";
    span.textContent = sanitize(optionText);
    label.appendChild(span);
    
    optionsFragment.appendChild(label);
  });
  optionsArea.appendChild(optionsFragment);
  container.appendChild(optionsArea);

  const voteInfo = document.createElement("div");
  voteInfo.className = "voteInfoRow";
  voteInfo.style.cssText = "display: flex; gap: 16px; background: #f8fafc; padding: 10px 20px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #edf2f7; align-items: center;";
  voteInfo.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
      <span class="voteLabel" style="font-size: 14px; color: #4a5568; font-weight: bold; white-space: nowrap;">年代</span>
      <select id="age" style="flex: 1; padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: #fff; color: #333; cursor: pointer;">
        ${AGE_GROUPS.map(age => `<option>${age}</option>`).join("")}
      </select>
    </div>
    <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
      <span class="voteLabel" style="font-size: 14px; color: #4a5568; font-weight: bold; white-space: nowrap;">性別</span>
      <select id="gender" style="flex: 1; padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: #fff; color: #333; cursor: pointer;">
        ${GENDERS.map(gender => `<option>${gender}</option>`).join("")}
      </select>
    </div>
  `;
  container.appendChild(voteInfo);

  const voteArea = document.createElement("div");
  voteArea.className = "voteArea";
  voteArea.style.cssText = "text-align: center; margin-bottom: 20px;";
  
  const voteBtn = document.createElement("button");
  voteBtn.className = "voteSubmitBtn";
  voteBtn.type = "button";
  voteBtn.style.cssText = "background: #2563eb; color: #fff; font-size: 16px; font-weight: bold; padding: 8px 0; border: none; border-radius: 12px; cursor: pointer; width: 210px;";
  voteBtn.textContent = "投票する";
  voteBtn.onclick = () => voteAndReload(q.id);
  voteArea.appendChild(voteBtn);
  container.appendChild(voteArea);

  const reportArea = document.createElement("div");
  reportArea.style.cssText = "position: absolute; right: 24px; bottom: 0;";
  const reportBtn = document.createElement("button");
  reportBtn.type = "button";
  reportBtn.style.cssText = "background: #ef4444; color: #fff; font-size: 12px; font-weight: bold; padding: 5px 14px; border: none; border-radius: 5px; cursor: pointer;";
  reportBtn.textContent = "通報";
  reportBtn.onclick = () => reportQuestion(q.id);
  reportArea.appendChild(reportBtn);
  container.appendChild(reportArea);

  fragment.appendChild(container);
  div.innerHTML = "";
  div.appendChild(fragment);
}

function renderResultsScreen(div, q, id) {
  const colors = CHART_COLORS;
  let conicParts = [];
  let cumulativePercent = 0;

  q.options.forEach((option, index) => {
    const stat = q.genderStats[index] || {};
    let percent = stat.rawPercent !== undefined ? stat.rawPercent : ((stat.male + stat.female) || 0);
    if (percent > 100) percent = 100;

    const start = cumulativePercent;
    cumulativePercent += percent;
    if (index === q.options.length - 1 || cumulativePercent > 100) cumulativePercent = 100;

    conicParts.push(`${colors[index % colors.length]} ${start}% ${cumulativePercent}%`);
  });
  if (cumulativePercent < 100) conicParts.push(`#e2e8f0 ${cumulativePercent}% 100%`);

  const shareUrl = encodeURIComponent(window.location.href);
  const shareText = encodeURIComponent(`「${q.title}」のアンケート結果をチェック！ #みんQ`);

  let html = `
    <div class="resultDashboard">
      <div class="title-share-container-final" style="display: flex !important; justify-content: space-between !important; align-items: flex-start !important; gap: 12px !important; width: 100% !important; box-sizing: border-box !important; padding: 10px 4px !important; flex-direction: row !important;">
        
        <div class="title-area" style="flex: 1 !important; text-align: left !important; min-width: 0 !important;">
          <div class="resultQuestionTitle" style="font-size: 24px; font-weight: bold; color: #212529; margin: 0 0 4px 0; line-height: 1.4; word-break: break-word;">${sanitize(q.title)}</div>
          ${q.description ? `<p style="font-size: 14px; color: #666; margin: 8px 0 0 0; line-height: 1.5; word-break: break-word;">${sanitize(q.description)}</p>` : ''}
        </div>
        
        <div class="share-buttons-wrap-final" style="display: flex !important; flex-direction: row !important; flex-wrap: nowrap !important; align-items: center !important; gap: 4px !important; background: #ffffff !important; padding: 4px 6px !important; border-radius: 6px !important; box-shadow: 0 2px 6px rgba(0,0,0,0.06) !important; flex-shrink: 0 !important; margin-left: auto !important; width: auto !important;">
          <a href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}" target="_blank" rel="noopener noreferrer" style="background: #000000; color: #fff; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 4px; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
          <a href="https://social-plugins.line.me/lineit/share?url=${shareUrl}" target="_blank" rel="noopener noreferrer" style="background: #06C755; color: #fff; text-decoration: none; font-size: 8px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 4px;">LINE</a>
          <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener noreferrer" style="background: #1877F2; color: #fff; text-decoration: none; font-size: 11px; font-weight: bold; font-family: sans-serif; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 4px;">f</a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" style="background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); color: #fff; text-decoration: none; font-size: 8px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 4px;">Insta</a>
          <a href="https://www.threads.net/intent/post?url=${shareUrl}&text=${shareText}" target="_blank" rel="noopener noreferrer" style="background: #000000; color: #fff; text-decoration: none; font-size: 9px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 4px; border: 1px solid #333;">Th</a>
          <button onclick="copyUrlToClipboard()" style="background: #ffffff; color: #333; border: 1px solid #dee2e6; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 4px; cursor: pointer; padding: 0; margin: 0;">📋</button>
        </div>
      </div>

      <div class="resultHeader" style="margin-top: 10px;">
        <h1 style="font-size: 13px; color: #666; font-weight: bold; text-align: left; margin: 0;">回答結果</h1>
      </div>

      <div class="resultGrid-top">
        <div class="resultCard">
          <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #111;">全体の回答</h2>
          <div class="overallWrap">
            <div class="pieChart" style="background: conic-gradient(${conicParts.join(", ")});"></div>
            <div class="overallStats" style="width:100%; display: flex; flex-direction: column; gap: 10px;">
  `;

  // 💡 【全体グラフ】 隙間詰め可変レイアウト
  q.options.forEach((option, index) => {
    const stat = q.genderStats[index] || {};
    const percent = stat.rawPercent !== undefined ? stat.rawPercent : ((stat.male + stat.female) || 0);
    const color = colors[index % colors.length];
    const optionText = typeof option === "string" ? option : (option.text || "");

    html += `
      <div class="graph-row-set" style="display: flex !important; align-items: center !important; width: 100% !important; gap: 10px !important; text-align: left !important; margin-bottom: 6px !important;">
        <span style="font-size: 13px; color: #333; font-weight: 500; word-break: break-word; line-height: 1.2; max-width: 250px !important; min-width: 50px !important; flex-shrink: 0 !important; display: inline-block !important;">${sanitize(optionText)}</span>
        <div class="bar" style="flex: 1 !important; height: 14px !important; background-color: #e2e8f0 !important; border-radius: 8px !important; overflow: hidden !important; position: relative !important; margin: 0 !important;">
          <div class="fill" style="width: ${percent}% !important; background-color: ${color} !important; height: 100% !important; border-radius: 8px !important; transition: width 0.3s ease;"></div>
        </div>
        <strong style="width: 42px !important; font-size: 13px; color: #1e293b; font-weight: bold; text-align: right; flex-shrink: 0 !important; display: inline-block !important;">${percent}%</strong>
      </div>
    `;
  });

  html += `
            </div>
          </div>
        </div>
        <div class="resultCard">
          <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #111;">性別ごとの割合</h2>
          <div id="genderStats"></div>
        </div>
      </div>

      <div class="resultCard margin-top-20">
        <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #111;">年代ごとの割合</h2>
        <div id="ageStats"></div>
      </div>

      <div class="resultCard margin-top-20 commentSection">
        <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #111;">コメント一覧</h2>
        <textarea id="commentText" placeholder="意見を入力..." style="width:100%; height:70px; padding:10px; border-radius:8px; font-size:13px; border:1px solid #ccc; box-sizing:border-box; resize:none; margin-top:10px;"></textarea>
        <div style="text-align:center;">
          <button onclick="addCommentAndReload('${q.id}')" style="width:150px; height:42px; display:block; margin:12px auto; border:none; border-radius:8px; background:#2563eb; color:white; font-size:14px; font-weight:bold; cursor:pointer;" type="button">コメント投稿</button>
        </div>
        <div id="commentList">
          ${q.comments ? q.comments.map((comment, index) => {
            let profileText = "";
            const g = comment.gender;
            const a = comment.age;
            const hasValidGender = g && g !== "回答しない" && g !== "未回答";
            const hasValidAge = a && a !== "回答しない" && a !== "未回答";

            if (hasValidGender || hasValidAge) {
              profileText = ` (${sanitize(g || "未回答")} / ${sanitize(a || "未回答")})`;
            }
            return `
            <div class="comment">
              <div style="font-size:11px; color:#777; margin-bottom:4px;">No.${index + 1} 匿名ユーザー${profileText} ：${comment.createdAt}</div>
              <div style="font-size:13px; color:#333; line-height:1.4;">${sanitize(comment.text)}</div>
            </div>
            `;
          }).join("") : ""}
        </div>
      </div>
    </div>
  `;

  div.innerHTML = html;
  renderGenderStats(q);
  renderAgeStats(q);
}

window.copyUrlToClipboard = function() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    alert("URLをコピーしました！");
  }).catch(err => {
    console.error("コピー失敗: ", err);
  });
};

async function voteAndReload(id) {
  const selected = document.querySelector('input[name="voteOption"]:checked');
  if (!selected) return alert("選択肢を選んでください");

  const ageEl = document.getElementById("age");
  const genderEl = document.getElementById("gender");
  
  const voteBtn = document.querySelector(".voteSubmitBtn");
  if (voteBtn) voteBtn.disabled = true;

  try {
    const res = await fetch("/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        index: Number(selected.value),
        age: ageEl ? ageEl.value : "回答しない",
        gender: genderEl ? genderEl.value : "回答しない"
      })
    });

    const data = await res.json();
    
    if (data.error) {
      alert(data.message || "投票に失敗しました");
      const freshRes = await fetch(`/questions/${id}`);
      const freshQ = await freshRes.json();
      const div = document.getElementById("questionArea");
      if (div && !freshQ.error) {
        renderResultsScreen(div, freshQ, id);
      }
      return;
    }

    const freshRes = await fetch(`/questions/${id}`);
    const freshQ = await freshRes.json();
    const div = document.getElementById("questionArea");
    
    if (div && !freshQ.error) {
      renderResultsScreen(div, freshQ, id);
    } else {
      location.reload();
    }

  } catch (e) {
    console.error("投票通信エラー:", e);
    alert("通信に失敗しました。もう一度お試しください。");
    if (voteBtn) voteBtn.disabled = false;
  }
}

async function addCommentAndReload(id) {
  const commentTextEl = document.getElementById("commentText");
  const text = commentTextEl ? commentTextEl.value.trim() : "";
  if (!text) return alert("コメントを入力してください");

  const res = await fetch(`/questions/${id}/comment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, age: "回答しない", gender: "回答しない" })
  });

  const data = await res.json();
  if (data.error) return alert(data.message);
  location.reload();
}

async function reportQuestion(id) {
  const res = await fetch("/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });
  const data = await res.json();
  alert(data.error ? data.message : "通報しました");
}

// 💡 【性別グラフ】 隙間詰め可変レイアウト
function renderGenderStats(q) {
  const genderDiv = document.getElementById("genderStats");
  if (!genderDiv || !q.genderStats) return;
  
  const colors = CHART_COLORS;
  const container = document.createElement("div");
  container.className = "axis-flipped-container";
  container.style.cssText = "width: 100% !important; display: block !important;";

  const genders = [{ key: "male", label: "男性" }, { key: "female", label: "女性" }];

  genders.forEach((genderObj) => {
    let genderTotalRaw = 0;
    q.options.forEach((_, index) => {
      const data = q.genderStats[index] || { male: 0, female: 0 };
      genderTotalRaw += (data[genderObj.key] || 0);
    });

    const group = document.createElement("div");
    group.className = "flipped-option-group";
    group.style.cssText = "display: block !important; width: 100% !important; margin-bottom: 24px !important; background: #f8fafc; padding: 12px 16px; border-radius: 12px; border: 1px solid #edf2f7; box-sizing: border-box;";

    const label = document.createElement("div");
    label.style.cssText = "font-weight: bold; font-size: 15px; color: #1e293b; margin-bottom: 12px !important; text-align: left !important;";
    label.textContent = genderObj.label;
    group.appendChild(label);

    const stack = document.createElement("div");
    stack.style.cssText = "width: 100% !important; display: flex !important; flex-direction: column !important; gap: 10px !important;";

    q.options.forEach((option, index) => {
      const data = q.genderStats[index] || { male: 0, female: 0 };
      const rawVal = data[genderObj.key] || 0;
      const percent = genderTotalRaw > 0 ? Math.round((rawVal * 100) / genderTotalRaw) : 0;
      const color = colors[index % colors.length];
      const optionText = typeof option === "string" ? option : (option.text || "");
      
      const row = document.createElement("div");
      row.style.cssText = "display: flex !important; align-items: center !important; width: 100% !important; gap: 10px !important; text-align: left !important;";
      
      row.innerHTML = `
        <div style="font-size: 13px; color: #475569; font-weight: 500; word-break: break-word; line-height: 1.2; max-width: 250px !important; min-width: 50px !important; flex-shrink: 0 !important; display: inline-block !important;">${sanitize(optionText)}</div>
        <div class="bar-single-wrap" style="flex: 1 !important; height: 14px !important; background: #e2e8f0 !important; border-radius: 8px !important; overflow: hidden !important; position: relative !important;">
          <div class="bar-single-fill" style="width: ${percent}% !important; height: 100% !important; background-color: ${color} !important; border-radius: 8px !important;"></div>
        </div>
        <span style="width: 42px !important; font-size: 12px !important; font-weight: bold !important; color: #1e293b !important; text-align: right !important; flex-shrink: 0 !important; display: inline-block !important;">${percent}%</span>
      `;
      stack.appendChild(row);
    });

    group.appendChild(stack);
    container.appendChild(group);
  });

  genderDiv.innerHTML = "";
  genderDiv.appendChild(container);
}

// 💡 【年代グラフ】 隙間詰め可変レイアウト
function renderAgeStats(q) {
  const ageDiv = document.getElementById("ageStats");
  if (!ageDiv || !q.ageStats) return;
  
  const colors = CHART_COLORS;
  const ages = AGE_GROUPS.filter(age => age !== "回答しない");
  
  const container = document.createElement("div");
  container.className = "axis-flipped-container";
  container.style.cssText = "width: 100% !important; display: block !important;";

  ages.forEach((age) => {
    let ageTotalRaw = 0;
    q.options.forEach((_, optionIndex) => {
      const optionAgeData = q.ageStats[optionIndex] || {};
      ageTotalRaw += (optionAgeData[age] || 0);
    });

    const group = document.createElement("div");
    group.className = "flipped-option-group";
    group.style.cssText = "display: block !important; width: 100% !important; margin-bottom: 24px !important; background: #f8fafc; padding: 12px 16px; border-radius: 12px; border: 1px solid #edf2f7; box-sizing: border-box;";

    const label = document.createElement("div");
    label.style.cssText = "font-weight: bold; font-size: 15px; color: #1e293b; margin-bottom: 12px !important; text-align: left !important;";
    label.textContent = age;
    group.appendChild(label);

    const stack = document.createElement("div");
    stack.style.cssText = "width: 100% !important; display: flex !important; flex-direction: column !important; gap: 10px !important;";

    q.options.forEach((option, optionIndex) => {
      const optionAgeData = q.ageStats[optionIndex] || {};
      const rawVal = optionAgeData[age] || 0;
      const percent = ageTotalRaw > 0 ? Math.round((rawVal * 100) / ageTotalRaw) : 0;
      const color = colors[optionIndex % colors.length];
      const optionText = typeof option === "string" ? option : (option.text || "");
      
      const row = document.createElement("div");
      row.style.cssText = "display: flex !important; align-items: center !important; width: 100% !important; gap: 10px !important; text-align: left !important;";
      
      row.innerHTML = `
        <div style="font-size: 13px; color: #475569; font-weight: 500; word-break: break-word; line-height: 1.2; max-width: 250px !important; min-width: 50px !important; flex-shrink: 0 !important; display: inline-block !important;">${sanitize(optionText)}</div>
        <div class="bar-single-wrap" style="flex: 1 !important; height: 14px !important; background: #e2e8f0 !important; border-radius: 8px !important; overflow: hidden !important; position: relative !important;">
          <div class="bar-single-fill" style="width: ${percent}%; height: 100%; background-color: ${color}; border-radius: 8px;"></div>
        </div>
        <span style="width: 42px !important; font-size: 12px !important; font-weight: bold !important; color: #1e293b !important; text-align: right !important; flex-shrink: 0 !important; display: inline-block !important;">${percent}%</span>
      `;
      stack.appendChild(row);
    });

    group.appendChild(stack);
    container.appendChild(group);
  });

  ageDiv.innerHTML = "";
  ageDiv.appendChild(container);
}

function showAllTags() {
  const tagArea = document.getElementById("tagArea");
  if (!tagArea) return;
  
  const fragment = document.createDocumentFragment();
  
  TAGS.forEach(tag => {
    const span = document.createElement("span");
    span.className = "category";
    span.textContent = tag;
    span.onclick = () => searchTag(tag);
    fragment.appendChild(span);
  });

  const closeBtn = document.createElement("button");
  closeBtn.className = "closeBtn";
  closeBtn.type = "button";
  closeBtn.textContent = "閉じる";
  closeBtn.onclick = () => loadQuestions();
  fragment.appendChild(closeBtn);

  tagArea.innerHTML = "";
  tagArea.appendChild(fragment);
}

// ==========================================
// 7. 管理画面の制御
// ==========================================
async function loadAdmin() {
  const div = document.getElementById("adminQuestions");
  if (!div) return;
  
  const passwordEl = document.getElementById("password");
  const password = passwordEl ? passwordEl.value : "";
  if (!password) { div.innerHTML = "<p>管理パスワードを入力してください</p>"; return; }
  
  try {
    const res = await fetch("/questions");
    const data = await res.json();
    const list = data.questions || [];

    const fragment = document.createDocumentFragment();
    
    list.forEach(q => {
      const thread = document.createElement("div");
      thread.className = "thread";
      
      const title = document.createElement("h2");
      title.textContent = sanitize(q.title);
      thread.appendChild(title);
      
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.textContent = "アンケート削除";
      deleteBtn.onclick = () => deleteQuestion(q.id);
      thread.appendChild(deleteBtn);

      if (q.comments) {
        q.comments.forEach(c => {
          const commentDiv = document.createElement("div");
          commentDiv.style.cssText = "margin-top:10px; padding:10px; background:#eee;";
          
          const commentText = document.createElement("div");
          commentText.textContent = sanitize(c.text);
          commentDiv.appendChild(commentText);
          
          const commentDeleteBtn = document.createElement("button");
          commentDeleteBtn.type = "button";
          commentDeleteBtn.style.cssText = "margin-top:10px; padding:8px 12px; background:red; color:white;";
          commentDeleteBtn.textContent = "コメント削除";
          commentDeleteBtn.onclick = () => deleteComment(c.id);
          commentDiv.appendChild(commentDeleteBtn);
          
          thread.appendChild(commentDiv);
        });
      }

      fragment.appendChild(thread);
    });

    div.innerHTML = "";
    div.appendChild(fragment);
  } catch (err) {
    console.error(err);
    div.innerHTML = "<p>管理画面の読み込みに失敗しました</p>";
  }
}

async function deleteQuestion(id) {
  const passwordEl = document.getElementById("password");
  const res = await fetch("/admin/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, password: passwordEl ? passwordEl.value : "" })
  });
  const data = await res.json();
  if (data.error) return alert(data.message || "削除できませんでした");
  loadAdmin();
}

async function deleteComment(id) {
  const passwordEl = document.getElementById("password");
  const res = await fetch("/admin/delete-comment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, password: passwordEl ? passwordEl.value : "" })
  });
  const data = await res.json();
  if (data.error) return alert(data.message);
  loadAdmin();
}