import os
path = "server.ts"
with open(path, "r") as f:
    content = f.read()

bad_str = """
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  require('fs').writeFileSync('crash.log', String(err.stack));
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  require('fs').writeFileSync('crash.log', String(reason));
});
"""

if bad_str in content:
    content = content.replace(bad_str, "")
    with open(path, "w") as f:
        f.write(content)
    print("Fixed uncaught")
else:
    print("Not found")

