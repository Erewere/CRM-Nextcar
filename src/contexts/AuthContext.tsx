import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signInWithPopup, linkWithPopup, reauthenticateWithPopup, unlink, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection, addDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User, Agency } from '../types';

let cachedAccessToken: string | null = null;

/** Correo de la cuenta de Google conectada; ver esLaMismaCuentaDeGoogle. */
function leerCuentaGoogle(uid: string) {
  return localStorage.getItem(`google_account_${uid}`);
}

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
// Pendiente: el CRM tambien llama a Tareas de Google y a enviar correo, pero
// esos permisos no se piden aqui todavia. Antes de agregarlos hay que darlos de
// alta en la pantalla de consentimiento de Google Cloud; si se piden sin estar
// dados de alta, Google rechaza la conexion entera y deja de funcionar hasta
// el calendario, que hoy si sirve.
provider.setCustomParameters({ prompt: 'select_account' });

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  agencyData: Agency | null;
  loading: boolean;
  bootstrapUser: (role: 'master' | 'admin' | 'seller', agencyId: string, name: string) => Promise<void>;
  connectGoogleServices: () => Promise<string | null>;
  disconnectGoogleServices: () => Promise<{ desvinculada: boolean; aviso: string }>;
  googleToken: string | null;
  googleAccount: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [agencyData, setAgencyData] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleAccount, setGoogleAccount] = useState<string | null>(null);

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
        const savedToken = localStorage.getItem(`google_token_${user.uid}`);
        if (savedToken) {
          cachedAccessToken = savedToken;
          setGoogleToken(savedToken);
        } else {
          cachedAccessToken = null;
          setGoogleToken(null);
        }
        setGoogleAccount(leerCuentaGoogle(user.uid));
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
              console.log("AuthContext: User document does not exist, checking if email document exists");
              try {
                if (user.email) {
                  const qSnap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));

                  // Con dos o mas documentos para el mismo correo no hay forma
                  // de saber cual es el bueno, y la eleccion decide en que
                  // agencia entras. Antes se tomaba el primero que devolvia la
                  // consulta -- el de identificador menor en orden alfabetico --
                  // y se borraba el otro, de modo que la agencia asignada podia
                  // quedar sustituida en silencio por una anterior. Ante la
                  // duda no se elige ninguna.
                  if (qSnap.size > 1) {
                    console.error(
                      "AuthContext: hay",
                      qSnap.size,
                      "documentos de usuario con el correo",
                      user.email,
                      "->",
                      qSnap.docs.map((d) => ({ id: d.id, agencyId: d.data().agencyId }))
                    );
                    setUserData(null);
                    setLoading(false);
                    return;
                  }

                  if (!qSnap.empty) {
                    const existingDoc = qSnap.docs[0];
                    const existingData = existingDoc.data();
                    console.log("AuthContext: Found existing doc by email:", existingDoc.id, existingData);
                    const mergedUserData = {
                      email: user.email,
                      name: existingData.name || user.displayName || user.email.split('@')[0],
                      role: existingData.role || 'seller',
                      agencyId: existingData.agencyId || 'unassigned',
                      createdAt: existingData.createdAt || serverTimestamp()
                    };
                    await setDoc(doc(db, 'users', user.uid), mergedUserData, { merge: true });
                    if (existingDoc.id !== user.uid) {
                      await deleteDoc(doc(db, 'users', existingDoc.id)).catch(() => {});
                    }
                    return;
                  }
                }
              } catch (e) {
                console.warn("AuthContext: Error checking existing user by email:", e);
              }

              const params = new URLSearchParams(window.location.search);
              const inviteAgencyId = params.get('agencyId');
              
              // Auto provision a pending user document or agency
              let userRole = 'unassigned';
              let userAgencyId = 'unassigned';
              
              if (user.email === 'luisfj@gmail.com') {
                userRole = 'master';
                userAgencyId = 'master_agency';
              } else if (inviteAgencyId) {
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

  /**
   * Conecta la cuenta de Google de quien ya esta dentro del CRM.
   *
   * Antes esto llamaba a signInWithPopup, que es iniciar sesion, no vincular:
   * si el usuario habia entrado con su correo y contraseña, Google intentaba
   * abrir una sesion distinta y chocaba con la suya. Por eso marcaba error.
   *
   * Lo correcto es enlazar la cuenta de Google a la sesion que ya existe. Si
   * ya estaba enlazada, basta con volver a autenticarse para obtener un token
   * fresco: los de Google caducan en una hora y no traen forma de renovarse
   * solos, asi que de vez en cuando hay que reconectar.
   */
  const connectGoogleServices = async () => {
    const guardarToken = (token: string, cuenta: string | null) => {
      if (auth.currentUser?.uid) {
        localStorage.setItem(`google_token_${auth.currentUser.uid}`, token);
        if (cuenta) localStorage.setItem(`google_account_${auth.currentUser.uid}`, cuenta);
      }
      cachedAccessToken = token;
      setGoogleToken(token);
      if (cuenta) setGoogleAccount(cuenta);
      return token;
    };

    // De que cuenta de Google salio el permiso. No tiene por que ser el correo
    // con el que se entra al CRM: cada usuario conecta el Gmail que quiera.
    const cuentaDeGoogle = (result: any): string | null =>
      result?.user?.providerData?.find((p: any) => p?.providerId === 'google.com')?.email
      ?? result?.user?.email
      ?? null;

    const tokenDe = (result: any) => {
      const cred = GoogleAuthProvider.credentialFromResult(result);
      return cred?.accessToken ? guardarToken(cred.accessToken, cuentaDeGoogle(result)) : null;
    };

    try {
      if (!auth.currentUser) {
        const result = await signInWithPopup(auth, provider);
        return tokenDe(result);
      }

      // Con que cuenta de Google quedo enlazado este usuario del CRM. Una vez
      // enlazado hay que volver siempre a esa misma: Google permite elegir
      // otra en la ventana, pero entonces la reautenticacion falla.
      const yaEnlazada = auth.currentUser.providerData
        ?.find((p: any) => p?.providerId === 'google.com')?.email ?? null;

      try {
        const result = await linkWithPopup(auth.currentUser, provider);
        return tokenDe(result);
      } catch (err: any) {
        // Enlazada de antes: basta con volver a autenticarse para un token nuevo.
        if (err?.code === 'auth/provider-already-linked' || err?.code === 'auth/requires-recent-login') {
          try {
            const result = await reauthenticateWithPopup(auth.currentUser, provider);
            return tokenDe(result);
          } catch (err2: any) {
            // Eligio en la ventana una cuenta distinta de la enlazada. El aviso
            // de Google ('user-mismatch') no dice cual esperaba; decirlo aqui
            // ahorra el intento a ciegas.
            if (err2?.code === 'auth/user-mismatch') {
              throw new Error(
                yaEnlazada
                  ? `Elegiste una cuenta de Google distinta. Este usuario del CRM está enlazado con ${yaEnlazada}; vuelve a intentarlo y elige esa misma cuenta.`
                  : 'Elegiste una cuenta de Google distinta a la que está enlazada con este usuario del CRM. Vuelve a intentarlo con la cuenta de siempre.'
              );
            }
            throw err2;
          }
        }
        // La cuenta de Google que eligio pertenece a OTRO usuario del CRM.
        // Reautenticar no arregla esto: haria falta soltarla del otro usuario.
        if (err?.code === 'auth/credential-already-in-use') {
          // Firebase trae en customData el correo que se eligio en la ventana.
          // Nombrarlo evita el ir y venir de adivinar cual de las cuentas de
          // la maquina fue la que se pulso.
          const elegida = err?.customData?.email ?? null;
          throw new Error(
            elegida
              ? `La cuenta de Google ${elegida} ya está enlazada con otro usuario del CRM.${yaEnlazada ? ` Este usuario usa ${yaEnlazada}.` : ''} Vuelve a intentarlo y elige la cuenta correcta, o entra al CRM con el usuario que ya tiene esa.`
              : 'Esa cuenta de Google ya está enlazada con otro usuario del CRM. Elige una cuenta distinta, o entra al CRM con el usuario que ya la tiene.'
          );
        }
        throw err;
      }
    } catch (e: any) {
      if (e?.code === 'auth/cancelled-popup-request' || e?.code === 'auth/popup-closed-by-user') {
        return null;
      }
      if (e?.code === 'auth/popup-blocked') {
        throw new Error('El navegador bloqueó la ventana de Google. Permite las ventanas emergentes de este sitio e inténtalo de nuevo.');
      }
      if (e?.code === 'auth/account-exists-with-different-credential') {
        throw new Error('Esa cuenta de Google ya está usada por otro usuario del CRM. Entra con la cuenta de Google que corresponde a este usuario.');
      }
      console.error('Google connect error:', e);
      throw new Error(e?.message || 'No se pudo conectar con Google.');
    }
  };

  /**
   * Suelta la cuenta de Google de este usuario del CRM.
   *
   * Antes esto solo borraba el permiso guardado en el navegador, que es la
   * parte menos importante: la app seguia autorizada en la cuenta de Google y
   * el usuario seguia atado a ese Gmail para siempre. Desconectar de verdad
   * son tres cosas, y las tres pasan aqui.
   */
  const disconnectGoogleServices = async (): Promise<{ desvinculada: boolean; aviso: string }> => {
    const uid = auth.currentUser?.uid;
    const token = cachedAccessToken ?? (uid ? localStorage.getItem(`google_token_${uid}`) : null);

    // 1. Retirar el permiso en Google. Sin esto la app sigue apareciendo en la
    //    cuenta del usuario y la siguiente conexion ya no vuelve a preguntar.
    if (token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          mode: 'no-cors',
        });
      } catch {
        // Mejor esfuerzo: si no se logra, siempre queda quitarlo a mano desde
        // myaccount.google.com/permissions.
      }
    }

    // 2. Soltar la cuenta del usuario, que es lo que permite enlazar otra
    //    despues. Pero solo si le queda otra forma de entrar: si Google es su
    //    unica manera de iniciar sesion, desvincularla lo dejaria fuera.
    let desvinculada = false;
    let aviso = '';
    const user = auth.currentUser;
    const proveedores = user?.providerData?.map((p) => p.providerId) ?? [];
    const tieneGoogle = proveedores.includes('google.com');
    const tieneOtraEntrada = proveedores.some((p) => p !== 'google.com');

    if (user && tieneGoogle && tieneOtraEntrada) {
      try {
        await unlink(user, 'google.com');
        desvinculada = true;
      } catch (e) {
        console.error('No se pudo desvincular Google:', e);
        aviso = 'Se quitó el permiso, pero no se pudo soltar la cuenta de Google. Inténtalo de nuevo.';
      }
    } else if (tieneGoogle && !tieneOtraEntrada) {
      aviso = 'Se quitó el permiso, pero la cuenta de Google sigue enlazada porque es tu única forma de entrar al CRM. Ponte una contraseña antes de cambiar de cuenta.';
    }

    // 3. Limpiar lo guardado en este navegador.
    if (uid) {
      localStorage.removeItem(`google_token_${uid}`);
      localStorage.removeItem(`google_account_${uid}`);
    }
    cachedAccessToken = null;
    setGoogleToken(null);
    setGoogleAccount(null);

    return { desvinculada, aviso };
  };

  return (
    <AuthContext.Provider value={{ currentUser, userData, agencyData, loading, bootstrapUser, connectGoogleServices, disconnectGoogleServices, googleToken, googleAccount }}>
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
