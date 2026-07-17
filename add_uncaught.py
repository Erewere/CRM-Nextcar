import os
path = "server.ts"
with open(path, "r") as f:
    content = f.read()

handler = """
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  require('fs').writeFileSync('crash.log', String(err.stack));
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  require('fs').writeFileSync('crash.log', String(reason));
});
"""
content = handler + content
with open(path, "w") as f:
    f.write(content)
print("Done")
