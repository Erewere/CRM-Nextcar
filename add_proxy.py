import os

path = "server.ts"
with open(path, "r") as f:
    content = f.read()

proxy_endpoint = """  app.get("/api/proxy-image", async (req, res) => {
    try {
      const url = req.query.url;
      if (!url || typeof url !== 'string') {
        return res.status(400).send("Missing url");
      }
      const fetchRes = await fetch(url);
      if (!fetchRes.ok) {
        return res.status(fetchRes.status).send("Error fetching image");
      }
      const buffer = await fetchRes.arrayBuffer();
      res.set('Content-Type', fetchRes.headers.get('content-type') || 'image/jpeg');
      // Set CORS headers just in case
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cache-Control', 'public, max-age=31536000');
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("Proxy error:", err);
      res.status(500).send("Error fetching image");
    }
  });"""

if "/api/proxy-image" not in content:
    content = content.replace("app.post(\"/api/ai-advisor\"", proxy_endpoint + "\n\n  app.post(\"/api/ai-advisor\"")
    with open(path, "w") as f:
        f.write(content)
    print("Added proxy endpoint")
else:
    print("Proxy already exists")
