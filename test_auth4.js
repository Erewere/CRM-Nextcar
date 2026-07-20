import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: inMemoryPersistence
});
console.log("Auth initialized", auth);
process.exit(0);
