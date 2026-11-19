/* =====================================================================
   ETAPA 3 · Custos · Patrimônio · Relatórios (PDF/Excel) · DRE gerencial
   ===================================================================== */

/* ---------------- CUSTOS ---------------- */
const GRP_CUSTO = { alimentacao:['Ração','Milho','Alimentação','Suplementos'], sal:['Sal mineral'], sanidade:['Medicamentos','Vacinas','Vermífugos'], maoObra:['Mão de obra'] };
const GRP_NOME = { alimentacao:'Alimentação (ração, milho, suplementos)', sal:'Sal mineral', sanidade:'Medicamentos, vacinas e vermífugos', maoObra:'Mão de obra', outros:'Outros custos operacionais' };
const CAT_REPRODUTOR = ['Matriz','Leitoa','Cachaço / reprodutor'];
function grupoCusto(cat){ for (const [g, L] of Object.entries(GRP_CUSTO)) if (L.includes(cat)) return g; return 'outros'; }
function primeiraData(){
  const ds = [...A('animais').map(a=>a.dataEntrada), ...A('lotes').map(l=>l.dataEntrada), ...A('lancamentos').map(l=>l.data)].filter(Boolean).sort();
  return ds[0] || hoje();
}
function periodoReal(ini, fim){ const hj = hoje(); return [ini || primeiraData(), (!fim || fim > hj) ? hj : fim]; }
function diasInter(aIni, aFim, ini, fim){ const s = aIni > ini ? aIni : ini, e = aFim < fim ? aFim : fim; return e >= s ? diasEntre(s, e) + 1 : 0; }
const cabDiasInd = (a, ini, fim) => diasInter(a.dataEntrada || ini, a.dataSaida || hoje(), ini, fim);
function cabDiasLote(l, ini, fim){
  const ev = [];
  for (const m of movsValidas()) { if (m.loteId === l.id && +m.delta) ev.push([m.data, +m.delta]); if (m.paraLoteId === l.id) ev.push([m.data, +m.qtdTransf||0]); }
  ev.sort((a,b) => a[0].localeCompare(b[0]));
  let saldo = 0, tot = 0, cur = ini;
  for (const [d, delta] of ev) {
    if (d < ini) { saldo += delta; continue; }
    if (d > fim) break;
    tot += saldo * diasEntre(cur, d); cur = d; saldo += delta;
  }
  if (fim >= cur) tot += saldo * (diasEntre(cur, fim) + 1);
  return Math.max(0, tot);
}
function aquisicaoLote(l){ return sum(movsValidas().filter(m => m.loteId === l.id && m.tipo === 'compra'), m => m.valor); }
function custosEspecie(esp, ini0, fim0){
  const [ini, fim] = periodoReal(ini0, fim0);
  const atv = ESPECIES[esp].atividade, dias = Math.max(1, diasEntre(ini, fim) + 1);
  const L = A('lancamentos').filter(l => l.tipo === 'despesa' && l.atividade === atv && l.classificacao === 'operacional' && inRange(l.data, ini, fim));
  const grupos = { alimentacao:0, sal:0, sanidade:0, maoObra:0, outros:0 };
  for (const l of L) grupos[grupoCusto(l.categoria)] += +l.valor||0;
  const pool = sum(Object.values(grupos), v => v);
  const direto = {};
  for (const m of A('estoqueMovs')) if (m.tipo === 'saida' && m.alvo && /^[AL]:/.test(m.alvo) && inRange(m.data, ini, fim)) {
    const alvoEsp = m.alvo[0] === 'A' ? (byId('animais', m.alvo.slice(2))||{}).especie : (byId('lotes', m.alvo.slice(2))||{}).especie;
    if (alvoEsp === esp) direto[m.alvo] = (direto[m.alvo]||0) + (+m.custo||0);
  }
  const totDireto = sum(Object.values(direto), v => v);
  const indireto = Math.max(0, pool - totDireto);
  const itens = [];
  for (const a of A('animais').filter(a => a.especie === esp)) { const cd = cabDiasInd(a, ini, fim); if (cd > 0) itens.push({ k:'A:'+a.id, tipo:'A', obj:a, cd, aquis:+a.valorAquisicao||0 }); }
  for (const l of A('lotes').filter(l => l.especie === esp)) { const cd = cabDiasLote(l, ini, fim); if (cd > 0) itens.push({ k:'L:'+l.id, tipo:'L', obj:l, cd, aquis:aquisicaoLote(l) }); }
  const totCD = sum(itens, i => i.cd);
  for (const i of itens) { i.direto = direto[i.k]||0; i.rateio = totCD ? indireto * i.cd / totCD : 0; i.periodo = i.direto + i.rateio; i.cabMedia = i.cd / dias; }
  return { esp, ini, fim, dias, grupos, pool, totDireto, indireto, itens, totCD, cabMedia: totCD / dias, diario: totCD ? pool / totCD : 0 };
}
function kgGanhos(esp, ini, fim){ return sum(movsValidas().filter(m => m.especie === esp && m.tipo === 'pesagem' && inRange(m.data, ini, fim) && m.pesoAnterior), m => Math.max(0, (+m.peso||0) - (+m.pesoAnterior||0))); }
function kgVendidos(esp, ini, fim){ return sum(movsValidas().filter(m => m.especie === esp && m.tipo === 'venda' && inRange(m.data, ini, fim)), m => m.peso); }
function indicadoresSuinos(c){
  const { ini, fim } = c;
  const repr = c.itens.filter(i => CAT_REPRODUTOR.includes(i.obj.categoria));
  const custoMatr = sum(repr, i => i.periodo), cabMatr = sum(repr, i => i.cd) / c.dias;
  const partos = A('reproducoes').filter(r => r.especie === 'suino' && r.parto && inRange(r.parto.data, ini, fim));
  let nascidos = sum(partos, r => r.parto.vivos);
  if (!nascidos) nascidos = sum(movsValidas().filter(m => m.especie === 'suino' && m.tipo === 'nascimento' && inRange(m.data, ini, fim)), m => m.qtd);
  const desmReg = A('reproducoes').filter(r => r.especie === 'suino' && r.desmame && inRange(r.desmame.data, ini, fim));
  let desmamados = sum(desmReg, r => r.desmame.qtd);
  if (!desmamados) desmamados = sum(movsValidas().filter(m => m.especie === 'suino' && m.tipo === 'desmame' && inRange(m.data, ini, fim)), m => m.qtd);
  const leitegadas = c.itens.filter(i => i.tipo === 'L' && (i.obj.reproducaoId || i.obj.matriz) && !CAT_REPRODUTOR.includes(i.obj.categoria));
  const custoLact = sum(leitegadas, i => { const fimL = i.obj.dataDesmame && i.obj.dataDesmame < fim ? i.obj.dataDesmame : fim; const cd = cabDiasLote(i.obj, ini, fimL); return i.cd ? i.periodo * cd / i.cd : 0; });
  const vendidosLotes = c.itens.filter(i => i.tipo === 'L' && movsValidas().some(m => m.loteId === i.obj.id && m.tipo === 'venda' && inRange(m.data, ini, fim)));
  const terminados = vendidosLotes.map(i => { const v = custosEspecie('suino', i.obj.dataEntrada, fim).itens.find(x => x.k === i.k); const ent = sum(movsValidas().filter(m => m.loteId === i.obj.id && +m.delta > 0), m => m.delta) || 1; return v ? (v.periodo + v.aquis) / ent : 0; });
  return { custoMatr, cabMatr, custoPorMatriz: cabMatr ? custoMatr / cabMatr : 0, nascidos, desmamados, custoNascido: nascidos ? custoMatr / nascidos : 0,
    custoDesmamado: desmamados ? (custoMatr + custoLact) / desmamados : 0, custoTerminado: terminados.length ? sum(terminados, x => x) / terminados.length : 0,
    kgVend: kgVendidos('suino', ini, fim), diarioMatriz: sum(repr, i => i.cd) ? custoMatr / sum(repr, i => i.cd) : c.diario };
}
function custoLeitegadas(diarioMatriz){
  return A('reproducoes').filter(r => r.especie === 'suino' && r.parto && r.parto.loteId).map(r => {
    const l = byId('lotes', r.parto.loteId); if (!l) return null;
    const fimL = l.dataDesmame || hoje(); const c = custosEspecie('suino', r.parto.data, fimL); const it = c.itens.find(i => i.k === 'L:'+l.id);
    const gest = diarioMatriz * GESTACAO.suino; const custo = (it ? it.periodo : 0) + gest;
    return { r, l, custo, gest, lact: it ? it.periodo : 0, vivos:r.parto.vivos, desm: r.desmame ? r.desmame.qtd : (l.qtdDesmamada||0) };
  }).filter(Boolean).sort((a,b) => b.r.parto.data.localeCompare(a.r.parto.data));
}
function tabelaItensCusto(c, esp){
  if (!c.itens.length) return `<div class="tw">${vazio('Sem animais no período')}</div>`;
  const it = [...c.itens].sort((a,b) => b.periodo - a.periodo);
  return `<div class="tw"><table><thead><tr><th>${esp==='bovino'?'Animal':'Animal / lote'}</th><th>Categoria</th><th class="n">Cab. médias</th><th class="n">Aquisição</th><th class="n">Custo direto</th><th class="n">Rateio</th><th class="n">Custo no período</th><th class="n">Custo/cab. período</th><th class="n">Custo total/cab.</th></tr></thead><tbody>
    ${it.map(i => { const cab = i.tipo === 'A' ? 1 : Math.max(i.cabMedia, 0.0001); const ent = i.tipo === 'L' ? (sum(movsValidas().filter(m => m.loteId === i.obj.id && +m.delta > 0), m => m.delta) || 1) : 1;
      return `<tr><td><b>${i.tipo==='A'?esc(nomeAnimal(i.obj)):'Lote '+esc(i.obj.codigo)}</b>${i.obj.situacao&&i.obj.situacao!=='ativo'&&i.tipo==='A'?` <span class="small muted">${esc(i.obj.situacao)}</span>`:''}</td><td>${esc(i.obj.categoria)}</td><td class="n">${N(i.cabMedia,1)}</td>
      <td class="n">${R(i.aquis)}</td><td class="n">${R(i.direto)}</td><td class="n">${R(i.rateio)}</td><td class="n"><b>${R(i.periodo)}</b></td><td class="n">${R(i.periodo/cab)}</td><td class="n">${R(i.aquis/ent + i.periodo/cab)}</td></tr>`; }).join('')}
    </tbody><tfoot><tr><td colspan="3">Total</td><td class="n">${R(sum(it,i=>i.aquis))}</td><td class="n">${R(sum(it,i=>i.direto))}</td><td class="n">${R(sum(it,i=>i.rateio))}</td><td class="n">${R(sum(it,i=>i.periodo))}</td><td colspan="2"></td></tr></tfoot></table></div>`;
}
function blocoGrupos(c){
  return `<div class="tw"><table><thead><tr><th>Composição do custo operacional</th><th class="n">Valor</th><th class="n">%</th><th class="n">Por cabeça/mês</th></tr></thead><tbody>
    ${Object.entries(c.grupos).map(([g,v]) => `<tr><td>${GRP_NOME[g]}</td><td class="n">${R(v)}</td><td class="n">${c.pool?N(v/c.pool*100,1)+'%':'—'}</td><td class="n">${c.totCD?R(v/c.totCD*30.44):'—'}</td></tr>`).join('')}
    </tbody><tfoot><tr><td>Total</td><td class="n">${R(c.pool)}</td><td class="n">100%</td><td class="n">${c.totCD?R(c.pool/c.totCD*30.44):'—'}</td></tr></tfoot></table></div>`;
}
function pgCustos(){
  if (!('csIni' in S.ui)) { S.ui.csIni = hoje().slice(0,4)+'-01-01'; S.ui.csFim = mesFim(); }
  const esp = uiGet('csEsp','bovino'); const [ini, fim] = periodo('cs');
  const c = custosEspecie(esp, ini, fim);
  let kpis = '', extra = '';
  if (esp === 'bovino') {
    const kg = kgGanhos('bovino', c.ini, c.fim);
    kpis = kpi('Custo operacional', R(c.pool), `${N(c.dias)} dias`, 'red') + kpi('Custo médio por cabeça', c.cabMedia ? R(c.pool/c.cabMedia) : '—', `${N(c.cabMedia,1)} cab. médias no período`, 'gold')
      + kpi('Custo diário por cabeça', R(c.diario), 'mensal ' + R(c.diario*30.44)) + kpi('Kg produzidos', N(kg,1)+' kg', 'ganho nas pesagens', 'green') + kpi('Custo por kg produzido', kg ? R(c.pool/kg) : '—', kg ? '' : 'registre pesagens', 'blue');
    const porLocal = {}; for (const i of c.itens) { const k = i.obj.local || 'Sem lote/pasto'; porLocal[k] = porLocal[k] || { cab:0, custo:0, aquis:0 }; porLocal[k].cab += i.cabMedia; porLocal[k].custo += i.periodo; porLocal[k].aquis += i.aquis; }
    extra = `<div class="section-t">Custo por lote / pastagem</div><div class="tw"><table><thead><tr><th>Lote / pastagem</th><th class="n">Cab. médias</th><th class="n">Aquisição</th><th class="n">Custo no período</th><th class="n">Custo por cabeça</th></tr></thead><tbody>
      ${Object.entries(porLocal).map(([k,v]) => `<tr><td>${esc(k)}</td><td class="n">${N(v.cab,1)}</td><td class="n">${R(v.aquis)}</td><td class="n">${R(v.custo)}</td><td class="n">${v.cab?R(v.custo/v.cab):'—'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">—</td></tr>'}</tbody></table></div>`;
  } else if (esp === 'suino') {
    const s = indicadoresSuinos(c); const lg = custoLeitegadas(s.diarioMatriz);
    kpis = kpi('Custo operacional', R(c.pool), `${N(c.dias)} dias`, 'red') + kpi('Custo por matriz', s.cabMatr ? R(s.custoPorMatriz) : '—', `${N(s.cabMatr,1)} matriz(es)/reprodutor(es) médias`, 'gold')
      + kpi('Custo por leitão nascido', s.nascidos ? R(s.custoNascido) : '—', `${N(s.nascidos)} nascidos vivos`, 'green') + kpi('Custo por leitão desmamado', s.desmamados ? R(s.custoDesmamado) : '—', `${N(s.desmamados)} desmamados`, 'blue')
      + kpi('Custo por suíno terminado', s.custoTerminado ? R(s.custoTerminado) : '—', 'lotes vendidos no período') + kpi('Custo por kg produzido', s.kgVend ? R(c.pool/s.kgVend) : '—', `${N(s.kgVend,1)} kg vendidos`) + kpi('Custo diário por cabeça', R(c.diario), `${N(c.cabMedia,1)} cab. médias`);
    extra = `<div class="section-t">Custo por leitegada</div>${lg.length ? `<div class="tw"><table><thead><tr><th>Matriz</th><th>Parto</th><th>Lote</th><th class="n">Vivos</th><th class="n">Desmamados</th><th class="n">Gestação (matriz)</th><th class="n">Lactação</th><th class="n">Custo da leitegada</th><th class="n">Por leitão nascido</th><th class="n">Por desmamado</th></tr></thead><tbody>
      ${lg.map(x => `<tr><td>${esc(x.r.matrizNome)}</td><td>${D(x.r.parto.data)}</td><td>${esc(x.l.codigo)}</td><td class="n">${N(x.vivos)}</td><td class="n">${x.desm?N(x.desm):'—'}</td><td class="n">${R(x.gest)}</td><td class="n">${R(x.lact)}</td><td class="n"><b>${R(x.custo)}</b></td><td class="n">${x.vivos?R(x.custo/x.vivos):'—'}</td><td class="n">${x.desm?R(x.custo/x.desm):'—'}</td></tr>`).join('')}</tbody></table></div>` : `<div class="tw">${vazio('Nenhuma leitegada registrada', 'Registre coberturas e partos em Reprodução para calcular o custo por leitegada.')}</div>`}`;
  } else {
    const prod = sum(A('ovos').filter(o => inRange(o.data, c.ini, c.fim)), o => o.produzidos);
    kpis = kpi('Custo operacional', R(c.pool), `${N(c.dias)} dias`, 'red') + kpi('Custo por ave', c.cabMedia ? R(c.pool/c.cabMedia) : '—', `${N(c.cabMedia,0)} aves médias`, 'gold')
      + kpi('Custo de alimentação', R(c.grupos.alimentacao + c.grupos.sal), c.cabMedia ? R((c.grupos.alimentacao+c.grupos.sal)/c.cabMedia)+'/ave' : '', 'green') + kpi('Custo de medicamentos', R(c.grupos.sanidade), c.cabMedia ? R(c.grupos.sanidade/c.cabMedia)+'/ave' : '', 'blue')
      + kpi('Custo por dúzia de ovos', prod ? R(c.pool/(prod/12)) : '—', `${N(prod/12,1)} dúzias produzidas`);
  }
  return `<div class="bar"><div class="chips" style="align-self:center">${Object.entries(ESPECIES).map(([k,v]) => `<button class="chip ${esp===k?'on':''}" data-act="setf" data-k="csEsp" data-v="${k}">${v.nome}</button>`).join('')}</div>${filtroPeriodo('cs')}</div>
    <div class="grid g5" style="margin-bottom:14px">${kpis}</div>
    <div class="grid g2"><div>${blocoGrupos(c)}</div><div class="card"><h3>Como o custo é calculado</h3><p class="small" style="margin:0;line-height:1.6;color:var(--tx2)">
      Base: despesas <b>operacionais</b> lançadas no Financeiro para ${esc(ESPECIES[esp].nome)} no período (compras de animais e investimentos ficam fora, sem duplicidade).
      Insumos baixados do Estoque direto para um lote ou animal viram <b>custo direto</b> dele. O restante é <b>rateado</b> pelos dias que cada cabeça ficou na propriedade (cabeça-dia).
      Custo total por cabeça = aquisição + custo do período.</p></div></div>
    <div class="section-t">Custo por ${esp==='bovino'?'animal':'animal e lote'}</div>${tabelaItensCusto(c, esp)}${extra}`;
}

/* ---------------- PATRIMÔNIO ---------------- */
const TIPOS_BEM = ['Terreno','Casa','Cercas','Galpões','Currais','Chiqueiros','Galinheiros','Equipamentos','Máquinas','Veículos','Instalações','Outros'];
const investidoBem = b => round2((+b.valorBase||0) + sum(b.melhorias||[], m => m.valor));
const valorAtualBem = b => (b.valorAtual != null && b.valorAtual !== '') ? +b.valorAtual : investidoBem(b);
function valorCabeca(esp, cat){ const vc = ((S.cfg.valorCategoria||{})[esp]||{})[cat]; return (vc != null && vc !== '') ? +vc : (+(S.cfg.valorEstimado||{})[esp]||0); }
function valorRebanho(){
  const por = { bovino:0, suino:0, galinha:0 }, linhas = [];
  for (const esp of Object.keys(ESPECIES)) {
    const porCat = {};
    for (const a of indAtivos(esp)) porCat[a.categoria] = (porCat[a.categoria]||0) + 1;
    for (const l of lotesAtivos(esp)) { const s = Math.max(0, saldoLote(l.id)); if (s) porCat[l.categoria] = (porCat[l.categoria]||0) + s; }
    for (const [cat, q] of Object.entries(porCat)) { const v = valorCabeca(esp, cat); por[esp] += q*v; linhas.push({ esp, cat, q, v, total:q*v }); }
  }
  return { por, linhas, total: por.bovino + por.suino + por.galinha };
}
const ehCompraAnimal = l => Object.values(COMPRA_CAT).includes(l.categoria);
const investNaoVinculados = () => A('lancamentos').filter(l => l.tipo === 'despesa' && CLASSIF_INV.includes(l.classificacao) && !ehCompraAnimal(l) && !l.bemId);
function patrimonioResumo(){
  const saldo = saldoTotal(), ar = sum(abertos('receita'), restante), ap = sum(abertos('despesa'), restante);
  const bens = A('patrimonio').filter(b => b.situacao !== 'Baixado');
  const vBens = sum(bens, valorAtualBem), invNV = sum(investNaoVinculados(), l => l.valor);
  const reb = valorRebanho();
  const investAcum = sum(A('patrimonio'), b => (+b.valorBase||0) + sum((b.melhorias||[]).filter(m => !m.lancamentoId), m => m.valor))
    + sum(A('lancamentos').filter(l => l.tipo === 'despesa' && CLASSIF_INV.includes(l.classificacao)), l => l.valor);
  return { saldo, ar, ap, vBens, invNV, reb, investAcum, estruturas: vBens + invNV, total: round2(saldo + ar - ap + vBens + invNV + reb.total) };
}
function abrirBem(edit = null){
  const b = edit || {};
  modal({ title: edit ? 'Editar bem patrimonial' : 'Novo bem patrimonial', submit: edit ? 'Salvar' : 'Cadastrar',
    html:`<div class="fg">${fSel('tipo','Tipo', TIPOS_BEM, b.tipo||'Equipamentos')}${fInp('descricao','Descrição *', b.descricao||'', 'placeholder="Ex.: Trator Massey 265, Galpão de ração"')}
      ${fDate('dataAquisicao','Data de aquisição / construção', b.dataAquisicao||'')}${fNum('valorBase','Valor investido inicial (R$)', b.valorBase||'')}
      ${fNum('valorAtual','Valor atual estimado (R$)', b.valorAtual||'')}${fInp('localizacao','Localização', b.localizacao||'')}
      ${fSel('situacao','Situação', ['Em uso','Em reforma','Parado','Baixado'], b.situacao||'Em uso')}${fTxt('obs','Observações', b.obs||'')}</div>
      <p class="small muted">Se o valor investido já foi lançado no Financeiro como investimento, deixe o valor inicial em branco e use “Vincular investimento” — assim ele não é contado duas vezes.</p>`,
    async onSubmit(fd){ exigeEscrita();
      const d = { tipo:fd.tipo, descricao:reqTxt(fd.descricao,'a descrição'), dataAquisicao:fd.dataAquisicao||'', valorBase:num(fd.valorBase)||0, valorAtual: fd.valorAtual === '' ? null : num(fd.valorAtual), localizacao:(fd.localizacao||'').trim(), situacao:fd.situacao, obs:(fd.obs||'').trim() };
      if (edit) { await dbUpd('patrimonio', edit.id, d); toast('Bem atualizado.'); }
      else { const id = novoId('patrimonio'); await dbSet('patrimonio', id, { ...d, melhorias:[] }); await audit('criar','patrimonio',id,d.descricao); toast('Bem cadastrado.'); } } });
}
function abrirMelhoria(b){
  const nv = investNaoVinculados().sort((x,y)=>(y.data||'').localeCompare(x.data||''));
  modal({ title:`Melhoria / investimento · ${b.descricao}`, submit:'Adicionar',
    html:`<div class="fg"><label class="fld full"><span>Vincular investimento já lançado no Financeiro</span><select name="lancId">${opts(nv.map(l => [l.id, `${D(l.data)} · ${l.categoria} · ${l.descricao} · ${R(l.valor)}`]), '', nv.length ? 'Não vincular (informar manualmente abaixo)' : 'Nenhum investimento sem vínculo')}</select></label>
      ${fDate('data','Data')}${fNum('valor','Valor (R$) — se não vinculado','')}${fInp('descricao','Descrição','', 'full')}</div>`,
    async onSubmit(fd){ exigeEscrita(); let m;
      if (fd.lancId) { const l = byId('lancamentos', fd.lancId); m = { id:uid(), data:l.data, valor:+l.valor, descricao:l.descricao||l.categoria, lancamentoId:l.id }; await dbUpd('lancamentos', l.id, { bemId:b.id }); }
      else m = { id:uid(), data:reqData(fd.data), valor:reqPos(fd.valor,'o valor'), descricao:reqTxt(fd.descricao,'a descrição'), lancamentoId:null };
      await dbUpd('patrimonio', b.id, { melhorias:[ ...(b.melhorias||[]), m ] }); await audit('melhoria','patrimonio',b.id,R(m.valor)); toast('Melhoria registrada.'); } });
}
function abrirFichaBem(id){
  const b = byId('patrimonio', id); if (!b) return;
  modal({ title:`${b.tipo} · ${b.descricao}`, wide:true,
    html:`<div class="dl"><div><span>Situação</span><b>${esc(b.situacao)}</b></div><div><span>Aquisição</span><b>${D(b.dataAquisicao)||'—'}</b></div><div><span>Localização</span><b>${esc(b.localizacao||'—')}</b></div>
      <div><span>Valor inicial</span><b>${R(b.valorBase)}</b></div><div><span>Total investido</span><b>${R(investidoBem(b))}</b></div><div><span>Valor atual estimado</span><b>${R(valorAtualBem(b))}</b></div></div>
      <div class="btnrow"><button type="button" class="btn ghost sm" data-act="editBem" data-id="${id}">Editar</button><button type="button" class="btn primary sm" data-act="melhoriaBem" data-id="${id}">+ Melhoria / vincular investimento</button></div>
      <h4 style="font-size:16px;color:var(--verde);margin:6px 0 8px">Histórico de melhorias</h4>
      ${(b.melhorias||[]).length ? `<div class="tw"><table><thead><tr><th>Data</th><th>Descrição</th><th>Origem</th><th class="n">Valor</th><th></th></tr></thead><tbody>${[...b.melhorias].sort((x,y)=>(y.data||'').localeCompare(x.data||'')).map(m => `<tr><td>${D(m.data)}</td><td>${esc(m.descricao)}</td><td>${m.lancamentoId?'Lançamento financeiro':'Manual'}</td><td class="n">${R(m.valor)}</td><td><button type="button" class="ico" data-act="delMelhoria" data-id="${id}" data-m="${m.id}">✕</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="tw">${vazio('Nenhuma melhoria registrada')}</div>`}` });
}
async function removerMelhoria(bemId, mId){
  const b = byId('patrimonio', bemId); const m = (b.melhorias||[]).find(x => x.id === mId); if (!m) return;
  if (!(await confirmar(`Remover a melhoria “${esc(m.descricao)}” (${R(m.valor)})?${m.lancamentoId?' O lançamento financeiro continua existindo e volta para a lista de investimentos sem vínculo.':''}`, 'Remover'))) return;
  try { exigeEscrita(); await dbUpd('patrimonio', bemId, { melhorias:(b.melhorias||[]).filter(x => x.id !== mId) });
    if (m.lancamentoId && byId('lancamentos', m.lancamentoId)) await dbUpd('lancamentos', m.lancamentoId, { bemId:null });
    toast('Melhoria removida.'); $$('#modal-root .mback').forEach(x=>x.remove()); } catch(e){ falha(e); }
}
async function registrarSnapshot(){
  if (!S.db || !S.podeEscrever || S.snapFeito) return; S.snapFeito = true;
  try { const p = patrimonioResumo(), mes = hoje().slice(0,7), atual = byId('snapshots', mes);
    if (atual && Math.abs((+atual.total||0) - p.total) <= Math.max(1, Math.abs(p.total)*0.005)) return;
    const body = { mes, total:p.total, rebanho:round2(p.reb.total), estruturas:round2(p.estruturas), saldo:round2(p.saldo), quando:stamp() };
    if (atual) await dbUpd('snapshots', mes, body); else await dbSet('snapshots', mes, body);
  } catch(e){ console.warn('snapshot', e); }
}
function serieEvolucao(){
  const snaps = A('snapshots').filter(s => s.mes).sort((a,b) => a.mes.localeCompare(b.mes));
  const mes = hoje().slice(0,7), p = patrimonioResumo();
  const pts = snaps.filter(s => s.mes !== mes).map(s => [s.mes, s.total]); pts.push([mes, p.total]);
  return pts.slice(-24);
}
function pgPatrimonio(){
  const t = uiGet('ptTab','bens'); const p = patrimonioResumo();
  let body = '';
  if (t === 'bens') {
    const B = A('patrimonio').sort((a,b)=>a.tipo.localeCompare(b.tipo)||a.descricao.localeCompare(b.descricao));
    body = `<div class="bar"><button class="btn primary" data-act="novoBem">+ Novo bem</button></div>
      ${B.length ? `<div class="tw"><table><thead><tr><th>Tipo</th><th>Descrição</th><th>Aquisição</th><th>Localização</th><th>Situação</th><th class="n">Investido</th><th class="n">Valor atual</th><th class="n">Melhorias</th><th></th></tr></thead><tbody>
      ${B.map(b => `<tr><td>${esc(b.tipo)}</td><td><b>${esc(b.descricao)}</b></td><td>${D(b.dataAquisicao)}</td><td>${esc(b.localizacao||'')}</td><td>${esc(b.situacao)}</td><td class="n">${R(investidoBem(b))}</td><td class="n"><b>${R(valorAtualBem(b))}</b></td><td class="n">${(b.melhorias||[]).length}</td>
        <td><div class="acts"><button class="ico" data-act="fichaBem" data-id="${b.id}">Abrir</button></div></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="5">${B.length} bem(ns)</td><td class="n">${R(sum(B,investidoBem))}</td><td class="n">${R(sum(B.filter(b=>b.situacao!=='Baixado'),valorAtualBem))}</td><td colspan="2"></td></tr></tfoot></table></div>`
      : `<div class="tw">${vazio('Nenhum bem cadastrado', 'Cadastre terreno, casa, cercas, galpões, currais, chiqueiros, galinheiros, máquinas, equipamentos e veículos.')}</div>`}`;
  } else if (t === 'rebanho') {
    body = `<div class="note" style="margin-bottom:12px">Informe o valor de mercado por categoria. Em branco, vale o valor padrão da espécie (Configurações).</div>
      <form id="fVC"><div class="tw"><table><thead><tr><th>Espécie</th><th>Categoria</th><th class="n">Cabeças</th><th class="n">Valor por cabeça (R$)</th><th class="n">Total</th></tr></thead><tbody>
      ${Object.keys(ESPECIES).flatMap(esp => catsAnimal(esp).map(cat => { const l = p.reb.linhas.find(x => x.esp === esp && x.cat === cat); const vc = ((S.cfg.valorCategoria||{})[esp]||{})[cat];
        return `<tr><td>${ESPECIES[esp].nome}</td><td>${esc(cat)}</td><td class="n">${l?N(l.q):'0'}</td><td class="n"><input name="${esp}|${esc(cat)}" value="${vc!=null&&vc!==''?numStr(vc):''}" placeholder="${numStr(S.cfg.valorEstimado[esp])}" inputmode="decimal" style="width:120px;text-align:right;border:1px solid var(--cinza3);border-radius:6px;padding:5px 8px"></td><td class="n">${l?R(l.total):'—'}</td></tr>`; })).join('')}
      </tbody><tfoot><tr><td colspan="4">Valor estimado dos animais</td><td class="n">${R(p.reb.total)}</td></tr></tfoot></table></div></form>
      <div style="margin-top:10px"><button class="btn primary" data-act="salvarVC">Salvar valores</button></div>`;
  } else if (t === 'invest') {
    const nv = investNaoVinculados().sort((a,b)=>(b.data||'').localeCompare(a.data||''));
    body = `<p class="small muted">Investimentos lançados no Financeiro/Despesas Gerais que ainda não foram vinculados a um bem. Eles já entram no patrimônio; vincular só organiza o histórico de cada bem.</p>
      ${nv.length ? `<div class="tw"><table><thead><tr><th>Data</th><th>Grupo</th><th>Item</th><th>Descrição</th><th>Local</th><th class="n">Valor</th></tr></thead><tbody>${nv.map(l => `<tr><td>${D(l.data)}</td><td>${esc((GRUPOS_GERAIS[l.grupo]||{}).nome||ATIVIDADES[l.atividade]||'')}</td><td>${esc(l.categoria)}</td><td>${esc(l.descricao)}</td><td>${esc(l.local||'')}</td><td class="n">${R(l.valor)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="5">Total</td><td class="n">${R(sum(nv,l=>l.valor))}</td></tr></tfoot></table></div>` : `<div class="tw">${vazio('Todos os investimentos estão vinculados')}</div>`}`;
  } else {
    body = `<div class="card"><h3>Evolução patrimonial<span class="hint">um registro por mês, gravado automaticamente</span></h3><div class="chart-box"><canvas id="chEvo"></canvas></div></div>`;
  }
  return `<div class="grid g5" style="margin-bottom:14px">${kpi('Patrimônio total', R(p.total), 'saldo + a receber − a pagar + bens + animais', 'gold')}${kpi('Estruturas e equipamentos', R(p.estruturas), `bens ${R0(p.vBens)} · investimentos sem vínculo ${R0(p.invNV)}`, 'blue')}
      ${kpi('Valor estimado dos animais', R(p.reb.total), `bov. ${R0(p.reb.por.bovino)} · suí. ${R0(p.reb.por.suino)} · gal. ${R0(p.reb.por.galinha)}`, 'green')}${kpi('Investimentos acumulados', R(p.investAcum), 'estruturas + aquisição de animais')}${kpi('Saldo financeiro líquido', R(p.saldo + p.ar - p.ap), `disponível ${R0(p.saldo)}`)}</div>
    ${tabs('ptTab', [['bens','Bens'],['rebanho','Rebanho e plantéis'],['invest','Investimentos sem vínculo'],['evolucao','Evolução']], 'bens')}${body}`;
}
function afterPatrimonio(){
  if (uiGet('ptTab','bens') !== 'evolucao') return;
  const s = serieEvolucao();
  mkChart('chEvo', { type:'line', data:{ labels:s.map(x => mesLabel(x[0])), datasets:[{ label:'Patrimônio', data:s.map(x=>x[1]), borderColor:'#1f3d2b', backgroundColor:'#1f3d2b', borderWidth:2, pointRadius:4, tension:.25 }] }, options:chartOpts({ legend:false }) });
}

/* ---------------- DRE GERENCIAL ---------------- */
const CAT_LEITOES = ['Venda de leitões','Venda de leitões desmamados'];
const ehOutraRec = l => l.atividade === 'geral' || /esterco|Outras receitas/i.test(l.categoria);
const DESP_GERAL_MAP = [['Energia', l => l.categoria === 'Energia elétrica'], ['Água', l => l.categoria === 'Água'], ['Combustível geral', l => l.categoria === 'Combustível'],
  ['Manutenção da propriedade', l => l.classificacao === 'manutencao'], ['Administração', l => ['Impostos','Taxas','Documentação','Internet','Serviços terceirizados','Mão de obra geral'].includes(l.categoria)],
  ['Limpeza', l => ['Limpeza','Limpeza do terreno','Roçada','Jardinagem'].includes(l.categoria)], ['Outras despesas gerais', () => true]];
const INV_MAP = [['Cercas', l => l.grupo === 'cercas'], ['Casa', l => l.grupo === 'casa'], ['Galpões', l => l.categoria === 'Construção de galpões'],
  ['Construções e instalações', l => l.grupo === 'instalacoes' && !['Equipamentos','Máquinas','Ferramentas'].includes(l.categoria)], ['Equipamentos e máquinas', l => ['Equipamentos','Máquinas','Ferramentas','Móveis','Eletrodomésticos','Utensílios'].includes(l.categoria)],
  ['Aquisição de animais', ehCompraAnimal], ['Melhorias e outros', () => true]];
const OPER_MAP = [['Rações', l => l.categoria === 'Ração'], ['Milho', l => l.categoria === 'Milho'], ['Alimentação e suplementos', l => ['Alimentação','Suplementos'].includes(l.categoria)], ['Sal mineral', l => l.categoria === 'Sal mineral'],
  ['Medicamentos e vermífugos', l => ['Medicamentos','Vermífugos'].includes(l.categoria)], ['Vacinas', l => l.categoria === 'Vacinas'], ['Manejo, transporte e manutenção', l => ['Manutenção operacional','Transporte','Combustível'].includes(l.categoria)],
  ['Mão de obra', l => l.categoria === 'Mão de obra'], ['Outros custos operacionais', () => true]];
function classificar(map, L){ const out = Object.fromEntries(map.map(m => [m[0], 0])); for (const l of L) { const m = map.find(x => x[1](l)); out[m[0]] += +l.valor||0; } return out; }
function dreCalc(ini, fim, atv){
  const L = A('lancamentos').filter(l => inRange(l.data, ini, fim) && (!atv || l.atividade === atv));
  const Rc = L.filter(l => l.tipo === 'receita'), Dp = L.filter(l => l.tipo === 'despesa');
  const rec = {
    bov: sum(Rc.filter(l => l.atividade === 'bovinos' && !ehOutraRec(l)), l => l.valor),
    sui: sum(Rc.filter(l => l.atividade === 'suinos' && !ehOutraRec(l) && !CAT_LEITOES.includes(l.categoria) && l.categoria !== 'Venda de porcos inteiros'), l => l.valor),
    lei: sum(Rc.filter(l => CAT_LEITOES.includes(l.categoria)), l => l.valor), por: sum(Rc.filter(l => l.categoria === 'Venda de porcos inteiros'), l => l.valor),
    gal: sum(Rc.filter(l => l.atividade === 'galinhas' && l.categoria !== 'Venda de ovos' && !ehOutraRec(l)), l => l.valor), ovo: sum(Rc.filter(l => l.categoria === 'Venda de ovos'), l => l.valor),
    out: sum(Rc.filter(ehOutraRec), l => l.valor) };
  const recTot = sum(Rc, l => l.valor), cmv = sum(Rc, l => l.custoVendido);
  const oper = classificar(OPER_MAP, Dp.filter(l => l.classificacao === 'operacional')), operTot = sum(Object.values(oper), v => v);
  const resAtv = a => { const r = Rc.filter(l => l.atividade === a); return sum(r, l => l.valor) - sum(r, l => l.custoVendido) - sum(Dp.filter(l => l.atividade === a && l.classificacao === 'operacional'), l => l.valor); };
  const ger = classificar(DESP_GERAL_MAP, Dp.filter(l => ['geral','manutencao'].includes(l.classificacao))), gerTot = sum(Object.values(ger), v => v);
  const inv = classificar(INV_MAP, Dp.filter(l => CLASSIF_INV.includes(l.classificacao))), invTot = sum(Object.values(inv), v => v);
  const cx = caixa(ini, fim, l => !atv || l.atividade === atv);
  const resOp = recTot - cmv - operTot;
  const linhas = [
    ['h','Receita bruta'], ['l','Receita com bovinos', rec.bov], ['l','Receita com suínos', rec.sui], ['l','Receita com leitões', rec.lei], ['l','Receita com porcos inteiros', rec.por],
    ['l','Receita com galinhas', rec.gal], ['l','Receita com ovos', rec.ovo], ['l','Outras receitas', rec.out], ['t','Receita bruta total', recTot],
    ['l','(−) Custo dos animais vendidos', -cmv],
    ['h','Custos operacionais'], ...OPER_MAP.map(m => ['l', m[0], -oper[m[0]]]), ['t','Total dos custos operacionais', -operTot],
    ['h','Resultado operacional'], ['l','Resultado dos bovinos', resAtv('bovinos')], ['l','Resultado dos suínos', resAtv('suinos')], ['l','Resultado das galinhas', resAtv('galinhas')],
    ['r','Resultado operacional consolidado', resOp],
    ['h','Despesas gerais'], ...DESP_GERAL_MAP.map(m => ['l', m[0], -ger[m[0]]]), ['t','Total das despesas gerais', -gerTot],
    ['r','Resultado após despesas gerais', resOp - gerTot],
    ['h','Investimentos (fora do resultado)'], ...INV_MAP.map(m => ['l', m[0], inv[m[0]]]), ['t','Total investido no período', invTot],
    ['h','Caixa no período (comparação)'], ['l','Entradas efetivas', cx.ent], ['l','Saídas efetivas', -cx.sai], ['t','Variação de caixa', cx.liq]
  ];
  return linhas;
}
function dreRelatorio(f){
  const visao = f.visao || 'consolidada';
  let colDefs;
  if (visao === 'mensal') {
    const [i0, f0] = periodoReal(f.ini, f.fim); const meses = []; let m = i0.slice(0,7)+'-01';
    while (m <= f0 && meses.length < 24) { meses.push(m); m = addMeses(m, 1); }
    colDefs = meses.map(mm => [mesLabel(mm), mm < i0 ? i0 : mm, mesFim(mm) > f0 ? f0 : mesFim(mm), f.atv]);
  } else if (visao === 'atividade') colDefs = Object.entries(ATIVIDADES).map(([k,v]) => [v, f.ini, f.fim, k]);
  else colDefs = [];
  const base = dreCalc(f.ini, f.fim, f.atv);
  const cols = colDefs.map(c => dreCalc(c[1], c[2], c[3]));
  const recTot = (base.find(l => l[1] === 'Receita bruta total')||[])[2] || 0;
  const rows = [], cls = [];
  base.forEach((l, i) => {
    if (l[0] === 'h') { rows.push([l[1].toUpperCase(), ...cols.map(()=>''), '', ...(colDefs.length?[]:[''])]); cls.push('h'); return; }
    rows.push([l[1], ...cols.map(c => c[i][2]), l[2], ...(colDefs.length ? [] : [recTot ? round2(l[2]/recTot*100) : ''])]); cls.push(l[0] === 'l' ? 'l' : l[0]);
  });
  const head = [{ h:'Conta', t:'t' }, ...colDefs.map(c => ({ h:c[0], t:'R' })), { h:'Total', t:'R' }, ...(colDefs.length ? [] : [{ h:'% receita', t:'p' }])];
  return { cols:head, rows, rowCls:cls, nota:'Resultado econômico (competência). Compras de animais e investimentos aparecem separados e não reduzem o resultado; o custo dos animais vendidos entra na venda.' };
}

/* ---------------- RELATÓRIOS ---------------- */
const fmtCel = (v, t) => v === '' || v == null ? '' : t === 'R' ? R(v) : t === 'n' ? N(v) : t === 'n1' ? N(v,1) : t === 'n2' ? N(v,2) : t === 'p' ? N(v,1)+'%' : t === 'd' ? D(v) : String(v);
const lancRows = L => L.sort((a,b)=>(a.data||'').localeCompare(b.data||'')).map(l => [l.data, l.tipo === 'receita' ? 'Receita' : 'Despesa', ATIVIDADES[l.atividade]||'', l.categoria, CLASSIF[l.classificacao]||'', l.descricao||'', l.contraparte||'', l.local||'', +l.valor, pagoDe(l), statusL(l)]);
const LANC_COLS = [{h:'Data',t:'d'},{h:'Tipo',t:'t'},{h:'Atividade',t:'t'},{h:'Categoria',t:'t'},{h:'Classificação',t:'t'},{h:'Descrição',t:'t'},{h:'Fornecedor/cliente',t:'t'},{h:'Local',t:'t'},{h:'Valor',t:'R'},{h:'Pago/recebido',t:'R'},{h:'Situação',t:'t'}];
function movRows(f, tipos){
  return movsValidas().filter(m => tipos.includes(m.tipo) && inRange(m.data, f.ini, f.fim) && (!f.atv || ESPECIES[m.especie]?.atividade === f.atv)).sort((a,b)=>(a.data||'').localeCompare(b.data||''));
}
function linhasConsumo(f, cats, tiposManejo){
  const rows = [];
  for (const m of A('estoqueMovs').filter(m => m.tipo === 'saida' && inRange(m.data, f.ini, f.fim) && (!f.atv || m.atividade === f.atv))) {
    const p = byId('produtos', m.produtoId) || {}; if (!cats.includes(p.categoria)) continue;
    rows.push([m.data, p.nome, p.categoria, +m.qtd, p.unidade, +m.custo||0, ATIVIDADES[m.atividade]||'', alvoTxt(m.alvo), m.origem === 'manejo' ? 'Manejo' : 'Consumo']);
  }
  for (const m of A('manejos').filter(m => !m.produtoId && tiposManejo.includes(m.tipo) && inRange(m.data, f.ini, f.fim) && (!f.atv || ESPECIES[m.especie]?.atividade === f.atv)))
    rows.push([m.data, m.produtoNome||m.tipo, m.tipo, +m.qtd||'', m.unidade||'', '', ESPECIES[m.especie]?.nome||'', alvoTxt(m.alvo), 'Manejo (sem estoque)']);
  return rows.sort((a,b)=>a[0].localeCompare(b[0]));
}
const CONS_COLS = [{h:'Data',t:'d'},{h:'Produto',t:'t'},{h:'Categoria',t:'t'},{h:'Quantidade',t:'n2'},{h:'Unid.',t:'t'},{h:'Custo',t:'R'},{h:'Atividade',t:'t'},{h:'Destino',t:'t'},{h:'Origem',t:'t'}];
const somaCol = (rows, i) => round2(sum(rows, r => typeof r[i] === 'number' ? r[i] : 0));
const RELATORIOS = [
  { id:'fluxo', n:'Fluxo de caixa', g:'Financeiro', f: f => {
    const [i0, f0] = periodoReal(f.ini, f.fim); let acum = round2(sum(A('contas'), c => c.saldoInicial) + caixa('0000-01-01', addDias(i0, -1)).liq);
    const rows = []; let m = i0.slice(0,7)+'-01';
    while (m <= f0) { const a = m < i0 ? i0 : m, b = mesFim(m) > f0 ? f0 : mesFim(m); const c = caixa(a, b, l => !f.atv || l.atividade === f.atv); acum = round2(acum + c.liq); rows.push([mesLabel(m), c.ent, c.sai, c.liq, acum]); m = addMeses(m, 1); }
    return { cols:[{h:'Mês',t:'t'},{h:'Entradas',t:'R'},{h:'Saídas',t:'R'},{h:'Saldo do mês',t:'R'},{h:'Saldo acumulado',t:'R'}], rows, foot:['Total', somaCol(rows,1), somaCol(rows,2), somaCol(rows,3), ''], nota:'Regime de caixa: valores efetivamente pagos e recebidos.' }; } },
  { id:'dre', n:'DRE gerencial', g:'Financeiro', visao:true, f: dreRelatorio },
  { id:'recdesp', n:'Receitas e despesas', g:'Financeiro', f: f => { const rows = lancRows(A('lancamentos').filter(l => inRange(l.data, f.ini, f.fim) && (!f.atv || l.atividade === f.atv)));
    const rec = sum(rows.filter(r=>r[1]==='Receita'), r=>r[8]), des = sum(rows.filter(r=>r[1]==='Despesa'), r=>r[8]);
    return { cols:LANC_COLS, rows, resumo:[['Receitas', R(rec)], ['Despesas', R(des)], ['Saldo', R(rec-des)]] }; } },
  { id:'gerais', n:'Despesas gerais', g:'Propriedade', f: f => { const rows = lancRows(A('lancamentos').filter(l => l.tipo === 'despesa' && l.atividade === 'geral' && inRange(l.data, f.ini, f.fim)));
    const porG = {}; for (const l of A('lancamentos').filter(l => l.tipo === 'despesa' && l.atividade === 'geral' && inRange(l.data, f.ini, f.fim))) porG[(GRUPOS_GERAIS[l.grupo]||{}).nome||'—'] = (porG[(GRUPOS_GERAIS[l.grupo]||{}).nome||'—']||0) + (+l.valor||0);
    return { cols:LANC_COLS, rows, foot:['Total','','','','','','','',somaCol(rows,8),'',''], resumo:Object.entries(porG).map(([k,v]) => [k, R(v)]) }; } },
  ...[['cercas','Investimentos em cercas'],['casa','Investimentos na casa'],['instalacoes','Investimentos em construções']].map(([g, n]) => ({ id:'inv-'+g, n, g:'Propriedade', f: f => {
    const L = A('lancamentos').filter(l => l.tipo === 'despesa' && l.grupo === g && inRange(l.data, f.ini, f.fim)).sort((a,b)=>(a.data||'').localeCompare(b.data||''));
    const rows = L.map(l => [l.data, l.categoria, CLASSIF[l.classificacao]||'', l.descricao, l.local||'', l.contraparte||'', +l.valor]);
    const porC = {}; for (const l of L) porC[CLASSIF[l.classificacao]] = (porC[CLASSIF[l.classificacao]]||0) + (+l.valor||0);
    return { cols:[{h:'Data',t:'d'},{h:'Item',t:'t'},{h:'Classificação',t:'t'},{h:'Descrição',t:'t'},{h:'Local',t:'t'},{h:'Fornecedor',t:'t'},{h:'Valor',t:'R'}], rows, foot:['Total','','','','','',somaCol(rows,6)], resumo:Object.entries(porC).map(([k,v]) => [k, R(v)]) }; } })),
  { id:'custocab', n:'Custo por cabeça', g:'Custos', f: f => {
    const rows = [];
    for (const esp of Object.keys(ESPECIES)) { if (f.atv && ESPECIES[esp].atividade !== f.atv) continue; const c = custosEspecie(esp, f.ini, f.fim);
      for (const i of c.itens) { const cab = i.tipo === 'A' ? 1 : Math.max(i.cabMedia, 0.0001); rows.push([ESPECIES[esp].nome, i.tipo === 'A' ? i.obj.ident : 'Lote '+i.obj.codigo, i.obj.categoria, round2(i.cabMedia), i.aquis, round2(i.direto), round2(i.rateio), round2(i.periodo), round2(i.periodo/cab)]); } }
    return { cols:[{h:'Espécie',t:'t'},{h:'Animal/lote',t:'t'},{h:'Categoria',t:'t'},{h:'Cab. médias',t:'n1'},{h:'Aquisição',t:'R'},{h:'Direto',t:'R'},{h:'Rateio',t:'R'},{h:'Custo período',t:'R'},{h:'Custo/cabeça',t:'R'}], rows, foot:['Total','','','',somaCol(rows,4),somaCol(rows,5),somaCol(rows,6),somaCol(rows,7),''], nota:'Rateio das despesas operacionais por cabeça-dia; insumos baixados direto para o animal/lote como custo direto.' }; } },
  { id:'custolote', n:'Custo por lote', g:'Custos', f: f => {
    const rows = [];
    for (const esp of Object.keys(ESPECIES)) { if (f.atv && ESPECIES[esp].atividade !== f.atv) continue; const c = custosEspecie(esp, f.ini, f.fim); const grp = {};
      for (const i of c.itens) { const k = i.tipo === 'L' ? 'Lote '+i.obj.codigo : (i.obj.local || 'Sem lote'); grp[k] = grp[k] || { cat: i.tipo === 'L' ? i.obj.categoria : 'Individuais', cab:0, aq:0, c:0 }; grp[k].cab += i.cabMedia; grp[k].aq += i.aquis; grp[k].c += i.periodo; }
      for (const [k, v] of Object.entries(grp)) rows.push([ESPECIES[esp].nome, k, v.cat, round2(v.cab), round2(v.aq), round2(v.c), v.cab ? round2(v.c/v.cab) : '']); }
    return { cols:[{h:'Espécie',t:'t'},{h:'Lote / pastagem',t:'t'},{h:'Categoria',t:'t'},{h:'Cab. médias',t:'n1'},{h:'Aquisição',t:'R'},{h:'Custo período',t:'R'},{h:'Custo/cabeça',t:'R'}], rows, foot:['Total','','','',somaCol(rows,4),somaCol(rows,5),''] }; } },
  { id:'compravenda', n:'Compra e venda de animais', g:'Animais', f: f => { const M = movRows(f, ['compra','venda']);
    const rows = M.map(m => [m.data, MOV_NOMES[m.tipo], ESPECIES[m.especie]?.nome||'', alvoMov(m).replace(/<[^>]+>/g,''), +m.qtd||0, +m.peso||'', +m.valor||0, m.tipo==='venda' ? +(m.venda||{}).lucro||0 : '', m.contraparte||'']);
    return { cols:[{h:'Data',t:'d'},{h:'Tipo',t:'t'},{h:'Espécie',t:'t'},{h:'Animal/lote',t:'t'},{h:'Qtd',t:'n'},{h:'Peso (kg)',t:'n1'},{h:'Valor',t:'R'},{h:'Lucro s/ aquisição',t:'R'},{h:'Contraparte',t:'t'}], rows,
      resumo:[['Compras', R(sum(rows.filter(r=>r[1]==='Compra'), r=>r[6]))], ['Vendas', R(sum(rows.filter(r=>r[1]==='Venda'), r=>r[6]))]] }; } },
  { id:'nasc', n:'Nascimentos', g:'Animais', f: f => { const M = movRows(f, ['nascimento']); const rows = M.map(m => [m.data, ESPECIES[m.especie]?.nome||'', alvoMov(m).replace(/<[^>]+>/g,''), +m.qtd||0, m.obs||'']);
    return { cols:[{h:'Data',t:'d'},{h:'Espécie',t:'t'},{h:'Animal/lote',t:'t'},{h:'Quantidade',t:'n'},{h:'Observação',t:'t'}], rows, foot:['Total','','',somaCol(rows,3),''] }; } },
  { id:'mort', n:'Mortalidades', g:'Animais', f: f => { const M = movRows(f, ['mortalidade']); const rows = M.map(m => [m.data, ESPECIES[m.especie]?.nome||'', alvoMov(m).replace(/<[^>]+>/g,''), +m.qtd||0, m.causa||'', m.obs||'']);
    return { cols:[{h:'Data',t:'d'},{h:'Espécie',t:'t'},{h:'Animal/lote',t:'t'},{h:'Quantidade',t:'n'},{h:'Causa',t:'t'},{h:'Observação',t:'t'}], rows, foot:['Total','','',somaCol(rows,3),'',''] }; } },
  { id:'transf', n:'Transferências', g:'Animais', f: f => { const M = movRows(f, ['transferencia','local','categoria','desmame']);
    return { cols:[{h:'Data',t:'d'},{h:'Movimentação',t:'t'},{h:'Espécie',t:'t'},{h:'Animal/lote',t:'t'},{h:'Qtd',t:'n'},{h:'Detalhes',t:'t'}], rows: M.map(m => [m.data, MOV_NOMES[m.tipo], ESPECIES[m.especie]?.nome||'', alvoMov(m).replace(/<[^>]+>/g,''), +m.qtd||0, descMov(m).replace(/<[^>]+>/g,'')]) }; } },
  { id:'repro', n:'Reprodução', g:'Animais', f: f => { const L = A('reproducoes').filter(r => (inRange(r.dataCob, f.ini, f.fim) || (r.parto && inRange(r.parto.data, f.ini, f.fim))) && (!f.atv || ESPECIES[r.especie]?.atividade === f.atv)).sort((a,b)=>a.dataCob.localeCompare(b.dataCob));
    const rows = L.map(r => [ESPECIES[r.especie].nome, r.matrizNome, r.dataCob, r.reprodutor||'', r.prevParto, (ST_REPRO[r.status]||[])[1]||r.status, r.parto ? r.parto.data : '', r.parto ? (r.especie==='suino' ? r.parto.vivos : (r.parto.resultado==='vivo'?1:0)) : '', r.parto && r.especie==='suino' ? r.parto.mortos : '', r.desmame ? r.desmame.qtd : '']);
    return { cols:[{h:'Espécie',t:'t'},{h:'Matriz',t:'t'},{h:'Cobertura',t:'d'},{h:'Reprodutor',t:'t'},{h:'Previsão parto',t:'d'},{h:'Situação',t:'t'},{h:'Parto',t:'d'},{h:'Nascidos vivos',t:'n'},{h:'Mortos',t:'n'},{h:'Desmamados',t:'n'}], rows, foot:['Total','','','','','','',somaCol(rows,7),somaCol(rows,8),somaCol(rows,9)] }; } },
  { id:'racao', n:'Consumo de ração', g:'Manejo e estoque', f: f => { const rows = linhasConsumo(f, CAT_ALIMENTO, ['Ração / alimentação','Milho','Sal mineral','Suplementação']); return { cols:CONS_COLS, rows, foot:['Total','','','','',somaCol(rows,5),'','',''] }; } },
  { id:'medic', n:'Consumo de medicamentos', g:'Manejo e estoque', f: f => { const rows = linhasConsumo(f, CAT_SANIDADE, ['Vacinação','Vermifugação','Medicamento']); return { cols:CONS_COLS, rows, foot:['Total','','','','',somaCol(rows,5),'','',''] }; } },
  { id:'estoque', n:'Estoque', g:'Manejo e estoque', f: () => { const rows = A('produtos').sort((a,b)=>a.categoria.localeCompare(b.categoria)||a.nome.localeCompare(b.nome)).map(p => { const s = saldoProd(p.id), cm = custoMedioProd(p.id); return [p.nome, p.categoria, s, p.unidade, +p.estoqueMinimo||'', round2(cm), round2(Math.max(0,s)*cm), p.validade||'', p.estoqueMinimo && s <= p.estoqueMinimo ? 'Abaixo do mínimo' : '']; });
    return { cols:[{h:'Produto',t:'t'},{h:'Categoria',t:'t'},{h:'Saldo',t:'n2'},{h:'Unid.',t:'t'},{h:'Mínimo',t:'n2'},{h:'Preço médio',t:'R'},{h:'Valor em estoque',t:'R'},{h:'Validade',t:'d'},{h:'Alerta',t:'t'}], rows, foot:['Total','','','','','',somaCol(rows,6),'',''], semPeriodo:true }; } },
  { id:'patrim', n:'Patrimônio', g:'Propriedade', f: () => { const p = patrimonioResumo();
    const rows = [...A('patrimonio').map(b => [b.tipo, b.descricao, b.situacao, investidoBem(b), valorAtualBem(b)]), ...p.reb.linhas.map(l => ['Animais – '+ESPECIES[l.esp].nome, `${l.cat} (${N(l.q)} cab. × ${R(l.v)})`, 'Ativo', '', round2(l.total)]), ...(p.invNV ? [['Investimentos sem vínculo', 'Lançados no financeiro', '', p.invNV, p.invNV]] : [])];
    return { cols:[{h:'Tipo',t:'t'},{h:'Descrição',t:'t'},{h:'Situação',t:'t'},{h:'Investido',t:'R'},{h:'Valor atual',t:'R'}], rows, foot:['Total','','',somaCol(rows,3),somaCol(rows,4)], semPeriodo:true,
      resumo:[['Saldo financeiro disponível', R(p.saldo)], ['Contas a receber', R(p.ar)], ['Contas a pagar', R(-p.ap)], ['Estruturas e equipamentos', R(p.estruturas)], ['Animais', R(p.reb.total)], ['PATRIMÔNIO TOTAL', R(p.total)]] }; } },
  { id:'rentab', n:'Rentabilidade por atividade', g:'Financeiro', f: f => { const at = ['bovinos','suinos','galinhas']; const ge = econ(f.ini, f.fim, 'geral'); const E = at.map(a => econ(f.ini, f.fim, a)); const recT = sum(E, e => e.rec);
    const rows = at.map((a, i) => { const e = E[i], resOp = e.rec - e.cmv - e.oper, rat = recT ? (ge.ger + ge.oper + E.reduce((s,x)=>s+x.ger,0)) * e.rec / recT : 0; return [ATIVIDADES[a], e.rec, e.cmv, e.oper, resOp, e.rec ? round2(resOp/e.rec*100) : '', round2(rat), round2(resOp - rat)]; });
    const melhor = [...rows].sort((a,b)=>b[7]-a[7])[0];
    return { cols:[{h:'Atividade',t:'t'},{h:'Receita',t:'R'},{h:'Custo dos animais vendidos',t:'R'},{h:'Custos operacionais',t:'R'},{h:'Resultado operacional',t:'R'},{h:'Margem',t:'p'},{h:'Despesas gerais (rateio por receita)',t:'R'},{h:'Resultado final',t:'R'}], rows,
      foot:['Total', somaCol(rows,1), somaCol(rows,2), somaCol(rows,3), somaCol(rows,4), '', somaCol(rows,6), somaCol(rows,7)], resumo: melhor && melhor[1] ? [['Atividade mais lucrativa', `${melhor[0]} (${R(melhor[7])})`]] : [] }; } },
  { id:'comsui', n:'Comercialização de leitões e suínos', g:'Animais', f: f => { const V = movsValidas().filter(m => m.especie === 'suino' && m.tipo === 'venda' && inRange(m.data, f.ini, f.fim)).sort((a,b)=>a.data.localeCompare(b.data));
    const rows = V.map(m => { const v = m.venda||{}, l = byId('lancamentos', m.lancamentoId); return [m.data, v.produto||'', alvoMov(m).replace(/<[^>]+>/g,''), v.modo === 'kg' ? 'kg' : v.modo === 'lote' ? 'lote' : 'cabeça', +m.qtd, v.idade||'', +v.pesoMedio||'', +v.pesoTotal||'', +v.valorCabeca||'', +v.valorKg||'', +m.valor, +v.custo||0, +v.lucro||0, m.contraparte||'', l ? statusL(l) : '']; });
    const porProd = {}; for (const r of rows) { porProd[r[1]] = porProd[r[1]] || [0,0]; porProd[r[1]][0] += r[4]; porProd[r[1]][1] += r[10]; }
    return { cols:[{h:'Data',t:'d'},{h:'Produto',t:'t'},{h:'Origem',t:'t'},{h:'Por',t:'t'},{h:'Qtd',t:'n'},{h:'Idade',t:'t'},{h:'Peso médio',t:'n1'},{h:'Peso total',t:'n1'},{h:'R$/cab.',t:'R'},{h:'R$/kg',t:'R'},{h:'Total',t:'R'},{h:'Custo',t:'R'},{h:'Lucro',t:'R'},{h:'Comprador',t:'t'},{h:'Receb.',t:'t'}], rows,
      foot:['Total','','','',somaCol(rows,4),'','',somaCol(rows,7),'','',somaCol(rows,10),somaCol(rows,11),somaCol(rows,12),'',''], resumo:Object.entries(porProd).map(([k,v]) => [k, `${N(v[0])} cab. · ${R(v[1])}`]) }; } },
  { id:'manejos', n:'Manejo sanitário', g:'Manejo e estoque', f: f => { const M = A('manejos').filter(m => inRange(m.data, f.ini, f.fim) && (!f.atv || ESPECIES[m.especie]?.atividade === f.atv)).sort((a,b)=>a.data.localeCompare(b.data));
    return { cols:[{h:'Data',t:'d'},{h:'Tipo',t:'t'},{h:'Espécie',t:'t'},{h:'Aplicado em',t:'t'},{h:'Cabeças',t:'n'},{h:'Produto',t:'t'},{h:'Quantidade',t:'n2'},{h:'Custo',t:'R'},{h:'Carência até',t:'d'},{h:'Responsável',t:'t'}],
      rows: M.map(m => [m.data, m.tipo, ESPECIES[m.especie]?.nome||'', alvoTxt(m.alvo), +m.cabecas||0, m.produtoNome||'', +m.qtd||'', +m.custo||'', m.fimCarencia||'', m.responsavel||'']) }; } }
];
function relAtual(){ return RELATORIOS.find(r => r.id === uiGet('relId','dre')) || RELATORIOS[0]; }
function filtrosRel(){ return { ini:uiGet('rlIni', hoje().slice(0,4)+'-01-01'), fim:uiGet('rlFim', mesFim()), atv:uiGet('rlAtv',''), visao:uiGet('rlVisao','consolidada') }; }
function gerarRel(){ const r = relAtual(), f = filtrosRel(); return { r, f, out: r.f(f) }; }
function pgRelatorios(){
  if (!('rlIni' in S.ui)) { S.ui.rlIni = hoje().slice(0,4)+'-01-01'; S.ui.rlFim = mesFim(); }
  let g; try { g = gerarRel(); } catch(e){ console.error(e); g = { r:relAtual(), f:filtrosRel(), out:{ cols:[{h:'Erro',t:'t'}], rows:[[e.message]] } }; }
  const { r, out } = g;
  const grupos = [...new Set(RELATORIOS.map(x => x.g))];
  const tbl = `<div class="tw"><table><thead><tr>${out.cols.map(c => `<th class="${c.t!=='t'&&c.t!=='d'?'n':''}">${esc(c.h)}</th>`).join('')}</tr></thead><tbody>
    ${out.rows.length ? out.rows.slice(0,1000).map((row, i) => { const cls = out.rowCls ? out.rowCls[i] : ''; return `<tr class="${cls==='h'?'dre-h':cls==='t'?'dre-t':cls==='r'?'dre-r':''}">${row.map((v, j) => { const c = out.cols[j]; const neg = typeof v === 'number' && v < 0 && c.t === 'R';
      return `<td class="${c.t!=='t'&&c.t!=='d'?'n':''} ${cls==='l'&&j===0?'ind':''} ${neg&&cls!=='r'?'neg':''}">${esc(fmtCel(v, c.t))}</td>`; }).join('')}</tr>`; }).join('') : `<tr><td colspan="${out.cols.length}">${vazio('Sem dados para os filtros escolhidos')}</td></tr>`}
    </tbody>${out.foot ? `<tfoot><tr>${out.foot.map((v,j) => `<td class="${out.cols[j]&&out.cols[j].t!=='t'&&out.cols[j].t!=='d'?'n':''}">${esc(fmtCel(v, (out.cols[j]||{}).t))}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
  return `<div class="section-t" style="margin-top:0">Escolha o relatório</div>
    ${grupos.map(gr => `<div class="small muted" style="margin:10px 0 6px;font-weight:600">${gr}</div><div class="replist">${RELATORIOS.map((x,i) => [x,i]).filter(([x]) => x.g === gr).map(([x,i]) => `<div class="repitem ${x.id===r.id?'on':''}" data-act="setf" data-k="relId" data-v="${x.id}"><span class="repnum">${String(i+1).padStart(2,'0')}</span>${esc(x.n)}</div>`).join('')}</div>`).join('')}
    <div class="card" style="margin-top:16px"><h3>${esc(r.n)}</h3>
      <div class="bar">${out.semPeriodo ? '<span class="small muted" style="align-self:center">Posição atual</span>' : filtroPeriodo('rl')}
        ${['estoque','patrim'].includes(r.id) ? '' : `<label class="fld"><span>Atividade</span><select data-filter="rlAtv">${opts(Object.entries(ATIVIDADES), uiGet('rlAtv',''), 'Todas')}</select></label>`}
        ${r.visao ? `<label class="fld"><span>Visão</span><select data-filter="rlVisao">${opts([['consolidada','Consolidada'],['mensal','Mensal (mês a mês)'],['atividade','Por atividade']], uiGet('rlVisao','consolidada'))}</select></label>` : ''}
        <span class="grow"></span><button class="btn primary" data-act="relPDF">Exportar PDF</button><button class="btn ghost" data-act="relXLS">Exportar Excel</button></div>
      ${out.nota ? `<p class="small muted" style="margin:0 0 10px">${esc(out.nota)}</p>` : ''}${tbl}
      ${out.resumo && out.resumo.length ? `<div class="grid g4" style="margin-top:12px">${out.resumo.map(([k,v]) => kpi(esc(k), esc(v))).join('')}</div>` : ''}</div>`;
}
function textoFiltros(r, f, out){
  const p = out.semPeriodo ? 'Posição em ' + D(hoje()) : `Período: ${f.ini ? D(f.ini) : 'início'} a ${f.fim ? D(f.fim) : D(hoje())}`;
  return p + (f.atv && !['estoque','patrim'].includes(r.id) ? ' · Atividade: ' + ATIVIDADES[f.atv] : '') + (r.visao ? ' · Visão: ' + ({ consolidada:'Consolidada', mensal:'Mensal', atividade:'Por atividade' })[f.visao] : '');
}
async function exportarRelPDF(){
  if (!window.jspdf || !window.jspdf.jsPDF) return toast('Biblioteca de PDF não carregou. Verifique a internet e recarregue.', true);
  const { r, f, out } = gerarRel(); const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: out.cols.length > 6 ? 'landscape' : 'portrait', unit:'pt', format:'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const cab = () => {
    doc.setFillColor(31,61,43); doc.rect(0, 0, W, 62, 'F'); doc.setFillColor(201,165,74); doc.rect(0, 62, W, 2.5, 'F');
    try { doc.addImage(LOGO_PNG, 'PNG', 26, 9, 40, 44); } catch(e){}
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(17); doc.text('ESTÂNCIA 78', 76, 31);
    doc.setTextColor(226,199,122); doc.setFontSize(8); doc.text('G E S T Ã O   R U R A L', 77, 45);
    doc.setTextColor(255,255,255); doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text('Gerado em ' + D(hoje()), W - 26, 31, { align:'right' });
    doc.setTextColor(185,205,191); doc.text('Dados. Manejo. Resultado.', W - 26, 45, { align:'right' });
  };
  cab();
  doc.setTextColor(31,61,43); doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.text(r.n, 26, 92);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(110,120,112); doc.text(textoFiltros(r, f, out), 26, 107);
  const numCol = out.cols.map(c => c.t !== 't' && c.t !== 'd');
  const colStyles = {}; numCol.forEach((n, i) => { if (n) colStyles[i] = { halign:'right' }; });
  doc.autoTable({ startY: out.nota ? 128 : 118, head:[out.cols.map(c => c.h)], body: out.rows.map(row => row.map((v, j) => fmtCel(v, out.cols[j].t))),
    foot: out.foot ? [out.foot.map((v, j) => fmtCel(v, (out.cols[j]||{}).t))] : undefined, showFoot:'lastPage',
    styles:{ fontSize: out.cols.length > 10 ? 6.8 : 8, cellPadding:4, textColor:[29,36,32], lineColor:[230,232,225], lineWidth:0.4 },
    headStyles:{ fillColor:[107,122,58], textColor:255, fontStyle:'bold' }, footStyles:{ fillColor:[243,244,240], textColor:[29,36,32], fontStyle:'bold' },
    alternateRowStyles:{ fillColor:[250,251,248] }, columnStyles:colStyles, margin:{ top:80, left:26, right:26, bottom:40 },
    didParseCell: d => { if (d.section !== 'body' || !out.rowCls) return; const c = out.rowCls[d.row.index];
      if (c === 'h') { d.cell.styles.fillColor = [244,246,236]; d.cell.styles.textColor = [31,61,43]; d.cell.styles.fontStyle = 'bold'; }
      if (c === 't') d.cell.styles.fontStyle = 'bold';
      if (c === 'r') { d.cell.styles.fillColor = [31,61,43]; d.cell.styles.textColor = 255; d.cell.styles.fontStyle = 'bold'; }
      if (c === 'l' && d.column.index === 0) d.cell.styles.cellPadding = { left:16, top:4, bottom:4, right:4 }; },
    didDrawPage: () => { if (doc.internal.getCurrentPageInfo().pageNumber > 1) cab();
      doc.setFontSize(8); doc.setTextColor(123,132,126); doc.text('ESTÂNCIA 78 – Gestão Rural · ' + r.n, 26, H - 18); doc.text('Página ' + doc.internal.getCurrentPageInfo().pageNumber, W - 26, H - 18, { align:'right' }); } });
  if (out.nota) { doc.setPage(1); doc.setFontSize(8); doc.setTextColor(110,120,112); doc.text(doc.splitTextToSize(out.nota, W - 52), 26, 119); doc.setPage(doc.getNumberOfPages()); }
  if (out.resumo && out.resumo.length) {
    let y = doc.lastAutoTable.finalY + 22; if (y > H - 120) { doc.addPage(); cab(); y = 100; }
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(31,61,43); doc.text('Resumo', 26, y); y += 6;
    doc.autoTable({ startY:y, body:out.resumo, theme:'plain', styles:{ fontSize:9, cellPadding:3 }, columnStyles:{ 1:{ halign:'right', fontStyle:'bold' } }, margin:{ left:26 }, tableWidth:320 });
  }
  await salvarArquivo(`estancia78-${r.id}-${hoje()}.pdf`, doc.output('blob'));
}
function exportarRelXLS(){
  const { r, f, out } = gerarRel();
  const linhas = out.rows.map(row => row.map((v, j) => out.cols[j].t === 'd' ? D(v) : (typeof v === 'number' ? round2(v) : v)));
  if (out.foot) linhas.push(out.foot.map((v, j) => (out.cols[j]||{}).t === 'd' ? '' : v));
  if (out.resumo) { linhas.push([]); out.resumo.forEach(x => linhas.push(x)); }
  linhas.push([]); linhas.push([textoFiltros(r, f, out)]); if (out.nota) linhas.push([out.nota]);
  return exportarXLSX(`estancia78-${r.id}-${hoje()}.xlsx`, r.n, out.cols.map(c => c.h), linhas);
}

/* ---------------- Integrações com o restante do sistema ---------------- */
function contadorAgenda(){ const hj = hoje(); return A('eventos').filter(e => !e.concluido && e.data <= hj).length; }
function atualizarModais(){ const box = $('#modal-root .daylist'); if (box && S.diaAberto) { const ev = evDoDia(A('eventos'), S.diaAberto); const h = ev.length ? ev.map(e => linhaEvento(e)).join('') : '<p class="muted" style="margin:0 0 6px">Nenhum compromisso neste dia.</p>'; if (box.innerHTML !== h) box.innerHTML = h; } }
function extraAlertas(){
  const out = []; const hj = hoje();
  const atr = A('eventos').filter(e => !e.concluido && e.data < hj); if (atr.length) out.push(['err', `${atr.length} compromisso(s) atrasado(s) no calendário`]);
  const hoj = A('eventos').filter(e => !e.concluido && e.data === hj); if (hoj.length) out.push(['', `Hoje: ${hoj.map(e => e.titulo).slice(0,3).join(' · ')}${hoj.length>3?` (+${hoj.length-3})`:''}`]);
  const lem = lembretesHoje().filter(e => e.data > hj); if (lem.length) out.push(['', `Lembretes: ${lem.slice(0,3).map(e => D(e.data).slice(0,5) + ' ' + e.titulo).join(' · ')}`]);
  for (const a of alertasEstoque().slice(0,4)) out.push([a.nivel, a.txt]);
  const car = A('manejos').filter(m => m.fimCarencia && m.fimCarencia >= hj); if (car.length) out.push(['', `${car.length} manejo(s) em período de carência (não vender/abater): ${car.slice(0,3).map(m => alvoTxt(m.alvo)).join(', ')}`]);
  return out;
}
Object.assign(PAGES, {
  manejo:{ titulo:'Manejo', sub:'Vacinação, vermifugação, medicamentos, alimentação e controle sanitário', render:pgManejo },
  reproducao:{ titulo:'Reprodução', sub:'Coberturas, gestação, partos e desmame', render:pgReproducao },
  calendario:{ titulo:'Calendário de manejo', sub:'Clique em uma data para incluir, concluir ou excluir compromissos', render:pgCalendario },
  estoque:{ titulo:'Estoque', sub:'Insumos, compras, consumo e alertas', render:pgEstoque },
  custos:{ titulo:'Custos', sub:'Custo por cabeça, por lote, por leitegada e por dúzia', render:pgCustos },
  patrimonio:{ titulo:'Patrimônio', sub:'Bens, rebanho, investimentos e evolução', render:pgPatrimonio, after:afterPatrimonio },
  relatorios:{ titulo:'Relatórios gerenciais', sub:'Visualize e exporte em PDF ou Excel', render:pgRelatorios }
});
Object.assign(ACTIONS, {
  novoProduto: () => abrirProduto(), editProduto: d => abrirProduto(byId('produtos', d.id)),
  entradaEst: d => abrirEntrada(d.id), saidaEst: d => abrirSaida(d.id), ajusteEst: d => abrirAjusteEstoque(d.id), estornarEst: d => estornarEstoqueMov(byId('estoqueMovs', d.id)),
  novoManejo: () => abrirManejo(), novoManejoTipo: d => abrirManejo({ tipo:d.tipo }), novoManejoAlvo: d => abrirManejo({ especie:d.esp, loteId:d.lote, animalId:d.animal }), delManejo: d => excluirManejo(byId('manejos', d.id)),
  novaCobertura: d => abrirCobertura(d.esp), rpDiag: d => abrirDiagnostico(byId('reproducoes', d.id)), rpParto: d => abrirParto(byId('reproducoes', d.id)),
  rpDesmame: d => abrirDesmameRepro(byId('reproducoes', d.id)), rpAborto: d => abrirAborto(byId('reproducoes', d.id)), rpDel: d => excluirRepro(byId('reproducoes', d.id)),
  calNav: d => { const v = uiGet('calView','mes'), ref = uiGet('calRef', hoje()), n = +d.n; S.ui.calRef = v === 'mes' ? addMeses(ref.slice(0,7)+'-01', n) : addDias(ref, v === 'semana' ? 7*n : n); render(); },
  calHoje: () => { S.ui.calRef = hoje(); render(); },
  calDia: d => { if (uiGet('calView','mes') === 'mes' || true) { S.diaAberto = d.d; abrirDia(d.d); } },
  calNovo: d => abrirEvento(d.d || hoje(), null, d.tipo),
  calEv: d => { const e = byId('eventos', d.id); if (e) abrirEvento(e.data, e); },
  calToggle: d => toggleEvento(d.id), calDel: d => excluirEvento(d.id),
  novoBem: () => abrirBem(), editBem: d => abrirBem(byId('patrimonio', d.id)), fichaBem: d => abrirFichaBem(d.id), melhoriaBem: d => abrirMelhoria(byId('patrimonio', d.id)), delMelhoria: d => removerMelhoria(d.id, d.m),
  salvarVC: async () => { try { exigeEscrita(); const f = $('#fVC'); const vc = JSON.parse(JSON.stringify(S.cfg.valorCategoria||{}));
    for (const el of f.elements) { if (!el.name) continue; const [esp, cat] = el.name.split('|'); vc[esp] = vc[esp] || {}; if (el.value.trim() === '') delete vc[esp][cat]; else vc[esp][cat] = num(el.value); }
    await salvarCfg({ valorCategoria:vc }); toast('Valores salvos.'); } catch(e){ falha(e); } },
  relPDF: () => exportarRelPDF(), relXLS: () => exportarRelXLS(),
  expEstoque: () => { const R_ = RELATORIOS.find(r => r.id === 'estoque').f({}); exportarXLSX(`estancia78-estoque-${hoje()}.xlsx`, 'Estoque', R_.cols.map(c=>c.h), R_.rows.map(r => r.map((v,j) => R_.cols[j].t === 'd' ? D(v) : v))); },
  expManejos: () => { const [ini, fim] = periodo('mj'); const R_ = RELATORIOS.find(r => r.id === 'manejos').f({ ini, fim }); exportarXLSX(`estancia78-manejos-${hoje()}.xlsx`, 'Manejo sanitário', R_.cols.map(c=>c.h), R_.rows.map(r => r.map((v,j) => R_.cols[j].t === 'd' ? D(v) : v))); }
});
