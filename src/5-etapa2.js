/* =====================================================================
   ETAPA 2 · Estoque · Manejo · Reprodução · Calendário
   Coleções: produtos · estoqueMovs · manejos · reproducoes · eventos
   ===================================================================== */

/* ---------------- ESTOQUE ---------------- */
const CAT_PROD = ['Ração','Milho','Sal mineral','Suplementos','Medicamentos','Vacinas','Vermífugos','Materiais de construção','Arames','Mourões','Ferramentas','Outros insumos'];
const UNIDADES = ['kg','saco','tonelada','L','mL','dose','frasco','un','m','rolo','caixa'];
const PROD_DESP_ANIMAL = { 'Ração':'Ração','Milho':'Milho','Sal mineral':'Sal mineral','Suplementos':'Suplementos','Medicamentos':'Medicamentos','Vacinas':'Vacinas','Vermífugos':'Vermífugos' };
const PROD_DESP_GERAL = { 'Arames':['cercas','Arame'], 'Mourões':['cercas','Mourões'], 'Ferramentas':['instalacoes','Ferramentas'], 'Materiais de construção':['casa','Cimento'] };
const CAT_ALIMENTO = ['Ração','Milho','Suplementos','Sal mineral'];
const CAT_SANIDADE = ['Medicamentos','Vacinas','Vermífugos'];

const saldoProd = id => round2(sum(A('estoqueMovs').filter(m => m.produtoId === id), m => m.delta));
function custoMedioProd(id){
  const E = A('estoqueMovs').filter(m => m.produtoId === id && (+m.delta||0) > 0 && (+m.valor||0) > 0);
  const q = sum(E, m => m.delta), v = sum(E, m => m.valor);
  if (q > 0) return v / q;
  const p = byId('produtos', id); return p ? (+p.precoRef||0) : 0;
}
function alertasEstoque(){
  const out = [];
  for (const p of A('produtos')) {
    const s = saldoProd(p.id);
    if (p.estoqueMinimo && s <= +p.estoqueMinimo) out.push({ nivel: s <= 0 ? 'err' : '', txt:`Estoque baixo: ${p.nome} — ${N(s,2)} ${p.unidade} (mínimo ${N(p.estoqueMinimo,2)})`, prod:p });
    if (p.validade && s > 0) {
      const d = diasEntre(hoje(), p.validade);
      if (d < 0) out.push({ nivel:'err', txt:`Vencido: ${p.nome} (validade ${D(p.validade)})`, prod:p });
      else if (d <= 30) out.push({ nivel:'', txt:`Vence em ${d} dia(s): ${p.nome} (${D(p.validade)})`, prod:p });
    }
  }
  return out;
}
function prodOpts(filtro){ return A('produtos').filter(filtro || (()=>true)).sort((a,b)=>a.nome.localeCompare(b.nome)).map(p => [p.id, `${p.nome} — saldo ${N(saldoProd(p.id),2)} ${p.unidade}`]); }
function alvoOpts(esp, { incluirTodos=true } = {}){
  const o = [];
  if (incluirTodos) o.push(['T:'+esp, `Todos os ${ESPECIES[esp].nome.toLowerCase()} ativos (${cabecas(esp)} cab.)`]);
  for (const l of lotesAtivos(esp)) o.push(['L:'+l.id, `Lote ${nomeLote(l)} (${saldoLote(l.id)} cab.)`]);
  for (const a of indAtivos(esp).sort((x,y)=>x.ident.localeCompare(y.ident,'pt',{numeric:true}))) o.push(['A:'+a.id, `${ESPECIES[esp].sing} ${nomeAnimal(a)} · ${a.categoria}`]);
  return o;
}
function alvoTxt(alvo){
  if (!alvo) return '—';
  const [t, id] = [alvo.slice(0,1), alvo.slice(2)];
  if (t === 'T') return 'Todos os ' + (ESPECIES[id]?.nome||'').toLowerCase();
  if (t === 'L') return 'Lote ' + ((byId('lotes', id)||{}).codigo || '?');
  if (t === 'A') return (byId('animais', id)||{}).ident || '?';
  return '—';
}
function cabecasAlvo(alvo){
  const [t, id] = [alvo.slice(0,1), alvo.slice(2)];
  if (t === 'T') return cabecas(id); if (t === 'L') return Math.max(0, saldoLote(id)); return 1;
}

function abrirProduto(edit = null){
  const p = edit || {}, novo = !edit;
  modal({ title: novo ? 'Novo produto / insumo' : 'Editar produto', submit: novo ? 'Cadastrar' : 'Salvar',
    html:`<div class="fg">${fInp('nome','Nome do produto *', p.nome||'', 'full placeholder="Ex.: Ração crescimento 22%, Ivermectina 1%"')}
      ${fSel('categoria','Categoria', CAT_PROD, p.categoria||'Ração')}${fSel('unidade','Unidade de medida', UNIDADES, p.unidade||'kg')}
      ${fNum('estoqueMinimo','Estoque mínimo', p.estoqueMinimo||'')}${fDate('validade','Data de validade', p.validade||'')}
      ${fInp('fornecedor','Fornecedor', p.fornecedor||'')}${fNum('precoRef','Preço de referência por unidade (R$)', p.precoRef||'')}
      ${novo ? fNum('saldoInicial','Quantidade em estoque hoje (saldo inicial)','') + fNum('valorInicial','Valor total desse saldo (R$, opcional)','') : ''}
      ${fTxt('obs','Observações', p.obs||'')}</div>
      ${novo ? '<p class="small muted">O saldo inicial não gera lançamento financeiro. Compras futuras: use “Entrada”.</p>' : ''}`,
    async onSubmit(fd){
      exigeEscrita();
      const d = { nome:reqTxt(fd.nome,'o nome'), categoria:fd.categoria, unidade:fd.unidade, estoqueMinimo:num(fd.estoqueMinimo)||null, validade:fd.validade||'', fornecedor:(fd.fornecedor||'').trim(), precoRef:num(fd.precoRef)||null, obs:(fd.obs||'').trim() };
      if (A('produtos').some(x => x.nome.toLowerCase() === d.nome.toLowerCase() && x.id !== p.id)) throw new Error('Já existe um produto com esse nome.');
      if (!novo) { await dbUpd('produtos', p.id, d); await audit('editar','produtos',p.id,d.nome); toast('Produto atualizado.'); return; }
      const id = novoId('produtos'); await dbSet('produtos', id, d); await audit('criar','produtos',id,d.nome);
      const si = num(fd.saldoInicial);
      if (si > 0) await dbSet('estoqueMovs', novoId('estoqueMovs'), { produtoId:id, tipo:'inicial', data:hoje(), delta:si, qtd:si, valor:num(fd.valorInicial)||(d.precoRef?round2(si*d.precoRef):null), obs:'Saldo inicial' });
      toast('Produto cadastrado.');
    } });
}
function abrirEntrada(prodId){
  const p = byId('produtos', prodId);
  const geral = !PROD_DESP_ANIMAL[p.categoria];
  modal({ title:`Entrada (compra) · ${p.nome}`, submit:'Registrar entrada',
    html:`<div class="fg">${fDate('data','Data')}${fNum('qtd',`Quantidade (${p.unidade}) *`,'')}
      ${fNum('valor','Valor total (R$)','')}${fInp('fornecedor','Fornecedor', p.fornecedor||'')}
      ${fDate('validade','Validade deste lote do produto', p.validade||'')}
      ${fSel('gerar','Lançar no financeiro?', [['sim','Sim, registrar a despesa'],['nao','Não (já lancei no financeiro)']], 'sim')}
      ${fSel('atividade','Atividade da despesa', Object.entries(ATIVIDADES), geral ? 'geral' : 'bovinos')}</div>
      <div data-w="pg">${blocoPagamento('despesa')}</div>${fTxt('obs','Observações','')}
      <p class="small muted">A despesa é lançada uma única vez na compra. O consumo depois só baixa o estoque e distribui o custo para lotes e animais, sem lançar de novo.</p>`,
    onInit(form){ wirePagamento(form); const upd = () => { const s = form.elements.gerar.value === 'sim'; form.querySelector('[data-w=pg]').style.display = s ? '' : 'none'; form.elements.atividade.closest('.fld').style.display = s ? '' : 'none'; }; form.elements.gerar.addEventListener('change', upd); upd(); },
    async onSubmit(fd){
      exigeEscrita(); const data = reqData(fd.data), q = reqPos(fd.qtd,'a quantidade'), valor = num(fd.valor);
      const mid = novoId('estoqueMovs'); let lid = null;
      if (fd.gerar === 'sim') {
        if (!(valor > 0)) throw new Error('Informe o valor total para lançar no financeiro.');
        const pago = pagoAgoraDe(fd, valor); checaConta(fd, pago);
        const atv = fd.atividade; let categoria, grupo = null;
        if (atv === 'geral') { const g = PROD_DESP_GERAL[p.categoria] || ['gerais','Outras despesas']; grupo = g[0]; categoria = g[1]; }
        else categoria = PROD_DESP_ANIMAL[p.categoria] || 'Outros custos';
        lid = novoId('lancamentos');
        await criarLanc({ tipo:'despesa', data, atividade:atv, categoria, grupo, descricao:`${p.nome} (${N(q,2)} ${p.unidade})`, quantidade:q, valorUnit:round2(valor/q), valor,
          forma:fd.forma, contaId:fd.contaId, vencimento:fd.vencimento||data, contraparte:(fd.fornecedor||'').trim(), origem:'estoque', refId:mid }, { id:lid, pagoAgora:pago, contaId:fd.contaId });
      }
      await dbSet('estoqueMovs', mid, { produtoId:prodId, tipo:'entrada', data, delta:q, qtd:q, valor:valor||null, fornecedor:(fd.fornecedor||'').trim(), lancamentoId:lid, obs:(fd.obs||'').trim() });
      if (fd.validade && fd.validade !== p.validade) await dbUpd('produtos', prodId, { validade:fd.validade });
      await audit('entrada estoque','estoqueMovs',mid,`${p.nome} +${q}`);
      toast('Entrada registrada.');
    } });
}
async function baixarEstoque({ produtoId, qtd, data, atividade, alvo, origem, refId, obs, autorizar }){
  const p = byId('produtos', produtoId); const s = saldoProd(produtoId);
  if (qtd > s + 1e-9 && !autorizar) throw new Error(`Estoque insuficiente de ${p.nome}: saldo ${N(s,2)} ${p.unidade}. Marque “autorizar estoque negativo” se quiser lançar assim mesmo.`);
  const cm = custoMedioProd(produtoId), mid = novoId('estoqueMovs');
  await dbSet('estoqueMovs', mid, { produtoId, tipo:'saida', data, delta:-qtd, qtd, custo:round2(qtd*cm), atividade:atividade||null, alvo:alvo||null, origem:origem||'consumo', refId:refId||null, obs:obs||'' });
  await audit('saída estoque','estoqueMovs',mid,`${p.nome} −${qtd}`);
  return { mid, custo:round2(qtd*cm) };
}
function abrirSaida(prodId){
  const p = byId('produtos', prodId);
  modal({ title:`Consumo / saída · ${p.nome}`, submit:'Registrar saída',
    html:`<div class="note" style="margin-bottom:12px">Saldo: <b>${N(saldoProd(prodId),2)} ${p.unidade}</b> · custo médio ${R(custoMedioProd(prodId))}/${p.unidade}</div>
      <div class="fg">${fDate('data','Data')}${fNum('qtd',`Quantidade (${p.unidade}) *`,'')}
      ${fSel('atividade','Atividade', Object.entries(ATIVIDADES), 'bovinos')}
      <label class="fld"><span>Lote / animal (opcional)</span><select name="alvo"></select></label>
      ${fTxt('obs','Observações / motivo','')}
      <label class="fld full" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="autorizar" style="width:auto"> Autorizar estoque negativo</label></div>
      <p class="small muted">Para vacinas, vermífugos e medicamentos aplicados nos animais, prefira o módulo Manejo: ele baixa o estoque e guarda o histórico sanitário.</p>`,
    onInit(form){ const upd = () => { const esp = ATV_ESPECIE[form.elements.atividade.value]; form.elements.alvo.innerHTML = opts(esp ? alvoOpts(esp, { incluirTodos:false }) : [], '', esp ? 'Atividade inteira' : '—'); }; form.elements.atividade.addEventListener('change', upd); upd(); },
    async onSubmit(fd){ exigeEscrita();
      await baixarEstoque({ produtoId:prodId, qtd:reqPos(fd.qtd,'a quantidade'), data:reqData(fd.data), atividade:fd.atividade, alvo:fd.alvo||null, origem:'consumo', obs:(fd.obs||'').trim(), autorizar:!!fd.autorizar });
      toast('Saída registrada.'); } });
}
function abrirAjusteEstoque(prodId){
  const p = byId('produtos', prodId);
  modal({ title:`Ajuste de inventário · ${p.nome}`, submit:'Ajustar',
    html:`<div class="note" style="margin-bottom:12px">Saldo no sistema: <b>${N(saldoProd(prodId),2)} ${p.unidade}</b></div><div class="fg">${fDate('data','Data')}${fNum('contado',`Quantidade contada (${p.unidade}) *`,'')}${fTxt('obs','Motivo *','')}</div>`,
    async onSubmit(fd){ exigeEscrita(); const c = num(fd.contado); if (c < 0) throw new Error('Quantidade inválida.'); const d = round2(c - saldoProd(prodId));
      if (!d) throw new Error('O saldo já confere.'); reqTxt(fd.obs,'o motivo');
      await dbSet('estoqueMovs', novoId('estoqueMovs'), { produtoId:prodId, tipo:'ajuste', data:reqData(fd.data), delta:d, qtd:Math.abs(d), custo: d < 0 ? round2(-d*custoMedioProd(prodId)) : null, obs:fd.obs.trim() });
      toast('Inventário ajustado.'); } });
}
async function estornarEstoqueMov(m){
  if ((+m.delta||0) > 0 && saldoProd(m.produtoId) - m.delta < -1e-9) return toast('Estorno deixaria o estoque negativo.', true);
  if (m.origem === 'manejo') return toast('Esta saída veio de um manejo: exclua o manejo em Manejo.', true);
  const lanc = m.lancamentoId ? byId('lancamentos', m.lancamentoId) : null;
  if (!(await confirmar(`Estornar ${m.tipo} de ${N(m.qtd,2)} em ${D(m.data)}?${lanc?' O lançamento financeiro vinculado também será excluído.':''}`, 'Estornar'))) return;
  try { exigeEscrita(); await dbUpd('estoqueMovs', m.id, { excluido:true, excluidoEm:stamp() });
    if (lanc) await dbUpd('lancamentos', lanc.id, { excluido:true, excluidoEm:stamp() });
    await audit('estornar','estoqueMovs',m.id,''); toast('Estornado.'); } catch(e){ falha(e); }
}
function pgEstoque(){
  const t = uiGet('estTab','produtos');
  const P = A('produtos'); const al = alertasEstoque();
  const valorTotal = sum(P, p => Math.max(0, saldoProd(p.id)) * custoMedioProd(p.id));
  let body = '';
  if (t === 'produtos') {
    const cat = uiGet('estCat',''), q = (uiGet('estQ','')||'').toLowerCase();
    const L = P.filter(p => (!cat || p.categoria === cat) && (!q || p.nome.toLowerCase().includes(q))).sort((a,b)=>a.categoria.localeCompare(b.categoria)||a.nome.localeCompare(b.nome));
    body = `<div class="bar"><button class="btn primary" data-act="novoProduto">+ Novo produto</button>
      <label class="fld"><span>Categoria</span><select data-filter="estCat">${opts(CAT_PROD, cat, 'Todas')}</select></label>
      <label class="fld grow"><span>Buscar</span><input data-filter="estQ" value="${esc(uiGet('estQ',''))}" placeholder="nome do produto"></label>
      <button class="btn ghost" data-act="expEstoque">Exportar Excel</button></div>
      ${L.length ? `<div class="tw"><table><thead><tr><th>Produto</th><th>Categoria</th><th class="n">Saldo</th><th class="n">Mínimo</th><th class="n">Preço médio</th><th class="n">Valor em estoque</th><th>Validade</th><th>Fornecedor</th><th></th></tr></thead><tbody>
      ${L.map(p => { const s = saldoProd(p.id), cm = custoMedioProd(p.id), baixo = p.estoqueMinimo && s <= p.estoqueMinimo, venc = p.validade && diasEntre(hoje(), p.validade) <= 30;
        return `<tr><td><b>${esc(p.nome)}</b></td><td>${esc(p.categoria)}</td><td class="n ${s<0?'neg':''}"><b>${N(s,2)}</b> ${esc(p.unidade)} ${baixo?'<span class="badge b-err">baixo</span>':''}</td>
          <td class="n">${p.estoqueMinimo?N(p.estoqueMinimo,2):'—'}</td><td class="n">${cm?R(cm):'—'}</td><td class="n">${R(Math.max(0,s)*cm)}</td>
          <td>${p.validade?`${D(p.validade)} ${venc?`<span class="badge ${diasEntre(hoje(),p.validade)<0?'b-err':'b-pend'}">${diasEntre(hoje(),p.validade)<0?'vencido':'vence logo'}</span>`:''}`:'—'}</td><td>${esc(p.fornecedor||'')}</td>
          <td><div class="acts"><button class="ico" data-act="entradaEst" data-id="${p.id}">Entrada</button><button class="ico" data-act="saidaEst" data-id="${p.id}">Saída</button><button class="ico" data-act="ajusteEst" data-id="${p.id}">Ajuste</button><button class="ico" data-act="editProduto" data-id="${p.id}">Editar</button></div></td></tr>`; }).join('')}
      </tbody></table></div>` : `<div class="tw">${vazio('Nenhum produto cadastrado', 'Cadastre rações, milho, sal, medicamentos, vacinas e materiais para controlar o estoque.')}</div>`}`;
  } else {
    const [ini, fim] = periodo('em'); const tipo = uiGet('emTipo','');
    const M = A('estoqueMovs').filter(m => inRange(m.data, ini, fim) && (!tipo || m.tipo === tipo)).sort((a,b)=>(b.data||'').localeCompare(a.data||'')||(b.criadoEm||'').localeCompare(a.criadoEm||''));
    body = `<div class="bar">${filtroPeriodo('em')}<label class="fld"><span>Tipo</span><select data-filter="emTipo">${opts([['entrada','Entradas'],['saida','Saídas'],['ajuste','Ajustes'],['inicial','Saldo inicial']], tipo, 'Todos')}</select></label></div>
      ${M.length ? `<div class="tw"><table><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th class="n">Quantidade</th><th class="n">Valor / custo</th><th>Destino</th><th>Obs.</th><th></th></tr></thead><tbody>
      ${M.slice(0,400).map(m => { const p = byId('produtos', m.produtoId)||{}; return `<tr><td>${D(m.data)}</td><td>${esc(p.nome||'?')}</td><td><span class="badge ${m.delta>0?'b-ok':m.tipo==='ajuste'?'b-mut':'b-err'}">${esc({entrada:'Entrada',saida:'Saída',ajuste:'Ajuste',inicial:'Saldo inicial'}[m.tipo]||m.tipo)}</span>${m.origem==='manejo'?' <span class="small muted">manejo</span>':''}</td>
        <td class="n ${m.delta<0?'neg':'pos'}">${m.delta>0?'+':''}${N(m.delta,2)} ${esc(p.unidade||'')}</td><td class="n">${m.valor?R(m.valor):m.custo?R(m.custo):''}</td>
        <td>${m.atividade?esc(ATIVIDADES[m.atividade]||''):''}${m.alvo?' · '+esc(alvoTxt(m.alvo)):''}</td><td class="small">${esc(m.obs||'')}</td>
        <td><div class="acts"><button class="ico" data-act="estornarEst" data-id="${m.id}">Estornar</button></div></td></tr>`; }).join('')}</tbody></table></div>` : `<div class="tw">${vazio('Nenhuma movimentação no período')}</div>`}`;
  }
  return `<div class="grid g4" style="margin-bottom:14px">${kpi('Produtos cadastrados', N(P.length), '', 'gold')}${kpi('Valor em estoque', R(valorTotal), 'saldo × preço médio', 'green')}
      ${kpi('Abaixo do mínimo', N(P.filter(p=>p.estoqueMinimo && saldoProd(p.id) <= p.estoqueMinimo).length), '', 'red')}${kpi('Vencendo / vencidos', N(al.filter(a=>/Venc/.test(a.txt)).length), 'próximos 30 dias', 'blue')}</div>
    ${al.length ? `<div class="alerts" style="margin-bottom:14px">${al.map(a=>`<div class="${a.nivel}">${esc(a.txt)}</div>`).join('')}</div>` : ''}
    ${tabs('estTab', [['produtos','Produtos e saldos'],['movs','Movimentações']], 'produtos')}${body}`;
}

/* ---------------- MANEJO ---------------- */
const TIPOS_MANEJO = ['Vacinação','Vermifugação','Medicamento','Sal mineral','Suplementação','Ração / alimentação','Milho','Controle sanitário','Observação sanitária'];
const MANEJO_PROD_CAT = { 'Vacinação':['Vacinas'], 'Vermifugação':['Vermífugos'], 'Medicamento':['Medicamentos'], 'Sal mineral':['Sal mineral'], 'Suplementação':['Suplementos'], 'Ração / alimentação':['Ração'], 'Milho':['Milho'] };
const MANEJO_EVENTO = { 'Vacinação':'Vacinação', 'Vermifugação':'Vermifugação' };
function abrirManejo(preset = {}){
  const esp0 = preset.especie || 'bovino';
  modal({ title:'Registrar manejo', submit:'Registrar', wide:true,
    html:`<div class="fg">
      ${fDate('data','Data')}${fSel('tipo','Tipo de manejo', TIPOS_MANEJO, preset.tipo || 'Vacinação')}
      ${fSel('especie','Espécie', Object.entries(ESPECIES).map(([k,v])=>[k,v.nome]), esp0)}
      <label class="fld"><span>Aplicado em *</span><select name="alvo"></select></label>
      <label class="fld"><span>Produto do estoque <span class="muted">(baixa automática)</span></span><select name="produtoId"></select></label>
      ${fInp('produtoNome','Ou produto / descrição livre','', 'placeholder="se não estiver no estoque"')}
      ${fNum('qtd','Quantidade total usada','')}${fInp('dose','Dose por animal','', 'placeholder="Ex.: 2 mL, 1 dose"')}
      ${fInp('responsavel','Responsável','')}${fNum('carencia','Carência (dias)','')}
      ${fDate('proxima','Próxima aplicação (vai para o calendário)','')}
      <label class="fld" style="flex-direction:row;gap:8px;align-items:center;align-self:end"><input type="checkbox" name="autorizar" style="width:auto"> Autorizar estoque negativo</label>
      ${fTxt('obs','Observações sanitárias','')}</div>
      <div class="note" data-o="info" style="margin-top:10px"></div>`,
    onInit(form){
      const f = n => form.elements[n];
      function upd(src){
        const esp = f('especie').value;
        if (src !== 'alvo' && src !== 'produtoId') {
          const cur = f('alvo').value || (preset.loteId ? 'L:'+preset.loteId : preset.animalId ? 'A:'+preset.animalId : '');
          f('alvo').innerHTML = opts(alvoOpts(esp), cur);
        }
        if (src !== 'produtoId') { const cats = MANEJO_PROD_CAT[f('tipo').value]; const cur = f('produtoId').value;
          f('produtoId').innerHTML = opts(prodOpts(p => !cats || cats.includes(p.categoria)), cur, 'Não usar estoque'); }
        const pid = f('produtoId').value, p = pid && byId('produtos', pid), q = num(f('qtd').value), cab = f('alvo').value ? cabecasAlvo(f('alvo').value) : 0;
        form.querySelector('[data-o=info]').innerHTML = `${cab} cabeça(s) no alvo` + (p ? ` · saldo ${N(saldoProd(pid),2)} ${p.unidade} · custo estimado <b>${R(q*custoMedioProd(pid))}</b>${cab&&q?` (${R(q*custoMedioProd(pid)/cab)}/cab.)`:''}` : '');
      }
      form.addEventListener('change', e => upd(e.target.name)); form.addEventListener('input', e => { if (e.target.name === 'qtd') upd('produtoId'); });
      upd();
    },
    async onSubmit(fd){
      exigeEscrita(); const data = reqData(fd.data);
      if (!fd.alvo) throw new Error('Escolha em quais animais o manejo foi aplicado.');
      const p = fd.produtoId ? byId('produtos', fd.produtoId) : null; const qtd = num(fd.qtd);
      if (p && !(qtd > 0)) throw new Error('Informe a quantidade usada para baixar do estoque.');
      const produtoNome = p ? p.nome : (fd.produtoNome||'').trim();
      if (!produtoNome && !['Observação sanitária','Controle sanitário'].includes(fd.tipo)) throw new Error('Informe o produto (do estoque ou descrição livre).');
      const id = novoId('manejos'); let estoqueMovId = null, custo = null, eventoId = null;
      const atv = ESPECIES[fd.especie].atividade;
      if (p) { const r = await baixarEstoque({ produtoId:p.id, qtd, data, atividade:atv, alvo:fd.alvo, origem:'manejo', refId:id, obs:`${fd.tipo} – ${alvoTxt(fd.alvo)}`, autorizar:!!fd.autorizar }); estoqueMovId = r.mid; custo = r.custo; }
      if (fd.proxima) {
        if (fd.proxima <= data) throw new Error('A próxima aplicação deve ser depois da data do manejo.');
        eventoId = novoId('eventos');
        await dbSet('eventos', eventoId, { titulo:`${fd.tipo}: ${produtoNome||''} – ${alvoTxt(fd.alvo)}`, tipo:MANEJO_EVENTO[fd.tipo]||'Medicamento', data:fd.proxima, hora:'', atividade:atv, alvo:fd.alvo, responsavel:(fd.responsavel||'').trim(), obs:'Gerado pelo manejo de '+D(data), lembreteDias:2, concluido:false, origem:'manejo', refId:id });
      }
      await dbSet('manejos', id, { data, tipo:fd.tipo, especie:fd.especie, alvo:fd.alvo, cabecas:cabecasAlvo(fd.alvo), produtoId:p?p.id:null, produtoNome, qtd:qtd||null, unidade:p?p.unidade:'', custo, dose:(fd.dose||'').trim(),
        responsavel:(fd.responsavel||'').trim(), carencia:num(fd.carencia)||null, fimCarencia: num(fd.carencia) ? addDias(data, num(fd.carencia)) : null, proxima:fd.proxima||null, obs:(fd.obs||'').trim(), estoqueMovId, eventoId });
      await audit('manejo','manejos',id,`${fd.tipo} ${alvoTxt(fd.alvo)}`);
      toast('Manejo registrado.' + (p ? ' Estoque baixado.' : '') + (eventoId ? ' Próxima aplicação no calendário.' : ''));
    } });
}
function addDias(iso, n){ const d = new Date(iso+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+Math.round(n)); return d.toISOString().slice(0,10); }
async function excluirManejo(m){
  if (!(await confirmar(`Excluir o manejo “${esc(m.tipo)}” de ${D(m.data)}?${m.estoqueMovId?' A baixa de estoque será devolvida.':''}${m.eventoId?' O lembrete da próxima aplicação também sai do calendário.':''}`, 'Excluir'))) return;
  try { exigeEscrita(); await dbUpd('manejos', m.id, { excluido:true, excluidoEm:stamp() });
    if (m.estoqueMovId) await dbUpd('estoqueMovs', m.estoqueMovId, { excluido:true, excluidoEm:stamp() });
    if (m.eventoId && byId('eventos', m.eventoId)) await dbUpd('eventos', m.eventoId, { excluido:true, excluidoEm:stamp() });
    await audit('excluir','manejos',m.id,m.tipo); toast('Manejo excluído.'); } catch(e){ falha(e); }
}
function manejosDoAlvo(tipo, id){
  const a = tipo === 'A' ? byId('animais', id) : byId('lotes', id);
  return A('manejos').filter(m => m.alvo === tipo+':'+id || (a && m.alvo === 'T:'+a.especie && m.data >= (a.dataEntrada||'') && (!a.dataSaida || m.data <= a.dataSaida))).sort((x,y)=>(y.data||'').localeCompare(x.data||''));
}
function tabelaManejos(M, compacta=false){
  if (!M.length) return `<div class="tw">${vazio('Nenhum manejo registrado')}</div>`;
  return `<div class="tw"><table><thead><tr><th>Data</th><th>Tipo</th>${compacta?'':'<th>Espécie</th><th>Aplicado em</th>'}<th>Produto</th><th class="n">Qtd</th><th>Dose</th><th class="n">Custo</th><th>Carência até</th><th>Próxima</th><th>Responsável</th>${compacta?'':'<th></th>'}</tr></thead><tbody>
    ${M.slice(0,400).map(m => `<tr><td>${D(m.data)}</td><td><b>${esc(m.tipo)}</b>${m.obs?`<div class="small muted">${esc(m.obs)}</div>`:''}</td>${compacta?'':`<td>${esc(ESPECIES[m.especie]?.nome||'')}</td><td>${esc(alvoTxt(m.alvo))} <span class="small muted">(${N(m.cabecas)} cab.)</span></td>`}
      <td>${esc(m.produtoNome||'—')}</td><td class="n">${m.qtd?N(m.qtd,2)+' '+esc(m.unidade||''):''}</td><td>${esc(m.dose||'')}</td><td class="n">${m.custo?R(m.custo):''}</td>
      <td>${m.fimCarencia?`${D(m.fimCarencia)}${m.fimCarencia>=hoje()?' <span class="badge b-pend">em carência</span>':''}`:''}</td><td>${D(m.proxima)}</td><td>${esc(m.responsavel||'')}</td>
      ${compacta?'':`<td><div class="acts"><button class="ico" data-act="delManejo" data-id="${m.id}">Excluir</button></div></td>`}</tr>`).join('')}</tbody></table></div>`;
}
function pgManejo(){
  const [ini, fim] = periodo('mj'); const esp = uiGet('mjEsp',''), tipo = uiGet('mjTipo','');
  const M = A('manejos').filter(m => inRange(m.data, ini, fim) && (!esp || m.especie === esp) && (!tipo || m.tipo === tipo)).sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  const prox = A('eventos').filter(e => e.origem === 'manejo' && !e.concluido && e.data >= hoje() && e.data <= addDias(hoje(), 30)).sort((a,b)=>a.data.localeCompare(b.data));
  const carencia = A('manejos').filter(m => m.fimCarencia && m.fimCarencia >= hoje());
  return `<div class="grid g4" style="margin-bottom:14px">${kpi('Manejos no período', N(M.length), '', 'gold')}${kpi('Custo de insumos', R(sum(M,m=>m.custo)), 'baixados do estoque', 'red')}
      ${kpi('Próximas aplicações', N(prox.length), 'próximos 30 dias', 'blue')}${kpi('Em carência', N(carencia.length), 'não vender/abater', carencia.length?'red':'green')}</div>
    ${prox.length ? `<div class="alerts" style="margin-bottom:14px">${prox.slice(0,6).map(e=>`<div>${D(e.data)} · ${esc(e.titulo)}</div>`).join('')}</div>` : ''}
    <div class="bar"><button class="btn primary" data-act="novoManejo">+ Registrar manejo</button>
      <button class="btn ghost" data-act="novoManejoTipo" data-tipo="Vacinação">Vacinação</button><button class="btn ghost" data-act="novoManejoTipo" data-tipo="Vermifugação">Vermifugação</button>
      <button class="btn ghost" data-act="novoManejoTipo" data-tipo="Medicamento">Medicamento</button><button class="btn ghost" data-act="novoManejoTipo" data-tipo="Ração / alimentação">Alimentação</button></div>
    <div class="bar">${filtroPeriodo('mj')}<label class="fld"><span>Espécie</span><select data-filter="mjEsp">${opts(Object.entries(ESPECIES).map(([k,v])=>[k,v.nome]), esp, 'Todas')}</select></label>
      <label class="fld"><span>Tipo</span><select data-filter="mjTipo">${opts(TIPOS_MANEJO, tipo, 'Todos')}</select></label><button class="btn ghost" data-act="expManejos">Exportar Excel</button></div>
    ${tabelaManejos(M)}
    <p class="small muted">Pesagens com ganho médio diário são feitas na ficha de cada animal (Bovinos › Ficha › Pesagem).</p>`;
}

/* ---------------- REPRODUÇÃO ---------------- */
const GESTACAO = { bovino:283, suino:114 };
const DESMAME_DIAS = { bovino:210, suino:28 };
const ST_REPRO = { coberta:['b-par','Coberta'], gestante:['b-ok','Gestante'], vazia:['b-mut','Vazia'], parida:['b-ok','Parida'], desmamada:['b-mut','Desmamada'], aborto:['b-err','Aborto'] };
function matrizesOpts(esp){
  const o = indAtivos(esp).filter(a => a.sexo === 'Fêmea').map(a => ['A:'+a.id, `${a.ident}${a.nome?' – '+a.nome:''} · ${a.categoria}`]);
  if (esp === 'suino') for (const l of lotesAtivos('suino').filter(l => ['Matriz','Leitoa'].includes(l.categoria))) o.push(['L:'+l.id, `Lote ${l.codigo} · ${l.categoria}`]);
  return o;
}
function reprodutoresOpts(esp){ return indAtivos(esp).filter(a => a.sexo === 'Macho').map(a => [a.ident, `${a.ident}${a.nome?' – '+a.nome:''} · ${a.categoria}`]); }
function abrirCobertura(esp){
  const ms = matrizesOpts(esp);
  modal({ title:`Registrar cobertura · ${ESPECIES[esp].nome}`, submit:'Registrar',
    html:`<div class="fg"><label class="fld"><span>Matriz *</span><select name="matriz">${opts(ms, '', ms.length ? 'Selecione…' : (esp==='suino' ? 'Cadastre matrizes no Plantel individual (ou lote categoria Matriz)' : 'Nenhuma fêmea ativa cadastrada'))}</select></label>
      ${fInp('reprodutor', esp==='bovino'?'Touro / sêmen':'Cachaço / reprodutor','', 'list="dl-repr"')}
      ${fDate('dataCob','Data da cobertura')}${fSel('tipoCob','Tipo', ['Monta natural','Inseminação artificial'], 'Monta natural')}
      ${fTxt('obs','Observações','')}</div>
      <datalist id="dl-repr">${reprodutoresOpts(esp).map(r=>`<option value="${esc(r[0])}">${esc(r[1])}</option>`).join('')}</datalist>
      <p class="small muted">Previsão de parto: cobertura + ${GESTACAO[esp]} dias. O parto previsto entra automaticamente no calendário.</p>`,
    async onSubmit(fd){ exigeEscrita();
      if (!fd.matriz) throw new Error('Selecione a matriz.'); const dataCob = reqData(fd.dataCob, 'a data da cobertura');
      const mt = fd.matriz.slice(0,1), mid_ = fd.matriz.slice(2);
      const nome = mt === 'A' ? byId('animais', mid_).ident : 'Lote ' + byId('lotes', mid_).codigo;
      if (A('reproducoes').some(r => r.matriz === fd.matriz && ['coberta','gestante'].includes(r.status))) {
        if (!(await confirmar(`${esc(nome)} já tem uma cobertura em andamento. Registrar nova cobertura mesmo assim?`, 'Registrar', false))) return false;
      }
      const prev = addDias(dataCob, GESTACAO[esp]); const id = novoId('reproducoes'), ev = novoId('eventos');
      await dbSet('eventos', ev, { titulo:`Previsão de parto: ${nome}`, tipo:'Previsão de parto', data:prev, hora:'', atividade:ESPECIES[esp].atividade, alvo:fd.matriz, responsavel:'', obs:`Cobertura em ${D(dataCob)}`, lembreteDias:7, concluido:false, origem:'reproducao', refId:id });
      await dbSet('reproducoes', id, { especie:esp, matriz:fd.matriz, matrizNome:nome, reprodutor:(fd.reprodutor||'').trim(), tipoCob:fd.tipoCob, dataCob, prevParto:prev, status:'coberta', obs:(fd.obs||'').trim(), eventoPartoId:ev });
      await audit('cobertura','reproducoes',id,nome); toast(`Cobertura registrada. Parto previsto para ${D(prev)}.`);
    } });
}
function abrirDiagnostico(r){
  modal({ title:`Diagnóstico de gestação · ${r.matrizNome}`, submit:'Salvar',
    html:`<div class="fg">${fDate('data','Data do diagnóstico')}${fSel('resultado','Resultado', [['positivo','Positivo (gestante)'],['negativo','Negativo (vazia)']], 'positivo')}${fTxt('obs','Observações','')}</div>`,
    async onSubmit(fd){ exigeEscrita(); const pos = fd.resultado === 'positivo';
      await dbUpd('reproducoes', r.id, { diag:{ data:reqData(fd.data), resultado:fd.resultado, obs:(fd.obs||'').trim() }, status: pos ? 'gestante' : 'vazia' });
      if (!pos && r.eventoPartoId && byId('eventos', r.eventoPartoId)) await dbUpd('eventos', r.eventoPartoId, { excluido:true, excluidoEm:stamp() });
      toast('Diagnóstico registrado.'); } });
}
function abrirParto(r){
  const esp = r.especie;
  modal({ title:`Registrar parto · ${r.matrizNome}`, submit:'Registrar parto',
    html:`<div class="fg">${fDate('data','Data efetiva do parto')}
      ${esp === 'suino' ? `${fNum('vivos','Nascidos vivos *','')}${fNum('mortos','Nascidos mortos','')}${fInp('codigo','Lote da leitegada', proximoCodigo('suino'))}${fNum('pesoMedio','Peso médio ao nascer (kg)','')}${fInp('local','Baia / maternidade','')}`
      : `${fSel('resultado','Resultado', [['vivo','Bezerro vivo'],['morto','Natimorto']], 'vivo')}${fSel('sexo','Sexo do bezerro', ['Fêmea','Macho'], 'Fêmea')}${fInp('ident','Identificação (brinco) do bezerro *','')}${fNum('peso','Peso ao nascer (kg)','')}${fInp('local','Lote / pastagem', (byId('animais', r.matriz.slice(2))||{}).local||'')}`}
      ${fTxt('obs','Observações','')}</div>
      <p class="small muted">${esp==='suino' ? 'Cria automaticamente o lote da leitegada com os nascidos vivos e agenda o desmame no calendário.' : 'Cadastra automaticamente o bezerro (origem nascimento, com a mãe) e agenda o desmame no calendário.'}</p>`,
    async onSubmit(fd){ exigeEscrita(); const data = reqData(fd.data);
      const parto = { data, obs:(fd.obs||'').trim() }; let evDesmame = null;
      if (esp === 'suino') {
        const vivos = Math.round(num(fd.vivos)), mortos = Math.round(num(fd.mortos));
        if (vivos < 0 || (vivos + mortos) <= 0) throw new Error('Informe os nascidos vivos e/ou mortos.');
        parto.vivos = vivos; parto.mortos = mortos; parto.total = vivos + mortos;
        if (vivos > 0) {
          const codigo = reqTxt(fd.codigo, 'o código do lote');
          if (A('lotes').some(x => x.especie === 'suino' && x.codigo.toLowerCase() === codigo.toLowerCase())) throw new Error('Já existe um lote com esse código.');
          const loteId = novoId('lotes');
          await dbSet('lotes', loteId, { especie:'suino', codigo, categoria:'Leitão recém-nascido', raca:'', nascimento:data, local:(fd.local||'').trim(), pesoMedio:num(fd.pesoMedio)||null, qtdInicial:vivos, origem:'nascimento', dataEntrada:data, matriz:r.matrizNome, reproducaoId:r.id, situacao:'ativo', obs:'Leitegada de '+r.matrizNome });
          await criarMov({ especie:'suino', tipo:'nascimento', data, loteId, delta:vivos, qtd:vivos, cadastro:true, obs:`Leitegada de ${r.matrizNome}${mortos?` · ${mortos} nascido(s) morto(s)`:''}` });
          parto.loteId = loteId;
        }
      } else {
        parto.resultado = fd.resultado; parto.sexo = fd.sexo;
        if (fd.resultado === 'vivo') {
          const ident = reqTxt(fd.ident, 'a identificação do bezerro');
          if (indAtivos('bovino').some(a => a.ident.toLowerCase() === ident.toLowerCase())) throw new Error('Já existe bovino ativo com essa identificação.');
          const aid = novoId('animais'), peso = num(fd.peso) || null;
          await dbSet('animais', aid, { especie:'bovino', ident, nome:'', raca:(byId('animais', r.matriz.slice(2))||{}).raca||'', sexo:fd.sexo, nascimento:data, categoria: fd.sexo === 'Macho' ? 'Bezerro' : 'Bezerra', pesoInicial:peso, pesoAtual:peso, dataPeso:peso?data:null, local:(fd.local||'').trim(), mae:r.matrizNome, pai:r.reprodutor||'', obs:'', origem:'nascimento', dataEntrada:data, valorAquisicao:null, situacao:'ativo', reproducaoId:r.id });
          await criarMov({ especie:'bovino', tipo:'nascimento', data, animalIds:[aid], qtd:1, peso, cadastro:true, obs:'Filho(a) de '+r.matrizNome });
          parto.animalId = aid; parto.ident = ident; parto.peso = peso;
        }
      }
      if ((esp === 'suino' && parto.loteId) || (esp === 'bovino' && parto.animalId)) {
        evDesmame = novoId('eventos');
        await dbSet('eventos', evDesmame, { titulo:`Desmame previsto: ${esp==='suino' ? 'leitegada '+(byId('lotes',parto.loteId)||{}).codigo : 'bezerro '+parto.ident} (${r.matrizNome})`, tipo:'Desmame', data:addDias(data, DESMAME_DIAS[esp]), hora:'',
          atividade:ESPECIES[esp].atividade, alvo: parto.loteId ? 'L:'+parto.loteId : 'A:'+parto.animalId, responsavel:'', obs:'', lembreteDias:3, concluido:false, origem:'reproducao', refId:r.id });
      }
      await dbUpd('reproducoes', r.id, { parto, status:'parida', eventoDesmameId:evDesmame });
      if (r.eventoPartoId && byId('eventos', r.eventoPartoId)) await dbUpd('eventos', r.eventoPartoId, { concluido:true, concluidoEm:stamp() });
      await audit('parto','reproducoes',r.id,r.matrizNome);
      toast('Parto registrado.' + (evDesmame ? ' Desmame agendado no calendário.' : ''));
    } });
}
function abrirDesmameRepro(r){
  const esp = r.especie, loteId = r.parto && r.parto.loteId, saldo = loteId ? saldoLote(loteId) : 1;
  modal({ title:`Registrar desmame · ${r.matrizNome}`, submit:'Registrar desmame',
    html:`<div class="fg">${fDate('data','Data do desmame')}${esp==='suino' ? fNum('qtd','Quantidade desmamada *', saldo) : ''}${fNum('pesoMedio', esp==='suino'?'Peso médio no desmame (kg)':'Peso do bezerro no desmame (kg)','')}
      ${esp==='suino' ? `<label class="fld full" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" name="lancarMort" checked style="width:auto"> Lançar a diferença (saldo atual ${saldo} − desmamados) como mortalidade na maternidade</label>` : ''}${fTxt('obs','Observações','')}</div>`,
    async onSubmit(fd){ exigeEscrita(); const data = reqData(fd.data), pm = num(fd.pesoMedio) || null; let qtd = 1;
      if (esp === 'suino') {
        if (!loteId || !byId('lotes', loteId)) throw new Error('A leitegada não tem lote vinculado.');
        qtd = Math.round(reqPos(fd.qtd, 'a quantidade desmamada'));
        if (qtd > saldo) throw new Error(`Quantidade maior que o saldo do lote (${saldo}).`);
        if (fd.lancarMort && saldo - qtd > 0) await criarMov({ especie:'suino', tipo:'mortalidade', data, loteId, delta:-(saldo-qtd), qtd:saldo-qtd, causa:'Mortalidade na maternidade (até o desmame)' });
        const l = byId('lotes', loteId);
        await criarMov({ especie:'suino', tipo:'desmame', data, loteId, delta:0, qtd, pesoMedio:pm, de:l.categoria, para:'Leitão desmamado', obs:'Leitegada de '+r.matrizNome });
        await dbUpd('lotes', loteId, { categoria:'Leitão desmamado', pesoMedio:pm||l.pesoMedio||null, dataDesmame:data, qtdDesmamada:qtd });
      } else if (r.parto && r.parto.animalId && pm) {
        const a = byId('animais', r.parto.animalId);
        if (a) { await criarMov({ especie:'bovino', tipo:'pesagem', data, animalIds:[a.id], qtd:1, peso:pm, pesoAnterior:a.pesoAtual||null, dataAnterior:a.dataPeso||a.dataEntrada, gmd: a.pesoAtual && diasEntre(a.dataPeso||a.dataEntrada, data) > 0 ? Math.round((pm-a.pesoAtual)/diasEntre(a.dataPeso||a.dataEntrada, data)*1000)/1000 : null, obs:'Pesagem no desmame' });
          await dbUpd('animais', a.id, { pesoAtual:pm, dataPeso:data }); }
      }
      await dbUpd('reproducoes', r.id, { desmame:{ data, qtd, pesoMedio:pm, obs:(fd.obs||'').trim() }, status:'desmamada' });
      if (r.eventoDesmameId && byId('eventos', r.eventoDesmameId)) await dbUpd('eventos', r.eventoDesmameId, { concluido:true, concluidoEm:stamp() });
      toast('Desmame registrado.'); } });
}
function abrirAborto(r){
  modal({ title:`Registrar aborto · ${r.matrizNome}`, submit:'Registrar',
    html:`<div class="fg">${fDate('data','Data')}${fTxt('obs','Observações / causa provável','')}</div>`,
    async onSubmit(fd){ exigeEscrita(); await dbUpd('reproducoes', r.id, { aborto:{ data:reqData(fd.data), obs:(fd.obs||'').trim() }, status:'aborto' });
      if (r.eventoPartoId && byId('eventos', r.eventoPartoId)) await dbUpd('eventos', r.eventoPartoId, { excluido:true, excluidoEm:stamp() });
      toast('Aborto registrado.'); } });
}
async function excluirRepro(r){
  if (!(await confirmar(`Excluir o registro reprodutivo de ${esc(r.matrizNome)} (cobertura ${D(r.dataCob)})?` + (r.parto ? '<br><br>O bezerro/leitegada já cadastrado continua no sistema; se precisar, estorne-o no módulo do animal.' : ''), 'Excluir'))) return;
  try { exigeEscrita(); await dbUpd('reproducoes', r.id, { excluido:true, excluidoEm:stamp() });
    for (const ev of [r.eventoPartoId, r.eventoDesmameId]) if (ev && byId('eventos', ev) && !byId('eventos', ev).concluido) await dbUpd('eventos', ev, { excluido:true, excluidoEm:stamp() });
    await audit('excluir','reproducoes',r.id,r.matrizNome); toast('Registro excluído.'); } catch(e){ falha(e); }
}
function pgReproducao(){
  const esp = uiGet('rpEsp','bovino'); const mat = uiGet('rpMat','');
  const all = A('reproducoes').filter(r => r.especie === esp);
  const R_ = all.filter(r => !mat || r.matriz === mat).sort((a,b)=>(b.dataCob||'').localeCompare(a.dataCob||''));
  const ano = hoje().slice(0,4);
  const gest = all.filter(r => ['coberta','gestante'].includes(r.status));
  const prox = gest.filter(r => r.prevParto <= addDias(hoje(), 30));
  const partosAno = all.filter(r => r.parto && r.parto.data.startsWith(ano));
  const diag = all.filter(r => r.diag); const pos = diag.filter(r => r.diag.resultado === 'positivo');
  let extra = '';
  if (esp === 'suino') {
    const vivos = sum(partosAno, r => r.parto.vivos), mortos = sum(partosAno, r => r.parto.mortos);
    const desm = all.filter(r => r.desmame && r.desmame.data.startsWith(ano)); const vivosD = sum(desm, r => r.parto.vivos), desmQ = sum(desm, r => r.desmame.qtd);
    extra = kpi('Nascidos vivos no ano', N(vivos), `${N(mortos)} mortos · média ${partosAno.length?N(vivos/partosAno.length,1):'—'}/parto`, 'green') + kpi('Mortalidade até desmame', vivosD ? N((vivosD-desmQ)/vivosD*100,1)+'%' : '—', `${N(desmQ)} desmamados`, 'red');
  } else {
    extra = kpi('Bezerros nascidos no ano', N(partosAno.filter(r=>r.parto.resultado==='vivo').length), '', 'green') + kpi('Abortos', N(all.filter(r=>r.status==='aborto').length), 'histórico', 'red');
  }
  return `<div class="bar"><div class="chips">${Object.entries({bovino:'Bovinos', suino:'Suínos'}).map(([k,v]) => `<button class="chip ${esp===k?'on':''}" data-act="setf" data-k="rpEsp" data-v="${k}">${v}</button>`).join('')}</div></div>
    <div class="grid g5" style="margin-bottom:14px">${kpi('Em gestação', N(gest.length), 'cobertas + gestantes', 'gold')}${kpi('Partos nos próximos 30 dias', N(prox.length), '', 'blue')}
      ${kpi('Taxa de prenhez', diag.length ? N(pos.length/diag.length*100,0)+'%' : '—', `${pos.length}/${diag.length} diagnósticos`)}${extra}</div>
    ${prox.length ? `<div class="alerts" style="margin-bottom:14px">${prox.sort((a,b)=>a.prevParto.localeCompare(b.prevParto)).map(r=>`<div>Parto previsto ${D(r.prevParto)} · ${esc(r.matrizNome)}</div>`).join('')}</div>` : ''}
    <div class="bar"><button class="btn primary" data-act="novaCobertura" data-esp="${esp}">+ Registrar cobertura</button>
      <label class="fld"><span>Histórico da matriz</span><select data-filter="rpMat">${opts([...new Set(all.map(r=>r.matriz))].map(m => [m, (all.find(r=>r.matriz===m)||{}).matrizNome]), mat, 'Todas as matrizes')}</select></label></div>
    ${R_.length ? `<div class="tw"><table><thead><tr><th>Matriz</th><th>Cobertura</th><th>Reprodutor</th><th>Diagnóstico</th><th>Previsão do parto</th><th>Situação</th><th>Parto</th><th>${esp==='suino'?'Vivos / mortos':'Cria'}</th><th>Desmame</th><th></th></tr></thead><tbody>
      ${R_.map(r => { const st = ST_REPRO[r.status] || ['b-mut', r.status]; const aberto = ['coberta','gestante'].includes(r.status);
        return `<tr><td><b>${esc(r.matrizNome)}</b></td><td>${D(r.dataCob)}<div class="small muted">${esc(r.tipoCob||'')}</div></td><td>${esc(r.reprodutor||'—')}</td>
          <td>${r.diag ? `${D(r.diag.data)} · ${r.diag.resultado==='positivo'?'positivo':'negativo'}` : '—'}</td><td>${D(r.prevParto)}${aberto && r.prevParto < hoje() ? ' <span class="badge b-err">atrasado</span>' : ''}</td>
          <td><span class="badge ${st[0]}">${st[1]}</span></td><td>${r.parto?D(r.parto.data):r.aborto?'Aborto '+D(r.aborto.data):'—'}</td>
          <td>${r.parto ? (esp==='suino' ? `${N(r.parto.vivos)} / ${N(r.parto.mortos)}${r.parto.loteId?` <span class="small muted">lote ${esc((byId('lotes',r.parto.loteId)||{}).codigo||'')}</span>`:''}` : (r.parto.resultado==='vivo' ? `${esc(r.parto.ident)} (${esc(r.parto.sexo)})` : 'natimorto')) : '—'}</td>
          <td>${r.desmame ? `${D(r.desmame.data)}${esp==='suino'?` · ${N(r.desmame.qtd)} cab.`:''}${r.desmame.pesoMedio?` · ${N(r.desmame.pesoMedio,1)} kg`:''}` : '—'}</td>
          <td><div class="acts">${aberto && !r.diag ? `<button class="ico" data-act="rpDiag" data-id="${r.id}">Diagnóstico</button>` : ''}${aberto ? `<button class="ico" data-act="rpParto" data-id="${r.id}">Parto</button><button class="ico" data-act="rpAborto" data-id="${r.id}">Aborto</button>` : ''}
            ${r.status === 'parida' ? `<button class="ico" data-act="rpDesmame" data-id="${r.id}">Desmame</button>` : ''}<button class="ico" data-act="rpDel" data-id="${r.id}">✕</button></div></td></tr>`; }).join('')}
      </tbody></table></div>` : `<div class="tw">${vazio('Nenhum registro reprodutivo', esp==='suino' ? 'Cadastre as matrizes (fêmeas) no Plantel individual de Suínos e registre as coberturas aqui.' : 'Registre a cobertura das vacas e novilhas.')}</div>`}`;
}

/* ---------------- CALENDÁRIO ---------------- */
const TIPOS_EVENTO = {
  'Compromisso':'#1f3d2b', 'Cobertura':'#7a5ea8', 'Previsão de parto':'#c4462e', 'Nascimento':'#1a7f4b', 'Desmame':'#a8780a',
  'Vacinação':'#2d6cc8', 'Vermifugação':'#14857f', 'Medicamento':'#b5487a', 'Pesagem':'#6b7a3a', 'Compra de animais':'#5c6670',
  'Venda programada':'#2a5139', 'Limpeza':'#8b939b', 'Manutenção':'#8a6a3a', 'Reposição de estoque':'#5b7fa3', 'Outro':'#9aa19c'
};
const DIAS_SEM = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MESES_LONGOS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const corEv = t => TIPOS_EVENTO[t] || '#9aa19c';
function eventosFiltrados(){
  const atv = uiGet('calAtv',''), tipo = uiGet('calTipo','');
  return A('eventos').filter(e => (!atv || e.atividade === atv) && (!tipo || e.tipo === tipo));
}
const evDoDia = (E, d) => E.filter(e => e.data === d).sort((a,b) => (a.concluido - b.concluido) || (a.hora||'99').localeCompare(b.hora||'99'));
function inicioSemana(iso){ const d = new Date(iso+'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.toISOString().slice(0,10); }
function chipEv(e, cheio=false){
  const atras = !e.concluido && e.data < hoje();
  return `<div class="evchip ${e.concluido?'done':''} ${atras?'late':''}" style="--c:${corEv(e.tipo)}" data-act="calEv" data-id="${e.id}" title="${esc(e.tipo+': '+e.titulo)}">${e.hora?`<b>${esc(e.hora)}</b> `:''}${esc(cheio ? e.titulo : e.titulo)}${cheio?`<span class="evtipo">${esc(e.tipo)}${e.responsavel?' · '+esc(e.responsavel):''}</span>`:''}</div>`;
}
function pgCalendario(){
  const ref = uiGet('calRef', hoje()), view = uiGet('calView', 'mes');
  const E = eventosFiltrados();
  const hj = hoje();
  let titulo = '', grade = '';
  if (view === 'mes') {
    const y = +ref.slice(0,4), m = +ref.slice(5,7);
    titulo = `${MESES_LONGOS[m-1]} ${y}`;
    const ini = inicioSemana(`${y}-${String(m).padStart(2,'0')}-01`);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = addDias(ini, i); if (i >= 35 && d.slice(5,7) !== String(m).padStart(2,'0')) break;
      const ev = evDoDia(E, d), fora = d.slice(5,7) !== String(m).padStart(2,'0');
      cells.push(`<div class="calcell ${fora?'fora':''} ${d===hj?'hoje':''}" data-act="calDia" data-d="${d}">
        <div class="calnum"><span>${+d.slice(8)}</span>${ev.length?`<i class="calcount">${ev.length}</i>`:''}</div>
        <div class="calevs">${ev.slice(0,3).map(e => chipEv(e)).join('')}${ev.length>3?`<div class="calmais">+${ev.length-3} mais</div>`:''}</div>
        <div class="caldots">${ev.slice(0,5).map(e=>`<i style="background:${corEv(e.tipo)}"></i>`).join('')}</div></div>`);
    }
    grade = `<div class="calgrid">${DIAS_SEM.map(d=>`<div class="calhead">${d}</div>`).join('')}${cells.join('')}</div>`;
  } else if (view === 'semana') {
    const ini = inicioSemana(ref); const fim = addDias(ini, 6);
    titulo = `${D(ini)} a ${D(fim)}`;
    grade = `<div class="calweek">${Array.from({length:7}, (_,i) => { const d = addDias(ini, i), ev = evDoDia(E, d);
      return `<div class="calwcol ${d===hj?'hoje':''}"><div class="calwhead" data-act="calDia" data-d="${d}"><span>${DIAS_SEM[i]}</span><b>${+d.slice(8)}</b></div>
        <div class="calwbody" data-act="calDia" data-d="${d}">${ev.map(e => chipEv(e, true)).join('') || '<div class="muted small" style="padding:6px">—</div>'}</div></div>`; }).join('')}</div>`;
  } else {
    titulo = `${DIAS_SEM[new Date(ref+'T12:00:00Z').getUTCDay()]}, ${D(ref)}`;
    const ev = evDoDia(E, ref);
    grade = `<div class="card">${ev.length ? ev.map(e => linhaEvento(e)).join('') : vazio('Nenhum compromisso neste dia', 'Clique em “+ Novo compromisso” para incluir.')}
      <div style="margin-top:12px"><button class="btn primary sm" data-act="calNovo" data-d="${ref}">+ Novo compromisso neste dia</button></div></div>`;
  }
  const atrasados = A('eventos').filter(e => !e.concluido && e.data < hj).sort((a,b)=>a.data.localeCompare(b.data));
  const proximos = A('eventos').filter(e => !e.concluido && e.data >= hj && e.data <= addDias(hj, 7)).sort((a,b)=>a.data.localeCompare(b.data)||(a.hora||'').localeCompare(b.hora||''));
  return `<div class="calwrap"><div class="calmain card" style="padding:14px">
      <div class="caltop"><div class="calnav"><button class="btn ghost sm" data-act="calNav" data-n="-1" aria-label="Anterior">‹</button><button class="btn ghost sm" data-act="calHoje">Hoje</button><button class="btn ghost sm" data-act="calNav" data-n="1" aria-label="Próximo">›</button></div>
        <h2 class="caltit">${esc(titulo)}</h2>
        <div class="toggle calviews">${[['mes','Mês'],['semana','Semana'],['dia','Dia']].map(([k,t]) => `<label class="${view===k?'on':''}" data-act="setf" data-k="calView" data-v="${k}">${t}</label>`).join('')}</div></div>
      <div class="bar" style="margin:10px 0"><button class="btn primary" data-act="calNovo" data-d="${view==='mes'&&ref.slice(0,7)!==hj.slice(0,7)?ref:hj}">+ Novo compromisso</button>
        <label class="fld"><span>Atividade</span><select data-filter="calAtv">${opts(Object.entries(ATIVIDADES), uiGet('calAtv',''), 'Todas')}</select></label>
        <label class="fld"><span>Tipo</span><select data-filter="calTipo">${opts(Object.keys(TIPOS_EVENTO), uiGet('calTipo',''), 'Todos')}</select></label></div>
      ${grade}
      <div class="legend">${Object.entries(TIPOS_EVENTO).map(([t,c]) => `<span><span class="dot" style="background:${c}"></span>${t}</span>`).join('')}</div></div>
    <aside class="calside">
      <div class="card"><h3>Atrasados <span class="badge ${atrasados.length?'b-err':'b-ok'}" style="font-family:Inter;letter-spacing:0">${atrasados.length}</span></h3>${atrasados.length ? atrasados.slice(0,12).map(e => linhaEvento(e, true)).join('') : '<p class="muted small" style="margin:0">Nada atrasado.</p>'}</div>
      <div class="card"><h3>Próximos 7 dias</h3>${proximos.length ? proximos.slice(0,15).map(e => linhaEvento(e, true)).join('') : '<p class="muted small" style="margin:0">Nenhum compromisso.</p>'}</div>
    </aside></div>`;
}
function linhaEvento(e, comData=false){
  const atras = !e.concluido && e.data < hoje();
  return `<div class="evrow ${e.concluido?'done':''}" style="--c:${corEv(e.tipo)}">
    <button class="evcheck ${e.concluido?'on':''}" data-act="calToggle" data-id="${e.id}" title="${e.concluido?'Reabrir':'Marcar como concluído'}" aria-label="Concluir">${e.concluido?'✓':''}</button>
    <div class="evinfo" data-act="calEv" data-id="${e.id}"><div class="evt">${esc(e.titulo)}</div>
      <div class="evm">${comData?`<b class="${atras?'neg':''}">${D(e.data)}</b> · `:''}${e.hora?esc(e.hora)+' · ':''}<span class="dot" style="background:${corEv(e.tipo)}"></span>${esc(e.tipo)}${e.atividade?' · '+esc(ATIVIDADES[e.atividade]||''):''}${e.responsavel?' · '+esc(e.responsavel):''}</div></div>
    <button class="ico" data-act="calDel" data-id="${e.id}" title="Excluir" aria-label="Excluir">✕</button></div>`;
}
function abrirDia(d){
  const ev = evDoDia(A('eventos'), d);
  const rapidos = ['Desmame','Medicamento','Vacinação','Vermifugação','Pesagem','Cobertura','Compromisso'];
  modal({ title:`${DIAS_SEM[new Date(d+'T12:00:00Z').getUTCDay()]}, ${D(d)}`, wide:true,
    html:`<div class="daylist">${ev.length ? ev.map(e => linhaEvento(e)).join('') : '<p class="muted" style="margin:0 0 6px">Nenhum compromisso neste dia.</p>'}</div>
      <h4 style="font-size:16px;color:var(--verde);margin:16px 0 8px">Incluir neste dia</h4>
      <div class="chips">${rapidos.map(t => `<button type="button" class="chip" data-act="calNovo" data-d="${d}" data-tipo="${t}"><span class="dot" style="background:${corEv(t)}"></span>${t}</button>`).join('')}</div>`,
  });
}
function abrirEvento(d, edit = null, tipo0){
  const e = edit || {};
  const tipo = e.tipo || tipo0 || 'Compromisso';
  modal({ title: edit ? 'Editar compromisso' : `Novo compromisso · ${D(d)}`, submit: edit ? 'Salvar' : 'Incluir',
    html:`<div class="fg">${fSel('tipo','Tipo', Object.keys(TIPOS_EVENTO), tipo)}${fInp('titulo','Título *', e.titulo || (tipo0 && tipo0 !== 'Compromisso' ? tipo0 + ': ' : ''), 'placeholder="Ex.: Vacinar bezerros contra aftosa"')}
      ${fDate('data','Data', e.data || d)}${fInp('hora','Hora', e.hora||'', '', 'time')}
      ${fSel('atividade','Atividade', Object.entries(ATIVIDADES), e.atividade || '', '', 'Geral / nenhuma')}
      <label class="fld"><span>Lote / animal (opcional)</span><select name="alvo"></select></label>
      ${fInp('responsavel','Responsável', e.responsavel||'')}${fSel('lembreteDias','Lembrete', [['0','No dia'],['1','1 dia antes'],['2','2 dias antes'],['3','3 dias antes'],['7','1 semana antes']], String(e.lembreteDias ?? 1))}
      ${edit ? '' : `${fSel('repetir','Repetir', [['','Não repetir'],['1','Diariamente'],['7','Semanalmente'],['14','A cada 15 dias'],['30','Mensalmente']], '')}${fNum('vezes','Quantas vezes (total)','')}`}
      ${fTxt('obs','Observações', e.obs||'')}</div>
      ${edit && edit.origem ? `<p class="small muted">Gerado automaticamente por ${esc(edit.origem === 'reproducao' ? 'Reprodução' : 'Manejo')}.</p>` : ''}`,
    extraFooter: edit ? `<button type="button" class="btn danger" data-act="calDel" data-id="${edit.id}" style="margin-right:auto">Excluir</button>` : '',
    onInit(form){ const upd = () => { const esp = ATV_ESPECIE[form.elements.atividade.value]; form.elements.alvo.innerHTML = opts(esp ? alvoOpts(esp) : [], e.alvo||'', esp ? 'Nenhum' : '—'); };
      form.elements.atividade.addEventListener('change', upd); upd();
      form.elements.tipo.addEventListener('change', () => { const t = form.elements.titulo; if (!t.value || /^[^:]+: $/.test(t.value)) t.value = form.elements.tipo.value === 'Compromisso' ? '' : form.elements.tipo.value + ': '; }); },
    async onSubmit(fd){ exigeEscrita();
      const titulo = reqTxt((fd.titulo||'').replace(/^[^:]+:\s*$/, ''), 'o título'), data = reqData(fd.data);
      const d_ = { titulo, tipo:fd.tipo, data, hora:fd.hora||'', atividade:fd.atividade||'', alvo:fd.alvo||null, responsavel:(fd.responsavel||'').trim(), lembreteDias:+fd.lembreteDias||0, obs:(fd.obs||'').trim() };
      if (edit) { await dbUpd('eventos', edit.id, d_); toast('Compromisso atualizado.'); return; }
      const passo = +fd.repetir || 0, vezes = passo ? Math.max(1, Math.min(60, Math.round(num(fd.vezes)) || 1)) : 1;
      for (let i = 0; i < vezes; i++) {
        const dt = passo === 30 ? addMeses(data, i) : addDias(data, passo * i);
        await dbSet('eventos', novoId('eventos'), { ...d_, data:dt, titulo: vezes > 1 ? `${titulo} (${i+1}/${vezes})` : titulo, concluido:false, origem:null });
      }
      await audit('agendar','eventos','-',titulo);
      toast(vezes > 1 ? `${vezes} compromissos incluídos.` : 'Compromisso incluído.');
    } });
}
async function toggleEvento(id){
  const e = byId('eventos', id); if (!e) return;
  try { exigeEscrita(); await dbUpd('eventos', id, { concluido:!e.concluido, concluidoEm: e.concluido ? null : stamp() }); toast(e.concluido ? 'Reaberto.' : 'Concluído.');
    refreshDayModal(e.data); } catch(err){ falha(err); }
}
async function excluirEvento(id){
  const e = byId('eventos', id); if (!e) return;
  if (!(await confirmar(`Excluir “${esc(e.titulo)}” de ${D(e.data)}?`, 'Excluir'))) return;
  try { exigeEscrita(); await dbUpd('eventos', id, { excluido:true, excluidoEm:stamp() }); await audit('excluir','eventos',id,e.titulo); toast('Compromisso excluído.');
    $$('#modal-root .mback').forEach(m => { if (!m.querySelector('.daylist')) m.remove(); }); refreshDayModal(e.data); } catch(err){ falha(err); }
}
function refreshDayModal(d){
  setTimeout(() => { const box = $('#modal-root .daylist'); if (!box) return; const ev = evDoDia(A('eventos'), d);
    box.innerHTML = ev.length ? ev.map(e => linhaEvento(e)).join('') : '<p class="muted" style="margin:0 0 6px">Nenhum compromisso neste dia.</p>'; }, 120);
}
function lembretesHoje(){
  const hj = hoje();
  return A('eventos').filter(e => !e.concluido && e.data >= hj && addDias(e.data, -(+e.lembreteDias||0)) <= hj).sort((a,b)=>a.data.localeCompare(b.data));
}
