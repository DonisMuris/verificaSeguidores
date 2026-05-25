import json
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
import webbrowser
import threading
import time

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
    nao_seguem_volta = sorted(seguindo - seguidores)
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Instagram Followers</title>
        <style>
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}
            
            body {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                padding: 20px;
                min-height: 100vh;
            }}
            
            .container {{
                max-width: 800px;
                margin: 0 auto;
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                overflow: hidden;
            }}
            
            .header {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
            }}
            
            .header h1 {{
                font-size: 28px;
                margin-bottom: 10px;
            }}
            
            .stats {{
                display: flex;
                justify-content: space-around;
                gap: 20px;
                margin-top: 20px;
                flex-wrap: wrap;
            }}
            
            .stat {{
                text-align: center;
            }}
            
            .stat-number {{
                font-size: 24px;
                font-weight: bold;
            }}
            
            .stat-label {{
                font-size: 12px;
                opacity: 0.9;
            }}
            
            .content {{
                padding: 30px;
            }}
            
            .title {{
                color: #333;
                font-size: 18px;
                margin-bottom: 20px;
                font-weight: 600;
            }}
            
            .users-list {{
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 12px;
            }}
            
            .user-card {{
                background: #f8f9fa;
                padding: 16px;
                border-radius: 8px;
                text-decoration: none;
                color: #333;
                border: 2px solid transparent;
                transition: all 0.3s ease;
                cursor: pointer;
                text-align: center;
                word-break: break-word;
            }}
            
            .user-card:hover {{
                background: #e9ecef;
                border-color: #667eea;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
            }}
            
            .user-card:active {{
                transform: translateY(0);
            }}
            
            .empty {{
                text-align: center;
                padding: 40px;
                color: #999;
            }}
            
            .empty p {{
                font-size: 16px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Instagram Followers</h1>
                <div class="stats">
                    <div class="stat">
                        <div class="stat-number">{len(seguidores):,}</div>
                        <div class="stat-label">Seguidores</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">{len(seguindo):,}</div>
                        <div class="stat-label">Seguindo</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">{len(nao_seguem_volta):,}</div>
                        <div class="stat-label">Nao seguem de volta</div>
                    </div>
                </div>
            </div>
            
            <div class="content">
                <div class="title">Nao te seguem de volta ({len(nao_seguem_volta)})</div>
                
                <div class="users-list">
    """
    
    if nao_seguem_volta:
        for user in nao_seguem_volta:
            html_content += f'<a href="https://instagram.com/{user}/" target="_blank" class="user-card">@{user}</a>\n'
    else:
        html_content += '<div class="empty"><p>Ninguem! Todos que voce segue o seguem de volta</p></div>'
    
    html_content += """
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Salvar arquivo HTML
    with open('instagram_followers.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print("Abrindo no navegador...")
    webbrowser.open('file://' + os.path.abspath('instagram_followers.html'))
    print("Telinha aberta! Clique nos usuarios para acessar o perfil.")
    
    # Manter o programa rodando
    input("Pressione Enter para fechar...")

except Exception as e:
    print(f"Erro ao ler arquivos: {e}")
    print("Verifique se os nomes dos arquivos na pasta /data estao identicos aos da imagem.")
