'use strict';
/* =====================================================================
   ESTÂNCIA 78 – GESTÃO RURAL · núcleo
   Banco: coleções no db do Claude (somente proprietário/editores)
     lancamentos · contas · animais · lotes · movimentacoes · ovos · auditoria · config/geral
   ===================================================================== */

/* ---------- Constantes de domínio ---------- */
const ESPECIES = {
  bovino:  { nome:'Bovinos',  sing:'Bovino',  atividade:'bovinos',  cor:'var(--c-bov)' },
  suino:   { nome:'Suínos',   sing:'Suíno',   atividade:'suinos',   cor:'var(--c-sui)' },
  galinha: { nome:'Galinhas', sing:'Galinha', atividade:'galinhas', cor:'var(--c-gal)' }
};
const ATIVIDADES = { bovinos:'Bovinos', suinos:'Suínos', galinhas:'Galinhas', geral:'Despesas Gerais' };
const ATV_ESPECIE = { bovinos:'bovino', suinos:'suino', galinhas:'galinha' };
const CORES = { bovinos:'#1a7f4b', suinos:'#c4462e', galinhas:'#2d6cc8', geral:'#a8780a', receita:'#1a7f4b', despesa:'#c4462e', neutro:'#6b7a3a' };

const CLASSIF = {
  operacional:'Despesa operacional',
  geral:'Despesa geral',
  investimento:'Investimento em infraestrutura',
  patrimonio:'Aquisição de patrimônio',
  manutencao:'Manutenção e conservação'
};
const CLASSIF_ECON = ['operacional','geral','manutencao'];   // entram no resultado econômico
const CLASSIF_INV  = ['investimento','patrimonio'];          // tratados como investimento

const CAT_RECEITA = {
  bovinos:['Venda de bovinos','Outras receitas'],
  suinos:['Venda de suínos','Venda de leitões','Venda de leitões desmamados','Venda de porcos inteiros','Venda de matrizes/reprodutores','Venda de esterco','Outras receitas da suinocultura'],
  galinhas:['Venda de galinhas','Venda de ovos','Venda de esterco','Outras receitas'],
  geral:['Venda de outros produtos','Venda de esterco','Outras receitas']
};
const CAT_DESP_ANIMAL = ['Ração','Milho','Sal mineral','Suplementos','Medicamentos','Vacinas','Vermífugos','Alimentação','Mão de obra','Combustível','Transporte','Manutenção operacional','Outros custos'];
const COMPRA_CAT = { bovinos:'Compra de bovinos', suinos:'Compra de suínos', galinhas:'Compra de galinhas' };

const GRUPOS_GERAIS = {
  cercas:{ nome:'Cercas e estruturas', classif:'investimento', itens:['Arame','Mourões','Palanques','Grampos','Telas','Porteiras','Colchetes','Construção de cercas','Manutenção de cercas','Divisórias de pastagem','Currais','Bebedouros','Cochos','Encanamentos','Instalações hidráulicas'] },
  casa:{ nome:'Casa', classif:'investimento', itens:['Construção da casa','Reforma','Cimento','Areia','Pedra','Tijolos','Telhado','Madeira','Pintura','Instalação elétrica','Instalação hidráulica','Móveis','Eletrodomésticos','Utensílios','Manutenção da residência','Limpeza'] },
  instalacoes:{ nome:'Instalações rurais', classif:'investimento', itens:['Construção de galinheiros','Construção de chiqueiros','Construção de galpões','Construção de depósitos','Reforma de instalações','Equipamentos','Máquinas','Ferramentas','Sistemas de água','Sistemas elétricos'] },
  gerais:{ nome:'Despesas gerais', classif:'geral', itens:['Energia elétrica','Água','Internet','Combustível','Roçada','Limpeza do terreno','Jardinagem','Mão de obra geral','Serviços terceirizados','Manutenção de veículos','Impostos','Taxas','Documentação','Outras despesas'] }
};
const ITENS_MANUT = ['Manutenção de cercas','Reforma','Manutenção da residência','Reforma de instalações','Manutenção de veículos','Limpeza'];
const ITENS_PATRIM = ['Móveis','Eletrodomésticos','Equipamentos','Máquinas','Ferramentas'];

const CAT_ANIMAL = {
  bovino:['Bezerro','Bezerra','Garrote','Novilha','Vaca','Touro','Boi','Boi de engorda'],
  suino:['Leitão recém-nascido','Leitão lactente','Leitão desmamado','Leitão para recria','Suíno em crescimento','Suíno para engorda','Porco terminado','Matriz','Leitoa','Cachaço / reprodutor'],
  galinha:['Caipira','Poedeira','Frango de corte','Pintinhos','Galos / reprodutores']
};
const PRODUTOS_VENDA = {
  bovino:[['Bovino por cabeça','Venda de bovinos'],['Bovino por kg (vivo)','Venda de bovinos'],['Boi gordo','Venda de bovinos'],['Vaca','Venda de bovinos'],['Bezerro(a)','Venda de bovinos'],['Novilha','Venda de bovinos'],['Touro','Venda de bovinos']],
  suino:[['Leitão recém-nascido','Venda de leitões'],['Leitão lactente','Venda de leitões'],['Leitão desmamado','Venda de leitões desmamados'],['Leitão para recria','Venda de leitões'],['Leitão para engorda','Venda de leitões'],['Porco inteiro','Venda de porcos inteiros'],['Porco para abate','Venda de porcos inteiros'],['Porco vivo por kg','Venda de porcos inteiros'],['Porco por cabeça','Venda de porcos inteiros'],['Porca','Venda de suínos'],['Matriz reprodutora','Venda de matrizes/reprodutores'],['Leitoa para reprodução','Venda de matrizes/reprodutores'],['Cachaço','Venda de matrizes/reprodutores']],
  galinha:[['Galinha viva','Venda de galinhas'],['Galinha para abate','Venda de galinhas'],['Frango','Venda de galinhas'],['Poedeira','Venda de galinhas'],['Pintinhos','Venda de galinhas'],['Galo','Venda de galinhas']]
};
const FORMAS = ['Dinheiro','PIX','Transferência','Cartão de débito','Cartão de crédito','Boleto','Cheque','Prazo / fiado','Outra'];

const MOV_NOMES = {
  compra:'Compra', venda:'Venda', nascimento:'Nascimento', mortalidade:'Mortalidade', entrada:'Entrada',
  saida:'Saída', descarte:'Descarte', ajuste:'Ajuste de inventário', transferencia:'Transferência de lote',
  local:'Transferência de local', categoria:'Mudança de categoria', desmame:'Desmame', pesagem:'Pesagem'
};

/* ---------- Utilidades ---------- */
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const R = v => (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const R0 = v => (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const N = (v,d=0) => (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const round2 = v => Math.round((Number(v)||0)*100)/100;
function num(v){
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/R\$\s?/,'').replace(/\s/g,'');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g,'').replace(',','.');
  const n = parseFloat(s); return isFinite(n) ? n : 0;
}
const numStr = v => (v === '' || v === null || v === undefined || Number(v) === 0) ? '' : String(round2(v)).replace('.',',');
function hoje(){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
function addMeses(iso, n){
  const [y,m,d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m-1+n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth()+1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d,last)); return t.toISOString().slice(0,10);
}
const D = iso => iso ? iso.slice(0,10).split('-').reverse().join('/') : '';
const mesIni = (iso=hoje()) => iso.slice(0,7)+'-01';
function mesFim(iso=hoje()){ const [y,m]=iso.split('-').map(Number); return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10); }
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const mesLabel = ym => MESES[+ym.slice(5,7)-1]+'/'+ym.slice(2,4);
const inRange = (d, ini, fim) => !!d && (!ini || d >= ini) && (!fim || d <= fim);
function diasEntre(a,b){ return Math.round((Date.parse(b)-Date.parse(a))/86400000); }
function idadeTxt(nasc){
  if (!nasc) return '—'; const d = diasEntre(nasc, hoje()); if (d < 0) return '—';
  if (d < 60) return d+' dias'; const m = Math.floor(d/30.44); if (m < 24) return m+' meses';
  const a = Math.floor(m/12), r = m%12; return a+' a'+(r?' '+r+' m':'');
}
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const sum = (arr, f) => arr.reduce((s,x)=>s+(Number(f(x))||0),0);

/* ---------- Estado ---------- */
const COLS = ['lancamentos','contas','animais','lotes','movimentacoes','ovos'];
const CFG_PADRAO = { catReceitaExtra:[], catDespesaExtra:[], catAnimalExtra:{bovino:[],suino:[],galinha:[]}, valorEstimado:{bovino:3500,suino:600,galinha:40}, locais:[] };
const S = {
  db:null, user:null, downloads:null, uid:null, nome:'',
  data:{ lancamentos:[], contas:[], animais:[], lotes:[], movimentacoes:[], ovos:[], auditoria:[] },
  loaded:new Set(), cfg:JSON.parse(JSON.stringify(CFG_PADRAO)), cfgExiste:false,
  ui:{}, page:'dashboard', charts:[], podeEscrever:true
};
const A = col => (S.data[col]||[]).filter(d => !d.excluido);
const byId = (col, id) => (S.data[col]||[]).find(d => d.id === id);
function cfg(){ return S.cfg; }
function catsAnimal(esp){ return [...CAT_ANIMAL[esp], ...((S.cfg.catAnimalExtra||{})[esp]||[])]; }
function catsReceita(atv){ return [...(CAT_RECEITA[atv]||CAT_RECEITA.geral), ...(S.cfg.catReceitaExtra||[])]; }
function catsDespesa(atv){
  if (atv === 'geral') return null; // usa grupos
  return [COMPRA_CAT[atv], ...CAT_DESP_ANIMAL, ...(S.cfg.catDespesaExtra||[])];
}
function uiGet(k, def){ return (k in S.ui) ? S.ui[k] : def; }

/* ---------- Banco de dados ---------- */
async function waitClaude(ms=10000){
  const t0 = Date.now();
  while (!(window.claude && typeof window.claude.use === 'function')) {
    if (Date.now()-t0 > ms) return null;
    await new Promise(r => setTimeout(r, 100));
  }
  return window.claude;
}
function colRef(c){ return S.db.collection(c); }
function stamp(){ return new Date().toISOString(); }
function novoId(c){ return colRef(c).doc().id; }

async function dbSet(c, id, data){
  const body = { ...data, excluido:false, criadoEm:stamp(), criadoPor:S.uid||null, atualizadoEm:stamp() };
  await retry(() => colRef(c).doc(id).set(clean(body)));
  return id;
}
async function dbUpd(c, id, data){
  await retry(() => colRef(c).doc(id).update(clean({ ...data, atualizadoEm:stamp(), atualizadoPor:S.uid||null })));
}
function clean(o){ // remove undefined (JSON puro)
  return JSON.parse(JSON.stringify(o, (k,v) => v === undefined ? null : v));
}
async function retry(fn){
  try { return await fn(); }
  catch(e){
    if (e && e.code === 'unavailable') { await new Promise(r=>setTimeout(r, 400+Math.random()*600)); return await fn(); }
    throw traduzErro(e);
  }
}
function traduzErro(e){
  const c = e && e.code;
  const m = {
    invalid_argument:'O banco recusou a gravação (sem permissão de edição ou dado inválido).',
    quota_exceeded:'O limite de armazenamento do banco foi atingido. Exporte um backup e remova registros antigos.',
    resource_exhausted:'Muitas operações seguidas. Aguarde alguns segundos e tente de novo.',
    revoked:'O acesso a este sistema foi alterado. Recarregue a página.',
    unavailable:'Banco temporariamente indisponível. Tente novamente.'
  }[c];
  const err = new Error(m || (e && e.message) || String(e)); err.code = c; return err;
}
async function audit(acao, colecao, docId, resumo){
  try { await colRef('auditoria').doc(novoId('auditoria')).set(clean({ quando:stamp(), quem:S.uid, quemNome:S.nome||'', acao, colecao, docId, resumo })); }
  catch(e){ console.warn('auditoria', e); }
}

async function initDB(){
  const cfgSb = window.ESTANCIA_CONFIG || {};
  if (cfgSb.supabaseUrl && cfgSb.supabaseAnonKey && !/COLE_AQUI/.test(cfgSb.supabaseUrl + cfgSb.supabaseAnonKey)) {
    // Modo site próprio (Supabase + Vercel)
    if (!window.supabase) return semBanco('Não foi possível carregar o Supabase. Verifique a internet e recarregue a página.');
    S.modo = 'supabase';
    const r = await sbIniciar(cfgSb);
    S.db = r.db; S.uid = r.uid; S.nome = r.nome; S.downloads = downloadsNavegador;
    $('#btnSair').hidden = false;
  } else {
    // Modo Claude (artifact)
    S.modo = 'claude';
    const claude = await waitClaude();
    if (!claude) return semBanco('Banco de dados não configurado. Abra pelo Claude ou preencha o arquivo config.js com os dados do Supabase.');
    S.db = await claude.use('db');
    S.user = await claude.use('user');
    claude.use('downloads').then(d => S.downloads = d).catch(()=>{});
    if (!S.db) return semBanco('Entre na sua conta do Claude para acessar o banco de dados da Estância 78.');
    if (S.user) {
      try { S.uid = await S.user.id(); const me = await S.user.me(); S.nome = (me && me.name) || ''; } catch(e){}
      try { const w = await S.user.can('data.write'); if (w === false) S.podeEscrever = false; } catch(e){}
    }
  }
  $('#uname').textContent = S.nome || 'Proprietário';
  $('#uav').textContent = (S.nome || 'E').trim().charAt(0).toUpperCase();
  let timer = setTimeout(() => setDbState('warn','sem resposta do banco'), 10000);
  const pend = new Set([...COLS, 'config', 'auditoria']);
  const done = (k, fromCache) => { if (!fromCache) { pend.delete(k); S.loaded.add(k); } if (!pend.size) { clearTimeout(timer); setDbState('ok','sincronizado'); } hideSplash(); scheduleRender(); };
  for (const c of COLS) {
    colRef(c).onSnapshot(snap => {
      S.data[c] = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      done(c, snap.metadata && snap.metadata.fromCache);
    }, err => { clearTimeout(timer); setDbState('warn','erro: '+(err.code||'')); console.error(c, err); hideSplash(); });
  }
  colRef('auditoria').orderBy('quando','desc').limit(300).onSnapshot(snap => {
    S.data.auditoria = snap.docs.map(d => ({ id:d.id, ...d.data() })); done('auditoria', snap.metadata && snap.metadata.fromCache);
  }, err => console.error('auditoria', err));
  S.db.doc('config/geral').onSnapshot(snap => {
    S.cfgExiste = !!snap.exists;
    const d = snap.exists ? snap.data() : {};
    S.cfg = { ...JSON.parse(JSON.stringify(CFG_PADRAO)), ...d, catAnimalExtra:{ ...CFG_PADRAO.catAnimalExtra, ...(d.catAnimalExtra||{}) }, valorEstimado:{ ...CFG_PADRAO.valorEstimado, ...(d.valorEstimado||{}) } };
    done('config', snap.metadata && snap.metadata.fromCache);
  }, err => console.error('config', err));
  setTimeout(hideSplash, 2500);
}
async function salvarCfg(patch){
  const novo = clean({ ...S.cfg, ...patch, atualizadoEm:stamp() });
  await retry(() => S.db.doc('config/geral').set(novo));
}
function setDbState(cls, txt){ const el = $('#dbstate'); el.className = 'dbstate '+cls; el.textContent = txt; }
function hideSplash(){ const s = $('#splash'); if (s) s.remove(); }
function semBanco(msg){ $('#splash-msg').textContent = msg; setDbState('warn','sem banco'); }

/* ---------- Render loop ---------- */
let rq = null;
function scheduleRender(){ if (rq) return; rq = setTimeout(() => { rq = null; render(); }, 60); }
function render(){
  const act = document.activeElement;
  const key = act && act.closest && act.closest('#main') && act.dataset && (act.dataset.filter || act.id);
  const selStart = key && act.selectionStart;
  const pg = PAGES[S.page] || PAGES.dashboard;
  $('#ptitle').textContent = pg.titulo;
  $('#psub').textContent = pg.sub || '';
  renderMenu();
  const html = pg.render();
  if (html === S.lastHtml && S.lastPage === S.page && !S.forceRender) return;  // nada mudou na tela: não recria o DOM
  S.lastHtml = html; S.lastPage = S.page; S.forceRender = false;
  S.charts.forEach(c => { try { c.destroy(); } catch(e){} }); S.charts = [];
  $('#main').innerHTML = html;
  if (pg.after) pg.after();
  if (key) {
    const el = $(`#main [data-filter="${key}"]`) || document.getElementById(key);
    if (el) { el.focus(); try { if (selStart != null) el.setSelectionRange(selStart, selStart); } catch(e){} }
  }
}

/* ---------- Ícones ---------- */
const IC = {
  dashboard:'<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  financeiro:'<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  bovinos:'<path d="M4 5c1 3 3 4 6 4h4c3 0 5-1 6-4M8 9v6a4 4 0 0 0 8 0V9M10 19h4"/>',
  suinos:'<path d="M4 13a7 6 0 1 0 14 0 7 6 0 0 0-14 0zM18 12h2.5v3H18M8 7l-1-3 3 2M9 18v3M15 18v3"/>',
  galinhas:'<path d="M8 20h8M12 20v-3M6 10a6 6 0 0 0 12 1l3-1-3-2a5 5 0 0 0-9-2"/><circle cx="14" cy="8" r=".6"/>',
  manejo:'<path d="M9 2h6M12 2v4M5 10l7-4 7 4v10H5z"/><path d="M12 12v5M9.5 14.5h5"/>',
  reproducao:'<circle cx="9" cy="9" r="5"/><circle cx="15" cy="15" r="5"/>',
  calendario:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  estoque:'<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>',
  custos:'<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
  'despesas-gerais':'<path d="M3 21V10l9-6 9 6v11M9 21v-6h6v6"/>',
  patrimonio:'<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>',
  relatorios:'<path d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h6"/>',
  configuracoes:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
};
const MENU = [
  ['dashboard','Dashboard'],['financeiro','Financeiro'],['bovinos','Bovinos'],['suinos','Suínos'],['galinhas','Galinhas'],
  ['manejo','Manejo','Etapa 2'],['reproducao','Reprodução','Etapa 2'],['calendario','Calendário','Etapa 2'],['estoque','Estoque','Etapa 2'],
  ['custos','Custos','Etapa 3'],['despesas-gerais','Despesas Gerais'],['patrimonio','Patrimônio','Etapa 3'],['relatorios','Relatórios','Etapa 3'],['configuracoes','Configurações']
];
function renderMenu(){
  if (S.menuPage === S.page) return; S.menuPage = S.page;
  $('#menu').innerHTML = MENU.map(([k,t,tag]) =>
    `<a href="#${k}" class="${S.page===k?'on':''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>${t}${tag?`<span class="tag">${tag}</span>`:''}</a>`).join('');
}

/* ---------- Modal / diálogos / toast ---------- */
function modal({ title, html, submit='Salvar', onSubmit, onInit, wide=false, extraFooter='' }){
  const id = 'm'+uid();
  $('#modal-root').insertAdjacentHTML('beforeend',
    `<div class="mback" id="${id}"><div class="modal ${wide?'wide':''}" role="dialog" aria-modal="true">
      <header><h3>${esc(title)}</h3><button type="button" class="x" data-close aria-label="Fechar">×</button></header>
      <form novalidate autocomplete="off"><div class="mbody"><div class="ferr" hidden></div>${html}</div>
      <footer>${extraFooter}${onSubmit ? `<button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn primary" type="submit">${esc(submit)}</button>` : `<button type="button" class="btn ghost" data-close>Fechar</button>`}</footer>
      </form></div></div>`);
  const el = document.getElementById(id), form = el.querySelector('form');
  const close = () => el.remove();
  el.addEventListener('mousedown', e => { if (e.target === el) el._down = true; });
  el.addEventListener('click', e => {
    if (e.target.closest('[data-close]') || (e.target === el && el._down)) close();
    el._down = false;
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!onSubmit) return;
    const btn = form.querySelector('button[type=submit]');
    if (btn.disabled) return;           // evita duplo clique / duplicidade
    const errBox = form.querySelector('.ferr'); errBox.hidden = true;
    const fd = {}; new FormData(form).forEach((v,k) => { fd[k] = v; });
    btn.disabled = true; btn.textContent = 'Salvando…';
    try { const r = await onSubmit(fd, form); if (r !== false) close(); }
    catch(err){ errBox.textContent = err.message || String(err); errBox.hidden = false; errBox.scrollIntoView({block:'nearest'}); }
    finally { if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = submit; } }
  });
  if (onInit) onInit(form, el, close);
  const first = form.querySelector('input:not([type=hidden]):not([readonly]),select,textarea');
  if (first && window.innerWidth > 860) first.focus();
  return { el, form, close };
}
function confirmar(msg, ok='Confirmar', perigo=true){
  return new Promise(res => {
    let resolved = false;
    const m = modal({ title:'Confirmação', html:`<p style="margin:0;line-height:1.5">${msg}</p>`, submit:ok,
      onSubmit: async () => { resolved = true; res(true); } });
    if (perigo) m.form.querySelector('button[type=submit]').className = 'btn danger';
    new MutationObserver((_, obs) => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!resolved) res(false); } })
      .observe($('#modal-root'), { childList:true });
  });
}
function toast(msg, err=false){
  const t = document.createElement('div'); t.className = 'toast'+(err?' err':''); t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), err ? 5000 : 2600);
}
function falha(e){ console.error(e); toast(e.message || String(e), true); }
function exigeEscrita(){ if (!S.podeEscrever) throw new Error('Seu acesso a este sistema é somente leitura.'); if (!S.db) throw new Error('Banco de dados indisponível.'); }

/* ---------- Campos de formulário ---------- */
function opts(list, val, vazio){
  return (vazio !== undefined ? `<option value="">${esc(vazio)}</option>` : '') +
    list.map(o => { const [v,t] = Array.isArray(o) ? o : [o,o]; return `<option value="${esc(v)}" ${String(v)===String(val??'')?'selected':''}>${esc(t)}</option>`; }).join('');
}
const fSel = (name, label, list, val, extra='', vazio) => `<label class="fld ${extra.includes('full')?'full':''}"><span>${label}</span><select name="${name}" ${extra.replace('full','')}>${opts(list,val,vazio)}</select></label>`;
const fInp = (name, label, val='', extra='', type='text') => `<label class="fld ${extra.includes('full')?'full':''}"><span>${label}</span><input type="${type}" name="${name}" value="${esc(val)}" ${extra.replace('full','')}></label>`;
const fNum = (name, label, val='', extra='') => fInp(name, label, numStr(val) || (typeof val==='string'?val:''), 'inputmode="decimal" '+extra);
const fDate = (name, label, val=hoje(), extra='') => fInp(name, label, val, extra, 'date');
const fTxt = (name, label, val='') => `<label class="fld full"><span>${label}</span><textarea name="${name}">${esc(val)}</textarea></label>`;
function contaOpts(){ const cs = A('contas'); return cs.length ? cs.map(c => [c.id, c.nome]) : [['','(cadastre uma conta em Financeiro › Contas)']]; }
function contaPadrao(){ const cs = A('contas'); return (cs.find(c => c.padrao) || cs[0] || {}).id || ''; }
function reqTxt(v, nome){ if (!String(v||'').trim()) throw new Error(`Informe ${nome}.`); return String(v).trim(); }
function reqData(v, nome='a data'){ if (!/^\d{4}-\d{2}-\d{2}$/.test(v||'')) throw new Error(`Informe ${nome}.`); return v; }
function reqPos(v, nome){ const n = num(v); if (!(n > 0)) throw new Error(`Informe ${nome} (maior que zero).`); return n; }

/* ---------- Exportação ---------- */
async function salvarArquivo(nome, data){
  if (!S.downloads) { toast('Download indisponível nesta visualização.', true); return; }
  try { await S.downloads.save({ filename:nome, data }); toast('Arquivo pronto.'); }
  catch(e){ if (e && e.code === 'declined') return; toast('Não foi possível baixar: '+(e.message||e.code), true); }
}
async function exportarXLSX(nome, titulo, cab, linhas){
  if (!window.XLSX) {
    const csv = [cab, ...linhas].map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');
    return salvarArquivo(nome.replace(/\.xlsx$/,'.csv'), '﻿'+csv);
  }
  const aoa = [['ESTÂNCIA 78 – GESTÃO RURAL'], [titulo], ['Gerado em '+D(hoje())+' · Dados. Manejo. Resultado.'], [], cab, ...linhas];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cab.map((c,i) => ({ wch: Math.min(40, Math.max(10, String(c).length+2, ...linhas.slice(0,200).map(l => String(l[i]??'').length+1))) }));
  ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:Math.max(0,cab.length-1)}},{s:{r:1,c:0},e:{r:1,c:Math.max(0,cab.length-1)}}];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0,31).replace(/[\\/?*[\]:]/g,''));
  const buf = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  return salvarArquivo(nome, new Blob([buf]));
}

/* ---------- Componentes ---------- */
const kpi = (l, v, s='', cls='') => `<div class="kpi ${cls}"><div class="l">${l}</div><div class="v" title="${esc(String(v).replace(/<[^>]+>/g,''))}">${v}</div>${s?`<div class="s">${s}</div>`:''}</div>`;
function tabs(key, list, def){
  const cur = uiGet(key, def);
  return `<nav class="tabs">${list.map(([k,t]) => `<a data-act="tab" data-key="${key}" data-val="${k}" class="${cur===k?'on':''}">${t}</a>`).join('')}</nav>`;
}
function filtroPeriodo(prefix){
  const ini = uiGet(prefix+'Ini', mesIni()), fim = uiGet(prefix+'Fim', mesFim());
  return `<label class="fld"><span>De</span><input type="date" data-filter="${prefix}Ini" value="${ini}"></label>
    <label class="fld"><span>Até</span><input type="date" data-filter="${prefix}Fim" value="${fim}"></label>
    <div class="chips" style="align-self:center">
      <button class="chip" data-act="periodo" data-p="${prefix}" data-v="mes">Mês</button>
      <button class="chip" data-act="periodo" data-p="${prefix}" data-v="mesant">Mês anterior</button>
      <button class="chip" data-act="periodo" data-p="${prefix}" data-v="ano">Ano</button>
      <button class="chip" data-act="periodo" data-p="${prefix}" data-v="tudo">Tudo</button></div>`;
}
function periodo(prefix){ return [uiGet(prefix+'Ini', mesIni()), uiGet(prefix+'Fim', mesFim())]; }
function vazio(t, s=''){ return `<div class="empty"><b>${t}</b>${s}</div>`; }
function badgeStatus(st){
  const m = { pago:['b-ok','Pago'], recebido:['b-ok','Recebido'], parcial:['b-par','Parcial'], pendente:['b-pend','Pendente'], vencido:['b-err','Vencido'] }[st] || ['b-mut',st];
  return `<span class="badge ${m[0]}">${m[1]}</span>`;
}
function dotAtv(atv){ return `<span class="dot" style="background:${CORES[atv]||'#999'}"></span>${esc(ATIVIDADES[atv]||atv||'—')}`; }
