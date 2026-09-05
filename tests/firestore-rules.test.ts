// Pruebas de las reglas de seguridad de Firestore.
//
// Existen por un incidente real: un vehículo de una agencia terminó borrado
// desde otra, y confirmarlo costó horas de revisar la base a mano. Estas
// pruebas verifican el aislamiento entre agencias de forma automática, contra
// el emulador de Firebase — nunca contra datos reales.
//
// Ojo: se prueba el archivo firestore.rules del repositorio, que NO es lo que
// está publicado. Publicar sigue siendo manual en la consola de Firebase. Que
// estas pruebas pasen significa que el archivo es correcto, no que lo vigente
// en producción lo sea.

import { readFileSync } from 'fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { beforeAll, afterAll, beforeEach, describe, test } from 'vitest';

const AGENCIA_A = 'agencia-a';
const AGENCIA_B = 'agencia-b';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-crm-nextcar',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Datos base, escritos saltándose las reglas: es el estado del que parten
  // las pruebas, no algo que se esté verificando.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/admin-a'), { role: 'admin', agencyId: AGENCIA_A });
    await setDoc(doc(db, 'users/vendedor-a'), { role: 'seller', agencyId: AGENCIA_A });
    await setDoc(doc(db, 'users/admin-b'), { role: 'admin', agencyId: AGENCIA_B });
    await setDoc(doc(db, 'users/el-master'), { role: 'master', agencyId: 'plataforma' });

    await setDoc(doc(db, 'vehicles/auto-de-a'), { agencyId: AGENCIA_A, make: 'Honda' });
    await setDoc(doc(db, 'vehicles/auto-de-b'), { agencyId: AGENCIA_B, make: 'Toyota' });
    await setDoc(doc(db, 'clients/cliente-de-b'), { agencyId: AGENCIA_B, name: 'Cliente B' });
    await setDoc(doc(db, 'vehicleFinancials/costo-de-a'), { agencyId: AGENCIA_A, purchasePrice: 200000 });
    await setDoc(doc(db, 'whatsappMessages/msg-de-a'), { agencyId: AGENCIA_A, clientId: 'x', text: 'hola' });
    await setDoc(doc(db, 'whatsappMessages/msg-de-b'), { agencyId: AGENCIA_B, clientId: 'y', text: 'hola' });
  });
});

const como = (uid: string) => testEnv.authenticatedContext(uid).firestore();

describe('aislamiento entre agencias', () => {
  test('un admin no lee el inventario de otra agencia', async () => {
    await assertFails(getDoc(doc(como('admin-a'), 'vehicles/auto-de-b')));
  });

  // Este es el incidente que originó estas pruebas.
  test('un admin no borra un vehículo de otra agencia', async () => {
    await assertFails(deleteDoc(doc(como('admin-a'), 'vehicles/auto-de-b')));
  });

  test('un admin no edita un vehículo de otra agencia', async () => {
    await assertFails(updateDoc(doc(como('admin-a'), 'vehicles/auto-de-b'), { make: 'Otro' }));
  });

  test('un admin no lee los contactos de otra agencia', async () => {
    await assertFails(getDoc(doc(como('admin-a'), 'clients/cliente-de-b')));
  });

  test('sí puede con el inventario de su propia agencia', async () => {
    await assertSucceeds(getDoc(doc(como('admin-a'), 'vehicles/auto-de-a')));
    await assertSucceeds(updateDoc(doc(como('admin-a'), 'vehicles/auto-de-a'), { make: 'Honda' }));
  });

  test('un usuario sin sesión no lee nada', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'vehicles/auto-de-a')));
  });
});

describe('el master no accede a los datos de las agencias', () => {
  // Cambio deliberado: el master opera la plataforma, no atiende clientes.
  test('no lee inventario ajeno', async () => {
    await assertFails(getDoc(doc(como('el-master'), 'vehicles/auto-de-a')));
  });

  test('no lee contactos ajenos', async () => {
    await assertFails(getDoc(doc(como('el-master'), 'clients/cliente-de-b')));
  });

  test('pero sí administra agencias', async () => {
    await assertSucceeds(setDoc(doc(como('el-master'), 'agencies/agencia-a'), { name: 'A' }, { merge: true }));
  });
});

describe('costo de compra (vehicleFinancials)', () => {
  test('un vendedor no lo lee, ni en su propia agencia', async () => {
    await assertFails(getDoc(doc(como('vendedor-a'), 'vehicleFinancials/costo-de-a')));
  });

  test('un admin de la misma agencia sí', async () => {
    await assertSucceeds(getDoc(doc(como('admin-a'), 'vehicleFinancials/costo-de-a')));
  });

  test('un admin de otra agencia no', async () => {
    await assertFails(getDoc(doc(como('admin-b'), 'vehicleFinancials/costo-de-a')));
  });
});

describe('nadie se asciende a master', () => {
  test('un vendedor no se cambia el rol', async () => {
    await assertFails(updateDoc(doc(como('vendedor-a'), 'users/vendedor-a'), { role: 'master' }));
  });

  test('un admin no otorga master', async () => {
    await assertFails(updateDoc(doc(como('admin-a'), 'users/vendedor-a'), { role: 'master' }));
  });

  test('un admin no mueve usuarios a otra agencia', async () => {
    await assertFails(updateDoc(doc(como('admin-a'), 'users/vendedor-a'), { agencyId: AGENCIA_B }));
  });

  test('pero cada quien edita su propio perfil', async () => {
    await assertSucceeds(
      updateDoc(doc(como('vendedor-a'), 'users/vendedor-a'), { name: 'Nombre nuevo' })
    );
  });
});

describe('conversaciones de WhatsApp', () => {
  test('se leen solo las de la propia agencia', async () => {
    await assertSucceeds(getDoc(doc(como('admin-a'), 'whatsappMessages/msg-de-a')));
    await assertFails(getDoc(doc(como('admin-a'), 'whatsappMessages/msg-de-b')));
  });

  // Solo el servidor escribe, con el Admin SDK: si la app pudiera, cualquiera
  // fabricaría historial de conversaciones desde el navegador.
  test('no se escriben desde la app, ni las propias', async () => {
    await assertFails(
      setDoc(doc(como('admin-a'), 'whatsappMessages/inventado'), {
        agencyId: AGENCIA_A,
        clientId: 'x',
        text: 'mensaje falso',
      })
    );
    await assertFails(deleteDoc(doc(como('admin-a'), 'whatsappMessages/msg-de-a')));
  });
});

describe('colecciones no declaradas', () => {
  // El comodín que hubo permitía leer y escribir cualquier colección a
  // cualquier usuario con sesión, anulando en silencio todo lo de arriba.
  test('una colección sin regla queda prohibida', async () => {
    await assertFails(getDoc(doc(como('admin-a'), 'coleccionInventada/algo')));
    await assertFails(setDoc(doc(como('admin-a'), 'coleccionInventada/algo'), { x: 1 }));
  });
});
