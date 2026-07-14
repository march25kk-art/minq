"use strict";

const questions = [
  { axis: "E/I", text: "初対面の人が多い場では？", a: ["自分から話しかけることが多い", "話しかけられるまで様子を見ることが多い"], score: ["E", "I"] },
  { axis: "S/N", text: "新しいことを学ぶときは？", a: ["具体例や手順から理解したい", "まず全体像や可能性を知りたい"], score: ["S", "N"] },
  { axis: "T/F", text: "意見がぶつかったとき、より重視するのは？", a: ["筋が通っているか", "相手がどう感じるか"], score: ["T", "F"] },
  { axis: "J/P", text: "休日の過ごし方は？", a: ["前もって予定を決めておきたい", "その日の気分で決めたい"], score: ["J", "P"] },
  { axis: "E/I", text: "疲れたときに元気を取り戻せるのは？", a: ["誰かと話したり出かけたりする時間", "ひとりで静かに過ごす時間"], score: ["E", "I"] },
  { axis: "S/N", text: "会話で惹かれる話題は？", a: ["実際にあった出来事や役立つ情報", "もしもの話や新しいアイデア"], score: ["S", "N"] },
  { axis: "T/F", text: "友人が悩んでいたら？", a: ["解決策を一緒に考える", "まず気持ちに寄り添う"], score: ["T", "F"] },
  { axis: "J/P", text: "締め切りのある作業は？", a: ["早めに進めて余裕を持ちたい", "締め切り間際に集中力が上がる"], score: ["J", "P"] },
  { axis: "E/I", text: "考えをまとめるときは？", a: ["話しながら整理する", "頭の中で整理してから話す"], score: ["E", "I"] },
  { axis: "S/N", text: "説明を受けるなら？", a: ["細かく正確な説明が安心する", "要点だけ聞いて自分で広げたい"], score: ["S", "N"] },
  { axis: "T/F", text: "大切な決断をするときは？", a: ["メリットとデメリットを比べる", "自分や周囲が納得できるか考える"], score: ["T", "F"] },
  { axis: "J/P", text: "旅行に行くなら？", a: ["行程や予約をきちんと決める", "余白を残して現地で決める"], score: ["J", "P"] },
  { axis: "E/I", text: "グループで過ごしたあとは？", a: ["刺激をもらって元気になる", "楽しくてもひとりの時間が欲しくなる"], score: ["E", "I"] },
  { axis: "S/N", text: "自分に近いのは？", a: ["現実的で堅実", "想像力が豊かでひらめき型"], score: ["S", "N"] },
  { axis: "T/F", text: "ルールを判断するときは？", a: ["誰にでも同じ基準を適用したい", "事情に合わせて柔軟に考えたい"], score: ["T", "F"] },
  { axis: "J/P", text: "予定が急に変わると？", a: ["少し落ち着かなくなる", "変化も楽しめることが多い"], score: ["J", "P"] },
  { axis: "E/I", text: "うれしい出来事があったら？", a: ["すぐ誰かに話したくなる", "まず自分の中で味わいたい"], score: ["E", "I"] },
  { axis: "S/N", text: "作品を楽しむときは？", a: ["描写やリアリティに注目する", "隠れた意味やテーマを考える"], score: ["S", "N"] },
  { axis: "T/F", text: "褒められてよりうれしいのは？", a: ["能力や成果を評価されること", "人柄や思いやりを認められること"], score: ["T", "F"] },
  { axis: "J/P", text: "机や持ち物の状態は？", a: ["決まった場所に整えておきたい", "使いやすければ多少自由でいい"], score: ["J", "P"] }
];

const typeData = {
  INTJ: ["建築家", "静かな戦略家", ["独創的", "長期的な視点", "自立心"], "複雑な課題の本質を見抜き、先を読んで仕組みを作るタイプ。自分なりの基準を大切にし、納得できる方法を粘り強く形にします。", "裁量があり、深く考えて改善できる環境"],
  INTP: ["論理学者", "好奇心あふれる探究者", ["分析的", "柔軟な発想", "知的好奇心"], "なぜそうなるのかを考え、物事の仕組みを解き明かすのが得意なタイプ。常識に縛られず、新しい可能性を自由に組み立てます。", "知識を掘り下げ、自由に試行錯誤できる環境"],
  ENTJ: ["指揮官", "未来を動かすリーダー", ["決断力", "戦略的", "目標志向"], "目標への道筋を描き、人や資源を動かして成果につなげるタイプ。難しい状況でも堂々と判断し、より高い水準を目指します。", "大きな目標と責任があり、変革を進められる環境"],
  ENTP: ["討論者", "アイデアを生む挑戦者", ["機転が利く", "革新的", "議論好き"], "新しい視点を見つけ、当たり前を問い直すことを楽しむタイプ。会話や試行錯誤からアイデアを磨き、変化のきっかけを作ります。", "新規性があり、議論と挑戦を歓迎する環境"],
  INFJ: ["提唱者", "理想を描く理解者", ["洞察力", "誠実", "理想主義"], "人の内面や物事の意味を深く捉え、よりよい未来を静かに追求するタイプ。信じる価値観のために粘り強く行動します。", "目的に共感でき、人の成長を支えられる環境"],
  INFP: ["仲介者", "心に正直な理想家", ["共感力", "創造的", "柔軟"], "自分の価値観を大切にし、人の個性や可能性を温かく見つめるタイプ。豊かな想像力で、自分らしい表現や意味を探します。", "価値観を尊重され、創造性を発揮できる環境"],
  ENFJ: ["主人公", "人を勇気づける案内役", ["社交的", "共感力", "情熱的"], "相手の長所を見つけ、みんなが前向きになれるよう働きかけるタイプ。人をまとめながら、共通の理想へ進む力があります。", "協力しながら、人や組織の成長に関われる環境"],
  ENFP: ["運動家", "ひらめきでつなぐ自由人", ["好奇心", "親しみやすい", "創造的"], "新しい可能性に胸を躍らせ、人とのつながりから刺激を得るタイプ。柔軟な発想と情熱で、周囲にも前向きな変化を広げます。", "変化があり、人とアイデアを自由につなげる環境"],
  ISTJ: ["管理者", "信頼を積み重ねる実務家", ["責任感", "正確", "堅実"], "約束や手順を大切にし、必要なことを着実にやり遂げるタイプ。事実を丁寧に確認し、安定した仕組みを支えます。", "役割と基準が明確で、専門性を磨ける環境"],
  ISFJ: ["擁護者", "細やかに支える守り手", ["思いやり", "献身的", "注意深い"], "周囲の小さな変化によく気づき、具体的な行動で人を支えるタイプ。責任感が強く、安心できる関係や環境を育てます。", "信頼関係があり、誰かの役に立てる環境"],
  ESTJ: ["幹部", "秩序を作る実行者", ["現実的", "組織力", "率直"], "目標と手順を明確にし、効率よく物事を進めるタイプ。責任を引き受け、チームが確実に成果を出せるよう整えます。", "権限と責任が明確で、成果が見える環境"],
  ESFJ: ["領事", "輪を育てる世話役", ["協力的", "社交的", "気配り"], "人との調和を大切にし、みんなが心地よく過ごせるよう気を配るタイプ。実用的なサポートで信頼を築きます。", "人と協力し、反応や感謝を直接感じられる環境"],
  ISTP: ["巨匠", "冷静な問題解決者", ["観察力", "実践的", "臨機応変"], "状況を静かに観察し、必要な瞬間に的確に動くタイプ。道具や仕組みを扱いながら、最も合理的な解決策を見つけます。", "実際に手を動かし、効率を工夫できる環境"],
  ISFP: ["冒険家", "感性を大切にする表現者", ["温厚", "感受性", "適応力"], "今この瞬間を大切にし、自分らしい感性で周囲に彩りを加えるタイプ。人をありのまま受け入れ、静かな優しさを示します。", "自由度があり、感性と人への配慮を活かせる環境"],
  ESTP: ["起業家", "行動で道を開く挑戦者", ["行動力", "現実的", "社交的"], "目の前の状況を素早く読み、まず動いてチャンスをつかむタイプ。刺激や人とのやり取りを楽しみ、柔軟に問題を解決します。", "変化と裁量があり、素早く結果を試せる環境"],
  ESFP: ["エンターテイナー", "場を明るくするムードメーカー", ["陽気", "親しみやすい", "柔軟"], "人と一緒に今を楽しみ、自然体の魅力で場を明るくするタイプ。周囲の気持ちに敏感で、実際的な助けも惜しみません。", "人との交流が多く、楽しさや手応えがある環境"]
};

let current = 0;
let answers = [];
let profile = { gender: "回答しない", age: "回答しない" };

const $ = id => document.getElementById(id);

function show(view) {
  ["mbtiStart", "mbtiQuiz", "mbtiResult"].forEach(id => { $(id).hidden = id !== view; });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startQuiz() {
  current = 0;
  answers = [];
  profile = {
    gender: $("mbtiGender").value,
    age: $("mbtiAge").value
  };
  show("mbtiQuiz");
  renderQuestion();
}

function renderQuestion() {
  const q = questions[current];
  const displayNumber = current + 1;
  const percent = Math.round((displayNumber / questions.length) * 100);
  $("mbtiCount").textContent = `${displayNumber} / ${questions.length}`;
  $("mbtiPercent").textContent = `${percent}%`;
  $("mbtiProgressBar").style.width = `${percent}%`;
  $("mbtiQuestion").textContent = q.text;
  $("mbtiAnswers").replaceChildren(...q.a.map((label, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mbti-answer";
    button.innerHTML = `<span>${index === 0 ? "A" : "B"}</span><b></b>`;
    button.querySelector("b").textContent = label;
    button.addEventListener("click", () => selectAnswer(q.score[index]));
    return button;
  }));
  $("mbtiBackButton").hidden = current === 0;
}

function selectAnswer(value) {
  answers[current] = value;
  if (current < questions.length - 1) {
    current += 1;
    renderQuestion();
  } else {
    renderResult();
  }
}

function goBack() {
  if (current > 0) {
    current -= 1;
    answers.length = current;
    renderQuestion();
  }
}

function getResult() {
  const counts = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
  answers.forEach(value => { counts[value] += 1; });
  const pairs = [["E", "I"], ["S", "N"], ["T", "F"], ["J", "P"]];
  const type = pairs.map(([left, right]) => counts[left] >= counts[right] ? left : right).join("");
  return { type, counts, pairs };
}

async function renderResult() {
  const { type, counts, pairs } = getResult();
  const [name, catchText, traits, description, environment] = typeData[type];
  $("mbtiType").textContent = type;
  $("mbtiTypeName").textContent = name;
  $("mbtiCatch").textContent = catchText;
  $("mbtiTraits").replaceChildren(...traits.map(trait => {
    const span = document.createElement("span");
    span.textContent = trait;
    return span;
  }));
  $("mbtiDescription").innerHTML = "";
  const p = document.createElement("p");
  p.textContent = description;
  const strong = document.createElement("strong");
  strong.textContent = "力を発揮しやすい環境";
  const env = document.createElement("p");
  env.textContent = environment;
  $("mbtiDescription").append(p, strong, env);
  $("mbtiScales").replaceChildren(...pairs.map(([left, right]) => {
    const total = counts[left] + counts[right];
    const leftPercent = Math.round((counts[left] / total) * 100);
    const row = document.createElement("div");
    row.className = "mbti-scale";
    row.innerHTML = `<div><b>${left} ${leftPercent}%</b><span></span><b>${100 - leftPercent}% ${right}</b></div><div class="mbti-scale-track"><span></span></div>`;
    row.querySelector(".mbti-scale-track span").style.width = `${leftPercent}%`;
    return row;
  }));
  $("mbtiShareButton").dataset.type = type;
  $("mbtiShareButton").dataset.name = name;
  show("mbtiResult");
  if (typeof gtag === "function") gtag("event", "mbti_complete", { mbti_type: type });
  await saveResultAndLoadStats(type);
}

function statsRows(rows) {
  return `<div class="mbti-stats-grid">${rows.map(row => `
    <div class="mbti-stat-row">
      <span>${row.type}</span>
      <div class="mbti-stat-bar" aria-hidden="true"><span style="width:${row.percent}%"></span></div>
      <span>${row.percent}%</span>
    </div>`).join("")}</div>`;
}

function statsSection(title, rows) {
  return `<section class="mbti-stats-section"><h3>${title}</h3>${statsRows(rows)}</section>`;
}

function renderStats(stats) {
  $("mbtiStatsStatus").textContent = stats.total ? `回答数 ${stats.total}件` : "まだ診断結果がありません。";
  $("mbtiStats").innerHTML = `
    ${statsSection("全体", stats.overall)}
    <div class="mbti-stats-demographics">
      ${statsSection("男性", stats.genders.male)}
      ${statsSection("女性", stats.genders.female)}
    </div>
    <div class="mbti-stats-demographics">
      ${Object.entries(stats.ages).map(([age, rows]) => statsSection(age, rows)).join("")}
    </div>`;
}

async function saveResultAndLoadStats(type) {
  $("mbtiStatsStatus").textContent = "統計を読み込んでいます...";
  $("mbtiStats").innerHTML = "";
  try {
    const saveResponse = await fetch("/mbti/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...profile })
    });
    const saved = await saveResponse.json();
    if (!saveResponse.ok || saved.error) throw new Error(saved.message || "save failed");

    const statsResponse = await fetch("/mbti/stats", { cache: "no-store" });
    const stats = await statsResponse.json();
    if (!statsResponse.ok || stats.error) throw new Error(stats.message || "load failed");
    renderStats(stats);
  } catch (error) {
    console.error("MBTI statistics failed:", error);
    $("mbtiStatsStatus").textContent = "統計を読み込めませんでした。時間をおいて再度お試しください。";
  }
}

async function shareResult() {
  const type = $("mbtiShareButton").dataset.type;
  const name = $("mbtiShareButton").dataset.name;
  const text = `みんQの16タイプ性格診断で「${type} ${name}」でした！`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "16タイプ性格診断 | みんQ", text, url: location.href });
    } else {
      await navigator.clipboard.writeText(`${text}\n${location.href}`);
      const original = $("mbtiShareButton").textContent;
      $("mbtiShareButton").textContent = "コピーしました";
      setTimeout(() => { $("mbtiShareButton").textContent = original; }, 1800);
    }
  } catch (error) {
    if (error.name !== "AbortError") location.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.href)}`;
  }
}

$("mbtiStartButton").addEventListener("click", startQuiz);
$("mbtiBackButton").addEventListener("click", goBack);
$("mbtiRetryButton").addEventListener("click", startQuiz);
$("mbtiShareButton").addEventListener("click", shareResult);
