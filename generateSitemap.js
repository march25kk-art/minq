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

    [
      { url: '/', priority: 1 },
      { url: '/mbti.html', priority: 0.8 },
      { url: '/love-diagnosis', priority: 0.8 },
      { url: '/hsp-diagnosis', priority: 0.8 },
      { url: '/stress-diagnosis', priority: 0.8 }
    ].forEach(page => sitemap.write({ ...page, changefreq: 'weekly' }));

    snapshot.forEach(doc => {
      // doc.id（Firestoreの文字列ID）を使ってURLを生成
      sitemap.write({
        url: `/question?id=${encodeURIComponent(doc.id)}`,
        changefreq: 'daily',
        priority: 0.7
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
