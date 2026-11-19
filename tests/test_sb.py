import re, sys, json
from playwright.sync_api import sync_playwright

APP = '/home/claude/estancia78/index.html'
NM = '/home/claude/testenv/node_modules/'
errors = []; results = []

def ok(cond, msg):
    results.append(('PASS' if cond else 'FAIL', msg))
    print(('PASS ' if cond else 'FAIL ') + msg, flush=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width':1400,'height':900}, accept_downloads=True); pg.set_default_timeout(4000)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'fonts.g' not in m.text else None)
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
    downloads = []
    pg.on('download', lambda d: downloads.append(d.suggested_filename))
    pg.goto('file://' + APP)
    pg.wait_for_timeout(500)
    ok(pg.locator('#fLogin').count() == 1, 'tela de login aparece')
    pg.fill('#fLogin [name=email]', 'lucas@teste.com'); pg.fill('#fLogin [name=senha]', 'errada'); pg.click('#fLogin button'); pg.wait_for_timeout(300)
    ok('incorretos' in pg.inner_text('#splash'), 'senha errada recusada')
    pg.fill('#fLogin [name=email]', 'intruso@teste.com'); pg.fill('#fLogin [name=senha]', 'segredo1'); pg.click('#fLogin button'); pg.wait_for_timeout(300)
    ok('não está autorizado' in pg.inner_text('#splash'), 'e-mail não autorizado é bloqueado')
    pg.click('#fLogin [data-l=sair]'); pg.wait_for_timeout(200)
    pg.fill('#fLogin [name=email]', 'lucas@teste.com'); pg.fill('#fLogin [name=senha]', 'segredo1'); pg.click('#fLogin button'); pg.wait_for_timeout(800)
    E = pg.evaluate
    M = '#modal-root .mback:last-child '
    def fill(name, v): pg.fill(M + f'[name="{name}"]', str(v))
    def sel(name, v): pg.select_option(M + f'[name="{name}"]', v)
    def submit():
        n0 = pg.locator('#modal-root .mback').count()
        pg.click(M + 'button[type=submit]')
        for _ in range(60):
            pg.wait_for_timeout(50)
            if pg.locator('#modal-root .mback').count() != n0 or pg.locator(M + '.ferr:not([hidden])').count(): break
        pg.wait_for_timeout(200)
    def err(): return pg.inner_text(M + '.ferr') if pg.locator(M + '.ferr:not([hidden])').count() else ''
    def nmod(): return pg.locator('#modal-root .mback').count()
    def closeall(): E("document.querySelectorAll('#modal-root .mback').forEach(m=>m.remove())")
    def go(h): pg.evaluate(f"location.hash='{h}'"); pg.wait_for_timeout(200)

    ok(pg.locator('#splash').count() == 0, 'splash removido após conectar')
    ok(pg.inner_text('#dbstate') == 'sincronizado', 'estado do banco: sincronizado')
    ok('Bem-vindo' in pg.inner_text('#main'), 'dashboard vazio mostra boas-vindas')

    # 1. Conta
    go('financeiro'); pg.click('[data-act=tab][data-val=contas]'); pg.click('[data-act=novaConta]')
    fill('nome','Caixa'); fill('saldoInicial','1.000,00'); submit(); print('DBG', err(), nmod(), E("S.data.contas"), E("S.page"))
    ok(E("A('contas').length") == 1 and E("saldoTotal()") == 1000, 'conta Caixa com saldo 1000 (vírgula aceita)')
    pg.click('[data-act=novaConta]'); fill('nome','caixa'); submit()
    ok('Já existe' in err(), 'impede conta duplicada'); closeall()

    # 2. Despesa paga
    pg.click('[data-act=novoLanc]'); sel('atividade','bovinos'); sel('categoria','Ração'); fill('descricao','Ração inicial')
    fill('quantidade','10'); fill('valorUnit','30');
    ok(pg.input_value(M+'[name=valor]') == '300', 'valor total = qtd × unitário'); submit()
    ok(E("saldoTotal()") == 700, 'despesa paga reduz saldo para 700')
    ok(E("A('lancamentos')[0].classificacao") == 'operacional', 'ração classificada como despesa operacional')
    # duplicidade
    pg.click('[data-act=novoLanc]'); sel('atividade','bovinos'); sel('categoria','Ração'); fill('descricao','Ração inicial'); fill('valor','300'); submit()
    ok(nmod() == 2 and 'Já existe um lançamento igual' in pg.inner_text(M), 'alerta de lançamento duplicado')
    pg.click(M + 'button.ghost[data-close]'); pg.wait_for_timeout(200); closeall()
    ok(E("A('lancamentos').length") == 1, 'duplicado cancelado não grava')

    # 3. Parcelado pendente
    pg.click('[data-act=novoLanc]'); sel('atividade','suinos'); sel('categoria','Milho'); fill('descricao','Milho safra'); fill('valor','1000'); sel('situacao','pendente'); fill('parcelas','3'); submit()
    parc = E("A('lancamentos').filter(l=>l.grupoParcela).map(l=>[l.valor,l.vencimento]).sort((a,b)=>a[1].localeCompare(b[1]))")
    ok(len(parc) == 3 and round(sum(x[0] for x in parc),2) == 1000 and parc[0][0] == 333.33 and parc[2][0] == 333.34, f'parcelamento 3x soma 1000 ({parc})')
    ok(E("sum(abertos('despesa'),restante)") == 1000, 'contas a pagar = 1000')
    # pagamento parcial
    lid = E("A('lancamentos').filter(l=>l.grupoParcela).sort((a,b)=>a.vencimento.localeCompare(b.vencimento))[0].id")
    E(f"abrirPagamento(byId('lancamentos','{lid}'))"); fill('valor','500'); submit()
    ok('maior que o saldo' in err(), 'bloqueia pagamento acima do saldo em aberto')
    fill('valor','100'); submit()
    ok(E(f"statusL(byId('lancamentos','{lid}'))") == 'parcial' and E("saldoTotal()") == 600, 'pagamento parcial → status parcial, saldo 600')

    # 4. Recorrente
    pg.click('[data-act=novoLanc]'); sel('atividade','geral'); sel('grupo','gerais'); sel('categoria','Energia elétrica'); fill('valor','150'); fill('recorrente','3'); submit()
    ok(E("A('lancamentos').filter(l=>l.categoria==='Energia elétrica').length") == 3 and E("saldoTotal()") == 450, 'recorrência mensal 3x, 1ª paga (saldo 450)')
    ok(E("A('lancamentos').find(l=>l.categoria==='Energia elétrica').classificacao") == 'geral', 'energia classificada como despesa geral')

    # 5. Bovinos
    go('bovinos'); pg.click('[data-act=novoAnimal]'); fill('ident','101'); fill('nome','Mimosa'); sel('categoria','Vaca'); fill('pesoInicial','400'); fill('valorAquisicao','2000'); fill('fornecedor','Fazenda X'); fill('local','Pasto 1'); submit()
    a1 = E("A('animais').find(a=>a.ident==='101')")
    ok(a1 and a1['situacao'] == 'ativo', 'bovino 101 cadastrado por compra')
    ok(E("A('lancamentos').some(l=>l.categoria==='Compra de bovinos' && l.valor===2000 && l.classificacao==='patrimonio' && l.origem==='compra')"), 'compra gera despesa de aquisição de patrimônio')
    ok(E("saldoTotal()") == -1550, 'saldo após compra = -1550')
    pg.click('[data-act=novoAnimal]'); fill('ident','101'); submit()
    ok('Já existe' in err(), 'bloqueia brinco duplicado'); closeall()
    pg.click('[data-act=novoAnimal]'); fill('ident','102'); sel('categoria','Boi de engorda'); sel('sexo','Macho'); fill('pesoInicial','350'); fill('valorAquisicao','2500'); sel('situacao','pendente'); fill('local','Pasto 1'); submit()
    pg.click('[data-act=novoAnimal]'); fill('ident','103'); sel('origem','nascimento'); sel('categoria','Bezerra'); fill('mae','101'); fill('pesoInicial','30'); submit()
    ok(E("cabecas('bovino')") == 3, '3 bovinos ativos')
    ok(E("A('lancamentos').filter(l=>l.categoria==='Compra de bovinos').length") == 2, 'nascimento não gera lançamento financeiro')
    print(E("A('animais').map(a=>[a.ident,a.categoria,a.origem])"))
    a2 = E("A('animais').find(a=>a.ident==='102').id")
    E(f"abrirPesagem('{a2}')"); fill('data', E("addMeses(hoje(),0)")); fill('peso','380'); submit()
    ok(E(f"byId('animais','{a2}').pesoAtual") == 380, 'pesagem atualiza peso atual')
    E(f"abrirMovInd('{a2}','transferencia')"); fill('para','Pasto 2'); submit(); closeall()
    ok(E(f"byId('animais','{a2}').local") == 'Pasto 2' and E("A('lancamentos').length") == 9, 'transferência de pasto sem lançamento financeiro')
    E(f"abrirMovInd('{a2}','categoria')"); sel('para','Boi'); submit(); closeall()
    ok(E(f"byId('animais','{a2}').categoria") == 'Boi', 'mudança de categoria')
    # venda por kg de 101 e 102
    a1id = a1['id']
    E("abrirVenda('bovino',{})")
    pg.check(M + f'input[name=animal][value="{a1id}"]'); pg.check(M + f'input[name=animal][value="{a2}"]')
    sel('produto','Bovino por kg (vivo)'); sel('modo','kg'); fill('pesoTotal','800'); pg.dispatch_event(M+'[name=pesoTotal]','input'); fill('valorKg','10'); pg.dispatch_event(M+'[name=valorKg]','input'); fill('comprador','Frigorífico Y')
    ok(pg.input_value(M+'[name=qtd]') == '2' and pg.input_value(M+'[name=valorTotal]') == '8000', 'venda por kg: 2 cab × 800 kg × R$10 = 8000')
    submit()
    ok(E(f"byId('animais','{a1id}').situacao") == 'vendido' and E("cabecas('bovino')") == 1, 'venda dá baixa nos bovinos')
    v = E("A('lancamentos').find(l=>l.origem==='venda')")
    ok(v and v['valor'] == 8000 and v['custoVendido'] == 4500 and v['categoria'] == 'Venda de bovinos', 'venda registra receita 8000 e custo 4500')
    a3 = E("A('animais').find(a=>a.ident==='103').id")
    E(f"abrirMovInd('{a3}','mortalidade')"); fill('causa','Picada de cobra'); submit(); closeall()
    ok(E("cabecas('bovino')") == 0, 'mortalidade baixa o animal')

    # 6. Suínos lotes
    go('suinos'); pg.click('[data-act=novoLote]'); fill('codigo','SUI-001'); sel('categoria','Leitão desmamado'); fill('qtd','10'); fill('valorAquisicao','1500'); submit()
    l1 = E("A('lotes').find(l=>l.codigo==='SUI-001').id")
    ok(E(f"saldoLote('{l1}')") == 10 and E(f"custoMedioLote('{l1}')") == 150, 'lote suíno 10 cab., custo médio 150')
    E(f"abrirVenda('suino',{{loteId:'{l1}'}})"); sel('produto','Leitão desmamado'); fill('qtd','11'); fill('valorCabeca','180'); pg.dispatch_event(M+'[name=valorCabeca]','input'); submit()
    ok('superior à quantidade disponível' in err(), 'impede venda acima do saldo do lote')
    fill('qtd','10'); pg.dispatch_event(M+'[name=qtd]','input')
    ok(pg.input_value(M+'[name=valorTotal]') == '1800', 'exemplo do escopo: 10 leitões × 180 = 1800')
    sel('situacao','pendente'); submit()
    ok(E(f"saldoLote('{l1}')") == 0, 'venda zera saldo do lote')
    vs = E("A('movimentacoes').find(m=>m.tipo==='venda'&&m.especie==='suino')")
    ok(vs['venda']['lucro'] == 300, 'lucro da venda de leitões = 300')
    ok(E("A('lancamentos').find(l=>l.refId==='%s').categoria" % vs['id']) == 'Venda de leitões desmamados', 'categoria de receita: venda de leitões desmamados')
    ok(E("sum(abertos('receita'),restante)") == 1800, 'venda a prazo entra em contas a receber')
    # porcos inteiros por kg
    pg.click('[data-act=novoLote]'); fill('codigo','SUI-002'); sel('categoria','Porco terminado'); fill('qtd','2'); sel('origem','entrada'); submit(); print('DBG2', err(), nmod(), E("A('lotes').map(l=>l.codigo)"), E("S.page"), E("uiGet('suiTab','lotes')"))
    l2 = E("A('lotes').find(l=>l.codigo==='SUI-002').id")
    E(f"abrirVenda('suino',{{loteId:'{l2}'}})"); sel('produto','Porco inteiro'); sel('modo','kg'); fill('qtd','2'); fill('pesoMedio','100'); pg.dispatch_event(M+'[name=pesoMedio]','input'); fill('valorKg','12'); pg.dispatch_event(M+'[name=valorKg]','input')
    ok(pg.input_value(M+'[name=pesoTotal]') == '200' and pg.input_value(M+'[name=valorTotal]') == '2400', 'exemplo do escopo: 2 porcos × 100 kg × R$12 = 2400')
    submit()
    ok(E("A('lancamentos').some(l=>l.categoria==='Venda de porcos inteiros'&&l.valor===2400)"), 'receita de porcos inteiros registrada')
    # leitegada: nascimento, mortalidade, transferência, desmame
    pg.click('[data-act=novoLote]'); fill('codigo','SUI-003'); sel('categoria','Leitão lactente'); fill('qtd','12'); sel('origem','nascimento'); submit(); print('ERR3', err(), nmod(), E("A('lotes').map(l=>l.codigo)"))
    pg.click('[data-act=novoLote]'); fill('codigo','SUI-004'); sel('categoria','Leitão para recria'); fill('qtd','1'); sel('origem','entrada'); submit()
    l3 = E("A('lotes').find(l=>l.codigo==='SUI-003').id"); l4 = E("A('lotes').find(l=>l.codigo==='SUI-004').id")
    E(f"abrirMovLote('{l3}','mortalidade')"); fill('qtd','2'); submit()
    E(f"abrirMovLote('{l3}','mortalidade')"); fill('qtd','20'); submit(); ok('maior que o saldo' in err(), 'mortalidade acima do saldo bloqueada'); closeall()
    E(f"abrirMovLote('{l3}','transferencia')"); fill('qtd','4'); sel('para', l4); submit()
    ok(E(f"saldoLote('{l3}')") == 6 and E(f"saldoLote('{l4}')") == 5, 'transferência entre lotes: 6 e 5')
    E(f"abrirMovLote('{l3}','desmame')"); fill('qtd','6'); fill('pesoMedio','7,5'); submit()
    ok(E(f"byId('lotes','{l3}').categoria") == 'Leitão desmamado', 'desmame muda categoria do lote')
    ok(E("A('lancamentos').length") == 13, 'movimentações internas não geram lançamentos (13 lançamentos)')
    # estorno da venda de leitões
    E(f"void estornarMov(byId('movimentacoes','{vs['id']}'))"); pg.wait_for_timeout(100); submit(); pg.wait_for_timeout(200)
    ok(E(f"saldoLote('{l1}')") == 10 and not E("A('lancamentos').some(l=>l.refId==='%s')" % vs['id']), 'estorno da venda devolve saldo e exclui receita')
    ok(E("sum(abertos('receita'),restante)") == 0, 'estorno remove conta a receber')
    # estorno de entrada com saldo baixo
    tr = E(f"A('movimentacoes').find(m=>m.tipo==='transferencia'&&m.loteId==='{l3}').id")
    E(f"abrirMovLote('{l4}','mortalidade')"); fill('qtd','5'); submit()
    E(f"void estornarMov(byId('movimentacoes','{tr}'))"); pg.wait_for_timeout(200)
    ok(nmod() == 0 and E(f"saldoLote('{l4}')") == 0, 'estorno que deixaria saldo negativo é bloqueado')

    # 7. Plantel individual suíno + venda individual
    pg.click('[data-act=tab][data-val=plantel]'); pg.click('[data-act=novoAnimal]'); fill('ident','M-01'); sel('categoria','Matriz'); sel('origem','entrada'); submit()
    mid = E("A('animais').find(a=>a.ident==='M-01').id")
    ok(E("cabecas('suino')") == 10 + 6 + 1, 'total suínos = lotes + individuais (17)')

    # 8. Galinhas e ovos
    go('galinhas'); pg.click('[data-act=novoLote]'); fill('codigo','GAL-001'); sel('categoria','Poedeira'); fill('qtd','50'); fill('valorAquisicao','1000'); fill('local','Galinheiro 1'); submit()
    ok(E("cabecas('galinha')") == 50, 'lote de 50 galinhas')
    E("abrirOvos()"); fill('produzidos','120'); fill('vendidos','60'); fill('precoDuzia','12'); pg.dispatch_event(M+'[name=precoDuzia]','input'); submit()
    ok(E("estoqueOvos()") == 60 and E("A('lancamentos').some(l=>l.categoria==='Venda de ovos'&&l.valor===60)"), 'ovos: estoque 60 e receita R$60 (5 dz × 12)')
    E("abrirOvos()"); fill('vendidos','100'); fill('precoDuzia','12'); submit()
    ok('maiores que o estoque' in err(), 'impede vender mais ovos que o estoque'); closeall()

    # 9. Despesa geral de investimento
    go('despesas-gerais'); pg.click('[data-act=novoGasto]'); sel('grupo','cercas'); sel('categoria','Arame')
    ok(pg.input_value(M+'[name=classificacao]') == 'investimento', 'arame → investimento em infraestrutura (padrão)')
    fill('local','Pasto 3'); fill('valor','800'); submit()
    pg.click('[data-act=novoGasto]'); sel('grupo','cercas'); sel('categoria','Manutenção de cercas')
    ok(pg.input_value(M+'[name=classificacao]') == 'manutencao', 'manutenção de cercas → manutenção e conservação'); fill('valor','200'); submit()
    t = pg.inner_text('#main').replace('\xa0',' ')
    ok('R$ 1.000,00' in t and 'Pasto 3' in t, 'despesas gerais: cercas 1000 e local listado')

    # 10. Resultado econômico
    e = E("econ(mesIni(), mesFim(), null)")
    # receitas: 8000 bovinos + 2400 porcos + 60 ovos = 10460 ; cmv 4500 + 0 ; oper: 300 + 333.33(parcela1 milho, venc mes atual) ... calc
    print('econ', e)
    ok(e['rec'] == 10460, 'receitas do mês = 10.460')
    ok(e['inv'] == 4500 + 1500 + 1000 + 800, 'investimentos separados (compras de animais + cercas) = 7.800')
    ok(abs(e['res'] - (e['rec'] - e['cmv'] - e['oper'] - e['ger'])) < 0.01 and e['cmv'] == 4500, 'resultado = receitas − custo vendidos − operacionais − gerais')

    # 11. Dashboard render + charts
    go('dashboard'); pg.wait_for_timeout(400)
    ok(pg.locator('canvas').count() == 7, 'dashboard com 7 gráficos')
    ok(E("S.charts.length") == 7, 'gráficos renderizados (Chart.js)')
    pg.screenshot(path='/home/claude/testenv/dash.png', full_page=True)
    # filtro
    pg.click('[data-act=periodo][data-v=tudo]'); pg.wait_for_timeout(200)
    ok('INÍCIO A HOJE' in pg.inner_text('#main').upper(), 'filtro "Tudo" funciona')

    # 12. Exports
    go('financeiro'); pg.click('[data-act=tab][data-val=lanc]'); pg.click('[data-act=expLancs]'); pg.wait_for_timeout(500)
    go('bovinos'); pg.click('[data-act=expAnimais]'); pg.wait_for_timeout(300)
    print(downloads)
    ok(len(downloads) == 2 and downloads[0].endswith('.xlsx'), 'exportação Excel (.xlsx) baixa no navegador')
    # sincronização vinda de outro aparelho
    E("window.__sb.externo('contas','ext1',{nome:'Banco do celular',tipoConta:'Conta corrente',saldoInicial:100,excluido:false})"); pg.wait_for_timeout(300)
    ok(E("A('contas').some(c=>c.nome==='Banco do celular')"), 'tempo real: conta criada em outro aparelho aparece')
    ok(E("window.__sb.writes") > 50 and len([k for k in E("Object.keys(window.__sb.store.docs)") if k.startswith('lancamentos|')]) == E("S.data.lancamentos.length"), 'dados gravados no Supabase (tabela docs)')

    # 13. Exclusão lógica + auditoria
    man = E("A('lancamentos').find(l=>l.categoria==='Ração').id")
    E(f"void excluirLanc(byId('lancamentos','{man}'))"); pg.wait_for_timeout(100); submit()
    ok(E(f"byId('lancamentos','{man}').excluido") == True and E("saldoTotal()") == E("saldoTotal()"), 'exclusão lógica mantém o registro')
    ok(len(E("S.data.auditoria")) > 20, 'auditoria registrando ações')
    auto = E("A('lancamentos').find(l=>l.origem==='venda').id")
    E(f"void excluirLanc(byId('lancamentos','{auto}'))"); pg.wait_for_timeout(100)
    ok(nmod() == 0 and not E(f"byId('lancamentos','{auto}').excluido"), 'lançamento automático não é excluído direto (exige estorno)')

    # 14. Double click on submit -> only one record
    go('financeiro'); pg.click('[data-act=novoLanc]'); sel('atividade','galinhas'); sel('categoria','Ração'); fill('descricao','Ração postura'); fill('valor','99')
    n0 = E("A('lancamentos').length"); pg.dblclick(M + 'button[type=submit]'); pg.wait_for_timeout(400)
    ok(E("A('lancamentos').length") == n0 + 1, 'duplo clique grava só uma vez')

    # 15. Each page renders
    for h in ['dashboard','financeiro','bovinos','suinos','galinhas','manejo','reproducao','calendario','estoque','custos','despesas-gerais','patrimonio','relatorios','configuracoes']:
        go(h); ok(len(pg.inner_text('#main')) > 50, f'página {h} renderiza')
    for tb in ['pagar','receber','fluxo','contas']:
        go('financeiro'); pg.click(f'[data-act=tab][data-val={tb}]'); ok(len(pg.inner_text('#main')) > 50, f'financeiro/{tb}')
    for (h, tb) in [('suinos','vendas'),('suinos','movs'),('galinhas','ovos'),('galinhas','vendas'),('bovinos','vendas'),('configuracoes','auditoria'),('configuracoes','lixeira')]:
        go(h); pg.click(f'[data-act=tab][data-val={tb}]'); ok(len(pg.inner_text('#main')) > 50, f'{h}/{tb}')
    go('suinos'); pg.click('[data-act=tab][data-val=lotes]'); E(f"abrirFichaLote('{l3}')"); pg.wait_for_timeout(100)
    pg.screenshot(path='/home/claude/testenv/lote.png'); closeall()
    go('bovinos'); pg.click('[data-act=tab][data-val=rebanho]'); pg.select_option('[data-filter=bovinoSit]', ''); E(f"abrirFicha('{a2}')"); pg.wait_for_timeout(300)
    pg.screenshot(path='/home/claude/testenv/ficha.png'); closeall()
    go('suinos'); pg.click('[data-act=tab][data-val=vendas]'); pg.click('[data-act=periodo][data-v=tudo]'); pg.screenshot(path='/home/claude/testenv/vendas.png', full_page=True)
    E(f"abrirVenda('suino',{{loteId:'{l1}'}})"); pg.wait_for_timeout(100); pg.screenshot(path='/home/claude/testenv/vendaform.png'); closeall()
    # Mobile
    pg.set_viewport_size({'width':390,'height':844}); go('dashboard'); pg.wait_for_timeout(300)
    pg.screenshot(path='/home/claude/testenv/mobile.png')
    pg.click('#burger'); pg.wait_for_timeout(300); pg.screenshot(path='/home/claude/testenv/mobile-menu.png')
    b.close()

print('\nERRORS:', errors)
fails = [r for r in results if r[0] == 'FAIL']
print(f'{len(results)-len(fails)}/{len(results)} passed')
