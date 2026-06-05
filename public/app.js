const TAGS = [
  "ニュース", "政治", "投資", "仕事", "恋愛", "ゲーム", "食べ物",
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

function renderOptions() {
  const div = document.getElementById("options");
  if (!div) return;

  div.innerHTML = "";
  options.forEach((optionValue, index) => {
    div.innerHTML += `
      <div class="optionRow">
        <input
          value="${optionValue}"
          placeholder="選択肢 ${index + 1}"
          oninput="options[${index}] = this.value"
        >
        <button class="deleteBtn" onclick="removeOption(${index})" type="button">削除</button>
      </div>
    `;
  });
}

function addOption() {
  if (options.length >= 10) {
    alert("選択肢は10個までです");
    return;
  }
  options.push("");
  renderOptions();
}

function removeOption(index) {
  if (options.length <= 2) {
    alert("選択肢は2つ以上必要です");
    return;
  }
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
  if (data.error) {
    alert(data.message);
    return;
  }

  alert("投稿しました");
  location.href = "index.html";
}

async function loadQuestions() {
  const div = document.getElementById("questions");
  if (!div) return;

  const params = new URLSearchParams({
    page: String(page),
    search: currentSearch,
    tag: currentTag,
    sort: currentSort
  });
  const res = await fetch(`/questions?${params.toString()}`);
  const data = await res.json();

  totalPages = data.totalPages || 1;
  const questionsList = data.questions || [];

  div.innerHTML = "";

  questionsList.forEach(q => {
    const total = q.options.reduce((sum, option) => sum + option.votes, 0);
    const commentCount = q.comments ? q.comments.length : 0;
    const speed = total + commentCount * 3;
    let hotTag = "NEW";

    if (speed > 100) {
      hotTag = "HOT";
    } else if (speed > 30) {
      hotTag = "UP";
    }

    const rawDate = q.createdAt || new Date().toISOString().replace("T", " ").substring(0, 19);
    const dateText = `投稿日 ${rawDate}`;

    div.innerHTML += `
      <div class="thread" onclick="openDetail(${q.id})">
        <div class="threadRow">
          <div class="leftTitle">
            <span class="hotTag">${hotTag}</span>${q.title}
          </div>
          <div class="rightMeta">
            <span>${total}回答</span>
            <span>${commentCount}コメント</span>
            <span>${q.views || 0}閲覧</span>
            <span class="postDate" style="color: #999; margin-left: 10px;">${dateText}</span>
          </div>
        </div>
      </div>
    `;
  });

  renderTopTags();

  const pageText = document.getElementById("pageText");
  if (pageText) {
    pageText.innerText = `${page} / ${totalPages} ページ`;
  }

  updatePagerButtons();
}

function renderTopTags() {
  const tagArea = document.getElementById("tagArea");
  if (!tagArea) return;

  let tagHTML = "";
  TOP_CATEGORIES.forEach(tag => {
    tagHTML += `<span class="category" onclick="searchTag('${tag}')">${tag}</span> `;
  });
  tagHTML += `<button class="moreBtn" onclick="showAllTags()" type="button">もっと表示</button>`;
  if (currentTag) {
    tagHTML += `<button class="closeBtn" onclick="clearTag()" type="button">絞り込み解除</button>`;
  }

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

function openDetail(id) {
  location.href = `detail.html?id=${id}`;
}

async function loadDetail() {
  const div = document.getElementById("detail");
  if (!div) return;

  const id = new URLSearchParams(location.search).get("id");
  const checkRes = await fetch(`/check-vote/${id}`);
  const checkData = await checkRes.json();

  if (checkData.voted) {
    location.href = `result.html?id=${id}`;
    return;
  }

  const res = await fetch(`/questions/${id}`);
  const q = await res.json();

  if (q.error) {
    div.innerHTML = `<div class="detailCard"><p>${q.message}</p></div>`;
    return;
  }

  await fetch("/view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });

  let html = `
    <div class="detailCard">
      <h1>${q.title}</h1>
      <p>${q.description || ""}</p>
  `;

  q.options.forEach((option, index) => {
    html += `
      <label class="optionCard">
        <input type="radio" name="voteOption" value="${index}">
        <span class="optionText">${option.text}</span>
      </label>
    `;
  });

  html += `
    <div class="voteInfoRow">
      <div>
        <span class="voteLabel">年代</span>
        <select id="age">
          ${AGE_GROUPS.map(age => `<option>${age}</option>`).join("")}
        </select>
      </div>
      <div>
        <span class="voteLabel">性別</span>
        <select id="gender">
          ${GENDERS.map(gender => `<option>${gender}</option>`).join("")}
        </select>
      </div>
    </div>

    <div class="voteArea">
      <button class="voteSubmitBtn" onclick="vote(${q.id})" type="button">投票する</button>
      <button onclick="reportQuestion(${q.id})" type="button">通報</button>
    </div>
  `;

  if (q.comments && q.comments.length) {
    html += `<h2>コメント</h2>`;
    q.comments.forEach(comment => {
      html += `<div class="comment">${comment.text}</div>`;
    });
  }

  html += "</div>";
  div.innerHTML = html;
}

async function vote(id) {
  const selected = document.querySelector('input[name="voteOption"]:checked');
  if (!selected) {
    alert("選択肢を選んでください");
    return;
  }

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
  if (data.error) {
    alert(data.message);
    if (data.message.includes("投票済み")) {
      location.href = `result.html?id=${id}`;
    }
    return;
  }

  location.href = `result.html?id=${id}`;
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

function searchQuestions() {
  const searchInput = document.getElementById("searchInput");
  currentSearch = searchInput ? searchInput.value : "";
  page = 1;
  loadQuestions();
}

function searchTag(tag) {
  currentTag = tag;
  page = 1;
  loadQuestions();
}

function clearTag() {
  currentTag = "";
  page = 1;
  loadQuestions();
}

function nextPage() {
  if (page < totalPages) {
    page++;
    loadQuestions();
  }
}

function prevPage() {
  if (page > 1) {
    page--;
    loadQuestions();
  }
}

function updatePagerButtons() {
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  if (prevBtn) prevBtn.disabled = page === 1;
  if (nextBtn) nextBtn.disabled = page >= totalPages;
}

async function loadAdmin() {
  const div = document.getElementById("adminQuestions");
  if (!div) return;

  const passwordEl = document.getElementById("password");
  const password = passwordEl ? passwordEl.value : "";

  if (!password) {
    div.innerHTML = "<p>管理パスワードを入力してください</p>";
    return;
  }

  const res = await fetch("/questions");
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data.questions || []);

  div.innerHTML = "";
  list.forEach(q => {

    div.innerHTML += `
      <div class="thread">
        <h2>${q.title}</h2>

        <button onclick="deleteQuestion(${q.id})">
          アンケート削除
        </button>
    `;

    if(q.comments){

      q.comments.forEach(c => {

        div.innerHTML += `
  <div style="
    margin-top:10px;
    padding:10px;
    background:#eee;
  ">
    <div>${c.text}</div>

    <button
      type="button"
      style="
        margin-top:10px;
        padding:8px 12px;
        background:red;
        color:white;
        cursor:pointer;
      "
      onclick="deleteComment(${c.id})"
    >
      コメント削除
    </button>
  </div>
`;div.innerHTML += `
          <div style="
            margin-top:10px;
            padding:10px;
            background:#eee;
          ">
            ${c.text}

            <button
              onclick="deleteComment(${c.id})"
            >
              コメント削除
            </button>

          </div>
        `;

      });

    }

    div.innerHTML += `</div>`;

  });
}

async function deleteQuestion(id) {
  const passwordEl = document.getElementById("password");
  const res = await fetch("/admin/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      password: passwordEl ? passwordEl.value : ""
    })
  });
  const data = await res.json();

  if (data.error) {
    alert(data.message || "削除できませんでした");
    return;
  }

  loadAdmin();
}

async function loadResult() {
  const div = document.getElementById("result");
  if (!div) return;

  const id = new URLSearchParams(location.search).get("id");
  const checkRes = await fetch(`/check-vote/${id}`);
  const checkData = await checkRes.json();

  if (!checkData.voted) {
    alert("投票後に結果を表示できます");
    location.href = `detail.html?id=${id}`;
    return;
  }

  const res = await fetch(`/questions/${id}`);
  const q = await res.json();
  if (q.error) {
    div.innerHTML = `<div class="resultDashboard">${q.message}</div>`;
    return;
  }

  const total = q.options.reduce((sum, option) => sum + option.votes, 0);
  const colors = ["#3b82f6", "#ef4444", "#22c55e", "#f97316", "#a855f7", "#06b6d4", "#ec4899", "#84cc16", "#d946ef", "#14b8a6"];

  let conicParts = [];
  let cumulativePercent = 0;
  q.options.forEach((option, index) => {
    const percent = total ? Math.round((option.votes / total) * 100) : 0;
    const start = cumulativePercent;
    cumulativePercent += percent;
    conicParts.push(`${colors[index % colors.length]} ${start}% ${cumulativePercent}%`);
  });
  if (cumulativePercent < 100) conicParts.push(`#e2e8f0 ${cumulativePercent}% 100%`);

  let html = `
    <div class="resultDashboard">
      <div class="resultHeader">
        <div class="resultQuestionTitle">${q.title}</div>
        <h1>回答結果</h1>
        <div class="resultMeta"><span>総投票数：${total}票</span></div>
      </div>

      <div class="resultGrid-top">
        <div class="resultCard">
          <h2>全体の回答</h2>
          <div class="overallWrap">
            <div class="pieChart" style="background: conic-gradient(${conicParts.join(", ")});"></div>
            <div class="overallStats" style="width:100%;">
  `;

  q.options.forEach((option, index) => {
    const percent = total ? Math.round((option.votes / total) * 100) : 0;
    const color = colors[index % colors.length];
    html += `
      <div class="statRow">
        <span>${option.text}</span>
        <strong>${percent}%</strong>
      </div>
      <div class="bar">
        <div class="fill" style="width:${percent}%; background-color:${color};"></div>
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
          <button onclick="addComment(${q.id})" style="width:150px; height:42px; display:block; margin:12px auto; border:none; border-radius:8px; background:#2563eb; color:white; font-size:14px; font-weight:bold; cursor:pointer;" type="button">
            コメント投稿
          </button>
        </div>
        <div id="commentList">
          ${q.comments ? q.comments.map((comment, index) => `
            <div class="comment">
              <div style="font-size:11px; color:#777; margin-bottom:4px;">No.${index + 1} ：${comment.createdAt}</div>
              <div style="font-size:13px; color:#333; line-height:1.4;">${comment.text}</div>
            </div>
          `).join("") : ""}
        </div>
      </div>
    </div>
  `;

  div.innerHTML = html;
  renderGenderStats(q);
  renderAgeStats(q);
}

function renderGenderStats(q) {
  const genderDiv = document.getElementById("genderStats");
  if (!genderDiv || !q.genderStats) return;

  let genderHTML = `<div class="axis-flipped-container">`;
  q.options.forEach((option, index) => {
    const data = q.genderStats[index] || { male: 0, female: 0 };
    genderHTML += `
      <div class="flipped-option-group">
        <div class="flipped-axis-label">${option.text}</div>
        <div class="flipped-bars-stack">
          <div class="flipped-bar-row"><div class="bar-single-wrap"><div class="bar-single-fill gender-navy" style="width:${data.male}%;"></div><span class="bar-percent-text">男性 / ${data.male}%</span></div></div>
          <div class="flipped-bar-row"><div class="bar-single-wrap"><div class="bar-single-fill gender-coral" style="width:${data.female}%;"></div><span class="bar-percent-text">女性 / ${data.female}%</span></div></div>
        </div>
      </div>
    `;
  });
  genderDiv.innerHTML = `${genderHTML}</div>`;
}

function renderAgeStats(q) {
  const ageDiv = document.getElementById("ageStats");
  if (!ageDiv || !q.ageStats) return;

  const ages = AGE_GROUPS.filter(age => age !== "回答しない");
  const ageColors = ["#3b82f6", "#10b981", "#f97316", "#fbbf24", "#f43f5e", "#a855f7", "#ec4899"];
  let ageHTML = `<div class="axis-flipped-container">`;

  q.options.forEach((option, optionIndex) => {
    const optionAgeData = q.ageStats[optionIndex] || {};
    ageHTML += `<div class="flipped-option-group"><div class="flipped-axis-label">${option.text}</div><div class="flipped-bars-stack">`;
    ages.forEach((age, ageIndex) => {
      const percent = optionAgeData[age] || 0;
      ageHTML += `<div class="flipped-bar-row"><div class="bar-single-wrap"><div class="bar-single-fill" style="width:${percent}%; background-color:${percent > 0 ? ageColors[ageIndex] : "#e2e8f0"};"></div><span class="bar-percent-text">${age} / ${percent}%</span></div></div>`;
    });
    ageHTML += "</div></div>";
  });

  ageDiv.innerHTML = `${ageHTML}</div>`;
}

async function addComment(id) {
  const commentTextEl = document.getElementById("commentText");
  const text = commentTextEl ? commentTextEl.value.trim() : "";

  if (!text) {
    alert("コメントを入力してください");
    return;
  }

  const res = await fetch("/comment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, text })
  });

  const data = await res.json();
  if (data.error) {
    alert(data.message);
    return;
  }

  loadResult();
}

function showAllTags() {
  const tagArea = document.getElementById("tagArea");
  if (!tagArea) return;

  let html = "";
  TAGS.forEach(tag => {
    html += `<span class="category" onclick="searchTag('${tag}')">${tag}</span> `;
  });
  html += `<button class="closeBtn" onclick="hideTags()" type="button">閉じる</button>`;
  tagArea.innerHTML = html;
}

function hideTags() {
  renderTopTags();
}

window.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("questions")) {
    loadQuestions();
  }

  if (document.getElementById("options")) {
    renderOptions();

    const tagSelect = document.getElementById("tags");
    if (tagSelect) {
      tagSelect.innerHTML = '<option value="">カテゴリを選択してください（任意）</option>';
      TAGS.forEach(tag => {
        tagSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
      });
    }
  }

  if (document.getElementById("detail")) {
    loadDetail();
  }

  if (document.getElementById("adminQuestions")) {
    loadAdmin();
  }

  if (document.getElementById("result")) {
    loadResult();
  }
});

async function deleteComment(id){

  const password =
    document.getElementById("password").value;

  const res =
    await fetch("/admin/delete-comment",{

      method:"POST",

      headers:{
        "Content-Type":"application/json"
      },

      body:JSON.stringify({
        id,
        password
      })

    });

  const data = await res.json();

  if(data.error){

    alert(data.message);
    return;

  }

  loadAdmin();

}