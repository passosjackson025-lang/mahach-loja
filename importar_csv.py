"""Importa a planilha exportada, sem fabricar fotos nem estoque."""
import csv, json, re, sys, unicodedata
from html.parser import HTMLParser
from pathlib import Path

class PlainText(HTMLParser):
    def __init__(self): super().__init__(); self.parts=[]
    def handle_data(self,s): self.parts.append(s)
    def handle_starttag(self,tag,attrs):
        if tag in ('p','h1','h2','h3','br','li'): self.parts.append('\n')
    def get(self): return re.sub(r'\n{3,}','\n\n',''.join(self.parts)).strip()

def normal(s): return ''.join(c for c in unicodedata.normalize('NFD',s.lower()) if unicodedata.category(c)!='Mn')
def group_of(name,brand):
    s=normal(name+' '+brand)
    if any(w in s for w in ['medicube','skincare','serum','tonico facial','mascara facial','maquiagem','batom','gloss ','protetor solar','sabonete facial','limpeza facial','hidratante facial','creme facial','contorno dos olhos','centella','cosrx','anua','beauty of joseon']): return 'beleza'
    if any(w in s for w in ['tree hut','victoria\'s secret','hidratante corporal','body splash','esfoliante','sabonete corporal','shampoo','condicionador','body mist','loção corporal','creme corporal','óleo corporal']): return 'corpo'
    return 'perfumes'
def family_of(text):
    m=re.search(r'(?:fam[ií]lia\s+olfativa|fam[ií]lia\s+arom[aá]tica)\s*[:\-]\s*([^\n.]{3,65})',text,re.I)
    return m.group(1).strip(' :;-')[:65] if m else ''
def parse(path):
    out=[]
    with open(path,encoding='utf-8-sig',newline='') as f:
        for row in csv.DictReader(f,delimiter=';'):
            parser=PlainText(); parser.feed(row['Descrição'] or ''); description=parser.get()[:10000]
            brand=(row['Categoria'] or 'Sem marca').strip()[:100]
            name=(row['Nome'] or '').strip()[:220]
            try: price=round(float(row['Preço']),2)
            except: price=0
            def measure(col):
                try: return float(row[col]) if row[col].strip() else None
                except: return None
            out.append(dict(id=row['Id'],name=name,price=price,description=description,
                category=group_of(name,brand),brand=brand,family=family_of(description),
                image='',sku=(row['Código'] or '')[:80],stock=None,
                weight=measure('Embalagem-Peso'),width=measure('Embalagem-Largura'),
                height=measure('Embalagem-Altura'),length=measure('Embalagem-Comprimento'),
                active=1))
    return out
if __name__=='__main__':
    source=Path(sys.argv[1]) if len(sys.argv)>1 else Path('produtos.csv')
    dest=Path(__file__).resolve().parent/'catalogo-inicial.json'
    data=parse(source)
    dest.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f'{len(data)} produtos -> {dest}')
