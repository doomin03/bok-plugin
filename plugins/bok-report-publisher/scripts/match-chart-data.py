"""Discover exact historical column matches; no writes to report code."""
import argparse,datetime,json,re
from pathlib import Path
from xml.etree import ElementTree as E
S='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
def number(v):
    try:return float(str(v).strip()) if str(v).strip() else None
    except:return None
def date(v):
    if not isinstance(v,str):return None
    v=v.strip()
    m=re.fullmatch(r'(\d{4})M(\d\d)',v)
    if m:return f'{m[1]}-{m[2]}-01'
    m=re.fullmatch(r'(\d{4})-(\d\d)-(\d\d)(?:T.*)?',v)
    if m:return f'{m[1]}-{m[2]}-{m[3]}'
    return None
def run(a):
    root=Path(a.source);repo=Path(a.repo)
    styles=E.parse(root/'xlsx-original/xl/styles.xml').getroot()
    fmts={int(n.get('numFmtId')):n.get('formatCode') for n in styles.findall(S+'numFmts/'+S+'numFmt')}
    dateids={i for i,n in enumerate(styles.find(S+'cellXfs')) if 14<=int(n.get('numFmtId','0'))<=22 or ('y' in fmts.get(int(n.get('numFmtId','0')),'').lower() and ('m' in fmts.get(int(n.get('numFmtId','0')),'').lower()))}
    donors=[]
    for p in (repo/'src/pages/report/components/toc').rglob('graphData/**/*.json'):
        if 'report202609' in p.parts:continue
        try:
            rows=json.loads(p.read_text(encoding='utf-8-sig'))
            if not isinstance(rows,list) or len(rows)<10 or not all(isinstance(r,dict) for r in rows):continue
            key=next((k for k in rows[0] if date(rows[0][k])),None)
            if not key:continue
            values={date(r.get(key)):r for r in rows if date(r.get(key))}
            numeric=[k for k in rows[0] if k!=key and any(number(r.get(k)) is not None for r in rows[:20])]
            if not numeric:continue
            donors.append((p,rows,key,values,numeric))
        except (ValueError,TypeError):continue
    result=[]
    for file in sorted((root/'sheets').glob('*.json')):
        sheet=json.loads(file.read_text(encoding='utf-8'));cells=sheet['cells'];grid={}
        for c in cells:
            m=re.match(r'([A-Z]+)(\d+)',c['ref']);col,row=m[1],int(m[2])
            val=c['value']
            if c['type']=='n' and c['style'] and int(c['style']) in dateids and val is not None:
                val=(datetime.datetime(1899,12,30)+datetime.timedelta(days=float(val))).strftime('%Y-%m-%d')
            grid.setdefault(row,{})[col]=val
        values={date(row.get('A')):row for n,row in grid.items() if n>=9 and date(row.get('A'))}
        if not values:continue
        matches=[]
        for p,rows,dkey,old,numeric in donors:
            common=sorted(set(values)&set(old))
            if len(common)<10:continue
            mapping={};valid=True
            for key in numeric:
                candidates=[]
                for col in sorted({c for v in values.values() for c in v} - {'A'}):
                    pairs=[(number(old[d].get(key)),number(values[d].get(col))) for d in common[:60]]
                    pairs=[(x,y) for x,y in pairs if x is not None and y is not None]
                    same=sum(abs(x-y)<1e-6 for x,y in pairs)
                    if len(pairs)>=10 and len({x for x,y in pairs})>=3 and same/len(pairs)>=.98:candidates.append(col)
                if len(candidates)!=1:valid=False;break
                mapping[key]=candidates[0]
            if valid and len(set(mapping.values()))==len(mapping):
                matches.append({'donor':p.relative_to(repo).as_posix(),'dateKey':dkey,'mapping':mapping,'rows':len(values),'overlap':len(common)})
        result.append({'sheet':sheet['name'],'sheetFile':sheet['file'],'title':grid.get(4,{}).get('A'),'matches':matches})
    Path(a.out).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    for r in result:
        if r['matches']:print(json.dumps(r,ensure_ascii=False))
if __name__=='__main__':
    p=argparse.ArgumentParser()
    for k in ('repo','source','out'):p.add_argument('--'+k,required=True)
    run(p.parse_args())
