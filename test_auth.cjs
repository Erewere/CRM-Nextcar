const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const app = initializeApp({ projectId: 'gen-lang-client-0561602821' });
async function test() {
  try {
    const user = await getAuth(app).getUserByEmail('admin@erewere.com');
    console.log("User:", user.uid);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
