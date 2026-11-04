'use strict';
// Ergänzungen/Korrekturen zu worker.js (wird per background.js nach worker.js geladen)

const DEFAULTS_V2 = {
  concurrency: 1,
  naming: 'numbered',
  prefix: '',
  folder: '',
  folderMode: 'title',
  managerStartMode: 'paused'
};
Object.assign(self.HG.DEFAULT_SETTINGS, DEFAULTS_V2);

// Einmalige Migration bestehender Installationen auf die neuen Standardwerte
async function migrateDefaults() {
  const x = await chrome.storage.local.get(['settings', 'defaultsV2']);
  if (x.defaultsV2) return;
  await chrome.storage.local.set({
    settings: self.HG.settings({ ...(x.settings || {}), ...DEFAULTS_V2 }),
    defaultsV2: true
  });
}
migrateDefaults().catch(console.error);

// Fehlende Funktion: serielle Warteschlange für Zugriffe auf den Manager-Status
let serialChain = Promise.resolve();
let pollTimer = null;
function serial(fn) {
  const run = serialChain.then(() => fn());
  serialChain = run.catch(() => {});
  return run;
}

const allItems = state => state.groups.flatMap(g => g.items);

// Status aller laufenden Downloads aus chrome.downloads übernehmen
async function syncState(state) {
  let changed = false;
  for (const item of allItems(state)) {
    if (item.downloadId == null || !['downloading', 'paused'].includes(item.status)) continue;
    const [dl] = await chrome.downloads.search({ id: item.downloadId });
    const before = JSON.stringify([item.status, item.bytesReceived, item.totalBytes, item.error]);
    if (!dl) {
      item.status = 'failed';
      item.error = 'Download nicht mehr vorhanden';
    } else {
      item.bytesReceived = dl.bytesReceived || 0;
      if (dl.totalBytes > 0) item.totalBytes = dl.totalBytes;
      else if (dl.fileSize > 0) item.totalBytes = dl.fileSize;
      if (dl.state === 'complete') {
        item.status = 'completed';
        item.totalBytes = dl.fileSize > 0 ? dl.fileSize : (item.totalBytes || item.bytesReceived);
        item.bytesReceived = item.totalBytes;
        item.error = '';
      } else if (dl.state === 'interrupted') {
        item.status = 'failed';
        item.error = dl.error || 'Unterbrochen';
      } else {
        item.status = dl.paused ? 'paused' : 'downloading';
      }
    }
    if (before !== JSON.stringify([item.status, item.bytesReceived, item.totalBytes, item.error])) changed = true;
  }
  return changed;
}

// Wartende Einträge starten, solange die Grenze paralleler Downloads nicht erreicht ist
async function pump(state) {
  const s = await getSettings();
  let active = allItems(state).filter(x => x.status === 'downloading').length;
  let changed = false;
  for (const item of allItems(state)) {
    if (active >= s.concurrency) break;
    if (item.status !== 'queued') continue;
    try {
      if (item.downloadId != null) {
        try {
          await chrome.downloads.resume(item.downloadId);
          item.status = 'downloading';
          active++;
          changed = true;
          continue;
        } catch { item.downloadId = null; }
      }
      item.downloadId = await chrome.downloads.download({
        url: item.url, filename: item.name, saveAs: false, conflictAction: 'uniquify'
      });
      item.status = 'downloading';
      item.error = '';
      active++;
    } catch (e) {
      item.status = 'failed';
      item.error = e.message;
    }
    changed = true;
  }
  return changed;
}

function schedulePolling(state) {
  const need = allItems(state).some(x => x.status === 'downloading' || x.status === 'queued');
  if (need && !pollTimer) {
    pollTimer = setInterval(() => {
      serial(async () => refreshState(await loadManager())).catch(() => {});
    }, 1000);
  } else if (!need && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function refreshState(state) {
  const a = await syncState(state);
  const b = await pump(state);
  if (a || b) {
    await saveManager(state);
    broadcast(state);
  }
  schedulePolling(state);
}

chrome.downloads.onChanged.addListener(() => {
  serial(async () => refreshState(await loadManager())).catch(() => {});
});
serial(async () => refreshState(await loadManager())).catch(() => {});

// Überschreibt die Versionen aus worker.js
function getManager() {
  return serial(async () => {
    const state = await loadManager();
    await refreshState(state);
    return { ok: true, state };
  });
}

function addBatch(items, title, o = {}) {
  return serial(async () => {
    const H2 = self.HG;
    const list = H2.unique((items || []).filter(x => x.url));
    const s = H2.settings({ ...(await getSettings()), ...o });
    const state = await loadManager();
    if (!list.length) return { ok: true, state };
    const folder = H2.folder(s, title);
    const status = s.managerStartMode === 'paused' ? 'paused' : 'queued';
    state.groups.push({
      id: crypto.randomUUID(),
      title: title || 'Downloads',
      open: true,
      items: list.map((x, i) => ({
        id: crypto.randomUUID(),
        url: x.url,
        name: H2.filename(x.url, i, { ...s, folder, total: list.length }),
        status, downloadId: null, bytesReceived: 0, totalBytes: 0, error: ''
      }))
    });
    await saveManager(state);
    await refreshState(state);
    broadcast(state);
    return { ok: true, state };
  });
}

function managerAction(action, ids) {
  return serial(async () => {
    const state = await loadManager();
    const all = allItems(state);
    const hasIds = Array.isArray(ids) && ids.length > 0;
    const selected = hasIds ? all.filter(x => ids.includes(x.id)) : (action === 'removeSelected' ? [] : all);
    for (const item of selected) {
      try {
        if (action === 'pauseAll') {
          if (item.status === 'downloading' && item.downloadId != null) {
            await chrome.downloads.pause(item.downloadId);
            item.status = 'paused';
          } else if (item.status === 'queued') {
            item.status = 'paused';
          }
        } else if (action === 'resumeAll') {
          if (item.status === 'paused' || item.status === 'failed') item.status = 'queued';
        } else if (action === 'retryFailed') {
          if (item.status === 'failed' || item.status === 'completed') {
            if (item.downloadId != null) {
              if (item.status === 'completed') await chrome.downloads.removeFile(item.downloadId).catch(() => {});
              await chrome.downloads.erase({ id: item.downloadId }).catch(() => {});
            }
            item.downloadId = null;
            item.status = 'queued';
            item.bytesReceived = 0;
            item.totalBytes = 0;
            item.error = '';
          }
        } else if (action === 'clearCompleted') {
          if (item.status === 'completed') item.removed = true;
        } else if (action === 'removeSelected') {
          if (item.downloadId != null && (item.status === 'downloading' || item.status === 'paused')) {
            await chrome.downloads.cancel(item.downloadId).catch(() => {});
          }
          item.removed = true;
        }
      } catch (e) {
        item.error = e.message;
      }
    }
    for (const g of state.groups) g.items = g.items.filter(x => !x.removed);
    state.groups = state.groups.filter(g => g.items.length);
    await saveManager(state);
    await refreshState(state);
    broadcast(state);
    return { ok: true, state };
  });
}

async function openDownload(id) {
  const state = await loadManager();
  const item = allItems(state).find(x => x.id === id);
  if (!item || item.downloadId == null) return { ok: false, error: 'Eintrag nicht gefunden' };
  try {
    await chrome.downloads.open(item.downloadId);
    return { ok: true };
  } catch (e) {
    chrome.downloads.show(item.downloadId);
    return { ok: false, error: e.message };
  }
}
