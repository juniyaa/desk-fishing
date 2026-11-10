// 화면 구석의 작은 낚시터. 캔버스는 140x50 픽셀로 그리고 CSS로 2배 확대(픽셀아트).
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const $money = document.getElementById('money');
const $msg = document.getElementById('msg');
const $gain = document.getElementById('gain');
const $loc = document.getElementById('loc');
const $bag = document.getElementById('bag');

const W = 140, H = 50, WATER = 34;
const HAND = { x: 20, y: 22 };
const TIP = { x: 33, y: 10 };
const targetX = dist => 46 + dist * 84; // 던진 거리(0~1) → 찌 위치

let settings = { key: 'LeftCtrl', click: true };
let hookOk = false;
let stats = { reel: 1, line: 1, luck: 1, size: 1, reaction: 0 }; // 장비 + 레벨로 정해지는 능력치
let loc = LOCATIONS[0];
let rodColor = '#7a5230';
let bagFull = false;
let held = false;

// 낚시 상태 머신: idle → charge → cast → wait → bite → fight → finish → result → idle
const g = {
  state: 'idle', t: 0,
  power: 0, pdir: 1, dist: 0, waitT: 0,
  fish: null, size: 0, perfect: false,
  tension: 0, reel: 1, surge: 1,
  need: 1, hits: 0, cursor: 0, cdir: 1, zone: 0, zoneW: 0.2,
};

function setState(s) { g.state = s; g.t = 0; }

let sayTimer = null;
function say(text, color = '#fff', ms = 0) {
  $msg.textContent = text;
  $msg.style.color = color;
  clearTimeout(sayTimer);
  if (ms) sayTimer = setTimeout(() => { $msg.textContent = ''; }, ms);
}

function fail(text) {
  say(text, '#ff8a80', 1600);
  setState('idle');
}

function showGain(text) {
  $gain.textContent = text;
  $gain.classList.remove('show');
  void $gain.offsetWidth; // 애니메이션 다시 시작
  $gain.classList.add('show');
}

// ---------- 입력 ----------
function rodDown() {
  if (held) return;
  held = true;
  switch (g.state) {
    case 'idle':
      if (bagFull) { say('어망이 꽉 찼어요! 상점에서 팔아요', '#ff8a80', 2000); break; }
      g.power = 0; g.pdir = 1;
      setState('charge');
      say('');
      break;
    case 'wait':
      fail('너무 일찍 당겼어요');
      break;
    case 'bite':
      g.perfect = g.t < 0.35;
      say(g.perfect ? 'PERFECT!' : 'GOOD', g.perfect ? '#ffd34d' : '#9be7a0', 900);
      g.tension = 0.2; g.reel = 1;
      setState('fight');
      break;
    case 'finish':
      hitFinish();
      break;
  }
}

function rodUp() {
  if (!held) return;
  held = false;
  if (g.state === 'charge') {
    g.dist = g.power;
    window.api.cast();
    setState('cast');
  }
}

window.api.onRod(a => (a === 'down' ? rodDown() : rodUp()));

// 전역 키를 못 쓰는 경우(uiohook 없음): 이 창이 선택돼 있을 때만 키로 낚시
window.addEventListener('keydown', e => {
  if (!hookOk && !e.repeat && e.code === KEY_OPTIONS[settings.key].dom) rodDown();
});
window.addEventListener('keyup', e => {
  if (!hookOk && e.code === KEY_OPTIONS[settings.key].dom) rodUp();
});

cv.addEventListener('mousedown', e => { if (settings.click && e.button === 0) rodDown(); });
window.addEventListener('mouseup', e => { if (settings.click && e.button === 0) rodUp(); });

document.getElementById('menu').onclick = () => window.api.openPanel();
document.getElementById('close').onclick = () => window.api.quit();

// 새 버전을 다 받으면 ⬆ 버튼이 생김. 누르면 바로 재시작해서 적용 (안 눌러도 다음에 껐다 켜면 적용)
const $update = document.getElementById('update');
function showUpdate(version) {
  $update.hidden = false;
  $update.title = `새 버전 ${version} — 누르면 재시작해서 업데이트`;
  say(`새 버전 ${version} 준비됐어요! ⬆ 를 누르면 적용`, '#3ddc84', 4000);
}
$update.onclick = () => window.api.installUpdate();
window.api.onUpdateReady(showUpdate);

// ---------- 상태 ----------
function applyState(data) {
  settings = data.settings;
  stats = computeStats(data);
  loc = LOCATIONS.find(l => l.id === data.location) || LOCATIONS[0];
  rodColor = findItem('rod', data.equip.rod).color;
  const cap = bagCapacity(data);
  bagFull = data.bag.length >= cap;
  $money.textContent = won(data.wallet);
  $bag.textContent = `🐟${data.bag.length}/${cap}`;
  $bag.style.color = bagFull ? '#ff8a80' : '';
  $loc.textContent = loc.name;
}
window.api.getState().then(s => {
  hookOk = s.hookOk;
  applyState(s.data);
  if (s.updateReady) showUpdate('');
});
window.api.onState(applyState);

// ---------- 게임 로직 ----------
function newZone() {
  g.zoneW = 0.26 - g.fish.tier * 0.035;
  g.zone = Math.random() * (1 - g.zoneW);
}

function hitFinish() {
  const inZone = g.cursor >= g.zone && g.cursor <= g.zone + g.zoneW;
  if (!inZone) return fail('놓쳤어요…');
  g.hits++;
  if (g.hits >= g.need) return land();
  newZone();
  say(`한 번 더! (${g.need - g.hits})`, '#9be7a0');
}

function land() {
  const f = g.fish;
  const price = priceOf(f, g.size, g.perfect);
  window.api.caught({ id: f.id, name: f.name, size: g.size, price });
  setState('result');
  say(`${TIERS[f.tier].name} ${f.name} ${g.size}cm 어망에 담았어요`, TIERS[f.tier].color);
  showGain(`🐟 +1 (${won(price)})`);
}

function update(dt) {
  g.t += dt;
  switch (g.state) {
    case 'charge':
      // 힘 게이지가 0↔1을 왕복. 떼는 순간의 값이 던지는 거리
      g.power += g.pdir * dt * 0.9;
      if (g.power >= 1) { g.power = 1; g.pdir = -1; }
      if (g.power <= 0) { g.power = 0; g.pdir = 1; }
      break;

    case 'cast':
      if (g.t > 0.45) {
        g.waitT = 1.5 + Math.random() * 3.5 + g.dist * 4; // 멀리 던질수록 오래 기다림
        setState('wait');
      }
      break;

    case 'wait':
      if (g.t >= g.waitT) {
        g.fish = pickFish(g.dist, loc.id, stats.luck);
        g.size = rollSize(g.fish, stats.size);
        setState('bite');
        say('!', '#ffd34d');
      }
      break;

    case 'bite':
      if (g.t > (g.fish.tier >= 4 ? 0.75 : 1.0) + stats.reaction) fail('놓쳤어요… 더 빨리!');
      break;

    case 'fight': {
      // 꾹 = 감기(가까워지지만 장력↑), 떼기 = 풀기(장력↓, 물고기가 조금 도망)
      const str = 0.2 + g.fish.tier * 0.12;
      g.surge = 0.5 + Math.abs(Math.sin(g.t * (1.3 + g.fish.tier * 0.4))) * 0.8;
      if (held) {
        g.reel -= dt * 0.33 * stats.reel;
        g.tension += dt * (0.25 + str * g.surge) / stats.line;
      } else {
        g.reel += dt * str * 0.18;
        g.tension -= dt * 0.7;
      }
      g.tension = Math.max(0, g.tension);
      if (g.tension >= 1) return fail('줄이 끊어졌어요!');
      if (g.reel >= 1.2) return fail('도망갔어요…');
      if (g.reel <= 0) {
        g.need = Math.min(3, g.fish.tier);
        g.hits = 0;
        g.cursor = 0; g.cdir = 1;
        newZone();
        setState('finish');
        say(`초록 칸에서 누르기! (${g.need})`, '#9be7a0');
      }
      break;
    }

    case 'finish': {
      const speed = 0.9 + g.fish.tier * 0.25;
      g.cursor += g.cdir * dt * speed;
      if (g.cursor >= 1) { g.cursor = 1; g.cdir = -1; }
      if (g.cursor <= 0) { g.cursor = 0; g.cdir = 1; }
      if (g.t > 6) fail('놓쳤어요…');
      break;
    }

    case 'result':
      if (g.t > 2.4) { setState('idle'); say(''); }
      break;
  }
}

// ---------- 그리기 ----------
function px(x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function line(x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = c;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function drawFish(x, y, color) {
  px(x, y, 8, 3, color);
  px(x + 1, y - 1, 6, 1, color);
  px(x + 1, y + 3, 6, 1, color);
  px(x - 2, y - 1, 2, 5, color);
  px(x + 6, y, 1, 1, '#111');
}

function drawScene(time) {
  // 물결
  for (let row = 0; row < 4; row++) {
    const y = WATER + row * 4;
    const off = ((time * 5 * (row % 2 ? 1 : -1)) % 6 + 6) % 6;
    for (let x = 34 - 6 + off + (row % 2) * 3; x < W; x += 6) {
      px(x, y, 3, 1, `rgba(${loc.water},${0.75 - row * 0.15})`);
    }
  }
  // 선착장
  px(0, 29, 34, 1, '#a07a50');
  px(0, 30, 34, 2, '#6b4a2e');
  px(3, 32, 2, 8, '#4a321e');
  px(28, 32, 2, 8, '#4a321e');
  // 낚시꾼 (앉아 있는 모습)
  px(14, 13, 7, 2, '#3b5b8c');   // 모자
  px(15, 15, 5, 5, '#f1c27d');   // 얼굴
  px(18, 16, 1, 1, '#222');      // 눈
  px(14, 20, 6, 7, '#d94f3d');   // 몸
  px(17, 27, 6, 2, '#2d3a5a');   // 다리
  px(22, 27, 2, 5, '#2d3a5a');   // 걸터앉은 다리
  px(18, 22, 3, 2, '#f1c27d');   // 손
}

function drawRodAndLine(time) {
  const bend = g.state === 'fight' ? 3 + Math.round(Math.sin(time * 20)) : 0;
  const tip = { x: TIP.x - bend / 2, y: TIP.y + bend };
  line(HAND.x, HAND.y, tip.x, tip.y, rodColor);

  let bx, by, showBobber = true;
  switch (g.state) {
    case 'idle':
    case 'charge':
    case 'result':
      bx = tip.x; by = tip.y + 8;
      showBobber = g.state !== 'result';
      break;
    case 'cast': {
      const p = Math.min(1, g.t / 0.45);
      bx = tip.x + (targetX(g.dist) - tip.x) * p;
      by = tip.y + (WATER - 1 - tip.y) * p - Math.sin(p * Math.PI) * 12;
      break;
    }
    case 'wait':
      bx = targetX(g.dist); by = WATER - 1 + Math.round(Math.sin(time * 3) * 0.6);
      break;
    case 'bite':
      bx = targetX(g.dist); by = WATER + (Math.floor(time * 16) % 2);
      px(bx, WATER - 11, 1, 4, '#ffd34d'); // 느낌표
      px(bx, WATER - 6, 1, 1, '#ffd34d');
      break;
    case 'fight': {
      const r = Math.max(0, Math.min(1.2, g.reel));
      bx = tip.x + 4 + (targetX(g.dist) - tip.x - 4) * r + Math.round(Math.sin(time * 25));
      by = WATER;
      px(bx - 2, WATER - 1, 1, 1, '#e0f0ff'); // 물보라
      px(bx + 2, WATER - 2, 1, 1, '#e0f0ff');
      break;
    }
    case 'finish': {
      bx = tip.x + 6;
      by = WATER - 4 - Math.abs(Math.sin(time * 6)) * 6;
      drawFish(bx - 4, by, g.fish.color);
      showBobber = false;
      break;
    }
  }

  if (g.state === 'result') {
    line(tip.x, tip.y, tip.x, tip.y + 6, '#ddd');
    drawFish(tip.x - 4, tip.y + 8, g.fish.color);
    return;
  }
  line(tip.x, tip.y, bx, by, '#ddd');
  if (showBobber) {
    px(bx, by - 1, 1, 1, '#fff');
    px(bx, by, 1, 1, '#ff4a3a');
  }
}

function drawUI() {
  if (g.state === 'charge') {
    // 힘 게이지 + 떨어질 자리 표시 ▼
    px(4, 6, 26, 3, 'rgba(0,0,0,.55)');
    px(4, 6, Math.round(26 * g.power), 3, '#ffd34d');
    const tx = Math.round(targetX(g.power));
    px(tx - 2, WATER - 6, 5, 1, '#ffd34d');
    px(tx - 1, WATER - 5, 3, 1, '#ffd34d');
    px(tx, WATER - 4, 1, 1, '#ffd34d');
  }
  if (g.state === 'fight') {
    // 오른쪽 장력 막대: 빨개지면 손을 떼야 함
    const h = 30;
    px(133, 4, 4, h, 'rgba(0,0,0,.55)');
    const fill = Math.round(h * Math.min(1, g.tension));
    const color = g.tension > 0.75 ? '#ff5252' : g.tension > 0.5 ? '#ffb74d' : '#69db7c';
    px(133, 4 + h - fill, 4, fill, color);
    if (g.tension > 0.75 && Math.floor(g.t * 8) % 2) say('풀어!!', '#ff5252');
    else if ($msg.textContent === '풀어!!') say('');
    // 남은 거리
    px(40, 46, 80, 1, 'rgba(255,255,255,.25)');
    px(40, 46, Math.round(80 * Math.max(0, Math.min(1, g.reel))), 1, '#9be7a0');
  }
  if (g.state === 'finish') {
    const x0 = 44, w = 86, y = 18;
    px(x0 - 1, y - 1, w + 2, 6, 'rgba(0,0,0,.6)');
    px(x0 + g.zone * w, y, Math.max(2, Math.round(g.zoneW * w)), 4, '#3ddc84');
    px(x0 + g.cursor * w, y - 2, 1, 8, '#fff');
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  ctx.clearRect(0, 0, W, H);
  drawScene(now / 1000);
  drawRodAndLine(now / 1000);
  drawUI();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
