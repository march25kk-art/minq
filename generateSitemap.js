// generateSitemap.js
const { firestore } = require("./firebase"); // 💡 Firestoreを読み込む
const { SitemapStream, streamToPromise } = require('sitemap');
const { createWriteStream } = require('fs');
const path = require('path');

async function updateSitemap() {
  try {
    // 💡 Firestoreのquestionsコレクションからすべてのドキュメントを取得
    const snapshot = await firestore.collection("questions").get();
    
    const sitemap = new SitemapStream({ hostname: 'https://minnano-question.com' });

    const categoryTags = {
      news: ["ニュース", "社会", "政治", "法律", "環境"], money: ["お金", "投資"], work: ["仕事", "ビジネス"], love: ["恋愛"],
      relationships: ["人間関係", "悩み", "相談", "ストレス", "心理"], life: ["生活", "日常", "住まい・不動産", "子育て・育児", "介護"],
      food: ["食べ物", "料理", "飲食店"], health: ["健康", "医療", "ダイエット", "美容・コスメ", "ファッション"],
      study: ["勉強", "教育", "本・読書", "歴史"], technology: ["AI", "テクノロジー", "科学"],
      entertainment: ["エンタメ", "映画", "ドラマ", "アニメ", "漫画", "音楽"], games: ["ゲーム", "おもちゃ", "暇つぶし"],
      hobbies: ["趣味", "旅行", "スポーツ", "自転車・バイク", "アート", "デザイン"], pets: ["動物", "ペット"]
    };
    const questionData = snapshot.docs.map(doc => doc.data());
    const categories = Object.entries(categoryTags)
      .filter(([, tags]) => questionData.some(question => (question.tags || []).some(tag => tags.includes(String(tag)))))
      .map(([slug]) => slug);
    [
      { url: '/', priority: 1 },
      { url: '/polls', priority: 0.9 },
      { url: '/mbti.html', priority: 0.8 },
      { url: '/about.html', priority: 0.7 },
      { url: '/contact.html', priority: 0.6 },
      { url: '/operator.html', priority: 0.6 },
      { url: '/privacy.html', priority: 0.5 },
      { url: '/terms.html', priority: 0.5 },
      { url: '/love-diagnosis', priority: 0.8 },
      { url: '/hsp-diagnosis', priority: 0.8 },
      { url: '/stress-diagnosis', priority: 0.8 },
      { url: '/self-esteem-diagnosis', priority: 0.8 },
      { url: '/communication-diagnosis', priority: 0.8 },
      { url: '/approval-seeking-diagnosis', priority: 0.8 },
      { url: '/adhd-diagnosis', priority: 0.8 },
      { url: '/asd-diagnosis', priority: 0.8 },
      { url: '/cheating-risk-diagnosis', priority: 0.8 },
      { url: '/possessiveness-diagnosis', priority: 0.8 },
      { url: '/love-dependency-diagnosis', priority: 0.8 },
      { url: '/career-diagnosis', priority: 0.8 },
      { url: '/manager-aptitude-diagnosis', priority: 0.8 },
      { url: '/entrepreneur-aptitude-diagnosis', priority: 0.8 },
      { url: '/job-change-readiness-diagnosis', priority: 0.8 },
      ...categories.map(slug => ({ url: `/polls/${slug}`, priority: 0.8 }))
    ].forEach(page => sitemap.write({ ...page, changefreq: 'weekly' }));

    snapshot.forEach(doc => {
      const question = doc.data();
      const options = Array.isArray(question.options) ? question.options.filter(Boolean) : [];
      const indexable = String(question.title || "").trim()
        && options.length >= 2
        && Number(question.reports || 0) < 5
        && (String(question.description || "").trim().length >= 18
          || Number(question.totalVotes || 0) >= 5
          || Number(question.commentCount || 0) >= 1);
      if (!indexable) return;
      // doc.id（Firestoreの文字列ID）を使ってURLを生成
      sitemap.write({
        url: `/question?id=${encodeURIComponent(doc.id)}`,
        changefreq: 'daily',
        priority: 0.7,
        lastmod: question.updatedAt || question.createdAt || undefined
      });
    });
    sitemap.end();

    const data = await streamToPromise(sitemap);
    createWriteStream(path.join(__dirname, 'public', 'sitemap.xml')).write(data);
    console.log('Sitemap updated.');
  } catch (err) {
    console.error('Sitemap update failed:', err);
  }
}

module.exports = { updateSitemap };
