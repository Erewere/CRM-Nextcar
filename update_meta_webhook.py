import os

path = "server.ts"
with open(path, "r") as f:
    content = f.read()

old_webhook = """  // 2. Webhook Payload parsing (POST)
  app.post("/api/meta/webhook", async (req, res) => {
    const body = req.body;
    if (body.object === "whatsapp_business_account" || body.object === "page") {
      try {
        const adminDb = getClientDb();
        for (const entry of body.entry) {
          // For WhatsApp
          if (body.object === "whatsapp_business_account" && entry.changes) {
            for (const change of entry.changes) {
              const value = change.value;
              if (value && value.messages && value.messages[0]) {
                const phone = value.contacts?.[0]?.wa_id || "";
                const name =
                  value.contacts?.[0]?.profile?.name || "Unknown WA Lead";
                const text = value.messages[0]?.text?.body || "";
                console.log(
                  `New incoming WA message from ${name} (${phone}): ${text}`,
                );
                await createMetaLead(adminDb, name, phone, "whatsapp", text);
              }
            }
          }
          // For Messenger
          if (body.object === "page" && entry.messaging) {
            for (const event of entry.messaging) {
              const senderId = event.sender?.id || "";
              const text = event.message?.text || "";
              if (senderId && text) {
                console.log(
                  `New incoming Messenger message from ${senderId}: ${text}`,
                );
                await createMetaLead(
                  adminDb,
                  `Messenger Lead (${senderId})`,
                  "",
                  "messenger",
                  text,
                );
              }
            }
          }
        }
        res.sendStatus(200);
      } catch (e) {
        console.error("Error processing meta payload:", e);
        res.sendStatus(500);
      }
    } else {
      res.sendStatus(404);
    }
  });

  async function createMetaLead(
    adminDb: any,
    name: string,
    phone: string,
    origin: string,
    text: string,
  ) {
    // In a real multi-tenant app, map the phone or page ID to the correct agencyId.
    // For now we'll assign to a default or find the first admin agency.
    let agencyId = "DEFAULT_AGENCY";

    const newClient = {
      agencyId,
      name,
      address: `Lead from ${origin}`,
      phone,
      email: "",
      vehicle: text.substring(0, 100),
      status: "new",
      origin: origin,
      sellerId: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await addDoc(collection(adminDb, "clients"), newClient);
  }"""

new_webhook = """  // 2. Webhook Payload parsing (POST)
  app.post("/api/meta/webhook", async (req, res) => {
    const body = req.body;
    if (body.object === "whatsapp_business_account" || body.object === "page") {
      try {
        const adminDb = getClientDb();
        for (const entry of body.entry) {
          const entryId = entry.id; // page_id for Messenger, waba_id for WhatsApp
          let agencyId = "DEFAULT_AGENCY";
          
          // Consultar la agencia correspondiente al page_id o waba_id
          const agenciesRef = collection(adminDb, "agencies");
          // Para soportar múltiples agencias, buscamos cuál tiene este facebookPageId
          const q = query(agenciesRef, where("facebookPageId", "==", entryId));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            agencyId = snapshot.docs[0].id;
          } else if (entryId === "604166786115980") {
             // Fallback default for testing specifically asked by user
             agencyId = "k77PpUc4SKDVCps2qSDw";
          }

          // For WhatsApp
          if (body.object === "whatsapp_business_account" && entry.changes) {
            for (const change of entry.changes) {
              const value = change.value;
              if (value && value.messages && value.messages[0]) {
                const phone = value.contacts?.[0]?.wa_id || "";
                const name =
                  value.contacts?.[0]?.profile?.name || "Unknown WA Lead";
                const text = value.messages[0]?.text?.body || "";
                console.log(
                  `New incoming WA message from ${name} (${phone}): ${text}`,
                );
                await createMetaLead(adminDb, agencyId, name, phone, "whatsapp", text);
              }
            }
          }
          // For Messenger
          if (body.object === "page" && entry.messaging) {
            for (const event of entry.messaging) {
              const senderId = event.sender?.id || "";
              const text = event.message?.text || "";
              if (senderId && text) {
                console.log(
                  `New incoming Messenger message from ${senderId} to page ${entryId}: ${text}`,
                );
                await createMetaLead(
                  adminDb,
                  agencyId,
                  `Messenger Lead (${senderId})`,
                  "",
                  "messenger",
                  text,
                );
              }
            }
          }
        }
        res.sendStatus(200);
      } catch (e) {
        console.error("Error processing meta payload:", e);
        res.sendStatus(500);
      }
    } else {
      res.sendStatus(404);
    }
  });

  async function createMetaLead(
    adminDb: any,
    agencyId: string,
    name: string,
    phone: string,
    origin: string,
    text: string,
  ) {
    const clientsRef = collection(adminDb, "clients");
    
    // Evitar duplicados por teléfono en Meta Lead (WA)
    if (phone) {
       const qPhone = query(clientsRef, where("agencyId", "==", agencyId), where("phone", "==", phone));
       const snapPhone = await getDocs(qPhone);
       if (!snapPhone.empty) {
           console.log("Lead ya existe con este teléfono:", phone);
           return;
       }
    }

    const newClient = {
      agencyId,
      name,
      address: `Lead from ${origin}`,
      phone,
      email: "",
      vehicle: text.substring(0, 100),
      status: "new",
      origin: origin,
      sellerId: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await addDoc(clientsRef, newClient);
  }"""

if old_webhook in content:
    content = content.replace(old_webhook, new_webhook)
    with open(path, "w") as f:
        f.write(content)
    print("Replaced webhook logic successfully")
else:
    print("Webhook logic not found, checking if already updated...")
