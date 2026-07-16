import re

path = "src/components/ClientDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

# Let's find exactly the end of the file.
end_marker = "      )}\n</div>\n    </div>\n  );\n}"

if end_marker in content:
    content = content.replace(end_marker, "      )}\n    </div>\n  );\n}")
else:
    # try variations
    content = re.sub(r'      \)}\n</div>\n    </div>\n  \);\n}', '      )}\n    </div>\n  );\n}', content)
    
with open(path, "w") as f:
    f.write(content)

