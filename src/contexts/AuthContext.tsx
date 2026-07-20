import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signInWithPopup, linkWithPopup, reauthenticateWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User, Agency } from '../types';

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
  agencyData: Agency | null;
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
  const [agencyData, setAgencyData] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  useEffect(() => {
    let userUnsubscribe: (() => void) | undefined;
    let agencyUnsubscribe: (() => void) | undefined;

    console.log("AuthContext: useEffect mounting, registering onAuthStateChanged");
    
    const timeoutId = setTimeout(() => {
      console.warn("AuthContext: onAuthStateChanged has not fired after 10 seconds. It might be blocked or delayed.");
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeoutId);
      console.log("AuthContext: onAuthStateChanged triggered. User:", user ? user.email : "null");
      setCurrentUser(user);
      if (user) {
        setLoading(true);
        try {
          console.log("AuthContext: Setting up user snapshot for UID:", user.uid);
          userUnsubscribe = onSnapshot(doc(db, 'users', user.uid), async (userDoc) => {
            console.log("AuthContext: User snapshot received. Exists:", userDoc.exists());
            if (userDoc.exists()) {
              let data = userDoc.data();
              const newUserData = { id: userDoc.id, ...data } as User;
              console.log("AuthContext: User data loaded:", newUserData);
              setUserData(newUserData);

              if (newUserData.role === 'master' || !newUserData.agencyId || newUserData.agencyId === 'unassigned') {
                console.log("AuthContext: User is master, or has no agencyId, or is unassigned. Clearing agency subscription.");
                if (agencyUnsubscribe) {
                  agencyUnsubscribe();
                  agencyUnsubscribe = undefined;
                }
                setAgencyData(null);
                setLoading(false);
              } else {
                console.log("AuthContext: Setting up agency snapshot for AgencyID:", newUserData.agencyId);
                if (agencyUnsubscribe) {
                  console.log("AuthContext: Unsubscribing previous agency listener");
                  agencyUnsubscribe();
                }
                agencyUnsubscribe = onSnapshot(doc(db, 'agencies', newUserData.agencyId), (agencyDoc) => {
                  console.log("AuthContext: Agency snapshot received. Exists:", agencyDoc.exists());
                  if (agencyDoc.exists()) {
                    const agencyDataObj = { id: agencyDoc.id, ...agencyDoc.data() } as Agency;
                    console.log("AuthContext: Agency data loaded:", agencyDataObj);
                    setAgencyData(agencyDataObj);
                  } else {
                    console.log("AuthContext: Agency doc does not exist.");
                    setAgencyData(null);
                  }
                  setLoading(false);
                }, (error) => {
                  console.error("AuthContext: Failed to fetch agency data", error);
                  setAgencyData(null);
                  setLoading(false);
                });
              }
            } else {
              console.log("AuthContext: User document does not exist, creating default/pending profile");
              const params = new URLSearchParams(window.location.search);
              const inviteAgencyId = params.get('agencyId');
              
              // Auto provision a pending user document or agency
              let userRole = 'unassigned';
              let userAgencyId = 'unassigned';
              
              if (inviteAgencyId) {
                userRole = 'seller';
                userAgencyId = inviteAgencyId;
              } else {
                // Auto create agency with 30 days trial
                try {
                  const newAgency = {
                    name: "Agencia de " + (user.displayName || user.email?.split('@')[0] || "Prueba"),
                    subscriptionStatus: "trialing",
                    hasFreeAccess: false,
                    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    createdAt: serverTimestamp(),
                    creatorId: user.uid
                  };
                  const agencyDocRef = await addDoc(collection(db, 'agencies'), newAgency);
                  userRole = 'admin';
                  userAgencyId = agencyDocRef.id;
                } catch (err) {
                  console.error("AuthContext: Error auto-provisioning agency", err);
                }
              }

              const newUserData = {
                email: user.email || '',
                role: userRole,
                agencyId: userAgencyId,
                name: user.displayName || user.email?.split('@')[0] || 'Usuario',
                createdAt: serverTimestamp()
              };
              setDoc(doc(db, 'users', user.uid), newUserData).catch(err => {
                console.error("AuthContext: Error auto-provisioning user doc", err);
              });
              console.log("AuthContext: Default profile setDoc initiated");
              // The snapshot will automatically re-trigger with the new data
            }
          }, (error) => {
            console.error("AuthContext: Failed to fetch user data", error);
            setUserData(null);
            setLoading(false);
          });
        } catch (error) {
          console.error("AuthContext: Failed to setup snapshot", error);
          setUserData(null);
          setLoading(false);
        }
      } else {
        console.log("AuthContext: No user logged in. Cleaning up state.");
        if (userUnsubscribe) {
          userUnsubscribe();
          userUnsubscribe = undefined;
        }
        if (agencyUnsubscribe) {
          agencyUnsubscribe();
          agencyUnsubscribe = undefined;
        }
        setUserData(null);
        setAgencyData(null);
        cachedAccessToken = null;
        setGoogleToken(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (userUnsubscribe) {
        userUnsubscribe();
      }
      if (agencyUnsubscribe) {
        agencyUnsubscribe();
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
    setUserData({ ...newDoc.data(), id: newDoc.id } as User);
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
    <AuthContext.Provider value={{ currentUser, userData, agencyData, loading, bootstrapUser, connectGoogleServices, disconnectGoogleServices, googleToken }}>
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
