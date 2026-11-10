const $ = id => document.getElementById(id);
let D = null;
let hookOk = false;

// 탭 전환
document.querySelectorAll('nav button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('nav button, section').forEach(el => el.classList.remove('on'));
    btn.classList.add('on');
    $(btn.dataset.tab).classList.add('on');
  };
});

// ---------- 캐릭터 ----------
function drawCharacter() {
  const ctx = $('char-canvas').getContext('2d');
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const rod = findItem('rod', D.equip.rod);
  ctx.clearRect(0, 0, 40, 40);
  px(12, 6, 11, 3, '#3b5b8c');   // 모자
  px(13, 9, 9, 8, '#f1c27d');    // 얼굴
  px(19, 11, 1, 2, '#222');      // 눈
  px(12, 17, 11, 12, '#d94f3d'); // 몸
  px(13, 29, 4, 8, '#2d3a5a');   // 다리
  px(18, 29, 4, 8, '#2d3a5a');
  px(22, 21, 3, 3, '#f1c27d');   // 손
  for (let i = 0; i < 16; i++) px(24 + i * 0.9, 22 - i * 1.2, 2, 2, rod.color); // 낚싯대
}

function renderChar() {
  const lv = levelInfo(D.xp);
  $('char-level').textContent = lv.level;
  $('char-xp').style.width = Math.round((lv.cur / lv.need) * 100) + '%';
  $('char-xp-text').textContent = `경험치 ${lv.cur} / ${lv.need} · 희귀한 물고기일수록 경험치가 많아요`;
  const s = computeStats(D);
  const pct = v => (v >= 1 ? '+' : '') + Math.round((v - 1) * 100) + '%';
  $('char-stats').innerHTML = [
    ['감기 속도', pct(s.reel)],
    ['줄 버티기', pct(s.line)],
    ['행운 (희귀 물고기)', pct(s.luck)],
    ['큰 물고기', pct(s.size)],
    ['입질 반응 시간', '+' + s.reaction.toFixed(1) + '초'],
  ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
  $('char-equip').innerHTML = Object.entries(ITEMS).map(([slot, cat]) => {
    const it = findItem(slot, D.equip[slot]);
    return `<div class="stat"><span class="dim">${cat.label}</span><span>${it.name}</span></div>`;
  }).join('');
  drawCharacter();
}

// ---------- 상점 ----------
function renderShop() {
  $('shop-wallet').textContent = won(D.wallet);
  const cap = bagCapacity(D);
  const total = D.bag.reduce((s, f) => s + f.price, 0);
  $('bag-count').textContent = `어망 ${D.bag.length}/${cap} · 다 팔면 ${won(total)}`;
  $('sell-all').disabled = !D.bag.length;
  $('bag-list').innerHTML = D.bag.length
    ? D.bag.slice().reverse().map(b => {
        const f = FISH.find(x => x.id === b.id);
        const tier = TIERS[f.tier];
        return `<div class="item"><div class="info"><b>${b.name}</b> <span style="color:${tier.color};font-size:12px">${tier.name}</span>
          <div class="dim">${b.size}cm</div></div><button class="buy" data-sell="${b.uid}">${won(b.price)}에 팔기</button></div>`;
      }).join('')
    : '<div class="dim" style="padding:10px 0">어망이 비어 있어요. 물고기를 잡아 오세요!</div>';
  $('shop-list').innerHTML = Object.entries(ITEMS).map(([slot, cat]) => `
    <div class="card"><h3>${cat.label}</h3>
      ${cat.list.map(it => {
        const owned = D.owned[slot].includes(it.id);
        const equipped = D.equip[slot] === it.id;
        let btn;
        if (equipped) btn = '<button disabled>장착 중</button>';
        else if (owned) btn = `<button data-act="equip" data-slot="${slot}" data-id="${it.id}">장착</button>`;
        else btn = `<button class="buy" data-act="buy" data-slot="${slot}" data-id="${it.id}" ${D.wallet < it.price ? 'disabled' : ''}>${won(it.price)}</button>`;
        return `<div class="item"><div class="info"><b>${it.name}</b><div class="dim">${it.desc}</div></div>${btn}</div>`;
      }).join('')}
    </div>`).join('');
}

$('sell-all').onclick = async () => {
  const res = await window.api.sell('all');
  if (res.ok) $('shop-msg').textContent = `${res.count}마리를 ${won(res.sum)}에 팔았어요!`;
};
$('bag-list').addEventListener('click', async e => {
  const b = e.target.closest('button[data-sell]');
  if (!b) return;
  const res = await window.api.sell([b.dataset.sell]);
  if (res.ok) $('shop-msg').textContent = `${won(res.sum)}에 팔았어요!`;
});

$('shop-list').addEventListener('click', async e => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const res = b.dataset.act === 'buy'
    ? await window.api.buy(b.dataset.slot, b.dataset.id)
    : await window.api.equip(b.dataset.slot, b.dataset.id);
  $('shop-msg').textContent = res.ok ? (b.dataset.act === 'buy' ? '구매 완료! 바로 장착했어요' : '장착했어요') : res.msg || '';
});

// ---------- 장소 ----------
function renderPlaces() {
  const dexCount = Object.keys(D.dex).length;
  $('places-dex').textContent = `도감 ${dexCount}종`;
  $('places-list').innerHTML = LOCATIONS.map(l => {
    const locked = dexCount < l.need;
    const here = D.location === l.id;
    const fish = FISH.filter(f => f.loc === l.id);
    const found = fish.filter(f => D.dex[f.id]).length;
    let btn;
    if (here) btn = '<button disabled>지금 여기</button>';
    else if (locked) btn = `<button disabled>🔒 도감 ${l.need}종</button>`;
    else btn = `<button data-loc="${l.id}">이동</button>`;
    return `<div class="card item place ${locked ? 'locked' : ''}">
      <div class="info"><b>${l.name}</b><div class="dim">${l.desc}</div>
      <div class="dim">발견한 물고기 ${found} / ${fish.length}</div></div>${btn}</div>`;
  }).join('');
}

$('places-list').addEventListener('click', e => {
  const b = e.target.closest('button[data-loc]');
  if (b) window.api.setLocation(b.dataset.loc);
});

// ---------- 수익 ----------
function renderMoney() {
  const day = D.day;
  $('head-money').textContent = won(D.wallet);
  $('today-money').textContent = won(day.money);
  const rate = day.casts ? Math.round((day.count / day.casts) * 100) : 0;
  $('today-stats').textContent = `${day.count}마리 · 던진 횟수 ${day.casts}번 · 성공률 ${rate}%`;
  $('today-best').innerHTML = day.best
    ? `<span class="best">👑 오늘 최고 ${day.best.name} ${day.best.size}cm <span class="gold">${won(day.best.price)}</span></span>`
    : '';
  $('total-money').textContent = won(D.total.money);
  $('total-stats').textContent = `${D.total.count}마리 · ${D.total.casts}번 던짐`;

  // 최근 14일 막대그래프
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    days.push({ d, key, money: key === day.date ? day.money : D.history[key] || 0 });
  }
  const max = Math.max(1, ...days.map(x => x.money));
  const record = Math.max(day.money, ...Object.values(D.history));
  $('record').textContent = '최고 기록 ' + won(record);
  $('chart').innerHTML = days.map((x, i) => {
    const label = i === 0 ? `${x.d.getMonth() + 1}/${x.d.getDate()}` : x.d.getDate();
    const h = Math.round((x.money / max) * 100);
    return `<div title="${x.key} ${won(x.money)}"><i class="${x.key === day.date ? 'today' : ''}" style="height:${h}%"></i><span>${label}</span></div>`;
  }).join('');
}

// ---------- 도감 ----------
function renderDex() {
  const caught = FISH.filter(f => D.dex[f.id]).length;
  $('dex-count').textContent = `${caught} / ${FISH.length}`;
  $('dex-grid').innerHTML = LOCATIONS.map(l => {
    const cards = FISH.filter(f => f.loc === l.id).map(f => {
      const e = D.dex[f.id];
      const tier = TIERS[f.tier];
      if (!e) {
        return `<div class="fish unknown"><div class="shape"></div><div class="name">???</div><div class="dim" style="color:${tier.color}">${tier.name}</div></div>`;
      }
      return `<div class="fish"><div class="shape" style="background:${f.color};color:${f.color}"></div>
        <div class="name">${f.name}</div><div style="color:${tier.color}">${tier.name}</div>
        <div class="dim">${e.count}마리 · 최대 ${e.maxSize}cm</div></div>`;
    }).join('');
    return `<h4 style="grid-column:1/-1">${l.name}</h4>${cards}`;
  }).join('');
}

// ---------- 설정 ----------
function renderSettings() {
  $('key-opts').innerHTML = Object.entries(KEY_OPTIONS).map(([id, k]) =>
    `<label class="opt"><input type="radio" name="key" value="${id}" ${D.settings.key === id ? 'checked' : ''}>${k.label}</label>`
  ).join('');
  $('click').checked = D.settings.click;
  // 슬라이더를 끄는 중에는 값을 덮어쓰지 않음
  if (document.activeElement !== $('scale')) $('scale').value = D.settings.scale;
  if (document.activeElement !== $('opacity')) $('opacity').value = D.settings.opacity;
  $('scale-val').textContent = Math.round(D.settings.scale * 100) + '%';
  $('opacity-val').textContent = Math.round(D.settings.opacity * 100) + '%';
  $('hook-status').innerHTML = hookOk
    ? '<span class="ok">다른 창을 쓰는 중에도 돼요 (키 입력을 가로채지 않아요)</span>'
    : '<span class="warn">전역 키 감지를 못 켰어요. 낚시터 창이 선택돼 있을 때만 키가 동작해요.</span>';
}

$('key-opts').addEventListener('change', e => window.api.setSettings({ key: e.target.value }));
$('click').addEventListener('change', e => window.api.setSettings({ click: e.target.checked }));
$('scale').addEventListener('input', e => window.api.setSettings({ scale: Number(e.target.value) }));
$('opacity').addEventListener('input', e => window.api.setSettings({ opacity: Number(e.target.value) }));

let testTimer = null;
window.api.onKeyTest(() => {
  $('key-test').textContent = '✓ 잡혔어요!';
  $('key-test').className = 'ok';
  clearTimeout(testTimer);
  testTimer = setTimeout(() => { $('key-test').textContent = '고른 키를 눌러 보세요'; $('key-test').className = 'dim'; }, 1200);
});

function render() {
  renderChar();
  renderShop();
  renderPlaces();
  renderMoney();
  renderDex();
  renderSettings();
}

function showUpdate(version) {
  $('update-box').innerHTML = `<button class="sellall" id="install-update">새 버전${version ? ' ' + version : ''} 적용 (재시작)</button>`;
  $('install-update').onclick = () => window.api.installUpdate();
}
window.api.onUpdateReady(showUpdate);

window.api.getState().then(s => {
  D = s.data;
  hookOk = s.hookOk;
  $('version').textContent = 'v' + s.version;
  if (s.updateReady) showUpdate('');
  render();
});
window.api.onState(data => { D = data; render(); });
