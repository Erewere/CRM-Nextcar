import { checkIsWon, checkIsLost } from "../lib/clientUtils.ts";
import { aFormaVieja, deFormaVieja, estadoDeCuenta, fechaDelPago, fusionarPagosViejos, hoyISO, liquidacionAnticipada, type ConceptoPago, type PagoVenta, type PlanVenta } from "../lib/planDePagos.ts";

/**
 * Pagos de las ventas: un solo lugar para el dinero.
 *
 * Antes cada pago vivía dentro de saleDetails.payments, copiado en el trato,
 * el contacto y el auto, y lo escribían ocho caminos distintos desde el
 * navegador. Cualquiera que guardara la venta otra vez podía pisar la lista:
 * así se perdió el enganche de César Augusto (HHHSeminuevos, 5 oct 2026).
 *
 * Ahora cada pago es un documento de pagosVenta (sin regla para el
 * navegador: solo el servidor lo escribe), con quién y cuándo. No se borra:
 * se anula con motivo. Después de cada cambio el servidor reescribe la copia
 * de saleDetails.payments en trato, contacto y auto para las pantallas y
 * reportes que todavía la leen, y marca las tareas de cobro según el dinero
 * real: una mensualidad está hecha solo si hay pago que la cubra.
 */

const ROLES_NO_COBRAN = new Set(["seller", "taller"]);
// «descuento» no se registra a mano: solo sale de una liquidación anticipada.
const CONCEPTOS = new Set<ConceptoPago>(["enganche", "comision", "mensualidad", "abono", "liquidacion", "pago", "devolucion"]);
const ROLES_DESCUENTAN = new Set(["admin", "manager", "master"]);
const FORMAS = new Set(["efectivo", "transferencia", "tarjeta", "cheque", "auto", "otro"]);
const idValido = (s: string) => /^[A-Za-z0-9_-]{1,64}$/.test(s);
const fechaValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00`));
const textoCorto = (s: any, n = 300) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

/** Lo del plan, sin la lista vieja de pagos. */
export function planDe(sd: any): PlanVenta {
  const { payments, ...plan } = sd || {};
  return plan;
}

export function registrarVentas(app: any, { usuarioQuePide, getAdminDb }: { usuarioQuePide: (req: any, res: any) => Promise<any>; getAdminDb: () => any }) {
  const col = (db: any) => db.collection("pagosVenta");

  async function nombreDe(db: any, uid: string) {
    const u = (await db.collection("users").doc(uid).get()).data() || {};
    return String(u.name || u.email || "Usuario");
  }

  /** El trato, si es de la agencia de quien pide (el master ve todas). */
  async function tratoDe(q: any, dealId: string) {
    if (!idValido(dealId)) return null;
    const s = await q.adminDb.collection("deals").doc(dealId).get();
    if (!s.exists) return null;
    const d = s.data();
    if (q.rol !== "master" && d.agencyId !== q.agencyId) return null;
    return { ref: s.ref, datos: d };
  }

  /** El auto de esta venta: el que la registra como suya, o el del trato si su comprador es este cliente. */
  async function autoDe(db: any, dealId: string, d: any) {
    if (d.vehicleId && idValido(String(d.vehicleId))) {
      const v = await db.collection("vehicles").doc(String(d.vehicleId)).get();
      const x = v.data();
      if (x && x.agencyId === d.agencyId && (x.soldDealId === dealId || (!x.soldDealId && d.clientId && (x.buyerId === d.clientId || x.soldToClientId === d.clientId)))) return { ref: v.ref, datos: x };
    }
    const s = await db.collection("vehicles").where("soldDealId", "==", dealId).limit(1).get();
    const v = s.docs[0];
    return v && v.data().agencyId === d.agencyId ? { ref: v.ref, datos: v.data() } : null;
  }

  async function pagosDe(db: any, dealId: string): Promise<PagoVenta[]> {
    const s = await col(db).where("dealId", "==", dealId).get();
    return s.docs.map((x: any) => ({ ...x.data(), id: x.id }) as PagoVenta);
  }

  /**
   * La primera vez que se toca una venta, sus pagos viejos (de las tres
   * copias, juntas sin duplicar) pasan a pagosVenta tal cual. Se hace una
   * sola vez por trato (marca pagosEnColeccion).
   */
  async function asegurarMigrado(db: any, dealId: string) {
    const dealRef = db.collection("deals").doc(dealId);
    await db.runTransaction(async (tx: any) => {
      const ds = await tx.get(dealRef);
      const d = ds.data();
      if (!d || d.pagosEnColeccion) return;
      const auto = await autoDe(db, dealId, d);
      const cliente = d.clientId && idValido(String(d.clientId)) ? (await tx.get(db.collection("clients").doc(String(d.clientId)))).data() : null;
      const delCliente = cliente && cliente.ventaDealId === dealId ? cliente.saleDetails?.payments : null;
      const viejos = fusionarPagosViejos(d.saleDetails?.payments, delCliente, auto?.datos?.saleDetails?.payments);
      const esCredito = d.saleDetails?.method === "credito";
      const usados = new Set<string>();
      for (const p of viejos) {
        const nuevo = deFormaVieja(p, esCredito);
        if (!(nuevo.monto > 0) || !fechaValida(nuevo.fecha)) continue;
        const id = idValido(nuevo.id) && !usados.has(nuevo.id) ? `m_${dealId}_${nuevo.id}` : col(db).doc().id;
        usados.add(nuevo.id);
        const { id: _sinId, ...resto } = nuevo;
        tx.set(col(db).doc(id), { ...resto, dealId, agencyId: d.agencyId, clientId: d.clientId || null });
      }
      tx.update(dealRef, { pagosEnColeccion: true });
    });
  }


  /**
   * Un trato ganado con auto tiene que sacar ese auto del inventario. Las
   * pantallas lo hacen al cerrar la venta, pero hay varios caminos de cierre
   * («Marcar ganado» desde el contacto, editar la venta desde su página...) y
   * alguno se salta el paso: el trato queda ganado, con sus pagos, y el auto
   * sigue «disponible» (Jetta de Xavier Gomez, 22 oct 2026). Esto lo
   * garantiza aquí, que es por donde pasan todos.
   *
   * Un administrador o el dueño confirman la venta; para los demás queda la
   * solicitud de aprobación de siempre. Nunca toca un auto que ya está
   * vendido, que ya espera aprobación o que otro trato ya registra como suyo.
   */
  async function asegurarAutoVendido(db: any, dealId: string, rol: string): Promise<"vendido" | "solicitud" | null> {
    const d = (await db.collection("deals").doc(dealId).get()).data();
    if (!d || d.isDeleted || d.status !== "won" || !d.vehicleId || !idValido(String(d.vehicleId))) return null;
    const vRef = db.collection("vehicles").doc(String(d.vehicleId));
    const x = (await vRef.get()).data();
    if (!x || x.agencyId !== d.agencyId || x.status === "sold" || x.pendingValidation || x.soldDealId) return null;
    const otros = await db.collection("deals").where("vehicleId", "==", String(d.vehicleId)).get();
    if (otros.docs.some((o: any) => o.id !== dealId && o.data().status === "won" && !o.data().isDeleted)) return null;
    const cliente = d.clientId && idValido(String(d.clientId)) ? (await db.collection("clients").doc(String(d.clientId)).get()).data() : null;
    const precio = Number(d.saleDetails?.price) || Number(d.value) || Number(x.price) || 0;
    const ahora = new Date().toISOString();
    const nombre = String(cliente?.name || String(d.title || "").replace(/ - .*$/, "").replace(/^Trato con /, "") || "");
    if (rol === "admin" || rol === "master") {
      await vRef.update({
        status: "sold", price: precio, soldAt: d.soldAt || hoyISO(),
        saleDetails: { ...planDe(d.saleDetails), price: precio, payments: d.saleDetails?.payments || [] },
        pendingValidation: null, soldDealId: dealId,
        ...(d.clientId ? { buyerId: d.clientId, soldToClientId: d.clientId } : {}),
        ...(nombre ? { buyerName: nombre } : {}),
        updatedAt: ahora,
      });
      return "vendido";
    }
    await vRef.update({
      pendingValidation: {
        type: "sold", requestedBy: null, requestedByName: "Trato ganado", clientId: d.clientId || null, dealId, clientName: nombre,
        originalPrice: Number(x.price) || 0, proposedPrice: precio, hasPriceChange: (Number(x.price) || 0) > 0 && Number(x.price) !== precio,
        saleDetails: { ...planDe(d.saleDetails), price: precio }, vehicle: String(d.vehicle || ""), requestedAt: ahora,
      },
    });
    return "solicitud";
  }

  /**
   * Reescribe la copia vieja (saleDetails.payments) en trato, contacto y auto
   * a partir de pagosVenta, y pone las tareas de cobro según el dinero real.
   */
  async function reflejar(db: any, dealId: string) {
    const ds = await db.collection("deals").doc(dealId).get();
    const d = ds.data();
    if (!d) return null;
    const pagos = await pagosDe(db, dealId);
    const activos = pagos.filter((p) => !p.anulado);
    // Las pantallas viejas suman payments como dinero: el descuento no va ahí.
    const lista = activos.filter((p) => p.concepto !== "descuento").sort((a, b) => a.fecha.localeCompare(b.fecha)).map(aFormaVieja);
    const plan = planDe(d.saleDetails);
    const ec = estadoDeCuenta(plan, pagos);
    const resumen = { pagado: ec.pagado, descontado: ec.descontado, saldo: ec.saldo, liquidada: ec.liquidada, actualizadoEn: new Date().toISOString() };

    if (d.saleDetails) await ds.ref.update({ "saleDetails.payments": lista, cuenta: resumen });
    if (d.clientId && idValido(String(d.clientId))) {
      const cRef = db.collection("clients").doc(String(d.clientId));
      const c = (await cRef.get()).data();
      // Las copias del contacto y del auto quedan iguales al trato: mismo plan, mismos pagos.
      if (c && c.ventaDealId === dealId && d.saleDetails) await cRef.update({ saleDetails: { ...plan, payments: lista } });
    }
    const auto = await autoDe(db, dealId, d);
    if (auto && d.saleDetails && (auto.datos.status === "sold" || auto.datos.saleDetails)) await auto.ref.update({ saleDetails: { ...plan, payments: lista } });

    await tareasDeCobro(db, dealId, d, ec, plan);
    return { pagos, ec };
  }

  /**
   * Las tareas de cobro siguen al plan y al dinero:
   *  - una por mensualidad del plan vigente (id fijo, así no se duplican);
   *  - hecha solo si esa mensualidad está cubierta por pagos reales;
   *  - si el plan cambió (otro plazo u otra fecha, o ya no es crédito), las
   *    pendientes que ya no corresponden se quitan. Las hechas se quedan.
   */
  async function tareasDeCobro(db: any, dealId: string, d: any, ec: any, plan: any) {
    if (!d.clientId || !idValido(String(d.clientId))) return;
    const clientId = String(d.clientId);
    const cliente = (await db.collection("clients").doc(clientId).get()).data() || {};
    const nombre = cliente.name || String(d.title || "").replace(/^Trato con /, "") || "cliente";
    const quiero = new Map<string, any>();
    if (ec.esCredito && plan.firstPaymentDate && ec.mensualidades.length) {
      const plazo = ec.mensualidades.length;
      const primera = String(plan.firstPaymentDate).slice(0, 10);
      for (const m of ec.mensualidades) {
        const id = `pago_${clientId}_${primera}_${plazo}_${m.n}`.replace(/[^\w-]/g, "_");
        quiero.set(id, { n: m.n, plazo, fecha: fechaDelPago(primera, m.n - 1), monto: m.monto, pagada: m.estado === "pagada" });
      }
    }
    const ts = await db.collection("tasks").where("clientId", "==", clientId).get();
    const deCredito = (await db.collection("deals").where("clientId", "==", clientId).get()).docs
      .filter((x: any) => x.data().saleDetails?.method === "credito" && x.data().agencyId === d.agencyId).length;
    const existentes = new Set<string>();
    const ahora = new Date().toISOString();
    for (const t of ts.docs) {
      const x = t.data();
      if (x.type !== "payment" || x.agencyId !== d.agencyId) continue;
      const deEsta = x.dealId === dealId || (!x.dealId && deCredito <= 1);
      if (!deEsta) continue;
      const q = quiero.get(t.id) || [...quiero.entries()].find(([, v]) => String(x.title || "").startsWith(`Pago ${v.n}/${v.plazo} `) && x.dueDate === v.fecha)?.[1];
      if (q) {
        existentes.add(`${q.n}`);
        const cambios: any = {};
        if (!!x.completed !== q.pagada) Object.assign(cambios, q.pagada ? { completed: true, completedAt: ahora, completadaPorPago: true } : { completed: false, completedAt: null, completadaPorPago: false });
        if (x.dealId !== dealId) cambios.dealId = dealId;
        if (Object.keys(cambios).length) await t.ref.update(cambios);
      } else if ((!x.completed || x.completadaPorPago) && /^Pago \d+\/\d+ /.test(String(x.title || ""))) {
        await t.ref.delete(); // de un plan anterior: sin cobrar, o marcada por el sistema (el pago sigue en la venta)
      }
    }
    for (const [id, q] of quiero) {
      if (existentes.has(`${q.n}`)) continue;
      await db.collection("tasks").doc(id).set({
        agencyId: d.agencyId, sellerId: d.sellerId || null, clientId, dealId,
        title: `Pago ${q.n}/${q.plazo} - Crédito de ${nombre}`,
        notes: `Monto a cobrar: $${Number(q.monto).toFixed(2)}`,
        dueDate: q.fecha, type: "payment", completed: q.pagada, ...(q.pagada ? { completedAt: ahora, completadaPorPago: true } : {}),
        createdAt: ahora,
      });
    }
  }

  async function quien(req: any, res: any) {
    const q = await usuarioQuePide(req, res);
    if (!q) return null;
    return { ...q, puedeCobrar: !ROLES_NO_COBRAN.has(q.rol), puedeDescontar: ROLES_DESCUENTAN.has(q.rol) };
  }

  /** Los pagos de una venta tal como se ven: los propios, o (si aún no se migró) las tres copias viejas juntas. */
  async function pagosLegibles(db: any, dealId: string, d: any, auto: any, cliente: any): Promise<PagoVenta[]> {
    if (d.pagosEnColeccion) return pagosDe(db, dealId);
    return fusionarPagosViejos(d.saleDetails?.payments, cliente?.ventaDealId === dealId ? cliente?.saleDetails?.payments : null, auto?.datos?.saleDetails?.payments)
      .map((p: any) => ({ ...deFormaVieja(p, d.saleDetails?.method === "credito"), id: String(p.id || Math.random()) })) as PagoVenta[];
  }

  /**
   * Enganche que quien registró la venta anotó (crédito bancario: la agencia lo recibe) pero que nadie ha registrado como
   * pago. No cuenta como dinero cobrado hasta que un administrador lo confirme; mientras tanto se muestra aparte y avisa.
   */
  function engancheDeclaradoDe(d: any, pagos: PagoVenta[]): { monto: number; declarado: number } | null {
    const plan: any = planDe(d.saleDetails);
    const declarado = Number(plan.downPayment) || 0;
    if (plan.method !== "credito_bancario" || !(declarado > 0) || d.engancheDescartado) return null;
    const recibido = pagos.filter((p: any) => !p.anulado && p.concepto === "enganche").reduce((t: number, p: any) => t + (Number(p.monto) || 0), 0);
    if (recibido + 0.5 >= declarado) return null;
    if (estadoDeCuenta(plan, pagos, hoyISO()).saldo <= 0.5) return null;
    return { monto: Math.round((declarado - recibido) * 100) / 100, declarado };
  }

  // ---------- Leer la venta completa ----------
  app.get("/api/ventas/:dealId", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    try {
      const t = await tratoDe(q, String(req.params.dealId || ""));
      if (!t) return res.status(404).json({ error: "No encontramos esa venta." });
      const d = t.datos;
      // Abrir una venta antigua que dejó el auto disponible lo corrige (solo si quien la abre puede confirmarla y la venta es de los últimos 60 días).
      if ((q.rol === "admin" || q.rol === "master") && Date.now() - Date.parse(`${String(d.soldAt || "").slice(0, 10)}T12:00:00`) < 60 * 864e5) await asegurarAutoVendido(q.adminDb, t.ref.id, q.rol);
      const auto = await autoDe(q.adminDb, t.ref.id, d);
      const cliente = d.clientId && idValido(String(d.clientId)) ? (await q.adminDb.collection("clients").doc(String(d.clientId)).get()).data() : null;
      // Ver no migra: lo viejo (las tres copias juntas, como se migrará) se muestra tal cual hasta que alguien registre algo.
      const pagos = await pagosLegibles(q.adminDb, t.ref.id, d, auto, cliente);
      const ag = (await q.adminDb.collection("agencies").doc(d.agencyId).get()).data() || {};
      const plan = planDe(d.saleDetails);
      const cuenta = estadoDeCuenta(plan, pagos, hoyISO());
      const engancheDeclarado = engancheDeclaradoDe(d, pagos);
      res.json({
        venta: {
          dealId: t.ref.id,
          estado: d.status || "",
          vendidoEl: d.soldAt || "",
          cliente: cliente ? { id: d.clientId, nombre: cliente.name || "", telefono: cliente.phone || "" } : { id: d.clientId || null, nombre: d.title || "", telefono: "" },
          auto: auto ? { id: auto.ref.id, nombre: `${auto.datos.year || ""} ${auto.datos.make || ""} ${auto.datos.model || ""}`.replace(/\s+/g, " ").trim(), vin: auto.datos.vin || "", foto: (auto.datos.photoUrls || [])[0] || auto.datos.photoUrl || "", color: auto.datos.color || "", km: Number(auto.datos.km) || null, transmision: auto.datos.transmission || "", placas: auto.datos.licensePlate || "", carroceria: auto.datos.bodyType || "", precioLista: Number(auto.datos.price) || null } : (d.vehicle ? { id: null, nombre: String(d.vehicle) } : null),
          agencia: { nombre: ag.name || "", logo: ag.logoUrl || "", direccion: ag.address || "", telefono: ag.phone || "" },
          plan,
          tienePlan: !!d.saleDetails,
          pagos: pagos.sort((a: any, b: any) => `${b.fecha}|${b.registradoEn || ""}`.localeCompare(`${a.fecha}|${a.registradoEn || ""}`)),
          cuenta: estadoDeCuenta(plan, pagos, hoyISO()),
          engancheDeclarado,
        },
        puedeCobrar: q.puedeCobrar,
        puedeDescontar: q.puedeDescontar,
      });
    } catch (e) {
      console.error("ventas/leer:", e);
      res.status(500).json({ error: "No se pudo leer la venta." });
    }
  });

  // ---------- Registrar un pago ----------
  app.post("/api/ventas/:dealId/pagos", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    if (!q.puedeCobrar) return res.status(403).json({ error: "Solo un administrador puede registrar pagos." });
    const b = req.body || {};
    const monto = Math.round((Number(b.monto) || 0) * 100) / 100;
    const fecha = String(b.fecha || "");
    const concepto = String(b.concepto || "") as ConceptoPago;
    const forma = String(b.forma || "");
    if (!(monto > 0) || monto > 50_000_000) return res.status(400).json({ error: "Pon un monto válido." });
    if (!fechaValida(fecha)) return res.status(400).json({ error: "Pon la fecha del pago." });
    if (!CONCEPTOS.has(concepto)) return res.status(400).json({ error: "Elige qué se está pagando." });
    if (!FORMAS.has(forma)) return res.status(400).json({ error: "Elige la forma de pago." });
    // Una misma petición repetida (doble clic, red lenta) no registra dos pagos.
    const clave = textoCorto(b.clave, 64);
    if (clave && !idValido(clave)) return res.status(400).json({ error: "Petición no válida." });
    try {
      const t = await tratoDe(q, String(req.params.dealId || ""));
      if (!t) return res.status(404).json({ error: "No encontramos esa venta." });
      if (!t.datos.saleDetails) return res.status(409).json({ error: "Primero registra la venta (precio y forma de pago)." });
      await asegurarMigrado(q.adminDb, t.ref.id);
      // Solo se devuelve lo que el cliente pagó de más.
      if (concepto === "devolucion") {
        const ec = estadoDeCuenta(planDe(t.datos.saleDetails), await pagosDe(q.adminDb, t.ref.id));
        if (monto > ec.aFavor + 0.5) return res.status(409).json({ error: `Solo se puede devolver lo que el cliente pagó de más (${ec.aFavor.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}).` });
      }
      const ref = clave ? col(q.adminDb).doc(`p_${t.ref.id}_${clave}`) : col(q.adminDb).doc();
      const pago = {
        dealId: t.ref.id, agencyId: t.datos.agencyId, clientId: t.datos.clientId || null,
        monto, fecha, forma, concepto,
        ...(textoCorto(b.nota) ? { nota: textoCorto(b.nota) } : {}),
        registradoPor: q.uid, registradoPorNombre: await nombreDe(q.adminDb, q.uid), registradoEn: new Date().toISOString(), origen: "crm",
      };
      const nuevo = await q.adminDb.runTransaction(async (tx: any) => {
        if ((await tx.get(ref)).exists) return false;
        tx.set(ref, pago);
        return true;
      });
      const r = await reflejar(q.adminDb, t.ref.id);
      res.json({ ok: true, id: ref.id, repetido: !nuevo, cuenta: r?.ec });
    } catch (e) {
      console.error("ventas/pagar:", e);
      res.status(500).json({ error: "No se pudo registrar el pago. Intenta de nuevo." });
    }
  });

  // ---------- Enganches por confirmar de toda la agencia (para el aviso de la campanita) ----------
  app.get("/api/ventas-pendientes/enganches", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    if (!q.puedeCobrar || !q.agencyId) return res.json({ pendientes: [] });
    try {
      const snap = await q.adminDb.collection("deals").where("agencyId", "==", q.agencyId).where("saleDetails.method", "==", "credito_bancario").get();
      const pendientes: any[] = [];
      for (const doc of snap.docs.slice(0, 300)) {
        const d = doc.data();
        if (!(Number(d.saleDetails?.downPayment) > 0) || d.engancheDescartado) continue;
        const auto = d.pagosEnColeccion ? null : await autoDe(q.adminDb, doc.id, d);
        const cliente = !d.pagosEnColeccion && d.clientId && idValido(String(d.clientId)) ? (await q.adminDb.collection("clients").doc(String(d.clientId)).get()).data() : null;
        const e = engancheDeclaradoDe(d, await pagosLegibles(q.adminDb, doc.id, d, auto, cliente));
        if (e) pendientes.push({ dealId: doc.id, cliente: String(cliente?.name || d.title || "").replace(/^Trato con /, "") || "Cliente", auto: String(d.vehicle || ""), monto: e.monto, vendidoEl: d.soldAt || "", vendedorId: d.sellerId || "" });
      }
      res.json({ pendientes });
    } catch (e) {
      console.error("ventas/enganches-pendientes:", e);
      res.status(500).json({ error: "No se pudo revisar los enganches." });
    }
  });

  // ---------- «No se recibió»: descartar el enganche que se anotó al registrar la venta ----------
  app.post("/api/ventas/:dealId/enganche/descartar", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    if (!q.puedeCobrar) return res.status(403).json({ error: "Solo un administrador puede confirmar o descartar un enganche." });
    try {
      const t = await tratoDe(q, String(req.params.dealId || ""));
      if (!t) return res.status(404).json({ error: "No encontramos esa venta." });
      await t.ref.update({ engancheDescartado: { por: q.uid, porNombre: await nombreDe(q.adminDb, q.uid), en: new Date().toISOString(), monto: Number(t.datos.saleDetails?.downPayment) || 0 } });
      res.json({ ok: true });
    } catch (e) {
      console.error("ventas/enganche-descartar:", e);
      res.status(500).json({ error: "No se pudo descartar el enganche." });
    }
  });

  // ---------- Liquidar antes de tiempo ----------
  // El monto lo calcula el servidor con la misma regla que ve la pantalla; si
  // no coincide (alguien registró otro pago mientras tanto), se pide revisar.
  app.post("/api/ventas/:dealId/liquidar", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    if (!q.puedeCobrar) return res.status(403).json({ error: "Solo un administrador puede registrar pagos." });
    const b = req.body || {};
    const fecha = String(b.fecha || "");
    const forma = String(b.forma || "");
    const descontar = !!b.descontarIntereses;
    const clave = textoCorto(b.clave, 64);
    if (!fechaValida(fecha)) return res.status(400).json({ error: "Pon la fecha del pago." });
    if (!FORMAS.has(forma)) return res.status(400).json({ error: "Elige la forma de pago." });
    if (!clave || !idValido(clave)) return res.status(400).json({ error: "Petición no válida." });
    if (descontar && !q.puedeDescontar) return res.status(403).json({ error: "Solo un administrador o gerente puede descontar intereses." });
    try {
      const t = await tratoDe(q, String(req.params.dealId || ""));
      if (!t) return res.status(404).json({ error: "No encontramos esa venta." });
      if (t.datos.saleDetails?.method !== "credito") return res.status(409).json({ error: "Solo un crédito de la casa se liquida así." });
      await asegurarMigrado(q.adminDb, t.ref.id);
      const pagos = await pagosDe(q.adminDb, t.ref.id);
      const l = liquidacionAnticipada(planDe(t.datos.saleDetails), pagos, fecha);
      if (!l) return res.status(409).json({ error: "Este crédito ya está liquidado." });
      const monto = descontar ? l.conDescuento : l.sinDescuento;
      if (Math.abs(monto - Number(b.montoEsperado || 0)) > 1) return res.status(409).json({ error: "El saldo cambió mientras tanto. Revisa el monto y vuelve a intentarlo.", liquidacion: l });
      const nombre = await nombreDe(q.adminDb, q.uid);
      const comun = { dealId: t.ref.id, agencyId: t.datos.agencyId, clientId: t.datos.clientId || null, fecha, registradoPor: q.uid, registradoPorNombre: nombre, registradoEn: new Date().toISOString(), origen: "crm" };
      const refPago = col(q.adminDb).doc(`p_${t.ref.id}_${clave}`);
      const refDesc = col(q.adminDb).doc(`p_${t.ref.id}_${clave}_d`);
      const nota = textoCorto(b.nota);
      const nuevo = await q.adminDb.runTransaction(async (tx: any) => {
        if ((await tx.get(refPago)).exists) return false;
        tx.set(refPago, { ...comun, monto, forma, concepto: "liquidacion", nota: nota || (descontar ? "Liquidación anticipada (sin intereses futuros)" : "Liquidación anticipada") });
        if (descontar && l.interesFuturo > 0) {
          tx.set(refDesc, { ...comun, monto: l.interesFuturo, forma: "otro", concepto: "descuento", nota: `Intereses no generados por liquidar antes (autorizó ${nombre})` });
        }
        return true;
      });
      const r = await reflejar(q.adminDb, t.ref.id);
      res.json({ ok: true, repetido: !nuevo, cuenta: r?.ec });
    } catch (e) {
      console.error("ventas/liquidar:", e);
      res.status(500).json({ error: "No se pudo registrar la liquidación." });
    }
  });

  // ---------- Anular un pago (no se borra) ----------
  app.post("/api/ventas/:dealId/pagos/:pid/anular", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    if (!q.puedeCobrar) return res.status(403).json({ error: "Solo un administrador puede anular pagos." });
    const motivo = textoCorto(req.body?.motivo, 200);
    if (!motivo) return res.status(400).json({ error: "Escribe por qué se anula." });
    const pid = String(req.params.pid || "");
    if (!idValido(pid)) return res.status(400).json({ error: "Pago no válido." });
    try {
      const t = await tratoDe(q, String(req.params.dealId || ""));
      if (!t) return res.status(404).json({ error: "No encontramos esa venta." });
      await asegurarMigrado(q.adminDb, t.ref.id);
      // El id que ve la pantalla antes de migrar es el viejo: se busca su copia.
      let ref = col(q.adminDb).doc(pid);
      let p = (await ref.get()).data();
      if (!p) { ref = col(q.adminDb).doc(`m_${t.ref.id}_${pid}`); p = (await ref.get()).data(); }
      if (!p || p.dealId !== t.ref.id) return res.status(404).json({ error: "No encontramos ese pago." });
      if (p.anulado) return res.json({ ok: true });
      if (p.concepto === "descuento") return res.status(409).json({ error: "El descuento se quita anulando la liquidación que lo generó." });
      const anulacion = { anulado: true, motivoAnulacion: motivo, anuladoPor: q.uid, anuladoPorNombre: await nombreDe(q.adminDb, q.uid), anuladoEn: new Date().toISOString() };
      await ref.update(anulacion);
      // Si era una liquidación con descuento de intereses, el descuento se va con ella.
      const desc = col(q.adminDb).doc(`${ref.id}_d`);
      if (p.concepto === "liquidacion" && (await desc.get()).exists) await desc.update(anulacion);
      const r = await reflejar(q.adminDb, t.ref.id);
      res.json({ ok: true, cuenta: r?.ec });
    } catch (e) {
      console.error("ventas/anular:", e);
      res.status(500).json({ error: "No se pudo anular el pago." });
    }
  });

  // ---------- Eliminar una venta hecha por error ----------
  //
  // Los pagos no se borran: se anulan con motivo, como siempre. Lo demás se
  // deshace en los tres lugares donde vive la venta: el trato vuelve a una etapa
  // abierta, el contacto deja de figurar como comprador y el auto vuelve a estar
  // disponible. Las tareas de cobro pendientes se quitan. Queda constancia en el
  // propio trato (ventaEliminada).
  app.post("/api/ventas/:dealId/eliminar", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    if (!q.puedeCobrar) return res.status(403).json({ error: "Solo un administrador puede eliminar una venta." });
    const motivo = textoCorto(req.body?.motivo, 200);
    if (!motivo) return res.status(400).json({ error: "Escribe por qué se elimina la venta." });
    try {
      const db = q.adminDb;
      const t = await tratoDe(q, String(req.params.dealId || ""));
      if (!t) return res.status(404).json({ error: "No encontramos esa venta." });
      const dealId = t.ref.id;
      const d = t.datos;
      await asegurarMigrado(db, dealId);
      const ahora = new Date().toISOString();
      const nombre = await nombreDe(db, q.uid);

      // 1. Los pagos se anulan (no se borran).
      const anulacion = { anulado: true, motivoAnulacion: `Venta eliminada: ${motivo}`, anuladoPor: q.uid, anuladoPorNombre: nombre, anuladoEn: ahora };
      let anulados = 0;
      for (const p of await pagosDe(db, dealId)) {
        if (p.anulado) continue;
        await col(db).doc(p.id).update(anulacion);
        anulados++;
      }

      // 2. Las tareas de cobro pendientes ya no tienen sentido.
      const tareas = await db.collection("tasks").where("dealId", "==", dealId).get();
      for (const tk of tareas.docs) {
        const x = tk.data();
        // Cobros y seguimiento de postventa pendientes: una venta que se elimina no los necesita.
        if (!x.completed && (x.type === "payment" || x.postventa === true)) await tk.ref.delete();
      }

      // 3. El auto vuelve a estar disponible (solo si esta venta es la suya).
      const auto = await autoDe(db, dealId, d);
      if (auto && auto.datos.status === "sold") {
        await auto.ref.update({ status: "available", saleDetails: null, soldAt: null, buyerId: null, buyerName: null, soldToClientId: null, soldDealId: null, pendingValidation: null, updatedAt: ahora });
      }

      // 4. El trato vuelve a la primera etapa abierta del embudo.
      const ag = (await db.collection("agencies").doc(d.agencyId).get()).data() || {};
      const etapas: any[] = Array.isArray(ag.pipelineStages) ? ag.pipelineStages : [];
      const abierta = etapas.find((e) => !checkIsWon(e.id, etapas) && !checkIsLost(e.id, etapas));
      const nuevaEtapa = abierta?.id || "new";
      await t.ref.update({
        saleDetails: null, soldAt: null, cuenta: null, status: nuevaEtapa, updatedAt: ahora, postventaSembrada: null,
        ventaEliminada: { el: ahora, por: q.uid, porNombre: nombre, motivo, precio: Number(d.saleDetails?.price) || Number(d.value) || 0, pagosAnulados: anulados },
      });

      // 5. El contacto deja de figurar como comprador de esta venta.
      if (d.clientId && idValido(String(d.clientId))) {
        const cRef = db.collection("clients").doc(String(d.clientId));
        const c = (await cRef.get()).data();
        if (c && (!c.ventaDealId || c.ventaDealId === dealId)) {
          await cRef.update({ saleDetails: null, soldAt: null, ventaDealId: null, dealValue: null, status: nuevaEtapa, updatedAt: ahora });
        }
      }
      res.json({ ok: true, pagosAnulados: anulados });
    } catch (e) {
      console.error("ventas/eliminar:", e);
      res.status(500).json({ error: "No se pudo eliminar la venta." });
    }
  });

  // ---------- Después de guardar la venta (trato ganado, cambio de plan) ----------
  // Las pantallas que guardan la venta reescriben saleDetails completo; esto
  // vuelve a poner los pagos y las tareas en su lugar.
  app.post("/api/ventas/:dealId/reflejar", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    try {
      const t = await tratoDe(q, String(req.params.dealId || ""));
      if (!t) return res.status(404).json({ error: "No encontramos esa venta." });
      await asegurarMigrado(q.adminDb, t.ref.id);
      await asegurarAutoVendido(q.adminDb, t.ref.id, q.rol);
      const r = await reflejar(q.adminDb, t.ref.id);
      res.json({ ok: true, cuenta: r?.ec });
    } catch (e) {
      console.error("ventas/reflejar:", e);
      res.status(500).json({ error: "No se pudo actualizar la venta." });
    }
  });

  return { asegurarMigrado, asegurarAutoVendido, reflejar, pagosDe, autoDe };
}
