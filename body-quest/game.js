// ============================
// Body Quest - Game Logic
// ============================

// ---------- STATE ----------
const state = {
  totalScore: 0,
  collectedCards: new Set(),
  achievements: new Set(),
  currentGame: null,
  timers: {},
};

// Load saved state from localStorage
function loadState() {
  try {
    const saved = localStorage.getItem('bodyquest_state');
    if (saved) {
      const data = JSON.parse(saved);
      state.totalScore = data.totalScore || 0;
      state.collectedCards = new Set(data.collectedCards || []);
      state.achievements = new Set(data.achievements || []);
    }
  } catch(e) { /* ignore */ }
  updateHomeStats();
}

function saveState() {
  try {
    localStorage.setItem('bodyquest_state', JSON.stringify({
      totalScore: state.totalScore,
      collectedCards: [...state.collectedCards],
      achievements: [...state.achievements],
    }));
  } catch(e) { /* ignore */ }
}

// ---------- NAVIGATION ----------
function showScreen(id) {
  clearAllTimers();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById('screen-' + id);
  if (screen) screen.classList.add('active');
  if (id === 'home') updateHomeStats();
  if (id === 'collection') renderCollection();
}

function updateHomeStats() {
  document.getElementById('total-score').textContent = state.totalScore.toLocaleString();
  document.getElementById('cards-collected').textContent = state.collectedCards.size;
  document.getElementById('cards-total').textContent = CARDS.length;
  const level = Math.floor(state.totalScore / 500) + 1;
  const titles = ['นักศึกษาใหม่','นักสำรวจร่างกาย','ผู้เชี่ยวชาญเซลล์','พยาบาลฝึกหัด','พยาบาลมืออาชีพ'];
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

function collectCards(cardIds) {
  let newCards = [];
  cardIds.forEach(id => {
    if (!state.collectedCards.has(id)) {
      state.collectedCards.add(id);
      newCards.push(id);
    }
  });
  if (newCards.length > 0) {
    showToast(`🎴 ปลดล็อคการ์ดใหม่ ${newCards.length} ใบ!`, 'achievement');
    saveState();
  }
  return newCards;
}

function getSystemColor(systemId) {
  const sys = SYSTEMS.find(s => s.id === systemId);
  return sys ? sys.color : '#666';
}

function getSystemName(systemId) {
  const sys = SYSTEMS.find(s => s.id === systemId);
  return sys ? sys.name : systemId;
}

// ---------- START GAME ----------
function startGame(mode) {
  clearAllTimers();
  state.currentGame = mode;
  switch(mode) {
    case 'system-match': initSystemMatch(); break;
    case 'body-builder': initBodyBuilder(); break;
    case 'quiz': initQuiz(); break;
  }
}

// ================================
// MODE 1: SYSTEM MATCH
// ================================
let matchState = {};

function initSystemMatch() {
  // Pick 3 random systems
  const systems = shuffle(SYSTEMS).slice(0, 3);
  const systemIds = systems.map(s => s.id);

  // Get cards for those systems
  const cards = shuffle(CARDS.filter(c => systemIds.includes(c.system)));

  matchState = {
    systems: systems,
    cards: cards,
    placements: {}, // cardId -> systemId
    timeLeft: 60,
    score: 0,
    checked: false,
  };

  showScreen('system-match');
  renderMatchCards();
  renderMatchZones();
  startMatchTimer();
  document.getElementById('match-check-btn').style.display = 'none';
  document.getElementById('match-score').textContent = '0 คะแนน';
}

function renderMatchCards() {
  const container = document.getElementById('match-cards');
  container.innerHTML = '';

  matchState.cards.forEach(card => {
    if (matchState.placements[card.id]) return; // Already placed

    const el = document.createElement('div');
    el.className = 'game-card';
    el.draggable = true;
    el.dataset.cardId = card.id;
    el.innerHTML = `<span class="card-icon">${card.icon}</span>
      <span class="card-name">${card.name}<br><span class="card-name-en">${card.nameEn}</span></span>`;

    // Drag events
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.id);
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));

    // Click-to-select (mobile fallback)
    el.addEventListener('click', () => {
      if (matchState.checked) return;
      document.querySelectorAll('.game-card.selected').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      matchState.selectedCard = card.id;
    });

    container.appendChild(el);
  });
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

    // Drop events
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const cardId = e.dataTransfer.getData('text/plain');
      placeCardInZone(cardId, sys.id);
    });

    // Click to place (mobile)
    zone.addEventListener('click', () => {
      if (matchState.selectedCard && !matchState.checked) {
        placeCardInZone(matchState.selectedCard, sys.id);
        matchState.selectedCard = null;
      }
    });

    container.appendChild(zone);
  });
}

function placeCardInZone(cardId, systemId) {
  if (matchState.checked) return;
  const card = CARDS.find(c => c.id === cardId);
  if (!card) return;

  // Remove from any previous zone
  Object.keys(matchState.placements).forEach(k => {
    if (matchState.placements[k] === matchState.placements[cardId]) {
      // Keep others
    }
  });

  matchState.placements[cardId] = systemId;

  // Update zone display
  const zoneCards = document.getElementById('zone-' + systemId);
  // Remove if already there
  const existing = zoneCards.querySelector(`[data-card-id="${cardId}"]`);
  if (existing) existing.remove();

  // Also remove from other zones
  document.querySelectorAll('.zone-cards .game-card').forEach(el => {
    if (el.dataset.cardId === cardId) el.remove();
  });

  const el = document.createElement('div');
  el.className = 'game-card';
  el.dataset.cardId = cardId;
  el.draggable = true;
  el.innerHTML = `<span class="card-icon">${card.icon}</span><span class="card-name">${card.name}</span>`;

  // Allow re-dragging from zones
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', cardId);
    delete matchState.placements[cardId];
    el.remove();
    renderMatchCards();
  });

  el.addEventListener('click', () => {
    if (matchState.checked) return;
    delete matchState.placements[cardId];
    el.remove();
    renderMatchCards();
  });

  zoneCards.appendChild(el);
  renderMatchCards();

  // Show check button if all cards placed
  const allPlaced = matchState.cards.every(c => matchState.placements[c.id]);
  document.getElementById('match-check-btn').style.display = allPlaced ? 'block' : 'none';
}

function checkMatches() {
  if (matchState.checked) return;
  matchState.checked = true;
  clearAllTimers();

  let correct = 0;
  const total = matchState.cards.length;

  matchState.cards.forEach(card => {
    const placed = matchState.placements[card.id];
    const isCorrect = placed === card.system;
    if (isCorrect) correct++;

    // Highlight cards in zones
    document.querySelectorAll(`.zone-cards .game-card[data-card-id="${card.id}"]`).forEach(el => {
      el.classList.add(isCorrect ? 'correct' : 'wrong');
    });
  });

  // Highlight zones
  matchState.systems.forEach(sys => {
    const zone = document.querySelector(`.match-zone[data-system-id="${sys.id}"]`);
    const zoneCards = matchState.cards.filter(c => matchState.placements[c.id] === sys.id);
    const allCorrect = zoneCards.every(c => c.system === sys.id);
    if (zoneCards.length > 0) {
      zone.classList.add(allCorrect ? 'correct' : 'wrong');
    }
  });

  const timeBonus = matchState.timeLeft * 2;
  const accuracyScore = Math.round((correct / total) * 300);
  matchState.score = accuracyScore + timeBonus;

  document.getElementById('match-score').textContent = matchState.score + ' คะแนน';
  document.getElementById('match-check-btn').style.display = 'none';

  // Collect cards
  const correctCardIds = matchState.cards.filter(c => matchState.placements[c.id] === c.system).map(c => c.id);
  collectCards(correctCardIds);

  // Check achievements
  if (correct === total && !state.achievements.has('perfect_match')) {
    state.achievements.add('perfect_match');
    showToast('🎯 รางวัล: จับคู่แม่นยำ!', 'achievement');
  }
  if (!state.achievements.has('first_match')) {
    state.achievements.add('first_match');
    showToast('⭐ รางวัล: เริ่มต้นดี!', 'achievement');
  }

  state.totalScore += matchState.score;
  saveState();

  // Show results after delay
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
// MODE 2: BODY BUILDER
// ================================
let bodyState = {};

function initBodyBuilder() {
  // Select subset of cards that have positions
  const cards = shuffle(CARDS.filter(c => c.position)).slice(0, 8);

  bodyState = {
    cards: cards,
    placed: {}, // cardId -> dropZoneId
    selectedCard: null,
    timeLeft: 90,
    correctCount: 0,
  };

  showScreen('body-builder');
  renderBodyDropZones();
  renderBodyCards();
  startBodyTimer();
  document.getElementById('body-score').textContent = `0 / ${cards.length}`;
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
    zone.title = 'วางอวัยวะที่นี่';

    // Drop
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const cardId = e.dataTransfer.getData('text/plain');
      placeOnBody(cardId, card.id);
    });

    // Click
    zone.addEventListener('click', () => {
      if (bodyState.selectedCard) {
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
    el.className = 'body-card' + (bodyState.placed[card.id] ? ' placed' : '');
    el.draggable = true;
    el.dataset.cardId = card.id;
    el.innerHTML = `<span class="card-icon" style="font-size:24px">${card.icon}</span>
      <div>
        <div style="font-weight:600">${card.name}</div>
        <div style="font-size:11px;color:var(--text-muted)">${card.nameEn}</div>
      </div>`;

    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.id);
    });

    el.addEventListener('click', () => {
      document.querySelectorAll('.body-card.selected').forEach(c => c.classList.remove('selected'));
      if (!bodyState.placed[card.id]) {
        el.classList.add('selected');
        bodyState.selectedCard = card.id;
      }
    });

    panel.appendChild(el);
  });
}

function placeOnBody(cardId, zoneCardId) {
  // zoneCardId is the correct card for this zone
  const zone = document.getElementById('body-zone-' + zoneCardId);
  const card = CARDS.find(c => c.id === cardId);
  if (!card || !zone || zone.classList.contains('filled')) return;

  const isCorrect = cardId === zoneCardId;

  if (isCorrect) {
    zone.classList.add('filled');
    zone.textContent = card.icon;
    zone.title = card.name;
    bodyState.placed[cardId] = zoneCardId;
    bodyState.correctCount++;

    document.getElementById('body-score').textContent = `${bodyState.correctCount} / ${bodyState.cards.length}`;
    showToast(`✅ ${card.name} ถูกต้อง!`, 'success');

    bodyState.selectedCard = null;
    renderBodyCards();

    // Check if all placed
    if (bodyState.correctCount === bodyState.cards.length) {
      clearAllTimers();
      setTimeout(() => finishBodyBuilder(), 500);
    }
  } else {
    zone.classList.add('wrong-placement');
    setTimeout(() => zone.classList.remove('wrong-placement'), 500);
    showToast(`❌ ไม่ใช่ตำแหน่งนี้ ลองใหม่!`, 'error');
  }
}

function finishBodyBuilder() {
  const timeBonus = bodyState.timeLeft * 2;
  const placementScore = bodyState.correctCount * 50;
  const totalScore = placementScore + timeBonus;

  const correctIds = Object.keys(bodyState.placed);
  collectCards(correctIds);

  if (bodyState.correctCount === bodyState.cards.length && !state.achievements.has('body_master')) {
    state.achievements.add('body_master');
    showToast('🩺 รางวัล: ผู้เชี่ยวชาญร่างกาย!', 'achievement');
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
    questions: questions,
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

  // Reset timer
  quizState.timeLeft = 15;
  document.getElementById('quiz-timer').textContent = '⏱ 15';
  document.getElementById('quiz-timer').classList.remove('danger');
}

function answerQuestion(index) {
  clearInterval(state.timers.quiz);

  const q = quizState.questions[quizState.currentIndex];
  const isCorrect = index === q.correct;
  const timeTaken = 15 - quizState.timeLeft;

  // Disable all options
  const options = document.querySelectorAll('.quiz-option');
  options.forEach(o => o.classList.add('disabled'));

  // Highlight correct/wrong
  options[q.correct].classList.add('correct');
  if (!isCorrect) options[index].classList.add('wrong');

  if (isCorrect) {
    const basePoints = 30;
    const timeBonus = Math.max(0, (15 - timeTaken) * 2);
    const streakBonus = quizState.streak * 5;
    const points = basePoints + timeBonus + streakBonus;

    quizState.score += points;
    quizState.streak++;
    quizState.maxStreak = Math.max(quizState.maxStreak, quizState.streak);
    quizState.correctCount++;

    if (timeTaken <= 3) quizState.fastAnswers++;

    // Collect card related to this system
    const systemCards = CARDS.filter(c => c.system === q.system);
    if (systemCards.length > 0) {
      const randomCard = systemCards[Math.floor(Math.random() * systemCards.length)];
      quizState.answeredCards.push(randomCard.id);
    }

    document.getElementById('quiz-streak').textContent = '🔥 ' + quizState.streak;
    showQuizFeedback(true, `+${points} คะแนน (⏱ +${timeBonus} 🔥 +${streakBonus})`, q.explanation);
  } else {
    quizState.hp = Math.max(0, quizState.hp - 20);
    quizState.streak = 0;

    document.getElementById('quiz-hp-fill').style.width = quizState.hp + '%';
    document.getElementById('quiz-hp-text').textContent = quizState.hp;
    document.getElementById('quiz-streak').textContent = '🔥 0';
    showQuizFeedback(false, 'เสีย 20 HP', q.explanation);
  }

  document.getElementById('quiz-score-display').textContent = quizState.score + ' คะแนน';

  // Check streak achievements
  if (quizState.streak >= 5 && !state.achievements.has('quiz_streak_5')) {
    state.achievements.add('quiz_streak_5');
    showToast('🔥 รางวัล: ตอบรัว 5!', 'achievement');
  }
  if (quizState.streak >= 10 && !state.achievements.has('quiz_streak_10')) {
    state.achievements.add('quiz_streak_10');
    showToast('💎 รางวัล: ตอบรัว 10!', 'achievement');
  }
  if (quizState.fastAnswers >= 5 && !state.achievements.has('speed_demon')) {
    state.achievements.add('speed_demon');
    showToast('⚡ รางวัล: สายฟ้าแลบ!', 'achievement');
  }
}

function showQuizFeedback(correct, scoreText, explanation) {
  const fb = document.getElementById('quiz-feedback');
  fb.style.display = 'block';
  document.getElementById('feedback-icon').textContent = correct ? '✅' : '❌';
  document.getElementById('feedback-text').innerHTML =
    `<strong>${scoreText}</strong><br><br>${explanation}`;
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

  collectCards(quizState.answeredCards);
  state.totalScore += quizState.score;
  saveState();

  const accuracy = Math.round((quizState.correctCount / quizState.questions.length) * 100);
  const survived = quizState.hp > 0;

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
      // Auto-wrong
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

  // Show unlocked cards
  const cardsContainer = document.getElementById('results-cards');
  const uniqueCards = [...new Set(cards)];
  cardsContainer.innerHTML = uniqueCards.slice(0, 6).map(id => {
    const card = CARDS.find(c => c.id === id);
    return card ? `<div class="game-card" onclick="showCardModal('${id}')" style="cursor:pointer;border-color:${getSystemColor(card.system)}">
      <span class="card-icon">${card.icon}</span>
      <span class="card-name">${card.name}</span>
    </div>` : '';
  }).join('');

  // Fun fact
  if (funFact) {
    document.getElementById('results-funfact').style.display = 'block';
    document.getElementById('funfact-text').textContent = funFact;
  } else {
    document.getElementById('results-funfact').style.display = 'none';
  }

  // Replay button
  const replayBtn = document.getElementById('results-replay-btn');
  replayBtn.onclick = replayFn;

  showScreen('results');
}

// ================================
// COLLECTION
// ================================
let collectionFilter = 'all';

function renderCollection() {
  // Filter buttons
  const filtersContainer = document.getElementById('collection-filters');
  filtersContainer.innerHTML = `<button class="filter-btn ${collectionFilter === 'all' ? 'active' : ''}" onclick="filterCollection('all')">ทั้งหมด</button>`;
  SYSTEMS.forEach(sys => {
    filtersContainer.innerHTML += `<button class="filter-btn ${collectionFilter === sys.id ? 'active' : ''}"
      onclick="filterCollection('${sys.id}')" style="${collectionFilter === sys.id ? 'background:'+sys.color : ''}">${sys.icon} ${sys.name}</button>`;
  });

  // Cards grid
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
// CARD MODAL
// ================================
function showCardModal(cardId) {
  const card = CARDS.find(c => c.id === cardId);
  if (!card) return;

  const sys = SYSTEMS.find(s => s.id === card.system);
  const modal = document.getElementById('card-modal');
  const content = document.getElementById('modal-content');

  content.innerHTML = `
    <div class="modal-card-icon">${card.icon}</div>
    <div class="modal-card-name">${card.name}</div>
    <div class="modal-card-en">${card.nameEn}</div>
    <span class="card-system-tag" style="background:${sys.color}20;color:${sys.color};display:inline-block;margin-bottom:15px;">${sys.icon} ${sys.name}</span>
    <span class="card-rarity" style="margin-left:10px">${'★'.repeat(card.rarity)}${'☆'.repeat(3 - card.rarity)}</span>
    <p class="modal-card-desc">${card.description}</p>
    <div class="modal-card-fact">💡 ${card.funFact}</div>
    <button class="modal-close" onclick="closeModal()">ปิด</button>`;

  modal.style.display = 'flex';
}

function closeModal() {
  document.getElementById('card-modal').style.display = 'none';
}

// Close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ================================
// INIT
// ================================
loadState();
