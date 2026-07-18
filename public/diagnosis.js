"use strict";

const scaleAnswers = [
  { label: "とても当てはまる", value: 3 },
  { label: "やや当てはまる", value: 2 },
  { label: "あまり当てはまらない", value: 1 },
  { label: "まったく当てはまらない", value: 0 }
];

const diagnosisConfigs = {
  love: {
    slug: "love-diagnosis",
    title: "恋愛価値観診断",
    symbol: "♡",
    lead: "恋愛で本当に大切にしていることや、心地よい関係の築き方を読み解きます。",
    introShare: "恋愛で大切にしている価値観がわかる、みんQの恋愛価値観診断をやってみよう！",
    disclaimer: "この診断は恋愛観について考えるための簡易コンテンツです。結果は相性や関係の良し悪しを断定するものではありません。",
    mode: "category",
    questions: [
      ["恋人と過ごすなら、よりうれしいのは？", ["何気ない日常を一緒に過ごす", "新しい場所へ一緒に出かける"], ["security", "passion"]],
      ["相手から愛情を感じるのは？", ["言葉や態度でまっすぐ示してくれる", "困ったときにさりげなく支えてくれる"], ["passion", "devotion"]],
      ["理想の連絡頻度は？", ["毎日こまめにつながっていたい", "必要なときに無理なく連絡したい"], ["security", "independent"]],
      ["意見がぶつかったときは？", ["気持ちを受け止め合ってから話したい", "少し時間を置いて冷静に考えたい"], ["devotion", "independent"]],
      ["記念日について近い考えは？", ["特別な演出で盛り上げたい", "いつもの感謝を穏やかに伝えたい"], ["passion", "security"]],
      ["恋人が忙しそうなときは？", ["自分にできることを探して助ける", "相手の時間を尊重して見守る"], ["devotion", "independent"]],
      ["恋愛で一番不安になるのは？", ["気持ちが見えなくなること", "自分の時間がなくなること"], ["security", "independent"]],
      ["デートの計画は？", ["その場のひらめきで楽しみたい", "相手の希望を聞いて丁寧に決めたい"], ["passion", "devotion"]],
      ["将来については？", ["早めに方向性を確かめたい", "今の関係を楽しみながら考えたい"], ["security", "passion"]],
      ["恋人が落ち込んでいたら？", ["そばにいて話をじっくり聞く", "必要なら一人になれる時間を作る"], ["devotion", "independent"]],
      ["好きになったときの行動は？", ["気持ちをわかりやすく伝える", "信頼を少しずつ積み重ねる"], ["passion", "security"]],
      ["二人の趣味は？", ["できるだけ一緒に楽しみたい", "別々の趣味も大切にしたい"], ["devotion", "independent"]],
      ["プレゼントでもらってうれしいのは？", ["驚きのある印象的なもの", "自分をよく見て選んだ実用的なもの"], ["passion", "devotion"]],
      ["安心できる関係とは？", ["約束や連絡が安定している", "束縛せず信頼し合っている"], ["security", "independent"]],
      ["相手の短所に気づいたら？", ["成長できるよう率直に話す", "背景を理解して受け止める"], ["independent", "devotion"]],
      ["恋愛の始まりで惹かれるのは？", ["強いときめきや直感", "誠実さと安心感"], ["passion", "security"]],
      ["二人で決めるときは？", ["相手が喜ぶ方を選びたい", "お互いの希望を対等に出したい"], ["devotion", "independent"]],
      ["愛情表現として近いのは？", ["一緒にいる時間を増やす", "好きだと積極的に伝える"], ["security", "passion"]],
      ["相手に求めたいのは？", ["自分を気遣ってくれる優しさ", "互いの世界を尊重する姿勢"], ["devotion", "independent"]],
      ["長く続く恋愛に必要なのは？", ["変わらない信頼と安心", "新鮮さと一緒に楽しむ気持ち"], ["security", "passion"]]
    ],
    results: {
      security: ["安心重視タイプ", "信頼をじっくり育てる安定派", ["誠実", "一途", "将来志向"], "約束や日々の連絡など、積み重なる安心感を大切にするタイプです。刺激の強さよりも、素の自分でいられる信頼関係に愛情を感じます。", "不安を我慢しすぎず、望む連絡や将来像を言葉にすると、より心地よい関係を築けます。"],
      passion: ["情熱直感タイプ", "ときめきを力に変えるロマン派", ["素直", "行動的", "好奇心"], "気持ちが動く瞬間や二人だけの特別な体験を大切にするタイプです。愛情表現がわかりやすく、恋愛を前向きなエネルギーに変えられます。", "勢いだけで進まず、相手のペースにも目を向けると情熱が長く続きます。"],
      independent: ["自立尊重タイプ", "自由と信頼を両立する対等派", ["自立的", "率直", "柔軟"], "恋人同士でもそれぞれの時間や価値観を尊重したいタイプです。依存しすぎない対等な関係でこそ、自然体の愛情を育てられます。", "距離を尊重する気持ちと同時に、愛情を言葉や行動で見せると安心感が伝わります。"],
      devotion: ["共感献身タイプ", "思いやりで寄り添うサポート派", ["共感的", "気配り", "献身的"], "相手の気持ちをよく見て、具体的な支えや優しさで愛情を伝えるタイプです。相手が喜ぶことが自分の喜びになり、深い絆を育てます。", "相手を優先しすぎず、自分の希望や疲れにも同じだけ丁寧に向き合いましょう。"]
    }
  },
  hsp: {
    slug: "hsp-diagnosis", title: "HSP傾向診断", symbol: "♧",
    lead: "刺激への敏感さ、深く考える傾向、共感の強さをセルフチェックします。",
    introShare: "刺激への敏感さの傾向がわかる、みんQのHSP傾向診断をやってみよう！",
    disclaimer: "この診断はHSP傾向への自己理解を目的とした簡易チェックで、医学的・心理学的な診断ではありません。強い苦痛や生活上の困りごとが続く場合は、医療機関や専門家へご相談ください。",
    mode: "range", answers: scaleAnswers,
    questions: ["大きな音や突然の物音に驚きやすい","人混みや騒がしい場所に長くいるとぐったりする","相手の表情や声色の小さな変化に気づく","一度に多くのことを頼まれると混乱しやすい","映画や音楽、芸術に深く心を動かされる","失敗や注意されたことを長く考え続ける","服の肌触りや強いにおいが気になりやすい","周囲の人が緊張していると自分も落ち着かなくなる","忙しい日が続くと一人で静かに休む時間が必要になる","決断する前にさまざまな可能性を深く考える","空腹や疲労で集中力や気分が大きく変わる","誰かが怒られている場面を見るだけでもつらくなる","明るすぎる照明や強い日差しが苦手だ","予定が急に変わると気持ちの切り替えに時間がかかる","人の期待に応えようとして無理をしやすい","小さなミスや違和感によく気づく","競争や監視される状況では普段の力を出しにくい","相手の悩みを自分のことのように感じる","楽しい予定の後でも疲れを回復する時間が必要だ","自分の内面や出来事の意味を深く振り返る"],
    ranges: [[0,14,"low"],[15,29,"mild"],[30,44,"high"],[45,60,"veryHigh"]],
    results: {
      low: ["おおらか感覚タイプ", "刺激に左右されにくい安定傾向", ["切り替え上手", "行動的", "環境適応"], "周囲の刺激を必要以上に抱え込まず、比較的スムーズに切り替えられる傾向があります。変化の多い環境でも自分のペースを保ちやすいでしょう。", "疲れや違和感に気づくのが遅れる場合もあるため、ときどき意識して休息を取りましょう。"],
      mild: ["しなやか感受性タイプ", "感じ取る力と切り替える力のバランス型", ["気づき", "柔軟", "共感的"], "細かな変化や人の気持ちに気づきながらも、状況に応じて切り替えられる傾向です。感受性を対人関係や創造性に活かせます。", "忙しい時期は刺激が積み重なりやすいので、短い休憩を先回りして入れるのがおすすめです。"],
      high: ["繊細センサータイプ", "細部と気持ちを深く受け取る感受性派", ["洞察力", "共感力", "丁寧"], "音や雰囲気、人の感情などを細やかに受け取り、深く処理する傾向があります。その感受性は気配りや表現力として大きな強みになります。", "刺激を減らせる場所と一人で回復する時間を、予定の一部として確保しましょう。"],
      veryHigh: ["高感受性ケアタイプ", "豊かな感受性を持つじっくり回復派", ["高い共感力", "深い思考", "感性豊か"], "周囲の刺激や感情を非常に深く受け取る傾向があります。人が見落とす変化に気づける一方、刺激が重なると疲れやすい面があります。", "無理に慣れようとせず、刺激から離れる選択や周囲へ伝える工夫を大切にしてください。"]
    }
  },
  stress: {
    slug: "stress-diagnosis", title: "ストレス耐性診断", symbol: "◒",
    lead: "プレッシャーへの向き合い方と、心を立て直す回復力の傾向をチェックします。",
    introShare: "ストレスへの向き合い方がわかる、みんQのストレス耐性診断をやってみよう！",
    disclaimer: "この診断はストレスへの対処傾向を知る簡易コンテンツで、医学的・心理学的な診断ではありません。心身の不調やつらさが続く場合は、無理をせず医療機関や専門家へご相談ください。",
    mode: "range", answers: scaleAnswers,
    questions: ["予定外のことが起きても落ち着いて優先順位を考えられる","失敗した後、必要な反省をして気持ちを切り替えられる","困ったときに周囲へ助けを求められる","忙しいときでも睡眠や食事を大きく崩さずにいられる","批判を受けても自分のすべてを否定されたとは感じない","緊張する場面でも呼吸や考えを整える方法がある","問題を自分で変えられる部分と変えられない部分に分けられる","疲れを感じたら無理をする前に休める","嫌な出来事があっても楽しめる時間を持てる","複数の問題が重なっても一つずつ取り組める","自分の感情を言葉で捉えられる","周囲の期待と自分の限界の間に線を引ける","先の不安を考え続けず、今できることに集中できる","プレッシャーがあるときも普段の力をある程度発揮できる","落ち込んだときに自分を責めすぎず労われる","生活の中に気分転換できる習慣がある","意見の違う相手とも冷静に話し合える","大変な状況でも小さな前進を見つけられる","過去に困難を乗り越えた経験を思い出せる","ストレスが続いたとき、早めに環境や方法を調整できる"],
    ranges: [[0,14,"care"],[15,29,"sensitive"],[30,44,"balanced"],[45,60,"resilient"]],
    results: {
      care: ["休息優先タイプ", "今は回復の土台を整えたい時期", ["頑張り屋", "責任感", "感受性"], "ストレスを抱えたときに、気力や体力を多く使いやすい傾向があります。耐える力がないのではなく、現在の負担が回復力を上回っている可能性があります。", "睡眠や食事など小さな土台を優先し、一人で抱えず信頼できる人や専門家に相談してください。"],
      sensitive: ["慎重リカバリータイプ", "丁寧に整えることで力を戻すタイプ", ["慎重", "誠実", "内省的"], "プレッシャーを深く受け止める一方、落ち着ける環境では着実に回復できる傾向です。早めに負担へ気づき、調整することが力を守る鍵です。", "予定に余白を設け、疲れが小さいうちに休む自分なりのサインを決めておきましょう。"],
      balanced: ["柔軟バランスタイプ", "受け止めてしなやかに戻れる安定派", ["柔軟", "現実的", "自己調整"], "ストレスを感じても、状況を整理しながら比較的うまく立て直せる傾向があります。助けを借りることと自分で動くことのバランスも取れています。", "余裕がある時期にも回復習慣を続けておくと、大きな負荷への備えになります。"],
      resilient: ["しなやかタフタイプ", "変化を力に変える高回復力タイプ", ["切り替え上手", "行動的", "楽観的"], "プレッシャーの中でも優先順位を見つけ、行動しながら回復できる傾向があります。困難を経験として捉え、周囲にも安心感を与えられます。", "強さに頼って疲労を見落とさないよう、休むことも能力の一つとして扱いましょう。"]
    }
  }
};

Object.assign(diagnosisConfigs, window.EXTRA_DIAGNOSIS_CONFIGS || {});

const $ = id => document.getElementById(id);
const kind = document.body.dataset.diagnosis;
const config = diagnosisConfigs[kind];
let current = 0;
let answers = [];
let profile = { gender: "回答しない", age: "回答しない" };
let latestResult = null;

function setupPage() {
  $("diagnosisTitle").textContent = config.title;
  $("diagnosisSymbol").textContent = config.symbol;
  $("diagnosisLead").textContent = config.lead;
  $("diagnosisDisclaimer").textContent = config.disclaimer;
  document.body.classList.add(`diagnosis-${kind}`);
}

function show(view) {
  ["diagnosisStart", "diagnosisQuiz", "diagnosisResult"].forEach(id => { $(id).hidden = id !== view; });
  const seoContent = $("diagnosisSeoContent");
  if (seoContent) seoContent.hidden = view !== "diagnosisStart";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startQuiz() {
  current = 0;
  answers = [];
  profile = { gender: $("diagnosisGender").value, age: $("diagnosisAge").value };
  show("diagnosisQuiz");
  renderQuestion();
}

function questionData() {
  if (config.mode === "category") {
    const [text, labels, values] = config.questions[current];
    return { text, answers: labels.map((label, index) => ({ label, value: values[index] })) };
  }
  return { text: config.questions[current], answers: config.answers };
}

function renderQuestion() {
  const q = questionData();
  const number = current + 1;
  const percent = Math.round(number / config.questions.length * 100);
  $("diagnosisCount").textContent = `${number} / ${config.questions.length}`;
  $("diagnosisPercent").textContent = `${percent}%`;
  $("diagnosisProgressBar").style.width = `${percent}%`;
  const questionElement = $("diagnosisQuestion");
  questionElement.textContent = q.text;
  questionElement.style.fontSize = "";
  const answersElement = $("diagnosisAnswers");
  answersElement.classList.toggle("four-options", q.answers.length === 4);
  answersElement.replaceChildren(...q.answers.map((answer, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mbti-answer";
    button.innerHTML = `<span>${String.fromCharCode(65 + index)}</span><b></b>`;
    button.querySelector("b").textContent = answer.label;
    button.addEventListener("click", () => selectAnswer(answer.value));
    return button;
  }));
  $("diagnosisBackButton").hidden = current === 0;
  fitQuestionText(questionElement);
}

function fitQuestionText(element) {
  const baseSize = parseFloat(getComputedStyle(element).fontSize);
  if (element.scrollWidth > element.clientWidth) {
    const fittedSize = baseSize * element.clientWidth / element.scrollWidth * .98;
    element.style.fontSize = `${Math.max(12, fittedSize)}px`;
  }
}

function selectAnswer(value) {
  answers[current] = value;
  if (current < config.questions.length - 1) { current += 1; renderQuestion(); }
  else renderResult();
}

function goBack() {
  if (current > 0) { current -= 1; answers.length = current; renderQuestion(); }
}

function getResultKey() {
  if (config.mode === "category") {
    const counts = Object.fromEntries(Object.keys(config.results).map(key => [key, 0]));
    answers.forEach(value => { counts[value] += 1; });
    return Object.keys(counts).reduce((best, key) => counts[key] > counts[best] ? key : best);
  }
  const score = answers.reduce((sum, value) => sum + Number(value), 0);
  return config.ranges.find(([min, max]) => score >= min && score <= max)[2];
}

async function renderResult() {
  const type = getResultKey();
  const [name, catchText, traits, description, advice] = config.results[type];
  latestResult = { type, name };
  $("diagnosisType").textContent = config.symbol;
  $("diagnosisTypeName").textContent = name;
  $("diagnosisCatch").textContent = catchText;
  $("diagnosisTraits").replaceChildren(...traits.map(trait => {
    const span = document.createElement("span"); span.textContent = trait; return span;
  }));
  const descriptionBox = $("diagnosisDescription");
  descriptionBox.replaceChildren();
  const p = document.createElement("p"); p.textContent = description;
  const strong = document.createElement("strong"); strong.textContent = "あなたへのヒント";
  const hint = document.createElement("p"); hint.textContent = advice;
  descriptionBox.append(p, strong, hint);
  show("diagnosisResult");
  window.renderDiagnosisRecommendations?.("diagnosisRecommendations", config.slug);
  if (typeof gtag === "function") gtag("event", "diagnosis_complete", { diagnosis_kind: kind, diagnosis_type: type });
  await saveAndLoadStats(type);
}

function statsRows(rows) {
  return `<div class="mbti-stats-grid">${rows.map(row => `<div class="mbti-stat-row"><span>${config.results[row.type]?.[0] || row.type}</span><div class="mbti-stat-bar"><span style="width:${row.percent}%"></span></div><span>${row.percent}%</span></div>`).join("")}</div>`;
}

function statsSection(title, rows) {
  return `<section class="mbti-stats-section"><h3>${title}</h3>${statsRows(rows)}</section>`;
}

function renderStats(stats) {
  $("diagnosisStatsStatus").textContent = stats.total ? `回答数 ${stats.total}件` : "まだ診断結果がありません。";
  $("diagnosisStats").innerHTML = `${statsSection("全体", stats.overall)}<div class="mbti-stats-demographics">${statsSection("男性", stats.genders.male)}${statsSection("女性", stats.genders.female)}</div><div class="mbti-stats-demographics">${Object.entries(stats.ages).map(([age, rows]) => statsSection(age, rows)).join("")}</div>`;
}

async function saveAndLoadStats(type) {
  try {
    const savedResponse = await fetch("/diagnosis/result", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, type, ...profile }) });
    const saved = await savedResponse.json();
    if (!savedResponse.ok || saved.error) throw new Error(saved.message || "save failed");
    const statsResponse = await fetch(`/diagnosis/stats/${encodeURIComponent(kind)}`, { cache: "no-store" });
    const stats = await statsResponse.json();
    if (!statsResponse.ok || stats.error) throw new Error(stats.message || "load failed");
    renderStats(stats);
  } catch (error) {
    console.error("Diagnosis statistics failed:", error);
    $("diagnosisStatsStatus").textContent = "統計を読み込めませんでした。時間をおいて再度お試しください。";
  }
}

setupPage();
$("diagnosisStartButton").addEventListener("click", startQuiz);
$("diagnosisBackButton").addEventListener("click", goBack);
$("diagnosisRetryButton").addEventListener("click", startQuiz);
$("diagnosisIntroShareButton").addEventListener("click", () => {
  window.ResultShare.open({
    diagnosis: config.title,
    result: config.title,
    catchText: config.lead,
    text: config.introShare,
    allowImage: false
  });
});
$("diagnosisShareButton").addEventListener("click", () => {
  const text = `みんQの${config.title}で「${latestResult.name}」でした！`;
  window.ResultShare.open({
    diagnosis: config.title,
    result: latestResult.name,
    catchText: $("diagnosisCatch").textContent,
    accent: getComputedStyle(document.body).getPropertyValue("--diagnosis-accent").trim() || "#765ac8",
    text
  });
});
