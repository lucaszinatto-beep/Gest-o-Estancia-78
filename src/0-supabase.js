'use strict';
/* =====================================================================
   Adaptador Supabase — mesma interface usada pelo sistema
   (collection/doc/set/update/onSnapshot), sobre a tabela public.docs
   (colecao, id, data jsonb). Tempo real via Supabase Realtime.
   ===================================================================== */
function sbMerge(a, b){
  const o = { ...(a||{}) };
  for (const k in b) { const v = b[k];
    o[k] = (v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) ? sbMerge(o[k], v) : v; }
  return o;
}
function sbErro(error){
  const m = (error && (error.message || error.details)) || String(error);
  let code = 'unavailable';
  if (/row-level security|permission|not authorized|JWT/i.test(m)) code = 'invalid_argument';
  else if (/rate|too many/i.test(m)) code = 'resource_exhausted';
  return { code, message:m };
}
function sbNovoId(){
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g,'').slice(0,20);
  return Date.now().toString(36) + Math.random().toString(36).slice(2,12);
}
function criarAdaptadorSupabase(client){
  const cache = {};            // colecao -> Map(id -> data)
  const subs = {};             // colecao -> Set(fn)
  const carregando = {};
  const emitir = c => (subs[c] || []).forEach(fn => { try { fn(); } catch(e){ console.error(e); } });
  async function carregar(c){
    if (carregando[c]) return carregando[c];
    carregando[c] = (async () => {
      const m = new Map(); let de = 0;
      for (;;) {
        const { data, error } = await client.from('docs').select('id,data').eq('colecao', c).order('id').range(de, de + 999);
        if (error) throw sbErro(error);
        data.forEach(r => m.set(r.id, r.data));
        if (data.length < 1000) break; de += 1000;
      }
      cache[c] = m;
    })();
    return carregando[c];
  }
  async function gravar(c, id, data){
    const { error } = await client.from('docs').upsert({ colecao:c, id, data }, { onConflict:'colecao,id' });
    if (error) throw sbErro(error);
    (cache[c] = cache[c] || new Map()).set(id, data); emitir(c);
  }
  const snapDoc = (c, id) => { const d = cache[c] && cache[c].get(id); return { id, exists:!!d, data:() => d, metadata:{ fromCache:false, hasPendingWrites:false } }; };
  function docRef(c, id){
    return { id, path:c + '/' + id,
      get: async () => { if (!cache[c]) await carregar(c); return snapDoc(c, id); },
      set: d => gravar(c, id, JSON.parse(JSON.stringify(d))),
      update: async d => {
        let atual = cache[c] && cache[c].get(id);
        if (!atual) {
          const { data, error } = await client.from('docs').select('data').eq('colecao', c).eq('id', id).maybeSingle();
          if (error) throw sbErro(error);
          if (!data) throw { code:'invalid_argument', message:'Registro não encontrado.' };
          atual = data.data;
        }
        return gravar(c, id, sbMerge(atual, JSON.parse(JSON.stringify(d))));
      },
      onSnapshot(next, err){
        const fn = () => next(snapDoc(c, id));
        (subs[c] = subs[c] || new Set()).add(fn);
        (cache[c] ? Promise.resolve() : carregar(c)).then(fn).catch(e => err && err(e));
        return () => subs[c].delete(fn);
      } };
  }
  function colRef(c, q = {}){
    return { path:c,
      doc: id => docRef(c, id || sbNovoId()),
      add: async d => { const r = docRef(c, sbNovoId()); await r.set(d); return r; },
      where: () => colRef(c, q),
      orderBy: (f, dir) => colRef(c, { ...q, order:[f, dir] }),
      limit: n => colRef(c, { ...q, limit:n }),
      onSnapshot(next, err){
        const fn = () => {
          let docs = [...(cache[c] || new Map()).entries()].map(([id, d]) => ({ id, exists:true, data:() => d, metadata:{ fromCache:false } }));
          if (q.order) { const [f, dir] = q.order; docs.sort((a,b) => { const x = a.data()[f], y = b.data()[f]; return (x > y ? 1 : x < y ? -1 : 0) * (dir === 'desc' ? -1 : 1); }); }
          if (q.limit) docs = docs.slice(0, q.limit);
          next({ docs, size:docs.length, empty:!docs.length, docChanges:() => [], metadata:{ fromCache:false, hasPendingWrites:false } });
        };
        (subs[c] = subs[c] || new Set()).add(fn);
        (cache[c] ? Promise.resolve() : carregar(c)).then(fn).catch(e => err && err(e));
        return () => subs[c].delete(fn);
      } };
  }
  // Tempo real: alterações feitas em outro aparelho
  client.channel('estancia78-docs')
    .on('postgres_changes', { event:'*', schema:'public', table:'docs' }, p => {
      const r = (p.new && p.new.colecao) ? p.new : p.old; if (!r || !r.colecao) return;
      const m = (cache[r.colecao] = cache[r.colecao] || new Map());
      if (p.eventType === 'DELETE') m.delete(r.id); else m.set(r.id, r.data);
      emitir(r.colecao);
    }).subscribe();
  // Ao voltar para a aba (celular), recarrega para garantir sincronia
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    for (const c of Object.keys(subs)) { carregando[c] = null; try { await carregar(c); emitir(c); } catch(e){} }
  });
  return {
    collection: c => colRef(c),
    doc: p => { const [c, id] = p.split('/'); return docRef(c, id); },
    importar: async (linhas) => {           // [{colecao,id,data}]
      for (let i = 0; i < linhas.length; i += 400) {
        const lote = linhas.slice(i, i + 400);
        const { error } = await client.from('docs').upsert(lote, { onConflict:'colecao,id' });
        if (error) throw sbErro(error);
        for (const r of lote) (cache[r.colecao] = cache[r.colecao] || new Map()).set(r.id, r.data);
      }
      Object.keys(subs).forEach(emitir);
    }
  };
}

/* Downloads no navegador comum (Vercel) */
const downloadsNavegador = {
  save: async ({ filename, data }) => {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { status:'saved' };
  }
};

/* Login (e-mail e senha) */
function sbIniciar(cfgSb){
  const client = window.supabase.createClient(cfgSb.supabaseUrl, cfgSb.supabaseAnonKey, { auth:{ persistSession:true, autoRefreshToken:true } });
  S.sb = client;
  return new Promise(async (resolve) => {
    async function entrar(sessao){
      const u = sessao.user;
      const { data:mb, error } = await client.from('membros').select('email,nome').ilike('email', u.email).maybeSingle();
      if (error || !mb) {
        telaLogin(`O e-mail <b>${esc(u.email)}</b> entrou, mas não está autorizado a acessar a Estância 78. Peça ao proprietário para incluí-lo na tabela <i>membros</i> do Supabase.`, true);
        return;
      }
      resolve({ db:criarAdaptadorSupabase(client), uid:u.id, nome:mb.nome || (u.user_metadata && u.user_metadata.nome) || u.email });
    }
    function telaLogin(msg = '', erro = false){
      $('#splash-msg').innerHTML = `
        <form id="fLogin" class="login" autocomplete="on">
          ${msg ? `<div class="lmsg ${erro?'err':''}">${msg}</div>` : ''}
          <input name="email" type="email" placeholder="E-mail" required autocomplete="username">
          <input name="senha" type="password" placeholder="Senha" required autocomplete="current-password" minlength="6">
          <button class="btn gold" type="submit" style="justify-content:center">Entrar</button>
          <div class="lrow"><a href="#" data-l="cadastro">Criar acesso</a><a href="#" data-l="senha">Esqueci a senha</a>${erro?'<a href="#" data-l="sair">Sair</a>':''}</div>
        </form>`;
      const f = $('#fLogin');
      f.addEventListener('submit', async e => {
        e.preventDefault(); const b = f.querySelector('button'); b.disabled = true; b.textContent = 'Entrando…';
        const { data, error } = await client.auth.signInWithPassword({ email:f.email.value.trim(), password:f.senha.value });
        if (error) { telaLogin(/Invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : /confirm/i.test(error.message) ? 'Confirme seu e-mail pelo link enviado antes de entrar.' : esc(error.message), true); return; }
        $('#splash-msg').textContent = 'Carregando dados…'; entrar(data.session);
      });
      f.addEventListener('click', async e => {
        const a = e.target.closest('[data-l]'); if (!a) return; e.preventDefault();
        const email = f.email.value.trim();
        if (a.dataset.l === 'sair') { await client.auth.signOut(); telaLogin(); return; }
        if (!email) { telaLogin('Digite seu e-mail primeiro.', true); return; }
        if (a.dataset.l === 'senha') {
          const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
          telaLogin(error ? esc(error.message) : 'Enviamos um link para redefinir a senha no seu e-mail.', !!error); return;
        }
        if (!f.senha.value || f.senha.value.length < 6) { telaLogin('Para criar o acesso, digite também uma senha com pelo menos 6 caracteres.', true); return; }
        const { data, error } = await client.auth.signUp({ email, password:f.senha.value, options:{ emailRedirectTo: location.origin + location.pathname } });
        if (error) { telaLogin(esc(error.message), true); return; }
        if (data.session) { $('#splash-msg').textContent = 'Carregando dados…'; entrar(data.session); }
        else telaLogin('Acesso criado. Confirme pelo link enviado ao seu e-mail e depois entre.');
      });
    }
    client.auth.onAuthStateChange((ev, sessao) => {
      if (ev === 'PASSWORD_RECOVERY') novaSenha();
      if (ev === 'SIGNED_OUT' && S.db) location.reload();
    });
    async function novaSenha(){
      const m = modal({ title:'Definir nova senha', html:fInp('senha','Nova senha (mín. 6 caracteres)','', '', 'password'), submit:'Salvar senha',
        async onSubmit(fd){ if ((fd.senha||'').length < 6) throw new Error('Mínimo de 6 caracteres.'); const { error } = await client.auth.updateUser({ password:fd.senha }); if (error) throw new Error(error.message); toast('Senha alterada.'); } });
      return m;
    }
    const { data } = await client.auth.getSession();
    if (data && data.session) entrar(data.session); else telaLogin();
  });
}
