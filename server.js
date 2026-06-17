// 1. 質問一覧取得（最適化版）
app.get("/questions", async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = 30;
    const keyword = String(req.query.search || "");
    const tag = String(req.query.tag || "");
    const sort = String(req.query.sort || "new");

    let query = firestore.collection(Q_COLL)
      .where("reports", "<", 5);  // サーバー側で通報済みを除外

    if (tag) {
      query = query.where("tags", "array-contains", tag);
    }

    if (!keyword) {
      // キーワード検索がない場合はサーバー側で並び替え＋ページング
      if (sort === "view") {
        query = query.orderBy("views", "desc");
      } else if (sort === "vote") {
        query = query.orderBy("totalVotes", "desc");
      } else {
        query = query.orderBy("createdAt", "desc");
      }
      
      query = query.offset((page - 1) * limit).limit(limit);
      const snapshot = await query.get();

      const questions = snapshot.docs.map(doc => {
        const data = doc.data();
        // commentCount を必ず数値で返す（初期化されていない場合は0）
        return {
          id: doc.id,
          ...data,
          commentCount: Math.max(0, Number(data.commentCount) || 0),
          totalVotes: Math.max(0, Number(data.totalVotes) || 0),
          views: Math.max(0, Number(data.views) || 0)
        };
      });

      // 全件数を取得（別クエリ）
      const countQuery = firestore.collection(Q_COLL).where("reports", "<", 5);
      if (tag) {
        countQuery.where("tags", "array-contains", tag);
      }
      const countSnapshot = await countQuery.get();
      const totalCount = countSnapshot.size;
      const totalPages = Math.ceil(totalCount / limit) || 1;

      return res.json({
        questions,
        totalPages,
        currentPage: page
      });
    }

    // キーワード検索の場合（制限件数で検索）
    query = query.limit(1000);
    const snapshot = await query.get();

    const questions = snapshot.docs.map(doc => {
      const data = doc.data();
      // commentCount を必ず数値で返す（初期化されていない場合は0）
      return {
        id: doc.id,
        ...data,
        commentCount: Math.max(0, Number(data.commentCount) || 0),
        totalVotes: Math.max(0, Number(data.totalVotes) || 0),
        views: Math.max(0, Number(data.views) || 0)
      };
    });

    let filteredQuestions = questions.filter(q => q.title.includes(keyword));

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
