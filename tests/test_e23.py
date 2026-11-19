import os
from playwright.sync_api import sync_playwright
APP = '/home/claude/estancia78/index.html'; NM = '/home/claude/testenv/node_modules/'
errors = []; results = []
def ok(c, m): results.append(c); print(('PASS ' if c else 'FAIL ') + m, flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1400,'height':900}, accept_downloads=True); pg.set_default_timeout(4000)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'Failed to load' not in m.text else None)
    dls = []
    def ondl(d):
        path = '/home/claude/testenv/dl_' + d.suggested_filename; d.save_as(path); dls.append(path)
    pg.on('download', ondl)
    def route(r):
        u = r.request.url
        if 'chart.umd' in u: return r.fulfill(path=NM+'chart.js/dist/chart.umd.js', content_type='application/javascript')
        if 'jspdf.umd' in u: return r.fulfill(path=NM+'jspdf/dist/jspdf.umd.min.js', content_type='application/javascript')
        if 'autotable' in u: return r.fulfill(path=NM+'jspdf-autotable/dist/jspdf.plugin.autotable.min.js', content_type='application/javascript')
        if 'xlsx.full' in u: return r.fulfill(path=NM+'xlsx/dist/xlsx.full.min.js', content_type='application/javascript')
        if 'supabase-js' in u: return r.fulfill(path='/home/claude/testenv/mock_sb.js', content_type='application/javascript')
        if u.endswith('config.js'): return r.fulfill(body="window.ESTANCIA_CONFIG={supabaseUrl:'https://x.supabase.co',supabaseAnonKey:'anon'}", content_type='application/javascript')
        if u.startswith('file://'): return r.continue_()
        return r.abort()
    pg.route('**/*', route)
    pg.goto('file://' + APP); pg.wait_for_timeout(500)
    pg.fill('#fLogin [name=email]', 'lucas@teste.com'); pg.fill('#fLogin [name=senha]', 'segredo1'); pg.click('#fLogin button'); pg.wait_for_timeout(800)
    E = pg.evaluate; M = '#modal-root .mback:last-child '
    def fill(n, v): pg.fill(M + f'[name="{n}"]', str(v))
    def sel(n, v): pg.select_option(M + f'[name="{n}"]', v)
    def nmod(): return pg.locator('#modal-root .mback').count()
    def submit():
        n0 = nmod(); pg.click(M + 'button[type=submit]')
        for _ in range(60):
            pg.wait_for_timeout(50)
            if nmod() != n0 or pg.locator(M + '.ferr:not([hidden])').count(): break
        pg.wait_for_timeout(250)
    def err(): return pg.inner_text(M + '.ferr') if pg.locator(M + '.ferr:not([hidden])').count() else ''
    def closeall(): E("document.querySelectorAll('#modal-root .mback').forEach(m=>m.remove())")
    def go(h): E(f"location.hash='{h}'"); pg.wait_for_timeout(250)
    hoje = E("hoje()")

    ok(E("MENU.every(m => !m[2])"), 'menu sem marcações de etapa (todos os módulos ativos)')
    go('financeiro'); pg.click('[data-act=tab][data-val=contas]'); pg.click('[data-act=novaConta]'); fill('nome','Caixa'); fill('saldoInicial','5000'); submit()

    # ESTOQUE
    go('estoque'); pg.click('[data-act=novoProduto]'); fill('nome','Ivermectina 1%'); sel('categoria','Vermífugos'); sel('unidade','mL'); fill('estoqueMinimo','50'); submit()
    iv = E("A('produtos').find(p=>p.nome==='Ivermectina 1%').id")
    E(f"abrirEntrada('{iv}')"); fill('qtd','100'); fill('valor','200'); sel('atividade','bovinos'); submit()
    ok(E(f"saldoProd('{iv}')") == 100 and abs(E(f"custoMedioProd('{iv}')") - 2) < 1e-9, 'entrada no estoque: saldo 100 mL, custo médio R$2')
    ok(E("A('lancamentos').some(l=>l.categoria==='Vermífugos'&&l.valor===200&&l.origem==='estoque'&&l.classificacao==='operacional')"), 'compra do estoque gera despesa operacional (uma única vez)')
    ok(E("saldoTotal()") == 4800, 'pagamento da compra sai do caixa')
    pg.click('[data-act=novoProduto]'); fill('nome','Ração bovina'); sel('categoria','Ração'); sel('unidade','kg'); fill('saldoInicial','500'); fill('valorInicial','1000'); submit()
    rc = E("A('produtos').find(p=>p.nome==='Ração bovina').id")
    ok(E(f"saldoProd('{rc}')") == 500 and E("A('lancamentos').length") == 1, 'saldo inicial sem lançamento financeiro')

    # BOVINOS base
    go('bovinos')
    for ident, sexo, cat in [('V1','Fêmea','Vaca'),('T1','Macho','Touro')]:
        pg.click('[data-act=novoAnimal]'); fill('ident', ident); sel('sexo', sexo); sel('categoria', cat); sel('origem','entrada'); fill('pesoInicial','450'); fill('local','Pasto 1'); submit()
    v1 = E("A('animais').find(a=>a.ident==='V1').id")

    # MANEJO
    go('manejo'); pg.click('[data-act=novoManejo]'); sel('tipo','Vermifugação'); sel('especie','bovino'); sel('alvo','T:bovino'); sel('produtoId', iv); fill('qtd','20'); fill('dose','10 mL'); fill('carencia','35')
    prox = E("addDias(hoje(), 30)"); fill('proxima', prox); submit()
    mj = E("A('manejos')[0]")
    ok(mj and mj['custo'] == 40 and mj['cabecas'] == 2, 'manejo: custo R$40 (20 mL × R$2) para 2 cabeças')
    ok(E(f"saldoProd('{iv}')") == 80, 'manejo baixa o estoque automaticamente (80 mL)')
    ok(E(f"A('eventos').some(e=>e.data==='{prox}'&&e.tipo==='Vermifugação'&&e.origem==='manejo')"), 'próxima aplicação entra no calendário')
    ok(E("A('manejos')[0].fimCarencia") == E("addDias(hoje(),35)"), 'carência calculada')
    pg.click('[data-act=novoManejo]'); sel('tipo','Vermifugação'); sel('especie','bovino'); sel('alvo','T:bovino'); sel('produtoId', iv); fill('qtd','500'); submit()
    ok('insuficiente' in err(), 'manejo bloqueia estoque negativo sem autorização'); closeall()
    E(f"void excluirManejo(byId('manejos','{mj['id']}'))"); pg.wait_for_timeout(100); submit()
    ok(E(f"saldoProd('{iv}')") == 100 and not E("A('eventos').some(e=>e.origem==='manejo')"), 'excluir manejo devolve estoque e remove lembrete')
    E(f"abrirSaida('{rc}')"); fill('qtd','100'); sel('atividade','bovinos'); sel('alvo', 'A:'+v1); submit()
    ok(E(f"saldoProd('{rc}')") == 400 and E("A('estoqueMovs').some(m=>m.tipo==='saida'&&m.custo===200)"), 'consumo de ração para a vaca: custo direto R$200')
    alertas = E("alertasEstoque().map(a=>a.txt)")
    ok(any('Ivermectina' in a for a in alertas) is False, 'sem alerta quando acima do mínimo')
    E(f"abrirAjusteEstoque('{iv}')"); fill('contado','40'); fill('obs','contagem'); submit()
    ok(any('Ivermectina' in a for a in E("alertasEstoque().map(a=>a.txt)")), 'alerta de estoque baixo')

    # REPRODUÇÃO bovina
    go('reproducao'); pg.click('[data-act=novaCobertura]'); sel('matriz', 'A:'+v1); fill('reprodutor','T1'); fill('dataCob', E("addDias(hoje(),-283)")); submit()
    r = E("A('reproducoes')[0]")
    ok(r['prevParto'] == hoje and r['status'] == 'coberta', 'cobertura: previsão de parto = +283 dias')
    ok(E("A('eventos').some(e=>e.tipo==='Previsão de parto')"), 'parto previsto entra no calendário')
    E(f"abrirDiagnostico(byId('reproducoes','{r['id']}'))"); submit()
    E(f"abrirParto(byId('reproducoes','{r['id']}'))"); fill('ident','B1'); sel('sexo','Fêmea'); fill('peso','32'); submit()
    b1 = E("A('animais').find(a=>a.ident==='B1')")
    ok(b1 and b1['mae'] == 'V1' and b1['categoria'] == 'Bezerra' and b1['origem'] == 'nascimento', 'parto cadastra a bezerra com a mãe')
    ok(E("A('eventos').find(e=>e.tipo==='Previsão de parto').concluido") and E("A('eventos').some(e=>e.tipo==='Desmame')"), 'parto conclui o evento e agenda o desmame')

    # REPRODUÇÃO suína
    go('suinos'); pg.click('[data-act=tab][data-val=plantel]'); pg.click('[data-act=novoAnimal]'); fill('ident','M1'); sel('sexo','Fêmea'); sel('categoria','Matriz'); sel('origem','entrada'); submit()
    m1 = E("A('animais').find(a=>a.ident==='M1').id")
    go('reproducao'); pg.click('[data-act=setf][data-v=suino]'); pg.click('[data-act=novaCobertura]'); sel('matriz','A:'+m1); fill('dataCob', E("addDias(hoje(),-114)")); submit()
    rs = E("A('reproducoes').find(r=>r.especie==='suino')")
    ok(rs['prevParto'] == hoje, 'cobertura suína: previsão = +114 dias')
    E(f"abrirParto(byId('reproducoes','{rs['id']}'))"); fill('vivos','10'); fill('mortos','1'); fill('codigo','LEI-01'); submit()
    lote = E("A('lotes').find(l=>l.codigo==='LEI-01')")
    ok(lote and E(f"saldoLote('{lote['id']}')") == 10 and lote['matriz'] == 'M1', 'parto suíno cria a leitegada com 10 vivos')
    E(f"abrirDesmameRepro(byId('reproducoes','{rs['id']}'))"); fill('qtd','9'); fill('pesoMedio','7,2'); submit()
    ok(E(f"saldoLote('{lote['id']}')") == 9 and E(f"byId('lotes','{lote['id']}').categoria") == 'Leitão desmamado', 'desmame: 9 desmamados, 1 mortalidade na maternidade, categoria atualizada')
    t = pg.inner_text('#main'); ok('10,0%' in t or '10%' in t, 'mortalidade até desmame = 10%')

    # CALENDÁRIO
    go('calendario'); pg.wait_for_timeout(200)
    ok(pg.locator('.calcell').count() >= 35, 'calendário mensal com grade de dias')
    pg.click(f'.calcell[data-d="{hoje}"] .calnum'); pg.wait_for_timeout(200)
    ok(nmod() == 1 and pg.locator(M + '.daylist').count() == 1, 'clicar na data abre o dia')
    n_hoje = pg.locator(M + '.evrow').count()
    pg.click(M + '[data-act=calNovo][data-tipo=Medicamento]'); pg.wait_for_timeout(150)
    ok(pg.input_value(M + '[name=tipo]') == 'Medicamento' and pg.input_value(M + '[name=data]') == hoje, 'atalho “Medicamento” já vem com tipo e data')
    fill('titulo', 'Medicamento: antibiótico bezerra B1'); fill('hora','07:30'); fill('responsavel','João'); submit()
    ok(nmod() == 1 and pg.locator('#modal-root .daylist .evrow').count() == n_hoje + 1, 'compromisso incluído e aparece na lista do dia')
    ev = E("A('eventos').find(e=>e.titulo.startsWith('Medicamento: antibiótico'))")
    pg.click(f'#modal-root [data-act=calToggle][data-id="{ev["id"]}"]'); pg.wait_for_timeout(300)
    ok(E(f"byId('eventos','{ev['id']}').concluido") == True, 'marcar como concluído')
    pg.click(f'#modal-root .daylist [data-act=calDel][data-id="{ev["id"]}"]'); pg.wait_for_timeout(150); submit()
    ok(not E(f"A('eventos').some(e=>e.id==='{ev['id']}')") and nmod() == 1, 'excluir compromisso (o dia continua aberto)')
    pg.click(M + '[data-act=calNovo][data-tipo=Desmame]'); fill('titulo','Desmame lote LEI-01'); sel('repetir','7'); fill('vezes','3'); submit()
    ok(E("A('eventos').filter(e=>e.titulo.startsWith('Desmame lote LEI-01')).length") == 3, 'repetição semanal cria 3 compromissos')
    closeall()
    pg.screenshot(path='/home/claude/testenv/cal_mes.png')
    pg.click('[data-act=calNav][data-n="1"]'); pg.wait_for_timeout(150); pg.click('[data-act=calHoje]'); pg.wait_for_timeout(150)
    pg.click('[data-act=setf][data-v=semana]'); pg.wait_for_timeout(200); ok(pg.locator('.calwcol').count() == 7, 'visão semanal')
    pg.screenshot(path='/home/claude/testenv/cal_sem.png')
    pg.click('[data-act=setf][data-v=dia]'); pg.wait_for_timeout(200); ok('Novo compromisso neste dia' in pg.inner_text('#main'), 'visão diária')
    pg.click('[data-act=setf][data-v=mes]'); pg.wait_for_timeout(150)
    pg.click(f'.calcell[data-d="{hoje}"] .calnum'); pg.wait_for_timeout(200); pg.screenshot(path='/home/claude/testenv/cal_dia.png'); closeall()
    ok(E("contadorAgenda()") >= 1, 'contador do calendário no menu')

    # CUSTOS
    go('custos'); pg.wait_for_timeout(200)
    c = E("(()=>{const c=custosEspecie('bovino',S.ui.csIni,S.ui.csFim);return {pool:c.pool,dir:c.totDireto,ind:c.indireto,n:c.itens.length,tot:c.itens.reduce((s,i)=>s+i.periodo,0)}})()")
    print('custos bov', c)
    ok(c['pool'] == 200 and c['dir'] == 200 and c['n'] == 3, 'custos bovinos: base = despesas operacionais; ração da vaca como custo direto')
    ok(abs(c['tot'] - max(c['pool'], c['dir'])) < 0.01, 'custo distribuído sem duplicidade (soma dos animais = custo do período)')
    for e_ in ['suino','galinha']:
        pg.click(f'[data-act=setf][data-k=csEsp][data-v={e_}]'); pg.wait_for_timeout(200); ok('CUSTO OPERACIONAL' in pg.inner_text('#main').upper(), f'custos {e_} renderiza')
    pg.screenshot(path='/home/claude/testenv/custos.png', full_page=True)

    # PATRIMÔNIO
    go('despesas-gerais'); pg.click('[data-act=novoGasto]'); sel('grupo','cercas'); sel('categoria','Arame'); fill('valor','800'); fill('local','Pasto 3'); submit()
    go('patrimonio'); pg.click('[data-act=novoBem]'); sel('tipo','Máquinas'); fill('descricao','Trator'); fill('valorBase','50000'); fill('valorAtual','40000'); submit()
    pr = E("patrimonioResumo()"); print('patrim', {k:pr[k] for k in ['total','estruturas','invNV','vBens']})
    ok(pr['vBens'] == 40000 and pr['invNV'] == 800, 'bem com valor atual e investimento sem vínculo')
    bem = E("A('patrimonio')[0].id"); E(f"abrirMelhoria(byId('patrimonio','{bem}'))"); sel('lancId', E("investNaoVinculados()[0].id")); submit()
    pr2 = E("patrimonioResumo()")
    ok(pr2['invNV'] == 0 and E(f"investidoBem(byId('patrimonio','{bem}'))") == 50800 and pr2['estruturas'] == 40000, 'vincular investimento não conta duas vezes')
    pg.click('[data-act=tab][data-val=rebanho]'); pg.fill('#fVC [name="bovino|Vaca"]', '6000'); pg.click('[data-act=salvarVC]'); pg.wait_for_timeout(300)
    ok(E("valorCabeca('bovino','Vaca')") == 6000, 'valor por categoria do rebanho')
    pg.click('[data-act=tab][data-val=evolucao]'); pg.wait_for_timeout(300); ok(E("S.charts.length") == 1, 'gráfico de evolução patrimonial')

    # RELATÓRIOS
    go('relatorios'); pg.wait_for_timeout(200)
    ids = E("RELATORIOS.map(r=>r.id)"); ok(len(ids) >= 20, f'{len(ids)} relatórios disponíveis')
    pg.click('[data-act=periodo][data-p=rl][data-v=ano]'); pg.wait_for_timeout(100)
    bad = []
    for rid in ids:
        pg.click(f'.repitem[data-v="{rid}"]'); pg.wait_for_timeout(120)
        t = pg.inner_text('#main')
        if 'Erro' in t.split('\n')[0:3] or len(errors) > 0: bad.append(rid)
    ok(not bad, f'todos os relatórios geram sem erro {bad}')
    pg.click('.repitem[data-v="dre"]'); pg.wait_for_timeout(150)
    for v in ['mensal','atividade','consolidada']:
        pg.select_option('[data-filter=rlVisao]', v); pg.wait_for_timeout(150)
    dre = E("dreCalc(S.ui.rlIni,S.ui.rlFim,null)")
    lab = {l[1]: l[2] for l in dre if len(l) > 2}
    print({k: lab[k] for k in ['Receita bruta total','Total dos custos operacionais','Resultado operacional consolidado','Total das despesas gerais','Total investido no período']})
    ok(lab['Total dos custos operacionais'] == -200 and lab['Total investido no período'] == 800, 'DRE separa custos operacionais (200) de investimentos (800)')
    pg.screenshot(path='/home/claude/testenv/dre.png', full_page=True)
    pg.click('[data-act=relPDF]'); pg.wait_for_timeout(1500)
    pg.click('[data-act=relXLS]'); pg.wait_for_timeout(800)
    pg.click('.repitem[data-v="comsui"]'); pg.wait_for_timeout(150); pg.click('[data-act=relPDF]'); pg.wait_for_timeout(1500)
    print(dls)
    ok(any(x.endswith('.pdf') for x in dls) and any(x.endswith('.xlsx') for x in dls), 'exportação PDF e Excel dos relatórios')

    # Dashboard + fichas
    go('dashboard'); pg.wait_for_timeout(400); ok(pg.locator('canvas').count() == 7, 'dashboard com evolução do patrimônio')
    ok('atrasado' in pg.inner_text('#main') or 'Hoje:' in pg.inner_text('#main') or 'Estoque baixo' in pg.inner_text('#main'), 'alertas de calendário/estoque no dashboard')
    E(f"abrirFicha('{v1}')"); pg.wait_for_timeout(200); t = pg.inner_text(M)
    ok('Manejo sanitário' in t and 'Histórico reprodutivo' in t, 'ficha do animal mostra manejos e reprodução'); closeall()
    E(f"abrirFichaLote('{lote['id']}')"); pg.wait_for_timeout(200); ok('Manejo sanitário' in pg.inner_text(M), 'ficha do lote mostra manejos'); closeall()
    for h in ['estoque','manejo','reproducao','calendario','custos','patrimonio','relatorios']:
        go(h); ok(len(pg.inner_text('#main')) > 80, f'página {h} ok')
    pg.set_viewport_size({'width':390,'height':844}); go('calendario'); pg.wait_for_timeout(300); pg.screenshot(path='/home/claude/testenv/cal_mobile.png', full_page=True)
    b.close()
print('ERRORS:', errors)
print(f'{sum(results)}/{len(results)} passed')
