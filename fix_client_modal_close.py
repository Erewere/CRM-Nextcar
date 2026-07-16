import re

path = "src/components/ClientDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# Replace the closing div before the NewActivityModal
old = """            </div>
          </div>
        </div>
        )}
            {/* New Activity Modal */}"""

new = """            </div>
          </div>
        </div>
        )}
      </motion.div>
            {/* New Activity Modal */}"""

content = content.replace(old, new)
with open(path, "w") as f:
    f.write(content)

