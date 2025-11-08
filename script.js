
async function loadQuiz() {
  const res = await fetch('quiz.json', {cache:'no-store'});
  if (!res.ok) throw new Error('Не вдалось завантажити quiz.json');
  return await res.json();
}

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleOptions(question) {
  const opts = question.options.map((text, i) => ({
    text,
    isCorrect: i === (question.correctIndex ?? 0)
  }));
  // if shuffleOptions is false, keep order
  const shuffled = question.shuffleOptions === false ? opts : shuffle(opts);
  return shuffled;
}

function $(sel) { return document.querySelector(sel); }
function el(tag, attrs={}, children=[]) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k,v]) => {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== undefined) node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(ch => {
    if (ch === null || ch === undefined) return;
    if (typeof ch === 'string') node.appendChild(document.createTextNode(ch));
    else node.appendChild(ch);
  });
  return node;
}

const state = {
  meta: null,
  questions: [],        // [{text, options:[{text,isCorrect}], points}]
  order: [],            // indices in display order
  answers: {},          // qIdx -> selected option index
  current: 0
};

function setupStart(meta) {
  const total = meta.questions.length;
  $('#title').textContent = meta.title || 'Тест';
  $('#total').textContent = total;
  $('#count').value = total;
  $('#count').max = total;
}

function startQuiz() {
  const n = Math.max(1, Math.min(parseInt($('#count').value || 0, 10), state.meta.questions.length));
  const base = state.meta.questions.map(q => ({
    text: q.text,
    options: shuffleOptions(q),
    points: Number.isFinite(q.points) ? q.points : 1
  }));

  // Shuffle questions and take first n
  state.order = shuffle([...Array(base.length).keys()]).slice(0, n);
  state.questions = state.order.map(i => base[i]);
  state.answers = {};
  state.current = 0;

  $('#start-card').style.display = 'none';
  $('#quiz-card').style.display = 'block';
  renderQuestion();
  updateProgress();
}

function updateProgress() {
  const n = state.questions.length;
  const answered = Object.keys(state.answers).length;
  $('#progress-label').textContent = `${answered}/${n}`;
  const pct = Math.round((answered / n) * 100);
  $('#progressbar').style.width = pct + '%';
}

function renderQuestion() {
  const i = state.current;
  const q = state.questions[i];
  $('#q-counter').textContent = `Питання ${i+1} з ${state.questions.length}`;
  $('#q-text').textContent = q.text;

  const selected = state.answers[i];
  const list = $('#options');
  list.innerHTML = '';
  q.options.forEach((opt, j) => {
    const id = `q${i}_o${j}`;
    const radio = el('input', {type:'radio', name:'opt', id});
    if (selected === j) radio.checked = true;
    radio.addEventListener('change', () => {
      state.answers[i] = j;
      updateProgress();
    });

    const label = el('label', {'for':id});
    label.appendChild(el('div', {class:'option'}, [
      radio,
      el('div', {}, [opt.text])
    ]));
    list.appendChild(label);
  });

  // nav buttons
  $('#prev').disabled = i === 0;
  $('#next').disabled = i === state.questions.length - 1;
}

function prevQ() { if (state.current > 0) { state.current--; renderQuestion(); } }
function nextQ() { if (state.current < state.questions.length - 1) { state.current++; renderQuestion(); } }

function submitQuiz() {
  const n = state.questions.length;
  let score = 0;
  const review = [];

  for (let i = 0; i < n; i++) {
    const q = state.questions[i];
    const ans = state.answers[i];
    const correctIdx = q.options.findIndex(o => o.isCorrect);
    const ok = ans === correctIdx;
    if (ok) score += q.points;
    review.push({ q: q.text, options: q.options, ans, correctIdx, ok, points: q.points });
  }

  $('#quiz-card').style.display = 'none';
  $('#result-card').style.display = 'block';
  $('#score').textContent = `${score}`;

  const totalPoints = state.questions.reduce((s,q)=>s+q.points,0);
  $('#total-points').textContent = `${totalPoints}`;

  const reviewWrap = $('#review');
  reviewWrap.innerHTML = '';
  review.forEach((r, idx) => {
    const head = el('div', {}, [
      el('span', {class:'badge'}, r.ok ? 'правильно' : 'неправильно'),
      ' ',
      el('span', {class:'small'}, `балів: ${r.ok ? r.points : 0}/${r.points}`)
    ]);
    const title = el('div', {style:'margin:6px 0; font-weight:600;'}, `${idx+1}. ${r.q}`);
    const ul = el('div', {});

    r.options.forEach((o, j) => {
      const row = el('div', {class: 'review-item ' + (j===r.correctIdx?'correct': (r.ans===j && !o.isCorrect ? 'wrong':''))}, [
        el('div', {}, o.text),
        el('div', {class:'small muted'}, j===r.correctIdx ? 'правильна' : (r.ans===j ? 'ваша відповідь' : ''))
      ]);
      ul.appendChild(row);
    });

    const item = el('div', {class:'card'}, [head, title, ul]);
    reviewWrap.appendChild(item);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const meta = await loadQuiz();
    state.meta = meta;
    setupStart(meta);
    $('#start').addEventListener('click', startQuiz);
    $('#prev').addEventListener('click', prevQ);
    $('#next').addEventListener('click', nextQ);
    $('#submit').addEventListener('click', submitQuiz);
  } catch (e) {
    document.body.innerHTML = '<div class="container"><div class="card"><h2>Помилка</h2><p>'+e.message+'</p></div></div>';
  }
});
