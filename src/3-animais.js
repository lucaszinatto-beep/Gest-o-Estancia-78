/* =====================================================================
   Animais: cadastro individual, lotes, movimentações, vendas, ovos
   Regra: saldo de lote = soma dos deltas das movimentações válidas;
          animal individual ativo = situacao 'ativo'.
   ===================================================================== */
const movsValidas = () => A('movimentacoes');
function saldoLote(id){
  let s = 0;
  for (const m of movsValidas()) { if (m.loteId === id) s += +m.delta||0; if (m.paraLoteId === id) s += +m.qtdTransf||0; }
  return s;
}
function custoMedioLote(id){
  let ent = 0, custo = 0;
  for (const m of movsValidas()) {
    if (m.loteId === id && (+m.delta||0) > 0) { ent += +m.delta; if (m.tipo === 'compra') custo += +m.valor||0; }
    if (m.paraLoteId === id) { ent += +m.qtdTransf||0; custo += +m.custoTransf||0; }
  }
  return ent ? custo / ent : 0;
}
const indAtivos = esp => A('animais').filter(a => a.especie === esp && a.situacao === 'ativo');
const lotesAtivos = esp => A('lotes').filter(l => l.especie === esp && l.situacao !== 'encerrado');
const cabecas = esp => indAtivos(esp).length + sum(lotesAtivos(esp), l => Math.max(0, saldoLote(l.id)));
const nomeLote = l => l ? `${l.codigo}${l.categoria?' · '+l.categoria:''}` : '—';
const nomeAnimal = a => a ? `${a.ident}${a.nome?' – '+a.nome:''}` : '—';
function movsDoAnimal(id){ return movsValidas().filter(m => (m.animalIds||[]).includes(id)).sort((a,b)=>(b.data||'').localeCompare(a.data||'')||(b.criadoEm||'').localeCompare(a.criadoEm||'')); }
function movsDoLote(id){ return movsValidas().filter(m => m.loteId === id || m.paraLoteId === id).sort((a,b)=>(b.data||'').localeCompare(a.data||'')||(b.criadoEm||'').localeCompare(a.criadoEm||'')); }
const LOCAL_LBL = { bovino:'Lote / pastagem', suino:'Baia / localização', galinha:'Galinheiro' };

async function criarMov(d, id){
  const mid = id || novoId('movimentacoes');
  await dbSet('movimentacoes', mid, d);
  await audit('movimentar', 'movimentacoes', mid, `${MOV_NOMES[d.tipo]||d.tipo} ${ESPECIES[d.especie]?.sing||''} x${d.qtd||''}`);
  return mid;
}

/* Bloco de pagamento reutilizável (compras e vendas) */
function blocoPagamento(tipo, pfx=''){
  const rec = tipo === 'receita';
  return `<div class="fg" style="margin-top:12px">
    ${fSel(pfx+'situacao', rec ? 'Situação do recebimento' : 'Situação do pagamento', rec ? [['quitado','Recebido'],['parcial','Recebido parcialmente'],['pendente','A receber']] : [['quitado','Pago'],['parcial','Pago parcialmente'],['pendente','A pagar']], 'quitado')}
    ${fNum(pfx+'valorParcial', rec ? 'Valor recebido agora (R$)' : 'Valor pago agora (R$)', '', '')}
    ${fSel(pfx+'forma','Forma de pagamento', FORMAS, 'PIX')}
    ${fSel(pfx+'contaId','Conta financeira', contaOpts(), contaPadrao())}
    ${fDate(pfx+'vencimento','Vencimento')}
  </div>`;
}
function wirePagamento(form, pfx=''){
  const sit = form.elements[pfx+'situacao'], parc = form.elements[pfx+'valorParcial'];
  const upd = () => { parc.closest('.fld').style.display = sit.value === 'parcial' ? '' : 'none'; };
  sit.addEventListener('change', upd); upd();
}
function pagoAgoraDe(fd, total, pfx=''){
  const s = fd[pfx+'situacao'];
  if (s === 'quitado') return total;
  if (s === 'parcial') { const v = reqPos(fd[pfx+'valorParcial'], 'o valor pago/recebido agora'); if (v >= total) throw new Error('Valor parcial deve ser menor que o total.'); return v; }
  return 0;
}
function checaConta(fd, pago, pfx=''){ if (pago > 0 && !fd[pfx+'contaId']) throw new Error('Cadastre uma conta financeira em Financeiro › Contas.'); }

/* ---------- Cadastro individual (bovinos e suínos) ---------- */
function abrirAnimal(esp, edit = null){
  const a = edit || {};
  const novo = !edit;
  const html = `<div class="fg">
    ${fInp('ident', esp==='bovino' ? 'Número do brinco *' : 'Identificação (brinco/mossa) *', a.ident||'')}
    ${fInp('nome','Nome ou apelido', a.nome||'')}
    ${fInp('raca','Raça', a.raca||'', 'list="dl-racas"')}
    ${fSel('sexo','Sexo', ['Macho','Fêmea'], a.sexo||'Fêmea')}
    ${fDate('nascimento','Data de nascimento', a.nascimento||'')}
    ${fSel('categoria','Categoria', catsAnimal(esp), a.categoria || (esp==='suino'?'Matriz':'Vaca'))}
    ${fNum('pesoInicial','Peso inicial (kg)', a.pesoInicial||'')}
    ${fInp('local', LOCAL_LBL[esp], a.local||'', 'list="dl-locais-an"')}
    ${fInp('mae','Mãe (identificação)', a.mae||'')}
    ${fInp('pai','Pai / reprodutor', a.pai||'')}
    ${novo ? `${fSel('origem','Origem / entrada', [['compra','Compra'],['nascimento','Nascimento na propriedade'],['entrada','Inventário inicial / já existente']], 'compra')}
      ${fDate('dataEntrada','Data de entrada')}
      ${fNum('valorAquisicao','Valor de aquisição (R$)', '')}
      ${fInp('fornecedor','Fornecedor / origem', '')}` : `<div class="fld full note">Origem: <b>${esc(MOV_NOMES[a.origem]||a.origem)}</b> em ${D(a.dataEntrada)}${a.valorAquisicao?` · ${R(a.valorAquisicao)}`:''}. Para corrigir origem ou valor, estorne a movimentação de entrada.</div>`}
    ${fTxt('obs','Observações', a.obs||'')}
  </div>
  ${novo ? `<div data-w="pg">${blocoPagamento('despesa')}</div>` : ''}
  <datalist id="dl-racas">${[...new Set(A('animais').filter(x=>x.especie===esp).map(x=>x.raca).filter(Boolean))].map(r=>`<option value="${esc(r)}">`).join('')}</datalist>
  <datalist id="dl-locais-an">${[...new Set(A('animais').filter(x=>x.especie===esp).map(x=>x.local).filter(Boolean))].map(r=>`<option value="${esc(r)}">`).join('')}</datalist>`;
  modal({ title: (novo ? 'Novo ' : 'Editar ') + ESPECIES[esp].sing.toLowerCase(), html, submit: novo ? 'Cadastrar' : 'Salvar',
    onInit(form){
      if (!novo) return;
      wirePagamento(form);
      const upd = () => { const c = form.elements.origem.value === 'compra';
        form.querySelector('[data-w=pg]').style.display = c ? '' : 'none';
        form.elements.valorAquisicao.closest('.fld').style.display = c ? '' : 'none';
        form.elements.fornecedor.closest('.fld').querySelector('span').textContent = c ? 'Fornecedor' : 'Origem / observação'; };
      form.elements.origem.addEventListener('change', upd); upd();
      form.elements.nascimento.addEventListener('change', () => { if (form.elements.origem.value === 'nascimento') form.elements.dataEntrada.value = form.elements.nascimento.value; });
    },
    async onSubmit(fd){
      exigeEscrita();
      const d = { especie:esp, ident:reqTxt(fd.ident,'a identificação'), nome:(fd.nome||'').trim(), raca:(fd.raca||'').trim(), sexo:fd.sexo,
        nascimento:fd.nascimento||'', categoria:fd.categoria, pesoInicial:num(fd.pesoInicial)||null, local:(fd.local||'').trim(), mae:(fd.mae||'').trim(), pai:(fd.pai||'').trim(), obs:(fd.obs||'').trim() };
      const dupl = A('animais').find(x => x.especie === esp && x.situacao === 'ativo' && x.ident.toLowerCase() === d.ident.toLowerCase() && x.id !== a.id);
      if (dupl) throw new Error(`Já existe um ${ESPECIES[esp].sing.toLowerCase()} ativo com a identificação "${d.ident}".`);
      if (!novo) { await dbUpd('animais', a.id, d); await audit('editar','animais',a.id,d.ident); toast('Cadastro atualizado.'); return; }
      const origem = fd.origem, dataEntrada = reqData(fd.dataEntrada, 'a data de entrada');
      const valor = origem === 'compra' ? num(fd.valorAquisicao) : 0;
      const pago = valor > 0 ? pagoAgoraDe(fd, valor) : 0; checaConta(fd, pago);
      const aid = novoId('animais'), mid = novoId('movimentacoes'), lid = valor > 0 ? novoId('lancamentos') : null;
      await dbSet('animais', aid, { ...d, origem, dataEntrada, valorAquisicao:valor||null, fornecedor:(fd.fornecedor||'').trim(), pesoAtual:d.pesoInicial, dataPeso:d.pesoInicial?dataEntrada:null, situacao:'ativo' });
      await criarMov({ especie:esp, tipo:origem, data:dataEntrada, animalIds:[aid], qtd:1, valor:valor||null, peso:d.pesoInicial, contraparte:(fd.fornecedor||'').trim(), lancamentoId:lid, obs:'Cadastro de '+d.ident, cadastro:true }, mid);
      if (lid) await criarLanc({ tipo:'despesa', data:dataEntrada, atividade:ESPECIES[esp].atividade, categoria:COMPRA_CAT[ESPECIES[esp].atividade], classificacao:'patrimonio',
        descricao:`Compra ${ESPECIES[esp].sing.toLowerCase()} ${d.ident}`, quantidade:1, valorUnit:valor, valor, forma:fd.forma, contaId:fd.contaId, vencimento:fd.vencimento||dataEntrada,
        contraparte:(fd.fornecedor||'').trim(), origem:'compra', refId:mid }, { id:lid, pagoAgora:pago, contaId:fd.contaId });
      toast(`${ESPECIES[esp].sing} ${d.ident} cadastrado.`);
    } });
}

function abrirFicha(id){
  const a = byId('animais', id); if (!a) return;
  const esp = a.especie, movs = movsDoAnimal(id);
  const pes = movs.filter(m => m.tipo === 'pesagem').sort((x,y)=>(x.data||'').localeCompare(y.data||''));
  const gmdTot = (a.pesoAtual && a.pesoInicial && a.dataPeso && a.dataEntrada && diasEntre(a.dataEntrada, a.dataPeso) > 0) ? (a.pesoAtual - a.pesoInicial) / diasEntre(a.dataEntrada, a.dataPeso) : null;
  const ativo = a.situacao === 'ativo';
  const html = `<div class="dl">
      <div><span>Identificação</span><b>${esc(nomeAnimal(a))}</b></div><div><span>Categoria</span><b>${esc(a.categoria)}</b></div><div><span>Situação</span><b>${situacaoBadge(a.situacao)}</b></div>
      <div><span>Raça / sexo</span><b>${esc(a.raca||'—')} · ${esc(a.sexo||'')}</b></div><div><span>Nascimento / idade</span><b>${D(a.nascimento)||'—'} · ${idadeTxt(a.nascimento)}</b></div><div><span>${LOCAL_LBL[esp]}</span><b>${esc(a.local||'—')}</b></div>
      <div><span>Peso inicial</span><b>${a.pesoInicial?N(a.pesoInicial,1)+' kg':'—'}</b></div><div><span>Peso atual</span><b>${a.pesoAtual?N(a.pesoAtual,1)+' kg':'—'}${a.dataPeso?` <span class="muted small">(${D(a.dataPeso)})</span>`:''}</b></div><div><span>GMD desde a entrada</span><b>${gmdTot!=null?N(gmdTot,3)+' kg/dia':'—'}</b></div>
      <div><span>Origem</span><b>${esc(MOV_NOMES[a.origem]||a.origem||'—')} · ${D(a.dataEntrada)}</b></div><div><span>Valor de aquisição</span><b>${a.valorAquisicao?R(a.valorAquisicao):'—'}</b></div><div><span>Mãe / pai</span><b>${esc(a.mae||'—')} / ${esc(a.pai||'—')}</b></div>
    </div>
    ${a.obs?`<div class="note" style="margin-bottom:12px">${esc(a.obs)}</div>`:''}
    <div class="btnrow">
      <button type="button" class="btn ghost sm" data-act="editAnimal" data-id="${id}">Editar cadastro</button>
      ${ativo ? `<button type="button" class="btn ghost sm" data-act="pesagem" data-id="${id}">Pesagem</button>
      <button type="button" class="btn ghost sm" data-act="indMov" data-tipo="transferencia" data-id="${id}">Transferir ${esp==='bovino'?'lote/pasto':'baia'}</button>
      <button type="button" class="btn ghost sm" data-act="indMov" data-tipo="categoria" data-id="${id}">Mudar categoria</button>
      <button type="button" class="btn ghost sm" data-act="novoManejoAlvo" data-esp="${esp}" data-animal="${id}">Manejo</button>
      <button type="button" class="btn gold sm" data-act="vender" data-esp="${esp}" data-animal="${id}">Vender</button>
      <button type="button" class="btn danger sm" data-act="indMov" data-tipo="mortalidade" data-id="${id}">Mortalidade</button>
      <button type="button" class="btn danger sm" data-act="indMov" data-tipo="saida" data-id="${id}">Saída / descarte</button>` : ''}
    </div>
    <h4 style="font-size:16px;color:var(--verde);margin:6px 0 8px">Histórico individual</h4>
    ${tabelaMovs(movs, { compacta:true })}
    <h4 style="font-size:16px;color:var(--verde);margin:16px 0 8px">Manejo sanitário</h4>${tabelaManejos(manejosDoAlvo('A', id), true)}
    ${a.sexo === 'Fêmea' && A('reproducoes').some(r => r.matriz === 'A:'+id) ? `<h4 style="font-size:16px;color:var(--verde);margin:16px 0 8px">Histórico reprodutivo</h4><div class="tw"><table><thead><tr><th>Cobertura</th><th>Reprodutor</th><th>Previsão</th><th>Situação</th><th>Parto</th><th>Cria</th></tr></thead><tbody>${A('reproducoes').filter(r => r.matriz === 'A:'+id).sort((x,y)=>y.dataCob.localeCompare(x.dataCob)).map(r => `<tr><td>${D(r.dataCob)}</td><td>${esc(r.reprodutor||'—')}</td><td>${D(r.prevParto)}</td><td>${(ST_REPRO[r.status]||[])[1]||r.status}</td><td>${r.parto?D(r.parto.data):'—'}</td><td>${r.parto ? (r.especie==='suino' ? N(r.parto.vivos)+' vivos' : esc(r.parto.ident||'natimorto')) : '—'}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${pes.length > 1 ? `<h4 style="font-size:16px;color:var(--verde);margin:16px 0 8px">Evolução de peso</h4><div class="chart-box sm"><canvas id="chPeso"></canvas></div>` : ''}`;
  modal({ title:`Ficha · ${ESPECIES[esp].sing} ${a.ident}`, html, wide:true,
    onInit(){ if (pes.length > 1 && window.Chart) (new Chart(document.getElementById('chPeso'), { type:'line',
      data:{ labels:pes.map(p=>D(p.data)), datasets:[{ label:'Peso (kg)', data:pes.map(p=>p.peso), borderColor:CORES.bovinos, backgroundColor:CORES.bovinos, borderWidth:2, pointRadius:4, tension:.2 }] },
      options:chartOpts({ legend:false, money:false }) })); } });
}
function situacaoBadge(s){ const m = { ativo:['b-ok','Ativo'], vendido:['b-par','Vendido'], morto:['b-err','Morto'], baixado:['b-mut','Baixado'] }[s] || ['b-mut',s]; return `<span class="badge ${m[0]}">${m[1]}</span>`; }

function abrirPesagem(id){
  const a = byId('animais', id);
  modal({ title:`Pesagem · ${a.ident}`, html:`<div class="fg">${fDate('data','Data da pesagem')}${fNum('peso','Peso (kg)','')}${fTxt('obs','Observações','')}</div>
    <p class="small muted">Peso anterior: ${a.pesoAtual?N(a.pesoAtual,1)+' kg em '+D(a.dataPeso||a.dataEntrada):'não informado'}. O ganho médio diário (GMD) é calculado automaticamente.</p>`,
    async onSubmit(fd){
      exigeEscrita();
      const peso = reqPos(fd.peso,'o peso'), data = reqData(fd.data);
      const ant = a.pesoAtual || null, dAnt = a.dataPeso || a.dataEntrada;
      const dias = ant && dAnt ? diasEntre(dAnt, data) : 0;
      const gmd = dias > 0 ? round2((peso-ant)/dias*1000)/1000 : null;
      await criarMov({ especie:a.especie, tipo:'pesagem', data, animalIds:[id], qtd:1, peso, pesoAnterior:ant, dataAnterior:dAnt||null, gmd, obs:(fd.obs||'').trim() });
      if (!a.dataPeso || data >= a.dataPeso) await dbUpd('animais', id, { pesoAtual:peso, dataPeso:data });
      toast(gmd!=null ? `Pesagem registrada · GMD ${N(gmd,3)} kg/dia` : 'Pesagem registrada.');
    } });
}

function abrirMovInd(id, tipo){
  const a = byId('animais', id), esp = a.especie;
  const T = { mortalidade:'Registrar mortalidade', saida:'Saída / descarte / ajuste', transferencia:`Transferir ${LOCAL_LBL[esp].toLowerCase()}`, categoria:'Mudança de categoria' }[tipo];
  let campos = '';
  if (tipo === 'mortalidade') campos = fInp('causa','Causa provável','', 'full');
  if (tipo === 'saida') campos = fSel('subtipo','Tipo', [['descarte','Descarte'],['saida','Saída (doação, consumo próprio, perda)'],['ajuste','Ajuste de inventário (animal não encontrado)']], 'descarte', 'full');
  if (tipo === 'transferencia') campos = `<div class="fld"><span>Atual</span><input readonly value="${esc(a.local||'—')}"></div>${fInp('para','Novo '+LOCAL_LBL[esp].toLowerCase(),'','list="dl-loc2"')}<datalist id="dl-loc2">${[...new Set(A('animais').filter(x=>x.especie===esp).map(x=>x.local).filter(Boolean))].map(r=>`<option value="${esc(r)}">`).join('')}</datalist>`;
  if (tipo === 'categoria') campos = `<div class="fld"><span>Atual</span><input readonly value="${esc(a.categoria)}"></div>${fSel('para','Nova categoria', catsAnimal(esp), a.categoria)}`;
  modal({ title:`${T} · ${a.ident}`, html:`<div class="fg">${fDate('data','Data')}<div></div>${campos}${fTxt('obs','Observações','')}</div>
    ${['mortalidade','saida'].includes(tipo) ? '<p class="small muted">O animal sai do saldo ativo. Não gera lançamento financeiro.</p>' : '<p class="small muted">Movimentação interna: não gera lançamento financeiro.</p>'}`,
    submit:'Registrar',
    async onSubmit(fd){
      exigeEscrita(); const data = reqData(fd.data); const obs = (fd.obs||'').trim();
      if (tipo === 'mortalidade') {
        await criarMov({ especie:esp, tipo:'mortalidade', data, animalIds:[id], qtd:1, causa:(fd.causa||'').trim(), obs });
        await dbUpd('animais', id, { situacao:'morto', dataSaida:data });
      } else if (tipo === 'saida') {
        await criarMov({ especie:esp, tipo:fd.subtipo, data, animalIds:[id], qtd:1, obs });
        await dbUpd('animais', id, { situacao:'baixado', dataSaida:data });
      } else if (tipo === 'transferencia') {
        const para = reqTxt(fd.para, 'o destino');
        await criarMov({ especie:esp, tipo:'transferencia', data, animalIds:[id], qtd:1, de:a.local||'', para, obs });
        await dbUpd('animais', id, { local:para });
      } else if (tipo === 'categoria') {
        if (fd.para === a.categoria) throw new Error('Escolha uma categoria diferente da atual.');
        await criarMov({ especie:esp, tipo:'categoria', data, animalIds:[id], qtd:1, de:a.categoria, para:fd.para, obs });
        await dbUpd('animais', id, { categoria:fd.para });
      }
      toast('Movimentação registrada.');
      $$('#modal-root .mback').forEach(m => m.remove()); abrirFicha(id);
    } });
}

/* ---------- Lotes (suínos e galinhas) ---------- */
function abrirLote(esp, edit = null){
  const l = edit || {}, novo = !edit;
  const html = `<div class="fg">
    ${fInp('codigo','Identificação do lote *', l.codigo || proximoCodigo(esp))}
    ${fSel('categoria', esp==='galinha' ? 'Tipo de criação' : 'Categoria', catsAnimal(esp), l.categoria || (esp==='galinha'?'Caipira':'Leitão lactente'))}
    ${fInp('raca', esp==='galinha'?'Raça ou linhagem':'Raça', l.raca||'')}
    ${fDate('nascimento','Data de nascimento (aprox.)', l.nascimento||'')}
    ${fInp('local', LOCAL_LBL[esp], l.local||'')}
    ${fNum('pesoMedio','Peso médio inicial (kg)', l.pesoMedio||'')}
    ${novo ? `${fNum('qtd','Quantidade inicial *','')}
      ${fSel('origem','Origem', [['compra','Compra'],['nascimento','Nascimento na propriedade'],['entrada','Inventário inicial / já existente']], 'compra')}
      ${fDate('dataEntrada','Data de entrada')}
      ${fNum('valorAquisicao','Valor total de aquisição (R$)','')}
      ${fInp('fornecedor','Fornecedor / origem','')}
      ${esp==='suino' ? fInp('matriz','Matriz (leitegada)','', 'list="dl-matrizes"') : ''}` :
      `<div class="fld full note">Entrada: ${esc(MOV_NOMES[l.origem]||l.origem)} de ${N(l.qtdInicial)} cabeças em ${D(l.dataEntrada)}${l.valorAquisicao?' · '+R(l.valorAquisicao):''}.</div>`}
    ${fTxt('obs','Observações', l.obs||'')}
  </div>${novo ? `<div data-w="pg">${blocoPagamento('despesa')}</div>` : ''}
  <datalist id="dl-matrizes">${indAtivos('suino').filter(x=>x.sexo==='Fêmea').map(x=>`<option value="${esc(x.ident)}">`).join('')}</datalist>`;
  modal({ title: novo ? `Novo lote de ${ESPECIES[esp].nome.toLowerCase()}` : 'Editar lote', html, submit: novo ? 'Cadastrar lote' : 'Salvar',
    onInit(form){
      if (!novo) return; wirePagamento(form);
      const upd = () => { const c = form.elements.origem.value === 'compra';
        form.querySelector('[data-w=pg]').style.display = c ? '' : 'none'; form.elements.valorAquisicao.closest('.fld').style.display = c ? '' : 'none'; };
      form.elements.origem.addEventListener('change', upd); upd();
    },
    async onSubmit(fd){
      exigeEscrita();
      const d = { especie:esp, codigo:reqTxt(fd.codigo,'a identificação do lote'), categoria:fd.categoria, raca:(fd.raca||'').trim(), nascimento:fd.nascimento||'', local:(fd.local||'').trim(), pesoMedio:num(fd.pesoMedio)||null, obs:(fd.obs||'').trim() };
      if (A('lotes').some(x => x.especie === esp && x.codigo.toLowerCase() === d.codigo.toLowerCase() && x.id !== l.id)) throw new Error('Já existe um lote com essa identificação.');
      if (!novo) { await dbUpd('lotes', l.id, d); await audit('editar','lotes',l.id,d.codigo); toast('Lote atualizado.'); return; }
      const qtd = Math.round(reqPos(fd.qtd, 'a quantidade inicial'));
      const origem = fd.origem, data = reqData(fd.dataEntrada, 'a data de entrada');
      const valor = origem === 'compra' ? num(fd.valorAquisicao) : 0;
      const pago = valor > 0 ? pagoAgoraDe(fd, valor) : 0; checaConta(fd, pago);
      const loteId = novoId('lotes'), mid = novoId('movimentacoes'), lid = valor > 0 ? novoId('lancamentos') : null;
      await dbSet('lotes', loteId, { ...d, qtdInicial:qtd, origem, dataEntrada:data, valorAquisicao:valor||null, fornecedor:(fd.fornecedor||'').trim(), matriz:(fd.matriz||'').trim(), situacao:'ativo' });
      await criarMov({ especie:esp, tipo:origem, data, loteId, delta:qtd, qtd, valor:valor||null, contraparte:(fd.fornecedor||'').trim(), lancamentoId:lid, cadastro:true, obs:'Formação do lote '+d.codigo }, mid);
      if (lid) await criarLanc({ tipo:'despesa', data, atividade:ESPECIES[esp].atividade, categoria:COMPRA_CAT[ESPECIES[esp].atividade], classificacao:'patrimonio',
        descricao:`Compra lote ${d.codigo} (${qtd} cab.)`, quantidade:qtd, valorUnit:round2(valor/qtd), valor, forma:fd.forma, contaId:fd.contaId, vencimento:fd.vencimento||data,
        contraparte:(fd.fornecedor||'').trim(), origem:'compra', refId:mid }, { id:lid, pagoAgora:pago, contaId:fd.contaId });
      toast(`Lote ${d.codigo} cadastrado com ${qtd} cabeças.`);
    } });
}
function proximoCodigo(esp){ const p = esp==='galinha'?'GAL':'SUI'; const n = A('lotes').filter(l=>l.especie===esp).length + 1; return `${p}-${String(n).padStart(3,'0')}`; }

const MOV_LOTE = {
  nascimento:{ t:'Nascimento', sinal:+1 }, compra:{ t:'Compra de animais', sinal:+1 }, mortalidade:{ t:'Mortalidade', sinal:-1 },
  descarte:{ t:'Descarte', sinal:-1 }, ajuste:{ t:'Ajuste de quantidade', sinal:0 }, transferencia:{ t:'Transferência para outro lote', sinal:-1 },
  local:{ t:'Transferência de local', sinal:0 }, categoria:{ t:'Mudança de categoria', sinal:0 }, desmame:{ t:'Desmame', sinal:0 }
};
function abrirMovLote(loteId, tipo){
  const l = byId('lotes', loteId), esp = l.especie, saldo = saldoLote(loteId), cfgT = MOV_LOTE[tipo];
  let campos = '';
  if (['nascimento','mortalidade','descarte','compra'].includes(tipo)) campos += fNum('qtd','Quantidade *','');
  if (tipo === 'mortalidade') campos += fInp('causa','Causa provável','');
  if (tipo === 'ajuste') campos += fSel('sentido','Ajuste', [['+','Acrescentar (+)'],['-','Retirar (−)']], '-') + fNum('qtd','Quantidade *','');
  if (tipo === 'compra') campos += fNum('valor','Valor total (R$)','') + fInp('fornecedor','Fornecedor','');
  if (tipo === 'transferencia') {
    const dest = A('lotes').filter(x => x.especie === esp && x.id !== loteId && x.situacao !== 'encerrado');
    campos += fNum('qtd','Quantidade *','') + `<label class="fld"><span>Lote de destino *</span><select name="para">${opts(dest.map(x=>[x.id, nomeLote(x)]), '', dest.length?'Selecione…':'Nenhum outro lote ativo')}</select></label>`;
  }
  if (tipo === 'local') campos += `<div class="fld"><span>Atual</span><input readonly value="${esc(l.local||'—')}"></div>` + fInp('para','Novo '+LOCAL_LBL[esp].toLowerCase(),'');
  if (tipo === 'categoria') campos += `<div class="fld"><span>Atual</span><input readonly value="${esc(l.categoria)}"></div>` + fSel('para','Nova categoria', catsAnimal(esp), l.categoria);
  if (tipo === 'desmame') campos += fNum('qtd','Quantidade desmamada *', saldo) + fNum('pesoMedio','Peso médio no desmame (kg)','');
  modal({ title:`${cfgT.t} · ${l.codigo}`, submit:'Registrar',
    html:`<div class="note" style="margin-bottom:12px">Saldo atual do lote: <b>${N(saldo)} cabeça(s)</b>.</div><div class="fg">${fDate('data','Data')}${campos}${fTxt('obs','Observações','')}</div>
      ${tipo==='compra' ? `<div data-w="pg">${blocoPagamento('despesa')}</div>` : ''}
      ${tipo==='desmame' ? '<p class="small muted">A categoria do lote passa para “Leitão desmamado”. Leitões não desmamados (mortes na maternidade) devem ser lançados como mortalidade.</p>' : ''}`,
    onInit(form){ if (tipo === 'compra') wirePagamento(form); },
    async onSubmit(fd){
      exigeEscrita(); const data = reqData(fd.data), obs = (fd.obs||'').trim();
      const base = { especie:esp, data, loteId, obs };
      if (['nascimento','mortalidade','descarte'].includes(tipo)) {
        const q = Math.round(reqPos(fd.qtd,'a quantidade'));
        if (cfgT.sinal < 0 && q > saldo) throw new Error(`Quantidade maior que o saldo do lote (${saldo}).`);
        await criarMov({ ...base, tipo, delta:cfgT.sinal*q, qtd:q, causa:(fd.causa||'').trim()||null });
      } else if (tipo === 'ajuste') {
        const q = Math.round(reqPos(fd.qtd,'a quantidade')); const s = fd.sentido === '+' ? 1 : -1;
        if (s < 0 && q > saldo) throw new Error(`Quantidade maior que o saldo do lote (${saldo}).`);
        if (!obs) throw new Error('Informe o motivo do ajuste nas observações.');
        await criarMov({ ...base, tipo:'ajuste', delta:s*q, qtd:q });
      } else if (tipo === 'compra') {
        const q = Math.round(reqPos(fd.qtd,'a quantidade')), valor = num(fd.valor);
        const pago = valor > 0 ? pagoAgoraDe(fd, valor) : 0; checaConta(fd, pago);
        const mid = novoId('movimentacoes'), lid = valor > 0 ? novoId('lancamentos') : null;
        await criarMov({ ...base, tipo:'compra', delta:q, qtd:q, valor:valor||null, contraparte:(fd.fornecedor||'').trim(), lancamentoId:lid }, mid);
        if (lid) await criarLanc({ tipo:'despesa', data, atividade:ESPECIES[esp].atividade, categoria:COMPRA_CAT[ESPECIES[esp].atividade], classificacao:'patrimonio',
          descricao:`Compra p/ lote ${l.codigo} (${q} cab.)`, quantidade:q, valorUnit:round2(valor/q), valor, forma:fd.forma, contaId:fd.contaId, vencimento:fd.vencimento||data,
          contraparte:(fd.fornecedor||'').trim(), origem:'compra', refId:mid }, { id:lid, pagoAgora:pago, contaId:fd.contaId });
      } else if (tipo === 'transferencia') {
        const q = Math.round(reqPos(fd.qtd,'a quantidade'));
        if (!fd.para) throw new Error('Selecione o lote de destino.');
        if (q > saldo) throw new Error(`Quantidade maior que o saldo do lote (${saldo}).`);
        const custo = round2(custoMedioLote(loteId) * q);
        await criarMov({ ...base, tipo:'transferencia', delta:-q, qtd:q, paraLoteId:fd.para, qtdTransf:q, custoTransf:custo });
      } else if (tipo === 'local') {
        const para = reqTxt(fd.para,'o novo local');
        await criarMov({ ...base, tipo:'local', delta:0, qtd:saldo, de:l.local||'', para });
        await dbUpd('lotes', loteId, { local:para });
      } else if (tipo === 'categoria') {
        if (fd.para === l.categoria) throw new Error('Escolha uma categoria diferente.');
        await criarMov({ ...base, tipo:'categoria', delta:0, qtd:saldo, de:l.categoria, para:fd.para });
        await dbUpd('lotes', loteId, { categoria:fd.para });
      } else if (tipo === 'desmame') {
        const q = Math.round(reqPos(fd.qtd,'a quantidade desmamada'));
        if (q > saldo) throw new Error(`Quantidade maior que o saldo do lote (${saldo}).`);
        await criarMov({ ...base, tipo:'desmame', delta:0, qtd:q, pesoMedio:num(fd.pesoMedio)||null, de:l.categoria, para:'Leitão desmamado' });
        await dbUpd('lotes', loteId, { categoria:'Leitão desmamado', pesoMedio:num(fd.pesoMedio)||l.pesoMedio||null, dataDesmame:data, qtdDesmamada:q });
      }
      toast('Movimentação registrada.');
    } });
}

function abrirFichaLote(id){
  const l = byId('lotes', id); if (!l) return;
  const esp = l.especie, saldo = saldoLote(id), movs = movsDoLote(id);
  const nasc = sum(movs.filter(m=>m.loteId===id && m.tipo==='nascimento'), m=>m.qtd) + (l.origem==='nascimento'?0:0);
  const mort = sum(movs.filter(m=>m.loteId===id && m.tipo==='mortalidade'), m=>m.qtd);
  const vend = sum(movs.filter(m=>m.loteId===id && m.tipo==='venda'), m=>m.qtd);
  const entr = sum(movs.filter(m=>m.loteId===id && (+m.delta||0)>0), m=>m.delta) + sum(movs.filter(m=>m.paraLoteId===id), m=>m.qtdTransf);
  const ativo = l.situacao !== 'encerrado';
  const btn = (t,lbl,cls='ghost') => `<button type="button" class="btn ${cls} sm" data-act="loteMov" data-id="${id}" data-tipo="${t}">${lbl}</button>`;
  const html = `<div class="dl">
    <div><span>Lote</span><b>${esc(l.codigo)}</b></div><div><span>${esp==='galinha'?'Tipo de criação':'Categoria'}</span><b>${esc(l.categoria)}</b></div><div><span>Saldo atual</span><b style="font-size:18px">${N(saldo)} cab.</b></div>
    <div><span>Raça / linhagem</span><b>${esc(l.raca||'—')}</b></div><div><span>${LOCAL_LBL[esp]}</span><b>${esc(l.local||'—')}</b></div><div><span>Idade</span><b>${idadeTxt(l.nascimento)}</b></div>
    <div><span>Entradas totais</span><b>${N(entr)}</b></div><div><span>Mortalidade</span><b>${N(mort)} ${entr?`<span class="muted small">(${N(mort/entr*100,1)}%)</span>`:''}</b></div><div><span>Vendidos</span><b>${N(vend)}</b></div>
    <div><span>Custo médio de aquisição</span><b>${custoMedioLote(id)?R(custoMedioLote(id))+'/cab.':'—'}</b></div>${l.matriz?`<div><span>Matriz</span><b>${esc(l.matriz)}</b></div>`:''}${l.qtdDesmamada?`<div><span>Desmame</span><b>${N(l.qtdDesmamada)} em ${D(l.dataDesmame)}${l.pesoMedio?' · '+N(l.pesoMedio,1)+' kg':''}</b></div>`:''}
  </div>
  <div class="btnrow"><button type="button" class="btn ghost sm" data-act="editLote" data-id="${id}">Editar</button>
    ${ativo ? `${btn('nascimento','Nascimento')}${btn('compra','Compra')}${btn('mortalidade','Mortalidade','danger')}${btn('descarte','Descarte','danger')}${btn('transferencia','Transferir p/ lote')}${btn('local','Mudar '+(esp==='galinha'?'galinheiro':'baia'))}${btn('categoria','Mudar categoria')}${esp==='suino'?btn('desmame','Desmame'):''}${btn('ajuste','Ajuste')}
    <button type="button" class="btn ghost sm" data-act="novoManejoAlvo" data-esp="${esp}" data-lote="${id}">Manejo</button>
    <button type="button" class="btn gold sm" data-act="vender" data-esp="${esp}" data-lote="${id}">Vender</button>
    ${saldo===0?`<button type="button" class="btn ghost sm" data-act="encerrarLote" data-id="${id}">Encerrar lote</button>`:''}` : `<span class="badge b-mut">Lote encerrado</span> <button type="button" class="btn ghost sm" data-act="reabrirLote" data-id="${id}">Reabrir</button>`}</div>
  <h4 style="font-size:16px;color:var(--verde);margin:6px 0 8px">Histórico do lote</h4>${tabelaMovs(movs, { compacta:true, loteRef:id })}
  <h4 style="font-size:16px;color:var(--verde);margin:16px 0 8px">Manejo sanitário</h4>${tabelaManejos(manejosDoAlvo('L', id), true)}`;
  modal({ title:`Lote ${l.codigo} · ${ESPECIES[esp].nome}`, html, wide:true });
}

/* ---------- Venda ---------- */
function abrirVenda(esp, { loteId, animalId } = {}){
  const lotes = lotesAtivos(esp).filter(l => saldoLote(l.id) > 0);
  const inds = indAtivos(esp);
  const multi = esp === 'bovino';
  let origemHtml;
  if (multi) {
    origemHtml = inds.length ? `<div class="fld full"><span>Animais vendidos * <span class="muted">(marque um ou mais)</span></span><div class="checklist">${inds.sort((a,b)=>a.ident.localeCompare(b.ident,'pt',{numeric:true})).map(a =>
      `<label><input type="checkbox" name="animal" value="${a.id}" ${a.id===animalId?'checked':''} data-peso="${a.pesoAtual||0}" data-custo="${a.valorAquisicao||0}"> <b>${esc(a.ident)}</b> ${esc(a.nome||'')} <span class="muted small">${esc(a.categoria)} · ${a.pesoAtual?N(a.pesoAtual,0)+' kg':'s/ peso'}${a.local?' · '+esc(a.local):''}</span></label>`).join('')}</div></div>`
      : `<div class="fld full note">Nenhum bovino ativo para vender.</div>`;
  } else {
    const o = [...lotes.map(l => ['L:'+l.id, `Lote ${nomeLote(l)} — saldo ${saldoLote(l.id)}`]), ...inds.map(a => ['A:'+a.id, `Animal ${a.ident} · ${a.categoria}`])];
    origemHtml = `<label class="fld full"><span>Origem (lote ou animal) *</span><select name="origem">${opts(o, loteId ? 'L:'+loteId : animalId ? 'A:'+animalId : '', o.length ? 'Selecione…' : 'Nada disponível para venda')}</select></label>`;
  }
  const html = `<div class="fg">
    ${fDate('data','Data da venda')}
    ${fSel('produto','Produto / categoria comercializada', PRODUTOS_VENDA[esp].map(p=>p[0]), '')}
    ${origemHtml}
    ${fSel('modo','Comercialização por', [['cabeca','Cabeça'],['unidade','Unidade'],['kg','Quilograma (kg)'],['lote','Lote (valor fechado)']], 'cabeca')}
    ${fNum('qtd','Quantidade *','', multi?'readonly':'')}
    ${fInp('idade','Idade','')}
    ${fNum('pesoMedio','Peso médio (kg)','')}
    ${fNum('pesoTotal','Peso total (kg)','')}
    ${fInp('pesosInd','Pesos individuais (kg, separados por ;)','', 'full placeholder="Opcional. Ex.: 98; 102,5; 101"')}
    ${fNum('valorCabeca','Valor por cabeça/unidade (R$)','')}
    ${fNum('valorKg','Valor por kg (R$)','')}
    ${fNum('valorTotal','Valor total (R$)','')}
    ${fInp('comprador','Comprador','')}
  </div>
  <div class="calc" style="margin-top:14px"><div><span>Receita total</span><b data-o="tot">R$ 0,00</b></div><div><span>Custo dos animais</span><b data-o="custo">R$ 0,00</b></div><div><span>Lucro / prejuízo</span><b data-o="luc">R$ 0,00</b></div><div><span>Disponível</span><b data-o="disp">—</b></div></div>
  <p class="small muted" style="margin:6px 0 0">Custo = valor de aquisição dos animais vendidos (custo de alimentação e manejo por cabeça entra no módulo Custos, Etapa 3).</p>
  ${blocoPagamento('receita')}
  ${fTxt('obs','Observações','')}`;
  modal({ title:`Venda de ${ESPECIES[esp].nome.toLowerCase()}`, html, wide:true, submit:'Registrar venda',
    onInit(form){
      wirePagamento(form);
      const f = n => form.elements[n];
      const st = () => {
        if (multi) { const ck = $$('input[name=animal]:checked', form); return { disp: inds.length, qtd: ck.length, custo: sum(ck, c => c.dataset.custo), peso: sum(ck, c => c.dataset.peso) }; }
        const v = f('origem').value; if (!v) return { disp:0, custo:0 };
        if (v.startsWith('L:')) { const id = v.slice(2); return { disp: saldoLote(id), custoUnit: custoMedioLote(id), lote: byId('lotes', id) }; }
        const a = byId('animais', v.slice(2)); return { disp:1, custoUnit:a.valorAquisicao||0, animal:a };
      };
      let ultimo = null;
      function recalc(src){
        const s = st(); const modo = f('modo').value;
        if (multi) { f('qtd').value = s.qtd || ''; if (src === 'animal' && s.peso) { f('pesoTotal').value = numStr(s.peso); } }
        else if (src === 'origem') {
          if (s.animal) { f('qtd').value = '1'; if (s.animal.pesoAtual) f('pesoTotal').value = numStr(s.animal.pesoAtual); f('idade').value = idadeTxt(s.animal.nascimento); const p = PRODUTOS_VENDA[esp].find(p => p[0].toLowerCase().includes((s.animal.categoria||'').split(' ')[0].toLowerCase())); if (p) f('produto').value = p[0]; }
          if (s.lote) { if (!num(f('qtd').value)) f('qtd').value = s.disp; if (s.lote.nascimento) f('idade').value = idadeTxt(s.lote.nascimento); const p = PRODUTOS_VENDA[esp].find(p => p[0] === s.lote.categoria); if (p) f('produto').value = p[0]; if (s.lote.pesoMedio && !num(f('pesoMedio').value)) f('pesoMedio').value = numStr(s.lote.pesoMedio); }
        }
        const q = num(f('qtd').value);
        const pesos = (f('pesosInd').value||'').split(';').map(num).filter(x => x > 0);
        if (src === 'pesosInd' && pesos.length) { f('pesoTotal').value = numStr(sum(pesos, x=>x)); if (!multi && !num(f('qtd').value)) f('qtd').value = pesos.length; }
        if (src === 'pesoMedio' && q) f('pesoTotal').value = numStr(num(f('pesoMedio').value) * q);
        else if (['pesoTotal','qtd','pesosInd','animal','origem'].includes(src) && q && num(f('pesoTotal').value)) f('pesoMedio').value = numStr(num(f('pesoTotal').value) / q);
        else if (src === 'qtd' && num(f('pesoMedio').value)) f('pesoTotal').value = numStr(num(f('pesoMedio').value) * num(f('qtd').value));
        const vc = num(f('valorCabeca').value), vk = num(f('valorKg').value), pt = num(f('pesoTotal').value);
        let tot = num(f('valorTotal').value);
        if (modo === 'cabeca' || modo === 'unidade') tot = round2(q * vc);
        else if (modo === 'kg') tot = round2(pt * vk);
        if (modo !== 'lote') f('valorTotal').value = numStr(tot);
        f('valorTotal').readOnly = modo !== 'lote';
        f('valorCabeca').closest('.fld').style.display = (modo === 'cabeca' || modo === 'unidade') ? '' : 'none';
        f('valorKg').closest('.fld').style.display = modo === 'kg' ? '' : 'none';
        const custo = multi ? s.custo : round2((s.custoUnit||0) * q);
        const o = k => form.querySelector(`[data-o=${k}]`);
        o('tot').textContent = R(tot); o('custo').textContent = R(custo);
        o('luc').textContent = R(tot - custo); o('luc').style.color = tot - custo < 0 ? '#ffb4a3' : '#c9f0d6';
        o('disp').textContent = s.disp != null ? N(s.disp)+' cab.' : '—';
        ultimo = { tot, custo, s };
      }
      form.addEventListener('input', e => recalc(e.target.name));
      form.addEventListener('change', e => recalc(e.target.name));
      form._ultimo = () => ultimo;
      recalc(multi ? 'animal' : 'origem');
    },
    async onSubmit(fd, form){
      exigeEscrita();
      const data = reqData(fd.data), modo = fd.modo, produto = reqTxt(fd.produto, 'o produto');
      let animalIds = [], loteId = null, disp, custo = 0, origemTxt = '';
      if (multi) {
        animalIds = $$('input[name=animal]:checked', form).map(c => c.value);
        if (!animalIds.length) throw new Error('Marque ao menos um animal.');
        custo = sum(animalIds, id => byId('animais', id).valorAquisicao);
        origemTxt = animalIds.map(id => byId('animais', id).ident).join(', ');
      } else {
        const o = fd.origem; if (!o) throw new Error('Selecione a origem da venda.');
        if (o.startsWith('L:')) { loteId = o.slice(2); disp = saldoLote(loteId); origemTxt = 'lote ' + byId('lotes', loteId).codigo; }
        else { const a = byId('animais', o.slice(2)); if (a.situacao !== 'ativo') throw new Error('Animal não está ativo.'); animalIds = [a.id]; disp = 1; custo = a.valorAquisicao || 0; origemTxt = a.ident; }
      }
      const q = multi ? animalIds.length : Math.round(reqPos(fd.qtd, 'a quantidade'));
      if (!multi && q > disp) throw new Error(`Venda superior à quantidade disponível (${disp}).`);
      if (loteId) custo = round2(custoMedioLote(loteId) * q);
      const pt = num(fd.pesoTotal), pm = num(fd.pesoMedio) || (pt && q ? pt/q : 0);
      const vc = num(fd.valorCabeca), vk = num(fd.valorKg);
      let total = modo === 'kg' ? round2(pt * vk) : (modo === 'lote' ? num(fd.valorTotal) : round2(q * vc));
      if (modo === 'kg' && !pt) throw new Error('Informe o peso total (ou peso médio) para venda por kg.');
      if (!(total > 0)) throw new Error('Informe os valores da venda.');
      const pago = pagoAgoraDe(fd, total); checaConta(fd, pago);
      const cat = (PRODUTOS_VENDA[esp].find(p => p[0] === produto) || [0, CAT_RECEITA[ESPECIES[esp].atividade][0]])[1];
      const mid = novoId('movimentacoes'), lid = novoId('lancamentos');
      const pesos = (fd.pesosInd||'').split(';').map(num).filter(x => x > 0);
      await criarMov({ especie:esp, tipo:'venda', data, loteId, animalIds, delta: loteId ? -q : 0, qtd:q, valor:total, peso:pt||null, lancamentoId:lid, contraparte:(fd.comprador||'').trim(), obs:(fd.obs||'').trim(),
        venda:{ produto, modo, idade:(fd.idade||'').trim(), pesoMedio:pm?round2(pm):null, pesoTotal:pt||null, pesosInd:pesos, valorCabeca:vc||null, valorKg:vk||null, custo:round2(custo), lucro:round2(total-custo) } }, mid);
      await criarLanc({ tipo:'receita', data, atividade:ESPECIES[esp].atividade, categoria:cat, descricao:`Venda ${produto} – ${q} cab. (${origemTxt})`, quantidade:q,
        valorUnit: modo==='kg' ? vk : round2(total/q), valor:total, forma:fd.forma, contaId:fd.contaId, vencimento:fd.vencimento||data, contraparte:(fd.comprador||'').trim(),
        origem:'venda', refId:mid, custoVendido:custo }, { id:lid, pagoAgora:pago, contaId:fd.contaId });
      for (const id of animalIds) await dbUpd('animais', id, { situacao:'vendido', dataSaida:data });
      toast(`Venda registrada: ${R(total)} · lucro ${R(total-custo)}`);
      $$('#modal-root .mback').forEach(m => m.remove());
    } });
}

/* ---------- Estorno de movimentação ---------- */
async function estornarMov(m){
  const lanc = m.lancamentoId ? byId('lancamentos', m.lancamentoId) : null;
  // validações
  if (m.loteId && (+m.delta||0) > 0 && saldoLote(m.loteId) - m.delta < 0) return toast('Estorno deixaria o lote com saldo negativo. Estorne primeiro as saídas posteriores.', true);
  if (m.paraLoteId && saldoLote(m.paraLoteId) - (m.qtdTransf||0) < 0) return toast('Estorno deixaria o lote de destino com saldo negativo.', true);
  if (m.cadastro && m.loteId && movsDoLote(m.loteId).some(x => x.id !== m.id)) return toast('Este é o registro de formação do lote. Estorne antes as demais movimentações do lote.', true);
  if (m.cadastro && (m.animalIds||[]).some(id => movsDoAnimal(id).some(x => x.id !== m.id))) return toast('Este é o cadastro de entrada do animal. Estorne antes as demais movimentações dele.', true);
  const ok = await confirmar(`Estornar <b>${esc(MOV_NOMES[m.tipo]||m.tipo)}</b> de ${D(m.data)}${m.valor?` (${R(m.valor)})`:''}?` +
    (lanc ? `<br><br>O lançamento financeiro vinculado também será excluído${pagoDe(lanc)?` — inclusive ${R(pagoDe(lanc))} já ${lanc.tipo==='receita'?'recebidos':'pagos'}`:''}.` : '') +
    (m.cadastro ? '<br><br>O cadastro do animal/lote também será removido.' : '') + '<br><br>O registro fica guardado na auditoria.', 'Estornar');
  if (!ok) return;
  try {
    exigeEscrita();
    await dbUpd('movimentacoes', m.id, { excluido:true, excluidoEm:stamp() });
    if (lanc) await dbUpd('lancamentos', lanc.id, { excluido:true, excluidoEm:stamp() });
    for (const id of (m.animalIds||[])) {
      const a = byId('animais', id); if (!a) continue;
      if (m.cadastro) await dbUpd('animais', id, { excluido:true, excluidoEm:stamp() });
      else if (['venda','mortalidade','saida','descarte','ajuste'].includes(m.tipo)) await dbUpd('animais', id, { situacao:'ativo', dataSaida:null });
      else if (m.tipo === 'transferencia' && a.local === m.para) await dbUpd('animais', id, { local:m.de||'' });
      else if (m.tipo === 'categoria' && a.categoria === m.para) await dbUpd('animais', id, { categoria:m.de });
      else if (m.tipo === 'pesagem' && a.pesoAtual === m.peso) await dbUpd('animais', id, { pesoAtual:m.pesoAnterior||null, dataPeso:m.pesoAnterior?m.dataAnterior:null });
    }
    if (m.loteId) {
      const l = byId('lotes', m.loteId);
      if (m.cadastro) await dbUpd('lotes', m.loteId, { excluido:true, excluidoEm:stamp() });
      else if (l && m.tipo === 'local' && l.local === m.para) await dbUpd('lotes', m.loteId, { local:m.de||'' });
      else if (l && (m.tipo === 'categoria' || m.tipo === 'desmame') && l.categoria === m.para) await dbUpd('lotes', m.loteId, { categoria:m.de });
      if (l && l.situacao === 'encerrado') await dbUpd('lotes', m.loteId, { situacao:'ativo' });
    }
    await audit('estornar', 'movimentacoes', m.id, `${MOV_NOMES[m.tipo]||m.tipo} ${m.valor?R(m.valor):''}`);
    toast('Movimentação estornada.');
    $$('#modal-root .mback').forEach(x => x.remove());
  } catch(e){ falha(e); }
}

/* ---------- Tabelas ---------- */
function descMov(m){
  const parts = [];
  if (m.tipo === 'venda' && m.venda) parts.push(`${esc(m.venda.produto)} · ${m.venda.modo==='kg'?N(m.peso||m.venda.pesoTotal,1)+' kg × '+R(m.venda.valorKg):m.venda.modo==='lote'?'valor fechado':R(m.venda.valorCabeca)+'/cab.'}`);
  if (m.de || m.para) parts.push(`${esc(m.de||'—')} → ${esc(m.para||'—')}`);
  if (m.paraLoteId) parts.push(`→ lote ${esc((byId('lotes',m.paraLoteId)||{}).codigo||'?')}`);
  if (m.tipo === 'pesagem') parts.push(`${N(m.peso,1)} kg${m.gmd!=null?` · GMD ${N(m.gmd,3)}`:''}`);
  if (m.tipo === 'desmame' && m.pesoMedio) parts.push(`peso médio ${N(m.pesoMedio,1)} kg`);
  if (m.causa) parts.push('Causa: '+esc(m.causa));
  if (m.contraparte) parts.push(esc(m.contraparte));
  if (m.obs) parts.push(`<span class="muted">${esc(m.obs)}</span>`);
  return parts.join(' · ');
}
function alvoMov(m, loteRef){
  if (m.loteId) { const l = byId('lotes', m.loteId); return (loteRef && m.paraLoteId === loteRef) ? `de ${esc(l?.codigo||'?')}` : `Lote ${esc(l?.codigo||'?')}`; }
  return (m.animalIds||[]).map(id => esc((byId('animais', id)||{}).ident || '?')).join(', ');
}
function qtdMov(m, loteRef){
  if (loteRef && m.paraLoteId === loteRef) return `<span class="pos">+${N(m.qtdTransf)}</span>`;
  if (m.loteId) { const d = +m.delta||0; return d > 0 ? `<span class="pos">+${N(d)}</span>` : d < 0 ? `<span class="neg">${N(d)}</span>` : N(m.qtd||0); }
  const neg = ['venda','mortalidade','saida','descarte','ajuste'].includes(m.tipo), pos = ['compra','nascimento','entrada'].includes(m.tipo);
  return pos ? `<span class="pos">+${N(m.qtd)}</span>` : neg ? `<span class="neg">−${N(m.qtd)}</span>` : N(m.qtd||1);
}
function tabelaMovs(M, { compacta=false, loteRef=null } = {}){
  if (!M.length) return `<div class="tw">${vazio('Nenhuma movimentação', '')}</div>`;
  return `<div class="tw"><table><thead><tr><th>Data</th><th>Movimentação</th>${compacta?'':'<th>Espécie</th>'}<th>Animal / lote</th><th class="n">Qtd</th><th>Detalhes</th><th class="n">Valor</th><th></th></tr></thead><tbody>
    ${M.slice(0,400).map(m => `<tr><td>${D(m.data)}</td><td><b>${esc(MOV_NOMES[m.tipo]||m.tipo)}</b></td>${compacta?'':`<td>${esc(ESPECIES[m.especie]?.nome||'')}</td>`}
      <td>${alvoMov(m, loteRef)}</td><td class="n">${qtdMov(m, loteRef)}</td><td class="small">${descMov(m)}</td><td class="n">${m.valor?R(m.valor):''}</td>
      <td><div class="acts"><button type="button" class="ico" data-act="estornar" data-id="${m.id}" title="Estornar">Estornar</button></div></td></tr>`).join('')}
    </tbody></table></div>${M.length>400?'<p class="small muted">Mostrando as 400 mais recentes.</p>':''}`;
}
function tabelaVendas(esp){
  const [ini, fim] = periodo('vd');
  const V = movsValidas().filter(m => m.especie === esp && m.tipo === 'venda' && inRange(m.data, ini, fim)).sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  const rows = V.map(m => { const l = byId('lancamentos', m.lancamentoId); const v = m.venda||{};
    return `<tr><td>${D(m.data)}</td><td>${esc(v.produto||'')}</td><td>${alvoMov(m)}</td><td class="n">${N(m.qtd)}</td><td class="n">${m.peso?N(m.peso,1)+' kg':'—'}</td>
      <td class="n">${v.modo==='kg'?R(v.valorKg)+'/kg':v.modo==='lote'?'lote':R(v.valorCabeca)+'/cab.'}</td><td class="n"><b>${R(m.valor)}</b></td><td class="n">${R(v.custo)}</td><td class="n ${v.lucro<0?'neg':'pos'}">${R(v.lucro)}</td>
      <td>${esc(m.contraparte||'')}</td><td>${l?badgeStatus(statusL(l)):''}</td>
      <td><div class="acts">${l&&!quitado(l)?`<button class="ico" data-act="pagar" data-id="${l.id}">Receber</button>`:''}<button class="ico" data-act="estornar" data-id="${m.id}">Estornar</button></div></td></tr>`; }).join('');
  const tq = sum(V,m=>m.qtd), tv = sum(V,m=>m.valor), tc = sum(V,m=>(m.venda||{}).custo), tp = sum(V,m=>m.peso);
  return `<div class="bar">${filtroPeriodo('vd')}<button class="btn gold" data-act="vender" data-esp="${esp}">+ Nova venda</button>
      ${esp!=='bovino'?`<button class="btn ghost" data-act="outraReceita" data-atv="${ESPECIES[esp].atividade}">+ Outra receita (esterco…)</button>`:''}
      <button class="btn ghost" data-act="expVendas" data-esp="${esp}">Exportar Excel</button></div>
    <div class="grid g4" style="margin-bottom:14px">${kpi('Cabeças vendidas', N(tq))}${kpi('Receita', R(tv), '', 'green')}${kpi('Preço médio', tq?R(tv/tq)+'/cab.':'—', tp?R(tv/tp)+'/kg':'')}${kpi('Lucro s/ aquisição', R(tv-tc), 'custo '+R(tc), tv-tc<0?'red':'gold')}</div>
    ${V.length ? `<div class="tw"><table><thead><tr><th>Data</th><th>Produto</th><th>Origem</th><th class="n">Qtd</th><th class="n">Peso</th><th class="n">Preço</th><th class="n">Total</th><th class="n">Custo</th><th class="n">Lucro</th><th>Comprador</th><th>Receb.</th><th></th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3">${V.length} venda(s)</td><td class="n">${N(tq)}</td><td class="n">${tp?N(tp,1)+' kg':''}</td><td></td><td class="n">${R(tv)}</td><td class="n">${R(tc)}</td><td class="n">${R(tv-tc)}</td><td colspan="3"></td></tr></tfoot></table></div>`
      : `<div class="tw">${vazio('Nenhuma venda no período')}</div>`}`;
}
function abaMovs(esp){
  const [ini, fim] = periodo('mv'); const tipo = uiGet('mvTipo','');
  const M = movsValidas().filter(m => m.especie === esp && inRange(m.data, ini, fim) && (!tipo || m.tipo === tipo)).sort((a,b)=>(b.data||'').localeCompare(a.data||'')||(b.criadoEm||'').localeCompare(a.criadoEm||''));
  const tiposPresentes = [...new Set(movsValidas().filter(m=>m.especie===esp).map(m=>m.tipo))];
  return `<div class="bar">${filtroPeriodo('mv')}<label class="fld"><span>Tipo</span><select data-filter="mvTipo">${opts(tiposPresentes.map(t=>[t,MOV_NOMES[t]||t]), tipo, 'Todos')}</select></label>
    <button class="btn ghost" data-act="expMovs" data-esp="${esp}">Exportar Excel</button></div>${tabelaMovs(M, { compacta:true })}`;
}

/* ---------- Páginas de espécies ---------- */
function resumoEspecie(esp){
  const [ini, fim] = [mesIni(), mesFim()];
  const M = movsValidas().filter(m => m.especie === esp && inRange(m.data, ini, fim));
  const q = t => sum(M.filter(m => m.tipo === t), m => m.qtd);
  return `<div class="grid g5" style="margin-bottom:16px">
    ${kpi('Cabeças ativas', N(cabecas(esp)), esp==='galinha'?lotesAtivos(esp).length+' lote(s)':(esp==='suino'?`${indAtivos(esp).length} individuais · ${lotesAtivos(esp).length} lotes`:''), 'gold')}
    ${kpi('Nascimentos no mês', N(q('nascimento')), '', 'green')}${kpi('Mortalidades no mês', N(q('mortalidade')), '', 'red')}
    ${kpi('Compras no mês', N(q('compra')))}${kpi('Vendas no mês', N(q('venda')), R(sum(M.filter(m=>m.tipo==='venda'),m=>m.valor)), 'blue')}</div>`;
}
function tabelaIndividuais(esp){
  const sit = uiGet(esp+'Sit','ativo'), cat = uiGet(esp+'Cat',''), loc = uiGet(esp+'Loc',''), q = (uiGet(esp+'Q','')||'').toLowerCase();
  const all = A('animais').filter(a => a.especie === esp);
  const L = all.filter(a => (!sit || a.situacao === sit) && (!cat || a.categoria === cat) && (!loc || a.local === loc) && (!q || `${a.ident} ${a.nome} ${a.raca}`.toLowerCase().includes(q)))
    .sort((a,b) => a.ident.localeCompare(b.ident, 'pt', { numeric:true }));
  const porCat = {}; for (const a of all.filter(a=>a.situacao==='ativo')) porCat[a.categoria] = (porCat[a.categoria]||0)+1;
  return `${Object.keys(porCat).length ? `<div class="chips" style="margin-bottom:12px">${Object.entries(porCat).map(([c,n])=>`<button class="chip ${cat===c?'on':''}" data-act="setf" data-k="${esp}Cat" data-v="${cat===c?'':esc(c)}">${esc(c)}: <b>${n}</b></button>`).join('')}</div>` : ''}
    <div class="bar"><button class="btn primary" data-act="novoAnimal" data-esp="${esp}">+ Novo ${ESPECIES[esp].sing.toLowerCase()}</button>
      ${esp==='bovino'?`<button class="btn gold" data-act="vender" data-esp="bovino">Vender</button>`:''}
      <label class="fld"><span>Situação</span><select data-filter="${esp}Sit">${opts([['ativo','Ativos'],['vendido','Vendidos'],['morto','Mortos'],['baixado','Baixados']], sit, 'Todos')}</select></label>
      <label class="fld"><span>Categoria</span><select data-filter="${esp}Cat">${opts(catsAnimal(esp), cat, 'Todas')}</select></label>
      <label class="fld"><span>${LOCAL_LBL[esp]}</span><select data-filter="${esp}Loc">${opts([...new Set(all.map(a=>a.local).filter(Boolean))], loc, 'Todos')}</select></label>
      <label class="fld grow"><span>Buscar</span><input data-filter="${esp}Q" value="${esc(uiGet(esp+'Q',''))}" placeholder="brinco, nome, raça"></label>
      <button class="btn ghost" data-act="expAnimais" data-esp="${esp}">Exportar Excel</button></div>
    ${L.length ? `<div class="tw"><table><thead><tr><th>${esp==='bovino'?'Brinco':'Identificação'}</th><th>Nome</th><th>Raça</th><th>Sexo</th><th>Categoria</th><th>Idade</th><th class="n">Peso atual</th><th>${LOCAL_LBL[esp]}</th><th>Situação</th><th></th></tr></thead><tbody>
      ${L.map(a => `<tr><td><b>${esc(a.ident)}</b></td><td>${esc(a.nome)}</td><td>${esc(a.raca)}</td><td>${esc(a.sexo)}</td><td>${esc(a.categoria)}</td><td>${idadeTxt(a.nascimento)}</td>
        <td class="n">${a.pesoAtual?N(a.pesoAtual,1)+' kg':'—'}</td><td>${esc(a.local||'—')}</td><td>${situacaoBadge(a.situacao)}</td>
        <td><div class="acts"><button class="ico" data-act="ficha" data-id="${a.id}">Ficha</button></div></td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="6">${L.length} animal(is)</td><td class="n">${N(sum(L,a=>a.pesoAtual),0)} kg</td><td colspan="3"></td></tr></tfoot></table></div>`
      : `<div class="tw">${vazio(all.length ? 'Nenhum animal com esses filtros' : `Nenhum ${ESPECIES[esp].sing.toLowerCase()} cadastrado`, all.length ? '' : 'Clique em “Novo” para cadastrar o primeiro animal.')}</div>`}`;
}
function tabelaLotes(esp){
  const sit = uiGet(esp+'LSit','ativo');
  const L = A('lotes').filter(l => l.especie === esp && (!sit || (sit === 'ativo' ? l.situacao !== 'encerrado' : l.situacao === 'encerrado'))).sort((a,b)=>(b.dataEntrada||'').localeCompare(a.dataEntrada||''));
  return `<div class="bar"><button class="btn primary" data-act="novoLote" data-esp="${esp}">+ Novo lote</button>
      <button class="btn gold" data-act="vender" data-esp="${esp}">Vender</button>
      <label class="fld"><span>Situação</span><select data-filter="${esp}LSit">${opts([['ativo','Ativos'],['encerrado','Encerrados']], sit, 'Todos')}</select></label></div>
    ${L.length ? `<div class="tw"><table><thead><tr><th>Lote</th><th>${esp==='galinha'?'Tipo de criação':'Categoria'}</th><th>Raça</th><th>Idade</th><th>${LOCAL_LBL[esp]}</th><th>Entrada</th><th class="n">Inicial</th><th class="n">Saldo</th><th class="n">Custo/cab.</th><th></th></tr></thead><tbody>
      ${L.map(l => { const s = saldoLote(l.id); return `<tr><td><b>${esc(l.codigo)}</b>${l.situacao==='encerrado'?' <span class="badge b-mut">encerrado</span>':''}</td><td>${esc(l.categoria)}</td><td>${esc(l.raca)}</td><td>${idadeTxt(l.nascimento)}</td><td>${esc(l.local||'—')}</td>
        <td>${D(l.dataEntrada)}</td><td class="n">${N(l.qtdInicial)}</td><td class="n"><b>${N(s)}</b></td><td class="n">${custoMedioLote(l.id)?R(custoMedioLote(l.id)):'—'}</td>
        <td><div class="acts"><button class="ico" data-act="fichaLote" data-id="${l.id}">Abrir</button></div></td></tr>`; }).join('')}
      </tbody><tfoot><tr><td colspan="7">${L.length} lote(s)</td><td class="n">${N(sum(L, l=>saldoLote(l.id)))}</td><td colspan="2"></td></tr></tfoot></table></div>`
      : `<div class="tw">${vazio('Nenhum lote', 'Cadastre um lote para controlar os animais por grupo, sem cadastro individual.')}</div>`}`;
}
function pgBovinos(){
  const t = uiGet('bovTab','rebanho');
  return resumoEspecie('bovino') + tabs('bovTab', [['rebanho','Rebanho'],['vendas','Vendas'],['movs','Movimentações']], 'rebanho') +
    (t === 'rebanho' ? tabelaIndividuais('bovino') : t === 'vendas' ? tabelaVendas('bovino') : abaMovs('bovino'));
}
function pgSuinos(){
  const t = uiGet('suiTab','lotes');
  return resumoEspecie('suino') + tabs('suiTab', [['lotes','Lotes'],['plantel','Plantel individual (matrizes e reprodutores)'],['vendas','Comercialização'],['movs','Movimentações']], 'lotes') +
    (t === 'lotes' ? tabelaLotes('suino') : t === 'plantel' ? tabelaIndividuais('suino') : t === 'vendas' ? tabelaVendas('suino') : abaMovs('suino'));
}
function pgGalinhas(){
  const t = uiGet('galTab','lotes');
  return resumoEspecie('galinha') + tabs('galTab', [['lotes','Lotes'],['ovos','Produção de ovos'],['vendas','Vendas de aves'],['movs','Movimentações']], 'lotes') +
    (t === 'lotes' ? tabelaLotes('galinha') : t === 'ovos' ? abaOvos() : t === 'vendas' ? tabelaVendas('galinha') : abaMovs('galinha'));
}

/* ---------- Ovos ---------- */
const estoqueOvos = (excluirId) => sum(A('ovos').filter(o => o.id !== excluirId), o => (+o.produzidos||0) - (+o.vendidos||0) - (+o.consumidos||0) - (+o.perdidos||0));
function abrirOvos(){
  const lotes = lotesAtivos('galinha');
  modal({ title:'Registro de produção de ovos', submit:'Registrar',
    html:`<div class="fg">${fDate('data','Data')}
      <label class="fld"><span>Lote / galinheiro</span><select name="loteId">${opts(lotes.map(l=>[l.id, nomeLote(l)+(l.local?' · '+l.local:'')]), lotes[0]?.id, 'Sem lote específico')}</select></label>
      ${fNum('produzidos','Ovos produzidos (unidades)','')}${fNum('vendidos','Ovos vendidos (unidades)','')}
      ${fNum('consumidos','Consumidos na propriedade','')}${fNum('perdidos','Perdidos / quebrados','')}
      ${fNum('precoDuzia','Preço de venda por dúzia (R$)','')}${fInp('comprador','Comprador','')}</div>
      <div class="calc" style="margin-top:14px"><div><span>Receita</span><b data-o="rec">R$ 0,00</b></div><div><span>Estoque atual</span><b>${N(estoqueOvos())} ovos</b></div><div><span>Estoque após</span><b data-o="est">—</b></div></div>
      <div data-w="pg">${blocoPagamento('receita')}</div>${fTxt('obs','Observações','')}`,
    onInit(form){
      wirePagamento(form); const f = n => num(form.elements[n].value);
      const upd = () => { const rec = round2(f('vendidos')/12*f('precoDuzia')); form.querySelector('[data-o=rec]').textContent = R(rec);
        form.querySelector('[data-o=est]').textContent = N(estoqueOvos() + f('produzidos') - f('vendidos') - f('consumidos') - f('perdidos')) + ' ovos';
        form.querySelector('[data-w=pg]').style.display = f('vendidos') > 0 ? '' : 'none'; };
      form.addEventListener('input', upd); upd();
    },
    async onSubmit(fd){
      exigeEscrita(); const data = reqData(fd.data);
      const p = Math.round(num(fd.produzidos)), v = Math.round(num(fd.vendidos)), c = Math.round(num(fd.consumidos)), pe = Math.round(num(fd.perdidos)), pd = num(fd.precoDuzia);
      if (p+v+c+pe <= 0) throw new Error('Informe ao menos uma quantidade.');
      if (estoqueOvos() + p - v - c - pe < 0) throw new Error(`Saídas maiores que o estoque disponível (${N(estoqueOvos()+p)} ovos).`);
      const valor = round2(v/12*pd);
      if (v > 0 && !(pd > 0)) throw new Error('Informe o preço por dúzia dos ovos vendidos.');
      const oid = novoId('ovos'), lid = valor > 0 ? novoId('lancamentos') : null;
      const pago = valor > 0 ? pagoAgoraDe(fd, valor) : 0; checaConta(fd, pago);
      await dbSet('ovos', oid, { data, loteId:fd.loteId||null, produzidos:p, vendidos:v, consumidos:c, perdidos:pe, precoDuzia:pd||null, valorVenda:valor||null, comprador:(fd.comprador||'').trim(), lancamentoId:lid, obs:(fd.obs||'').trim() });
      await audit('criar','ovos',oid,`${p} produzidos / ${v} vendidos`);
      if (lid) await criarLanc({ tipo:'receita', data, atividade:'galinhas', categoria:'Venda de ovos', descricao:`Venda de ${N(v)} ovos (${N(v/12,1)} dz)`, quantidade:round2(v/12), valorUnit:pd, valor,
        forma:fd.forma, contaId:fd.contaId, vencimento:fd.vencimento||data, contraparte:(fd.comprador||'').trim(), origem:'ovos', refId:oid }, { id:lid, pagoAgora:pago, contaId:fd.contaId });
      toast('Produção registrada.');
    } });
}
async function excluirOvos(o){
  if (estoqueOvos(o.id) < 0) return toast('Excluir este registro deixaria o estoque de ovos negativo.', true);
  if (!(await confirmar(`Excluir o registro de ovos de ${D(o.data)}?${o.lancamentoId?' A receita vinculada também será excluída.':''}`, 'Excluir'))) return;
  try { exigeEscrita(); await dbUpd('ovos', o.id, { excluido:true, excluidoEm:stamp() });
    if (o.lancamentoId) await dbUpd('lancamentos', o.lancamentoId, { excluido:true, excluidoEm:stamp() });
    await audit('excluir','ovos',o.id,D(o.data)); toast('Registro excluído.'); } catch(e){ falha(e); }
}
function abaOvos(){
  const [ini, fim] = periodo('ov');
  const O = A('ovos').filter(o => inRange(o.data, ini, fim)).sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  const prod = sum(O,o=>o.produzidos), vend = sum(O,o=>o.vendidos), rec = sum(O,o=>o.valorVenda);
  const e = econ(ini, fim, 'galinhas');
  const aves = cabecas('galinha');
  const custoDz = prod ? e.oper / (prod/12) : 0;
  return `<div class="bar">${filtroPeriodo('ov')}<button class="btn primary" data-act="novoOvos">+ Registrar produção / venda</button></div>
    <div class="grid g5" style="margin-bottom:14px">${kpi('Produzidos', N(prod), N(prod/12,1)+' dúzias', 'gold')}${kpi('Vendidos', N(vend), R(rec), 'green')}
      ${kpi('Estoque de ovos', N(estoqueOvos()), 'saldo acumulado')}${kpi('Custo por dúzia', prod?R(custoDz):'—', 'custos operacionais galinhas', 'red')}${kpi('Custo por ave', aves?R(e.oper/aves):'—', aves+' aves ativas', 'blue')}</div>
    ${O.length ? `<div class="tw"><table><thead><tr><th>Data</th><th>Lote</th><th class="n">Produzidos</th><th class="n">Vendidos</th><th class="n">Consumidos</th><th class="n">Perdidos</th><th class="n">R$/dúzia</th><th class="n">Receita</th><th>Comprador</th><th></th></tr></thead><tbody>
      ${O.map(o => `<tr><td>${D(o.data)}</td><td>${esc(nomeLote(byId('lotes',o.loteId)) )}</td><td class="n">${N(o.produzidos)}</td><td class="n">${N(o.vendidos)}</td><td class="n">${N(o.consumidos)}</td><td class="n">${N(o.perdidos)}</td>
        <td class="n">${o.precoDuzia?R(o.precoDuzia):''}</td><td class="n">${o.valorVenda?R(o.valorVenda):''}</td><td>${esc(o.comprador||'')}</td><td><div class="acts"><button class="ico" data-act="delOvos" data-id="${o.id}">Excluir</button></div></td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="2">Total</td><td class="n">${N(prod)}</td><td class="n">${N(vend)}</td><td class="n">${N(sum(O,o=>o.consumidos))}</td><td class="n">${N(sum(O,o=>o.perdidos))}</td><td></td><td class="n">${R(rec)}</td><td colspan="2"></td></tr></tfoot></table></div>`
      : `<div class="tw">${vazio('Nenhum registro de ovos no período')}</div>`}`;
}
