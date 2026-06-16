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

// 💡 Render（本番）環境かローカル（開発）環境かを自動判別
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.FIREBASE_SERVICE_ACCOUNT;

// 💡 【修正】本番環境でも、これまで確実に動いていた _dev フォルダを強制的に使用する
const Q_COLL = 'questions_dev';
const V_COLL = 'votes_dev';
const C_COLL = 'comments_dev';
const R_COLL = 'reportsLog_dev';

app.use(express.json());
app.use(express.static("public"));

// ヘルパー関数
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

// 1. 質問一覧取得
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

    const snapshot = await query.get();
    let questions = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // 💡 激重処理をカットするため、データ内に保存されている commentCount をそのまま使用（なければ0）
        commentCount: data.commentCount || 0 
      };
    });

    questions = questions.filter(q => (q.reports || 0) < 5);

    if (keyword) {
      questions = questions.filter(q => q.title.includes(keyword));
    }

    // 💡 【超重要】毎回全コメントを数え直す重い処理（Promise.all）を完全に削除しました！

    // 💡 並び替えロジックを修正：vote（回答順）の分岐を追加
    if (sort === "view") {
      questions.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (sort === "vote") {
      // 💡 回答数（optionsの投票数の合計、またはデータに直であるフィールド）が多い順にソート
      // バックエンドの保存形式に合わせて voteCount または totalVotes、どちらでも動くようにしています
      questions.sort((a, b) => {
        const votesB = b.voteCount || b.totalVotes || 0;
        const votesA = a.voteCount || a.totalVotes || 0;
        return votesB - votesA;
      });
    } else {
      // 新着順
      questions.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    }

    const totalCount = questions.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const paginatedQuestions = questions.slice((page - 1) * limit, page * limit);

    res.json({
      questions: paginatedQuestions,
      totalPages,
      currentPage: page
    });
  } catch (error) {
    console.error("Firestore error:", error);
    res.status(500).json({ error: true, message: "データの取得に失敗しました" });
  }
});

// 2. 質問投稿
app.get("/questions", async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = 30;
    const keyword = String(req.query.search || "");
    const tag = String(req.query.tag || "");
    const sort = String(req.query.sort || "new");

    let query = firestore.collection(Q_COLL);

    // 💡 1. カテゴリ（タグ）の絞り込み
    if (tag) {
      query = query.where("tags", "array-contains", tag);
    }

    // 💡 2. 【超重要】全件取得をやめ、Firestore側でソートと件数制限（30件）を最初に行う！
    // ※キーワード検索がない場合は、この段階でデータベース側が爆速で30件だけを選別します
    if (!keyword) {
      if (sort === "view") {
        query = query.orderBy("views", "desc");
      } else if (sort === "vote") {
        query = query.orderBy("totalVotes", "desc"); // 💡 投稿時の totalVotes に統一
      } else {
        query = query.orderBy("createdAt", "desc"); // 新着順
      }
      // ページネーション（位置スキップ）
      if (page > 1) {
        query = query.offset((page - 1) * limit);
      }
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    let questions = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        commentCount: data.commentCount || 0,
        totalVotes: data.totalVotes || 0,
        views: data.views || 0
      };
    });

    // 通報が多いものを非表示
    questions = questions.filter(q => (q.reports || 0) < 5);

    // 💡 キーワード検索がある場合のみ、サーバー側で全体フィルタ＆切り分けを行う（件数が少ないため低負荷）
    if (keyword) {
      questions = questions.filter(q => q.title.includes(keyword));
      
      if (sort === "view") {
        questions.sort((a, b) => (b.views || 0) - (a.views || 0));
      } else if (sort === "vote") {
        questions.sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0));
      } else {
        questions.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
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

    // 💡 通常時（キーワード検索なし）の合計ページ数計算
    // ※正確な全件数は全体の snapshot を取る必要がありますが、速度最優先のため簡易的なページ計算、
    // もしくは一度全件カウント（後述）にするとより正確です。ここでは動的なページ表示に対応させます。
    const allSnapshot = await firestore.collection(Q_COLL).get();
    const totalCount = allSnapshot.size;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.json({
      questions: questions, // すでに30件に絞られています
      totalPages,
      currentPage: page
    });
  } catch (error) {
    console.error("Firestore error:", error);
    res.status(500).json({ error: true, message: "データの取得に失敗しました" });
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

    // コメント取得
    const commentsSnapshot = await firestore
      .collection(C_COLL)
      .where("questionId", "==", id)
      .get();
    
    q.comments = commentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    q.comments.sort((a, b) => String(a.createdAt || "").localeCompare(String(a.createdAt || "")));

    // 投票データの取得
    const votesSnapshot = await firestore
      .collection(V_COLL)
      .where("questionId", "==", id)
      .get();
    const votes = votesSnapshot.docs.map(d => d.data());

    const allVotesCount = votes.length;

    // ==========================================
    // 性別統計（「回答しない」を分母から除外）
    // ==========================================
    q.genderStats = q.options.map((option, index) => {
      const optionVotes = votes.filter(v => v.optionIndex === index);
      const maleVotes = optionVotes.filter(v => GENDER_ALIASES.male.includes(v.gender)).length;
      const femaleVotes = optionVotes.filter(v => GENDER_ALIASES.female.includes(v.gender)).length;
      
      // 男性・女性の票だけを足して分母にする
      const genderTotal = maleVotes + femaleVotes; 

      return {
        option: option,
        male: genderTotal > 0 ? Math.round((maleVotes * 100) / genderTotal) : 0,
        female: genderTotal > 0 ? Math.round((femaleVotes * 100) / genderTotal) : 0,
        rawPercent: allVotesCount > 0 ? Math.round((optionVotes.length * 100) / allVotesCount) : 0
      };
    });

    // ==========================================
    // 年代統計（「回答しない」を分母から除外）
    // ==========================================
    q.ageStats = q.options.map((option, index) => {
      const optionVotes = votes.filter(v => v.optionIndex === index);
      
      // 💡 既存の AGE_GROUPS を使い、「回答しない」を除外した有効な票だけを分母にする
      const validAgeVotes = optionVotes.filter(v => v.age && v.age !== "回答しない" && v.age !== "未回答");
      const totalAgeCount = validAgeVotes.length; 
      
      const row = { option: option };

      // 💡 定義済みの AGE_GROUPS から「回答しない」を除いた各年代でループを回す
      AGE_GROUPS.filter(age => age !== "回答しない").forEach((age, ageIndex) => {
        const legacyAge = LEGACY_AGE_GROUPS ? LEGACY_AGE_GROUPS[ageIndex] : undefined;
        const count = optionVotes.filter(v => v.age === age || (legacyAge && v.age === legacyAge)).length;
        
        // 有効な回答数だけで割り算する
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

// 4. 閲覧数インクリメント (最速・確実版)
app.post("/view", async (req, res) => {
  try {
    // フロントから送られてきた body の中の id を最優先で取得
    const id = req.body.id;
    console.log("=== [SERVER LOG] VIEW API CALLED FOR ID ===", id);

    if (!id) {
      console.log("=== [SERVER LOG] ERROR: ID IS EMPTY ===");
      return res.status(400).json({ error: true, message: "IDがありません" });
    }
    
    // Firestore の views カウントを +1 する
    await firestore.collection(Q_COLL).doc(String(id)).update({
      views: FieldValue.increment(1)
    });
    
    console.log("=== [SERVER LOG] VIEW UPDATED SUCCESS IN FIRESTORE ===");
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
  
  // 共通の投票用オブジェクトへ偽装して再マッピング
  req.body.id = id;
  
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

// 8. コメント投稿 (タイポ・定義漏れを完全に修正)
const saveComment = async (req, res) => {
  try {
    let id = req.params.id || req.body.id;
    let { text, age, gender } = req.body;
    text = String(text || "").trim();

    // 💡 修正点：ここで判定に使う変数を正しくチェック
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