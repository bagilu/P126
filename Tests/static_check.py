from pathlib import Path
import re, subprocess, json
root=Path(__file__).resolve().parents[1]
sql='\n'.join(p.read_text() for p in (root/'Database').glob('*.sql'))
code=re.sub(r'--[^\n]*','',sql)
for pattern in [r'ON\s+ALL\s+(TABLES|SEQUENCES|FUNCTIONS)',r'ALTER\s+DEFAULT\s+PRIVILEGES',r'DROP\s+SCHEMA',r'DROP\s+OWNED',r'REASSIGN\s+OWNED',r'(GRANT|REVOKE)\b[^;]*\bON\s+SCHEMA',r'CREATE\s+TRIGGER\b[^;]*\bauth\.users']:
 assert not re.search(pattern,code,re.I),pattern
assert set(re.findall(r'public\."(TblP\d+\w*)"',code))=={'TblP126'+t for t in ['Profile','Period','Timetable','BusySlot','Group','GroupMember','GroupInvite']}
assert not (root/'Website/config.js').exists(),'Do not package deployed config.js'
assert "storageKey:'p126-auth-token'" in (root/'Website/app.js').read_text()
assert "signOut({scope:'local'})" in (root/'Website/app.js').read_text()
assert '.from(' not in (root/'Website/app.js').read_text().replace('Array.from(','')
for f in (root/'Website').glob('*.js'):subprocess.run(['node','--check',str(f)],check=True)
from html.parser import HTMLParser
class Check(HTMLParser):
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  for key in ('src','href'):
   v=a.get(key,'')
   if v and not v.startswith(('https:','data:','#')) and v!='config.js':assert (root/'Website'/v).exists(),v
Check().feed((root/'Website/index.html').read_text())
assert 'V0.1' in (root/'CHANGELOG.md').read_text()
assert 'config-sample.js' in (root/'README.md').read_text()
print(json.dumps({'scope':'P126 only','javascript':'passed','html_assets':'passed','config_excluded':True,'session_isolation':True}))
