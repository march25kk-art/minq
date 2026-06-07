// generateSitemap.js
const sqlite3 = require('better-sqlite3');
const { SitemapStream, streamToPromise } = require('sitemap');
const { createWriteStream } = require('fs');
const path = require('path');

async function updateSitemap() {
  try {
    const db = new sqlite3('survey.db');
    const rows = db.prepare('SELECT id FROM questions').all(); // テーブル名は questions でしたね
    
    const sitemap = new SitemapStream({ hostname: 'http://minnano-question.com' });

    rows.forEach(row => {
      sitemap.write({ url: `/detail.html?id=${row.id}`, changefreq: 'daily', priority: 0.7 });
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