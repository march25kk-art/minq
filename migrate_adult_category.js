const { firestore } = require("./firebase");

const FROM_CATEGORY = "アダルト";
const TO_CATEGORY = "大人";
const COLLECTIONS = ["questions", "questions_dev"];

async function migrateCollection(collectionName) {
  const snapshot = await firestore
    .collection(collectionName)
    .where("tags", "array-contains", FROM_CATEGORY)
    .get();

  if (snapshot.empty) {
    console.log(`${collectionName}: 0件`);
    return 0;
  }

  let batch = firestore.batch();
  let batchSize = 0;
  let updated = 0;

  for (const doc of snapshot.docs) {
    const tags = Array.isArray(doc.data().tags) ? doc.data().tags : [];
    const migratedTags = [...new Set(tags.map(tag => tag === FROM_CATEGORY ? TO_CATEGORY : tag))];
    batch.update(doc.ref, { tags: migratedTags });
    batchSize += 1;
    updated += 1;

    if (batchSize === 500) {
      await batch.commit();
      batch = firestore.batch();
      batchSize = 0;
    }
  }

  if (batchSize > 0) await batch.commit();
  console.log(`${collectionName}: ${updated}件を更新`);
  return updated;
}

async function main() {
  let total = 0;
  for (const collectionName of COLLECTIONS) {
    total += await migrateCollection(collectionName);
  }
  console.log(`合計: ${total}件を「${FROM_CATEGORY}」から「${TO_CATEGORY}」へ変更しました。`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
