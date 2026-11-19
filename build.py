"""Gera:
  index.html            -> site (Vercel): carrega os módulos de src/ (publicar = enviar só o arquivo alterado)
  dist/estancia78.html  -> arquivo único (versão dentro do Claude)
"""
import os, base64, re, time
d = os.path.dirname(os.path.abspath(__file__)) + '/'
MODS = ['0-supabase.js','1-core.js','2-financeiro.js','3-animais.js','4-paginas.js','5-etapa2.js','6-etapa3.js','9-boot.js']
shell = open(d+'src/shell.html').read()
logo = open(d+'src/logo.svg').read()
b64 = lambda f: 'data:image/png;base64,' + base64.b64encode(open(d+'icons/'+f,'rb').read()).decode()
ver = time.strftime('%Y%m%d%H%M')
base = shell.replace('<!--LOGO-->', logo).replace('/*APPLEICON*/', b64('apple-touch-icon.png'))
# site (multi-arquivo)
open(d+'src/logo-png.js','w').write("window.ESTANCIA_LOGO_PNG = '" + b64('logo-pdf.png') + "';\n")
tags = '\n'.join(f'<script src="src/{m}?v={ver}"></script>' for m in ['logo-png.js'] + MODS)
site = base.replace('/*FAVICON*/', 'icons/app.svg').replace('type="image/png" href="icons/app.svg"', 'type="image/svg+xml" href="icons/app.svg"')
site = site.replace('<script>\n/*APP*/\n</script>', tags)
open(d+'index.html','w').write(site)
# arquivo único (Claude)
js = '\n'.join(open(d+'src/'+f).read() for f in MODS).replace('/*LOGO_PNG*/', b64('logo-pdf.png'))
os.makedirs(d+'dist', exist_ok=True)
single = base.replace('/*FAVICON*/', b64('favicon-64.png')).replace('/*APP*/', js)
open(d+'dist/estancia78.html','w').write(single)
print('index.html', len(site), '| dist/estancia78.html', len(single))
