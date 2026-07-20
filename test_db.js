import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true });
console.log(db._databaseId);
process.exit(0);
