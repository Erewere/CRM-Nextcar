import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User } from '../types';

let cachedAccessToken: string | null = null;

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/contacts.readonly');

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  bootstrapUser: (role: 'master' | 'admin' | 'seller', agencyId: string, name: string) => Promise<void>;
  connectGoogleServices: () => Promise<string | null>;
  googleToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // We only persist token in memory, so if they reload, they may need to reconnect or rely on what's cached.
        // Actually we can't reliably get the Google token onAuthStateChanged without popup.
        // Fetch user data from firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserData({ id: userDoc.id, ...userDoc.data() } as User);
          } else {
            // Auto provision a pending user document
            const newUserData = {
              email: user.email || '',
              role: 'unassigned',
              agencyId: 'unassigned',
              name: user.displayName || 'Usuario Pendiente',
              createdAt: serverTimestamp()
            };
            await setDoc(doc(db, 'users', user.uid), newUserData);
            setUserData({ id: user.uid, ...newUserData } as unknown as User);
          }
        } catch (error) {
          console.error("Failed to fetch user data", error);
          setUserData(null);
        }
      } else {
        setUserData(null);
        cachedAccessToken = null;
        setGoogleToken(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const bootstrapUser = async (role: 'master' | 'admin' | 'seller', agencyId: string, name: string) => {
    if (!currentUser) return;
    
    // Construct new user doc
    const newUserData = {
      email: currentUser.email || '',
      role,
      agencyId,
      name: name || currentUser.displayName || 'No Name',
      createdAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'users', currentUser.uid), newUserData);
    
    // Refresh
    const newDoc = await getDoc(doc(db, 'users', currentUser.uid));
    setUserData({ id: newDoc.id, ...newDoc.data() } as User);
  };

  const connectGoogleServices = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        setGoogleToken(credential.accessToken);
        return credential.accessToken;
      }
    } catch (e: any) {
      if (e.code === 'auth/cancelled-popup-request' || e.code === 'auth/popup-closed-by-user') {
        console.log('Google services sync cancelled by user.');
      } else {
        console.error('Google connect error:', e);
      }
    }
    return null;
  };

  return (
    <AuthContext.Provider value={{ currentUser, userData, loading, bootstrapUser, connectGoogleServices, googleToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
