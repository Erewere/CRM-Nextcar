import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc } from "firebase/firestore";
import fs from 'fs';

const fbConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(fbConfig);
const db = getFirestore(app, "ai-studio-e65d5185-219a-4e1d-a330-044b1109696a");

async function run() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    console.log("Success! Users count:", snap.size);
    process.exit(0);
  } catch(e) {
    console.error("DB failed:", e);
    
    console.log("Trying default DB...");
    const defaultDb = getFirestore(app);
    try {
      const snap2 = await getDocs(collection(defaultDb, 'users'));
      console.log("Default DB Success! Users count:", snap2.size);
      process.exit(0);
    } catch(e2) {
      console.error("Default DB failed:", e2);
      process.exit(1);
    }
  }
}
run();
