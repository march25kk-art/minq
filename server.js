const express = require("express");
const { firestore } = require("./firebase");
const { FieldValue } = require("firebase-admin/firestore");
const { updateSitemap } = require('./generateSitemap');

const app = express();
app.use(express.json());

// ==========================================
// 【追加】古い詳細ページ（detail.html）から新ページ（/question）への301リダイレクト
// ==========================================
app.get('/detail.html', (req, res) => {
  const id = req.query.id;
  
  if (id) {
    // IDが存在する場合は、そのIDを維持して新しいURLへ「301（永久移動）」で転送
    res.redirect(301, `/question?id=${encodeURIComponent(id)}`);
  } else {
    // 万が一IDがないアクセスだった場合はトップページへ転送
    res.redirect(301, '/');
  }
});

// 静的ファイルの設定（※必ずリダイレクト処理の下に配置すること）
app.use(express.static("public", { extensions: ["html"] }));

// ===== 定数・環境設定 =====
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "march25kk";
const PORT = Number(process.env.PORT || 3000);

const UNANSWERED = "回答しない";
const AGE_GROUPS = ["10代", "20代", "30代", "40代", "50代", "60代", "70代以上"];
const LEGACY_AGE_GROUPS = ["10莉｣", "20莉｣", "30莉｣", "40莉｣", "50莉｣", "60莉｣", "70莉｣莉･荳・"];
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

// ===== キャッシュ・メモリ管理 =====
const CACHE_STATS = new Map();
const CACHE_TTL = 30000;
const COMMENTS_LIMIT = 100;
const VOTES_STATS_LIMIT = 5000;

const questionCooldown = {};
const commentCooldown = {};

// ===== ユーティリティ関数 =====
const escapeHTML = (str = "") => String(str)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

const getIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  return Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.socket.remoteAddress).split(",")[0].trim();
};

const nowJSTString = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19);

const sendError = (res, message, status = 200) => res.status(status).json({ error: true, message });

// 定期クリーンアップ
setInterval(() => {
  const now = Date.now();
  
  Object.keys(questionCooldown).forEach(ip => {
    if (now - questionCooldown[ip] > 60000) delete questionCooldown[ip];
  });

  Object.keys(commentCooldown).forEach(ip => {
    if (now - commentCooldown[ip] > 60000) delete commentCooldown[ip];
  });

  for (const [key, val] of CACHE_STATS.entries()) {
    if (now - val.timestamp > CACHE_TTL) CACHE_STATS.delete(key);
  }
}, CACHE_TTL);

// キャッシュアクセサ
const getCachedStats = (qId) => {
  const cached = CACHE_STATS.get(qId);
  return cached && Date.now() - cached.timestamp < CACHE_TTL ? cached.data : null;
};
const setCachedStats = (qId, data) => CACHE_STATS.set(qId, { data, timestamp: Date.now() });

// ===== 統計計算・データ正規化 =====
const calculateStats = (votes, options = []) => {
  const allVotesCount = votes.length;

  const genderStats = options.map((option, index) => {
    const optVotes = votes.filter(v => v?.optionIndex === index);
    const m = optVotes.filter(v => v.gender && GENDER_ALIASES.male.includes(v.gender)).length;
    const f = optVotes.filter(v => v.gender && GENDER_ALIASES.female.includes(v.gender)).length;
    const total = m + f;
    return {
      option,
      male: total > 0 ? Math.round((m * 100) / total) : 0,
      female: total > 0 ? Math.round((f * 100) / total) : 0,
      rawPercent: allVotesCount > 0 ? Math.round((optVotes.length * 100) / allVotesCount) : 0
    };
  });

  const ageStats = options.map((option, index) => {
    const optVotes = votes.filter(v => v?.optionIndex === index);
    const validAgeVotes = optVotes.filter(v => v?.age && v.age !== "回答しない" && v.age !== "未回答");
    const totalAge = validAgeVotes.length;
    const row = { option };

    AGE_GROUPS.filter(age => age !== "回答しない").forEach((age, ageIdx) => {
      const legacyAge = LEGACY_AGE_GROUPS[ageIdx];
      const count = optVotes.filter(v => v && (v.age === age || (legacyAge && v.age === legacyAge))).length;
      row[age] = totalAge > 0 ? Math.round((count * 100) / totalAge) : 0;
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

    const snapshot = await query.get();
    let questions = await Promise.all(snapshot.docs.map(async (doc) => {
      const data = doc.data();
      let commentCount = data.commentCount;
      if (commentCount === undefined) {
        const commSnap = await firestore.collection(C_COLL).where("questionId", "==", doc.id).get();
        commentCount = commSnap.size;
      }
      return {
        id: doc.id,
        ...data,
        commentCount: commentCount || 0,
        totalVotes: data.totalVotes || 0,
        views: data.views || 0,
        updatedAt: data.updatedAt || data.createdAt || "" // 💡 過去のデータは作成日時で代用
      };
    }));

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
        questions.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
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
    const allSnapshot = await firestore.collection(Q_COLL).get();
    res.json({
      questions,
      totalPages: Math.ceil(allSnapshot.size / limit) || 1,
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

    const hasNgWord = NG_WORDS.some(word => 
      title.includes(word) || description.includes(word) || options.some(o => String(o).includes(word))
    );
    if (hasNgWord) return sendError(res, "使用できない言葉が含まれています");

    const ip = getIp(req);
    const now = Date.now();
    
    if (questionCooldown[ip] && now - questionCooldown[ip] < 30000) {
      return sendError(res, "連続投稿は30秒待ってください");
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
    const doc = await firestore.collection(Q_COLL).doc(id).get();
    if (!doc.exists) return sendError(res, "アンケートが見つかりません");

    const q = { id: doc.id, ...doc.data() };
    Object.assign(q, normalizeQuestionData(q));

    const commentsSnapshot = await firestore.collection(C_COLL)
      .where("questionId", "==", id).orderBy("createdAt", "asc").limit(COMMENTS_LIMIT).get();
    q.comments = commentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    let statsData = getCachedStats(id);
    if (!statsData) {
      const votesSnapshot = await firestore.collection(V_COLL).where("questionId", "==", id).limit(VOTES_STATS_LIMIT).get();
      statsData = calculateStats(votesSnapshot.docs.map(d => d.data()), q.options);
      setCachedStats(id, statsData);
    }

    res.json({ ...q, ...statsData });
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

// 5. 投票済みチェック（フラグ完全判別・二重投票ブロック版）
app.get("/check-vote/:id", async (req, res) => {
  try {
    const questionId = String(req.params.id);
    const ip = getIp(req);

    const queries = [
      firestore.collection(V_COLL).where("questionId", "==", questionId).get()
    ];
    if (!isNaN(questionId)) {
      queries.push(firestore.collection(V_COLL).where("questionId", "==", Number(questionId)).get());
    }

    const snapshots = await Promise.all(queries);

    // 💡 判定：これから新しく投票したログ（statusが 'reset2026'）がある場合のみ「投票済み」とする
    const isVoted = snapshots.some(snapshot => 
      snapshot.docs.some(doc => {
        const data = doc.data();
        return data.ip === ip && data.status === "reset2026";
      })
    );

    res.json({ voted: isVoted });
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
  const selectedAge = age || UNANSWERED;
  const selectedGender = gender || UNANSWERED;

  try {
    const queries = [
      firestore.collection(V_COLL).where("questionId", "==", id).get()
    ];
    if (!isNaN(id)) {
      queries.push(firestore.collection(V_COLL).where("questionId", "==", Number(id)).get());
    }

    const snapshots = await Promise.all(queries);

    // 新しいルール（status === 'reset2026'）で既に投票しているかチェック
    const hasVoted = snapshots.some(snapshot => 
      snapshot.docs.some(doc => {
        const data = doc.data();
        return data.ip === ip && data.status === "reset2026";
      })
    );
      
    if (hasVoted) {
      return res.status(400).json({ error: true, message: "既に投票済みです" });
    }

    const questionRef = firestore.collection(Q_COLL).doc(id);
    await firestore.runTransaction(async (transaction) => {
      let sfDoc = await transaction.get(questionRef);
      let targetRef = questionRef;
      
      if (!sfDoc.exists && !isNaN(id)) {
        targetRef = firestore.collection(Q_COLL).doc(String(Number(id)));
        sfDoc = await transaction.get(targetRef);
      }
      
      if (!sfDoc.exists) throw new Error("Document does not exist!");

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

      const voteLogRef = firestore.collection(V_COLL).doc();
      transaction.set(voteLogRef, {
        questionId: id, 
        optionIndex: Number(index), 
        age: selectedAge, 
        gender: selectedGender, 
        ip: ip, 
        status: "reset2026", // 💡 これから投票するログにはこの目印を付け、2回目をブロックします
        createdAt: new Date().toISOString()
      });
    });

    CACHE_STATS.delete(id);
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
      const ageKey = `${d.age || UNANSWERED}_${d.optionIndex}`;
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
    let { text, age, gender } = req.body;
    text = String(text || "").trim();

    if (!text) return sendError(res, "コメントを入力してください");
    if (NG_WORDS.some(word => text.includes(word))) return sendError(res, "使用できない言葉が含まれています");

    const ip = getIp(req);
    const now = Date.now();
    
    if (commentCooldown[ip] && now - commentCooldown[ip] < 5000) {
      return sendError(res, "5秒待ってから投稿してください");
    }
    commentCooldown[ip] = now;

    const timeStr = nowJSTString();
    await firestore.collection(C_COLL).add({
      questionId: String(id), text: escapeHTML(text), age: age || UNANSWERED, gender: gender || UNANSWERED, createdAt: timeStr, ip
    });
    
    await firestore.collection(Q_COLL).doc(String(id)).update({ 
      commentCount: FieldValue.increment(1),
      updatedAt: timeStr
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Comment Save Error:", error);
    sendError(res, "コメントの投稿に失敗しました", 500);
  }
};
app.post(["/comment", "/questions/:id/comment"], saveComment);

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

    for (const col of [C_COLL, V_COLL, R_COLL]) {
      const snapshot = await firestore.collection(col).where("questionId", "==", questionId).get();
      const batch = firestore.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    CACHE_STATS.delete(questionId);
    res.json({ success: true });
  } catch (error) {
    sendError(res, "削除に失敗しました", 500);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});