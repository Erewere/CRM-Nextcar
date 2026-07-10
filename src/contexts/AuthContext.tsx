import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signInWithPopup, linkWithPopup, reauthenticateWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User } from '../types';

let cachedAccessToken: string | null = null;

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/tasks');
provider.setCustomParameters({ prompt: 'select_account' });

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  bootstrapUser: (role: 'master' | 'admin' | 'seller', agencyId: string, name: string) => Promise<void>;
  connectGoogleServices: () => Promise<string | null>;
  disconnectGoogleServices: () => void;
  googleToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  useEffect(() => {
    let userUnsubscribe: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // We only persist token in memory, so if they reload, they may need to reconnect or rely on what's cached.
        // Actually we can't reliably get the Google token onAuthStateChanged without popup.
        // Fetch user data from firestore
        try {
          userUnsubscribe = onSnapshot(doc(db, 'users', user.uid), async (userDoc) => {
            if (userDoc.exists()) {
              let data = userDoc.data();
              setUserData({ id: userDoc.id, ...data } as User);
            } else {
              const params = new URLSearchParams(window.location.search);
              const inviteAgencyId = params.get('agencyId');
              
              // Auto provision a pending user document
              const newUserData = {
                email: user.email || '',
                role: inviteAgencyId ? 'seller' : 'unassigned',
                agencyId: inviteAgencyId || 'unassigned',
                name: user.displayName || 'Usuario Pendiente',
                createdAt: serverTimestamp()
              };
              await setDoc(doc(db, 'users', user.uid), newUserData);
              // The snapshot will automatically re-trigger with the new data
            }
          }, (error) => {
            console.error("Failed to fetch user data", error);
            setUserData(null);
          });
        } catch (error) {
          console.error("Failed to setup snapshot", error);
          setUserData(null);
        }
      } else {
        if (userUnsubscribe) {
          userUnsubscribe();
          userUnsubscribe = undefined;
        }
        setUserData(null);
        cachedAccessToken = null;
        setGoogleToken(null);
      }
      setLoading(false);
    });
    return () => {
      unsubscribe();
      if (userUnsubscribe) {
        userUnsubscribe();
      }
    };
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
      let result;
      if (auth.currentUser) {
        const isGoogleLinked = auth.currentUser.providerData.some(p => p.providerId === 'google.com');
        if (isGoogleLinked) {
          result = await reauthenticateWithPopup(auth.currentUser, provider);
        } else {
          try {
            result = await linkWithPopup(auth.currentUser, provider);
          } catch (linkErr: any) {
            if (linkErr.code === 'auth/credential-already-in-use' || linkErr.code === 'auth/email-already-in-use') {
              const credential = GoogleAuthProvider.credentialFromError(linkErr);
              if (credential && credential.accessToken) {
                cachedAccessToken = credential.accessToken;
                setGoogleToken(credential.accessToken);
                return credential.accessToken;
              }
              throw new Error('Esta cuenta de Google ya está registrada. Por favor, selecciona OTRA cuenta de Google en la ventana emergente, o cierra sesión e ingresa directamente con Google.');
            } else {
              throw linkErr;
            }
          }
        }
      } else {
        result = await signInWithPopup(auth, provider);
      }
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
        throw e; // re-throw to allow component to display error
      }
    }
    return null;
  };

  const disconnectGoogleServices = () => {
    cachedAccessToken = null;
    setGoogleToken(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, userData, loading, bootstrapUser, connectGoogleServices, disconnectGoogleServices, googleToken }}>
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
