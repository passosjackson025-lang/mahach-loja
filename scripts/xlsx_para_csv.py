#!/usr/bin/env python3
"""Converter a primeira aba de .xlsx para .csv com biblioteca padrão; preserva strings e IDs."""
import csv,re,sys,zipfile,xml.etree.ElementTree as ET
from pathlib import Path
NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
def colindex(address):
    m=re.match('[A-Z]+',address.upper());s=0
    for ch in (m.group() if m else ''):s=s*26+ord(ch)-64
    return s-1

def convert(src,out):
    with zipfile.ZipFile(src) as z:
        names=z.namelist()
        if not any(x.startswith('xl/worksheets/sheet') for x in names):raise ValueError('Planilha XLSX inválida')
        if any(z.getinfo(x).file_size>30_000_000 for x in names):raise ValueError('XLSX com conteúdo descomprimido excessivo')
        strings=[]
        if 'xl/sharedStrings.xml' in names:
            tree=ET.fromstring(z.read('xl/sharedStrings.xml'))
            strings=[''.join(n.text or '' for n in si.iter(NS+'t')) for si in tree.findall(NS+'si')]
        path='xl/worksheets/sheet1.xml'
        if path not in names:raise ValueError('A primeira aba não foi encontrada')
        root=ET.fromstring(z.read(path));data=root.find(NS+'sheetData')
        with Path(out).open('w',encoding='utf-8-sig',newline='') as fh:
            writer=csv.writer(fh,delimiter=';')
            if data is None:return
            for row in data.findall(NS+'row'):
                cells={}
                for cell in row.findall(NS+'c'):
                    i=colindex(cell.get('r',''));type_=cell.get('t');v=cell.find(NS+'v')
                    if type_=='inlineStr':value=''.join(n.text or '' for n in cell.iter(NS+'t'))
                    elif v is None:value=''
                    elif type_=='s':value=strings[int(v.text)]
                    else:value=v.text or ''
                    if i>=0 and i<200:cells[i]=value
                if cells:writer.writerow([cells.get(j,'') for j in range(max(cells)+1)])
    print('CSV salvo:',out)
if __name__=='__main__':
    if len(sys.argv)<2:raise SystemExit('Uso: python scripts/xlsx_para_csv.py catalogo.xlsx')
    path=Path(sys.argv[1]);convert(path,path.with_suffix('.csv'))
