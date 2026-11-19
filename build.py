import sys
import os; d=os.path.dirname(os.path.abspath(__file__))+'/'
shell=open(d+'src/shell.html').read()
logo=open(d+'src/logo.svg').read()
js='\n'.join(open(d+'src/'+f).read() for f in ['0-supabase.js','1-core.js','2-financeiro.js','3-animais.js','4-paginas.js'])
out=shell.replace('<!--LOGO-->',logo).replace('/*APP*/',js)
open(d+'index.html','w').write(out)
print(len(out))
