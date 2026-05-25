import json
import os

folder_path = 'data'
file_path = os.path.join(folder_path, 'followers_1.json')

with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Mostra os primeiros 2 itens
print("Primeiros 2 itens do arquivo:")
print(json.dumps(data[:2], indent=2, ensure_ascii=False))