/**
 * Eliminar una agencia desde la cuenta master (para quitar agencias de prueba).
 *
 * Es irreversible, así que:
 *  - antes de borrar nada se guarda un RESPALDO de todos sus datos en el depósito del servidor (respaldosAgencias/, que
 *    las reglas de Storage no dejan leer desde el navegador);
 *  - se muestra qué se va a borrar y hay que escribir el nombre de la agencia para confirmar;
 *  - no se borra una agencia que paga una suscripción activa, ni una que tenga un usuario master;
 *  - nunca se borra una cuenta master, ni la de quien está borrando;
 *  - queda constancia en `agenciasEliminadas` (solo el servidor la lee).
 *
 * Los datos de una agencia viven en muchas colecciones, todas con el campo `agencyId`. Esta lista es la que se borra:
 * si se crea una colección nueva con datos de agencia, hay que agregarla aquí.
 */

const COLECCIONES = [
  "clients", "deals", "tasks", "notes", "files", "vehicles", "vehicleExpenses", "vehicleFinancials", "notasAutos", "documentosAutos",
  "pagosVenta", "agency_tags", "analisis_precio", "analisis_compra", "analisis_precio_corridas", "operaciones_venta", "consultas_precio",
  "mercadoAutos", "consultasPlacas", "movimientosPlacas", "whatsappMessages", "solicitudesCredito", "paquetesCredito", "formatosCredito",
  "metasVentas", "pushSuscripciones", "correosEnviados", "agencySecrets", "userSecrets",
] as const;
/** No entran al respaldo: son llaves y datos de dispositivos que no sirven para recuperar nada y sí para hacer daño. */
const SIN_RESPALDO = new Set(["agencySecrets", "userSecrets", "pushSuscripciones"]);
const idValido = (s: string) => /^[A-Za-z0-9_-]{1,64}$/.test(s);
const TOPE_DOCUMENTOS = 8000;

export function registrarEliminarAgencias(app: any, { usuarioQuePide, getAdminDb, bucket, borrarCuenta, alEliminar }: {
  usuarioQuePide: (req: any, res: any) => Promise<any>;
  getAdminDb: () => any;
  bucket: () => any;
  /** Borra la cuenta de acceso (Firebase Auth) de un usuario. */
  borrarCuenta: (uid: string) => Promise<void>;
  /** Para que el panel no siga mostrando la agencia desde su memoria. */
  alEliminar: () => void;
}) {
  async function soloMaster(req: any, res: any) {
    const q = await usuarioQuePide(req, res).catch(() => null);
    if (!q) return null;
    const u = (await q.adminDb.collection("users").doc(q.uid).get()).data();
    if (u?.role !== "master") { res.status(403).json({ error: "Solo el usuario master puede eliminar agencias." }); return null; }
    return q;
  }

  /** Qué hay que borrar y qué lo impide. */
  async function analizar(db: any, agencyId: string) {
    const ag = await db.collection("agencies").doc(agencyId).get();
    if (!ag.exists) return null;
    const a = ag.data();
    const conteos: Record<string, number> = {};
    for (const c of COLECCIONES) conteos[c] = (await db.collection(c).where("agencyId", "==", agencyId).count().get()).data().count;
    const usuarios = (await db.collection("users").where("agencyId", "==", agencyId).get()).docs
      .map((d: any) => ({ uid: d.id, email: String(d.data().email || ""), nombre: String(d.data().name || ""), rol: String(d.data().role || ""), esMaster: d.data().role === "master" }));
    const total = Object.values(conteos).reduce((s, n) => s + n, 0) + usuarios.length;
    let bloqueo = "";
    if (a.subscriptionStatus === "active" && !a.hasFreeAccess) bloqueo = "Esta agencia tiene una suscripción activa. Cancélala primero en Stripe y que quede cancelada; si no, se le seguiría cobrando.";
    else if (usuarios.some((u: any) => u.esMaster)) bloqueo = "Esta agencia tiene un usuario master. Cámbialo de agencia antes de eliminarla.";
    else if (total > TOPE_DOCUMENTOS) bloqueo = `Tiene ${total} registros: es demasiado para borrarla desde aquí de una vez.`;
    const advertencias: string[] = [];
    if (conteos.pagosVenta > 0) advertencias.push(`Tiene ${conteos.pagosVenta} pagos de ventas registrados.`);
    if (conteos.vehicles > 20) advertencias.push(`Tiene ${conteos.vehicles} autos: parece una agencia real, no de prueba.`);
    if (a.hasFreeAccess) advertencias.push("Es una agencia de cortesía.");
    if (a.stripeCustomerId) advertencias.push("Tiene cuenta de Stripe: el cliente en Stripe NO se borra (se queda con su historial de cobros).");
    return { agencyId, nombre: String(a.name || agencyId), conteos, usuarios, total, bloqueo, advertencias };
  }

  app.get("/api/admin/agencias/:id/eliminar-resumen", async (req: any, res: any) => {
    const q = await soloMaster(req, res);
    if (!q) return;
    const id = String(req.params.id || "");
    if (!idValido(id)) return res.status(400).json({ error: "Agencia no válida." });
    try {
      const r = await analizar(q.adminDb, id);
      if (!r) return res.status(404).json({ error: "Esa agencia ya no existe." });
      res.json(r);
    } catch (e) {
      console.error("agencias/resumen:", e);
      res.status(500).json({ error: "No se pudo revisar la agencia." });
    }
  });

  let eliminando = false;
  app.post("/api/admin/agencias/:id/eliminar", async (req: any, res: any) => {
    const q = await soloMaster(req, res);
    if (!q) return;
    const id = String(req.params.id || "");
    if (!idValido(id)) return res.status(400).json({ error: "Agencia no válida." });
    if (eliminando) return res.status(409).json({ error: "Ya se está eliminando otra agencia. Espera a que termine." });
    eliminando = true;
    try {
      const db = q.adminDb;
      const r = await analizar(db, id);
      if (!r) return res.status(404).json({ error: "Esa agencia ya no existe." });
      if (r.bloqueo) return res.status(409).json({ error: r.bloqueo });
      if (String(req.body?.nombre || "").trim().toLowerCase() !== r.nombre.trim().toLowerCase()) return res.status(400).json({ error: "El nombre escrito no coincide con el de la agencia." });
      const borrarUsuarios = req.body?.eliminarUsuarios === true;
      const aBorrar = r.usuarios.filter((u: any) => !u.esMaster && u.uid !== q.uid);

      // 1. Respaldo (si no se puede guardar, no se borra nada).
      const respaldo: Record<string, any> = { agencia: { id, ...(await db.collection("agencies").doc(id).get()).data() }, generadoEl: new Date().toISOString(), por: q.uid, colecciones: {}, usuarios: [] };
      for (const c of COLECCIONES) {
        if (SIN_RESPALDO.has(c)) continue;
        const s = await db.collection(c).where("agencyId", "==", id).get();
        if (s.size) respaldo.colecciones[c] = s.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      }
      respaldo.usuarios = (await db.collection("users").where("agencyId", "==", id).get()).docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const cred = (await db.collection("creditosPlacas").doc(id).get()).data();
      if (cred) respaldo.creditosPlacas = cred;
      const ruta = `respaldosAgencias/${id}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      await bucket().file(ruta).save(JSON.stringify(respaldo), { contentType: "application/json", resumable: false });

      // 2. Archivos de los documentos de los autos.
      const docsAutos = await db.collection("documentosAutos").where("agencyId", "==", id).get();
      for (const d of docsAutos.docs) {
        const rutaArchivo = String(d.data().ruta || "");
        if (rutaArchivo.startsWith(`documentosAutos/${id}/`)) await bucket().file(rutaArchivo).delete({ ignoreNotFound: true }).catch(() => {});
      }

      // 3. Datos de la agencia, colección por colección.
      let borrados = 0;
      for (const c of COLECCIONES) {
        if (c === "userSecrets" && !borrarUsuarios) continue; // las llaves de usuarios que se quedan no se tocan
        for (;;) {
          const s = await db.collection(c).where("agencyId", "==", id).limit(400).get();
          if (s.empty) break;
          const lote = db.batch();
          s.docs.forEach((d: any) => lote.delete(d.ref));
          await lote.commit();
          borrados += s.size;
        }
      }
      // Chats entre agencias donde participaba (con sus mensajes).
      const chats = await db.collection("agencyChats").where("participants", "array-contains", id).get();
      for (const c of chats.docs) { await db.recursiveDelete(c.ref); borrados++; }
      await db.collection("creditosPlacas").doc(id).delete();

      // 4. Usuarios: sus cuentas se borran solo si se pidió; si no, quedan sin agencia.
      let usuariosEliminados = 0;
      for (const u of r.usuarios) {
        if (u.esMaster || u.uid === q.uid) continue;
        if (borrarUsuarios) {
          await bucket().deleteFiles({ prefix: `users/${u.uid}/` }).catch(() => {});
          await borrarCuenta(u.uid).catch((e) => console.warn("agencias/eliminar: cuenta", u.uid, e?.message));
          await db.collection("users").doc(u.uid).delete();
          usuariosEliminados++;
        } else {
          await db.collection("users").doc(u.uid).update({ agencyId: "unassigned" });
        }
      }
      await db.collection("agencies").doc(id).delete();
      await db.collection("agenciasEliminadas").doc(id).set({ nombre: r.nombre, eliminadaEl: new Date().toISOString(), por: q.uid, conteos: r.conteos, usuarios: r.usuarios.map((u: any) => u.email), usuariosEliminados, respaldo: ruta });
      alEliminar();
      res.json({ ok: true, nombre: r.nombre, registrosBorrados: borrados, usuariosEliminados, usuariosSinAgencia: borrarUsuarios ? 0 : aBorrar.length, respaldo: ruta });
    } catch (e: any) {
      console.error("agencias/eliminar:", e);
      res.status(500).json({ error: "No se pudo eliminar la agencia por completo. Si quedó a medias, vuelve a intentarlo: es seguro repetirlo." });
    } finally {
      eliminando = false;
    }
  });
}
