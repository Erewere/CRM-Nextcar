import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # We want to replace { id: d.id, ...d.data() } with { ...d.data(), id: d.id }
    # Also handle {id: d.id, ...d.data()}
    # We can use regex: \{\s*id:\s*([a-zA-Z0-9_]+)\.id\s*,\s*\.\.\.([a-zA-Z0-9_]+)\.data\(\)\s*\}
    
    # Let's write a generic regex for this specific pattern:
    new_content = re.sub(
        r'\{\s*id:\s*([a-zA-Z0-9_]+)\.id\s*,\s*\.\.\.([a-zA-Z0-9_]+)\.data\(\)\s*\}',
        r'{ ...\2.data(), id: \1.id }',
        content
    )
    
    if content != new_content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Fixed {filepath}")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.ts') or file.endswith('.tsx'):
            fix_file(os.path.join(root, file))

