// ==========================================
// 1. 定数・グローバル変数の定義
// ==========================================
const TAGS = [
  "ニュース", "政治", "投資", "お金", "仕事", "恋愛", "ゲーム", "食べ物",
  "音楽", "趣味・ホビー", "自転車・バイク", "美容・コスメ", "科学",
  "環境", "法律", "相談", "歴史", "本・読書", "映画", "ドラマ",
  "日常", "旅行", "教育", "海外", "社会", "悩み", "子育て・育児",
  "医療", "健康", "住まい・不動産", "人間関係", "ペット", "ファッション",
  "ビジネス", "テクノロジー", "スポーツ", "エンタメ", "アート",
  "デザイン", "アダルト", "暇つぶし", "ギャンブル", "その他"
];
 
const TOP_CATEGORIES = ["ニュース", "政治", "投資", "恋愛", "仕事", "ゲーム", "食べ物"];
const AGE_GROUPS = ["回答しない", "10代", "20代", "30代", "40代", "50代", "60代", "70代以上"];
const GENDERS = ["回答しない", "男性", "女性"];
 
let page = 1;
let totalPages = 1;
let currentSearch = "";
let currentTag = "";
let currentSort = "new";
let options = ["", ""];
 
function sanitize(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ==========================================
// 2. 起動時の初期化
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("questions")) loadQuestions();
 
  if (document.getElementById("options")) {
    renderOptions();
    const tagSelect = document.getElementById("tags");
    if (tagSelect) {
      tagSelect.innerHTML = '<option value="">カテゴリを選択してください（任意）</option>';
      TAGS.forEach(tag => { tagSelect.innerHTML += `<option value="${tag}">${tag}</option>`; });
    }
  }
 
//if (document.getElementById("questionArea")) loadCombinedQuestion();
  if (document.getElementById("adminQuestions")) loadAdmin();
 
  document.querySelectorAll("#topBtn, .topBtn").forEach(btn => {
    btn.addEventListener("click", () => { location.href = "index.html"; });
  });
});
 
// ==========================================
// 3. 質問投稿画面の制御
// ==========================================
function renderOptions() {
  const div = document.getElementById("options");
  if (!div) return;
 
  div.innerHTML = "";
  options.forEach((optionValue, index) => {
    div.innerHTML += `
      <div class="optionRow">
        <input value="${sanitize(optionValue)}" placeholder="選択肢 ${index + 1}" oninput="options[${index}] = this.value">
        <button class="deleteBtn" onclick="removeOption(${index})" type="button">削除</button>
      </div>
    `;
  });
}
 
function addOption() {
  if (options.length >= 10) return alert("選択肢は10個までです");
  options.push("");
  renderOptions();
}
 
function removeOption(index) {
  if (options.length <= 2) return alert("選択肢は2つ以上必要です");
  options.splice(index, 1);
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
      options
    })
  });
 
  const data = await res.json();
  if (data.error) return alert(data.message);
 
  alert("投稿しました");
  location.href = "index.html";
}
 
// ==========================================
// 4. トップページ（一覧画面）の制御
// ==========================================
async function loadQuestions() {
  const div = document.getElementById("questions");
  if (!div) return;
 
  div.innerHTML = `<div style="text-align: center; padding: 40px; color: #666; font-size: 14px;">アンケートを読み込み中...</div>`;
 
  const params = new URLSearchParams({ page: String(page), search: currentSearch, tag: currentTag, sort: currentSort });
 
  try {
    const res = await fetch(`/questions?${params.toString()}`);
    const data = await res.json();
 
    totalPages = data.totalPages || 1;
    const questionsList = data.questions || [];
 
    div.innerHTML = "";
 
    if (questionsList.length === 0) {
      div.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">アンケートが見つかりませんでした。</div>';
      return;
    }
 
    questionsList.forEach(q => {
      let total = q.totalVotes || 0; 
      const commentCount = q.commentCount || 0; // 💡 サーバーで正確に集計された数値を使う
      const speed = total + commentCount * 3;
      let hotTag = "NEW";
 
      if (speed > 100) hotTag = "HOT";
      else if (speed > 30) hotTag = "UP";
 
      const rawDate = q.createdAt || "";
 
      div.innerHTML += `
        <div class="thread" onclick="openDetail('${q.id}')">
          <div class="threadRow">
            <div class="leftTitle"><span class="hotTag">${hotTag}</span>${sanitize(q.title)}</div>
            <div class="rightMeta">
              <span>${total}回答</span>
              <span>${commentCount}コメント</span>
              <span>${q.views || 0}閲覧</span>
              <span class="postDate" style="color: #999; margin-left: 10px;">投稿日 ${rawDate}</span>
            </div>
          </div>
        </div>
      `;
    });
 
    renderTopTags();
 
    const pageText = document.getElementById("pageText");
    if (pageText) pageText.innerText = `${page} / ${totalPages} ページ`;
    updatePagerButtons();
  } catch (err) {
    console.error(err);
  }
}
 
function renderTopTags() {
  const tagArea = document.getElementById("tagArea");
  if (!tagArea) return;
 
  let tagHTML = "";
  TOP_CATEGORIES.forEach(tag => { tagHTML += `<span class="category" onclick="searchTag('${tag}')">${tag}</span> `; });
  tagHTML += `<button class="moreBtn" onclick="showAllTags()" type="button">もっと表示</button>`;
  if (currentTag) tagHTML += `<button class="closeBtn" onclick="clearTag()" type="button">絞り込み解除</button>`;
 
  tagArea.innerHTML = tagHTML;
}
 
function changeSort(sort) {
  currentSort = sort;
  document.querySelectorAll(".sortMenu span").forEach(item => item.classList.remove("active"));
  const sortTab = document.getElementById(`sort-${sort}`);
  if (sortTab) sortTab.classList.add("active");
  page = 1;
  loadQuestions();
}
 
function openDetail(id) { location.href = `question.html?id=${id}`; }
function searchQuestions() { const searchInput = document.getElementById("searchInput"); currentSearch = searchInput ? searchInput.value : ""; page = 1; loadQuestions(); }
function searchTag(tag) { currentTag = tag; page = 1; loadQuestions(); }
function clearTag() { currentTag = ""; page = 1; loadQuestions(); }
function nextPage() { if (page < totalPages) { page++; loadQuestions(); } }
function prevPage() { if (page > 1) { page--; loadQuestions(); } }
function updatePagerButtons() { const prevBtn = document.getElementById("prevBtn"); const nextBtn = document.getElementById("nextBtn"); if (prevBtn) prevBtn.disabled = page === 1; if (nextBtn) nextBtn.disabled = page >= totalPages; }
 
// ==========================================
// 5. 詳細・結果 統合画面の制御
// ==========================================
async function loadCombinedQuestion() {
  console.log("loadCombinedQuestion start");

  const div = document.getElementById("questionArea");
  if (!div) return;
 
  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    div.innerHTML = `<div class="detailCard"><p>不正なURLです</p></div>`;
    return;
  }
 
  try {
    // 💡 詳細を開いたら制限なしで確実に閲覧数を増やす
    await fetch("/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id })
    }).catch(e => console.error(e));

    const checkRes = await fetch(`/check-vote/${id}`);
    const checkData = await checkRes.json();
 
    //checkData.voted = false; // ✨ 一時的に常に未投票扱いに強制変更！

    const res = await fetch(`/questions/${id}`);
    const q = await res.json();
 
    if (q.error) {
      div.innerHTML = `<div class="detailCard"><p>${sanitize(q.message)}</p></div>`;
      return;
    }
 
    // 未投票の場合
    if (!checkData.voted) {
      let optionsHtml = "";
      q.options.forEach((option, index) => {
        const optionText = typeof option === "string" ? option : (option.text || "");
        optionsHtml += `
          <label class="optionCard" style="display: flex; align-items: center; background: #fff; padding: 10px 20px; border-radius: 12px; margin-bottom: 10px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: background 0.2s;">
            <input type="radio" name="voteOption" value="${index}" style="margin-right: 14px; width: 18px; height: 18px; cursor: pointer;">
            <span class="optionText" style="font-size: 16px; color: #333; font-weight: bold;">${sanitize(optionText)}</span>
          </label>
        `;
      });
 
      let html = `
        <div class="detailCard" style="max-width: 640px; margin: 40px auto 0 auto; padding: 24px; position: relative;">
          <h1 style="font-size: 24px; font-weight: bold; color: #333; margin: 0 0 16px 0; text-align: left;">${sanitize(q.title)}</h1>
          ${q.description ? `<p style="font-size: 14px; color: #666; margin-bottom: 16px; line-height: 1.5; text-align: left;">${sanitize(q.description)}</p>` : ''}
          <div class="optionsArea" style="margin-bottom: 24px;">${optionsHtml}</div>
 
          <div class="voteInfoRow" style="display: flex; gap: 16px; background: #f8fafc; padding: 10px 20px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #edf2f7; align-items: center;">
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
          </div>
 
          <div class="voteArea" style="text-align: center; margin-bottom: 20px;">
            <button class="voteSubmitBtn" onclick="voteAndReload('${q.id}')" type="button" style="background: #2563eb; color: #fff; font-size: 16px; font-weight: bold; padding: 8px 0; border: none; border-radius: 12px; cursor: pointer; width: 210px;">投票する</button>
          </div>
          <div style="position: absolute; right: 24px; bottom: 0;">
            <button onclick="reportQuestion('${q.id}')" type="button" style="background: #ef4444; color: #fff; font-size: 12px; font-weight: bold; padding: 5px 14px; border: none; border-radius: 5px; cursor: pointer;">通報</button>
          </div>
        </div>
      `;
 
      if (q.comments && q.comments.length) {
        html += `<div style="max-width: 640px; margin: 32px auto 0 auto;"><h2 style="font-size: 18px; font-weight: bold; color: #333; margin-bottom: 10px;">コメント</h2>`;
        q.comments.forEach(comment => {
          const profileText = (comment.gender || comment.age) ? ` (${sanitize(comment.gender || "未回答")} / ${sanitize(comment.age || "未回答")})` : "";
          html += `
            <div class="comment" style="background: #fff; padding: 12px 16px; border-radius: 8px; margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              <div style="font-size: 11px; color: #777; margin-bottom: 4px;">匿名ユーザー${profileText} ：${comment.createdAt || ""}</div>
              <div style="font-size: 13px; color: #333; line-height: 1.4;">${sanitize(comment.text)}</div>
            </div>`;
        });
        html += `</div>`;
      }
      div.innerHTML = html;
    }
 
    // 投票済みの場合
    else {
      const colors = ["#3b82f6", "#ef4444", "#22c55e", "#f97316", "#a855f7", "#06b6d4", "#ec4899", "#84cc16", "#d946ef", "#14b8a6"];
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
 
      let html = `
        <div class="resultDashboard">
          <div class="resultHeader">
            <div class="resultQuestionTitle">${sanitize(q.title)}</div>
            <h1>回答結果</h1>
          </div>
 
          <div class="resultGrid-top">
            <div class="resultCard">
              <h2>全体の回答</h2>
              <div class="overallWrap">
                <div class="pieChart" style="background: conic-gradient(${conicParts.join(", ")});"></div>
                <div class="overallStats" style="width:100%;">
      `;
 
      q.options.forEach((option, index) => {
        const stat = q.genderStats[index] || {};
        const percent = stat.rawPercent !== undefined ? stat.rawPercent : ((stat.male + stat.female) || 0);
        const color = colors[index % colors.length];
        const optionText = typeof option === "string" ? option : (option.text || "");
 
        html += `
          <div class="statRow" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 14px;">
            <span style="color: #333; font-weight: 500;">${sanitize(optionText)}</span>
            <strong style="color: #111; font-weight: bold;">${percent}%</strong>
          </div>
          <div class="bar" style="width: 100%; height: 8px; background-color: #e2e8f0; border-radius: 4px; margin-bottom: 16px; overflow: hidden; position: relative;">
            <div class="fill" style="width: ${percent}%; background-color: ${color}; height: 100%; border-radius: 4px; transition: width 0.3s ease;"></div>
          </div>
        `;
      });
 
      html += `
                </div>
              </div>
            </div>
            <div class="resultCard">
              <h2>性別ごとの割合</h2>
              <div id="genderStats"></div>
            </div>
          </div>
 
          <div class="resultCard margin-top-20">
            <h2>年代ごとの割合</h2>
            <div id="ageStats"></div>
          </div>
 
          <div class="resultCard margin-top-20 commentSection">
            <h2>コメント一覧</h2>
            <textarea id="commentText" placeholder="意見を入力..." style="width:100%; height:70px; padding:10px; border-radius:8px; font-size:13px; border:1px solid #ccc; box-sizing:border-box; resize:none;"></textarea>
            <div style="text-align:center;">
              <button onclick="addCommentAndReload('${q.id}')" style="width:150px; height:42px; display:block; margin:12px auto; border:none; border-radius:8px; background:#2563eb; color:white; font-size:14px; font-weight:bold; cursor:pointer;" type="button">コメント投稿</button>
            </div>
            <div id="commentList">
              ${q.comments ? q.comments.map((comment, index) => {
                const profileText = (comment.gender || comment.age) ? ` (${sanitize(comment.gender || "未回答")} / ${sanitize(comment.age || "未回答")})` : "";
                return `
                <div class="comment">
                  <div style="font-size:11px; color:#777; margin-bottom:4px;">No.${index + 1} 匿名ユーザー${profileText} ：${comment.createdAt}</div>
                  <div style="font-size:13px; color:#333; line-height:1.4;">${sanitize(comment.text)}</div>
                </div>
              `}).join("") : ""}
            </div>
          </div>
        </div>
      `;
 
      div.innerHTML = html;
      renderGenderStats(q);
      renderAgeStats(q);
    }
 
  } catch (err) {
    console.error("Error loading question:", err);
    div.innerHTML = `<div class="detailCard"><p>データの読み込みに失敗しました</p></div>`;
  }
}
 
async function voteAndReload(id) {
  const selected = document.querySelector('input[name="voteOption"]:checked');
  if (!selected) return alert("選択肢を選んでください");
 
  const ageEl = document.getElementById("age");
  const genderEl = document.getElementById("gender");
 
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
  if (data.error) { alert(data.message); location.reload(); return; }
  location.reload();
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
  const res = await fetch("/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  const data = await res.json();
  alert(data.error ? data.message : "通報しました");
}

function renderGenderStats(q) {
  const genderDiv = document.getElementById("genderStats");
  if (!genderDiv || !q.genderStats) return;
  let genderHTML = `<div class="axis-flipped-container" style="display: flex; flex-direction: column; gap: 16px;">`;
  q.options.forEach((option, index) => {
    const data = q.genderStats[index] || { male: 0, female: 0 };
    const optionText = typeof option === "string" ? option : (option.text || "");
    genderHTML += `
      <div class="flipped-option-group">
        <div class="flipped-axis-label" style="font-weight: bold; font-size: 16px; margin-bottom: 6px; color: #333;">${sanitize(optionText)}</div>
        <div class="flipped-bars-stack" style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
          <div class="flipped-bar-row" style="display: flex; align-items: center; gap: 12px; min-height: 20px; width: 100%;">
            <div style="font-size: 14px; width: 120px;">男性 / ${data.male}%</div>
            ${data.male > 0 ? `<div style="width: ${data.male}%; height: 16px; border-radius: 999px; background-color: #1e3a8a;"></div>` : ''}
          </div>
          <div class="flipped-bar-row" style="display: flex; align-items: center; gap: 12px; min-height: 20px; width: 100%;">
            <div style="font-size: 14px; width: 120px;">女性 / ${data.female}%</div>
            ${data.female > 0 ? `<div style="width: ${data.female}%; height: 16px; border-radius: 999px; background-color: #f43f5e;"></div>` : ''}
          </div>
        </div>
      </div>`;
  });
  genderDiv.innerHTML = genderHTML + "</div>";
}

function renderAgeStats(q) {
  const ageDiv = document.getElementById("ageStats");
  if (!ageDiv || !q.ageStats) return;
  const ages = AGE_GROUPS.filter(age => age !== "回答しない");
  const ageColors = ["#3b82f6", "#10b981", "#f97316", "#fbbf24", "#f43f5e", "#a855f7", "#ec4899"];
  let ageHTML = `<div class="axis-flipped-container" style="display: flex; flex-direction: column; gap: 16px;">`;
  q.options.forEach((option, optionIndex) => {
    const optionAgeData = q.ageStats[optionIndex] || {};
    const optionText = typeof option === "string" ? option : (option.text || "");
    ageHTML += `
      <div class="flipped-option-group">
        <div class="flipped-axis-label" style="font-weight: bold; font-size: 16px; margin-bottom: 6px; color: #333;">${sanitize(optionText)}</div>
        <div class="flipped-bars-stack" style="display: flex; flex-direction: column; gap: 3px; width: 100%;">`;
    ages.forEach((age, ageIndex) => {
      const percent = optionAgeData[age] || 0;
      ageHTML += `
        <div class="flipped-bar-row" style="display: flex; align-items: center; gap: 12px; min-height: 20px; width: 100%;">
          <div style="font-size: 14px; width: 90px;">${age} / ${percent}%</div>
          ${percent > 0 ? `<div style="width: ${percent}%; height: 16px; border-radius: 999px; background-color: ${ageColors[ageIndex]};"></div>` : ''}
        </div>`;
    });
    ageHTML += "</div></div>";
  });
  ageDiv.innerHTML = ageHTML + "</div>";
}

function showAllTags() {
  const tagArea = document.getElementById("tagArea");
  if (!tagArea) return;
  let html = "";
  TAGS.forEach(tag => { html += `<span class="category" onclick="searchTag('${tag}')">${tag}</span> `; });
  html += `<button class="closeBtn" onclick="loadQuestions()">閉じる</button>`;
  tagArea.innerHTML = html;
}

// ==========================================
// 6. 管理画面の制御
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
    div.innerHTML = "";
    list.forEach(q => {
      let htmlContent = `<div class="thread"><h2>${sanitize(q.title)}</h2><button onclick="deleteQuestion('${q.id}')">アンケート削除</button>`;
      if (q.comments) {
        q.comments.forEach(c => {
          htmlContent += `<div style="margin-top:10px; padding:10px; background:#eee;"><div>${sanitize(c.text)}</div><button type="button" style="margin-top:10px; padding:8px 12px; background:red; color:white;" onclick="deleteComment('${c.id}')">コメント削除</button></div>`;
        });
      }
      htmlContent += `</div>`; div.innerHTML += htmlContent;
    });
  } catch (err) { console.error(err); }
}

async function deleteQuestion(id) {
  const passwordEl = document.getElementById("password");
  const res = await fetch("/admin/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, password: passwordEl ? passwordEl.value : "" }) });
  const data = await res.json();
  if (data.error) return alert(data.message || "削除できませんでした");
  loadAdmin();
}

async function deleteComment(id) {
  const password = document.getElementById("password").value;
  const res = await fetch("/admin/delete-comment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, password }) });
  const data = await res.json();
  if (data.error) return alert(data.message);
  loadAdmin();
}