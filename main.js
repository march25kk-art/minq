// ==========================================
// 5. トップページ（一覧画面）の制御
// ==========================================
async function loadQuestions() {
  const div = document.getElementById("questions");
  if (!div) return;

  div.innerHTML = `<div style="text-align: center; padding: 40px; color: #666; font-size: 14px;">アンケートを読み込み中...</div>`;

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
      // コメント数取得を改善（フィールドが無い可能性に対応）
      const commentCount = (typeof q.commentCount === 'number' && q.commentCount >= 0) ? q.commentCount : 
                            (q.comments && Array.isArray(q.comments)) ? q.comments.length : 0;
      const viewsCount = q.views || 0;
      const hotTag = getOptimalHotTag(total, commentCount);

      const thread = document.createElement("div");
      thread.className = "thread";
      thread.onclick = () => openDetail(q.id);
      thread.innerHTML = `
        <div class="threadRow">
          <div class="leftTitle"><span class="hotTag">${hotTag}</span>${sanitize(q.title)}</div>
          <div class="rightMeta">
            <span>${total}回答</span>
            <span>${commentCount}コメント</span>
            <span>${viewsCount}閲覧</span>
            <span class="postDate" style="color: #999; margin-left: 10px;">投稿日 ${q.createdAt || ""}</span>
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
