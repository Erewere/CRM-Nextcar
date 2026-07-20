import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
console.log("App init done. Signing in...");
signInAnonymously(auth).then(user => {
  console.log("Signed in!", user.user.uid);
  process.exit(0);
}).catch(err => {
  console.error("Auth error", err);
  process.exit(1);
});
