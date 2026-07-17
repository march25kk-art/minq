(() => {
  const diagnosisCatalog = [
    { slug: "mbti.html", title: "16タイプ性格診断", description: "考え方や行動の傾向を4つの軸で読み解きます。", groups: ["personality", "social", "work"] },
    { slug: "love-diagnosis", title: "恋愛価値観診断", description: "恋愛で大切にしている価値観を診断します。", groups: ["love", "personality"] },
    { slug: "hsp-diagnosis", title: "HSP傾向診断", description: "刺激への敏感さや考え方の傾向を確認します。", groups: ["mental", "personality"] },
    { slug: "stress-diagnosis", title: "ストレス耐性診断", description: "ストレスへの向き合い方と回復力を確認します。", groups: ["mental", "health"] },
    { slug: "self-esteem-diagnosis", title: "自己肯定感診断", description: "自分を受け入れ、尊重できている度合いを確認します。", groups: ["mental", "personality"] },
    { slug: "communication-diagnosis", title: "コミュ力診断", description: "会話・傾聴・伝え方の傾向を確認します。", groups: ["social", "personality", "work"] },
    { slug: "approval-seeking-diagnosis", title: "承認欲求診断", description: "周囲からの評価を気にする傾向を確認します。", groups: ["mental", "social", "personality"] },
    { slug: "adhd-diagnosis", title: "ADHD傾向診断", description: "注意・衝動性・落ち着きに関する傾向を確認します。", groups: ["mental", "health"] },
    { slug: "asd-diagnosis", title: "ASD傾向診断", description: "対人関係やこだわり、感覚に関する傾向を確認します。", groups: ["mental", "social"] },
    { slug: "cheating-risk-diagnosis", title: "浮気されやすさ診断", description: "恋愛での境界線や対話の傾向を確認します。", groups: ["love", "social"] },
    { slug: "possessiveness-diagnosis", title: "束縛度診断", description: "恋愛で相手の行動を把握したい気持ちを確認します。", groups: ["love", "mental"] },
    { slug: "love-dependency-diagnosis", title: "恋愛依存診断", description: "恋愛と自分の生活のバランスを確認します。", groups: ["love", "mental"] },
    { slug: "career-diagnosis", title: "適職診断", description: "仕事で発揮しやすい強みから適職を診断します。", groups: ["work", "personality"] },
    { slug: "manager-aptitude-diagnosis", title: "管理職適性診断", description: "チームを率いるための適性を確認します。", groups: ["work", "social"] },
    { slug: "entrepreneur-aptitude-diagnosis", title: "起業家適性診断", description: "行動力や不確実性への強さを確認します。", groups: ["work", "personality"] },
    { slug: "job-change-readiness-diagnosis", title: "転職適性診断", description: "転職理由や準備状況から今の適性を確認します。", groups: ["work", "mental"] }
  ];

  const normalize = value => String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");

  const bigrams = value => {
    const text = normalize(value);
    if (text.length < 2) return new Set(text ? [text] : []);
    return new Set(Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2)));
  };

  const textSimilarity = (left, right) => {
    const a = bigrams(left);
    const b = bigrams(right);
    if (!a.size || !b.size) return 0;
    let overlap = 0;
    a.forEach(value => { if (b.has(value)) overlap += 1; });
    return overlap / new Set([...a, ...b]).size;
  };

  const createCard = item => {
    const link = document.createElement("a");
    link.className = "recommendation-card";
    link.href = item.href;

    const label = document.createElement("span");
    label.className = "recommendation-card-label";
    label.textContent = item.label;

    const title = document.createElement("strong");
    title.textContent = item.title;

    const description = document.createElement("p");
    description.textContent = item.description;

    const arrow = document.createElement("span");
    arrow.className = "recommendation-card-arrow";
    arrow.textContent = "›";

    link.append(label, title, description, arrow);
    return link;
  };

  const render = (container, items) => {
    if (!container) return;
    const grid = container.querySelector(".recommendation-grid") || container;
    grid.replaceChildren(...items.slice(0, 3).map(createCard));
    container.hidden = items.length === 0;
  };

  window.renderDiagnosisRecommendations = (containerOrId, currentSlug) => {
    const container = typeof containerOrId === "string" ? document.getElementById(containerOrId) : containerOrId;
    const current = diagnosisCatalog.find(item => item.slug === currentSlug);
    const currentGroups = new Set(current?.groups || []);
    const ranked = diagnosisCatalog
      .filter(item => item.slug !== currentSlug)
      .map((item, index) => ({
        ...item,
        href: `/${item.slug}`,
        label: "おすすめ診断",
        score: item.groups.reduce((score, group) => score + (currentGroups.has(group) ? 1 : 0), 0),
        index
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    render(container, ranked);
  };

  window.renderQuestionRecommendations = async (containerOrId, question, currentId) => {
    const container = typeof containerOrId === "string" ? document.getElementById(containerOrId) : containerOrId;
    if (!container) return;

    try {
      const tag = Array.isArray(question.tags) ? question.tags[0] || "" : "";
      const params = new URLSearchParams({ page: "1", sort: "update", tag });
      let response = await fetch(`/questions?${params}`, { cache: "no-store" });
      let data = await response.json();
      let candidates = data.questions || [];

      if (candidates.filter(item => String(item.id) !== String(currentId)).length < 3 && tag) {
        response = await fetch("/questions?page=1&sort=update", { cache: "no-store" });
        data = await response.json();
        const seen = new Set(candidates.map(item => String(item.id)));
        candidates = candidates.concat((data.questions || []).filter(item => !seen.has(String(item.id))));
      }

      const sourceText = `${question.title || ""} ${question.description || ""}`;
      const sourceTags = new Set(Array.isArray(question.tags) ? question.tags : []);
      const ranked = candidates
        .filter(item => String(item.id) !== String(currentId))
        .map((item, index) => ({
          href: `/question?id=${encodeURIComponent(item.id)}`,
          title: item.title || "アンケート",
          description: item.description || "みんなの回答を見てみましょう。",
          label: "おすすめアンケート",
          score: (item.tags || []).reduce((score, itemTag) => score + (sourceTags.has(itemTag) ? 5 : 0), 0)
            + textSimilarity(sourceText, `${item.title || ""} ${item.description || ""}`),
          index
        }))
        .sort((a, b) => b.score - a.score || a.index - b.index);
      render(container, ranked);
    } catch (error) {
      console.error("Recommendation load failed:", error);
      container.hidden = true;
    }
  };
})();
