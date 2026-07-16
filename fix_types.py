import os

path = "src/types.ts"
with open(path, "r") as f:
    content = f.read()

if "websiteUrl?: string;" not in content:
    content = content.replace("vin: string;\n  status: string;", "vin: string;\n  websiteUrl?: string;\n  status: string;")
    with open(path, "w") as f:
        f.write(content)
    print("Added websiteUrl to Vehicle type")
else:
    print("websiteUrl already exists in Vehicle type")
