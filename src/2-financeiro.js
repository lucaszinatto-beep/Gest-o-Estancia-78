/* =====================================================================
   Cálculos financeiros + módulo Financeiro
   ===================================================================== */
function pagoDe(l){ return round2(sum(l.pagamentos||[], p => p.valor)); }
function restante(l){ return round2((+l.valor||0) - pagoDe(l)); }
function statusL(l){
  const p = pagoDe(l), v = +l.valor||0;
  if (v > 0 && p >= v - 0.005) return l.tipo === 'receita' ? 'recebido' : 'pago';
  if (p > 0) return 'parcial';
  if ((l.vencimento || l.data) < hoje()) return 'vencido';
  return 'pendente';
}
const quitado = l => ['pago','recebido'].includes(statusL(l));
function saldoConta(c){
  let s = +c.saldoInicial || 0;
  for (const l of A('lancamentos')) for (const p of (l.pagamentos||[])) if (p.contaId === c.id) s += (l.tipo === 'receita' ? 1 : -1) * (+p.valor||0);
  return round2(s);
}
const saldoTotal = () => round2(sum(A('contas'), saldoConta));
// pagamentos efetivos (caixa) num período
function caixa(ini, fim, filtro=()=>true){
  let ent = 0, sai = 0;
  for (const l of A('lancamentos')) { if (!filtro(l)) continue;
    for (const p of (l.pagamentos||[])) if (inRange(p.data, ini, fim)) { if (l.tipo === 'receita') ent += +p.valor||0; else sai += +p.valor||0; } }
  return { ent:round2(ent), sai:round2(sai), liq:round2(ent-sai) };
}
// Resultado econômico (competência) — não mistura investimentos nem compras de animais
function econ(ini, fim, atv){
  const L = A('lancamentos').filter(l => inRange(l.data, ini, fim) && (!atv || l.atividade === atv));
  const rec = sum(L.filter(l => l.tipo==='receita'), l => l.valor);
  const cmv = sum(L.filter(l => l.tipo==='receita'), l => l.custoVendido);
  const D_ = L.filter(l => l.tipo==='despesa');
  const oper = sum(D_.filter(l => l.classificacao==='operacional'), l => l.valor);
  const ger  = sum(D_.filter(l => l.classificacao==='geral' || l.classificacao==='manutencao'), l => l.valor);
  const inv  = sum(D_.filter(l => CLASSIF_INV.includes(l.classificacao)), l => l.valor);
  const desp = oper + ger;
  return { rec:round2(rec), cmv:round2(cmv), oper:round2(oper), ger:round2(ger), inv:round2(inv), desp:round2(desp), res:round2(rec - cmv - oper - ger) };
}
function abertos(tipo){ return A('lancamentos').filter(l => l.tipo === tipo && !quitado(l)); }

function classifPadrao(atv, cat, grupo){
  if (atv === 'geral') {
    if (ITENS_MANUT.includes(cat)) return 'manutencao';
    if (ITENS_PATRIM.includes(cat)) return 'patrimonio';
    return (GRUPOS_GERAIS[grupo]||{}).classif || 'geral';
  }
  if (Object.values(COMPRA_CAT).includes(cat)) return 'patrimonio';
  return 'operacional';
}

/* ---------- Criação de lançamentos (usado por todos os módulos) ---------- */
// Cria um lançamento. pagoAgora: valor já pago/recebido na data, na conta informada.
async function criarLanc(d, { pagoAgora=0, dataPg, contaId, id } = {}){
  const lid = id || novoId('lancamentos');
  const pagamentos = pagoAgora > 0 ? [{ id:uid(), data:dataPg || d.data, valor:round2(pagoAgora), contaId:contaId || d.contaId || '' }] : [];
  const body = { tipo:d.tipo, data:d.data, atividade:d.atividade, categoria:d.categoria, classificacao: d.tipo==='despesa' ? (d.classificacao || classifPadrao(d.atividade, d.categoria, d.grupo)) : null,
    grupo:d.grupo||null, local:d.local||'', descricao:d.descricao||'', quantidade:d.quantidade||null, valorUnit:d.valorUnit||null,
    valor:round2(d.valor), forma:d.forma||'', contaId:d.contaId||'', vencimento:d.vencimento||d.data, contraparte:d.contraparte||'',
    comprovante:d.comprovante||'', obs:d.obs||'', origem:d.origem||'manual', refId:d.refId||null, custoVendido:d.custoVendido!=null?round2(d.custoVendido):null,
    grupoParcela:d.grupoParcela||null, parcela:d.parcela||null, pagamentos };
  await dbSet('lancamentos', lid, body);
  await audit('criar', 'lancamentos', lid, `${body.tipo} ${body.categoria} ${R(body.valor)}`);
  return lid;
}
function duplicado(d){
  return A('lancamentos').find(l => l.tipo === d.tipo && l.data === d.data && Math.abs((+l.valor||0) - d.valor) < 0.005 &&
    (l.descricao||'').trim().toLowerCase() === (d.descricao||'').trim().toLowerCase() && l.categoria === d.categoria);
}

/* ---------- Formulário de lançamento ---------- */
function abrirLancamento(preset = {}, edit = null){
  const L = edit || {};
  const tipo0 = L.tipo || preset.tipo || 'despesa';
  const atv0 = L.atividade || preset.atividade || 'bovinos';
  const auto = edit && edit.origem && edit.origem !== 'manual';
  const html = `
    ${auto ? `<div class="note" style="margin-bottom:12px">Lançamento gerado automaticamente por ${esc(edit.origem)}. Valor, tipo e atividade são definidos pela movimentação de origem — para alterar, estorne a movimentação.</div>` : ''}
    <div class="fg">
      <div class="fld full"><span>Tipo</span><div class="toggle">
        <label><input type="radio" name="tipo" value="receita" ${tipo0==='receita'?'checked':''} ${auto?'disabled':''}><span>Receita</span></label>
        <label><input type="radio" name="tipo" value="despesa" ${tipo0==='despesa'?'checked':''} ${auto?'disabled':''}><span>Despesa</span></label></div></div>
      ${fDate('data','Data', L.data || preset.data || hoje())}
      ${fSel('atividade','Atividade', Object.entries(ATIVIDADES), atv0, auto?'disabled':'')}
      <label class="fld" data-w="grupo"><span>Grupo (Despesas Gerais)</span><select name="grupo"></select></label>
      <label class="fld"><span>Categoria</span><select name="categoria"></select></label>
      <label class="fld" data-w="classif"><span>Classificação</span><select name="classificacao">${opts(Object.entries(CLASSIF), L.classificacao)}</select></label>
      <label class="fld" data-w="local"><span>Estrutura / local beneficiado</span><input name="local" list="dl-locais" value="${esc(L.local||'')}" placeholder="Ex.: Pasto 2, Casa sede"></label>
      ${fInp('descricao','Descrição', L.descricao||preset.descricao||'', 'full')}
      ${fNum('quantidade','Quantidade', L.quantidade||'')}
      ${fNum('valorUnit','Valor unitário (R$)', L.valorUnit||'')}
      ${fNum('valor','Valor total (R$)', L.valor||'', auto?'readonly':'')}
      ${fSel('forma','Forma de pagamento', FORMAS, L.forma||'PIX')}
      ${fSel('contaId','Conta financeira', contaOpts(), L.contaId||contaPadrao())}
      ${fDate('vencimento','Vencimento', L.vencimento || L.data || hoje())}
      ${fInp('contraparte','Fornecedor / cliente', L.contraparte||'')}
      ${edit ? '' : fSel('situacao','Situação', [['quitado','Pago / recebido'],['pendente','Pendente (a pagar / receber)']], preset.situacao||'quitado')}
      ${edit ? '' : `<label class="fld"><span>Parcelas</span><input name="parcelas" inputmode="numeric" value="1"></label>
        <label class="fld"><span>Repetir mensalmente (meses)</span><input name="recorrente" inputmode="numeric" value="1"></label>`}
      ${fInp('comprovante','Comprovante (nº da nota, recibo ou link)', L.comprovante||'', 'full')}
      ${fTxt('obs','Observações', L.obs||'')}
    </div>
    <datalist id="dl-locais">${[...new Set([...(S.cfg.locais||[]), ...A('lancamentos').map(l=>l.local).filter(Boolean)])].map(x=>`<option value="${esc(x)}">`).join('')}</datalist>
    <p class="small muted" style="margin:10px 0 0">Parcelas dividem o valor total em vencimentos mensais. Repetição cria o mesmo lançamento nos meses seguintes (ex.: energia).</p>`;
  modal({ title: edit ? 'Editar lançamento' : 'Novo lançamento', html, submit: edit ? 'Salvar alterações' : 'Lançar',
    onInit(form){
      const f = n => form.elements[n];
      const tipoAtual = () => auto ? edit.tipo : (form.querySelector('[name=tipo]:checked')||{}).value;
      const atvAtual = () => auto ? edit.atividade : f('atividade').value;
      function refresh(keepCat){
        const tipo = tipoAtual(), atv = atvAtual();
        const geral = atv === 'geral' && tipo === 'despesa';
        form.querySelector('[data-w=grupo]').style.display = geral ? '' : 'none';
        form.querySelector('[data-w=classif]').style.display = tipo === 'despesa' ? '' : 'none';
        form.querySelector('[data-w=local]').style.display = tipo === 'despesa' ? '' : 'none';
        let cats;
        if (tipo === 'receita') cats = catsReceita(atv);
        else if (geral) {
          if (!f('grupo').options.length) f('grupo').innerHTML = opts(Object.entries(GRUPOS_GERAIS).map(([k,g])=>[k,g.nome]), L.grupo || preset.grupo || 'gerais');
          cats = [...GRUPOS_GERAIS[f('grupo').value].itens, ...(S.cfg.catDespesaExtra||[])];
        } else cats = catsDespesa(atv);
        const cur = keepCat ? f('categoria').value : (L.categoria || preset.categoria);
        if (cur && !cats.includes(cur)) cats = [cur, ...cats];
        f('categoria').innerHTML = opts(cats, cur);
        if (!keepCat && !L.classificacao) f('classificacao').value = classifPadrao(atv, f('categoria').value, f('grupo').value);
      }
      refresh(false);
      form.addEventListener('change', e => {
        const n = e.target.name;
        if (n === 'tipo' || n === 'atividade') { f('grupo').innerHTML=''; refresh(false); f('classificacao').value = classifPadrao(atvAtual(), f('categoria').value, f('grupo').value); }
        if (n === 'grupo') { refresh(false); f('classificacao').value = classifPadrao(atvAtual(), f('categoria').value, f('grupo').value); }
        if (n === 'categoria') f('classificacao').value = classifPadrao(atvAtual(), f('categoria').value, f('grupo').value);
        if (n === 'data' && !edit) f('vencimento').value = f('data').value;
      });
      form.addEventListener('input', e => {
        if ((e.target.name === 'quantidade' || e.target.name === 'valorUnit') && !auto) {
          const q = num(f('quantidade').value), u = num(f('valorUnit').value);
          if (q > 0 && u > 0) f('valor').value = numStr(q*u);
        }
      });
    },
    async onSubmit(fd){
      exigeEscrita();
      const tipo = auto ? edit.tipo : fd.tipo, atividade = auto ? edit.atividade : fd.atividade;
      const d = {
        tipo, atividade, data:reqData(fd.data), categoria:reqTxt(fd.categoria,'a categoria'),
        classificacao: tipo === 'despesa' ? fd.classificacao : null,
        grupo: (tipo === 'despesa' && atividade === 'geral') ? fd.grupo : null,
        local: tipo === 'despesa' ? (fd.local||'').trim() : '',
        descricao:(fd.descricao||'').trim(), quantidade:num(fd.quantidade)||null, valorUnit:num(fd.valorUnit)||null,
        valor: auto ? edit.valor : reqPos(fd.valor,'o valor total'), forma:fd.forma, contaId:fd.contaId,
        vencimento: fd.vencimento || fd.data, contraparte:(fd.contraparte||'').trim(), comprovante:(fd.comprovante||'').trim(), obs:(fd.obs||'').trim()
      };
      if (!d.descricao) d.descricao = d.categoria;
      if (edit) {
        if (!auto && d.valor < pagoDe(edit) - 0.005) throw new Error(`O valor não pode ser menor que o já pago (${R(pagoDe(edit))}).`);
        await dbUpd('lancamentos', edit.id, d);
        await audit('editar', 'lancamentos', edit.id, `${d.categoria} ${R(d.valor)}`);
        toast('Lançamento atualizado.'); return;
      }
      const quit = fd.situacao === 'quitado';
      if (quit && !d.contaId) throw new Error('Cadastre uma conta financeira (Financeiro › Contas) para registrar o pagamento.');
      const nParc = Math.max(1, Math.min(120, parseInt(fd.parcelas)||1));
      const nRec  = Math.max(1, Math.min(60, parseInt(fd.recorrente)||1));
      if (nParc > 1 && nRec > 1) throw new Error('Use parcelas OU repetição mensal, não os dois ao mesmo tempo.');
      const dup = duplicado(d);
      if (dup && !(await confirmar(`Já existe um lançamento igual em ${D(dup.data)} (${esc(dup.descricao)} · ${R(dup.valor)}). Lançar mesmo assim?`, 'Lançar mesmo assim', false))) return false;
      if (nParc > 1) {
        const gp = uid(), base = Math.floor(d.valor / nParc * 100) / 100;
        for (let i = 0; i < nParc; i++) {
          const v = i === nParc-1 ? round2(d.valor - base*(nParc-1)) : base;
          const venc = addMeses(d.vencimento, i);
          await criarLanc({ ...d, valor:v, vencimento:venc, grupoParcela:gp, parcela:`${i+1}/${nParc}`, descricao:`${d.descricao} (${i+1}/${nParc})` },
            { pagoAgora: quit && i === 0 ? v : 0, contaId:d.contaId });
        }
        toast(`${nParc} parcelas lançadas.`);
      } else if (nRec > 1) {
        const gp = uid();
        for (let i = 0; i < nRec; i++) {
          const dt = addMeses(d.data, i);
          await criarLanc({ ...d, data:dt, vencimento:addMeses(d.vencimento, i), grupoParcela:gp, parcela:`rec ${i+1}/${nRec}` },
            { pagoAgora: quit && i === 0 ? d.valor : 0, contaId:d.contaId, dataPg:dt });
        }
        toast(`${nRec} lançamentos mensais criados.`);
      } else {
        await criarLanc(d, { pagoAgora: quit ? d.valor : 0, contaId:d.contaId });
        toast('Lançamento registrado.');
      }
    }
  });
}

function abrirPagamento(l){
  const rest = restante(l), rec = l.tipo === 'receita';
  const hist = (l.pagamentos||[]).map(p => `<tr><td>${D(p.data)}</td><td>${esc((byId('contas',p.contaId)||{}).nome||'—')}</td><td class="n">${R(p.valor)}</td><td class="n"><button type="button" class="ico" data-act="desfazPg" data-id="${l.id}" data-pg="${p.id}">desfazer</button></td></tr>`).join('');
  modal({ title: rec ? 'Registrar recebimento' : 'Registrar pagamento', submit: rec ? 'Receber' : 'Pagar',
    html: `<div class="dl"><div><span>Lançamento</span><b>${esc(l.descricao||l.categoria)}</b></div><div><span>Valor</span><b>${R(l.valor)}</b></div><div><span>Em aberto</span><b>${R(rest)}</b></div></div>
      ${hist ? `<div class="tw" style="margin-bottom:14px"><table><thead><tr><th>Data</th><th>Conta</th><th class="n">Valor</th><th></th></tr></thead><tbody>${hist}</tbody></table></div>` : ''}
      ${rest > 0 ? `<div class="fg">${fDate('data', 'Data')}${fNum('valor','Valor (R$)', rest)}${fSel('contaId','Conta', contaOpts(), l.contaId || contaPadrao())}${fSel('forma','Forma', FORMAS, l.forma||'PIX')}</div>
      <p class="small muted">Para pagamento parcial, informe um valor menor que o saldo em aberto.</p>` : '<div class="note">Lançamento quitado.</div>'}`,
    onSubmit: rest > 0 ? async fd => {
      exigeEscrita();
      const v = reqPos(fd.valor, 'o valor'); reqData(fd.data);
      if (!fd.contaId) throw new Error('Selecione a conta.');
      if (v > rest + 0.005) throw new Error(`Valor maior que o saldo em aberto (${R(rest)}).`);
      const pgs = [ ...(l.pagamentos||[]), { id:uid(), data:fd.data, valor:round2(v), contaId:fd.contaId } ];
      await dbUpd('lancamentos', l.id, { pagamentos:pgs, forma:fd.forma });
      await audit(rec ? 'receber' : 'pagar', 'lancamentos', l.id, R(v));
      toast(rec ? 'Recebimento registrado.' : 'Pagamento registrado.');
    } : null });
}

async function excluirLanc(l){
  if (l.origem && l.origem !== 'manual') { toast('Lançamento automático: estorne a movimentação de origem (venda/compra) no módulo do animal.', true); return; }
  const irmaos = l.grupoParcela ? A('lancamentos').filter(x => x.grupoParcela === l.grupoParcela && x.id !== l.id && !pagoDe(x)) : [];
  const ok = await confirmar(`Excluir o lançamento <b>${esc(l.descricao||l.categoria)}</b> de ${R(l.valor)}? O registro fica guardado na auditoria (exclusão lógica).` +
    (irmaos.length ? `<br><br>Existem ${irmaos.length} outras parcelas/repetições em aberto deste grupo — elas também serão excluídas.` : ''), 'Excluir');
  if (!ok) return;
  try {
    exigeEscrita();
    for (const x of [l, ...irmaos]) {
      await dbUpd('lancamentos', x.id, { excluido:true, excluidoEm:stamp() });
      await audit('excluir', 'lancamentos', x.id, `${x.categoria} ${R(x.valor)}`);
    }
    toast('Lançamento excluído.');
  } catch(e){ falha(e); }
}

/* ---------- Página Financeiro ---------- */
function filtraLancs(prefix){
  const [ini, fim] = periodo(prefix);
  const tipo = uiGet(prefix+'Tipo',''), atv = uiGet(prefix+'Atv',''), cat = uiGet(prefix+'Cat',''), st = uiGet(prefix+'St',''), q = (uiGet(prefix+'Q','')||'').toLowerCase();
  return A('lancamentos').filter(l => inRange(l.data, ini, fim) && (!tipo || l.tipo === tipo) && (!atv || l.atividade === atv) && (!cat || l.categoria === cat) &&
    (!st || statusL(l) === st || (st === 'aberto' && !quitado(l))) && (!q || `${l.descricao} ${l.contraparte} ${l.categoria} ${l.local}`.toLowerCase().includes(q)))
    .sort((a,b) => (b.data||'').localeCompare(a.data||'') || (b.criadoEm||'').localeCompare(a.criadoEm||''));
}
function tabelaLancs(L, { acoes=true, venc=false } = {}){
  if (!L.length) return `<div class="tw">${vazio('Nenhum lançamento encontrado', 'Ajuste os filtros ou registre um novo lançamento.')}</div>`;
  const tr = L.slice(0, 500).map(l => `<tr>
      <td>${D(venc ? l.vencimento : l.data)}</td>
      <td><span class="badge ${l.tipo==='receita'?'b-ok':'b-err'}">${l.tipo==='receita'?'Receita':'Despesa'}</span></td>
      <td>${dotAtv(l.atividade)}</td>
      <td>${esc(l.categoria)}${l.classificacao && l.classificacao!=='operacional' ? `<div class="small muted">${esc(CLASSIF[l.classificacao])}</div>` : ''}</td>
      <td>${esc(l.descricao)}${l.contraparte?`<div class="small muted">${esc(l.contraparte)}</div>`:''}</td>
      <td class="n ${l.tipo==='receita'?'pos':''}">${R(l.valor)}</td>
      <td class="n">${R(pagoDe(l))}</td>
      <td>${badgeStatus(statusL(l))}</td>
      ${acoes ? `<td><div class="acts">
        ${!quitado(l) ? `<button class="ico" data-act="pagar" data-id="${l.id}">${l.tipo==='receita'?'Receber':'Pagar'}</button>` : `<button class="ico" data-act="pagar" data-id="${l.id}">Pgtos</button>`}
        <button class="ico" data-act="editLanc" data-id="${l.id}">Editar</button>
        <button class="ico" data-act="delLanc" data-id="${l.id}" title="Excluir">✕</button></div></td>` : ''}
    </tr>`).join('');
  const rec = sum(L.filter(l=>l.tipo==='receita'), l=>l.valor), des = sum(L.filter(l=>l.tipo==='despesa'), l=>l.valor);
  return `<div class="tw"><table><thead><tr><th>${venc?'Vencimento':'Data'}</th><th>Tipo</th><th>Atividade</th><th>Categoria</th><th>Descrição</th><th class="n">Valor</th><th class="n">Pago/Rec.</th><th>Situação</th>${acoes?'<th></th>':''}</tr></thead>
    <tbody>${tr}</tbody><tfoot><tr><td colspan="5">${L.length} lançamento(s)${L.length>500?' · mostrando 500':''} · Receitas ${R(rec)} · Despesas ${R(des)}</td><td class="n ${rec-des<0?'neg':'pos'}">${R(rec-des)}</td><td colspan="${acoes?3:2}"></td></tr></tfoot></table></div>`;
}

function pgFinanceiro(){
  const tab = uiGet('finTab','lanc');
  let body = '';
  if (tab === 'lanc') {
    const L = filtraLancs('fin');
    const cats = [...new Set(A('lancamentos').map(l => l.categoria))].sort();
    body = `<div class="bar">${filtroPeriodo('fin')}
      <label class="fld"><span>Tipo</span><select data-filter="finTipo">${opts([['receita','Receitas'],['despesa','Despesas']], uiGet('finTipo',''), 'Todos')}</select></label>
      <label class="fld"><span>Atividade</span><select data-filter="finAtv">${opts(Object.entries(ATIVIDADES), uiGet('finAtv',''), 'Todas')}</select></label>
      <label class="fld"><span>Categoria</span><select data-filter="finCat">${opts(cats, uiGet('finCat',''), 'Todas')}</select></label>
      <label class="fld"><span>Situação</span><select data-filter="finSt">${opts([['aberto','Em aberto'],['pendente','Pendente'],['vencido','Vencido'],['parcial','Parcial'],['pago','Pago'],['recebido','Recebido']], uiGet('finSt',''), 'Todas')}</select></label>
      <label class="fld grow"><span>Buscar</span><input data-filter="finQ" value="${esc(uiGet('finQ',''))}" placeholder="descrição, fornecedor…"></label>
      <button class="btn ghost" data-act="expLancs">Exportar Excel</button></div>${tabelaLancs(L)}`;
  } else if (tab === 'pagar' || tab === 'receber') {
    const tipo = tab === 'pagar' ? 'despesa' : 'receita';
    const L = abertos(tipo).sort((a,b) => (a.vencimento||'').localeCompare(b.vencimento||''));
    const venc = L.filter(l => statusL(l) === 'vencido'), prox = L.filter(l => statusL(l) !== 'vencido' && (l.vencimento||'') <= addMeses(hoje(),0).slice(0,8)+'31');
    body = `<div class="grid g3" style="margin-bottom:14px">
      ${kpi('Total em aberto', R(sum(L, restante)), L.length+' lançamento(s)', tab==='pagar'?'red':'green')}
      ${kpi('Vencidos', R(sum(venc, restante)), venc.length+' lançamento(s)', 'red')}
      ${kpi('Vencem neste mês', R(sum(prox, restante)), prox.length+' lançamento(s)', 'gold')}</div>
      ${tabelaLancs(L, { venc:true })}`;
  } else if (tab === 'fluxo') {
    const ano = +uiGet('fluxoAno', +hoje().slice(0,4));
    const anos = [...new Set([+hoje().slice(0,4), ...A('lancamentos').map(l => +(l.data||'0').slice(0,4))])].filter(Boolean).sort();
    let acum = round2(sum(A('contas'), c => c.saldoInicial) + caixa('0000-01-01', (ano-1)+'-12-31').liq);
    const ini0 = acum;
    const rows = MESES.map((m,i) => {
      const mm = `${ano}-${String(i+1).padStart(2,'0')}`; const c = caixa(mm+'-01', mesFim(mm+'-01'));
      acum = round2(acum + c.liq);
      return `<tr><td>${m}/${ano}</td><td class="n pos">${R(c.ent)}</td><td class="n neg">${R(c.sai)}</td><td class="n ${c.liq<0?'neg':''}">${R(c.liq)}</td><td class="n"><b>${R(acum)}</b></td></tr>`;
    }).join('');
    const tot = caixa(ano+'-01-01', ano+'-12-31');
    body = `<div class="bar"><label class="fld"><span>Ano</span><select data-filter="fluxoAno">${opts(anos, ano)}</select></label>
      <span class="small muted" style="align-self:center">Regime de caixa: considera somente valores efetivamente pagos e recebidos.</span></div>
      <div class="tw"><table><thead><tr><th>Mês</th><th class="n">Entradas</th><th class="n">Saídas</th><th class="n">Saldo do mês</th><th class="n">Saldo acumulado</th></tr></thead>
      <tbody><tr><td class="muted">Saldo inicial</td><td></td><td></td><td></td><td class="n">${R(ini0)}</td></tr>${rows}</tbody>
      <tfoot><tr><td>Total ${ano}</td><td class="n">${R(tot.ent)}</td><td class="n">${R(tot.sai)}</td><td class="n">${R(tot.liq)}</td><td class="n">${R(acum)}</td></tr></tfoot></table></div>`;
  } else if (tab === 'contas') {
    const cs = A('contas');
    body = `<div class="bar"><button class="btn primary" data-act="novaConta">+ Nova conta</button><span class="small muted" style="align-self:center">Caixa, conta bancária, poupança… O saldo é calculado pelos pagamentos e recebimentos registrados.</span></div>
      ${cs.length ? `<div class="tw"><table><thead><tr><th>Conta</th><th>Tipo</th><th class="n">Saldo inicial</th><th class="n">Saldo atual</th><th></th></tr></thead><tbody>
      ${cs.map(c => `<tr><td><b>${esc(c.nome)}</b>${c.padrao?' <span class="badge b-ok">padrão</span>':''}</td><td>${esc(c.tipoConta||'')}</td><td class="n">${R(c.saldoInicial)}</td><td class="n"><b class="${saldoConta(c)<0?'neg':''}">${R(saldoConta(c))}</b></td>
        <td><div class="acts"><button class="ico" data-act="editConta" data-id="${c.id}">Editar</button></div></td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="3">Saldo financeiro disponível</td><td class="n">${R(saldoTotal())}</td><td></td></tr></tfoot></table></div>` : `<div class="tw">${vazio('Nenhuma conta cadastrada', 'Cadastre ao menos uma conta (ex.: “Caixa” ou “Banco”) para controlar o saldo.')}</div>`}`;
  }
  const ap = sum(abertos('despesa'), restante), ar = sum(abertos('receita'), restante);
  return `<div class="grid g4" style="margin-bottom:16px">
      ${kpi('Saldo disponível', R(saldoTotal()), A('contas').length+' conta(s)', 'gold')}
      ${kpi('Contas a pagar', R(ap), abertos('despesa').length+' em aberto', 'red')}
      ${kpi('Contas a receber', R(ar), abertos('receita').length+' em aberto', 'green')}
      ${kpi('Saldo projetado', R(saldoTotal()+ar-ap), 'disponível + receber − pagar', 'blue')}</div>
    <div class="bar"><button class="btn primary" data-act="novoLanc">+ Novo lançamento</button>
      <button class="btn ghost" data-act="novoLancTipo" data-tipo="receita">+ Receita</button>
      <button class="btn ghost" data-act="novoLancTipo" data-tipo="despesa">+ Despesa</button></div>
    ${tabs('finTab', [['lanc','Lançamentos'],['pagar','Contas a pagar'],['receber','Contas a receber'],['fluxo','Fluxo de caixa'],['contas','Contas financeiras']], 'lanc')}
    ${body}`;
}

function abrirConta(c = null){
  modal({ title: c ? 'Editar conta' : 'Nova conta financeira',
    html: `<div class="fg">${fInp('nome','Nome da conta', c?.nome||'', 'full placeholder="Ex.: Caixa, Banco do Brasil"')}
      ${fSel('tipoConta','Tipo', ['Caixa','Conta corrente','Poupança','Carteira digital','Outra'], c?.tipoConta||'Caixa')}
      ${fNum('saldoInicial','Saldo inicial (R$)', c?.saldoInicial||'')}
      <label class="fld full" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="padrao" ${c?.padrao||!A('contas').length?'checked':''} style="width:auto"> Conta padrão nos lançamentos</label></div>`,
    async onSubmit(fd){
      exigeEscrita();
      const d = { nome:reqTxt(fd.nome,'o nome'), tipoConta:fd.tipoConta, saldoInicial:num(fd.saldoInicial), padrao:!!fd.padrao };
      if (A('contas').some(x => x.nome.toLowerCase() === d.nome.toLowerCase() && x.id !== c?.id)) throw new Error('Já existe uma conta com esse nome.');
      if (d.padrao) for (const x of A('contas').filter(x => x.padrao && x.id !== c?.id)) await dbUpd('contas', x.id, { padrao:false });
      if (c) { await dbUpd('contas', c.id, d); await audit('editar','contas',c.id,d.nome); }
      else { const id = novoId('contas'); await dbSet('contas', id, d); await audit('criar','contas',id,d.nome); }
      toast('Conta salva.');
    } });
}
