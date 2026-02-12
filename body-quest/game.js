// ============================
// Body Quest - Game Logic
// Mobile-First (iOS & Android)
// ============================

// ---------- STATE ----------
const state = {
  playerName: '',
  totalScore: 0,
  collectedCards: new Set(),
  achievements: new Set(),
  currentGame: null,
  timers: {},
};

// ---------- MOBILE HELPERS ----------
function vibrate(pattern) {
  try { navigator.vibrate && navigator.vibrate(pattern); } catch(e) { /* ignore */ }
}

// Prevent double-tap zoom is handled via CSS touch-action: manipulation

// Enter key on name input
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('player-name-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') registerPlayer();
    });
  }
});

// ================================
// PLAYER & LEADERBOARD SYSTEM
// ================================
function getAllPlayers() {
  try {
    return JSON.parse(localStorage.getItem('bodyquest_players') || '{}');
  } catch(e) { return {}; }
}

function saveAllPlayers(players) {
  try {
    localStorage.setItem('bodyquest_players', JSON.stringify(players));
  } catch(e) { /* ignore */ }
}

function registerPlayer() {
  const input = document.getElementById('player-name-input');
  const name = (input.value || '').trim();
  if (!name) {
    input.focus();
    input.style.borderColor = 'var(--danger)';
    setTimeout(() => input.style.borderColor = '', 1000);
    return;
  }

  state.playerName = name;
  localStorage.setItem('bodyquest_currentPlayer', name);

  // Load this player's data or create new
  const players = getAllPlayers();
  if (players[name]) {
    state.totalScore = players[name].totalScore || 0;
    state.collectedCards = new Set(players[name].collectedCards || []);
    state.achievements = new Set(players[name].achievements || []);
  } else {
    state.totalScore = 0;
    state.collectedCards = new Set();
    state.achievements = new Set();
    players[name] = { totalScore: 0, collectedCards: [], achievements: [] };
    saveAllPlayers(players);
  }

  updateHomeStats();
  document.getElementById('player-name-display').textContent = name;
  showScreen('home');
  vibrate(30);
}

function loginPlayer(name) {
  document.getElementById('player-name-input').value = name;
  registerPlayer();
}

function renderWelcomeScreen() {
  const players = getAllPlayers();
  const playerNames = Object.keys(players);
  const container = document.getElementById('welcome-players');
  const list = document.getElementById('player-list');

  if (playerNames.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  // Sort by score desc
  const sorted = playerNames
    .map(n => ({ name: n, score: players[n].totalScore || 0, cards: (players[n].collectedCards || []).length }))
    .sort((a, b) => b.score - a.score);

  list.innerHTML = sorted.map((p, i) => `
    <div class="player-item" onclick="loginPlayer('${p.name.replace(/'/g, "\\'")}')">
      <span class="player-item-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1)}</span>
      <div class="player-item-info">
        <div class="player-item-name">${p.name}</div>
        <div class="player-item-score">${p.score.toLocaleString()} คะแนน · ${p.cards} การ์ด</div>
      </div>
      <span class="player-item-arrow">→</span>
    </div>
  `).join('');
}

// ---------- PERSISTENCE ----------
function loadState() {
  const currentPlayer = localStorage.getItem('bodyquest_currentPlayer');
  if (currentPlayer) {
    const players = getAllPlayers();
    if (players[currentPlayer]) {
      state.playerName = currentPlayer;
      state.totalScore = players[currentPlayer].totalScore || 0;
      state.collectedCards = new Set(players[currentPlayer].collectedCards || []);
      state.achievements = new Set(players[currentPlayer].achievements || []);
      document.getElementById('player-name-display').textContent = currentPlayer;
      // Skip welcome, go to home
      document.getElementById('screen-welcome').classList.remove('active');
      document.getElementById('screen-home').classList.add('active');
    }
  }
  renderWelcomeScreen();
  updateHomeStats();
}

function saveState() {
  if (!state.playerName) return;
  const players = getAllPlayers();
  players[state.playerName] = {
    totalScore: state.totalScore,
    collectedCards: [...state.collectedCards],
    achievements: [...state.achievements],
  };
  saveAllPlayers(players);
}

// ---------- NAVIGATION ----------
function showScreen(id) {
  clearAllTimers();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById('screen-' + id);
  if (screen) {
    screen.classList.add('active');
    screen.scrollTop = 0;
  }
  if (id === 'home') updateHomeStats();
  if (id === 'collection') renderCollection();
  if (id === 'leaderboard') renderLeaderboard();
  if (id === 'welcome') renderWelcomeScreen();
}

// ================================
// LEADERBOARD
// ================================
let lbTab = 'total';

function showLeaderboardTab(tab) {
  lbTab = tab;
  document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('lb-tab-' + tab).classList.add('active');
  renderLeaderboard();
}

function renderLeaderboard() {
  const players = getAllPlayers();
  const playerNames = Object.keys(players);
  const list = document.getElementById('leaderboard-list');

  if (playerNames.length === 0) {
    list.innerHTML = '<div class="lb-empty">ยังไม่มีผู้เล่น<br>เชิญเพื่อนมาเล่นเพื่อเทียบคะแนน!</div>';
    return;
  }

  const sorted = playerNames
    .map(n => ({
      name: n,
      score: players[n].totalScore || 0,
      cards: (players[n].collectedCards || []).length,
    }))
    .sort((a, b) => lbTab === 'total' ? b.score - a.score : b.cards - a.cards);

  list.innerHTML = sorted.map((p, i) => {
    const isMe = p.name === state.playerName;
    const rankClass = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
    const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
    const value = lbTab === 'total'
      ? p.score.toLocaleString() + ' คะแนน'
      : p.cards + '/' + CARDS.length + ' การ์ด';

    return `
      <div class="lb-row ${rankClass} ${isMe ? 'is-me' : ''}">
        <span class="lb-rank">${rankIcon}</span>
        <span class="lb-name">${p.name} ${isMe ? '(คุณ)' : ''}</span>
        <span class="lb-value">${value}</span>
      </div>`;
  }).join('');
}

function updateHomeStats() {
  document.getElementById('total-score').textContent = state.totalScore.toLocaleString();
  document.getElementById('cards-collected').textContent = state.collectedCards.size;
  document.getElementById('cards-total').textContent = CARDS.length;
  const level = Math.floor(state.totalScore / 500) + 1;
  document.getElementById('player-level').textContent = 'Lv.' + Math.min(level, 5);
}

// ---------- UTILITY ----------
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clearAllTimers() {
  Object.values(state.timers).forEach(t => clearInterval(t));
  state.timers = {};
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ---------- ANIMATIONS ----------
function spawnConfetti(targetEl, count = 8) {
  const rect = targetEl ? targetEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2 };
  const colors = ['#6c5ce7', '#00b894', '#fdcb6e', '#e17055', '#74b9ff', '#a29bfe'];
  for (let i = 0; i < count; i++) {
    const confetti = document.createElement('div');
    const size = Math.random() * 8 + 4;
    confetti.style.cssText = `
      position:fixed; z-index:9999; pointer-events:none;
      width:${size}px; height:${size}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      left:${rect.left + Math.random() * 60 - 30}px;
      top:${rect.top + Math.random() * 20 - 10}px;
      animation: confettiPop ${0.6 + Math.random() * 0.4}s cubic-bezier(0.25,0.46,0.45,0.94) forwards;
      animation-delay: ${Math.random() * 0.1}s;
    `;
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 1200);
  }
}

function animateScore(element) {
  element.style.animation = 'none';
  element.offsetHeight; // trigger reflow
  element.style.animation = 'scorePop 0.4s ease';
}

function animateStreak(element) {
  element.classList.add('on-fire');
  setTimeout(() => element.classList.remove('on-fire'), 600);
}

// Add confetti keyframes dynamically
(function addConfettiStyle() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes confettiPop {
      0%   { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
      100% { transform: translate(${Math.random() > 0.5 ? '' : '-'}${30 + Math.random() * 50}px, -${60 + Math.random() * 80}px) rotate(${360 + Math.random() * 360}deg) scale(0); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  // Add multiple variants
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('style');
    const dx = (Math.random() - 0.5) * 120;
    const dy = -(40 + Math.random() * 100);
    s.textContent = `
      @keyframes confettiPop${i} {
        0%   { transform: translate(0,0) rotate(0) scale(1); opacity:1; }
        100% { transform: translate(${dx}px,${dy}px) rotate(${360 + Math.random()*720}deg) scale(0); opacity:0; }
      }
    `;
    document.head.appendChild(s);
  }
})();

function spawnConfettiAdvanced(x, y, count = 12) {
  const colors = ['#6c5ce7','#00b894','#fdcb6e','#e17055','#74b9ff','#ff6b6b','#a29bfe','#55efc4'];
  for (let i = 0; i < count; i++) {
    const confetti = document.createElement('div');
    const size = Math.random() * 8 + 4;
    const variant = Math.floor(Math.random() * 6);
    confetti.style.cssText = `
      position:fixed; z-index:9999; pointer-events:none;
      width:${size}px; height:${size}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      left:${x + Math.random() * 20 - 10}px;
      top:${y}px;
      animation: confettiPop${variant} ${0.5 + Math.random() * 0.5}s cubic-bezier(0.25,0.46,0.45,0.94) forwards;
    `;
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 1200);
  }
}

function collectCards(cardIds) {
  let newCards = [];
  cardIds.forEach(id => {
    if (!state.collectedCards.has(id)) {
      state.collectedCards.add(id);
      newCards.push(id);
    }
  });
  if (newCards.length > 0) {
    vibrate(50);
    showToast(`ปลดล็อคการ์ดใหม่ ${newCards.length} ใบ!`, 'achievement');
    saveState();
  }
  return newCards;
}

function getSystemColor(systemId) {
  const sys = SYSTEMS.find(s => s.id === systemId);
  return sys ? sys.color : '#666';
}

// ---------- START GAME ----------
function startGame(mode) {
  clearAllTimers();
  state.currentGame = mode;
  vibrate(30);
  switch(mode) {
    case 'system-match': initSystemMatch(); break;
    case 'body-builder': initBodyBuilder(); break;
    case 'quiz': initQuiz(); break;
  }
}

// ================================
// MODE 1: SYSTEM MATCH (Tap-based)
// ================================
let matchState = {};

function initSystemMatch() {
  const systems = shuffle(SYSTEMS).slice(0, 3);
  const systemIds = systems.map(s => s.id);
  const cards = shuffle(CARDS.filter(c => systemIds.includes(c.system)));

  matchState = {
    systems,
    cards,
    placements: {},
    selectedCard: null,
    timeLeft: 60,
    score: 0,
    checked: false,
  };

  showScreen('system-match');
  renderMatchCards();
  renderMatchZones();
  startMatchTimer();
  hideMatchIndicator();
  document.getElementById('match-check-btn').style.display = 'none';
  document.getElementById('match-score').textContent = '0 คะแนน';
}

function showMatchIndicator(card) {
  const ind = document.getElementById('match-selected-indicator');
  document.getElementById('match-selected-name').textContent = card.icon + ' ' + card.name;
  ind.style.display = 'flex';
  // Add hint to zones
  document.querySelectorAll('.match-zone').forEach(z => z.classList.add('tap-hint'));
}

function hideMatchIndicator() {
  document.getElementById('match-selected-indicator').style.display = 'none';
  document.querySelectorAll('.match-zone').forEach(z => z.classList.remove('tap-hint'));
}

function cancelMatchSelection() {
  matchState.selectedCard = null;
  document.querySelectorAll('.game-card.selected').forEach(c => c.classList.remove('selected'));
  hideMatchIndicator();
}

function renderMatchCards() {
  const container = document.getElementById('match-cards');
  container.innerHTML = '';

  matchState.cards.forEach(card => {
    if (matchState.placements[card.id]) return;

    const el = document.createElement('div');
    el.className = 'game-card' + (matchState.selectedCard === card.id ? ' selected' : '');
    el.dataset.cardId = card.id;
    el.innerHTML = `<span class="card-icon">${card.icon}</span>
      <span class="card-name">${card.name}<br><span class="card-name-en">${card.nameEn}</span></span>`;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (matchState.checked) return;
      vibrate(15);

      // Toggle selection
      if (matchState.selectedCard === card.id) {
        cancelMatchSelection();
        return;
      }

      document.querySelectorAll('#match-cards .game-card.selected').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      matchState.selectedCard = card.id;
      showMatchIndicator(card);
    });

    container.appendChild(el);
  });

  // Update check button
  const allPlaced = matchState.cards.every(c => matchState.placements[c.id]);
  document.getElementById('match-check-btn').style.display = allPlaced ? 'block' : 'none';
}

function renderMatchZones() {
  const container = document.getElementById('match-zones');
  container.innerHTML = '';

  matchState.systems.forEach(sys => {
    const zone = document.createElement('div');
    zone.className = 'match-zone';
    zone.dataset.systemId = sys.id;
    zone.innerHTML = `
      <div class="zone-header">
        <span class="zone-icon">${sys.icon}</span>
        <span>${sys.name}</span>
      </div>
      <div class="zone-cards" id="zone-${sys.id}"></div>`;

    // Tap to place selected card
    zone.addEventListener('click', (e) => {
      e.stopPropagation();
      if (matchState.selectedCard && !matchState.checked) {
        vibrate(20);
        placeCardInZone(matchState.selectedCard, sys.id);
        matchState.selectedCard = null;
        hideMatchIndicator();
      }
    });

    container.appendChild(zone);
  });
}

function placeCardInZone(cardId, systemId) {
  if (matchState.checked) return;
  const card = CARDS.find(c => c.id === cardId);
  if (!card) return;

  matchState.placements[cardId] = systemId;

  // Remove from other zones
  document.querySelectorAll('.zone-cards .game-card').forEach(el => {
    if (el.dataset.cardId === cardId) el.remove();
  });

  // Add to target zone
  const zoneCards = document.getElementById('zone-' + systemId);
  const el = document.createElement('div');
  el.className = 'game-card';
  el.dataset.cardId = cardId;
  el.innerHTML = `<span class="card-icon">${card.icon}</span><span class="card-name">${card.name}</span>`;

  // Tap placed card to return it
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (matchState.checked) return;
    vibrate(15);
    delete matchState.placements[cardId];
    el.remove();
    renderMatchCards();
  });

  zoneCards.appendChild(el);
  renderMatchCards();
}

function checkMatches() {
  if (matchState.checked) return;
  matchState.checked = true;
  clearAllTimers();
  hideMatchIndicator();

  let correct = 0;
  const total = matchState.cards.length;

  matchState.cards.forEach(card => {
    const placed = matchState.placements[card.id];
    const isCorrect = placed === card.system;
    if (isCorrect) correct++;

    document.querySelectorAll(`.zone-cards .game-card[data-card-id="${card.id}"]`).forEach(el => {
      el.classList.add(isCorrect ? 'correct' : 'wrong');
    });
  });

  matchState.systems.forEach(sys => {
    const zone = document.querySelector(`.match-zone[data-system-id="${sys.id}"]`);
    const zoneCards = matchState.cards.filter(c => matchState.placements[c.id] === sys.id);
    const allCorrect = zoneCards.every(c => c.system === sys.id);
    if (zoneCards.length > 0) {
      zone.classList.add(allCorrect ? 'correct' : 'wrong');
    }
  });

  vibrate(correct === total ? [50, 50, 50] : [100]);

  // Celebration confetti for good results
  if (correct > total / 2) {
    for (let i = 0; i < (correct === total ? 6 : 3); i++) {
      setTimeout(() => {
        spawnConfettiAdvanced(Math.random() * window.innerWidth, Math.random() * window.innerHeight * 0.4, 10);
      }, i * 200);
    }
  }

  const timeBonus = matchState.timeLeft * 2;
  const accuracyScore = Math.round((correct / total) * 300);
  matchState.score = accuracyScore + timeBonus;

  document.getElementById('match-score').textContent = matchState.score + ' คะแนน';
  document.getElementById('match-check-btn').style.display = 'none';

  const correctCardIds = matchState.cards.filter(c => matchState.placements[c.id] === c.system).map(c => c.id);
  collectCards(correctCardIds);

  if (correct === total && !state.achievements.has('perfect_match')) {
    state.achievements.add('perfect_match');
    showToast('รางวัล: จับคู่แม่นยำ!', 'achievement');
  }
  if (!state.achievements.has('first_match')) {
    state.achievements.add('first_match');
    showToast('รางวัล: เริ่มต้นดี!', 'achievement');
  }

  state.totalScore += matchState.score;
  saveState();

  setTimeout(() => {
    showResults({
      title: correct === total ? 'สมบูรณ์แบบ!' : correct > total/2 ? 'ทำได้ดี!' : 'ลองอีกครั้ง!',
      icon: correct === total ? '🏆' : correct > total/2 ? '👏' : '💪',
      stats: [
        { label: 'ถูกต้อง', value: `${correct}/${total}` },
        { label: 'คะแนนความแม่นยำ', value: accuracyScore },
        { label: 'โบนัสเวลา', value: '+' + timeBonus },
        { label: 'คะแนนรวม', value: matchState.score },
      ],
      cards: correctCardIds,
      funFact: matchState.cards[Math.floor(Math.random() * matchState.cards.length)].funFact,
      replayFn: () => startGame('system-match'),
    });
  }, 1500);
}

function startMatchTimer() {
  const timerEl = document.getElementById('match-timer');
  state.timers.match = setInterval(() => {
    matchState.timeLeft--;
    timerEl.textContent = '⏱ ' + matchState.timeLeft;
    if (matchState.timeLeft <= 10) timerEl.classList.add('danger');
    else timerEl.classList.remove('danger');
    if (matchState.timeLeft <= 0) {
      clearInterval(state.timers.match);
      checkMatches();
    }
  }, 1000);
}

// ================================
// MODE 2: BODY BUILDER (Tap-based)
// ================================
let bodyState = {};

function initBodyBuilder() {
  const cards = shuffle(CARDS.filter(c => c.position)).slice(0, 8);

  bodyState = {
    cards,
    placed: {},
    selectedCard: null,
    timeLeft: 90,
    correctCount: 0,
  };

  showScreen('body-builder');
  renderBodyDropZones();
  renderBodyCards();
  startBodyTimer();
  hideBodyIndicator();
  document.getElementById('body-score').textContent = `0 / ${cards.length}`;
}

function showBodyIndicator(card) {
  const ind = document.getElementById('body-selected-indicator');
  document.getElementById('body-selected-name').textContent = card.icon + ' ' + card.name;
  ind.style.display = 'flex';
  // Hint: pulse all unfilled drop zones
  document.querySelectorAll('.body-drop-zone:not(.filled)').forEach(z => z.classList.add('tap-hint'));
}

function hideBodyIndicator() {
  document.getElementById('body-selected-indicator').style.display = 'none';
  document.querySelectorAll('.body-drop-zone').forEach(z => z.classList.remove('tap-hint'));
}

function cancelBodySelection() {
  bodyState.selectedCard = null;
  document.querySelectorAll('.body-card.selected').forEach(c => c.classList.remove('selected'));
  hideBodyIndicator();
}

function renderBodyDropZones() {
  const container = document.getElementById('body-drop-zones');
  container.innerHTML = '';

  bodyState.cards.forEach(card => {
    const zone = document.createElement('div');
    zone.className = 'body-drop-zone';
    zone.id = 'body-zone-' + card.id;
    zone.style.top = card.position.top + '%';
    zone.style.left = card.position.left + '%';
    zone.textContent = '?';

    // Tap to place
    zone.addEventListener('click', (e) => {
      e.stopPropagation();
      if (bodyState.selectedCard) {
        vibrate(20);
        placeOnBody(bodyState.selectedCard, card.id);
      }
    });

    container.appendChild(zone);
  });
}

function renderBodyCards() {
  const panel = document.getElementById('body-cards-panel');
  panel.innerHTML = '';

  bodyState.cards.forEach(card => {
    const el = document.createElement('div');
    el.className = 'body-card' + (bodyState.placed[card.id] ? ' placed' : '') +
      (bodyState.selectedCard === card.id ? ' selected' : '');
    el.dataset.cardId = card.id;
    el.innerHTML = `<span class="card-icon" style="font-size:22px">${card.icon}</span>
      <div>
        <div style="font-weight:600;font-size:14px">${card.name}</div>
        <div style="font-size:11px;color:var(--text-muted)">${card.nameEn}</div>
      </div>`;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (bodyState.placed[card.id]) return;
      vibrate(15);

      // Toggle
      if (bodyState.selectedCard === card.id) {
        cancelBodySelection();
        return;
      }

      document.querySelectorAll('.body-card.selected').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      bodyState.selectedCard = card.id;
      showBodyIndicator(card);
    });

    panel.appendChild(el);
  });
}

function placeOnBody(cardId, zoneCardId) {
  const zone = document.getElementById('body-zone-' + zoneCardId);
  const card = CARDS.find(c => c.id === cardId);
  if (!card || !zone || zone.classList.contains('filled')) return;

  const isCorrect = cardId === zoneCardId;

  if (isCorrect) {
    vibrate([30, 30, 30]);
    zone.classList.add('filled');
    zone.classList.remove('tap-hint');
    zone.textContent = card.icon;
    bodyState.placed[cardId] = zoneCardId;
    bodyState.correctCount++;

    // Confetti burst from the placed organ
    spawnConfetti(zone, 10);
    animateScore(document.getElementById('body-score'));

    document.getElementById('body-score').textContent = `${bodyState.correctCount} / ${bodyState.cards.length}`;
    showToast(`${card.name} ถูกต้อง!`, 'success');

    bodyState.selectedCard = null;
    hideBodyIndicator();
    renderBodyCards();

    if (bodyState.correctCount === bodyState.cards.length) {
      clearAllTimers();
      setTimeout(() => finishBodyBuilder(), 500);
    }
  } else {
    vibrate(100);
    zone.classList.add('wrong-placement');
    setTimeout(() => zone.classList.remove('wrong-placement'), 500);
    showToast('ไม่ใช่ตำแหน่งนี้ ลองใหม่!', 'error');
  }
}

function finishBodyBuilder() {
  hideBodyIndicator();
  // Big celebration confetti
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      spawnConfettiAdvanced(
        Math.random() * window.innerWidth,
        Math.random() * window.innerHeight * 0.5,
        10
      );
    }, i * 150);
  }
  const timeBonus = bodyState.timeLeft * 2;
  const placementScore = bodyState.correctCount * 50;
  const totalScore = placementScore + timeBonus;

  const correctIds = Object.keys(bodyState.placed);
  collectCards(correctIds);

  if (bodyState.correctCount === bodyState.cards.length && !state.achievements.has('body_master')) {
    state.achievements.add('body_master');
    showToast('รางวัล: ผู้เชี่ยวชาญร่างกาย!', 'achievement');
  }

  state.totalScore += totalScore;
  saveState();

  showResults({
    title: bodyState.correctCount === bodyState.cards.length ? 'ครบทุกอวัยวะ!' : 'พยายามดีแล้ว!',
    icon: bodyState.correctCount === bodyState.cards.length ? '🧍' : '💪',
    stats: [
      { label: 'วางถูก', value: `${bodyState.correctCount}/${bodyState.cards.length}` },
      { label: 'คะแนนตำแหน่ง', value: placementScore },
      { label: 'โบนัสเวลา', value: '+' + timeBonus },
      { label: 'คะแนนรวม', value: totalScore },
    ],
    cards: correctIds,
    funFact: bodyState.cards[Math.floor(Math.random() * bodyState.cards.length)].funFact,
    replayFn: () => startGame('body-builder'),
  });
}

function startBodyTimer() {
  const timerEl = document.getElementById('body-timer');
  state.timers.body = setInterval(() => {
    bodyState.timeLeft--;
    timerEl.textContent = '⏱ ' + bodyState.timeLeft;
    if (bodyState.timeLeft <= 10) timerEl.classList.add('danger');
    else timerEl.classList.remove('danger');
    if (bodyState.timeLeft <= 0) {
      clearInterval(state.timers.body);
      finishBodyBuilder();
    }
  }, 1000);
}

// ================================
// MODE 3: QUIZ
// ================================
let quizState = {};

function initQuiz() {
  const questions = shuffle(QUIZ_QUESTIONS).slice(0, 10);

  quizState = {
    questions,
    currentIndex: 0,
    score: 0,
    hp: 100,
    streak: 0,
    maxStreak: 0,
    correctCount: 0,
    timeLeft: 15,
    fastAnswers: 0,
    answeredCards: [],
  };

  showScreen('quiz');
  renderQuestion();
  startQuizTimer();
}

function renderQuestion() {
  const q = quizState.questions[quizState.currentIndex];

  document.getElementById('quiz-question').textContent = q.question;
  document.getElementById('quiz-progress-fill').style.width =
    ((quizState.currentIndex) / quizState.questions.length * 100) + '%';
  document.getElementById('quiz-progress-text').textContent =
    `${quizState.currentIndex + 1} / ${quizState.questions.length}`;
  document.getElementById('quiz-score-display').textContent = quizState.score + ' คะแนน';
  document.getElementById('quiz-hp-fill').style.width = quizState.hp + '%';
  document.getElementById('quiz-hp-text').textContent = quizState.hp;
  document.getElementById('quiz-streak').textContent = '🔥 ' + quizState.streak;
  document.getElementById('quiz-feedback').style.display = 'none';
  document.getElementById('quiz-card').style.display = 'block';

  const letters = ['ก', 'ข', 'ค', 'ง'];
  const optionsContainer = document.getElementById('quiz-options');
  optionsContainer.innerHTML = '';

  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.innerHTML = `<span class="option-letter">${letters[i]}</span><span>${opt}</span>`;
    btn.addEventListener('click', () => answerQuestion(i));
    optionsContainer.appendChild(btn);
  });

  quizState.timeLeft = 15;
  document.getElementById('quiz-timer').textContent = '⏱ 15';
  document.getElementById('quiz-timer').classList.remove('danger');
}

function answerQuestion(index) {
  clearInterval(state.timers.quiz);

  const q = quizState.questions[quizState.currentIndex];
  const isCorrect = index === q.correct;
  const timeTaken = 15 - quizState.timeLeft;

  const options = document.querySelectorAll('.quiz-option');
  options.forEach(o => o.classList.add('disabled'));

  options[q.correct].classList.add('correct');
  if (!isCorrect && index >= 0 && index < options.length) {
    options[index].classList.add('wrong');
  }

  if (isCorrect) {
    vibrate([30, 30, 30]);
    const basePoints = 30;
    const timeBonus = Math.max(0, (15 - timeTaken) * 2);
    const streakBonus = quizState.streak * 5;
    const points = basePoints + timeBonus + streakBonus;

    quizState.score += points;
    quizState.streak++;
    quizState.maxStreak = Math.max(quizState.maxStreak, quizState.streak);
    quizState.correctCount++;

    if (timeTaken <= 3) quizState.fastAnswers++;

    const systemCards = CARDS.filter(c => c.system === q.system);
    if (systemCards.length > 0) {
      const randomCard = systemCards[Math.floor(Math.random() * systemCards.length)];
      quizState.answeredCards.push(randomCard.id);
    }

    // Animations
    spawnConfetti(options[q.correct], quizState.streak >= 3 ? 16 : 8);
    animateScore(document.getElementById('quiz-score-display'));
    const streakEl = document.querySelector('.streak-display');
    if (streakEl) animateStreak(streakEl);

    document.getElementById('quiz-streak').textContent = '🔥 ' + quizState.streak;
    showQuizFeedback(true, `+${points} คะแนน (⏱ +${timeBonus} 🔥 +${streakBonus})`, q.explanation);
  } else {
    vibrate(100);
    quizState.hp = Math.max(0, quizState.hp - 20);
    quizState.streak = 0;

    const hpFill = document.getElementById('quiz-hp-fill');
    hpFill.style.width = quizState.hp + '%';
    hpFill.classList.add('damage');
    setTimeout(() => hpFill.classList.remove('damage'), 500);
    document.getElementById('quiz-hp-text').textContent = quizState.hp;
    document.getElementById('quiz-streak').textContent = '🔥 0';
    showQuizFeedback(false, 'เสีย 20 HP', q.explanation);
  }

  document.getElementById('quiz-score-display').textContent = quizState.score + ' คะแนน';

  if (quizState.streak >= 5 && !state.achievements.has('quiz_streak_5')) {
    state.achievements.add('quiz_streak_5');
    showToast('รางวัล: ตอบรัว 5!', 'achievement');
  }
  if (quizState.streak >= 10 && !state.achievements.has('quiz_streak_10')) {
    state.achievements.add('quiz_streak_10');
    showToast('รางวัล: ตอบรัว 10!', 'achievement');
  }
  if (quizState.fastAnswers >= 5 && !state.achievements.has('speed_demon')) {
    state.achievements.add('speed_demon');
    showToast('รางวัล: สายฟ้าแลบ!', 'achievement');
  }
}

function showQuizFeedback(correct, scoreText, explanation) {
  const fb = document.getElementById('quiz-feedback');
  fb.style.display = 'block';
  document.getElementById('feedback-icon').textContent = correct ? '✅' : '❌';
  document.getElementById('feedback-text').innerHTML =
    `<strong>${scoreText}</strong><br><br>${explanation}`;

  // Scroll feedback into view on mobile
  setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}

function nextQuestion() {
  quizState.currentIndex++;

  if (quizState.currentIndex >= quizState.questions.length || quizState.hp <= 0) {
    finishQuiz();
    return;
  }

  renderQuestion();
  startQuizTimer();
}

function finishQuiz() {
  clearAllTimers();
  // Celebration confetti if did well
  const accuracy = Math.round((quizState.correctCount / quizState.questions.length) * 100);
  if (accuracy >= 50) {
    for (let i = 0; i < (accuracy >= 80 ? 6 : 3); i++) {
      setTimeout(() => {
        spawnConfettiAdvanced(Math.random() * window.innerWidth, Math.random() * window.innerHeight * 0.4, 10);
      }, i * 200);
    }
  }

  collectCards(quizState.answeredCards);
  state.totalScore += quizState.score;
  saveState();

  showResults({
    title: accuracy >= 80 ? 'ยอดเยี่ยม!' : accuracy >= 50 ? 'ทำได้ดี!' : 'ลองอีกครั้ง!',
    icon: quizState.hp <= 0 ? '💀' : accuracy >= 80 ? '🎉' : '📚',
    stats: [
      { label: 'ตอบถูก', value: `${quizState.correctCount}/${quizState.questions.length}` },
      { label: 'ความแม่นยำ', value: accuracy + '%' },
      { label: 'Streak สูงสุด', value: '🔥 ' + quizState.maxStreak },
      { label: 'คะแนนรวม', value: quizState.score },
    ],
    cards: quizState.answeredCards,
    funFact: CARDS[Math.floor(Math.random() * CARDS.length)].funFact,
    replayFn: () => startGame('quiz'),
  });
}

function quitQuiz() {
  clearAllTimers();
  showScreen('home');
}

function startQuizTimer() {
  const timerEl = document.getElementById('quiz-timer');
  state.timers.quiz = setInterval(() => {
    quizState.timeLeft--;
    timerEl.textContent = '⏱ ' + quizState.timeLeft;
    if (quizState.timeLeft <= 5) timerEl.classList.add('danger');
    else timerEl.classList.remove('danger');
    if (quizState.timeLeft <= 0) {
      clearInterval(state.timers.quiz);
      answerQuestion(-1);
    }
  }, 1000);
}

// ================================
// RESULTS
// ================================
function showResults({ title, icon, stats, cards, funFact, replayFn }) {
  document.getElementById('results-icon').textContent = icon;
  document.getElementById('results-title').textContent = title;

  const statsContainer = document.getElementById('results-stats');
  statsContainer.innerHTML = stats.map(s => `
    <div class="result-stat">
      <span class="result-stat-label">${s.label}</span>
      <span class="result-stat-value">${s.value}</span>
    </div>
  `).join('');

  const cardsContainer = document.getElementById('results-cards');
  const uniqueCards = [...new Set(cards)];
  cardsContainer.innerHTML = uniqueCards.slice(0, 6).map(id => {
    const card = CARDS.find(c => c.id === id);
    return card ? `<div class="game-card" onclick="showCardModal('${id}')" style="cursor:pointer;border-color:${getSystemColor(card.system)}">
      <span class="card-icon">${card.icon}</span>
      <span class="card-name">${card.name}</span>
    </div>` : '';
  }).join('');

  if (funFact) {
    document.getElementById('results-funfact').style.display = 'block';
    document.getElementById('funfact-text').textContent = funFact;
  } else {
    document.getElementById('results-funfact').style.display = 'none';
  }

  const replayBtn = document.getElementById('results-replay-btn');
  replayBtn.onclick = replayFn;

  showScreen('results');
}

// ================================
// COLLECTION
// ================================
let collectionFilter = 'all';

function renderCollection() {
  const filtersContainer = document.getElementById('collection-filters');
  filtersContainer.innerHTML = `<button class="filter-btn ${collectionFilter === 'all' ? 'active' : ''}" onclick="filterCollection('all')">ทั้งหมด</button>`;
  SYSTEMS.forEach(sys => {
    filtersContainer.innerHTML += `<button class="filter-btn ${collectionFilter === sys.id ? 'active' : ''}"
      onclick="filterCollection('${sys.id}')" style="${collectionFilter === sys.id ? 'background:'+sys.color : ''}">${sys.icon} ${sys.name}</button>`;
  });

  const grid = document.getElementById('collection-grid');
  const filteredCards = collectionFilter === 'all'
    ? CARDS
    : CARDS.filter(c => c.system === collectionFilter);

  grid.innerHTML = filteredCards.map(card => {
    const unlocked = state.collectedCards.has(card.id);
    const sys = SYSTEMS.find(s => s.id === card.system);
    return `
      <div class="collection-card ${unlocked ? '' : 'locked'}" onclick="${unlocked ? `showCardModal('${card.id}')` : ''}">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${sys.color};border-radius:var(--radius-lg) var(--radius-lg) 0 0;"></div>
        <div class="card-header">
          <span class="card-header-icon">${unlocked ? card.icon : '❓'}</span>
          <div class="card-header-info">
            <h3>${unlocked ? card.name : '???'}</h3>
            <span class="card-en">${unlocked ? card.nameEn : '???'}</span>
          </div>
          <span class="card-rarity">${'★'.repeat(card.rarity)}${'☆'.repeat(3 - card.rarity)}</span>
        </div>
        <span class="card-system-tag" style="background:${sys.color}20;color:${sys.color}">${sys.icon} ${sys.name}</span>
        ${unlocked ? `<p class="card-description">${card.description}</p>` : '<p class="card-description" style="font-style:italic">เล่นเกมเพื่อปลดล็อคการ์ดนี้</p>'}
        ${unlocked ? `<div class="card-funfact">💡 ${card.funFact}</div>` : ''}
      </div>`;
  }).join('');

  document.getElementById('collection-count').textContent = state.collectedCards.size + ' การ์ด';
}

function filterCollection(filter) {
  collectionFilter = filter;
  renderCollection();
}

// ================================
// CARD MODAL (Bottom Sheet on mobile)
// ================================
function showCardModal(cardId) {
  const card = CARDS.find(c => c.id === cardId);
  if (!card) return;
  vibrate(15);

  const sys = SYSTEMS.find(s => s.id === card.system);
  const modal = document.getElementById('card-modal');
  const content = document.getElementById('modal-content');

  content.innerHTML = `
    <div class="modal-card-icon">${card.icon}</div>
    <div class="modal-card-name">${card.name}</div>
    <div class="modal-card-en">${card.nameEn}</div>
    <span class="card-system-tag" style="background:${sys.color}20;color:${sys.color};display:inline-block;margin-bottom:12px;">${sys.icon} ${sys.name}</span>
    <span class="card-rarity" style="margin-left:10px">${'★'.repeat(card.rarity)}${'☆'.repeat(3 - card.rarity)}</span>
    <p class="modal-card-desc">${card.description}</p>
    <div class="modal-card-fact">💡 ${card.funFact}</div>
    <button class="modal-close" onclick="closeModal()">ปิด</button>`;

  modal.style.display = 'flex';
}

function closeModal() {
  document.getElementById('card-modal').style.display = 'none';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ================================
// INIT
// ================================
loadState();
