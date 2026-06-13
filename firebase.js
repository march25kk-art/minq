const admin = require("firebase-admin");

let serviceAccount;

// 💡 Renderなどの本番環境（環境変数）に鍵があるかチェック
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (e) {
    console.error("Firebase環境変数のJSONパースに失敗しました:", e);
  }
} else {
  // 💡 ローカル環境（パソコン内）の場合は、今まで通りファイルを読み込む
  try {
    serviceAccount = require("./firebase-key.json");
  } catch (e) {
    console.error("firebase-key.json ファイルが見つかりません。");
  }
}

if (!serviceAccount) {
  throw new Error("Firebaseの初期化に必要な資格情報（サービスアカウント）がありません。");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

module.exports = { firestore, admin };