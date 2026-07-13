const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace imports
code = code.replace(
  `import { getFirestore, FieldValue, Firestore } from "firebase-admin/firestore";`,
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
}
`
);

// We added getAdminDb. Let's remove it and replace its usages.
code = code.replace(
`function getAdminDb() {
  return getFirestore(getAdminApp(), "ai-studio-e65d5185-219a-4e1d-a330-044b1109696a");
}`, ``);
code = code.replace(/const adminDb = getAdminDb\(\);/g, `const adminDb = getClientDb();`);
code = code.replace(/const db = getAdminDb\(\);/g, `const db = getClientDb();`);

// Stripe webhook
code = code.replace(
  `await adminDb.collection("agencies").doc(agencyId).set(updates, { merge: true });`,
  `await setDoc(doc(adminDb, "agencies", agencyId), updates, { merge: true });`
);
code = code.replace(
  `await adminDb.collection("agencies").where("stripeCustomerId", "==", customerId).get();`,
  `await getDocs(query(collection(adminDb, "agencies"), where("stripeCustomerId", "==", customerId)));`
);
code = code.replace(
  `await agencyDoc.ref.set({ subscriptionStatus: "canceled", updatedAt: FieldValue.serverTimestamp() }, { merge: true });`,
  `await setDoc(agencyDoc.ref, { subscriptionStatus: "canceled", updatedAt: serverTimestamp() }, { merge: true });`
);

// Create user
code = code.replace(
  `await db.collection("users").doc(userRecord.uid).set({`,
  `await setDoc(doc(db, "users", userRecord.uid), {`
);

// Delete user
code = code.replace(
  `await db.collection("users").doc(uid).delete();`,
  `await deleteDoc(doc(db, "users", uid));`
);

// Meta webhook
code = code.replace(
  `adminDb: Firestore,`,
  `adminDb: any,`
);
code = code.replace(
  `await adminDb.collection("agencies").limit(1).get();`,
  `await getDocs(query(collection(adminDb, "agencies"), limit(1)));`
);
code = code.replace(
  `await adminDb.collection("clients").add(newClient);`,
  `await addDoc(collection(adminDb, "clients"), newClient);`
);

// AI advisor
code = code.replace(
  `const agencyRef = adminDb.collection('agencies').doc(agencyId);`,
  `const agencyRef = doc(adminDb, 'agencies', agencyId);`
);
code = code.replace(
  `await agencyRef.get();`,
  `await getDoc(agencyRef);`
);
code = code.replace(
  `await agencyRef.update({`,
  `await updateDoc(agencyRef, {`
);

// General field value replacements
code = code.replace(/FieldValue\.serverTimestamp\(\)/g, `serverTimestamp()`);
code = code.replace(/FieldValue\.increment\(/g, `increment(`);

fs.writeFileSync('server.ts', code);
