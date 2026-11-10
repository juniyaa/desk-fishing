// 게임 데이터(장소, 물고기, 장비)와 계산 함수 — main.js(Node)와 화면(브라우저) 양쪽에서 같이 씀
// 장소·물고기·장비를 바꾸고 싶으면 이 파일의 표만 고치면 돼요.
(function (root) {
  const TIERS = {
    1: { name: '흔함', color: '#b8c4cc' },
    2: { name: '보통', color: '#5fb3ff' },
    3: { name: '희귀', color: '#c08cff' },
    4: { name: '전설', color: '#ffcc33' },
  };

  // need: 도감을 몇 종 채우면 열리는지, water: 물결 색(R,G,B)
  const LOCATIONS = [
    { id: 'pond',    name: '동네 저수지',      need: 0,  water: '150,190,230', desc: '처음 시작하는 조용한 저수지' },
    { id: 'toilet',  name: '회사 화장실 변기', need: 4,  water: '200,225,240', desc: '근무 중 가장 안전한 낚시터. 가끔 이상한 게 낚여요' },
    { id: 'river',   name: '한강',             need: 9,  water: '120,170,200', desc: '퇴근길 한강. 괴물이 산다는 소문이…' },
    { id: 'pacific', name: '태평양',           need: 14, water: '70,140,220',  desc: '큰 물고기의 바다. 좋은 장비가 필요해요' },
  ];

  // size: [최소, 최대] cm, base: 평균 크기일 때 가격, minDist: 이 거리(0~1) 이상 던져야 나옴
  const FISH = [
    { id: 'minnow',    loc: 'pond',    name: '피라미',          tier: 1, size: [5, 15],     base: 200,    color: '#b8c4cc', minDist: 0 },
    { id: 'crucian',   loc: 'pond',    name: '붕어',            tier: 1, size: [10, 35],    base: 800,    color: '#9a8a5a', minDist: 0 },
    { id: 'carp',      loc: 'pond',    name: '잉어',            tier: 2, size: [30, 80],    base: 3500,   color: '#b07a40', minDist: 0.2 },
    { id: 'catfish',   loc: 'pond',    name: '메기',            tier: 2, size: [30, 90],    base: 4200,   color: '#5a5048', minDist: 0.2 },
    { id: 'snakehead', loc: 'pond',    name: '가물치',          tier: 3, size: [40, 100],   base: 11000,  color: '#4a5a3a', minDist: 0.45 },
    { id: 'goldkoi',   loc: 'pond',    name: '황금잉어',        tier: 4, size: [40, 100],   base: 60000,  color: '#ffcc33', minDist: 0.75 },

    { id: 'idcard',    loc: 'toilet',  name: '잃어버린 사원증', tier: 1, size: [8, 10],     base: 500,    color: '#e0e0e0', minDist: 0 },
    { id: 'goldfish',  loc: 'toilet',  name: '변기 금붕어',     tier: 1, size: [3, 12],     base: 1500,   color: '#ff8c3a', minDist: 0 },
    { id: 'seweel',    loc: 'toilet',  name: '하수구 장어',     tier: 2, size: [40, 120],   base: 6000,   color: '#5d6b4a', minDist: 0.2 },
    { id: 'golfball',  loc: 'toilet',  name: '부장님 골프공',   tier: 3, size: [4, 5],      base: 20000,  color: '#ffffff', minDist: 0.45 },
    { id: 'gator',     loc: 'toilet',  name: '황금 변기 악어',  tier: 4, size: [80, 200],   base: 120000, color: '#c9a227', minDist: 0.7 },

    { id: 'nuchi',     loc: 'river',   name: '누치',            tier: 1, size: [20, 50],    base: 2000,   color: '#a8b0b8', minDist: 0 },
    { id: 'skygazer',  loc: 'river',   name: '강준치',          tier: 1, size: [30, 80],    base: 2500,   color: '#c8d0d8', minDist: 0 },
    { id: 'mandarin',  loc: 'river',   name: '쏘가리',          tier: 2, size: [20, 50],    base: 9000,   color: '#b89a50', minDist: 0.2 },
    { id: 'eel',       loc: 'river',   name: '민물장어',        tier: 3, size: [50, 120],   base: 25000,  color: '#3a4030', minDist: 0.45 },
    { id: 'monster',   loc: 'river',   name: '한강 괴물',       tier: 4, size: [150, 400],  base: 200000, color: '#3a6a5a', minDist: 0.75 },

    { id: 'mackerel',  loc: 'pacific', name: '고등어',          tier: 1, size: [25, 45],    base: 3000,   color: '#4f7fa0', minDist: 0 },
    { id: 'yellowtail',loc: 'pacific', name: '방어',            tier: 2, size: [50, 110],   base: 15000,  color: '#7a9cc0', minDist: 0.15 },
    { id: 'tuna',      loc: 'pacific', name: '참치',            tier: 3, size: [100, 250],  base: 50000,  color: '#3a5a80', minDist: 0.4 },
    { id: 'marlin',    loc: 'pacific', name: '청새치',          tier: 3, size: [150, 350],  base: 70000,  color: '#2a4a90', minDist: 0.5 },
    { id: 'whaleshark',loc: 'pacific', name: '고래상어',        tier: 4, size: [400, 1200], base: 500000, color: '#5a7a9a', minDist: 0.8 },
  ];

  // 장비: 장착한 것들의 stats를 곱해서(reaction은 더해서) 캐릭터 능력치가 됨
  //   reel: 감기 속도 / line: 줄 버티기(장력이 덜 오름) / luck: 희귀 물고기 확률
  //   size: 큰 물고기 확률 / reaction: 입질 때 눌러야 하는 시간 +초
  //   어망(net)은 능력치 대신 capacity(담을 수 있는 마리 수)
  const ITEMS = {
    rod: { label: '낚싯대', list: [
      { id: 'bamboo', name: '대나무 낚싯대', price: 0,      color: '#7a5230', stats: {},                                desc: '처음 받은 낚싯대' },
      { id: 'carbon', name: '카본 낚싯대',   price: 20000,  color: '#454c58', stats: { reel: 1.25 },                    desc: '감기 속도 +25%' },
      { id: 'pro',    name: '프로 원투대',   price: 120000, color: '#2f6fd0', stats: { reel: 1.5, size: 1.1 },          desc: '감기 +50%, 큰 물고기 +10%' },
      { id: 'legend', name: '전설의 낚싯대', price: 700000, color: '#ffcc33', stats: { reel: 1.9, size: 1.25, luck: 1.2 }, desc: '감기 +90%, 큰 물고기 +25%, 행운 +20%' },
    ] },
    line: { label: '낚싯줄', list: [
      { id: 'basic',  name: '기본 줄',       price: 0,      stats: {},             desc: '평범한 나일론 줄' },
      { id: 'braid',  name: '합사줄',        price: 15000,  stats: { line: 1.3 },  desc: '줄 버티기 +30%' },
      { id: 'wire',   name: '강철 와이어',   price: 90000,  stats: { line: 1.7 },  desc: '줄 버티기 +70%' },
      { id: 'dragon', name: '용의 수염',     price: 500000, stats: { line: 2.3 },  desc: '줄 버티기 +130%' },
    ] },
    bait: { label: '미끼', list: [
      { id: 'worm',   name: '지렁이',        price: 0,      stats: {},                                         desc: '기본 미끼' },
      { id: 'shrimp', name: '새우 미끼',     price: 10000,  stats: { luck: 1.3, reaction: 0.1 },               desc: '행운 +30%, 입질 반응 +0.1초' },
      { id: 'lure',   name: '반짝이 루어',   price: 80000,  stats: { luck: 1.6, size: 1.1, reaction: 0.2 },    desc: '행운 +60%, 큰 물고기 +10%, 반응 +0.2초' },
      { id: 'golden', name: '황금 미끼',     price: 400000, stats: { luck: 2.2, size: 1.2, reaction: 0.3 },    desc: '행운 +120%, 큰 물고기 +20%, 반응 +0.3초' },
    ] },
    net: { label: '어망', list: [
      { id: 'basic_net', name: '작은 어망',     price: 0,      capacity: 10, stats: {}, desc: '물고기 10마리까지 담아요' },
      { id: 'big_net',   name: '큰 어망',       price: 25000,  capacity: 25, stats: {}, desc: '물고기 25마리까지 담아요' },
      { id: 'icebox',    name: '아이스박스',    price: 120000, capacity: 50, stats: {}, desc: '물고기 50마리까지 담아요' },
      { id: 'fridge',    name: '업소용 냉장고', price: 600000, capacity: 120, stats: {}, desc: '물고기 120마리까지 담아요' },
    ] },
  };

  const findItem = (slot, id) => ITEMS[slot].list.find(it => it.id === id) || ITEMS[slot].list[0];

  // 레벨: 물고기를 잡으면 희귀도만큼 경험치. 다음 레벨까지 10 × 현재 레벨
  function levelInfo(xp) {
    let level = 1, need = 10, left = xp;
    while (left >= need) { left -= need; level++; need = level * 10; }
    return { level, cur: left, need };
  }

  // 장비 + 레벨 보너스(레벨당 감기·줄 +3%)로 최종 능력치 계산
  function computeStats(data) {
    const s = { reel: 1, line: 1, luck: 1, size: 1, reaction: 0 };
    for (const slot of Object.keys(ITEMS)) {
      const st = findItem(slot, data.equip[slot]).stats;
      for (const k of ['reel', 'line', 'luck', 'size']) if (st[k]) s[k] *= st[k];
      if (st.reaction) s.reaction += st.reaction;
    }
    const bonus = 1 + (levelInfo(data.xp).level - 1) * 0.03;
    s.reel *= bonus;
    s.line *= bonus;
    return s;
  }

  // 멀리 던질수록(dist↑), 행운이 높을수록 희귀한 물고기 확률이 올라감
  function pickFish(dist, locId, luck = 1) {
    const weight = { 1: 60 - dist * 30, 2: 25, 3: (8 + dist * 20) * luck, 4: (1 + dist * 7) * Math.pow(luck, 1.5) };
    const pool = FISH.filter(f => f.loc === locId && f.minDist <= dist);
    let r = Math.random() * pool.reduce((s, f) => s + weight[f.tier], 0);
    for (const f of pool) { r -= weight[f.tier]; if (r <= 0) return f; }
    return pool[0];
  }

  // 보통은 작은 개체가 자주 나오고, size 능력치가 높을수록 큰 개체 쪽으로 치우침
  function rollSize(f, sizeStat = 1) {
    const t = Math.pow(Math.random(), 1.8 / sizeStat);
    return Math.round((f.size[0] + (f.size[1] - f.size[0]) * t) * 10) / 10;
  }

  function priceOf(f, size, perfect) {
    const ratio = size / ((f.size[0] + f.size[1]) / 2);
    return Math.round((f.base * ratio * (perfect ? 1.3 : 1)) / 10) * 10;
  }

  const won = n => '₩' + Math.round(n).toLocaleString('ko-KR');

  function dayKey(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // hook: uiohook-napi 키 이름, dom: 브라우저 KeyboardEvent.code (전역 키를 못 쓸 때 대신 사용)
  const KEY_OPTIONS = {
    LeftCtrl:   { label: '왼쪽 Ctrl',    hook: 'Ctrl',       dom: 'ControlLeft' },
    RightCtrl:  { label: '오른쪽 Ctrl',  hook: 'CtrlRight',  dom: 'ControlRight' },
    RightShift: { label: '오른쪽 Shift', hook: 'ShiftRight', dom: 'ShiftRight' },
    RightAlt:   { label: '오른쪽 Alt',   hook: 'AltRight',   dom: 'AltRight' },
  };

  const bagCapacity = data => findItem('net', data.equip.net).capacity;

  const api = {
    TIERS, LOCATIONS, FISH, ITEMS, findItem, bagCapacity, levelInfo, computeStats,
    pickFish, rollSize, priceOf, won, dayKey, KEY_OPTIONS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(this);
