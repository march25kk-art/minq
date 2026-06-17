const express = require("express");
const { firestore } = require("./firebase");
const { FieldValue } = require("firebase-admin/firestore");
const { updateSitemap } = require('./generateSitemap');

const app = express();
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

const NG_WORDS = [
  "死", "殺す", "殺せ", "殺され", "バカ", "アホ", "マンコ", "チンコ", "まんこ", "ちんこ", "セックス"
];

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.FIREBASE_SERVICE_ACCOUNT;

const Q_COLL = IS_PRODUCTION ? 'questions' : 'questions_dev';
const V_COLL = IS_PRODUCTION ? 'votes' : 'votes_dev';
const C_COLL = IS_PRODUCTION ? 'comments' : 'comments_dev';
const R_COLL = IS_PRODUCTION ? 'reportsLog' : 'reportsLog_dev';

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

// -----------------------------------------------------------------------------
// ルーティング
// -----------------------------------------------------------------------------

// 1. 質問一覧取得（過去のデータでもコメント数が正しく表示される修正版）
app.get("/questions", async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = 30;
    const keyword = String(req.query.search || "");
    const tag = String(req.query.tag || "");
    const sort = String(req.query.sort || "new");

    let query = firestore.collection(Q_COLL);

    if (tag) {
      query = query.where("tags", "array-contains", tag);
    }

    if (!keyword) {
      if (sort === "view") {
        query = query.orderBy("views", "desc");
      } else if (sort === "vote") {
        query = query.orderBy("totalVotes", "desc");
      } else {
        query = query.orderBy("createdAt", "desc");
      }
      if (page > 1) {
        query = query.offset((page - 1) * limit);
      }
      query = query.limit(limit);
    }
    
    // 💡 過去のアンケートデータでも、コメント数が正しく反映されるように修正
    const snapshot = await query.get();

    const questions = snapshot.docs.map(doc => {
      const data = doc.data();

      return {
        id: doc.id,
        ...data,
        commentCount: data.commentCount || 0,
        totalVotes: data.totalVotes || 0,
        views: data.views || 0
      };
   });

    let filteredQuestions = questions.filter(q => (q.reports || 0) < 5);

    if (keyword) {
      filteredQuestions = filteredQuestions.filter(q => q.title.includes(keyword));
      if (sort === "view") {
        filteredQuestions.sort((a, b) => (b.views || 0) - (a.views || 0));
      } else if (sort === "vote") {
        filteredQuestions.sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0));
      } else {
        filteredQuestions.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      }
      const totalCount = filteredQuestions.length;
      const totalPages = Math.ceil(totalCount / limit) || 1;
      const paginatedQuestions = filteredQuestions.slice((page - 1) * limit, page * limit);
      return res.json({
        questions: paginatedQuestions,
        totalPages,
        currentPage: page
      });
    }

    const allSnapshot = await firestore.collection(Q_COLL).get();
    const totalCount = allSnapshot.size;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.json({
      questions: filteredQuestions,
      totalPages,
      currentPage: page
    });
  } catch (error) {
    console.error("Firestore error:", error);
    res.status(500).json({ error: true, message: "データの取得に失敗しました" });
  }
});

// 2. 質問投稿 (正しく POST ルートとして復活させました)
app.post("/questions", async (req, res) => {
  try {
    let { title, options, tags } = req.body;
    title = String(title || "").trim();

    if (!title || !options || !Array.isArray(options) || options.length < 2) {
      return res.json({ error: true, message: "タイトルと2つ以上の選択肢が必要です" });
    }

    const hasNgWord = NG_WORDS.some(word => title.includes(word) || options.some(o => String(o).includes(word)));
    if (hasNgWord) {
      return res.json({ error: true, message: "使用できない言葉が含まれています" });
    }

    const ip = getIp(req);
    const now = Date.now();
    if (questionCooldown[ip] && now - questionCooldown[ip] < 30000) {
      return res.json({ error: true, message: "連続投稿は30秒待ってください" });
    }
    questionCooldown[ip] = now;

    const newQuestion = {
      title: escapeHTML(title),
      options: options.map(o => escapeHTML(String(o).trim())),
      tags: Array.isArray(tags) ? tags.map(t => escapeHTML(String(t).trim())) : [],
      createdAt: nowJSTString(),
      views: 0,
      totalVotes: 0,
      commentCount: 0,
      reports: 0,
      ip: ip
    };

    const docRef = await firestore.collection(Q_COLL).add(newQuestion);

    // 💡 バックグラウンドでサイトマップ更新を動かし、投稿を邪魔しない（権限エラーでも投稿自体は成功させる）
    try {
      if (typeof updateSitemap === 'function') {
        updateSitemap({ id: docRef.id, ...newQuestion });
      }
    } catch (e) {
      console.error("Sitemap update skipped:", e);
    }

    res.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error("Question Save Error:", error);
    res.status(500).json({ error: true, message: "アンケートの作成に失敗しました" });
  }
});

// 3. 質問詳細取得
app.get("/questions/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const doc = await firestore.collection(Q_COLL).doc(id).get();
    if (!doc.exists) {
      return res.json({ error: true, message: "アンケートが見つかりません" });
    }

    const q = { id: doc.id, ...doc.data() };

    const commentsSnapshot = await firestore
      .collection(C_COLL)
      .where("questionId", "==", id)
      .get();
    
    q.comments = commentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    q.comments.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));

    const votesSnapshot = await firestore
      .collection(V_COLL)
      .where("questionId", "==", id)
      .get();
    const votes = votesSnapshot.docs.map(d => d.data()) || [];

    const allVotesCount = votes.length;

    q.genderStats = (q.options || []).map((option, index) => {
      const optionVotes = votes.filter(v => v && v.optionIndex === index);
      const maleVotes = optionVotes.filter(v => v.gender && GENDER_ALIASES.male.includes(v.gender)).length;
      const femaleVotes = optionVotes.filter(v => v.gender && GENDER_ALIASES.female.includes(v.gender)).length;
      const genderTotal = maleVotes + femaleVotes; 

      return {
        option: option,
        male: genderTotal > 0 ? Math.round((maleVotes * 100) / genderTotal) : 0,
        female: genderTotal > 0 ? Math.round((femaleVotes * 100) / genderTotal) : 0,
        rawPercent: allVotesCount > 0 ? Math.round((optionVotes.length * 100) / allVotesCount) : 0
      };
    });

    q.ageStats = (q.options || []).map((option, index) => {
      const optionVotes = votes.filter(v => v && v.optionIndex === index);
      const validAgeVotes = optionVotes.filter(v => v && v.age && v.age !== "回答しない" && v.age !== "未回答");
      const totalAgeCount = validAgeVotes.length; 
      const row = { option: option };

      AGE_GROUPS.filter(age => age !== "回答しない").forEach((age, ageIndex) => {
        const legacyAge = LEGACY_AGE_GROUPS ? LEGACY_AGE_GROUPS[ageIndex] : undefined;
        const count = optionVotes.filter(v => v && (v.age === age || (legacyAge && v.age === legacyAge))).length;
        row[age] = totalAgeCount > 0 ? Math.round((count * 100) / totalAgeCount) : 0;
      });

      return row;
    });

    res.json(q);
  } catch (error) {
    console.error("Firestore error:", error);
    res.status(500).json({ error: true, message: "データの取得に失敗しました" });
  }
});

// 4. 閲覧数インクリメント
app.post("/view", async (req, res) => {
  try {
    const id = req.body.id;
    if (!id) return res.status(400).json({ error: true, message: "IDがありません" });
    
    await firestore.collection(Q_COLL).doc(String(id)).update({
      views: FieldValue.increment(1)
    });
    res.json({ success: true });
  } catch (error) {
    console.error("View Count Error:", error);
    res.status(500).json({ error: true });
  }
});

// 5. 投票済みチェック
app.get("/check-vote/:id", async (req, res) => {
  try {
    const questionId = req.params.id;
    const ip = typeof getIp === "function" ? getIp(req) : (req.ip || "unknown-ip");

    const snapshot = await firestore.collection(V_COLL)
      .where("questionId", "==", questionId)
      .where("ip", "==", ip)
      .limit(1)
      .get();

    res.json({ voted: !snapshot.empty });
  } catch (error) {
    console.error("====== 投票チェックエラー ======");
    res.status(500).json({ error: true, voted: false });
  }
});

// 6. 投票処理
app.post("/vote", async (req, res) => {
  const { id, index, age, gender } = req.body;
  const ip = typeof getIp === "function" ? getIp(req) : (req.ip || "unknown-ip");

  if (id == null || index == null) {
    return res.status(400).json({ error: true, message: "不完全なデータです" });
  }

  try {
    const questionRef = firestore.collection(Q_COLL).doc(id);
    await firestore.runTransaction(async (transaction) => {
      const sfDoc = await transaction.get(questionRef);
      if (!sfDoc.exists) throw new Error("Document does not exist!");

      const data = sfDoc.data();
      const currentTotalVotes = (data.totalVotes || 0) + 1;
      transaction.update(questionRef, { totalVotes: currentTotalVotes });

      const voteLogRef = firestore.collection(V_COLL).doc();
      transaction.set(voteLogRef, {
        questionId: id,
        optionIndex: Number(index),
        age: age || UNANSWERED,
        gender: gender || UNANSWERED,
        ip: ip,
        createdAt: new Date().toISOString()
      });
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ error: true, message: "投票の処理に失敗しました" });
  }
});

app.post("/questions/:id/vote", async (req, res) => {
  const id = req.params.id;
  const { index, age, gender } = req.body;
  req.body.id = id;
  const selectedAge = age || UNANSWERED;
  const selectedGender = gender || UNANSWERED;
  
  try {
    const questionRef = firestore.collection(Q_COLL).doc(id);
    await firestore.runTransaction(async (transaction) => {
      const sfDoc = await transaction.get(questionRef);
      if (!sfDoc.exists) throw new Error("Document does not exist!");
      const data = sfDoc.data();
      const currentTotalVotes = (data.totalVotes || 0) + 1;
      
      const counts = data.counts || {};
      const ageKey = `age_${selectedAge}`;
      const genderKey = `gender_${selectedGender}`;
      counts[ageKey] = (counts[ageKey] || 0) + 1;
      counts[genderKey] = (counts[genderKey] || 0) + 1;

      transaction.update(questionRef, { 
        totalVotes: currentTotalVotes,
        counts: counts
      });

      const voteLogRef = firestore.collection(V_COLL).doc();
      transaction.set(voteLogRef, {
        questionId: id,
        optionIndex: Number(index),
        age: selectedAge,
        gender: selectedGender,
        ip: getIp(req),
        createdAt: new Date().toISOString()
      });
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ error: true });
  }
});

// 7. 統計データ取得
app.get("/stats/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const votesSnapshot = await firestore.collection(V_COLL).where("questionId", "==", id).get();
    const ageStats = {};
    const genderStats = {};

    votesSnapshot.forEach(doc => {
      const data = doc.data();
      const age = data.age || UNANSWERED;
      const gender = data.gender || UNANSWERED;
      const optIdx = data.optionIndex;
      const ageKey = `${age}_${optIdx}`;
      ageStats[ageKey] = (ageStats[ageKey] || 0) + 1;
      const genKey = `${gender}_${optIdx}`;
      genderStats[genKey] = (genderStats[genKey] || 0) + 1;
    });

    const formattedAge = Object.keys(ageStats).map(key => {
      const [age, optionIndex] = key.split("_");
      return { age, optionIndex: Number(optionIndex), votes: ageStats[key] };
    });
    const formattedGender = Object.keys(genderStats).map(key => {
      const [gender, optionIndex] = key.split("_");
      return { gender, optionIndex: Number(optionIndex), votes: genderStats[key] };
    });
    res.json({ ageStats: formattedAge, genderStats: formattedGender });
  } catch (error) {
    console.error("Get Stats Error:", error);
    res.status(500).json({ error: true, message: "統計の取得に失敗しました" });
  }
});

// 8. コメント投稿
const saveComment = async (req, res) => {
  try {
    let id = req.params.id || req.body.id;
    let { text, age, gender } = req.body;
    text = String(text || "").trim();

    const hasNgWord = NG_WORDS.some(word => text.includes(word));
    if (hasNgWord) return res.json({ error: true, message: "使用できない言葉が含まれています" });
    if (!text) return res.json({ error: true, message: "コメントを入力してください" });

    const ip = getIp(req);
    const now = Date.now();
    if (commentCooldown[ip] && now - commentCooldown[ip] < 5000) {
      return res.json({ error: true, message: "5秒待ってから投稿してください" });
    }
    commentCooldown[ip] = now;

    await firestore.collection(C_COLL).add({
      questionId: String(id),
      text: escapeHTML(text),
      age: age || UNANSWERED,
      gender: gender || UNANSWERED,
      createdAt: nowJSTString(),
      ip: ip
    });

    await firestore.collection(Q_COLL)
    .doc(String(id))
    .update({
      commentCount: FieldValue.increment(1)
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Comment Save Error:", error);
    res.status(500).json({ error: true, message: "コメントの投稿に失敗しました" });
  }
};
app.post("/comment", saveComment);
app.post("/questions/:id/comment", saveComment);

// 9. 通報処理
app.post("/report", async (req, res) => {
  const { id } = req.body;
  const ip = getIp(req);
  if (!id) return res.status(400).json({ error: true, message: "不正なリクエストです" });

  try {
    const reportLogRef = firestore.collection(R_COLL);
    const questionRef = firestore.collection(Q_COLL).doc(String(id));

    await firestore.runTransaction(async (transaction) => {
      const alreadySnapshot = await reportLogRef
        .where("questionId", "==", String(id))
        .where("ip", "==", ip)
        .limit(1)
        .get();

      if (!alreadySnapshot.empty) throw new Error("ALREADY_REPORTED");

      transaction.set(reportLogRef.doc(), {
        questionId: String(id),
        ip: ip,
        createdAt: new Date()
      });
      transaction.update(questionRef, { reports: FieldValue.increment(1) });
    });
    res.json({ success: true });
  } catch (error) {
    if (error.message === "ALREADY_REPORTED") return res.json({ error: true, message: "通報済みです" });
    res.status(500).json({ error: true, message: "通報に失敗しました" });
  }
});

// 10. 管理者用：コメント削除
app.post("/admin/delete-comment", async (req, res) => {
  const { password, id } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: true, message: "管理パスワードが違います" });

  try {
    await firestore.collection(C_COLL).doc(String(id)).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: true, message: "削除に失敗しました" });
  }
});

// 11. 管理者用：アンケートデータ一括削除
app.post("/admin/delete", async (req, res) => {
  const { password, id } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: true, message: "管理パスワードが違います" });

  try {
    const questionId = String(id);
    await firestore.collection(Q_COLL).doc(questionId).delete();

    const collectionsToClean = [C_COLL, V_COLL, R_COLL];
    for (const col of collectionsToClean) {
      const snapshot = await firestore.collection(col).where("questionId", "==", questionId).get();
      const batch = firestore.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: true, message: "削除に失敗しました" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});