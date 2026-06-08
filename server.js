const NG_WORDS = [
  "死","殺す","殺せ","殺され","バカ","アホ","マンコ","チンコ","まんこ","ちんこ","セックス"
];

const express = require("express");
const Database = require("better-sqlite3");
const firestore = require("./firebase");

const { updateSitemap } = require('./generateSitemap');
const app = express();
const db = new Database("survey.db");
const questionCooldown = {};
const commentCooldown = {};
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "march25kk";
const PORT = Number(process.env.PORT || 3000);

const UNANSWERED = "回答しない";
const AGE_GROUPS = ["10代", "20代", "30代", "40代", "50代", "60代", "70代以上"];
const LEGACY_AGE_GROUPS = ["10莉｣", "20莉｣", "30莉｣", "40莉｣", "50莉｣", "60莉｣", "70莉｣莉･荳・"];
const GENDER_ALIASES = {
  male: ["男性", "逕ｷ諤ｧ"],
  female: ["女性", "螂ｳ諤ｧ"]
};

app.use(express.json());
app.use(express.static("public"));

function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const getIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  return Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.socket.remoteAddress).split(",")[0].trim();
};

const nowJSTString = () => new Date(Date.now() + 9 * 60 * 60 * 1000)
  .toISOString()
  .replace("T", " ")
  .substring(0, 19);

db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    category TEXT,
    tags TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    reports INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questionId INTEGER,
    text TEXT,
    votes INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questionId INTEGER,
    text TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questionId INTEGER,
    optionIndex INTEGER,
    age TEXT,
    gender TEXT,
    ip TEXT
  );

  CREATE TABLE IF NOT EXISTS reportsLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questionId INTEGER,
    ip TEXT
  );
`);

function attachQuestionData(q) {
  q.tags = JSON.parse(q.tags || "[]");
  q.options = db.prepare("SELECT * FROM options WHERE questionId = ?").all(q.id);
  q.comments = db.prepare("SELECT * FROM comments WHERE questionId = ?").all(q.id);

  if (!q.createdAt || String(q.createdAt).includes("-----")) {
    const fallbackDate = (!Number.isNaN(Number(q.id)) && Number(q.id) > 1000000000000)
      ? new Date(Number(q.id))
      : new Date(1778681461351);
    q.createdAt = fallbackDate.toISOString().replace("T", " ").substring(0, 19);
  } else {
    q.createdAt = String(q.createdAt).substring(0, 19);
  }

  return q;
}

app.get("/questions", async (req, res) => {

  const snapshot = await firestore
    .collection("questions")
    .get();

  console.log(
    "Firestore件数:",
    snapshot.docs.length
  );

  // 以下は今までのSQLiteコード
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = 30;
  const offset = (page - 1) * limit;
  const keyword = String(req.query.search || "");
  const tag = String(req.query.tag || "");
  const sort = String(req.query.sort || "new");

  let countQuery = "SELECT COUNT(*) as count FROM questions WHERE reports < 5 AND title LIKE ?";
  let countParams = [`%${keyword}%`];

  if (tag) {
    countQuery += " AND tags LIKE ?";
    countParams.push(`%${tag}%`);
  }

  const totalRow = db.prepare(countQuery).get(...countParams);
  const totalCount = totalRow ? totalRow.count : 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  let query = "SELECT * FROM questions WHERE reports < 5 AND title LIKE ?";
  let params = [`%${keyword}%`];

  if (tag) {
    query += " AND tags LIKE ?";
    params.push(`%${tag}%`);
  }

  if (sort === "view") {
    query += " ORDER BY views DESC LIMIT ? OFFSET ?";
  } else if (sort === "vote") {
    query += " ORDER BY (SELECT COALESCE(SUM(votes), 0) FROM options WHERE options.questionId = questions.id) DESC LIMIT ? OFFSET ?";
  } else {
    query += " ORDER BY id DESC LIMIT ? OFFSET ?";
  }
  params.push(limit, offset);

  const questions = db.prepare(query).all(...params).map(attachQuestionData);

  res.json({
    questions,
    totalPages,
    currentPage: page
  });
});

app.post("/questions", async (req, res) => {
  let { title, description, tags, options } = req.body;

  title = String(title || "").trim();
  description = String(description || "").trim();

  const ip = getIp(req);
  const now = Date.now();

 if (
      questionCooldown[ip] &&
      now - questionCooldown[ip] < 30000
    ) {
        return res.json({
         error: true,
         message: "30秒待ってから投稿してください"
        });
      }
  
 questionCooldown[ip] = now;

  const ngText = `${title} ${description}`;

  const hasNgWord = NG_WORDS.some(word =>
    ngText.includes(word)
  );

  if (hasNgWord) {
    return res.json({
      error: true,
      message: "使用できない言葉が含まれています"
    });
  }


  if (!title) return res.json({ error: true, message: "タイトルを入力してください" });
  if (!Array.isArray(options) || options.length < 2) {
    return res.json({ error: true, message: "選択肢は2つ以上必要です" });
  }

  const uniqueOptions = [...new Set(options.map(o => String(o || "").trim()).filter(Boolean))];
  if (uniqueOptions.length < 2) {
    return res.json({ error: true, message: "有効な選択肢を2つ以上入力してください" });
  }

  const cleanTags = Array.isArray(tags) ? tags.map(t => String(t || "").trim()).filter(Boolean) : [];

  const result = db.prepare("INSERT INTO questions (title, description, tags, createdAt) VALUES (?, ?, ?, ?)").run(
    escapeHTML(title),
    escapeHTML(description),
    JSON.stringify(cleanTags),
    nowJSTString()
  );

  await firestore.collection("questions").add({
    title: escapeHTML(title),
    description: escapeHTML(description),
    tags: cleanTags,
    options: uniqueOptions,
    comments: [],
    createdAt: nowJSTString(),
    views: 0,
    reports: 0
  });

  const questionId = result.lastInsertRowid;
  const insertOption = db.prepare("INSERT INTO options (questionId, text) VALUES (?, ?)");
  uniqueOptions.forEach(o => insertOption.run(questionId, escapeHTML(o)));

  // ★サイトマップを更新
  await updateSitemap();

  res.json({ success: true, id: questionId });
});

app.get("/questions/:id", (req, res) => {
  const id = req.params.id;
  const q = db.prepare("SELECT * FROM questions WHERE id = ?").get(id);
  if (!q) return res.json({ error: true, message: "アンケートが見つかりません" });

  attachQuestionData(q);
  const votes = db.prepare("SELECT * FROM votes WHERE questionId = ?").all(id);

  q.genderStats = q.options.map((option, index) => {
    const optionVotes = votes.filter(v => v.optionIndex === index);
    const maleVotes = optionVotes.filter(v => GENDER_ALIASES.male.includes(v.gender)).length;
    const femaleVotes = optionVotes.filter(v => GENDER_ALIASES.female.includes(v.gender)).length;
    const total = maleVotes + femaleVotes;

    return {
      option: option.text,
      male: total > 0 ? Math.round((maleVotes * 100) / total) : 0,
      female: total > 0 ? Math.round((femaleVotes * 100) / total) : 0
    };
  });

  q.ageStats = q.options.map((option, index) => {
    const optionVotes = votes.filter(v => v.optionIndex === index);
    const totalVotes = optionVotes.length;
    const row = { option: option.text };

    AGE_GROUPS.forEach((age, ageIndex) => {
      const legacyAge = LEGACY_AGE_GROUPS[ageIndex];
      const count = optionVotes.filter(v => v.age === age || v.age === legacyAge).length;
      row[age] = totalVotes > 0 ? Math.round((count * 100) / totalVotes) : 0;
    });

    return row;
  });

  res.json(q);
});

app.post("/view", (req, res) => {
  db.prepare("UPDATE questions SET views = views + 1 WHERE id = ?").run(req.body.id);
  res.json({ success: true });
});

app.get("/check-vote/:id", (req, res) => {
  const voted = db.prepare("SELECT 1 FROM votes WHERE questionId = ? AND ip = ?").get(req.params.id, getIp(req));
  res.json({ voted: !!voted });
});

app.post("/vote", async (req, res) => {
  const id = Number(req.body.id);
  const index = Number(req.body.index);
  const ip = getIp(req);

  if (!Number.isInteger(id) || !Number.isInteger(index) || index < 0) {
    return res.status(400).json({ error: true, message: "投票内容が不正です" });
  }

  const question = db.prepare("SELECT 1 FROM questions WHERE id = ?").get(id);
  if (!question) return res.status(404).json({ error: true, message: "アンケートが見つかりません" });

  const alreadyVoted = db.prepare("SELECT 1 FROM votes WHERE questionId = ? AND ip = ?").get(id, ip);
  if (alreadyVoted) {
    return res.json({ error: true, message: "このアンケートには既に投票済みです" });
  }

  const option = db.prepare("SELECT id FROM options WHERE questionId = ? ORDER BY id LIMIT 1 OFFSET ?").get(id, index);
  if (!option) return res.status(400).json({ error: true, message: "選択肢が見つかりません" });

  const voteTransaction = db.transaction(() => {
    db.prepare("UPDATE options SET votes = votes + 1 WHERE id = ?").run(option.id);
    db.prepare("INSERT INTO votes (questionId, optionIndex, age, gender, ip) VALUES (?, ?, ?, ?, ?)").run(
      id,
      index,
      String(req.body.age || UNANSWERED),
      String(req.body.gender || UNANSWERED),
      ip
    );
  });

  voteTransaction();

  await firestore.collection("votes").add({
    questionId: id,
    optionIndex: index,
    age: String(req.body.age || UNANSWERED),
    gender: String(req.body.gender || UNANSWERED),
    ip: ip,
    createdAt: nowJSTString()
  });

  res.json({ success: true });

});

app.get("/stats/:id", (req, res) => {
  const id = req.params.id;
  const ageStats = db.prepare("SELECT age, optionIndex, COUNT(*) as votes FROM votes WHERE questionId = ? GROUP BY age, optionIndex").all(id);
  const genderStats = db.prepare("SELECT gender, optionIndex, COUNT(*) as votes FROM votes WHERE questionId = ? GROUP BY gender, optionIndex").all(id);
  res.json({ ageStats, genderStats });
});

app.post("/comment", (req, res) => {
  let { id, text } = req.body;
  text = String(text || "").trim();

  const hasNgWord = NG_WORDS.some(word =>
    text.includes(word)
  );

  if (hasNgWord) {
    return res.json({
      error: true,
      message: "使用できない言葉が含まれています"
    });
  }

  if (!text) return res.json({ error: true, message: "コメントを入力してください" });
  if (text.length > 300) return res.json({ error: true, message: "コメントが長すぎます" });

  const ip = getIp(req);
  const now = Date.now();

  if (commentCooldown[ip] && now - commentCooldown[ip] < 5000) {
    return res.json({ error: true, message: "5秒待ってから投稿してください" });
  }
  commentCooldown[ip] = now;

  db.prepare("INSERT INTO comments (questionId, text, createdAt) VALUES (?, ?, ?)").run(
    id,
    escapeHTML(text),
    nowJSTString()
  );

  res.json({ success: true });
});

app.post("/report", (req, res) => {
  const { id } = req.body;
  const ip = getIp(req);

  const already = db.prepare("SELECT 1 FROM reportsLog WHERE questionId = ? AND ip = ?").get(id, ip);
  if (already) return res.json({ error: true, message: "通報済みです" });

  db.prepare("INSERT INTO reportsLog (questionId, ip) VALUES (?, ?)").run(id, ip);
  db.prepare("UPDATE questions SET reports = reports + 1 WHERE id = ?").run(id);

  res.json({ success: true });
});

app.post("/admin/delete-comment", (req, res) => {

  const { password, id } = req.body;

  if(password !== ADMIN_PASSWORD){

    return res.status(401).json({
      error:true,
      message:"管理パスワードが違います"
    });

  }

  db.prepare(`
    DELETE FROM comments
    WHERE id=?
  `).run(id);

  res.json({
    success:true
  });

});

app.post("/admin/delete", (req, res) => {
  const { password, id } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: true, message: "管理パスワードが違います" });
  }

  const deleteTransaction = db.transaction((questionId) => {
    db.prepare("DELETE FROM questions WHERE id = ?").run(questionId);
    db.prepare("DELETE FROM options WHERE questionId = ?").run(questionId);
    db.prepare("DELETE FROM comments WHERE questionId = ?").run(questionId);
    db.prepare("DELETE FROM votes WHERE questionId = ?").run(questionId);
    db.prepare("DELETE FROM reportsLog WHERE questionId = ?").run(questionId);
  });

  deleteTransaction(id);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
