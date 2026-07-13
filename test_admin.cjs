const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const app = initializeApp({ projectId: 'gen-lang-client-0561602821' });
const db = getFirestore(app, "ai-studio-e65d5185-219a-4e1d-a330-044b1109696a");
async function test() {
  try {
    const doc = await db.collection("agencies").doc("test").get();
    console.log("Exists:", doc.exists);
  } catch (e) {
    console.error(e);
  }
}
test();
