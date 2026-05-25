import json
import os

folder_path = 'data'

def get_usernames(file_name, key=None):
    """Extrai nomes de usuário de um arquivo JSON"""
    file_path = os.path.join(folder_path, f"{file_name}.json")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    usernames = set()
    target_list = data.get('relationships_following', data) if key == 'following' else data
    
    for item in target_list:
        try:
            value = item['string_list_data'][0]['value']
            usernames.add(value)
        except (KeyError, IndexError, TypeError):
            continue
    
    return usernames

try:
    seguidores = get_usernames('followers_1')
    seguindo = get_usernames('following', 'following')
    
    nao_seguem_volta = seguindo - seguidores
    deixaram_seguir = seguidores - seguindo
    
    print("RESULTADOS:")
    print(f"Seguidores: {len(seguidores)}")
    print(f"Seguindo: {len(seguindo)}")
    print(f"\nNao te seguem de volta: {len(nao_seguem_volta)}")
    print(f"Deixaram de seguir: {len(deixaram_seguir)}\n")
    
    if nao_seguem_volta:
        print("--- Nao te seguem de volta ---")
        for user in sorted(nao_seguem_volta):
            print(f"https://instagram.com/{user}/")
    
    if deixaram_seguir:
        print("\n--- Deixaram de seguir voce ---")
        for user in sorted(deixaram_seguir):
            print(f"https://instagram.com/{user}/")

except Exception as e:
    print(f"Erro: {e}")
    print("Verifique se a pasta 'data' existe e se os arquivos estao la.")