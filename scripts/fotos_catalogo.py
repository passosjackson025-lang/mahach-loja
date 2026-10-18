#!/usr/bin/env python3
"""MAHACH: descoberta auditável de fotos; aplicação SOMENTE após aprovação humana.

Python 3.10+ e Pillow para aprovar imagens. API SerpApi opcional.
Não copia imagens de terceiros sem autorização de uso comercial e revisão de SKU/frasco.
"""
import argparse, csv, io, ipaddress, json, os, re, socket, sqlite3, sys, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / 'catalogo_imagens.csv'
CANDIDATES = ROOT / 'candidatos_imagens.csv'
APPROVALS = ROOT / 'aprovacoes_imagens.csv'
IMAGE_DIR = ROOT / 'assets' / 'produtos'
HEADERS = ['Id','Nome','Marca','Volume','Consulta','Status','Arquivo_Imagem','URL_Imagem','Pagina_Fonte','Licenca','Revisado_Em','Observacoes']
CANDIDATE_HEADERS = ['Id','Nome','Marca','Volume','Consulta','Titulo_Encontrado','URL_Imagem','Pagina_Fonte','Status','Aprovado','Licenca','Observacoes']

def read_csv(path):
    with path.open(encoding='utf-8-sig',newline='') as fh:
        return list(csv.DictReader(fh,delimiter=';'))

def write_csv(path, rows, headers):
    with path.open('w',newline='',encoding='utf-8-sig') as fh:
        w=csv.DictWriter(fh,fieldnames=headers,delimiter=';',extrasaction='ignore');w.writeheader();w.writerows(rows)

def volume(name):
    m=re.search(r'(?<!\w)(\d{1,4})\s*(ML|G|GR|L)(?!\w)',name,re.I)
    return (m.group(1)+m.group(2).lower()) if m else ''

def normalize(text):
    import unicodedata
    return ''.join(ch for ch in unicodedata.normalize('NFKD',text.upper()) if not unicodedata.combining(ch))

def search_query(name,brand):
    v=volume(name)
    if normalize(brand) not in normalize(name): return ' '.join(filter(None,[brand,name,v,'foto perfume frasco fundo branco']))
    return ' '.join(filter(None,[name,v,'foto produto fundo branco']))

def original_catalog(input_csv):
    products=read_csv(input_csv)
    base=[]
    for r in products:
        brand=r.get('Categoria','').strip()
        # "Categoria" na exportação atual mistura marcas/etiquetas; nunca assumir fotografia compatível.
        base.append({'Id':r['Id'],'Nome':r['Nome'],'Marca':brand,'Volume':volume(r['Nome']),
                     'Consulta':search_query(r['Nome'],brand),'Status':'NAO_PESQUISADO',
                     'Arquivo_Imagem':'','URL_Imagem':'','Pagina_Fonte':'','Licenca':'',
                     'Revisado_Em':'','Observacoes':'A imagem deve coincidir com marca, variação e volume; verificar direitos de uso comercial.'})
    return base

def create_base(inp):
    rows=original_catalog(inp); write_csv(CSV,rows,HEADERS)
    write_csv(APPROVALS,[{k:(r[k] if k in r else '') for k in CANDIDATE_HEADERS} for r in []],CANDIDATE_HEADERS)
    print(f'Inventário: {len(rows)} produtos; imagens confirmadas: 0. {CSV.name}')

def discover(limit,start,delay):
    api=os.environ.get('SERPAPI_KEY','')
    if not api: raise SystemExit('Configure SERPAPI_KEY no ambiente. A pesquisa online nunca foi executada sem ela.')
    rows=read_csv(CSV)
    existing=read_csv(CANDIDATES) if CANDIDATES.exists() else []
    done={r['Id'] for r in existing}
    result=list(existing)
    for item in rows[start:start+limit]:
        if item['Id'] in done:continue
        args=urllib.parse.urlencode({'engine':'google_images','q':item['Consulta'],'api_key':api,'hl':'pt','gl':'br','safe':'active'})
        try:
            with urllib.request.urlopen('https://serpapi.com/search.json?'+args, timeout=30) as response:
                values=json.load(response)
            images=values.get('images_results',[])[:3]
            if not images:
                result.append({**item,'Status':'NAO_ENCONTRADO','Observacoes':'Nenhum candidato retornado pela API.'})
            for img in images:
                result.append({'Id':item['Id'],'Nome':item['Nome'],'Marca':item['Marca'],'Volume':item['Volume'],
                               'Consulta':item['Consulta'],'Titulo_Encontrado':str(img.get('title',''))[:400],
                               'URL_Imagem':img.get('original',''), 'Pagina_Fonte':img.get('link',''),
                               'Status':'CANDIDATO_PENDENTE','Aprovado':'NAO','Licenca':'',
                               'Observacoes':'Revisar rótulo, frasco, embalagem, volume, direitos comerciais e fundo.'})
        except Exception as e:
            result.append({**item,'Status':'ERRO_BUSCA','Observacoes':str(e)[:300]})
        write_csv(CANDIDATES,result,CANDIDATE_HEADERS)
        time.sleep(max(delay,0.5))
    print(f'Candidatos: {CANDIDATES} ({len(result)} linhas). Nenhuma imagem foi aprovada automaticamente.')

def safe_host(url):
    parsed=urllib.parse.urlparse(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password: raise ValueError('É necessário URL HTTPS pública')
    for rec in socket.getaddrinfo(parsed.hostname,443,type=socket.SOCK_STREAM):
        ip=ipaddress.ip_address(rec[4][0]);
        if not ip.is_global:raise ValueError('Host não público')
    return url

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):raise ValueError('Redirecionamento não permitido')

def fetch_image(url):
    from PIL import Image, ImageOps, ImageStat
    url=safe_host(url); opener=urllib.request.build_opener(NoRedirect())
    with opener.open(urllib.request.Request(url,headers={'User-Agent':'MAHACH-Catalog-Image-Review/1.0'}),timeout=20) as resp:
        if not resp.headers.get('Content-Type','').lower().startswith('image/'):raise ValueError('URL não retorna imagem')
        data=resp.read(13*1024*1024+1)
        if len(data)>13*1024*1024:raise ValueError('Imagem maior que 13 MB')
    with Image.open(io.BytesIO(data)) as src:
        src=ImageOps.exif_transpose(src).convert('RGBA');src.thumbnail((1150,1150),Image.Resampling.LANCZOS)
        if min(src.size)<350:raise ValueError('Fonte com resolução insuficiente (<350 px)')
        # Não recortar ou alterar a embalagem. Foto de produto já isolado, bordas transparentes/brancas.
        corners=[src.getpixel((x,y)) for x,y in [(0,0),(src.width-1,0),(0,src.height-1),(src.width-1,src.height-1)]]
        if any(alpha>230 and min(r,g,b)<238 for r,g,b,alpha in corners):raise ValueError('Fundo não branco/transparente: usar foto recortada aprovada')
        dst=Image.new('RGB',(1200,1200),'#FFFFFF');back=Image.new('RGBA',src.size,'#FFFFFF');back.alpha_composite(src)
        dst.paste(back.convert('RGB'),((1200-src.width)//2,(1200-src.height)//2));return dst

def apply_approved(path,db_path):
    from PIL import Image
    if not path.exists():raise SystemExit(f'Arquivo de aprovação não encontrado: {path}')
    rows=read_csv(path); catalog={r['Id']:r for r in read_csv(CSV)}
    conn=sqlite3.connect(db_path); known={r[0] for r in conn.execute('select id from products')}
    accepted=0;errors=0
    IMAGE_DIR.mkdir(exist_ok=True,parents=True)
    for item in rows:
        if item.get('Aprovado','').strip().upper()!='SIM':continue
        id=item.get('Id','').strip()
        if id not in known or id not in catalog:errors+=1;print('ID inexistente:',id);continue
        if not item.get('Licenca','').strip() or not item.get('Pagina_Fonte','').strip():
            errors+=1;print('Falta fonte/licença:',id);continue
        if normalize(item.get('Nome',''))!=normalize(catalog[id]['Nome']):
            errors+=1;print('Nome divergente:',id);continue
        v=catalog[id]['Volume'];candidate=normalize(item.get('Titulo_Encontrado','')+' '+item.get('Nome',''))
        if v and normalize(v) not in candidate:
            errors+=1;print('Volume ausente do candidato:',id);continue
        try:
            img=fetch_image(item['URL_Imagem'])
            filename='mahach_'+re.sub(r'[^a-zA-Z0-9_-]','_',id)+'.webp'
            img.save(IMAGE_DIR/filename,'WEBP',quality=94,method=6)
            rel='/assets/produtos/'+filename
            conn.execute('UPDATE products SET image=? WHERE id=?',(rel,id))
            catalog[id].update({'Status':'APROVADO','Arquivo_Imagem':filename,'URL_Imagem':item['URL_Imagem'],
                                'Pagina_Fonte':item['Pagina_Fonte'],'Licenca':item['Licenca'],
                                'Revisado_Em':time.strftime('%Y-%m-%d')})
            accepted+=1
        except Exception as exc:errors+=1;print(f'Falha {id}: {exc}')
    conn.commit();conn.close();write_csv(CSV,list(catalog.values()),HEADERS)
    print(f'Imagens 1200x1200 geradas e ligadas ao banco: {accepted}; rejeitadas: {errors}')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('mode',choices=['inventario','buscar','aprovar']);p.add_argument('--input',default=str(ROOT/'planilha-original.csv'))
    p.add_argument('--limit',type=int,default=20);p.add_argument('--start',type=int,default=0)
    p.add_argument('--delay',type=float,default=1.2);p.add_argument('--approvals',default=str(APPROVALS))
    args=p.parse_args()
    if args.mode=='inventario':create_base(Path(args.input))
    elif args.mode=='buscar':discover(args.limit,args.start,args.delay)
    else:apply_approved(Path(args.approvals),ROOT/'private'/'mahach.sqlite')
