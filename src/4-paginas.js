/* =====================================================================
   Dashboard · Despesas Gerais · Configurações · páginas futuras · roteador
   ===================================================================== */
function chartOpts({ legend=true, money=true, stacked=false, horizontal=false } = {}){
  const fmt = v => money ? R0(v) : N(v);
  return { responsive:true, maintainAspectRatio:false, indexAxis: horizontal ? 'y' : 'x',
    interaction:{ mode: horizontal ? 'nearest' : 'index', intersect:false },
    plugins:{ legend:{ display:legend, position:'bottom', labels:{ boxWidth:10, boxHeight:10, useBorderRadius:true, borderRadius:2, font:{ family:'Inter', size:11.5 }, color:'#4d5650' } },
      tooltip:{ backgroundColor:'#16301f', titleFont:{ family:'Inter', weight:'600' }, bodyFont:{ family:'Inter' }, padding:10, cornerRadius:8,
        callbacks:{ label: c => ` ${c.dataset.label ? c.dataset.label+': ' : ''}${fmt(horizontal ? c.parsed.x : c.parsed.y)}` } } },
    scales:{
      x:{ stacked, grid:{ display: horizontal, color:'#eef0ea' }, border:{ display:false }, ticks:{ font:{ family:'Inter', size:11 }, color:'#7b847e', ...(horizontal ? { callback: v => fmt(v), maxTicksLimit:6 } : {}) } },
      y:{ stacked, grid:{ display: !horizontal, color:'#eef0ea' }, border:{ display:false }, ticks:{ font:{ family:'Inter', size:11 }, color:'#7b847e', ...(horizontal ? {} : { callback: v => fmt(v), maxTicksLimit:7 }) }, beginAtZero:true } } };
}
const barDs = (label, data, color) => ({ label, data, backgroundColor:color, borderRadius:4, borderSkipped:'start', maxBarThickness:34, categoryPercentage:.7, barPercentage:.9, borderColor:'#fff', borderWidth:{ left:1, right:1 } });
function mkChart(id, cfgc){ const el = document.getElementById(id); if (!el || !window.Chart) return; S.charts.push(new Chart(el, cfgc)); }

function pgDashboard(){
  const [ini, fim] = periodo('db'); const atv = uiGet('dbAtv','');
  const e = econ(ini, fim, atv || null);
  const cx = caixa(ini, fim, l => !atv || l.atividade === atv);
  const ap = sum(abertos('despesa'), restante), ar = sum(abertos('receita'), restante);
  const tudo = econ('', '', null);
  const invInfra = sum(A('lancamentos').filter(l => l.tipo==='despesa' && CLASSIF_INV.includes(l.classificacao) && !Object.values(COMPRA_CAT).includes(l.categoria)), l => l.valor);
  const invAnimais = sum(A('lancamentos').filter(l => l.tipo==='despesa' && Object.values(COMPRA_CAT).includes(l.categoria)), l => l.valor);
  const pr = patrimonioResumo();
  const plantel = pr.reb.total;
  const saldo = saldoTotal();
  const patrimonio = pr.total;
  // Animais no período
  const M = movsValidas().filter(m => inRange(m.data, ini, fim) && (!atv || ESPECIES[m.especie]?.atividade === atv));
  const qm = t => sum(M.filter(m => m.tipo === t), m => m.qtd);
  const alertas = [];
  const venc = abertos('despesa').filter(l => statusL(l) === 'vencido'); if (venc.length) alertas.push(['err', `${venc.length} conta(s) a pagar vencida(s): ${R(sum(venc, restante))}`]);
  const vr = abertos('receita').filter(l => statusL(l) === 'vencido'); if (vr.length) alertas.push(['', `${vr.length} recebimento(s) atrasado(s): ${R(sum(vr, restante))}`]);
  if (!A('contas').length) alertas.push(['', 'Cadastre suas contas financeiras (Financeiro › Contas financeiras) para acompanhar o saldo disponível.']);
  for (const c of A('contas')) if (saldoConta(c) < 0) alertas.push(['err', `Conta “${c.nome}” com saldo negativo: ${R(saldoConta(c))}`]);
  if (typeof extraAlertas === 'function') alertas.push(...extraAlertas());
  const vazioSis = !A('lancamentos').length && !A('animais').length && !A('lotes').length;
  return `<div class="bar">${filtroPeriodo('db')}
      <label class="fld"><span>Atividade</span><select data-filter="dbAtv">${opts(Object.entries(ATIVIDADES), atv, 'Todas')}</select></label></div>
    ${vazioSis ? `<div class="card" style="margin-bottom:16px;border-left:3px solid var(--ouro)"><h3>Bem-vindo à Estância 78</h3>
      <p style="margin:0 0 10px;color:var(--tx2);line-height:1.6">Para começar: 1) cadastre suas contas em <b>Financeiro › Contas financeiras</b>; 2) cadastre o rebanho em <b>Bovinos</b>, os lotes em <b>Suínos</b> e <b>Galinhas</b> (use “Inventário inicial” para animais que já estão na propriedade); 3) lance as despesas do dia a dia em <b>Financeiro</b> e <b>Despesas Gerais</b>.</p>
      <div class="btnrow" style="margin:0"><button class="btn primary" data-act="novaConta">Cadastrar conta</button><button class="btn ghost" data-act="go" data-p="bovinos">Ir para Bovinos</button></div></div>` : ''}
    ${alertas.length ? `<div class="alerts" style="margin-bottom:14px">${alertas.map(([c,t]) => `<div class="${c}">${esc(t)}</div>`).join('')}</div>` : ''}
    <div class="section-t">Financeiro · ${D(ini)||'início'} a ${D(fim)||'hoje'}</div>
    <div class="grid g5">
      ${kpi('Receitas', R(e.rec), 'competência', 'green')}
      ${kpi('Despesas', R(e.desp), `oper. ${R0(e.oper)} · gerais ${R0(e.ger)}`, 'red')}
      ${kpi('Resultado líquido', `<span class="${e.res<0?'neg':'pos'}">${R(e.res)}</span>`, e.cmv?`após custo de animais vendidos ${R0(e.cmv)}`:'receitas − custos − despesas gerais', 'gold')}
      ${kpi('Fluxo de caixa', `<span class="${cx.liq<0?'neg':''}">${R(cx.liq)}</span>`, `entradas ${R0(cx.ent)} · saídas ${R0(cx.sai)}`, 'blue')}
      ${kpi('Investimentos no período', R(e.inv), 'infraestrutura e aquisições')}
      ${kpi('Saldo disponível', R(saldo), A('contas').length+' conta(s)', 'gold')}
      ${kpi('Contas a pagar', R(ap), abertos('despesa').length+' em aberto', 'red')}
      ${kpi('Contas a receber', R(ar), abertos('receita').length+' em aberto', 'green')}
      ${kpi('Total investido', R(invInfra+invAnimais), `estruturas ${R0(invInfra)} · animais ${R0(invAnimais)}`)}
      ${kpi('Patrimônio estimado', R(patrimonio), 'saldo + a receber − a pagar + bens + animais', 'gold')}
    </div>
    <div class="section-t">Animais</div>
    <div class="grid g5">
      ${kpi('Total de animais ativos', N(cabecas('bovino')+cabecas('suino')+cabecas('galinha')), `plantel estimado ${R0(plantel)}`, 'gold')}
      ${kpi('Bovinos', N(cabecas('bovino')), '', 'green')}${kpi('Suínos', N(cabecas('suino')), '', 'red')}${kpi('Galinhas', N(cabecas('galinha')), '', 'blue')}
      ${kpi('Nascimentos', N(qm('nascimento')), 'no período', 'green')}
      ${kpi('Mortalidades', N(qm('mortalidade')), 'no período', 'red')}${kpi('Compras', N(qm('compra')), 'cabeças no período')}${kpi('Vendas', N(qm('venda')), 'cabeças no período', 'blue')}
      ${kpi('Transferências', N(M.filter(m=>['transferencia','local'].includes(m.tipo)).length), 'movimentações internas')}${kpi('Estoque de ovos', N(estoqueOvos()), 'unidades')}
    </div>
    <div class="section-t">Gráficos gerenciais</div>
    <div class="grid g2">
      <div class="card"><h3>Receitas x despesas por mês<span class="hint">12 meses até ${D(fim||hoje()).slice(3)}</span></h3><div class="chart-box"><canvas id="chRD"></canvas></div></div>
      <div class="card"><h3>Resultado financeiro mensal<span class="hint">receitas − custos − despesas gerais</span></h3><div class="chart-box"><canvas id="chRes"></canvas></div></div>
      <div class="card"><h3>Despesas por categoria<span class="hint">período · sem investimentos</span></h3><div class="chart-box"><canvas id="chCat"></canvas></div></div>
      <div class="card"><h3>Custos por atividade<span class="hint">período · operacionais + gerais</span></h3><div class="chart-box"><canvas id="chAtv"></canvas></div></div>
      <div class="card"><h3>Rentabilidade por atividade<span class="hint">período</span></h3><div class="chart-box"><canvas id="chRent"></canvas></div></div>
      <div class="card"><h3>Animais por espécie<span class="hint">cabeças ativas</span></h3><div class="chart-box"><canvas id="chEsp"></canvas></div></div>
      <div class="card"><h3>Evolução do patrimônio<span class="hint">mensal</span></h3><div class="chart-box"><canvas id="chPat"></canvas></div></div>
      <div class="card"><h3>Próximos compromissos<span class="hint"><a href="#calendario">abrir calendário</a></span></h3>${(() => { const pe = A('eventos').filter(e => !e.concluido && e.data >= hoje()).sort((a,b)=>a.data.localeCompare(b.data)||(a.hora||'').localeCompare(b.hora||'')).slice(0,7); return pe.length ? pe.map(e => linhaEvento(e, true)).join('') : '<p class="muted small">Nenhum compromisso agendado.</p>'; })()}</div>
    </div>`;
}
function afterDashboard(){
  const [ini, fim] = periodo('db'); const atv = uiGet('dbAtv','') || null;
  const ref = (fim || hoje()).slice(0,7) + '-01';
  const meses = Array.from({ length:12 }, (_, i) => addMeses(ref, i-11).slice(0,7));
  const em = meses.map(m => econ(m+'-01', mesFim(m+'-01'), atv));
  mkChart('chRD', { type:'bar', data:{ labels:meses.map(mesLabel), datasets:[ barDs('Receitas', em.map(x=>x.rec), CORES.receita), barDs('Despesas', em.map(x=>x.desp+x.cmv), CORES.despesa) ] }, options:chartOpts() });
  mkChart('chRes', { type:'line', data:{ labels:meses.map(mesLabel), datasets:[{ label:'Resultado', data:em.map(x=>x.res), borderColor:'#1f3d2b', backgroundColor:'#1f3d2b', borderWidth:2, pointRadius:4, pointHoverRadius:6, tension:.25,
    segment:{ borderColor: c => c.p1.parsed.y < 0 ? CORES.despesa : '#1f3d2b' }, pointBackgroundColor: em.map(x => x.res < 0 ? CORES.despesa : '#1f3d2b') }] }, options:chartOpts({ legend:false }) });
  const L = A('lancamentos').filter(l => l.tipo === 'despesa' && inRange(l.data, ini, fim) && CLASSIF_ECON.includes(l.classificacao) && (!atv || l.atividade === atv));
  const porCat = {}; for (const l of L) porCat[l.categoria] = (porCat[l.categoria]||0) + (+l.valor||0);
  let cats = Object.entries(porCat).sort((a,b) => b[1]-a[1]);
  if (cats.length > 9) { const outros = cats.slice(8).reduce((s,x)=>s+x[1],0); cats = [...cats.slice(0,8), ['Outras', outros]]; }
  mkChart('chCat', { type:'bar', data:{ labels:cats.map(c=>c[0]), datasets:[ barDs('Despesas', cats.map(c=>round2(c[1])), '#6b7a3a') ] }, options:chartOpts({ legend:false, horizontal:true }) });
  const atvs = Object.keys(ATIVIDADES);
  const ea = atvs.map(a => econ(ini, fim, a));
  mkChart('chAtv', { type:'bar', data:{ labels:atvs.map(a=>ATIVIDADES[a]), datasets:[{ ...barDs('Custos', ea.map(x=>x.oper+x.ger), atvs.map(a=>CORES[a])) }] }, options:chartOpts({ legend:false }) });
  const a3 = ['bovinos','suinos','galinhas'], e3 = a3.map(a => econ(ini, fim, a));
  mkChart('chRent', { type:'bar', data:{ labels:a3.map(a=>ATIVIDADES[a]), datasets:[ barDs('Receita', e3.map(x=>x.rec), CORES.receita), barDs('Custos', e3.map(x=>x.oper+x.ger+x.cmv), CORES.despesa), barDs('Resultado', e3.map(x=>x.res), '#a8780a') ] }, options:chartOpts() });
  const sv = serieEvolucao();
  mkChart('chPat', { type:'line', data:{ labels:sv.map(x => mesLabel(x[0])), datasets:[{ label:'Patrimônio', data:sv.map(x=>x[1]), borderColor:'#a8780a', backgroundColor:'#a8780a', borderWidth:2, pointRadius:4, tension:.25 }] }, options:chartOpts({ legend:false }) });
  mkChart('chEsp', { type:'bar', data:{ labels:['Bovinos','Suínos','Galinhas'], datasets:[{ ...barDs('Cabeças', [cabecas('bovino'), cabecas('suino'), cabecas('galinha')], [CORES.bovinos, CORES.suinos, CORES.galinhas]) }] }, options:chartOpts({ legend:false, money:false }) });
}

/* ---------- Despesas Gerais ---------- */
function pgDespesasGerais(){
  const [ini, fim] = periodo('dg'); const grp = uiGet('dgGrupo',''), cl = uiGet('dgClass','');
  const all = A('lancamentos').filter(l => l.tipo === 'despesa' && l.atividade === 'geral');
  const P = all.filter(l => inRange(l.data, ini, fim));
  const L = P.filter(l => (!grp || l.grupo === grp) && (!cl || l.classificacao === cl)).sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  const gk = Object.keys(GRUPOS_GERAIS);
  const porLocal = {}; for (const l of P) if (l.local) porLocal[l.local] = (porLocal[l.local]||0) + (+l.valor||0);
  return `<div class="bar"><button class="btn primary" data-act="novoGasto">+ Novo gasto da propriedade</button>${filtroPeriodo('dg')}
      <label class="fld"><span>Grupo</span><select data-filter="dgGrupo">${opts(gk.map(k=>[k,GRUPOS_GERAIS[k].nome]), grp, 'Todos')}</select></label>
      <label class="fld"><span>Classificação</span><select data-filter="dgClass">${opts(Object.entries(CLASSIF), cl, 'Todas')}</select></label>
      <button class="btn ghost" data-act="expGerais">Exportar Excel</button></div>
    <div class="section-t">No período</div>
    <div class="grid g5">${gk.map(k => kpi(GRUPOS_GERAIS[k].nome, R(sum(P.filter(l=>l.grupo===k), l=>l.valor)), `acumulado ${R0(sum(all.filter(l=>l.grupo===k), l=>l.valor))}`)).join('')}
      ${kpi('Total do período', R(sum(P, l=>l.valor)), `acumulado ${R0(sum(all, l=>l.valor))}`, 'gold')}</div>
    <div class="section-t">Por classificação (período)</div>
    <div class="grid g5">${Object.entries(CLASSIF).map(([k,t]) => kpi(t, R(sum(P.filter(l=>l.classificacao===k), l=>l.valor)), `acumulado ${R0(sum(all.filter(l=>l.classificacao===k), l=>l.valor))}`, CLASSIF_INV.includes(k)?'blue':'')).join('')}</div>
    ${Object.keys(porLocal).length ? `<div class="section-t">Por estrutura / local (período)</div><div class="chips" style="margin-bottom:6px">${Object.entries(porLocal).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="chip">${esc(k)}: <b>${R(v)}</b></span>`).join('')}</div>` : ''}
    <div class="section-t">Lançamentos</div>
    ${L.length ? `<div class="tw"><table><thead><tr><th>Data</th><th>Grupo</th><th>Item</th><th>Classificação</th><th>Descrição</th><th>Local</th><th class="n">Valor</th><th>Situação</th><th></th></tr></thead><tbody>
      ${L.map(l => `<tr><td>${D(l.data)}</td><td>${esc((GRUPOS_GERAIS[l.grupo]||{}).nome||'—')}</td><td>${esc(l.categoria)}</td><td><span class="badge ${CLASSIF_INV.includes(l.classificacao)?'b-par':'b-mut'}">${esc(CLASSIF[l.classificacao]||'')}</span></td>
        <td>${esc(l.descricao)}${l.contraparte?`<div class="small muted">${esc(l.contraparte)}</div>`:''}</td><td>${esc(l.local||'')}</td><td class="n">${R(l.valor)}</td><td>${badgeStatus(statusL(l))}</td>
        <td><div class="acts">${!quitado(l)?`<button class="ico" data-act="pagar" data-id="${l.id}">Pagar</button>`:''}<button class="ico" data-act="editLanc" data-id="${l.id}">Editar</button><button class="ico" data-act="delLanc" data-id="${l.id}">✕</button></div></td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="6">${L.length} lançamento(s)</td><td class="n">${R(sum(L,l=>l.valor))}</td><td colspan="2"></td></tr></tfoot></table></div>`
      : `<div class="tw">${vazio('Nenhum gasto no período', 'Registre gastos com cercas, casa, construções, energia, água e demais despesas da propriedade.')}</div>`}`;
}

/* ---------- Configurações ---------- */
function listaEditavel(titulo, chave, itens, sub){
  return `<div class="card"><h3>${titulo}</h3>${sub?`<p class="small muted" style="margin:-4px 0 10px">${sub}</p>`:''}
    <div class="chips" style="margin-bottom:10px">${itens.length ? itens.map((x,i)=>`<span class="chip">${esc(x)} <a style="cursor:pointer;color:var(--erro);margin-left:4px" data-act="cfgDel" data-k="${chave}" data-i="${i}">✕</a></span>`).join('') : '<span class="muted small">Nenhuma categoria personalizada.</span>'}</div>
    <div style="display:flex;gap:6px"><input id="in-${chave.replace('.','-')}" placeholder="Nova categoria" style="flex:1;border:1px solid var(--cinza3);border-radius:8px;padding:7px 10px"><button class="btn ghost sm" data-act="cfgAdd" data-k="${chave}">Adicionar</button></div></div>`;
}
function pgConfig(){
  const t = uiGet('cfgTab','geral');
  let body = '';
  if (t === 'geral') {
    const ve = S.cfg.valorEstimado || {};
    body = `<div class="grid g2">
      <div class="card"><h3>Valor estimado por cabeça</h3><p class="small muted" style="margin:-4px 0 12px">Usado para estimar o valor do plantel no patrimônio (o módulo Patrimônio da Etapa 3 trará avaliação por categoria).</p>
        <form id="fVE" class="fg fg3">${fNum('bovino','Bovino (R$)', ve.bovino)}${fNum('suino','Suíno (R$)', ve.suino)}${fNum('galinha','Galinha (R$)', ve.galinha)}</form>
        <div style="margin-top:10px"><button class="btn primary sm" data-act="salvarVE">Salvar valores</button></div></div>
      <div class="card"><h3>Usuário e segurança</h3><p style="margin:0;line-height:1.7;color:var(--tx2)">Acesso: <b>${esc(S.nome||'Proprietário')}</b> (login da conta Claude).<br>
        Somente você (e quem você convidar como editor) acessa e altera estes dados. Exclusões são lógicas e ficam registradas na auditoria.</p>
        <div class="btnrow" style="margin-top:12px"><button class="btn ghost sm" data-act="backup">Baixar backup completo (JSON)</button>
          <label class="btn ghost sm" style="cursor:pointer">Importar backup (JSON)<input type="file" id="inBackup" accept=".json,application/json" hidden></label></div>
        <p class="small muted" style="margin:6px 0 0">Banco atual: <b>${S.modo==='supabase'?'Supabase (site próprio)':'Claude'}</b>. Use o backup para levar os dados de um para o outro.</p></div>
      ${listaEditavel('Categorias extras de receita','catReceitaExtra', S.cfg.catReceitaExtra||[])}
      ${listaEditavel('Categorias extras de despesa','catDespesaExtra', S.cfg.catDespesaExtra||[])}
      ${listaEditavel('Categorias extras de bovinos','catAnimalExtra.bovino', (S.cfg.catAnimalExtra||{}).bovino||[])}
      ${listaEditavel('Categorias extras de suínos','catAnimalExtra.suino', (S.cfg.catAnimalExtra||{}).suino||[])}
      ${listaEditavel('Tipos extras de criação de galinhas','catAnimalExtra.galinha', (S.cfg.catAnimalExtra||{}).galinha||[])}
      ${listaEditavel('Estruturas / locais da propriedade','locais', S.cfg.locais||[], 'Sugestões para “estrutura ou local beneficiado” nos gastos (ex.: Casa sede, Pasto 1, Chiqueiro).')}
    </div>`;
  } else if (t === 'auditoria') {
    const AU = S.data.auditoria || [];
    body = AU.length ? `<div class="tw"><table><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Registro</th><th>Resumo</th></tr></thead><tbody>
      ${AU.map(a => `<tr><td>${D(a.quando)} ${(a.quando||'').slice(11,16)}</td><td>${esc(a.quemNome||'—')}</td><td><b>${esc(a.acao)}</b></td><td>${esc(a.colecao)}</td><td>${esc(a.resumo||'')}</td></tr>`).join('')}</tbody></table></div>
      <p class="small muted">Últimos 300 registros.</p>` : `<div class="tw">${vazio('Sem registros de auditoria ainda')}</div>`;
  } else if (t === 'lixeira') {
    const X = [...(S.data.lancamentos||[]).filter(x=>x.excluido).map(x=>({ ...x, _c:'Lançamento', _d:`${x.categoria} · ${x.descricao}`, _v:x.valor })),
      ...(S.data.movimentacoes||[]).filter(x=>x.excluido).map(x=>({ ...x, _c:'Movimentação', _d:`${MOV_NOMES[x.tipo]||x.tipo} · ${ESPECIES[x.especie]?.nome||''}`, _v:x.valor })),
      ...(S.data.animais||[]).filter(x=>x.excluido).map(x=>({ ...x, _c:'Animal', _d:x.ident })), ...(S.data.lotes||[]).filter(x=>x.excluido).map(x=>({ ...x, _c:'Lote', _d:x.codigo })),
      ...(S.data.ovos||[]).filter(x=>x.excluido).map(x=>({ ...x, _c:'Ovos', _d:`${x.produzidos} produzidos`, _v:x.valorVenda }))].sort((a,b)=>(b.excluidoEm||'').localeCompare(a.excluidoEm||''));
    body = `<p class="small muted">Registros excluídos ou estornados. Ficam guardados para consulta e não entram nos cálculos.</p>` + (X.length ? `<div class="tw"><table><thead><tr><th>Excluído em</th><th>Tipo</th><th>Data original</th><th>Descrição</th><th class="n">Valor</th></tr></thead><tbody>
      ${X.map(x => `<tr><td>${D(x.excluidoEm)}</td><td>${x._c}</td><td>${D(x.data||x.dataEntrada)}</td><td>${esc(x._d)}</td><td class="n">${x._v?R(x._v):''}</td></tr>`).join('')}</tbody></table></div>` : `<div class="tw">${vazio('Nenhum registro excluído')}</div>`);
  }
  return tabs('cfgTab', [['geral','Geral'],['auditoria','Auditoria'],['lixeira','Registros excluídos']], 'geral') + body;
}

/* ---------- Páginas das próximas etapas ---------- */
const FUTURAS = {
  manejo:['Etapa 2','Vacinação, vermifugação, medicamentos, sal mineral e suplementação por animal ou lote, com baixa automática no estoque e histórico sanitário. (A pesagem com GMD já funciona na ficha de cada animal.)'],
  reproducao:['Etapa 2','Matrizes e reprodutores, coberturas, previsão de parto, diagnóstico de gestação, partos (nascidos vivos/mortos), abortos, desmame e histórico de cada leitegada e de cada vaca.'],
  calendario:['Etapa 2','Calendário diário/semanal/mensal com coberturas, partos previstos, vacinações, pesagens, vendas programadas e manutenções, com responsáveis, lembretes e alertas de atraso.'],
  estoque:['Etapa 2','Rações, milho, sal, medicamentos, vacinas e materiais: entradas pelas compras, saídas por atividade e lote, preço médio, estoque mínimo e alertas de vencimento.'],
  custos:['Etapa 3','Custo por cabeça, por lote, por matriz, por leitegada, por leitão desmamado, por suíno terminado, por kg produzido, por ave e por dúzia de ovos, a partir dos lançamentos e consumos — sem duplicidade.'],
  patrimonio:['Etapa 3','Terreno, casa, cercas, galpões, máquinas e veículos com valor investido e valor atual, histórico de melhorias, avaliação do rebanho por categoria e evolução patrimonial.'],
  relatorios:['Etapa 3','DRE gerencial (mensal, anual, acumulada, por atividade) e os 20 relatórios com filtros, exportação em PDF e Excel com a identidade da Estância 78.']
};
function pgFutura(k){
  const [et, txt] = FUTURAS[k];
  return `<div class="card plan"><h3>${MENU.find(m=>m[0]===k)[1]} <span class="badge b-pend" style="font-family:Inter;letter-spacing:0">${et}</span></h3>
    <p style="margin:0;color:var(--tx2);line-height:1.6">${txt}</p>
    <p class="small muted" style="margin-top:12px">Os dados lançados desde já (animais, lotes, movimentações e despesas) serão aproveitados por este módulo quando ele chegar.</p></div>`;
}

const PAGES = {
  dashboard:{ titulo:'Dashboard', sub:'Visão geral da propriedade', render:pgDashboard, after:afterDashboard },
  financeiro:{ titulo:'Financeiro', sub:'Receitas, despesas, contas e fluxo de caixa', render:pgFinanceiro },
  bovinos:{ titulo:'Bovinos', sub:'Rebanho, vendas e movimentações', render:pgBovinos },
  suinos:{ titulo:'Suínos', sub:'Lotes, plantel, comercialização e movimentações', render:pgSuinos },
  galinhas:{ titulo:'Galinhas', sub:'Lotes, produção de ovos e vendas', render:pgGalinhas },
  'despesas-gerais':{ titulo:'Despesas Gerais – Estância 78', sub:'Cercas, casa, instalações e despesas da propriedade', render:pgDespesasGerais },
  configuracoes:{ titulo:'Configurações', sub:'Categorias, valores de referência, auditoria e backup', render:pgConfig }
};
for (const k of Object.keys(FUTURAS)) PAGES[k] = { titulo:MENU.find(m=>m[0]===k)[1], sub:'Em construção', render:() => pgFutura(k) };

/* ---------- Ações ---------- */
const ACTIONS = {
  tab: d => { S.ui[d.key] = d.val; render(); },
  setf: d => { S.ui[d.k] = d.v; render(); },
  go: d => { location.hash = d.p; },
  periodo: d => {
    const p = d.p, h = hoje();
    if (d.v === 'mes') { S.ui[p+'Ini'] = mesIni(h); S.ui[p+'Fim'] = mesFim(h); }
    if (d.v === 'mesant') { const x = addMeses(mesIni(h), -1); S.ui[p+'Ini'] = x; S.ui[p+'Fim'] = mesFim(x); }
    if (d.v === 'ano') { S.ui[p+'Ini'] = h.slice(0,4)+'-01-01'; S.ui[p+'Fim'] = h.slice(0,4)+'-12-31'; }
    if (d.v === 'tudo') { S.ui[p+'Ini'] = ''; S.ui[p+'Fim'] = ''; }
    render();
  },
  novoLanc: () => abrirLancamento(),
  novoLancTipo: d => abrirLancamento({ tipo:d.tipo }),
  outraReceita: d => abrirLancamento({ tipo:'receita', atividade:d.atv, categoria:'Venda de esterco' }),
  novoGasto: () => abrirLancamento({ tipo:'despesa', atividade:'geral' }),
  editLanc: d => abrirLancamento({}, byId('lancamentos', d.id)),
  delLanc: d => excluirLanc(byId('lancamentos', d.id)),
  pagar: d => abrirPagamento(byId('lancamentos', d.id)),
  desfazPg: async d => {
    const l = byId('lancamentos', d.id); if (!l) return;
    if (!(await confirmar('Desfazer este pagamento/recebimento? O lançamento volta a ficar em aberto.', 'Desfazer'))) return;
    try { exigeEscrita(); await dbUpd('lancamentos', l.id, { pagamentos:(l.pagamentos||[]).filter(p => p.id !== d.pg) }); await audit('desfazer pagamento','lancamentos',l.id,''); toast('Pagamento desfeito.'); $$('#modal-root .mback').forEach(m=>m.remove()); }
    catch(e){ falha(e); }
  },
  novaConta: () => abrirConta(),
  editConta: d => abrirConta(byId('contas', d.id)),
  novoAnimal: d => abrirAnimal(d.esp),
  editAnimal: d => abrirAnimal(byId('animais', d.id).especie, byId('animais', d.id)),
  ficha: d => abrirFicha(d.id),
  pesagem: d => abrirPesagem(d.id),
  indMov: d => abrirMovInd(d.id, d.tipo),
  novoLote: d => abrirLote(d.esp),
  editLote: d => abrirLote(byId('lotes', d.id).especie, byId('lotes', d.id)),
  fichaLote: d => abrirFichaLote(d.id),
  loteMov: d => abrirMovLote(d.id, d.tipo),
  encerrarLote: async d => { try { exigeEscrita(); await dbUpd('lotes', d.id, { situacao:'encerrado', dataEncerramento:hoje() }); await audit('encerrar','lotes',d.id,''); toast('Lote encerrado.'); $$('#modal-root .mback').forEach(m=>m.remove()); } catch(e){ falha(e); } },
  reabrirLote: async d => { try { exigeEscrita(); await dbUpd('lotes', d.id, { situacao:'ativo' }); toast('Lote reaberto.'); $$('#modal-root .mback').forEach(m=>m.remove()); } catch(e){ falha(e); } },
  vender: d => abrirVenda(d.esp, { loteId:d.lote, animalId:d.animal }),
  estornar: d => estornarMov(byId('movimentacoes', d.id)),
  novoOvos: () => abrirOvos(),
  delOvos: d => excluirOvos(byId('ovos', d.id)),
  salvarVE: async () => { try { exigeEscrita(); const f = $('#fVE'); await salvarCfg({ valorEstimado:{ bovino:num(f.elements.bovino.value), suino:num(f.elements.suino.value), galinha:num(f.elements.galinha.value) } }); toast('Valores salvos.'); } catch(e){ falha(e); } },
  cfgAdd: async d => {
    const inp = document.getElementById('in-'+d.k.replace('.','-')); const v = (inp.value||'').trim(); if (!v) return;
    try { exigeEscrita();
      if (d.k.includes('.')) { const [a,b] = d.k.split('.'); const obj = { ...(S.cfg[a]||{}) }; obj[b] = [...new Set([...(obj[b]||[]), v])]; await salvarCfg({ [a]:obj }); }
      else await salvarCfg({ [d.k]: [...new Set([...(S.cfg[d.k]||[]), v])] });
      toast('Adicionado.'); } catch(e){ falha(e); }
  },
  cfgDel: async d => {
    try { exigeEscrita();
      if (d.k.includes('.')) { const [a,b] = d.k.split('.'); const obj = { ...(S.cfg[a]||{}) }; obj[b] = (obj[b]||[]).filter((_,i)=>i!==+d.i); await salvarCfg({ [a]:obj }); }
      else await salvarCfg({ [d.k]: (S.cfg[d.k]||[]).filter((_,i)=>i!==+d.i) });
    } catch(e){ falha(e); }
  },
  backup: () => salvarArquivo(`estancia78-backup-${hoje()}.json`, JSON.stringify({ geradoEm:stamp(), config:S.cfg, ...Object.fromEntries(COLS.map(c=>[c, S.data[c]])) }, null, 1)),
  expLancs: () => { const L = filtraLancs('fin'); exportarXLSX(`estancia78-lancamentos-${hoje()}.xlsx`, 'Lançamentos financeiros',
    ['Data','Tipo','Atividade','Categoria','Classificação','Descrição','Fornecedor/cliente','Valor','Pago/recebido','Em aberto','Vencimento','Situação','Forma','Conta','Local'],
    L.map(l => [D(l.data), l.tipo, ATIVIDADES[l.atividade], l.categoria, CLASSIF[l.classificacao]||'', l.descricao, l.contraparte, round2(l.valor), pagoDe(l), restante(l), D(l.vencimento), statusL(l), l.forma, (byId('contas',l.contaId)||{}).nome||'', l.local||''])); },
  expGerais: () => { const [ini, fim] = periodo('dg'); const L = A('lancamentos').filter(l => l.tipo==='despesa' && l.atividade==='geral' && inRange(l.data, ini, fim));
    exportarXLSX(`estancia78-despesas-gerais-${hoje()}.xlsx`, 'Despesas gerais', ['Data','Grupo','Item','Classificação','Descrição','Local','Fornecedor','Valor','Situação'],
      L.map(l => [D(l.data), (GRUPOS_GERAIS[l.grupo]||{}).nome||'', l.categoria, CLASSIF[l.classificacao]||'', l.descricao, l.local, l.contraparte, round2(l.valor), statusL(l)])); },
  expAnimais: d => { const L = A('animais').filter(a => a.especie === d.esp);
    exportarXLSX(`estancia78-${d.esp}s-${hoje()}.xlsx`, ESPECIES[d.esp].nome, ['Identificação','Nome','Raça','Sexo','Nascimento','Categoria','Peso inicial','Peso atual','Data peso','Local','Origem','Entrada','Valor aquisição','Situação','Mãe','Pai','Obs.'],
      L.map(a => [a.ident, a.nome, a.raca, a.sexo, D(a.nascimento), a.categoria, a.pesoInicial, a.pesoAtual, D(a.dataPeso), a.local, MOV_NOMES[a.origem]||a.origem, D(a.dataEntrada), a.valorAquisicao, a.situacao, a.mae, a.pai, a.obs])); },
  expMovs: d => { const [ini, fim] = periodo('mv'); const M = movsValidas().filter(m => m.especie === d.esp && inRange(m.data, ini, fim));
    exportarXLSX(`estancia78-movimentacoes-${d.esp}-${hoje()}.xlsx`, 'Movimentações '+ESPECIES[d.esp].nome, ['Data','Movimentação','Animal/lote','Quantidade','Variação no saldo','Valor','Detalhes'],
      M.map(m => [D(m.data), MOV_NOMES[m.tipo]||m.tipo, alvoMov(m).replace(/<[^>]+>/g,''), m.qtd, m.delta||'', m.valor||'', descMov(m).replace(/<[^>]+>/g,'')])); },
  expVendas: d => { const [ini, fim] = periodo('vd'); const V = movsValidas().filter(m => m.especie === d.esp && m.tipo === 'venda' && inRange(m.data, ini, fim));
    exportarXLSX(`estancia78-vendas-${d.esp}-${hoje()}.xlsx`, 'Vendas '+ESPECIES[d.esp].nome, ['Data','Produto','Origem','Modalidade','Quantidade','Idade','Peso médio','Peso total','R$/cabeça','R$/kg','Total','Custo','Lucro','Comprador','Recebimento'],
      V.map(m => { const v = m.venda||{}, l = byId('lancamentos', m.lancamentoId); return [D(m.data), v.produto, alvoMov(m).replace(/<[^>]+>/g,''), v.modo, m.qtd, v.idade, v.pesoMedio, v.pesoTotal, v.valorCabeca, v.valorKg, m.valor, v.custo, v.lucro, m.contraparte, l?statusL(l):'']; })); }
};

/* ---------- Eventos globais ---------- */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const fn = ACTIONS[a.dataset.act]; if (!fn) return;
  e.preventDefault();
  try { const r = fn(a.dataset, a, e); if (r && r.catch) r.catch(falha); } catch(err){ falha(err); }
});
function onFilter(e){
  const el = e.target; if (!el.dataset || !el.dataset.filter) return;
  if (e.type === 'input' && el.tagName === 'SELECT') return;
  S.ui[el.dataset.filter] = el.value;
  if (el.tagName === 'INPUT' && el.type !== 'date' && e.type === 'input') { clearTimeout(onFilter.t); onFilter.t = setTimeout(render, 200); } else render();
}
document.addEventListener('input', onFilter);
document.addEventListener('change', async e => {
  if (e.target.id !== 'inBackup' || !e.target.files[0]) return;
  try { await importarBackup(await e.target.files[0].text()); } catch(err){ falha(err); }
  e.target.value = '';
});
async function importarBackup(txt){
  exigeEscrita();
  let b; try { b = JSON.parse(txt); } catch(e){ throw new Error('Arquivo inválido: não é um backup da Estância 78.'); }
  if (!b || !Array.isArray(b.lancamentos)) throw new Error('Arquivo inválido: não é um backup da Estância 78.');
  const linhas = [];
  for (const c of COLS) for (const d of (b[c]||[])) { const { id, ...data } = d; if (id) linhas.push({ colecao:c, id, data }); }
  const existentes = COLS.reduce((n,c) => n + (S.data[c]||[]).length, 0);
  if (!(await confirmar(`Importar <b>${linhas.length}</b> registro(s) do backup de ${D((b.geradoEm||'').slice(0,10))}?` + (existentes ? `<br><br>Já existem ${existentes} registros neste banco. Registros com o mesmo código serão substituídos; os demais são mantidos.` : ''), 'Importar', false))) return;
  if (S.db.importar) await S.db.importar(linhas);
  else for (const r of linhas) await S.db.collection(r.colecao).doc(r.id).set(r.data);
  if (b.config) await salvarCfg(b.config);
  await audit('importar backup', 'todas', '-', linhas.length + ' registros');
  toast(`${linhas.length} registros importados.`);
}
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.filter && (e.target.tagName === 'SELECT' || e.target.type === 'date')) onFilter(e); });
function route(){
  const h = (location.hash || '').replace('#','');
  S.page = PAGES[h] ? h : 'dashboard';
  $('#side').classList.remove('open'); $('#scrim').classList.remove('on');
  window.scrollTo(0,0); render();
}
window.addEventListener('hashchange', route);
$('#btnSair').addEventListener('click', async () => { if (S.sb && await confirmar('Sair do sistema neste aparelho?', 'Sair', false)) { await S.sb.auth.signOut(); location.reload(); } });
$('#burger').addEventListener('click', () => { $('#side').classList.add('open'); $('#scrim').classList.add('on'); });
$('#scrim').addEventListener('click', () => { $('#side').classList.remove('open'); $('#scrim').classList.remove('on'); });

