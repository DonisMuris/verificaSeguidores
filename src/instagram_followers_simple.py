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

try:
    seguidores = get_usernames('followers_1', 'followers')
    seguindo = get_usernames('following', 'following')
    
    nao_seguem_volta = seguindo - seguidores
    
    print(f"Seguidores: {len(seguidores)}")
    print(f"Seguindo: {len(seguindo)}")
    print(f"Nao te seguem de volta: {len(nao_seguem_volta)}\n")
    
    for user in sorted(nao_seguem_volta):
        print(f"https://instagram.com/{user}/")

except Exception as e:
    print(f"Erro ao ler arquivos: {e}")
    print("Verifique se os nomes dos arquivos na pasta /data estao identicos aos da imagem.")
