const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc } = require("firebase/firestore");
const { getAuth, signInAnonymously } = require("firebase/auth");
const fs = require("fs");

const configStr = fs.readFileSync("firebase-applet-config.json", "utf8");
const app = initializeApp(JSON.parse(configStr));
const db = getFirestore(app, "ai-studio-e65d5185-219a-4e1d-a330-044b1109696a");
const auth = getAuth(app);

async function test() {
  try {
    console.log("Signing in anonymously...");
    await signInAnonymously(auth);
    console.log("Signed in. Fetching doc...");
    const d = await getDoc(doc(db, "agencies", "test"));
    console.log("Success:", d.exists());
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
