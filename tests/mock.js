(function(){
  const store = {}; const listeners = new Set(); let n = 0;
  const gid = () => 'id' + (++n).toString(36) + Math.random().toString(36).slice(2,6);
  const clone = o => JSON.parse(JSON.stringify(o));
  function merge(a, b){ const o = { ...a }; for (const k in b) { const v = b[k]; o[k] = (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) ? merge(a[k], v) : v; } return o; }
  function notify(){ setTimeout(() => { for (const L of [...listeners]) L.fire(); }, 0); }
  const meta = { fromCache:false, hasPendingWrites:false };
  function snapDoc(path){ const d = store[path]; return { id:path.split('/').pop(), exists:!!d, data:() => d ? clone(d) : undefined, metadata:meta }; }
  function colDocs(path, q){
    const segs = path.split('/').length;
    let docs = Object.keys(store).filter(k => k.startsWith(path + '/') && k.split('/').length === segs + 1).map(snapDoc);
    if (q.order) { const [f, dir] = q.order; docs.sort((a,b) => { const x = a.data()[f], y = b.data()[f]; return (x > y ? 1 : x < y ? -1 : 0) * (dir === 'desc' ? -1 : 1); }); }
    if (q.limit) docs = docs.slice(0, q.limit);
    return docs;
  }
  function docRef(path){
    return { id:path.split('/').pop(), path,
      get: async () => snapDoc(path),
      set: async d => { if (window.__failNext) { window.__failNext = false; throw { code:'invalid_argument', message:'mock fail' }; } store[path] = clone(d); window.__writes = (window.__writes||0) + 1; notify(); },
      update: async d => { if (!store[path]) throw { code:'invalid_argument', message:'missing' }; store[path] = merge(store[path], clone(d)); window.__writes = (window.__writes||0) + 1; notify(); },
      delete: async () => { delete store[path]; notify(); },
      onSnapshot(cb){ const L = { fire:() => cb(snapDoc(path)) }; listeners.add(L); setTimeout(L.fire, 5); return () => listeners.delete(L); },
      collection: p => colRef(path + '/' + p) };
  }
  function colRef(path, q = {}){
    return { path, doc: id => docRef(path + '/' + (id || gid())), add: async d => { const r = docRef(path + '/' + gid()); await r.set(d); return r; },
      where(){ return colRef(path, q); }, orderBy: (f, dir) => colRef(path, { ...q, order:[f, dir] }), limit: k => colRef(path, { ...q, limit:k }),
      get: async () => { const docs = colDocs(path, q); return { docs, size:docs.length, empty:!docs.length, metadata:meta }; },
      onSnapshot(cb){ const L = { fire:() => { const docs = colDocs(path, q); cb({ docs, size:docs.length, empty:!docs.length, docChanges:() => [], metadata:meta }); } }; listeners.add(L); setTimeout(L.fire, 5); return () => listeners.delete(L); } };
  }
  const db = { doc: docRef, collection: p => colRef(p) };
  const user = { id: async () => 'u1', me: async () => ({ id:'u1', name:'Lucas Teste' }), can: async () => true, isOwner: async () => true, canEdit: async () => true };
  window.__downloads = [];
  const downloads = { save: async ({ filename, data }) => { window.__downloads.push({ filename, size: data.size || data.length || data.byteLength }); return { status:'saved' }; } };
  window.__store = store;
  setTimeout(() => { window.claude = { use: async name => ({ db, user, downloads })[name] || null }; }, 50);
})();
