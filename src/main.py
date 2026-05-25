import json
import os

folder_path = 'data'

def get_usernames(file_name, key):
    file_path = os.path.join(folder_path, f"{file_name}.json")
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    usernames = set()
    
    if key == 'following':
        target_list = data['relationships_following']
    else:
        target_list = data
    
    for item in target_list:
        try:
            if 'string_list_data' in item and len(item['string_list_data']) > 0:
                value = item['string_list_data'][0].get('value')
                if value:
                    usernames.add(value)
        except (KeyError, IndexError, TypeError):
            continue
    
    return usernames

def get_all_followers():
    usernames = set()
    i = 1
    while True:
        file_path = os.path.join(folder_path, f"followers_{i}.json")
        if not os.path.exists(file_path):
            break
        print(f"Lendo followers_{i}.json...")
        usernames.update(get_usernames(f'followers_{i}', 'followers'))
        i += 1
    return usernames

try:
    print("Carregando dados...\n")
    seguidores = get_all_followers()
    seguindo = get_usernames('following', 'following')
    
    nao_seguem_volta = seguindo - seguidores
    
    print(f"\nSeguidores: {len(seguidores)}")
    print(f"Seguindo: {len(seguindo)}")
    print(f"Nao te seguem de volta: {len(nao_seguem_volta)}\n")
    
    for user in sorted(nao_seguem_volta):
        print(f"https://instagram.com/{user}/")

except Exception as e:
    print(f"Erro ao ler arquivos: {e}")
    print("Verifique se os nomes dos arquivos na pasta /data estao identicos aos da imagem.")
