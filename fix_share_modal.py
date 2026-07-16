import os

path = "src/components/ShareVehicleModal.tsx"
with open(path, "r") as f:
    content = f.read()

# Replace the closing div with motion.div
if '      </div>\n    </div>\n  );\n}' in content:
    content = content.replace('      </div>\n    </div>\n  );\n}', '      </motion.div>\n    </div>\n  );\n}')

with open(path, "w") as f:
    f.write(content)

