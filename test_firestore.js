import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore/lite";
import fs from "fs";

const configStr = fs.readFileSync("firebase-applet-config.json", "utf8");
const app = initializeApp(JSON.parse(configStr));
const db = getFirestore(app);

async function test() {
  try {
    const d = await getDoc(doc(db, "agencies", "test"));
    console.log("Success:", d.exists());
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
