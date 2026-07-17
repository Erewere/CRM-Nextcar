import os
path = "server.ts"
with open(path, "r") as f:
    content = f.read()

bad_str = 'console.error("Error creating public lead:", e); require("fs").writeFileSync("lead-error.log", e.toString() + "\\n" + e.stack);\n      res.status(500).json({ error: "Internal server error" });'
good_str = 'res.status(500).json({ error: e.message, stack: e.stack });'

if bad_str in content:
    content = content.replace(bad_str, good_str)
    with open(path, "w") as f:
        f.write(content)
    print("Fixed")
else:
    print("Not found")

