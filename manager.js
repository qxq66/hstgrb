'use strict';
const $ = id => document.getElementById(id);
let state = { groups: [] };
const selected = new Set();
const collapsed = new Set();
let anchor = null;

const allItems = () => (state.groups || []).flatMap(g => g.items);

document.addEventListener('DOMContentLoaded', async () => {
  bind();
  await refresh();
  chrome.runtime.onMessage.addListener(m => {
    if (m?.type === 'MANAGER_UPDATE') { state = m.state; prune(); render(); }
  });
});

function prune() {
  const ids = new Set(allItems().map(x => x.id));
  for (const id of [...selected]) if (!ids.has(id)) selected.delete(id);
}

function notice(text) {
  $('notice').textContent = text || '';
  if (text) setTimeout(() => { if ($('notice').textContent === text) $('notice').textContent = ''; }, 5000);
}

async function act(type, ids) {
  const r = await chrome.runtime.sendMessage({ type: 'MANAGER_ACTION', action: type, ids });
  if (r?.ok) { state = r.state; prune(); render(); } else notice(r?.error || 'Aktion fehlgeschlagen');
}

function removeSelected() {
  if (!selected.size) { notice('Nichts ausgewählt'); return; }
  if (selected.size > 10 && !confirm(selected.size + ' Einträge aus dem Manager entfernen?')) return;
  act('removeSelected', [...selected]);
}

function bind() {
  $('pauseAll').onclick = () => act('pauseAll', [...selected]);
  $('resumeAll').onclick = () => act('resumeAll', [...selected]);
  $('retryFailed').onclick = () => act('retryFailed', [...selected]);
  $('removeSelected').onclick = removeSelected;
  $('clearCompleted').onclick = () => act('clearCompleted', []);

  document.addEventListener('keydown', e => {
    if (e.key === 'Delete') { e.preventDefault(); removeSelected(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      document.querySelectorAll('.group.open .row').forEach(r => selected.add(r.dataset.id));
      render();
    }
  });

  document.addEventListener('click', async e => {
    const t = e.target;
    const grp = t.closest('.group');
    const g = grp && state.groups.find(x => x.id === grp.dataset.id);

    if (t.closest('.gsel') && g) {
      const on = t.closest('.gsel').checked;
      g.items.forEach(x => on ? selected.add(x.id) : selected.delete(x.id));
      render();
      return;
    }
    if (t.closest('.del-group') && g) {
      if (confirm('Gruppe "' + g.title + '" mit ' + g.items.length + ' Einträgen entfernen?')) act('removeSelected', g.items.map(x => x.id));
      return;
    }
    if (t.closest('.del-row')) { act('removeSelected', [t.closest('.row').dataset.id]); return; }
    if (t.closest('.open-row')) { openItem(t.closest('.row').dataset.id); return; }

    const row = t.closest('.row');
    if (row) {
      const id = row.dataset.id;
      if (e.detail >= 2) { openItem(id); return; }
      const order = [...document.querySelectorAll('.group.open .row')].map(r => r.dataset.id);
      if (e.shiftKey && anchor && order.includes(anchor)) {
        const a = order.indexOf(anchor), b = order.indexOf(id);
        if (!(e.ctrlKey || e.metaKey)) selected.clear();
        order.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => selected.add(x));
      } else if (e.ctrlKey || e.metaKey) {
        selected.has(id) ? selected.delete(id) : selected.add(id);
        anchor = id;
      } else {
        selected.clear();
        selected.add(id);
        anchor = id;
      }
      render();
      return;
    }
    if (t.closest('.group-head') && g) {
      collapsed.has(g.id) ? collapsed.delete(g.id) : collapsed.add(g.id);
      render();
    }
  });
}

async function openItem(id) {
  const item = allItems().find(x => x.id === id);
  if (!item) return;
  if (item.status !== 'completed' || item.downloadId == null) { notice('Download noch nicht abgeschlossen'); return; }
  try {
    await chrome.downloads.open(item.downloadId);
  } catch (err) {
    try { chrome.downloads.show(item.downloadId); } catch {}
    notice('Öffnen nicht möglich: ' + err.message);
  }
}

async function refresh() {
  const r = await chrome.runtime.sendMessage({ type: 'GET_MANAGER' });
  if (r?.ok) state = r.state;
  render();
}

function render() {
  const groups = state.groups || [];
  let total = 0, done = 0, active = 0, failed = 0;
  for (const d of allItems()) {
    total++;
    if (d.status === 'completed') done++;
    if (d.status === 'downloading') active++;
    if (d.status === 'failed') failed++;
  }
  $('summary').textContent = total ? `${done}/${total} fertig · ${active} aktiv${failed ? ' · ' + failed + ' fehlgeschlagen' : ''}${selected.size ? ' · ' + selected.size + ' ausgewählt' : ''}` : 'Keine Downloads';
  $('empty').classList.toggle('hidden', Boolean(groups.length));
  const box = $('groups');
  box.textContent = '';
  for (const g of groups) box.append(groupEl(g));
}

function groupEl(g) {
  const open = !collapsed.has(g.id);
  const section = document.createElement('section');
  section.className = 'group' + (open ? ' open' : '');
  section.dataset.id = g.id;
  const completed = g.items.filter(x => x.status === 'completed').length;
  const bytes = g.items.reduce((a, x) => a + (x.bytesReceived || 0), 0);
  const totalBytes = g.items.reduce((a, x) => a + (x.totalBytes || 0), 0);
  const pct = g.items.length ? Math.round(completed / g.items.length * 100) : 0;
  const allSel = g.items.length > 0 && g.items.every(x => selected.has(x.id));
  section.innerHTML = `<div class="group-head"><span class="toggle">${open ? '−' : '+'}</span><span class="group-title"><input type="checkbox" class="gsel" title="Gruppe auswählen"><span class="gt"></span></span><span></span><span class="group-progress"><span class="bar"><span style="width:${pct}%"></span></span><small>${completed}/${g.items.length}</small></span><span class="group-size">${formatBytes(bytes)}${totalBytes ? ' / ' + formatBytes(totalBytes) : ''}</span><span class="acts"><button class="del-group" title="Gruppe entfernen">✕ Gruppe</button></span></div><div class="rows"></div>`;
  section.querySelector('.gt').textContent = g.title;
  section.querySelector('.gsel').checked = allSel;
  const rows = section.querySelector('.rows');
  for (const item of g.items) rows.append(rowEl(item));
  return section;
}

function rowEl(d) {
  const el = document.createElement('div');
  el.className = 'row ' + d.status;
  el.dataset.id = d.id;
  if (selected.has(d.id)) el.classList.add('selected');
  const pct = d.status === 'completed' ? 100 : (d.totalBytes ? Math.min(100, Math.round(d.bytesReceived / d.totalBytes * 100)) : 0);
  el.innerHTML = `<span class="name"></span><span class="url"></span><span class="progress"><span class="bar"><span style="width:${pct}%"></span></span><small class="status"></small></span><span class="size"></span><span class="acts">${d.status === 'completed' ? '<button class="open-row" title="Im Standard-Bildbetrachter öffnen">Öffnen</button>' : ''}<button class="del-row" title="Entfernen">✕</button></span>`;
  el.querySelector('.name').textContent = d.name;
  el.querySelector('.name').title = d.name;
  el.querySelector('.url').textContent = d.url;
  el.querySelector('.url').title = d.url;
  el.querySelector('.status').textContent = statusText(d, pct);
  if (d.error) el.querySelector('.status').title = d.error;
  el.querySelector('.size').textContent = `${formatBytes(d.bytesReceived)} / ${formatBytes(d.totalBytes)}`;
  return el;
}

function statusText(d, p) {
  return {
    paused: `Pausiert · ${p}%`,
    queued: 'Wartend',
    downloading: `Lädt · ${p}%`,
    completed: '✓ Fertig',
    failed: 'Fehlgeschlagen' + (d.error ? ' (' + d.error + ')' : '')
  }[d.status] || d.status;
}

function formatBytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  const units = ['KB', 'MB', 'GB'];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < units.length - 1);
  return n.toFixed(n < 10 ? 1 : 0) + ' ' + units[i];
}
