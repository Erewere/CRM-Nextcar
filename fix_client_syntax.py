import os

path = "src/components/ClientDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# find the end of NewActivityModal
if "/>\n</div>\n    </div>\n  );\n}" in content:
    content = content.replace("/>\n</div>\n    </div>\n  );\n}", "/>\n      )}\n    </div>\n  );\n}")

with open(path, "w") as f:
    f.write(content)
