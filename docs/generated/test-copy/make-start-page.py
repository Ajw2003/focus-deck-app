# Builds index.html for the published test copy: one button per tab; each loads the flow-qa sample data and opens app/index.html.
# Usage from the repo root: python3 docs/generated/test-copy/make-start-page.py <dir>, then copy app/ (without *.test.mjs) into <dir> and docs/generated/sort-steps/seed.js into <dir>/sort-steps/.
import sys
T=sys.argv[1]
s=open('docs/generated/flow-qa/seed.html').read()
body=s[s.index('<script type="module">')+len('<script type="module">'):s.index('</script>')]
body=body.replace("from '../sort-steps/seed.js'","from './sort-steps/seed.js'")
body=body.replace("localStorage.setItem('focusdeck-screen', location.hash.slice(1) || 'sort');","")
body=body.replace("location.replace('../../../app/index.html');","")
cut=body.index('const s = seedState')
head,rest=body[:cut],body[cut:]
tabs=[('sort','📥 Sort'),('tidy','🧹 Tidy up'),('triage','📌 Triage'),('projects','📁 Projects'),('roadmap','🗺 Roadmap'),('focus','◎ Focus'),('review','✓ Review')]
btns=''.join(f'<button data-tab="{k}">{n}</button>' for k,n in tabs)
css='''
:root{--bg:#E8ECF3;--ink:#1F2A44;--card:#FFFDF7;--edge:#A87442}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#151B2A;--ink:#EEF1F7;--card:#232B3D;--edge:#C08A55}}
:root[data-theme="dark"]{--bg:#151B2A;--ink:#EEF1F7;--card:#232B3D;--edge:#C08A55}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.4 system-ui,sans-serif}
main{max-width:420px;margin:0 auto;padding:24px 16px}
h1{font-size:24px;margin:0 0 8px} p{margin:0 0 20px}
button{display:block;width:100%;margin:0 0 12px;padding:16px;font:600 18px system-ui,sans-serif;color:var(--ink);background:var(--card);border:2px solid var(--edge);border-radius:6px;cursor:pointer;text-align:left}
'''
html=('<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Focus Deck Test Copy</title><style>'+css+'</style></head>\n'
 '<body><main><h1>Focus Deck test copy</h1><p>Pick the tab to start on. Each press loads fresh sample data: 19 projects, 77 tasks and 2 thoughts. Your real tasks are not touched.</p>'+btns+'</main>\n'
 '<script type="module">\n'+head+"\ndocument.querySelectorAll('button[data-tab]').forEach((b) => b.addEventListener('click', () => {\n"+rest+"\n  localStorage.setItem('focusdeck-screen', b.dataset.tab);\n  location.href = 'app/index.html';\n}));\n</script></body></html>\n")
open(T+'/index.html','w').write(html)
