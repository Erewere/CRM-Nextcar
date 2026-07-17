import os
import re
path = "server.ts"
with open(path, "r") as f:
    content = f.read()

# Reverse 1. Imports
content = content.replace(
    'import { getFirestore, FieldValue } from "firebase-admin/firestore";',
    '// import { getFirestore, FieldValue, Firestore } from "firebase-admin/firestore";'
)
content = content.replace(
    '// client SDK firestore removed',
    'import { getFirestore as getClientFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp, limit } from "firebase/firestore";'
)

# Reverse 2. getAdminDb -> getClientDb
admin_db_func = """function getAdminDb() {
  let dbId = "ai-studio-e65d5185-219a-4e1d-a330-044b1109696a";
  try {
     const configStr = require("fs").readFileSync(require("path").join(process.cwd(), "firebase-applet-config.json"), "utf8");
     const config = JSON.parse(configStr);
     if (config.databaseId) dbId = config.databaseId;
  } catch(e) {}
  return getFirestore(getAdminApp(), dbId);
}"""
client_db_func = """let clientApp: any = null;
import { initializeApp as initClientApp } from "firebase/app";
function getClientDb() {
  if (!clientApp) {
    try {
      const configStr = require("fs").readFileSync(require("path").join(process.cwd(), "firebase-applet-config.json"), "utf8");
      clientApp = initClientApp(JSON.parse(configStr));
    } catch (e) {
      console.warn("Could not load firebase-applet-config.json");
    }
  }
  return getClientFirestore(clientApp, "ai-studio-e65d5185-219a-4e1d-a330-044b1109696a");
}"""
if admin_db_func in content:
    content = content.replace(admin_db_func, client_db_func)
else:
    # Use regex
    content = re.sub(r'function getAdminDb\(\) \{[\s\S]*?return getFirestore[^\}]+\}', client_db_func, content)

content = content.replace("getAdminDb()", "getClientDb()")

# Reverse 3. Stripe webhook
content = content.replace(
    'await adminDb.collection("agencies").doc(agencyId).set(updates, { merge: true });',
    'await setDoc(doc(adminDb, "agencies", agencyId), updates, { merge: true });'
)
content = content.replace(
    'const agenciesSnapshot = await adminDb.collection("agencies").where("stripeCustomerId", "==", customerId).get();',
    'const agenciesSnapshot = await getDocs(query(collection(adminDb, "agencies"), where("stripeCustomerId", "==", customerId)));'
)
content = content.replace(
    'await agencyDoc.ref.set({ subscriptionStatus: "canceled", updatedAt: FieldValue.serverTimestamp() }, { merge: true });',
    'await setDoc(agencyDoc.ref, { subscriptionStatus: "canceled", updatedAt: serverTimestamp() }, { merge: true });'
)
content = content.replace('FieldValue.serverTimestamp()', 'serverTimestamp()')

# Reverse 4. create-user
content = content.replace(
    'const userDoc = await db.collection("users").doc(decodedToken.uid).get();',
    'const userDoc = await getDoc(doc(db, "users", decodedToken.uid));'
)
content = content.replace(
    'await db.collection("users").doc(userRecord.uid).set({',
    'await setDoc(doc(db, "users", userRecord.uid), {'
)
content = content.replace(
    'await db.collection("users").doc(uid).delete();',
    'await deleteDoc(doc(db, "users", uid));'
)

# Reverse 5. public API
content = content.replace(
    'const vehiclesRef = db.collection("vehicles");',
    'const vehiclesRef = collection(db, "vehicles");'
)
content = content.replace(
    'const q = vehiclesRef.where("agencyId", "==", agencyId).where("status", "==", "available");',
    'const q = query(vehiclesRef, where("agencyId", "==", agencyId), where("status", "==", "available"));'
)
content = content.replace('const snapshot = await q.get();', 'const snapshot = await getDocs(q);')
content = content.replace('const clientsRef = db.collection("clients");', 'const clientsRef = collection(db, "clients");')
content = content.replace('const clientsRef = adminDb.collection("clients");', 'const clientsRef = collection(adminDb, "clients");')
content = content.replace(
    'const qPhone = clientsRef.where("agencyId", "==", agencyId).where("phone", "==", phone);',
    'const qPhone = query(clientsRef, where("agencyId", "==", agencyId), where("phone", "==", phone));'
)
content = content.replace('const snapPhone = await qPhone.get();', 'const snapPhone = await getDocs(qPhone);')
content = content.replace(
    'const qEmail = clientsRef.where("agencyId", "==", agencyId).where("email", "==", email);',
    'const qEmail = query(clientsRef, where("agencyId", "==", agencyId), where("email", "==", email));'
)
content = content.replace('const snapEmail = await qEmail.get();', 'const snapEmail = await getDocs(qEmail);')
content = content.replace(
    'const docRef = await clientsRef.add(newClient);',
    'const docRef = await addDoc(clientsRef, newClient);'
)
content = content.replace(
    'await clientsRef.add(newClient);',
    'await addDoc(clientsRef, newClient);'
)

# Reverse 6. Webhook
content = content.replace(
    'const agenciesRef = adminDb.collection("agencies");',
    'const agenciesRef = collection(adminDb, "agencies");'
)
content = content.replace(
    'const q = agenciesRef.where("facebookPageId", "==", entryId);',
    'const q = query(agenciesRef, where("facebookPageId", "==", entryId));'
)

with open(path, "w") as f:
    f.write(content)
print("Reverted to Client SDK")
