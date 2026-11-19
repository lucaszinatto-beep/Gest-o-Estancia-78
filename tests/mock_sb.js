(function(){
  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  const store = { docs:{}, membros:{ 'lucas@teste.com':{ email:'lucas@teste.com', nome:'Lucas' } } };
  const users = { 'lucas@teste.com':'segredo1', 'intruso@teste.com':'segredo1' };
  const chans = [];
  window.__sb = { store, writes:0, externo(colecao, id, data){ const r = { colecao, id, data }; store.docs[colecao+'|'+id] = r; chans.forEach(fn => fn({ eventType:'INSERT', new:clone(r), old:{} })); } };
  function qb(table){
    const filters = []; let rng = null, single = false, op = 'select', payload = null;
    const b = {
      select(){ return b; }, order(){ return b; },
      eq(f, v){ filters.push(r => r[f] === v); return b; },
      ilike(f, v){ filters.push(r => String(r[f]).toLowerCase() === String(v).toLowerCase()); return b; },
      range(a, z){ rng = [a, z]; return b; }, maybeSingle(){ single = true; return b; },
      upsert(rows){ op = 'upsert'; payload = Array.isArray(rows) ? rows : [rows]; return b; },
      then(res, rej){ return new Promise(r => setTimeout(r, 5)).then(run).then(res, rej); }
    };
    function run(){
      if (!sessao) return { data:null, error:{ message:'JWT expired' } };
      const membro = !!store.membros[sessao.user.email];
      if (op === 'upsert') {
        if (!membro) return { error:{ message:'new row violates row-level security policy' } };
        for (const r of payload) { store[table][r.colecao + '|' + r.id] = clone(r); window.__sb.writes++; }
        return { error:null };
      }
      let rows = Object.values(store[table]);
      if (table === 'docs' && !membro) rows = [];
      if (table === 'membros') rows = rows.filter(r => r.email === sessao.user.email);
      rows = rows.filter(r => filters.every(f => f(r)));
      if (rng) rows = rows.slice(rng[0], rng[1] + 1);
      return { data: single ? clone(rows[0] || null) : rows.map(clone), error:null };
    }
    return b;
  }
  let sessao = null;
  try { const s = sessionStorage.getItem('mocksb'); if (s) sessao = JSON.parse(s); } catch(e){}
  const authCbs = [];
  window.supabase = { createClient(){ return {
    from: t => qb(t),
    channel(){ const c = { on(_, __, fn){ chans.push(fn); return c; }, subscribe(){ return c; } }; return c; },
    auth: {
      getSession: async () => ({ data:{ session:sessao } }),
      signInWithPassword: async ({ email, password }) => {
        if (users[email] !== password) return { data:{}, error:{ message:'Invalid login credentials' } };
        sessao = { user:{ id:'uid-'+email, email, user_metadata:{} } }; sessionStorage.setItem('mocksb', JSON.stringify(sessao));
        return { data:{ session:sessao }, error:null };
      },
      signUp: async ({ email, password }) => { users[email] = password; return { data:{ session:null }, error:null }; },
      signOut: async () => { sessao = null; sessionStorage.removeItem('mocksb'); authCbs.forEach(f => f('SIGNED_OUT', null)); return {}; },
      resetPasswordForEmail: async () => ({ error:null }),
      updateUser: async () => ({ error:null }),
      onAuthStateChange(fn){ authCbs.push(fn); return { data:{ subscription:{ unsubscribe(){} } } }; }
    } }; } };
})();
