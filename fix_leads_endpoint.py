import os

path = "server.ts"
with open(path, "r") as f:
    content = f.read()

old_endpoint = """  app.post("/api/public/v1/leads", express.json(), async (req, res) => {
    try {
      const { agencyId, name, phone, email, vehicle, origin, sellerId } = req.body;
      
      if (!agencyId || !name) {
        return res.status(400).json({ error: "agencyId and name are required" });
      }

      const db = getClientDb();
      const newClient = {
        agencyId,
        name,
        phone: phone || "",
        email: email || "",
        address: "",
        vehicle: vehicle || "",
        status: "new",
        origin: origin || "virtual_assistant",
        sellerId: sellerId || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "clients"), newClient);
      res.status(201).json({ success: true, leadId: docRef.id });
    } catch (e) {
      console.error("Error creating public lead:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });"""

new_endpoint = """  app.post("/api/public/v1/leads", express.json(), async (req, res) => {
    try {
      const { agencyId, name, phone, email, vehicle, origin, sellerId } = req.body;
      
      if (!agencyId || !name) {
        return res.status(400).json({ error: "agencyId and name are required" });
      }

      const db = getClientDb();
      const clientsRef = collection(db, "clients");
      
      // Validar duplicados por teléfono
      if (phone) {
         const qPhone = query(clientsRef, where("agencyId", "==", agencyId), where("phone", "==", phone));
         const snapPhone = await getDocs(qPhone);
         if (!snapPhone.empty) {
             // Ya existe un cliente con este teléfono
             return res.status(200).json({ success: true, leadId: snapPhone.docs[0].id, message: "Lead already exists with this phone" });
         }
      }
      
      // Validar duplicados por email
      if (email) {
         const qEmail = query(clientsRef, where("agencyId", "==", agencyId), where("email", "==", email));
         const snapEmail = await getDocs(qEmail);
         if (!snapEmail.empty) {
             // Ya existe un cliente con este correo
             return res.status(200).json({ success: true, leadId: snapEmail.docs[0].id, message: "Lead already exists with this email" });
         }
      }

      const newClient = {
        agencyId,
        name,
        phone: phone || "",
        email: email || "",
        address: "",
        vehicle: vehicle || "",
        status: "new",
        origin: origin || "virtual_assistant",
        sellerId: sellerId || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(clientsRef, newClient);
      res.status(201).json({ success: true, leadId: docRef.id });
    } catch (e) {
      console.error("Error creating public lead:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });"""

if old_endpoint in content:
    content = content.replace(old_endpoint, new_endpoint)
    with open(path, "w") as f:
        f.write(content)
    print("Updated leads endpoint successfully")
else:
    print("Endpoint not found")
