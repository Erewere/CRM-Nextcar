import os
import re

path = "server.ts"
with open(path, "r") as f:
    content = f.read()

# 1. Imports
content = content.replace(
    '// import { getFirestore, FieldValue, Firestore } from "firebase-admin/firestore";',
    'import { getFirestore, FieldValue } from "firebase-admin/firestore";'
)
content = content.replace(
    'import { getFirestore as getClientFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp, limit } from "firebase/firestore";',
    '// client SDK firestore removed'
)

# 2. getClientDb -> getAdminDb
admin_db_func = """
function getAdminDb() {
  return getFirestore(getAdminApp());
}
"""
content = re.sub(r'let clientApp = null;\nfunction getClientDb\(\) \{[\s\S]*?return getClientFirestore[^\}]+\}', admin_db_func, content)
content = content.replace("getClientDb()", "getAdminDb()")
content = content.replace("const adminDb = getAdminDb();", "const adminDb = getAdminDb();")

# 3. Stripe webhook
content = content.replace(
    'await setDoc(doc(adminDb, "agencies", agencyId), updates, { merge: true });',
    'await adminDb.collection("agencies").doc(agencyId).set(updates, { merge: true });'
)
content = content.replace(
    'const agenciesSnapshot = await getDocs(query(collection(adminDb, "agencies"), where("stripeCustomerId", "==", customerId)));',
    'const agenciesSnapshot = await adminDb.collection("agencies").where("stripeCustomerId", "==", customerId).get();'
)
content = content.replace(
    'await setDoc(agencyDoc.ref, { subscriptionStatus: "canceled", updatedAt: serverTimestamp() }, { merge: true });',
    'await agencyDoc.ref.set({ subscriptionStatus: "canceled", updatedAt: FieldValue.serverTimestamp() }, { merge: true });'
)
content = content.replace('serverTimestamp()', 'FieldValue.serverTimestamp()')

# 4. create-user
content = content.replace(
    'const userDoc = await getDoc(doc(db, "users", decodedToken.uid));',
    'const userDoc = await db.collection("users").doc(decodedToken.uid).get();'
)
content = content.replace(
    'await setDoc(doc(db, "users", userRecord.uid), {',
    'await db.collection("users").doc(userRecord.uid).set({'
)
content = content.replace(
    'await deleteDoc(doc(db, "users", uid));',
    'await db.collection("users").doc(uid).delete();'
)

# 5. public API
content = content.replace(
    'const vehiclesRef = collection(db, "vehicles");',
    'const vehiclesRef = db.collection("vehicles");'
)
content = content.replace(
    'const q = query(vehiclesRef, where("agencyId", "==", agencyId), where("status", "==", "available"));',
    'const q = vehiclesRef.where("agencyId", "==", agencyId).where("status", "==", "available");'
)
content = content.replace('const snapshot = await getDocs(q);', 'const snapshot = await q.get();')
content = content.replace('const clientsRef = collection(db, "clients");', 'const clientsRef = db.collection("clients");')
content = content.replace('const clientsRef = collection(adminDb, "clients");', 'const clientsRef = adminDb.collection("clients");')
content = content.replace(
    'const qPhone = query(clientsRef, where("agencyId", "==", agencyId), where("phone", "==", phone));',
    'const qPhone = clientsRef.where("agencyId", "==", agencyId).where("phone", "==", phone);'
)
content = content.replace('const snapPhone = await getDocs(qPhone);', 'const snapPhone = await qPhone.get();')
content = content.replace(
    'const qEmail = query(clientsRef, where("agencyId", "==", agencyId), where("email", "==", email));',
    'const qEmail = clientsRef.where("agencyId", "==", agencyId).where("email", "==", email);'
)
content = content.replace('const snapEmail = await getDocs(qEmail);', 'const snapEmail = await qEmail.get();')
content = content.replace(
    'const docRef = await addDoc(clientsRef, newClient);',
    'const docRef = await clientsRef.add(newClient);'
)
content = content.replace(
    'await addDoc(clientsRef, newClient);',
    'await clientsRef.add(newClient);'
)

# 6. Webhook
content = content.replace(
    'const agenciesRef = collection(adminDb, "agencies");',
    'const agenciesRef = adminDb.collection("agencies");'
)
content = content.replace(
    'const q = query(agenciesRef, where("facebookPageId", "==", entryId));',
    'const q = agenciesRef.where("facebookPageId", "==", entryId);'
)

# Make sure snapshot.docs works (it does in admin sdk too).
# Also userDoc.data() and snap.exists() are the same in admin SDK.

with open(path, "w") as f:
    f.write(content)
print("Updated to Admin SDK")
