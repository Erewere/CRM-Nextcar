const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace imports
code = code.replace(
  `// import { getFirestore, FieldValue, Firestore } from "firebase-admin/firestore";
import { initializeApp as initClientApp } from "firebase/app";
import { getFirestore as getClientFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp, limit } from "firebase/firestore";

let clientApp = null;
function getClientDb() {
  if (!clientApp) {
    try {
      const configStr = fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8");
      clientApp = initClientApp(JSON.parse(configStr));
    } catch (e) {
      console.warn("Could not load firebase-applet-config.json");
    }
  }
  return getClientFirestore(clientApp, "ai-studio-e65d5185-219a-4e1d-a330-044b1109696a");
}`,
  `import { getFirestore, FieldValue, Firestore } from "firebase-admin/firestore";`
);

// We need a helper to get the admin DB
const helper = `
function getAdminDb() {
  return getFirestore(getAdminApp(), "ai-studio-e65d5185-219a-4e1d-a330-044b1109696a");
}
`;
code = code.replace(`function getAdminApp() {`, helper + `function getAdminApp() {`);

// Replace occurrences
code = code.replace(/const adminDb = getClientDb\(\);/g, `const adminDb = getAdminDb();`);
code = code.replace(/const db = getClientDb\(\);/g, `const db = getAdminDb();`);

// Fix syntax back to admin sdk
// 1. setDoc(doc(adminDb, "agencies", agencyId), updates, { merge: true });
code = code.replace(/await setDoc\(doc\(adminDb, "agencies", agencyId\), updates, { merge: true }\);/g, 
  `await adminDb.collection("agencies").doc(agencyId).set(updates, { merge: true });`);

// 2. getDocs(query(collection(adminDb, "agencies"), where("stripeCustomerId", "==", customerId)));
code = code.replace(/await getDocs\(query\(collection\(adminDb, "agencies"\), where\("stripeCustomerId", "==", customerId\)\)\);/g,
  `await adminDb.collection("agencies").where("stripeCustomerId", "==", customerId).get();`);

// 3. setDoc(agencyDoc.ref, { subscriptionStatus: "canceled", updatedAt: serverTimestamp() }, { merge: true });
code = code.replace(/await setDoc\(agencyDoc\.ref, \{ subscriptionStatus: "canceled", updatedAt: serverTimestamp\(\) \}, \{ merge: true \}\);/g,
  `await agencyDoc.ref.set({ subscriptionStatus: "canceled", updatedAt: FieldValue.serverTimestamp() }, { merge: true });`);

// 4. setDoc(doc(db, "users", userRecord.uid), { ... })
// This one spans lines. Let's just use regex.
code = code.replace(/await setDoc\(doc\(db, "users", userRecord\.uid\), \{/g,
  `await db.collection("users").doc(userRecord.uid).set({`);
  
// 5. deleteDoc(doc(db, "users", uid));
code = code.replace(/await deleteDoc\(doc\(db, "users", uid\)\);/g,
  `await db.collection("users").doc(uid).delete();`);

// 6. adminDb: any,
code = code.replace(/adminDb: any,/g, `adminDb: Firestore,`);

// 7. await getDocs(query(collection(adminDb, "agencies"), limit(1)));
code = code.replace(/await getDocs\(query\(collection\(adminDb, "agencies"\), limit\(1\)\)\);/g,
  `await adminDb.collection("agencies").limit(1).get();`);

// 8. await addDoc(collection(adminDb, "clients"), newClient);
code = code.replace(/await addDoc\(collection\(adminDb, "clients"\), newClient\);/g,
  `await adminDb.collection("clients").add(newClient);`);

// 9. doc(adminDb, 'agencies', agencyId) -> adminDb.collection('agencies').doc(agencyId)
code = code.replace(/const agencyRef = doc\(adminDb, 'agencies', agencyId\);/g,
  `const agencyRef = adminDb.collection('agencies').doc(agencyId);`);

// 10. await getDoc(agencyRef) -> await agencyRef.get()
code = code.replace(/await getDoc\(agencyRef\);/g,
  `await agencyRef.get();`);

// 11. updateDoc(agencyRef, { ... }) -> agencyRef.update({ ... })
code = code.replace(/await updateDoc\(agencyRef, \{/g,
  `await agencyRef.update({`);

// 12. serverTimestamp() -> FieldValue.serverTimestamp()
code = code.replace(/serverTimestamp\(\)/g, `FieldValue.serverTimestamp()`);
// Wait, FieldValue.FieldValue.serverTimestamp() might happen, check:
code = code.replace(/FieldValue\.FieldValue\.serverTimestamp\(\)/g, `FieldValue.serverTimestamp()`);

// 13. increment( -> FieldValue.increment(
code = code.replace(/increment\(/g, `FieldValue.increment(`);
code = code.replace(/FieldValue\.FieldValue\.increment\(/g, `FieldValue.increment(`);

fs.writeFileSync('server.ts', code);
