/*
 * Little Wisdom: private admin (add / edit / publish entries).
 * This file only draws the interface. Every permission check happens on the server:
 * without a valid session cookie the API refuses all of it, whatever this page does.
 */
(function () {
  'use strict';
  const root = document.getElementById('root');
  const toastEl = document.getElementById('toast');
  const D = window.DISCOVER, CATS = window.CATEGORIES;
  const TYPES = [['quote', 'Quote'], ['idea', 'Idea'], ['principle', 'Principle'], ['lesson', 'Lesson'], ['note', 'Personal note'], ['knowledge', 'Knowledge'], ['other', 'Other']];
  let csrf = '', entries = [], filter = { q: '', status: 'all' }, editing = null;

  /* ---------- tiny DOM helper (text is always set as text, never as HTML) ---------- */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      const v = attrs[k];
      if (v == null || v === false) return;
      if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (let i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { append(el, x); });
    else el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove('on'); }, 2600); }

  /* ---------- API ---------- */
  async function call(method, url, body) {
    const res = await fetch(url, {
      method: method, credentials: 'same-origin',
      headers: Object.assign({ Accept: 'application/json' }, body ? { 'Content-Type': 'application/json' } : {}, method !== 'GET' && csrf ? { 'X-CSRF-Token': csrf } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
    let data = {}; try { data = await res.json(); } catch (e) { /* empty */ }
    if (res.status === 401 && url !== '/api/admin/login' && url !== '/api/admin/me') { csrf = ''; showLogin('Your session ended. Please sign in again.'); throw { handled: true }; }
    if (!res.ok) throw { status: res.status, message: data.error || 'Something went wrong', data: data };
    return data;
  }

  /* ====================================================================================
   * Storage back-ends. The screens below only talk to `backend`.
   *   server : server.js API (own login, own database)
   *   github : no server. Published entries are committed to entries.json in your repo
   *            (GitHub itself decides who may write: only your token can). Drafts stay in this browser,
   *            because anything in a public repo is public.
   * ================================================================================== */
  const norm = function (s) { return String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); };
  const TYPE_IDS = TYPES.map(function (t) { return t[0]; });
  const fail = function (status, message, data) { return { status: status, message: message, data: data }; };

  /** Same rules as the server: returns the cleaned fields or throws a readable error. */
  function clean(input, partial) {
    const v = {};
    if ('text' in input || !partial) {
      if (typeof input.text !== 'string' || !input.text.trim()) throw fail(400, 'Text is required');
      v.text = input.text.replace(/\r\n?/g, '\n');
      if (v.text.length > 20000) throw fail(400, 'Text is too long (20,000 characters max)');
    }
    if ('title' in input) { if (input.title.length > 200) throw fail(400, 'Title is too long (200 max)'); v.title = input.title.trim(); }
    if ('type' in input) { if (TYPE_IDS.indexOf(input.type) === -1) throw fail(400, 'Unknown type'); v.type = input.type; } else if (!partial) v.type = 'quote';
    if ('categories' in input) {
      const ok = CATS.map(function (c) { return c.id; });
      if (input.categories.some(function (c) { return ok.indexOf(c) === -1; })) throw fail(400, 'Unknown category');
      v.categories = Array.from(new Set(input.categories));
    }
    if ('tags' in input) v.tags = Array.from(new Set(input.tags.map(D.slug).filter(function (t) { return t && t.length <= 40; }))).slice(0, 40);
    if ('topics' in input) {
      if (input.topics.some(function (t) { return !/^(feel|topic):[a-z-]{2,40}$/.test(t); })) throw fail(400, 'Unknown topic');
      v.topics = Array.from(new Set(input.topics));
    }
    ['author', 'description'].forEach(function (k) { if (k in input) { if (input[k].length > (k === 'author' ? 200 : 2000)) throw fail(400, k + ' is too long'); v[k] = input[k].trim(); } });
    if ('date' in input) { if (input.date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw fail(400, 'Date must look like 2026-11-08'); v.date = input.date; }
    [['sourceUrl', 'Source link', false], ['imageUrl', 'Image link', true]].forEach(function (f) {
      if (!(f[0] in input) || input[f[0]] === '') { if (f[0] in input) v[f[0]] = ''; return; }
      const u = String(input[f[0]]).trim();
      if (f[2] && /^images\/[\w.-]+$/.test(u)) { v[f[0]] = u; return; }          // a picture uploaded to this repo
      let p; try { p = new URL(u); } catch (e) { throw fail(400, f[1] + ' must be a full web address (https://…)'); }
      if (p.protocol !== 'https:' && p.protocol !== 'http:') throw fail(400, f[1] + ' must start with http:// or https://');
      v[f[0]] = p.toString();
    });
    if ('status' in input) { if (input.status !== 'draft' && input.status !== 'published') throw fail(400, 'Status must be draft or published'); v.status = input.status; }
    return v;
  }
  const BLANK = { title: '', type: 'quote', categories: [], tags: [], topics: [], author: '', description: '', date: '', sourceUrl: '', imageUrl: '' };

  function serverBackend() {
    return {
      mode: 'server',
      async probe() { const r = await call('GET', '/api/admin/me'); csrf = r.csrf; },
      async signIn(f) { const r = await call('POST', '/api/admin/login', { password: f.password }); csrf = r.csrf; },
      async list() { return (await call('GET', '/api/admin/entries')).entries; },
      async create(b) { return (await call('POST', '/api/admin/entries', b)).entry; },
      async update(e, b) { return (await call('PUT', '/api/admin/entries/' + e.id, b)).entry; },
      async remove(e) { await call('DELETE', '/api/admin/entries/' + e.id); },
      async signOut() { try { await call('POST', '/api/admin/logout'); } catch (e) { /* ignore */ } },
      publishedNote: 'Published.'
    };
  }

  function githubBackend() {
    const CFG = 'littlewisdom.gh.v1', DRAFTS = 'littlewisdom.drafts.v1', FILE = 'entries.json';
    const rd = function (k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
    const wr = function (k, v) { localStorage.setItem(k, JSON.stringify(v)); };
    let cfg = rd(CFG, null);

    function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
    function unb64(str) { const bin = atob(str.replace(/\s/g, '')), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
    async function gh(method, path, body) {
      if (!cfg) throw fail(401, 'Connect your repository first');
      const base = (cfg.api || 'https://api.github.com').replace(/\/+$/, '') + '/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo);
      const url = path === '' ? base : base + '/contents/' + path.split('/').map(encodeURIComponent).join('/') + (method === 'GET' ? '?ref=' + encodeURIComponent(cfg.branch) : '');
      let res;
      try {
        res = await fetch(url, { method: method, headers: Object.assign({ Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json' }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
      } catch (e) { throw fail(0, 'Could not reach GitHub. Check your connection.'); }
      let data = {}; try { data = await res.json(); } catch (e) { /* empty */ }
      if (res.status === 401) { cfg = null; localStorage.removeItem(CFG); showLogin('GitHub did not accept the token. Create a new one and connect again.'); throw { handled: true }; }
      if (res.status === 403) throw fail(403, 'GitHub refused: the token needs “Contents: Read and write” on this repository.');
      if (res.status === 404 && path !== '') return null;
      if (res.status === 404) throw fail(404, 'Repository not found, or the token cannot see it.');
      if (!res.ok) throw fail(res.status, data.message || 'GitHub error ' + res.status);
      return data;
    }
    async function readFile() {
      const f = await gh('GET', FILE);
      if (!f) return { sha: null, data: { nextId: 1, entries: [] } };
      let data; try { data = JSON.parse(new TextDecoder().decode(unb64(f.content))); } catch (e) { throw fail(500, 'entries.json in your repo is not valid JSON. Fix it on GitHub first.'); }
      if (!data || !Array.isArray(data.entries)) data = { nextId: 1, entries: [] };
      data.nextId = Math.max(Number(data.nextId) || 1, data.entries.reduce(function (m, e) { return Math.max(m, e.serial || 0); }, 0) + 1);
      return { sha: f.sha, data: data };
    }
    /** Read, change, write back with the file's sha. If someone else committed in between, read again and retry. */
    async function mutate(change, message) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const cur = await readFile(), out = change(cur.data);
        const body = { message: message, branch: cfg.branch, content: b64(new TextEncoder().encode(JSON.stringify(cur.data, null, 2) + '\n')) };
        if (cur.sha) body.sha = cur.sha;
        try { await gh('PUT', FILE, body); return out; }
        catch (e) { if (!(e.status === 409 || e.status === 422) || attempt === 2) throw e; }
      }
    }
    const drafts = function () { return rd(DRAFTS, []); };
    function duplicate(text, exceptId, published) {
      const n = norm(text), hit = function (list, where) { const m = list.filter(function (x) { return x.id !== exceptId && norm(x.text) === n; })[0]; return m ? { where: where, id: m.id, title: m.title || '' } : null; };
      return hit(window.QUOTES, 'built-in') || hit(published, 'admin') || hit(drafts(), 'admin');
    }
    const stamp = function () { return new Date().toISOString(); };
    const shortMsg = function (e) { return (e.title || e.text.split('\n')[0]).slice(0, 50); };

    return {
      mode: 'github', publishedNote: 'Published. It appears on your site in about a minute.',
      saved: function () { return cfg; },
      defaults: function () {
        const m = location.hostname.match(/^([^.]+)\.github\.io$/), repo = location.pathname.split('/').filter(Boolean)[0];
        return { owner: m ? m[1] : '', repo: m ? (repo && repo !== 'admin.html' ? repo : m[1] + '.github.io') : '', branch: 'main' };
      },
      async signIn(f) {
        cfg = { owner: f.owner.trim(), repo: f.repo.trim(), branch: (f.branch || 'main').trim(), token: f.token.trim(), api: f.api || '' };
        if (!cfg.owner || !cfg.repo || !cfg.token) { cfg = null; throw fail(400, 'Fill in the repository owner, name and token.'); }
        try { await gh('GET', ''); await readFile(); } catch (e) { cfg = null; throw e; }
        wr(CFG, cfg);
      },
      async probe() { if (!cfg) throw fail(401, 'not connected'); },
      async list() {
        const pub = (await readFile()).data.entries.map(function (e) { return Object.assign({}, BLANK, e, { status: 'published' }); });
        return pub.concat(drafts().map(function (d) { return Object.assign({}, BLANK, d, { status: 'draft' }); }))
          .sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
      },
      async create(b) {
        const v = clean(b, false), published = v.status === 'published', now = stamp();
        if (b.force !== true) { const d = duplicate(v.text, null, published ? [] : (await readFile()).data.entries); if (d) throw fail(409, 'This text is already in your collection.', { duplicate: d }); }
        const e = Object.assign({}, BLANK, v, { createdAt: now, updatedAt: now });
        if (published) {
          return mutate(function (data) {
            if (b.force !== true) { const d = duplicate(v.text, null, data.entries); if (d) throw fail(409, 'This text is already in your collection.', { duplicate: d }); }
            e.serial = data.nextId++; e.id = 'u' + e.serial; e.status = 'published'; e.publishedAt = now; data.entries.push(e); return e;
          }, 'Add: ' + shortMsg(e));
        }
        e.id = 'd' + Math.random().toString(36).slice(2, 9); e.serial = 0; e.status = 'draft'; e.publishedAt = '';
        const all = drafts(); all.push(e); wr(DRAFTS, all); return e;
      },
      async update(entry, b) {
        const v = clean(b, true), now = stamp(), next = Object.assign({}, entry, v, { updatedAt: now }), wasPub = entry.status === 'published', isPub = next.status === 'published';
        if (v.text !== undefined && b.force !== true) { const d = duplicate(v.text, entry.id, (await readFile()).data.entries); if (d) throw fail(409, 'This text is already in your collection.', { duplicate: d }); }
        const dropDraft = function () { wr(DRAFTS, drafts().filter(function (d) { return d.id !== entry.id; })); };
        if (wasPub && isPub) return mutate(function (data) { const i = data.entries.findIndex(function (x) { return x.id === entry.id; }); if (i === -1) throw fail(404, 'That entry is no longer in your repository.'); next.publishedAt = data.entries[i].publishedAt || now; data.entries[i] = next; return next; }, 'Edit: ' + shortMsg(next));
        if (!wasPub && isPub) {
          const out = await mutate(function (data) { next.serial = data.nextId++; next.id = 'u' + next.serial; next.publishedAt = now; data.entries.push(next); return next; }, 'Publish: ' + shortMsg(next));
          dropDraft(); return out;
        }
        if (wasPub && !isPub) {
          await mutate(function (data) { data.entries = data.entries.filter(function (x) { return x.id !== entry.id; }); }, 'Unpublish: ' + shortMsg(next));
          next.id = 'd' + Math.random().toString(36).slice(2, 9); next.serial = 0; const all = drafts(); all.push(next); wr(DRAFTS, all); return next;
        }
        wr(DRAFTS, drafts().map(function (d) { return d.id === entry.id ? next : d; })); return next;
      },
      async remove(entry) {
        if (entry.status === 'published') await mutate(function (data) { data.entries = data.entries.filter(function (x) { return x.id !== entry.id; }); }, 'Delete: ' + shortMsg(entry));
        else wr(DRAFTS, drafts().filter(function (d) { return d.id !== entry.id; }));
      },
      async uploadImage(file) {
        if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw fail(400, 'Use a PNG, JPG, WEBP or GIF picture.');
        if (file.size > 3 * 1024 * 1024) throw fail(400, 'That picture is over 3 MB. Please use a smaller one.');
        const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[file.type];
        const name = 'images/' + Date.now().toString(36) + '-' + (file.name.replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'picture') + '.' + ext;
        await gh('PUT', name, { message: 'Add picture ' + name, branch: cfg.branch, content: b64(new Uint8Array(await file.arrayBuffer())) });
        return name;
      },
      async signOut() { cfg = null; localStorage.removeItem(CFG); }   // drafts stay on this device; only the token is forgotten
    };
  }
  let backend = null;

  /* ---------- sign in ---------- */
  function showLogin(msg) {
    const err = h('p', { class: 'a-error', role: 'alert' }, msg || '');
    err.hidden = !msg;
    const gh = backend.mode === 'github';
    const field = function (id, label, attrs) { return h('label', { class: 'a-field' }, h('span', {}, label), h('input', Object.assign({ id: id }, attrs))); };
    const d = gh ? backend.defaults() : {}, saved = gh ? backend.saved() : null;
    const inputs = gh ? [
      field('gh-owner', 'GitHub user or organisation', { type: 'text', value: (saved && saved.owner) || d.owner, autocomplete: 'off', required: true }),
      field('gh-repo', 'Repository name', { type: 'text', value: (saved && saved.repo) || d.repo, autocomplete: 'off', required: true }),
      field('gh-branch', 'Branch', { type: 'text', value: (saved && saved.branch) || d.branch, autocomplete: 'off' }),
      field('gh-token', 'Access token', { type: 'password', autocomplete: 'off', required: true, placeholder: 'github_pat_…' })
    ] : [field('pw', 'Password', { type: 'password', autocomplete: 'current-password', required: true })];
    const first = inputs[gh ? 3 : 0].querySelector('input');
    const form = h('form', { class: 'a-card a-login', onsubmit: async function (e) {
      e.preventDefault(); err.hidden = true;
      const val = function (id) { return document.getElementById(id).value; };
      try {
        await backend.signIn(gh ? { owner: val('gh-owner'), repo: val('gh-repo'), branch: val('gh-branch'), token: val('gh-token'), api: (saved && saved.api) || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && window.LW_GH_API) || '' } : { password: val('pw') });
        first.value = ''; await showList();
      } catch (x) { if (x.handled) return; err.textContent = x.message; err.hidden = false; first.select(); }
    } },
      h('h1', {}, 'Little Wisdom'),
      h('p', {}, gh ? 'Private area. Connect your repository to add and manage entries.' : 'Private area. Sign in to add and manage your entries.'),
      err, inputs,
      gh ? h('details', { class: 'a-more' }, h('summary', {}, 'How do I get a token? (one time)'),
        h('ol', { class: 'a-steps' },
          h('li', {}, 'On GitHub: Settings → Developer settings → Fine-grained tokens → Generate new token.'),
          h('li', {}, 'Repository access: “Only select repositories”, and choose just this one.'),
          h('li', {}, 'Permissions → Repository → Contents: “Read and write”. Nothing else.'),
          h('li', {}, 'Paste the token above. It is kept only in this browser; Sign out removes it.')),
        h('p', { class: 'a-note' }, 'Published entries are saved to entries.json in your repository (public, like the rest of the site). Drafts stay private in this browser.')) : null,
      h('button', { class: 'btn', type: 'submit', style: 'width:100%;justify-content:center' }, gh ? 'Connect' : 'Sign in'));
    root.replaceChildren(h('div', { class: 'a-wrap' }, form));
    first.focus();
  }

  /* ---------- list ---------- */
  async function load() { entries = await backend.list(); }
  async function showList() {
    editing = null;
    try { await load(); } catch (x) { if (!x.handled) toast(x.message); return; }
    drawList();
  }
  function visible() {
    const q = D.slug(filter.q).replace(/-/g, ' ');
    return entries.filter(function (e) {
      if (filter.status !== 'all' && e.status !== filter.status) return false;
      if (!q) return true;
      return [e.title, e.text, e.tags.join(' '), e.type, e.author].join(' ').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').indexOf(q) !== -1;
    });
  }
  function drawList() {
    const listHost = h('ul', { class: 'a-list' });
    const count = h('p', { class: 'a-note', 'aria-live': 'polite' });
    function fill() {
      const v = visible();
      listHost.replaceChildren.apply(listHost, v.map(card));
      count.textContent = entries.length ? v.length + ' of ' + entries.length + ' entries shown' : '';
      empty.hidden = v.length > 0;
      empty.textContent = entries.length ? 'Nothing matches that search.' : 'Nothing here yet. Click “Add New” to capture your first idea.';
    }
    const empty = h('div', { class: 'a-empty a-card' });
    const search = h('input', { type: 'search', placeholder: 'Search your entries', 'aria-label': 'Search your entries', value: filter.q, oninput: function () { filter.q = search.value; fill(); } });
    const pills = ['all', 'published', 'draft'].map(function (s) {
      const b = h('button', { class: 'a-chip', type: 'button', 'aria-pressed': String(filter.status === s), onclick: function () {
        filter.status = s; pills.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); fill();
      } }, s === 'all' ? 'All' : s === 'published' ? 'Published' : 'Drafts');
      return b;
    });
    root.replaceChildren(h('div', { class: 'a-wrap' },
      h('div', { class: 'a-top' },
        h('h1', { class: 'a-brand' }, 'Your collection', h('small', {}, 'private')),
        h('div', { class: 'a-actions' },
          h('button', { class: 'btn', type: 'button', id: 'add-new', onclick: function () { showEditor(null); } }, '+ Add New'),
          h('a', { class: 'btn btn--ghost', href: '/' }, 'View site'),
          h('button', { class: 'btn btn--ghost', type: 'button', onclick: async function () { await backend.signOut(); showLogin(''); } }, 'Sign out'))),
      h('div', { class: 'a-bar' }, h('div', { class: 'a-search' }, search), h('div', { class: 'a-chips', role: 'group', 'aria-label': 'Show' }, pills)),
      empty, listHost, count,
      h('p', { class: 'a-note' }, 'The built-in quotes are protected: they can’t be edited or deleted here. Entries you publish appear after them, and join search, categories, bookmarks and the “How do you feel?” and “What would you like to learn about?” pages automatically.')));
    fill();
  }
  function card(e) {
    return h('li', { class: 'a-card a-item', 'data-id': e.id, 'data-status': e.status },
      h('div', { class: 'a-meta' },
        h('span', { class: 'a-badge ' + (e.status === 'published' ? 'a-badge--pub' : 'a-badge--draft') }, e.status === 'published' ? 'Published' : 'Draft'),
        h('span', {}, (TYPES.filter(function (t) { return t[0] === e.type; })[0] || ['', 'Entry'])[1]),
        h('span', {}, '· ' + new Date(e.updatedAt).toLocaleDateString())),
      e.title ? h('h3', {}, e.title) : null,
      h('p', {}, e.text.length > 280 ? e.text.slice(0, 280) + '…' : e.text),
      h('div', { class: 'a-meta' }, e.tags.map(function (t) { return h('span', { class: 'a-tag' }, t); })),
      h('div', { class: 'a-row' },
        h('button', { class: 'btn btn--small btn--ghost', type: 'button', 'data-act': 'edit', onclick: function () { showEditor(e); } }, 'Edit'),
        h('button', { class: 'btn btn--small btn--ghost', type: 'button', 'data-act': 'toggle', onclick: async function () {
          try { await backend.update(e, { status: e.status === 'published' ? 'draft' : 'published' }); toast(e.status === 'published' ? 'Unpublished. It is a private draft again.' : backend.publishedNote); await showList(); }
          catch (x) { if (!x.handled) toast(x.message); }
        } }, e.status === 'published' ? 'Unpublish' : 'Publish'),
        h('button', { class: 'btn btn--small btn--danger', type: 'button', 'data-act': 'delete', onclick: async function () {
          if (!confirm(backend.mode === 'github' && e.status === 'published' ? 'Delete this entry? It is removed from your site. GitHub keeps the history, so it can be recovered.' : 'Delete this entry? A copy is kept in the server’s trash file.')) return;
          try { await backend.remove(e); toast('Deleted.'); await showList(); } catch (x) { if (!x.handled) toast(x.message); }
        } }, 'Delete')));
  }

  /* ---------- editor ---------- */
  function showEditor(entry) {
    editing = entry;
    const s = { type: entry ? entry.type : 'quote', cats: entry ? entry.categories.slice() : [], tags: entry ? entry.tags.slice() : [], topics: entry ? entry.topics.slice() : [] };
    const err = h('p', { class: 'a-error', role: 'alert' }); err.hidden = true;
    const text = h('textarea', { id: 'f-text', placeholder: 'Paste or type anything: a quote, idea, lesson, principle…', value: entry ? entry.text : '', oninput: preview });
    const title = h('input', { id: 'f-title', type: 'text', maxlength: '200', value: entry ? entry.title : '', placeholder: 'Optional' });
    const author = h('input', { id: 'f-author', type: 'text', maxlength: '200', value: entry ? entry.author : '' });
    const date = h('input', { id: 'f-date', type: 'date', value: entry ? entry.date : '' });
    const srcUrl = h('input', { id: 'f-src', type: 'url', placeholder: 'https://…', value: entry ? entry.sourceUrl : '' });
    const imgUrl = h('input', { id: 'f-img', type: 'url', placeholder: 'https://…', value: entry ? entry.imageUrl : '' });
    const desc = h('input', { id: 'f-desc', type: 'text', maxlength: '2000', value: entry ? entry.description : '' });

    // type
    const typeChips = TYPES.map(function (t) {
      const b = h('button', { class: 'a-chip', type: 'button', 'aria-pressed': String(s.type === t[0]), 'data-type': t[0], onclick: function () {
        s.type = t[0]; typeChips.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      } }, t[1]);
      return b;
    });
    // categories (multi)
    const catChips = CATS.map(function (c) {
      const b = h('button', { class: 'a-chip', type: 'button', 'aria-pressed': String(s.cats.indexOf(c.id) !== -1), 'data-cat': c.id, onclick: function () {
        const i = s.cats.indexOf(c.id); if (i === -1) s.cats.push(c.id); else s.cats.splice(i, 1);
        b.setAttribute('aria-pressed', String(i === -1)); preview();
      } }, c.name);
      return b;
    });
    // tags
    const tagHost = h('div', { class: 'a-tags' }), tagInput = h('input', { id: 'f-tags', type: 'text', list: 'tag-list', placeholder: 'Type a tag, press Enter', autocomplete: 'off' });
    function addTag(raw) {
      raw.split(',').forEach(function (p) { const t = D.slug(p); if (t && s.tags.indexOf(t) === -1) s.tags.push(t); });
      tagInput.value = ''; drawTags(); preview();
    }
    function drawTags() {
      tagHost.replaceChildren.apply(tagHost, s.tags.map(function (t) {
        return h('button', { class: 'a-chip a-chip--tag', type: 'button', 'aria-label': 'Remove tag ' + t, 'data-tag': t, onclick: function () { s.tags.splice(s.tags.indexOf(t), 1); drawTags(); preview(); tagInput.focus(); } }, t);
      }).concat([tagInput]));
    }
    tagInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (tagInput.value.trim()) addTag(tagInput.value); }
      else if (e.key === 'Backspace' && !tagInput.value && s.tags.length) { s.tags.pop(); drawTags(); preview(); }
    });
    tagInput.addEventListener('blur', function () { if (tagInput.value.trim()) addTag(tagInput.value); });
    const known = {};
    window.QUOTES.forEach(function (q) { q.tags.forEach(function (t) { known[t] = 1; }); });
    entries.forEach(function (e) { e.tags.forEach(function (t) { known[t] = 1; }); });
    ['FEELINGS', 'TOPICS'].forEach(function (k) { D[k].forEach(function (o) { known[o.id] = 1; (D.SYNONYMS[o.id] || []).forEach(function (t) { known[t] = 1; }); }); });
    const datalist = h('datalist', { id: 'tag-list' }, Object.keys(known).sort().map(function (t) { return h('option', { value: t }); }));
    // feelings & topics
    function optChips(kind, list) {
      return list.map(function (o) {
        const key = kind + ':' + o.id;
        const b = h('button', { class: 'a-chip', type: 'button', 'aria-pressed': String(s.topics.indexOf(key) !== -1), 'data-topic': key, onclick: function () {
          const i = s.topics.indexOf(key); if (i === -1) s.topics.push(key); else s.topics.splice(i, 1);
          b.setAttribute('aria-pressed', String(i === -1)); preview();
        } }, o.en);
        return b;
      });
    }
    // live proof of what the entry will appear under
    const prev = h('div', { class: 'a-preview none', 'aria-live': 'polite' });
    function preview() {
      const fake = { id: 'preview', number: 0, title: title.value, text: text.value, categories: s.cats, tags: s.tags, topics: s.topics };
      const hits = [];
      D.FEELINGS.concat(D.TOPICS).forEach(function (o) { if (D.recommend([fake], o).length) hits.push((o._kind === 'feel' ? 'feeling ' : 'topic ') + o.en); });
      prev.className = 'a-preview' + (hits.length ? '' : ' none');
      prev.textContent = hits.length ? 'Once published, this will appear under: ' + hits.join(', ') + '.' : 'Not connected to any “How do you feel?” or topic page yet. Add a tag such as “loneliness” or “patience”, or pick one below.';
    }

    function payload(status, force) {
      const body = { text: text.value, title: title.value, type: s.type, categories: s.cats, tags: s.tags.concat(tagInput.value.trim() ? [tagInput.value.trim()] : []), topics: s.topics,
        author: author.value, date: date.value, sourceUrl: srcUrl.value, imageUrl: imgUrl.value, description: desc.value };
      if (status) body.status = status;
      if (force) body.force = true;
      return body;
    }
    let busy = false;
    async function save(status, force) {
      if (busy) return; err.hidden = true;
      if (!text.value.trim()) { err.textContent = 'Please add some text first.'; err.hidden = false; text.focus(); return; }
      busy = true;
      try {
        if (entry) await backend.update(entry, payload(status, force));
        else await backend.create(payload(status, force));
        toast(status === 'published' ? 'Saved. ' + backend.publishedNote : status === 'draft' ? (backend.mode === 'github' ? 'Saved as a private draft on this device.' : 'Saved as a private draft.') : 'Saved.');
        busy = false; await showList();
      } catch (x) {
        busy = false; if (x.handled) return;
        err.replaceChildren(document.createTextNode(x.message + ' '));
        if (x.status === 409 && x.data && x.data.duplicate) {
          err.appendChild(document.createTextNode('(' + (x.data.duplicate.where === 'built-in' ? 'built-in quote “' : 'your entry “') + (x.data.duplicate.title || x.data.duplicate.id) + '”) '));
          err.appendChild(h('button', { class: 'btn btn--small btn--ghost', type: 'button', 'data-act': 'force', onclick: function () { save(status, true); } }, 'Save anyway'));
        }
        err.hidden = false; err.scrollIntoView({ block: 'nearest' });
      }
    }
    const publishLabel = entry && entry.status === 'published' ? 'Save & keep published' : 'Publish';
    root.replaceChildren(h('div', { class: 'a-wrap' },
      h('div', { class: 'a-top' }, h('h1', { class: 'a-brand' }, entry ? 'Edit entry' : 'Add New', h('small', {}, entry ? entry.id : 'type or paste, then save'))),
      err,
      h('div', { class: 'a-card' },
        h('label', { class: 'a-field' }, h('span', {}, 'Your text'), text),
        h('div', { class: 'a-field' }, h('span', {}, 'Type'), h('div', { class: 'a-chips', role: 'group', 'aria-label': 'Type' }, typeChips)),
        h('div', { class: 'a-field' }, h('span', {}, 'Categories (pick any)'), h('div', { class: 'a-chips', role: 'group', 'aria-label': 'Categories' }, catChips)),
        h('div', { class: 'a-field' }, h('span', {}, 'Tags (a tag like “loneliness” or “patience” links the entry to the matching page)'), tagHost, datalist),
        prev,
        h('details', { class: 'a-more', open: !!(entry && entry.topics.length) },
          h('summary', {}, 'Show under specific feelings and topics (optional)'),
          h('div', { class: 'a-field' }, h('span', {}, 'How do you feel?'), h('div', { class: 'a-chips', role: 'group', 'aria-label': 'Feelings' }, optChips('feel', D.FEELINGS))),
          h('div', { class: 'a-field' }, h('span', {}, 'What would you like to learn about?'), h('div', { class: 'a-chips', role: 'group', 'aria-label': 'Topics' }, optChips('topic', D.TOPICS)))),
        h('details', { class: 'a-more', open: !!(entry && (entry.author || entry.sourceUrl || entry.imageUrl || entry.description || entry.date || entry.title)) },
          h('summary', {}, 'More details (all optional)'),
          h('label', { class: 'a-field' }, h('span', {}, 'Title'), title),
          h('div', { class: 'a-grid2' }, h('label', { class: 'a-field' }, h('span', {}, 'Author'), author), h('label', { class: 'a-field' }, h('span', {}, 'Date'), date)),
          h('label', { class: 'a-field' }, h('span', {}, 'Source link'), srcUrl),
          h('label', { class: 'a-field' }, h('span', {}, 'Picture: a web address, or choose a file'), imgUrl),
          backend.uploadImage ? h('div', { class: 'a-field' }, h('input', { type: 'file', id: 'f-file', accept: 'image/png,image/jpeg,image/webp,image/gif', 'aria-label': 'Choose a picture', onchange: async function (ev) {
            const f = ev.target.files[0]; if (!f) return; err.hidden = true;
            try { toast('Uploading picture…'); imgUrl.value = await backend.uploadImage(f); toast('Picture added.'); } catch (x) { if (x.handled) return; err.textContent = x.message; err.hidden = false; }
          } })) : null,
          h('label', { class: 'a-field' }, h('span', {}, 'Description'), desc)),
        h('div', { class: 'a-sticky' },
          h('button', { class: 'btn', type: 'button', id: 'save', onclick: function () { save(entry ? entry.status : 'draft'); } }, 'Save'),
          h('button', { class: 'btn btn--ghost', type: 'button', id: 'save-draft', onclick: function () { save('draft'); } }, 'Save as draft'),
          h('button', { class: 'btn btn--ghost', type: 'button', id: 'publish', onclick: function () { save('published'); } }, publishLabel),
          h('button', { class: 'btn btn--ghost', type: 'button', id: 'cancel', onclick: showList }, 'Cancel'),
          h('p', { class: 'a-hint' }, entry ? 'Save keeps it ' + entry.status + '. Drafts stay private. Ctrl/Cmd + Enter saves.' : 'New entries are saved privately until you publish. Ctrl/Cmd + Enter saves.')))));
    drawTags(); preview(); text.focus();
    root.addEventListener('keydown', onKey);
    function onKey(e) {
      if (!document.getElementById('f-text')) { root.removeEventListener('keydown', onKey); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(entry ? entry.status : 'draft'); }
    }
  }

  /* ---------- start ---------- */
  fetch('/api/admin/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(function (r) { return (r.status === 200 || r.status === 401) && /json/.test(r.headers.get('content-type') || ''); })
    .catch(function () { return false; })
    .then(function (hasServer) {
      backend = hasServer ? serverBackend() : githubBackend();
      return backend.probe().then(showList).catch(function (x) { if (!x.handled) showLogin(''); });
    });
})();
