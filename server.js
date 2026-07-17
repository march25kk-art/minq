const express = require("express");
const { firestore } = require("./firebase");
const { FieldValue } = require("firebase-admin/firestore");
const { updateSitemap } = require('./generateSitemap');
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
app.use(express.json({ limit: "32kb" }));

const decodeStoredText = (value = "") => String(value)
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#039;/g, "'")
  .replace(/<[^>]*>/g, "")
  .trim();

const escapeSeoHTML = (value = "") => decodeStoredText(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

// ==========================================
// 1. 古い詳細ページ（detail.html）から新ページ（/question）への301リダイレクト
// ==========================================
app.get('/detail.html', (req, res) => {
  const id = req.query.id;
  if (id) {
    res.redirect(301, `/question?id=${encodeURIComponent(id)}`);
  } else {
    res.redirect(301, '/');
  }
});

const normalizeAdSensePublisherId = value => {
  const match = String(value || "").trim().match(/^(?:ca-)?pub-(\d{16})$/);
  return match ? `ca-pub-${match[1]}` : "";
};

const ADSENSE_PUBLISHER_ID = normalizeAdSensePublisherId(
  process.env.ADSENSE_PUBLISHER_ID
) || "ca-pub-3394319286074054";

const normalizeAdSenseSlotId = value => {
  const slot = String(value || "").trim();
  return /^\d{5,20}$/.test(slot) ? slot : "";
};

const createAdSenseHeadScript = () => {
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}" crossorigin="anonymous" data-minq-adsense="true"></script>`;
};

const injectAdSenseHeadScript = html => html.replace("<!-- ADSENSE_HEAD -->", createAdSenseHeadScript());

// AdSenseのIDはリポジトリへ直書きせず、デプロイ先の環境変数から配信する。
app.get("/adsense-config.js", (req, res) => {
  const config = {
    client: ADSENSE_PUBLISHER_ID,
    slots: {
      homeInFeed: normalizeAdSenseSlotId(process.env.ADSENSE_SLOT_HOME_INFEED),
      homeSidebar: normalizeAdSenseSlotId(process.env.ADSENSE_SLOT_HOME_SIDEBAR),
      resultInline: normalizeAdSenseSlotId(process.env.ADSENSE_SLOT_RESULT_INLINE)
    },
    testMode: process.env.ADSENSE_TEST_MODE === "true"
  };

  res
    .type("application/javascript")
    .set("Cache-Control", "no-store")
    .send(`window.MINQ_ADSENSE_CONFIG = ${JSON.stringify(config)};`);
});

// publisher IDを設定すると、Googleが確認するads.txtも同じ値から生成される。
app.get("/ads.txt", (req, res) => {
  res
    .type("text/plain")
    .set("Cache-Control", "public, max-age=3600")
    .send(`google.com, ${ADSENSE_PUBLISHER_ID.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);
});

// トップページのHTMLソースにもGoogle公式の確認用スクリプトを出力する。
app.get("/", (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8");
  res.send(injectAdSenseHeadScript(html));
});

app.get("/index.html", (req, res) => res.redirect(301, "/"));

const DIAGNOSIS_PAGES = {
  "/love-diagnosis": { kind: "love", slug: "love-diagnosis", title: "恋愛価値観診断", description: "20の質問から、恋愛で大切にしている価値観や関係の築き方を診断します。", theme: "#e85b8b" },
  "/hsp-diagnosis": { kind: "hsp", slug: "hsp-diagnosis", title: "HSP傾向診断", description: "刺激への敏感さや考え方の傾向を20の質問からチェックする簡易診断です。", theme: "#765ac8" },
  "/stress-diagnosis": { kind: "stress", slug: "stress-diagnosis", title: "ストレス耐性診断", description: "ストレスへの向き合い方と回復力の傾向を20の質問からチェックします。", theme: "#168f75" },
  "/self-esteem-diagnosis": { kind: "selfEsteem", slug: "self-esteem-diagnosis", title: "自己肯定感診断", description: "自分を受け入れ、尊重できている度合いを20の質問からチェックします。", theme: "#d48b16" },
  "/communication-diagnosis": { kind: "communication", slug: "communication-diagnosis", title: "コミュ力診断", description: "会話・傾聴・伝え方の傾向を20の質問からチェックします。", theme: "#147fa1" },
  "/approval-seeking-diagnosis": { kind: "approval", slug: "approval-seeking-diagnosis", title: "承認欲求診断", description: "周囲からの評価をどのくらい気にする傾向があるか、20の質問でチェックします。", theme: "#8a5ac2" },
  "/adhd-diagnosis": { kind: "adhd", slug: "adhd-diagnosis", title: "ADHD傾向診断", description: "注意・衝動性・落ち着きに関する日常の傾向を確認する簡易セルフチェックです。", theme: "#e06a3b" },
  "/asd-diagnosis": { kind: "asd", slug: "asd-diagnosis", title: "ASD傾向診断", description: "対人コミュニケーションやこだわり、感覚に関する傾向を確認する簡易セルフチェックです。", theme: "#4778bf" },
  "/cheating-risk-diagnosis": { kind: "cheatingRisk", slug: "cheating-risk-diagnosis", title: "浮気されやすさ診断", description: "恋愛での境界線やコミュニケーションの傾向を20の質問からチェックします。", theme: "#d94f71" },
  "/possessiveness-diagnosis": { kind: "possessiveness", slug: "possessiveness-diagnosis", title: "束縛度診断", description: "恋愛で相手の行動を把握したい気持ちや不安の傾向を20の質問からチェックします。", theme: "#6a5db5" },
  "/love-dependency-diagnosis": { kind: "loveDependency", slug: "love-dependency-diagnosis", title: "恋愛依存診断", description: "恋愛と自分の生活のバランスを20の質問からチェックします。", theme: "#c94e91" },
  "/career-diagnosis": { kind: "career", slug: "career-diagnosis", title: "適職診断", description: "仕事で発揮しやすい強みから、向いている仕事の方向性を20の質問で診断します。", theme: "#238a68" },
  "/manager-aptitude-diagnosis": { kind: "manager", slug: "manager-aptitude-diagnosis", title: "管理職適性診断", description: "チームを率いるための対話力・判断力・育成力の傾向を20の質問でチェックします。", theme: "#3569a8" },
  "/entrepreneur-aptitude-diagnosis": { kind: "entrepreneur", slug: "entrepreneur-aptitude-diagnosis", title: "起業家適性診断", description: "行動力・不確実性への強さ・事業を形にする力を20の質問でチェックします。", theme: "#d27822" },
  "/job-change-readiness-diagnosis": { kind: "jobChange", slug: "job-change-readiness-diagnosis", title: "転職適性診断", description: "転職理由やキャリアの準備状況から、今の転職適性を20の質問でチェックします。", theme: "#67727d" }
};

Object.entries(DIAGNOSIS_PAGES).forEach(([route, page]) => {
  app.get([route, `${route}.html`], (_req, res) => {
    const html = fs.readFileSync(path.join(__dirname, "public", "diagnosis.html"), "utf8")
      .replaceAll("{{KIND}}", page.kind)
      .replaceAll("{{SLUG}}", page.slug)
      .replaceAll("{{TITLE}}", page.title)
      .replaceAll("{{DESCRIPTION}}", page.description)
      .replaceAll("{{THEME}}", page.theme);
    res.send(injectAdSenseHeadScript(html));
  });
});
app.get("/diagnosis.html", (_req, res) => res.redirect(302, "/"));

const SITEMAP_STATIC_PAGES = [
  "/",
  "/mbti.html",
  ...Object.keys(DIAGNOSIS_PAGES)
];

app.get("/sitemap.xml", (_req, res) => {
  try {
    let sitemap = fs.readFileSync(path.join(__dirname, "public", "sitemap.xml"), "utf8");
    const missingPages = SITEMAP_STATIC_PAGES.filter(page => !sitemap.includes(`<loc>https://minnano-question.com${page}</loc>`));
    const entries = missingPages.map(page => `<url><loc>https://minnano-question.com${page}</loc><changefreq>weekly</changefreq><priority>${page === "/" ? "1.0" : "0.8"}</priority></url>`).join("");
    sitemap = sitemap.replace("</urlset>", `${entries}</urlset>`);
    res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(sitemap);
  } catch (error) {
    console.error("Sitemap load failed:", error);
    res.status(500).type("text/plain").send("Sitemap unavailable");
  }
});

// ==========================================
// 2. 新しい詳細ページ（/question）へのアクセスを正しく処理する設定
// ==========================================
app.get("/question", async (req, res) => {
  try {
    const id = String(req.query.id || "");

    // idが無ければ通常のHTMLを返す
    if (!id) {
      return res.redirect(302, "/");
    }

    // 一覧・詳細で取得済みなら再利用し、ページ遷移時のFirestore重複読込を避ける
    const cachedDetail = DETAIL_CACHE.get(id);
    let q = cachedDetail && Date.now() - cachedDetail.timestamp < DETAIL_CACHE_TTL
      ? cachedDetail.data
      : listCache.data?.find(question => String(question.id) === id);

    if (!q) {
      const doc = await firestore.collection(Q_COLL).doc(id).get();
      if (!doc.exists) {
        return res.status(404).sendFile(path.join(__dirname, "public", "question.html"));
      }
      q = doc.data();
    }

    // question.htmlを読み込む
    let html = fs.readFileSync(
      path.join(__dirname, "public", "question.html"),
      "utf8"
    );
    html = injectAdSenseHeadScript(html);

    const title = decodeStoredText(q.title);
    const description = decodeStoredText(q.description || q.title).slice(0, 160);
    const safeTitle = escapeSeoHTML(title);
    const safeDescription = escapeSeoHTML(description);

    html = html.replace(/<title>[^<]*<\/title>/, `<title>${safeTitle} | みんQ</title>`);

    // description・canonical・OG情報を書き換える
    const canonicalUrl = `https://minnano-question.com/question?id=${encodeURIComponent(id)}`;
    html = html.replace(
      /<meta id="metaDescription" name="description" content="[^"]*">/,
      `<meta id="metaDescription" name="description" content="${safeDescription}">`
    );
    html = html.replace('<link rel="canonical" id="canonical" href="">', `<link rel="canonical" id="canonical" href="${canonicalUrl}">`);
    html = html.replace(/<meta property="og:title" id="ogTitle" content="[^"]*">/, `<meta property="og:title" id="ogTitle" content="${safeTitle} | みんQ">`);
    html = html.replace(/<meta property="og:description" id="ogDescription" content="[^"]*">/, `<meta property="og:description" id="ogDescription" content="${safeDescription}">`);
    html = html.replace(/<meta property="og:url" id="ogUrl" content="[^"]*">/, `<meta property="og:url" id="ogUrl" content="${canonicalUrl}">`);

    const optionItems = (Array.isArray(q.options) ? q.options : []).map(option => {
      const optionValue = typeof option === "string" ? option : option?.text || "";
      return `<li>${escapeSeoHTML(optionValue)}</li>`;
    }).join("");
    const initialContent = `
      <section class="detailCard seo-question-content">
        <h1 class="createTitle">${safeTitle}</h1>
        ${description && description !== title ? `<p>${safeDescription}</p>` : ""}
        ${optionItems ? `<h2>回答の選択肢</h2><ul>${optionItems}</ul>` : ""}
      </section>`;
    html = html.replace(
      /<main class="layout" id="questionArea">[\s\S]*?<\/main>/,
      `<main class="layout" id="questionArea">${initialContent}</main>`
    );

    res.send(html);

  } catch (err) {
    console.error(err);
    res.status(500).sendFile(path.join(__dirname, "public", "question.html"));
  }
});

// 静的ファイルの設定（※必ず上記2つのルーティングの下に配置）
app.use(express.static("public", {
  extensions: ["html"],
  etag: true,
  setHeaders: (res, filePath) => {
    if (/\.(css|js)$/i.test(filePath)) res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
    else if (/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(filePath)) res.setHeader("Cache-Control", "public, max-age=86400");
    else res.setHeader("Cache-Control", "no-cache");
  }
}));

// ===== 定数・環境設定 =====
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "march25kk";
const PORT = Number(process.env.PORT || 3000);
const CONTACT_EMAIL = "march25kk@gmail.com";
const GMAIL_USER = String(process.env.GMAIL_USER || CONTACT_EMAIL).trim();
const GMAIL_APP_PASSWORD = String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

const UNANSWERED = "回答しない";
const AGE_GROUPS = ["10代", "20代", "30代", "40代", "50代", "60代以上"];
const LEGACY_AGE_GROUPS = ["10莉｣", "20莉｣", "30莉｣", "40莉｣", "50莉｣", "60莉｣莉･荳・"];
const SENIOR_AGE_ALIASES = ["60代以上", "60代", "70代以上", "60莉｣莉･荳・", "60莉｣", "70莉｣莉･荳・"];
const normalizeAge = age => SENIOR_AGE_ALIASES.includes(age) ? "60代以上" : age;
const GENDER_ALIASES = {
  male: ["男性", "逕ｷ諤ｧ"],
  female: ["女性", "螂ｳ諤ｧ"]
};
const NG_WORDS = ["死", "殺す", "殺せ", "殺され", "バカ", "アホ", "マンコ", "チンコ", "まんこ", "ちんこ", "セックス"];

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.FIREBASE_SERVICE_ACCOUNT;
const Q_COLL = IS_PRODUCTION ? 'questions' : 'questions_dev';
const V_COLL = IS_PRODUCTION ? 'votes' : 'votes_dev';
const C_COLL = IS_PRODUCTION ? 'comments' : 'comments_dev';
const R_COLL = IS_PRODUCTION ? 'reportsLog' : 'reportsLog_dev';
const MBTI_COLL = IS_PRODUCTION ? 'mbtiResults' : 'mbtiResults_dev';
const DIAGNOSIS_COLL = IS_PRODUCTION ? 'diagnosisResults' : 'diagnosisResults_dev';

// ===== キャッシュ・メモリ管理 =====
const CACHE_STATS = new Map();
const DETAIL_CACHE = new Map();
const CACHE_TTL = 30000;
const DETAIL_CACHE_TTL = 10000;
const LIST_CACHE_TTL = 15000;
let listCache = { data: null, timestamp: 0 };
const COMMENTS_LIMIT = 100;
const VOTES_STATS_LIMIT = 5000;
const MBTI_TYPES = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"];
const DIAGNOSIS_TYPES = {
  love: ["security", "passion", "independent", "devotion"],
  hsp: ["low", "mild", "high", "veryHigh"],
  stress: ["care", "sensitive", "balanced", "resilient"],
  selfEsteem: ["low", "mild", "high", "veryHigh"],
  communication: ["low", "mild", "high", "veryHigh"],
  approval: ["low", "mild", "high", "veryHigh"],
  adhd: ["low", "mild", "high", "veryHigh"],
  asd: ["low", "mild", "high", "veryHigh"],
  cheatingRisk: ["low", "mild", "high", "veryHigh"],
  possessiveness: ["low", "mild", "high", "veryHigh"],
  loveDependency: ["low", "mild", "high", "veryHigh"],
  career: ["creator", "supporter", "analyst", "leader"],
  manager: ["low", "mild", "high", "veryHigh"],
  entrepreneur: ["low", "mild", "high", "veryHigh"],
  jobChange: ["low", "mild", "high", "veryHigh"]
};

const questionCooldown = {};
const commentCooldown = {};
const actionAttempts = new Map();
const recentSubmissions = new Map();

// ===== ユーティリティ関数 =====
const escapeHTML = (str = "") => String(str)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

const getIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  return Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.socket.remoteAddress).split(",")[0].trim();
};

const voteDocumentId = (questionId, voterId) => crypto
  .createHash("sha256")
  .update(`${String(questionId)}\u0000${String(voterId)}`)
  .digest("hex");

const getVoterId = (req, res) => {
  const cookieHeader = String(req.headers.cookie || "");
  const cookie = cookieHeader.split(";").map(value => value.trim()).find(value => value.startsWith("minq_voter="));
  const savedId = cookie ? decodeURIComponent(cookie.slice("minq_voter=".length)) : "";
  const voterId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(savedId)
    ? savedId
    : crypto.randomUUID();

  if (voterId !== savedId) {
    res.cookie("minq_voter", voterId, {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PRODUCTION,
      maxAge: 10 * 365 * 24 * 60 * 60 * 1000
    });
  }

  return voterId;
};

const nowJSTString = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19);

const sendError = (res, message, status = 200) => res.status(status).json({ error: true, message });

const allowAction = (ip, action, maxAttempts, windowMs) => {
  const key = `${action}:${ip}`;
  const cutoff = Date.now() - windowMs;
  const attempts = (actionAttempts.get(key) || []).filter(time => time > cutoff);
  if (attempts.length >= maxAttempts) return false;
  attempts.push(Date.now());
  actionAttempts.set(key, attempts);
  return true;
};

const submissionKey = (ip, type, content) => {
  const normalized = String(content).replace(/\s+/g, " ").trim().toLowerCase();
  return `${type}:${ip}:${normalized}`;
};

const isDuplicateSubmission = (ip, type, content, windowMs = 10 * 60 * 1000) => {
  const key = submissionKey(ip, type, content);
  const previous = recentSubmissions.get(key) || 0;
  return Date.now() - previous < windowMs;
};

const rememberSubmission = (ip, type, content) => {
  recentSubmissions.set(submissionKey(ip, type, content), Date.now());
};

// 定期クリーンアップ
setInterval(() => {
  const now = Date.now();
  
  Object.keys(questionCooldown).forEach(ip => {
    if (now - questionCooldown[ip] > 60000) delete questionCooldown[ip];
  });

  Object.keys(commentCooldown).forEach(ip => {
    if (now - commentCooldown[ip] > 60000) delete commentCooldown[ip];
  });

  for (const [key, attempts] of actionAttempts.entries()) {
    const active = attempts.filter(time => now - time < 10 * 60 * 1000);
    if (active.length) actionAttempts.set(key, active);
    else actionAttempts.delete(key);
  }

  for (const [key, time] of recentSubmissions.entries()) {
    if (now - time > 10 * 60 * 1000) recentSubmissions.delete(key);
  }

  for (const [key, val] of CACHE_STATS.entries()) {
    if (now - val.timestamp > CACHE_TTL) CACHE_STATS.delete(key);
  }
  for (const [key, val] of DETAIL_CACHE.entries()) {
    if (now - val.timestamp > DETAIL_CACHE_TTL) DETAIL_CACHE.delete(key);
  }
}, CACHE_TTL);

// キャッシュアクセサ
const getCachedStats = (qId) => {
  const cached = CACHE_STATS.get(qId);
  return cached && Date.now() - cached.timestamp < CACHE_TTL ? cached.data : null;
};
const setCachedStats = (qId, data) => CACHE_STATS.set(qId, { data, timestamp: Date.now() });
const invalidateListCache = () => { listCache = { data: null, timestamp: 0 }; };

let contactTransporter = null;
const getContactTransporter = () => {
  if (!GMAIL_APP_PASSWORD) return null;
  if (!contactTransporter) {
    contactTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
      }
    });
  }
  return contactTransporter;
};

app.post("/contact", async (req, res) => {
  const name = String(req.body?.name || "").trim().replace(/[\r\n]+/g, " ").slice(0, 80);
  const email = String(req.body?.email || "").trim().slice(0, 254);
  const message = String(req.body?.message || "").trim().slice(0, 4000);
  const website = String(req.body?.website || "").trim();

  // 非表示項目へ入力する単純なボットには、送信したように見せてメールを送らない。
  if (website) return res.json({ ok: true, message: "お問い合わせを送信しました。" });
  if (!name) return sendError(res, "お名前を入力してください。", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendError(res, "有効なメールアドレスを入力してください。", 400);
  }
  if (message.length < 10) return sendError(res, "お問い合わせ内容を10文字以上で入力してください。", 400);

  const ip = getIp(req);
  if (!allowAction(ip, "contact", 5, 60 * 60 * 1000)) {
    return sendError(res, "送信回数が多すぎます。時間をおいてから再度お試しください。", 429);
  }

  const transporter = getContactTransporter();
  if (!transporter) {
    return sendError(res, "現在メール送信の準備中です。時間をおいてから再度お試しください。", 503);
  }

  try {
    await transporter.sendMail({
      from: `みんQお問い合わせ <${GMAIL_USER}>`,
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `【みんQ】お問い合わせ：${name}`,
      text: [
        "みんQのお問い合わせフォームから送信されました。",
        "",
        `お名前: ${name}`,
        `メールアドレス: ${email}`,
        `送信日時: ${nowJSTString()} JST`,
        "",
        "お問い合わせ内容:",
        message
      ].join("\n")
    });
    res.json({ ok: true, message: "お問い合わせを送信しました。" });
  } catch (error) {
    console.error("Contact email send failed:", error.message);
    sendError(res, "送信に失敗しました。時間をおいてから再度お試しください。", 502);
  }
});

const getAllQuestions = async ({ fresh = false } = {}) => {
  if (!fresh && listCache.data && Date.now() - listCache.timestamp < LIST_CACHE_TTL) return listCache.data;
  const snapshot = await firestore.collection(Q_COLL).get();
  const questions = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      commentCount: Number(data.commentCount || 0),
      totalVotes: Number(data.totalVotes || 0),
      views: Number(data.views || 0),
      updatedAt: data.updatedAt || data.createdAt || ""
    };
  });
  listCache = { data: questions, timestamp: Date.now() };
  return questions;
};

// ===== 統計計算・データ正規化 =====
const toSortableTime = value => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();

  const seconds = Number(value.seconds ?? value._seconds);
  if (Number.isFinite(seconds)) {
    const nanoseconds = Number(value.nanoseconds ?? value._nanoseconds) || 0;
    return seconds * 1000 + nanoseconds / 1e6;
  }

  const parsed = Date.parse(String(value).replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : 0;
};

const compareQuestionUpdatedAt = (a, b) => {
  const aUpdatedAt = toSortableTime(a.updatedAt || a.createdAt);
  const bUpdatedAt = toSortableTime(b.updatedAt || b.createdAt);
  return bUpdatedAt - aUpdatedAt || String(b.id || "").localeCompare(String(a.id || ""));
};

const calculatePercentages = counts => {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return counts.map(() => 0);

  const exact = counts.map(count => (count * 100) / total);
  const percentages = exact.map(Math.floor);
  let remainder = 100 - percentages.reduce((sum, percent) => sum + percent, 0);

  exact
    .map((value, index) => ({ index, fraction: value - percentages[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .slice(0, remainder)
    .forEach(({ index }) => { percentages[index] += 1; });

  return percentages;
};

const calculateStats = (votes, options = []) => {
  const allVotesCount = votes.length;
  const optionCounts = options.map(() => 0);
  const maleCounts = options.map(() => 0);
  const femaleCounts = options.map(() => 0);
  const ageCounts = options.map(() => Object.fromEntries(AGE_GROUPS.map(age => [age, 0])));

  votes.forEach(vote => {
    const index = Number(vote?.optionIndex);
    if (!Number.isInteger(index) || index < 0 || index >= options.length) return;
    optionCounts[index] += 1;
    if (GENDER_ALIASES.male.includes(vote.gender)) maleCounts[index] += 1;
    if (GENDER_ALIASES.female.includes(vote.gender)) femaleCounts[index] += 1;
    if (vote.age && vote.age !== "回答しない" && vote.age !== "未回答") {
      const normalizedAge = normalizeAge(vote.age);
      const ageIndex = LEGACY_AGE_GROUPS.indexOf(vote.age);
      const resolvedAge = ageIndex >= 0 ? AGE_GROUPS[ageIndex] : normalizedAge;
      if (ageCounts[index][resolvedAge] !== undefined) ageCounts[index][resolvedAge] += 1;
    }
  });

  const malePercentages = calculatePercentages(maleCounts);
  const femalePercentages = calculatePercentages(femaleCounts);
  const agePercentages = Object.fromEntries(AGE_GROUPS.map(age => [
    age,
    calculatePercentages(ageCounts.map(row => row[age]))
  ]));

  const genderStats = options.map((option, index) => {
    return {
      option,
      male: malePercentages[index],
      female: femalePercentages[index],
      rawPercent: allVotesCount > 0 ? Math.round((optionCounts[index] * 100) / allVotesCount) : 0
    };
  });

  const ageStats = options.map((option, index) => {
    const row = { option };
    AGE_GROUPS.forEach(age => {
      row[age] = agePercentages[age][index];
    });
    return row;
  });

  return { genderStats, ageStats };
};

const normalizeQuestionData = (data) => ({
  commentCount: Math.max(0, Number(data.commentCount) || 0),
  totalVotes: Math.max(0, Number(data.totalVotes) || 0),
  views: Math.max(0, Number(data.views) || 0),
  reports: Math.max(0, Number(data.reports) || 0)
});

// -----------------------------------------------------------------------------
// ルーティング
// -----------------------------------------------------------------------------

// 1. 質問一覧取得
app.get("/questions", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = 30;
    const keyword = String(req.query.search || "");
    const tag = String(req.query.tag || "");
    const sort = String(req.query.sort || "update");

    let query = firestore.collection(Q_COLL);
    const isFiltered = keyword || tag;

    // 💡 変更：Firestore側での orderBy("updatedAt") を撤廃し、過去データ（updatedAtなし）の除外を防ぐ
    if (!isFiltered && sort !== "update") {
      const sortFields = { 
        new: "createdAt", 
        view: "views", 
        vote: "totalVotes" 
      };
      const orderField = sortFields[sort] || "createdAt";
      query = query.orderBy(orderField, "desc");
      
      // 通常の一覧（新着・閲覧・回答順）の時はFirestore側で制限して高速化
      if (page > 1) query = query.offset((page - 1) * limit);
      query = query.limit(limit);
    }

    let questions;
    if (sort === "update" || isFiltered) {
      questions = (await getAllQuestions({ fresh: sort === "update" })).slice();
    } else {
      const snapshot = await query.get();
      questions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          commentCount: Number(data.commentCount || 0),
          totalVotes: Number(data.totalVotes || 0),
          views: Number(data.views || 0),
          updatedAt: data.updatedAt || data.createdAt || ""
        };
      });
    }

    questions = questions.filter(q => (q.reports || 0) < 5);

    if (tag) {
      questions = questions.filter(q => q.tags?.includes(tag));
    }

    if (keyword) {
      questions = questions.filter(q => q.title.includes(keyword));
    }

    // 💡 「更新順（update）」の並び替え、またはキーワード・タグ絞り込みがある場合はサーバー側でソート
    if (sort === "update" || isFiltered) {
      if (sort === "view") {
        questions.sort((a, b) => (b.views || 0) - (a.views || 0));
      } else if (sort === "vote") {
        questions.sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0));
      } else if (sort === "new") {
        questions.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      } else {
        // 💡 更新順ソート（updatedAtがない過去データもcreatedAtで安全に比較される）
        questions.sort(compareQuestionUpdatedAt);
      }

      const totalCount = questions.length;
      const totalPages = Math.ceil(totalCount / limit) || 1;
      const paginatedQuestions = questions.slice((page - 1) * limit, page * limit);

      return res.json({
        questions: paginatedQuestions,
        totalPages,
        currentPage: page
      });
    }

    // 通常時（絞り込みなし・更新順以外）の件数返却
    const countSnapshot = await firestore.collection(Q_COLL).count().get();
    const totalCount = Number(countSnapshot.data().count || 0);
    res.json({
      questions,
      totalPages: Math.ceil(totalCount / limit) || 1,
      currentPage: page
    });
  } catch (error) {
    console.error("Firestore error:", error);
    sendError(res, "データの取得に失敗しました", 500);
  }
});

// 2. 質問投稿
app.post("/questions", async (req, res) => {
  try {
    let { title, options, tags } = req.body;
    const description = String(req.body.description || "").trim();
    title = String(title || "").trim();

    if (!title || !options || !Array.isArray(options) || options.length < 2) {
      return sendError(res, "タイトルと2つ以上の選択肢が必要です");
    }
    if (title.length > 120) return sendError(res, "タイトルは120文字以内で入力してください");
    if (description.length > 1000) return sendError(res, "説明は1000文字以内で入力してください");
    if (options.length > 10 || options.some(option => String(option).trim().length > 200)) {
      return sendError(res, "選択肢は10件以内・各200文字以内で入力してください");
    }

    const hasNgWord = NG_WORDS.some(word => 
      title.includes(word) || description.includes(word) || options.some(o => String(o).includes(word))
    );
    if (hasNgWord) return sendError(res, "使用できない言葉が含まれています");

    const ip = getIp(req);
    const now = Date.now();

    if (!allowAction(ip, "question", 3, 10 * 60 * 1000)) {
      return sendError(res, "投稿回数が多すぎます。しばらく待ってからお試しください", 429);
    }
    if (isDuplicateSubmission(ip, "question", `${title}|${description}|${options.join("|")}`)) {
      return sendError(res, "同じ内容の質問は続けて投稿できません");
    }
    
    if (questionCooldown[ip] && now - questionCooldown[ip] < 60000) {
      return sendError(res, "連続投稿は60秒待ってください");
    }
    questionCooldown[ip] = now;

    const timeStr = nowJSTString();
    const newQuestion = {
      title: escapeHTML(title),
      description: escapeHTML(description),
      options: options.map(o => escapeHTML(String(o).trim())),
      tags: Array.isArray(tags) ? tags.map(t => escapeHTML(String(t).trim())) : [],
      createdAt: timeStr,
      updatedAt: timeStr,
      views: 0,
      totalVotes: 0,
      commentCount: 0,
      reports: 0,
      ip
    };

    const docRef = await firestore.collection(Q_COLL).add(newQuestion);
    invalidateListCache();
    rememberSubmission(ip, "question", `${title}|${description}|${options.join("|")}`);
    try {
      if (typeof updateSitemap === 'function') updateSitemap({ id: docRef.id, ...newQuestion });
    } catch (e) {
      console.error("Sitemap update skipped:", e);
    }

    res.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error("Question Save Error:", error);
    sendError(res, "アンケートの作成に失敗しました", 500);
  }
});

// 3. 質問詳細取得
app.get("/questions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const cachedDetail = DETAIL_CACHE.get(id);
    if (cachedDetail && Date.now() - cachedDetail.timestamp < DETAIL_CACHE_TTL) {
      res.set("Cache-Control", "no-cache");
      return res.json(cachedDetail.data);
    }
    const doc = await firestore.collection(Q_COLL).doc(id).get();
    if (!doc.exists) return sendError(res, "アンケートが見つかりません");

    const q = { id: doc.id, ...doc.data() };
    Object.assign(q, normalizeQuestionData(q));

    let statsData = getCachedStats(id);
    const [commentsSnapshot, votesSnapshot] = await Promise.all([
      firestore.collection(C_COLL).where("questionId", "==", id).orderBy("createdAt", "asc").limit(COMMENTS_LIMIT).get(),
      statsData ? Promise.resolve(null) : firestore.collection(V_COLL).where("questionId", "==", id).limit(VOTES_STATS_LIMIT).get()
    ]);
    q.comments = commentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!statsData) {
      statsData = calculateStats(votesSnapshot.docs.map(d => d.data()), q.options);
      setCachedStats(id, statsData);
    }

    const detailData = { ...q, ...statsData };
    DETAIL_CACHE.set(id, { data: detailData, timestamp: Date.now() });
    res.set("Cache-Control", "no-cache");
    res.json(detailData);
  } catch (error) {
    console.error("Firestore error:", error);
    sendError(res, "データの取得に失敗しました", 500);
  }
});

// 4. 閲覧数インクリメント
app.post("/view", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return sendError(res, "IDがありません", 400);
    
    await firestore.collection(Q_COLL).doc(String(id)).update({ views: FieldValue.increment(1) });
    res.json({ success: true });
  } catch (error) {
    console.error("View Count Error:", error);
    res.status(500).json({ error: true });
  }
});

// 5. 同じブラウザからの重複投票を確認する
app.get("/check-vote/:id", async (req, res) => {
  try {
    const questionId = String(req.params.id);
    const voterId = getVoterId(req, res);
    const voteDoc = await firestore.collection(V_COLL).doc(voteDocumentId(questionId, voterId)).get();
    res.json({ voted: voteDoc.exists });
  } catch (error) {
    console.error("====== 投票チェックエラー ======", error);
    res.status(500).json({ error: true, voted: false });
  }
});

// 6. 投票処理（フラグ完全判別・二重投票ブロック版）
const handleVote = async (req, res) => {
  const id = String(req.params.id || req.body.id);
  const { index, age, gender } = req.body;
  if (id == null || index == null) return sendError(res, "不完全なデータです", 400);

  const ip = getIp(req);
  const voterId = getVoterId(req, res);
  if (!allowAction(ip, "vote", 20, 10 * 60 * 1000)) {
    return sendError(res, "短時間の投票回数が多すぎます。しばらく待ってからお試しください", 429);
  }
  const selectedAge = normalizeAge(age || UNANSWERED);
  const selectedGender = gender || UNANSWERED;

  try {
    const questionRef = firestore.collection(Q_COLL).doc(id);
    const voteLogRef = firestore.collection(V_COLL).doc(voteDocumentId(id, voterId));
    const didVote = await firestore.runTransaction(async (transaction) => {
      let sfDoc = await transaction.get(questionRef);
      let targetRef = questionRef;
      
      if (!sfDoc.exists && !isNaN(id)) {
        targetRef = firestore.collection(Q_COLL).doc(String(Number(id)));
        sfDoc = await transaction.get(targetRef);
      }
      
      if (!sfDoc.exists) throw new Error("Document does not exist!");

      const existingVote = await transaction.get(voteLogRef);
      if (existingVote.exists) return false;

      const data = sfDoc.data();
      const counts = data.counts || {};
      
      // 既存の投票数やコメントデータはそのまま残して上乗せする
      counts[`age_${selectedAge}`] = (counts[`age_${selectedAge}`] || 0) + 1;
      counts[`gender_${selectedGender}`] = (counts[`gender_${selectedGender}`] || 0) + 1;
      counts[`option_${index}`] = (counts[`option_${index}`] || 0) + 1;

      transaction.update(targetRef, { 
        totalVotes: (data.totalVotes || 0) + 1, 
        counts,
        updatedAt: nowJSTString()
      });

      transaction.set(voteLogRef, {
        questionId: id, 
        optionIndex: Number(index), 
        age: selectedAge, 
        gender: selectedGender, 
        ip: ip, 
        voterId: voterId,
        status: "reset2026", // 💡 これから投票するログにはこの目印を付け、2回目をブロックします
        createdAt: new Date().toISOString()
      });

      return true;
    });

    if (!didVote) return res.json({ success: true, alreadyVoted: true });

    CACHE_STATS.delete(id);
    DETAIL_CACHE.delete(id);
    invalidateListCache();
    res.json({ success: true });
  } catch (err) {
    console.error("Vote error:", err);
    sendError(res, "投票の処理に失敗しました", 500);
  }
};
app.post(["/vote", "/questions/:id/vote"], handleVote);

// 7. 統計データ取得
app.get("/stats/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let cached = getCachedStats(id);

    if (cached) {
      const ageStats = [];
      const genderStats = [];
      cached.ageStats.forEach((ageRow, optIdx) => {
        AGE_GROUPS.filter(a => a !== "回答しない").forEach(age => {
          if (ageRow[age]) ageStats.push({ age, optionIndex: optIdx, votes: ageRow[age] });
        });
      });
      cached.genderStats.forEach((genderRow, optIdx) => {
        genderStats.push({ gender: "male", optionIndex: optIdx, votes: genderRow.male }, { gender: "female", optionIndex: optIdx, votes: genderRow.female });
      });
      return res.json({ ageStats, genderStats });
    }

    const votesSnapshot = await firestore.collection(V_COLL).where("questionId", "==", id).limit(VOTES_STATS_LIMIT).get();
    const ageStats = {}, genderStats = {};

    votesSnapshot.forEach(doc => {
      const d = doc.data();
      const ageKey = `${normalizeAge(d.age || UNANSWERED)}_${d.optionIndex}`;
      const genKey = `${d.gender || UNANSWERED}_${d.optionIndex}`;
      ageStats[ageKey] = (ageStats[ageKey] || 0) + 1;
      genderStats[genKey] = (genderStats[genKey] || 0) + 1;
    });

    res.json({
      ageStats: Object.keys(ageStats).map(k => ({ age: k.split("_")[0], optionIndex: Number(k.split("_")[1]), votes: ageStats[k] })),
      genderStats: Object.keys(genderStats).map(k => ({ gender: k.split("_")[0], optionIndex: Number(k.split("_")[1]), votes: genderStats[k] }))
    });
  } catch (error) {
    console.error("Get Stats Error:", error);
    sendError(res, "統計の取得に失敗しました", 500);
  }
});

// 8. コメント投稿
const saveComment = async (req, res) => {
  try {
    const id = req.params.id || req.body.id;
    let { text, name, age, gender } = req.body;
    text = String(text || "").trim();
    name = String(name || "").trim();

    if (!text) return sendError(res, "コメントを入力してください");
    if (text.length > 1000) return sendError(res, "コメントは1000文字以内で入力してください");
    if (name.length > 30) return sendError(res, "名前は30文字以内で入力してください");
    if (NG_WORDS.some(word => text.includes(word))) return sendError(res, "使用できない言葉が含まれています");
    if (name && NG_WORDS.some(word => name.includes(word))) return sendError(res, "名前に使用できない言葉が含まれています");

    const ip = getIp(req);
    const now = Date.now();

    if (!allowAction(ip, "comment", 5, 10 * 60 * 1000)) {
      return sendError(res, "コメントの投稿回数が多すぎます。しばらく待ってからお試しください", 429);
    }
    if (isDuplicateSubmission(ip, "comment", `${id}|${text}`)) {
      return sendError(res, "同じ内容のコメントは続けて投稿できません");
    }
    
    if (commentCooldown[ip] && now - commentCooldown[ip] < 15000) {
      return sendError(res, "15秒待ってから投稿してください");
    }
    commentCooldown[ip] = now;

    const timeStr = nowJSTString();
    await firestore.collection(C_COLL).add({
      questionId: String(id), text: escapeHTML(text), name: name ? escapeHTML(name) : "", age: age || UNANSWERED, gender: gender || UNANSWERED, createdAt: timeStr, ip
    });
    rememberSubmission(ip, "comment", `${id}|${text}`);
    
    await firestore.collection(Q_COLL).doc(String(id)).update({ 
      commentCount: FieldValue.increment(1),
      updatedAt: timeStr
    });
    DETAIL_CACHE.delete(String(id));
    invalidateListCache();

    res.json({
      success: true,
      comment: {
        text,
        name,
        createdAt: timeStr
      }
    });
  } catch (error) {
    console.error("Comment Save Error:", error);
    sendError(res, "コメントの投稿に失敗しました", 500);
  }
};
app.post(["/comment", "/questions/:id/comment"], saveComment);

// 性格診断の回答保存と、全体・属性別のタイプ割合
app.post("/mbti/result", async (req, res) => {
  const type = String(req.body?.type || "").toUpperCase();
  const gender = String(req.body?.gender || UNANSWERED);
  const age = normalizeAge(String(req.body?.age || UNANSWERED));
  const validGender = [...GENDER_ALIASES.male, ...GENDER_ALIASES.female, UNANSWERED].includes(gender);
  const validAge = [...AGE_GROUPS, UNANSWERED].includes(age);

  if (!MBTI_TYPES.includes(type) || !validGender || !validAge) {
    return sendError(res, "診断結果を保存できませんでした", 400);
  }

  try {
    await firestore.collection(MBTI_COLL).add({ type, gender, age, createdAt: new Date() });
    res.json({ success: true });
  } catch (error) {
    console.error("MBTI result save failed:", error);
    sendError(res, "診断結果を保存できませんでした", 500);
  }
});

app.get("/mbti/stats", async (_req, res) => {
  try {
    const snapshot = await firestore.collection(MBTI_COLL).limit(VOTES_STATS_LIMIT).get();
    const rows = snapshot.docs.map(doc => doc.data()).filter(row => MBTI_TYPES.includes(row.type));
    const distribution = filteredRows => {
      const counts = MBTI_TYPES.map(type => filteredRows.filter(row => row.type === type).length);
      const percentages = calculatePercentages(counts);
      return MBTI_TYPES.map((type, index) => ({ type, votes: counts[index], percent: percentages[index] }));
    };

    res.set("Cache-Control", "no-store").json({
      total: rows.length,
      overall: distribution(rows),
      genders: {
        male: distribution(rows.filter(row => GENDER_ALIASES.male.includes(row.gender))),
        female: distribution(rows.filter(row => GENDER_ALIASES.female.includes(row.gender)))
      },
      ages: Object.fromEntries(AGE_GROUPS.map(age => [age, distribution(rows.filter(row => normalizeAge(row.age) === age))]))
    });
  } catch (error) {
    console.error("MBTI stats load failed:", error);
    sendError(res, "診断結果の統計を取得できませんでした", 500);
  }
});

app.post("/diagnosis/result", async (req, res) => {
  const kind = String(req.body?.kind || "");
  const type = String(req.body?.type || "");
  const gender = String(req.body?.gender || UNANSWERED);
  const age = normalizeAge(String(req.body?.age || UNANSWERED));
  const validGender = [...GENDER_ALIASES.male, ...GENDER_ALIASES.female, UNANSWERED].includes(gender);
  const validAge = [...AGE_GROUPS, UNANSWERED].includes(age);

  if (!DIAGNOSIS_TYPES[kind]?.includes(type) || !validGender || !validAge) {
    return sendError(res, "診断結果を保存できませんでした", 400);
  }

  try {
    await firestore.collection(DIAGNOSIS_COLL).add({ kind, type, gender, age, createdAt: new Date() });
    res.json({ success: true });
  } catch (error) {
    console.error("Diagnosis result save failed:", error);
    sendError(res, "診断結果を保存できませんでした", 500);
  }
});

app.get("/diagnosis/stats/:kind", async (req, res) => {
  const kind = String(req.params.kind || "");
  const types = DIAGNOSIS_TYPES[kind];
  if (!types) return sendError(res, "診断が見つかりません", 404);

  try {
    const snapshot = await firestore.collection(DIAGNOSIS_COLL).limit(VOTES_STATS_LIMIT).get();
    const rows = snapshot.docs.map(doc => doc.data()).filter(row => row.kind === kind && types.includes(row.type));
    const distribution = filteredRows => {
      const counts = types.map(type => filteredRows.filter(row => row.type === type).length);
      const percentages = calculatePercentages(counts);
      return types.map((type, index) => ({ type, votes: counts[index], percent: percentages[index] }));
    };

    res.set("Cache-Control", "no-store").json({
      total: rows.length,
      overall: distribution(rows),
      genders: {
        male: distribution(rows.filter(row => GENDER_ALIASES.male.includes(row.gender))),
        female: distribution(rows.filter(row => GENDER_ALIASES.female.includes(row.gender)))
      },
      ages: Object.fromEntries(AGE_GROUPS.map(age => [age, distribution(rows.filter(row => normalizeAge(row.age) === age))]))
    });
  } catch (error) {
    console.error("Diagnosis stats load failed:", error);
    sendError(res, "診断結果の統計を取得できませんでした", 500);
  }
});

// 9. 通報処理
app.post("/report", async (req, res) => {
  const { id } = req.body;
  if (!id) return sendError(res, "不正なリクエストです", 400);
  const ip = getIp(req);

  try {
    const reportLogRef = firestore.collection(R_COLL);
    await firestore.runTransaction(async (transaction) => {
      const alreadySnapshot = await reportLogRef.where("questionId", "==", String(id)).where("ip", "==", ip).limit(1).get();
      if (!alreadySnapshot.empty) throw new Error("ALREADY_REPORTED");

      transaction.set(reportLogRef.doc(), { questionId: String(id), ip, createdAt: new Date() });
      transaction.update(firestore.collection(Q_COLL).doc(String(id)), { reports: FieldValue.increment(1) });
    });

    CACHE_STATS.delete(id);
    DETAIL_CACHE.delete(String(id));
    invalidateListCache();
    res.json({ success: true });
  } catch (error) {
    if (error.message === "ALREADY_REPORTED") return sendError(res, "通報済みです");
    sendError(res, "通報に失敗しました", 500);
  }
});

// 10. 管理者用：コメント削除
app.post("/admin/delete-comment", async (req, res) => {
  const { password, id } = req.body;
  if (password !== ADMIN_PASSWORD) return sendError(res, "管理パスワードが違います", 401);

  try {
    await firestore.collection(C_COLL).doc(String(id)).delete();
    DETAIL_CACHE.clear();
    res.json({ success: true });
  } catch (error) {
    sendError(res, "削除に失敗しました", 500);
  }
});

// 11. 管理者用：アンケートデータ一括削除
app.post("/admin/delete", async (req, res) => {
  const { password, id } = req.body;
  if (password !== ADMIN_PASSWORD) return sendError(res, "管理パスワードが違います", 401);

  try {
    const questionId = String(id);
    await firestore.collection(Q_COLL).doc(questionId).delete();
    invalidateListCache();

    for (const col of [C_COLL, V_COLL, R_COLL]) {
      const snapshot = await firestore.collection(col).where("questionId", "==", questionId).get();
      const batch = firestore.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    CACHE_STATS.delete(questionId);
    DETAIL_CACHE.delete(questionId);
    res.json({ success: true });
  } catch (error) {
    sendError(res, "削除に失敗しました", 500);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
