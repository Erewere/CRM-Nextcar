import os

path = "src/components/VehicleDetailModal.tsx"
with open(path, "r") as f:
    content = f.read()

insert_point = "  useEffect(() => {\n    if (userData?.role === 'master') {"

sync_effect = """  useEffect(() => {
    if (!isNew && vehicle) {
      setFormData({ ...vehicle });
    }
  }, [vehicle, isNew]);

"""

if sync_effect not in content:
    content = content.replace(insert_point, sync_effect + insert_point)
    with open(path, "w") as f:
        f.write(content)
    print("Added formData sync useEffect successfully")
else:
    print("formData sync useEffect already exists")

