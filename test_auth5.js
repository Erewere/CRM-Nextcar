import { initializeApp } from 'firebase/app';
import { getAuth, inMemoryPersistence } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
console.log("Auth initialized", auth.name);
process.exit(0);
