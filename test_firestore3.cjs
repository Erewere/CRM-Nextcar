const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc } = require("firebase/firestore");
const fs = require("fs");

const configStr = fs.readFileSync("firebase-applet-config.json", "utf8");
const app = initializeApp(JSON.parse(configStr));
const db = getFirestore(app); // USING DEFAULT DB

async function test() {
  try {
    const d = await getDoc(doc(db, "agencies", "test"));
    console.log("Success:", d.exists());
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
