import os

path = "server.ts"
with open(path, "r") as f:
    content = f.read()

api_code = """
  // === Public API for Virtual Assistants ===
  app.get("/api/public/v1/inventory", async (req, res) => {
    try {
      const agencyId = req.query.agencyId as string;
      if (!agencyId) {
        return res.status(400).json({ error: "agencyId is required" });
      }

      const db = getClientDb();
      const vehiclesRef = collection(db, "vehicles");
      const q = query(vehiclesRef, where("agencyId", "==", agencyId), where("status", "==", "available"));
      const snapshot = await getDocs(q);

      const vehicles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ vehicles });
    } catch (e) {
      console.error("Error fetching public inventory:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/public/v1/leads", express.json(), async (req, res) => {
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
  });

"""

if "Public API for Virtual Assistants" not in content:
    content = content.replace("  // === Vite Middleware for development ===", api_code + "  // === Vite Middleware for development ===")
    with open(path, "w") as f:
        f.write(content)
    print("API added")
else:
    print("API already exists")
