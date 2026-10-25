import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { esLeadNuevo } from '../lib/leadsNuevos';
import { leadsVistos } from '../lib/listaDeVistos';

/** Los tratos que llegaron solos y nadie ha abierto aún. Alimenta el puntito del Embudo. */
export function useLeadsNuevos() {
  const { userData } = useAuth();
  const [tratos, setTratos] = useState<any[]>([]);
  const vistos = leadsVistos.usar();

  useEffect(() => {
    if (!userData?.agencyId || userData.role === 'master') { setTratos([]); return; }
    const esVendedor = userData.role === 'seller';
    return onSnapshot(
      query(collection(db, 'deals'), where('agencyId', '==', userData.agencyId)),
      (snap) => {
        setTratos(
          snap.docs
            .map((d) => ({ ...d.data(), id: d.id }) as any)
            .filter((d) => (!esVendedor || d.sellerId === userData.id) && esLeadNuevo(d)),
        );
      },
      (err) => console.error('Error leyendo leads nuevos', err),
    );
  }, [userData?.agencyId, userData?.role, userData?.id]);

  const nuevos = useMemo(() => tratos.filter((t) => !vistos.has(t.id)), [tratos, vistos]);
  return { nuevos, vistos };
}
