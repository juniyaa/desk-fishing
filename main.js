const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { KEY_OPTIONS, ITEMS, FISH, LOCATIONS, dayKey, bagCapacity } = require('./src/shared');

// 전역 키 감지: 다른 앱을 쓰는 중에도 키를 "가로채지 않고" 누름/뗌을 지켜봄
let uIOhook = null, UiohookKey = null, hookOk = false;
try {
  ({ uIOhook, UiohookKey } = require('uiohook-napi'));
} catch (e) {
  console.warn('uiohook-napi를 불러오지 못함 — 낚시터 창이 선택돼 있을 때만 키가 동작해요.', e.message);
}

// 자동 업데이트: GitHub Releases에 올린 새 버전을 받아 둠 (설치형(Setup.exe)으로 깔았을 때만 동작)
let autoUpdater = null, updateReady = false;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (e) {
  console.warn('electron-updater를 불러오지 못함 — 자동 업데이트 꺼짐', e.message);
}

let widget = null, panel = null;

// ---------- 저장 ----------
const savePath = () => path.join(app.getPath('userData'), 'save.json');
const freshDay = () => ({ date: dayKey(), money: 0, count: 0, casts: 0, best: null });
const defaults = () => ({
  day: freshDay(),
  total: { money: 0, count: 0, casts: 0 },
  wallet: 0,            // 쓸 수 있는 돈 (판 돈 - 상점에서 쓴 돈)
  bag: [],              // 어망에 담긴(아직 안 판) 물고기 { uid, id, name, size, price }
  xp: 0,                // 캐릭터 경험치
  owned: { rod: ['bamboo'], line: ['basic'], bait: ['worm'], net: ['basic_net'] },
  equip: { rod: 'bamboo', line: 'basic', bait: 'worm', net: 'basic_net' },
  location: 'pond',
  history: {},          // { '2026-10-29': 123450, ... } 지난 날짜별 수익
  dex: {},              // { fishId: { count, maxSize } }
  settings: { key: 'LeftCtrl', click: true, scale: 1, opacity: 1 }, // scale: 낚시터 크기 배율, opacity: 0.2(흐림)~1(선명)
  widgetPos: null,
});
let data;

function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(savePath(), 'utf8'));
    const d = defaults();
    data = {
      ...d, ...saved,
      settings: { ...d.settings, ...saved.settings },
      owned: { ...d.owned, ...saved.owned },
      equip: { ...d.equip, ...saved.equip },
    };
  } catch {
    data = defaults();
  }
  rollDay();
}

function save() {
  fs.writeFileSync(savePath(), JSON.stringify(data, null, 2));
}

// 자정이 지나면 오늘 수익을 기록으로 옮기고 0부터 다시
function rollDay() {
  if (data.day.date === dayKey()) return false;
  if (data.day.money > 0) data.history[data.day.date] = data.day.money;
  data.day = freshDay();
  save();
  return true;
}

function send(win, channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}
function broadcast() {
  send(widget, 'state', data);
  send(panel, 'state', data);
}

// ---------- 창 ----------
const preload = path.join(__dirname, 'preload.js');
const WIDGET_W = 280, WIDGET_H = 126;

// 설정의 크기·선명도를 낚시터 창에 적용. 화면 전체를 확대(zoom)하고 창 크기도 같은 비율로 맞춤
function applyWidgetLook() {
  if (!widget || widget.isDestroyed()) return;
  const { scale, opacity } = data.settings;
  widget.setResizable(true);
  widget.setContentSize(Math.round(WIDGET_W * scale), Math.round(WIDGET_H * scale));
  widget.setResizable(false);
  widget.webContents.setZoomFactor(scale);
  widget.setOpacity(opacity);
}

function createWidget() {
  const W = Math.round(WIDGET_W * data.settings.scale), H = Math.round(WIDGET_H * data.settings.scale);
  const { workArea } = screen.getPrimaryDisplay();
  const pos = data.widgetPos || { x: workArea.x + workArea.width - W - 20, y: workArea.y + workArea.height - H - 20 };

  widget = new BrowserWindow({
    ...pos, width: W, height: H,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    webPreferences: { preload, backgroundThrottling: false },
  });
  widget.setAlwaysOnTop(true, 'screen-saver');
  widget.setVisibleOnAllWorkspaces(true);
  widget.loadFile(path.join(__dirname, 'src/widget.html'));
  widget.webContents.on('did-finish-load', applyWidgetLook);
  widget.on('moved', () => {
    const [x, y] = widget.getPosition();
    data.widgetPos = { x, y };
    save();
  });
  widget.on('closed', () => app.quit());
}

function openPanel() {
  if (panel && !panel.isDestroyed()) { panel.show(); panel.focus(); return; }
  panel = new BrowserWindow({
    width: 460, height: 720,
    title: '책상 낚시터',
    backgroundColor: '#111111',
    autoHideMenuBar: true,
    webPreferences: { preload },
  });
  panel.loadFile(path.join(__dirname, 'src/panel.html'));
}

// ---------- 전역 키 ----------
let held = false;
const selectedHookCode = () => {
  const opt = KEY_OPTIONS[data.settings.key] || KEY_OPTIONS.LeftCtrl;
  return UiohookKey[opt.hook];
};

function startHook() {
  if (!uIOhook) return;
  uIOhook.on('keydown', e => {
    if (e.keycode !== selectedHookCode()) return;
    send(panel, 'key-test');
    if (held) return; // 꾹 누르고 있으면 keydown이 반복해서 옴 → 첫 번째만
    held = true;
    send(widget, 'rod', 'down');
  });
  uIOhook.on('keyup', e => {
    if (e.keycode !== selectedHookCode() || !held) return;
    held = false;
    send(widget, 'rod', 'up');
  });
  try {
    uIOhook.start();
    hookOk = true;
  } catch (e) {
    console.warn('전역 키 감지 시작 실패:', e.message);
  }
}

// ---------- 화면과 주고받기 ----------
ipcMain.handle('get-state', () => ({ data, hookOk, version: app.getVersion(), updateReady }));

ipcMain.on('cast', () => {
  rollDay();
  data.day.casts++;
  data.total.casts++;
  save();
  broadcast();
});

// 잡은 물고기는 돈이 아니라 어망에 담김. 돈은 상점에서 팔 때 들어옴
ipcMain.on('caught', (_e, f) => {
  rollDay();
  const fish = FISH.find(x => x.id === f.id);
  if (!fish || data.bag.length >= bagCapacity(data)) return;
  const price = Math.max(0, Math.round(Number(f.price) || 0));
  data.bag.push({ uid: Date.now() + '-' + Math.random().toString(36).slice(2, 7), id: f.id, name: fish.name, size: f.size, price });
  data.xp += fish.tier;
  data.day.count++;
  data.total.count++;
  if (!data.day.best || price > data.day.best.price) {
    data.day.best = { id: f.id, name: f.name, size: f.size, price };
  }
  const entry = data.dex[f.id] || { count: 0, maxSize: 0 };
  entry.count++;
  entry.maxSize = Math.max(entry.maxSize, f.size);
  data.dex[f.id] = entry;
  save();
  broadcast();
});

// 팔기: uids에 있는 물고기(또는 'all'이면 전부)를 팔아서 지갑에 넣음
ipcMain.handle('sell', (_e, uids) => {
  rollDay();
  const selling = uids === 'all' ? data.bag : data.bag.filter(f => uids.includes(f.uid));
  if (!selling.length) return { ok: false, msg: '팔 물고기가 없어요' };
  const sum = selling.reduce((s, f) => s + f.price, 0);
  data.bag = data.bag.filter(f => !selling.includes(f));
  data.wallet += sum;
  data.day.money += sum;
  data.total.money += sum;
  save();
  broadcast();
  return { ok: true, count: selling.length, sum };
});

// 상점: 지갑 돈으로 사면 바로 장착
ipcMain.handle('buy', (_e, { slot, id }) => {
  const item = ITEMS[slot] && ITEMS[slot].list.find(it => it.id === id);
  if (!item) return { ok: false, msg: '없는 물건이에요' };
  if (data.owned[slot].includes(id)) return { ok: false, msg: '이미 가지고 있어요' };
  if (data.wallet < item.price) return { ok: false, msg: '돈이 모자라요' };
  data.wallet -= item.price;
  data.owned[slot].push(id);
  data.equip[slot] = id;
  save();
  broadcast();
  return { ok: true };
});

ipcMain.handle('equip', (_e, { slot, id }) => {
  if (!data.owned[slot] || !data.owned[slot].includes(id)) return { ok: false };
  data.equip[slot] = id;
  save();
  broadcast();
  return { ok: true };
});

// 장소 이동: 도감을 need 종 이상 채워야 열림
ipcMain.handle('set-location', (_e, id) => {
  const loc = LOCATIONS.find(l => l.id === id);
  if (!loc || Object.keys(data.dex).length < loc.need) return { ok: false };
  data.location = id;
  save();
  broadcast();
  return { ok: true };
});

ipcMain.handle('set-settings', (_e, patch) => {
  data.settings = { ...data.settings, ...patch };
  if ('scale' in patch || 'opacity' in patch) applyWidgetLook();
  held = false;
  save();
  broadcast();
  return data.settings;
});

ipcMain.on('install-update', () => { if (updateReady) autoUpdater.quitAndInstall(); });
ipcMain.on('open-panel', openPanel);
ipcMain.on('quit', () => app.quit());

// ---------- 자동 업데이트 ----------
function setupUpdater() {
  // npm start로 개발 중일 때는 확인하지 않음
  if (!autoUpdater || !app.isPackaged) return;
  autoUpdater.on('update-downloaded', info => {
    updateReady = true;
    send(widget, 'update-ready', info.version);
    send(panel, 'update-ready', info.version);
  });
  autoUpdater.on('error', e => console.warn('업데이트 확인 실패:', e.message));
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 60 * 60 * 1000); // 1시간마다 확인
}

// ---------- 시작 ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', openPanel);
  app.whenReady().then(() => {
    load();
    startHook();
    createWidget();
    setupUpdater();
    setInterval(() => { if (rollDay()) broadcast(); }, 60 * 1000);
  });
  app.on('will-quit', () => { if (hookOk) uIOhook.stop(); });
  app.on('window-all-closed', () => app.quit());
}
