const express = require("express");
const { firestore, FieldValue } = require("./firebase");
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

    let query = firestore.collection("questions").where("reports", "<", 5);

    if (tag) {
      query = query.where("tags", "array-contains", tag);
    }

    if (sort === "view") {
      query = query.orderBy("views", "desc");
    } else {
      query = query.orderBy("createdAt", "desc");
    }

    const snapshot = await query.get();
    let questions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (keyword) {
      questions = questions.filter(q => q.title.includes(keyword));
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
app.post("/questions", async (req, res) => {
  try {
    let { title, description, tags, options } = req.body;

    title = String(title || "").trim();
    description = String(description || "").trim();

    const ip = getIp(req);
    const now = Date.now();

    if (questionCooldown[ip] && now - questionCooldown[ip] < 30000) {
      return res.json({ error: true, message: "30秒待ってから投稿してください" });
    }
    questionCooldown[ip] = now;

    const ngText = `${title} ${description}`;
    const hasNgWord = NG_WORDS.some(word => ngText.includes(word));
    if (hasNgWord) {
      return res.json({ error: true, message: "使用できない言葉が含まれています" });
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

    const docRef = await firestore.collection("questions").add({
      title: escapeHTML(title),
      description: escapeHTML(description),
      tags: cleanTags,
      options: uniqueOptions,
      createdAt: nowJSTString(),
      views: 0,
      reports: 0,
      totalVotes: 0 // 💡 初期値として明示
    });

    await updateSitemap();

    res.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error("Post Question Error:", error);
    res.status(500).json({ error: true, message: "投稿に失敗しました" });
  }
});

// ==========================================
// 3. 質問詳細取得 (詳細＋確実な統計％算出)
// ==========================================
app.get("/questions/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const doc = await firestore.collection("questions").doc(id).get();
    if (!doc.exists) {
      return res.json({ error: true, message: "アンケートが見つかりません" });
    }

    const q = { id: doc.id, ...doc.data() };

    // 関連するコメントの取得
    const commentsSnapshot = await firestore
      .collection("comments")
      .where("questionId", "==", id)
      .orderBy("createdAt", "asc")
      .get();
    q.comments = commentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // 投票データの取得
    const votesSnapshot = await firestore
      .collection("votes")
      .where("questionId", "==", id)
      .get();
    const votes = votesSnapshot.docs.map(d => d.data());

    // 💡 修正ポイント①：すべての投票ログの数を、全体の分母（総投票数）として正確に取得
    const allVotesCount = votes.length;

    // 性別統計 ＆ 選択肢全体の獲得パーセント（rawPercent）を算出
    q.genderStats = q.options.map((option, index) => {
      // この選択肢に投票されたすべてのログ（属性なし含む）
      const optionVotes = votes.filter(v => v.optionIndex === index);
      
      // 性別が入力されているものだけの票数をカウント
      const maleVotes = optionVotes.filter(v => GENDER_ALIASES.male.includes(v.gender)).length;
      const femaleVotes = optionVotes.filter(v => GENDER_ALIASES.female.includes(v.gender)).length;
      const genderTotal = maleVotes + femaleVotes;

      return {
        option: option,
        // その選択肢を選んだ人の中での男女比（%）
        male: genderTotal > 0 ? Math.round((maleVotes * 100) / genderTotal) : 0,
        female: genderTotal > 0 ? Math.round((femaleVotes * 100) / genderTotal) : 0,
        
        // 💡 修正ポイント②：性別に関係なく、この選択肢のピュアな「全体に対する得票率（%）」を計算して追加！
        rawPercent: allVotesCount > 0 ? Math.round((optionVotes.length * 100) / allVotesCount) : 0
      };
    });

    // 年代統計
    q.ageStats = q.options.map((option, index) => {
      const optionVotes = votes.filter(v => v.optionIndex === index);
      const totalVotes = optionVotes.length;
      const row = { option: option };

      AGE_GROUPS.forEach((age, ageIndex) => {
        const legacyAge = LEGACY_AGE_GROUPS[ageIndex];
        const count = optionVotes.filter(v => v.age === age || v.age === legacyAge).length;
        row[age] = totalVotes > 0 ? Math.round((count * 100) / totalVotes) : 0;
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
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: true });
    
    await firestore.collection("questions").doc(String(id)).update({
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

    const snapshot = await firestore.collection("votes")
      .where("questionId", "==", questionId)
      .where("ip", "==", ip)
      .limit(1)
      .get();

    res.json({ voted: !snapshot.empty });
  } catch (error) {
    console.error("====== 投票チェックエラー ======");
    console.error(error);
    console.error("==============================");
    res.status(500).json({ error: true, voted: false });
  }
});

// 6. 投票処理 (バグ修正版：ログへすべてのデータを保存)
app.post("/vote", async (req, res) => {
  // 💡 フロントから送られてくる index, age, gender を確実にキャッチ
  const { id, index, age, gender } = req.body;
  const ip = typeof getIp === "function" ? getIp(req) : (req.ip || "unknown-ip");

  if (id == null || index == null) {
    return res.status(400).json({ error: true, message: "不完全なデータです" });
  }

  try {
    const questionRef = firestore.collection("questions").doc(id);

    await firestore.runTransaction(async (transaction) => {
      const sfDoc = await transaction.get(questionRef);
      if (!sfDoc.exists) {
        throw new Error("Document does not exist!");
      }

      const data = sfDoc.data();
      const currentTotalVotes = (data.totalVotes || 0) + 1;

      // 💡 アンケート本体の総投票数のみインクリメント
      // (詳細取得API側で常にvotesから正しい%をリアルタイム計算するため、個別Statsの管理はログに一任します)
      transaction.update(questionRef, {
        totalVotes: currentTotalVotes
      });

      // 💡 投票ログの保存（ここに必要な情報がすべて入っていないと統計が壊れます）
      const voteLogRef = firestore.collection("votes").doc();
      transaction.set(voteLogRef, {
        questionId: id,
        optionIndex: Number(index), // 💡 どの選択肢か
        age: age || UNANSWERED,     // 💡 年代
        gender: gender || UNANSWERED, // 💡 性別
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

// 7. 統計データ取得
app.get("/stats/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const votesSnapshot = await firestore.collection("votes").where("questionId", "==", id).get();
    
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

// 8. コメント投稿 (バグ修正版：属性データの保存)
app.post("/comment", async (req, res) => {
  // 💡 age と gender もリクエストボディから取得
  let { id, text, age, gender } = req.body;
  text = String(text || "").trim();

  const hasNgWord = NG_WORDS.some(word => text.includes(word));
  if (hasNgWord) {
    return res.json({ error: true, message: "使用できない言葉が含まれています" });
  }
  if (!text) return res.json({ error: true, message: "コメントを入力してください" });
  if (text.length > 300) return res.json({ error: true, message: "コメントが長すぎます" });

  const ip = getIp(req);
  const now = Date.now();
  if (commentCooldown[ip] && now - commentCooldown[ip] < 5000) {
    return res.json({ error: true, message: "5秒待ってから投稿してください" });
  }
  commentCooldown[ip] = now;

  try {
    await firestore.collection("comments").add({
      questionId: String(id),
      text: escapeHTML(text),
      age: age || UNANSWERED,       // 💡 年代を保存
      gender: gender || UNANSWERED, // 💡 性別を保存
      createdAt: nowJSTString(),
      ip: ip
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Comment Save Error:", error);
    res.status(500).json({ error: true, message: "コメントの投稿に失敗しました" });
  }
});

// 9. 通報処理
app.post("/report", async (req, res) => {
  const { id } = req.body;
  const ip = getIp(req);
  if (!id) return res.status(400).json({ error: true, message: "不正なリクエストです" });

  try {
    const reportLogRef = firestore.collection("reportsLog");
    const questionRef = firestore.collection("questions").doc(String(id));

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

      transaction.update(questionRef, {
        reports: FieldValue.increment(1)
      });
    });

    res.json({ success: true });
  } catch (error) {
    if (error.message === "ALREADY_REPORTED") {
      return res.json({ error: true, message: "通報済みです" });
    }
    console.error("Report Transaction Error:", error);
    res.status(500).json({ error: true, message: "通報に失敗しました" });
  }
});

// 10. 管理者用：コメント削除
app.post("/admin/delete-comment", async (req, res) => {
  const { password, id } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: true, message: "管理パスワードが違います" });
  }

  try {
    await firestore.collection("comments").doc(String(id)).delete();
    res.json({ success: true });
  } catch (error) {
    console.error("Admin Delete Comment Error:", error);
    res.status(500).json({ error: true, message: "削除に失敗しました" });
  }
});

// 11. 管理者用：アンケートデータ一括削除
app.post("/admin/delete", async (req, res) => {
  const { password, id } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: true, message: "管理パスワードが違います" });
  }

  try {
    const questionId = String(id);

    await firestore.collection("questions").doc(questionId).delete();

    const collectionsToClean = ["comments", "votes", "reportsLog"];
    for (const col of collectionsToClean) {
      const snapshot = await firestore.collection(col).where("questionId", "==", questionId).get();
      const batch = firestore.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Admin Delete Question Error:", error);
    res.status(500).json({ error: true, message: "削除に失敗しました" });
  }
});

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});