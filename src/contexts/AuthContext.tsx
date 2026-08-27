import React, { createContext, useContext, useEffect, useState } from 'react';
import { getApiUrl } from '../lib/api';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection, addDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { User, Agency } from '../types';

let cachedAccessToken: string | null = null;

/** Correo de la cuenta de Google conectada; ver esLaMismaCuentaDeGoogle. */
function leerCuentaGoogle(uid: string) {
  return localStorage.getItem(`google_account_${uid}`);
}

/**
 * Pedir permiso a Google, no vincular identidades.
 *
 * Antes esto usaba el sistema de Firebase para enlazar la cuenta de Google al
 * usuario del CRM. Enlazar significa "esta cuenta de Google ES este usuario", y
 * arrastra reglas de uno a uno: una cuenta no puede estar en dos usuarios, no
 * se puede cambiar, y segun el estado en que quedara Google devolvia un error
 * distinto -- de ahi que a veces conectara y a veces no.
 *
 * Pero el CRM no necesita declarar quien eres: ya lo sabe, entraste con tu
 * usuario. Solo necesita permiso para ver tu calendario y tus contactos. Eso
 * es lo que se pide aqui, y por eso cada quien puede conectar el Gmail que
 * quiera, las veces que quiera, sin tocar su forma de entrar al sistema.
 */
const CLIENTE_GOOGLE = (firebaseConfig as any).oAuthClientId as string;
const PERMISOS_GOOGLE = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/contacts.readonly',
].join(' ');

let cargaDeGoogle: Promise<void> | null = null;
function cargarGoogle(): Promise<void> {
  if (cargaDeGoogle) return cargaDeGoogle;
  cargaDeGoogle = new Promise<void>((listo, falla) => {
    if ((window as any).google?.accounts?.oauth2) return listo();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => listo();
    s.onerror = () => {
      cargaDeGoogle = null; // que un fallo de red no deje el boton muerto
      falla(new Error('No se pudo cargar Google. Revisa tu conexión e inténtalo de nuevo.'));
    };
    document.head.appendChild(s);
  });
  return cargaDeGoogle;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  agencyData: Agency | null;
  loading: boolean;
  bootstrapUser: (role: 'master' | 'admin' | 'seller', agencyId: string, name: string) => Promise<void>;
  connectGoogleServices: () => Promise<string | null>;
  refrescarTokenGoogle: () => Promise<string | null>;
  disconnectGoogleServices: () => Promise<void>;
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
  const refrescarTokenRef = React.useRef<null | (() => Promise<string | null>)>(null);

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
        // Lo guardado en el navegador se usa solo para que la pantalla no
        // parpadee mientras el servidor contesta; puede estar caducado.
        const guardado = localStorage.getItem(`google_token_${user.uid}`);
        cachedAccessToken = guardado;
        setGoogleToken(guardado);
        setGoogleAccount(leerCuentaGoogle(user.uid));
        // Y en seguida se pide uno fresco. Si esta persona conecto su cuenta
        // desde otro aparato, aqui aparece conectada sin hacer nada.
        void refrescarTokenRef.current?.();
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
   * El permiso de Google dura una hora. Se renueva antes de que caduque para
   * que nadie se tope con una sincronizacion que falla a media tarde.
   */
  useEffect(() => {
    if (!currentUser) return;
    const cada = setInterval(() => { void refrescarTokenRef.current?.(); }, 45 * 60 * 1000);
    return () => clearInterval(cada);
  }, [currentUser]);

  /**
   * El correo de bienvenida del dueño que acaba de registrarse.
   *
   * Se pide desde aqui porque el registro y la creacion de la agencia ocurren
   * en el navegador: en el servidor no hay ningun momento donde engancharlo.
   *
   * Se pide en cada arranque de sesion a proposito, y quien decide si toca
   * mandarlo es el servidor, que lleva la marca de si ya salio. Comprobarlo
   * aqui tambien evita la llamada de mas cuando la marca ya viajo con los
   * datos del usuario.
   */
  useEffect(() => {
    if (!currentUser || !userData) return;
    if (userData.role !== 'admin') return;
    if (!userData.agencyId || userData.agencyId === 'unassigned') return;
    if ((userData as any).bienvenidaEnviadaAt) return;

    let cancelado = false;
    (async () => {
      try {
        const token = await currentUser.getIdToken();
        if (cancelado) return;
        await fetch(getApiUrl('/api/correo/bienvenida'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
      } catch {
        // Que no llegue la bienvenida no puede estorbar la sesion.
      }
    })();
    return () => { cancelado = true; };
  }, [currentUser, userData?.role, userData?.agencyId, (userData as any)?.bienvenidaEnviadaAt]);

  /** El identificador de la sesion, para que el servidor sepa quien pide. */
  const credencialDelUsuario = async () => {
    const t = await auth.currentUser?.getIdToken();
    if (!t) throw new Error('Vuelve a iniciar sesión e inténtalo de nuevo.');
    return t;
  };

  const recordarToken = (token: string | null, cuenta: string | null) => {
    cachedAccessToken = token;
    setGoogleToken(token);
    setGoogleAccount(cuenta);
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    // Se conserva en el navegador solo para que la pantalla no parpadee al
    // cargar; la verdad vive en el servidor.
    if (token) localStorage.setItem(`google_token_${uid}`, token);
    else localStorage.removeItem(`google_token_${uid}`);
    if (cuenta) localStorage.setItem(`google_account_${uid}`, cuenta);
    else localStorage.removeItem(`google_account_${uid}`);
  };

  /**
   * Un permiso de Google vigente, sin molestar al usuario.
   *
   * El servidor guarda el pase de renovacion y entrega permisos frescos, asi
   * que basta con pedirselo. Devuelve null si esta persona no tiene ninguna
   * cuenta conectada, que no es un error: es que aun no ha conectado.
   */
  const refrescarTokenGoogle = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      const r = await fetch('/api/google/token', {
        headers: { Authorization: `Bearer ${await credencialDelUsuario()}` },
      });
      if (!r.ok) {
        if (r.status === 404) recordarToken(null, null);
        return null;
      }
      const d = await r.json();
      recordarToken(d.accessToken, d.cuenta ?? null);
      return d.accessToken as string;
    } catch {
      return null;
    }
  };

  refrescarTokenRef.current = refrescarTokenGoogle;

  /** Conecta una cuenta de Google. Se hace una vez y queda. */
  const connectGoogleServices = async (): Promise<string | null> => {
    await cargarGoogle();

    // El navegador solo recoge un codigo de un solo uso; el pase de
    // renovacion se lo queda el servidor, que es donde puede estar a salvo.
    const codigo = await new Promise<string | null>((entrega, falla) => {
      let cliente: any;
      try {
        cliente = (window as any).google.accounts.oauth2.initCodeClient({
          client_id: CLIENTE_GOOGLE,
          scope: PERMISOS_GOOGLE,
          ux_mode: 'popup',
          // Sin esto Google entrega el pase de renovacion solo la primera vez
          // que alguien autoriza, y quien ya habia conectado antes se quedaria
          // sin renovacion sin enterarse.
          prompt: 'consent',
          select_account: true,
          callback: (r: any) => {
            if (r?.code) return entrega(r.code);
            falla(new Error(r?.error_description || 'Google no entregó la autorización.'));
          },
          error_callback: (e: any) => {
            if (e?.type === 'popup_closed' || e?.type === 'popup_failed_to_open') return entrega(null);
            falla(new Error(e?.message || 'No se pudo conectar con Google.'));
          },
        });
      } catch (e: any) {
        return falla(new Error(e?.message || 'No se pudo iniciar la conexión con Google.'));
      }
      cliente.requestCode();
    });

    if (!codigo) return null;

    const r = await fetch('/api/google/conectar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await credencialDelUsuario()}`,
      },
      body: JSON.stringify({ code: codigo }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'No se pudo conectar con Google.');

    recordarToken(d.accessToken, d.cuenta ?? null);
    return d.accessToken as string;
  };

  /** Retira el permiso en Google y olvida el pase guardado. */
  const disconnectGoogleServices = async (): Promise<void> => {
    try {
      await fetch('/api/google/desconectar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await credencialDelUsuario()}` },
      });
    } finally {
      recordarToken(null, null);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, userData, agencyData, loading, bootstrapUser, connectGoogleServices, refrescarTokenGoogle, disconnectGoogleServices, googleToken, googleAccount }}>
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
