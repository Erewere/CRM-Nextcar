import { initializeApp } from 'firebase/app';
import { initializeAuth, browserSessionPersistence, inMemoryPersistence, browserPopupRedirectResolver, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = initializeAuth(app, {
  persistence: [browserSessionPersistence, inMemoryPersistence],
  popupRedirectResolver: browserPopupRedirectResolver
});
export const db = initializeFirestore(app, { experimentalForceLongPolling: true }, "ai-studio-e65d5185-219a-4e1d-a330-044b1109696a");
export const storage = getStorage(app);


export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const signInWithEmail = async (email: string, pass: string) => {
  return await signInWithEmailAndPassword(auth, email, pass);
};

export const signUpWithEmail = async (email: string, pass: string) => {
  return await createUserWithEmailAndPassword(auth, email, pass);
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error logging out", error);
    throw error;
  }
};
