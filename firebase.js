const admin = require("firebase-admin");
// 💡 手元にある firebase-key.json を直接読み込むように指定します
const serviceAccount = require("./firebase-key.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const firestore = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// server.js側で使えるようにエクスポート
module.exports = { firestore, FieldValue };