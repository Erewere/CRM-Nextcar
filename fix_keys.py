import re

path = "src/components/ClientDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# Replace .map((p) => ( to .map((p, i) => (
content = content.replace('.map((p) => (\n                              <div\n                                key={`person-${p.id}`}', 
                          '.map((p, i) => (\n                              <div\n                                key={`person-${p.id}-${i}`}')

content = content.replace('.map((p) => (\n                          <option key={`person-${p.id}`} value={p.email}>',
                          '.map((p, i) => (\n                          <option key={`person-${p.id}-${i}`} value={p.email}>')

with open(path, "w") as f:
    f.write(content)
