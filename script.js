const BUILTIN_QUIZZES = [
  // приклад:
  { id: "vocab1", name: "Старі тести 230шт", path: "quiz.json" },
  { id: "emergency", name: "Нові тести", path: "quiz1.json" },
  { id: "emergencyPreparation", name: "Долікарська підготовка", path: "quiz2.json" },
];

function $(sel) {
  return document.querySelector(sel);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(ch => {
    if (ch == null) return;
    if (typeof ch === "string") node.appendChild(document.createTextNode(ch));
    else node.appendChild(ch);
  });
  return node;
}

// shuffle
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const state = {
  rawQuestions: [],
  activeQuestions: [],
  answers: {},
  current: 0,
  title: "Тест із JSON-файлів"
};

function initBuiltinSelect() {
  const sel = $("#builtin-select");
  BUILTIN_QUIZZES.forEach(q => {
    const opt = document.createElement("option");
    opt.value = q.id;
    opt.textContent = q.name;
    sel.appendChild(opt);
  });
}

function updateTotal() {
  $("#total").textContent = state.rawQuestions.length;
}

function mergeQuestionsFromJson(data) {
  if (!data) return;
  const qs = Array.isArray(data.questions) ? data.questions : [];
  qs.forEach(q => {
    if (!q || !q.text || !Array.isArray(q.options) || q.options.length < 2) return;
    state.rawQuestions.push({
      text: String(q.text),
      options: q.options.slice(),
      correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : null,
      shuffleOptions: q.shuffleOptions !== false,
      points: Number.isFinite(q.points) ? q.points : 1
    });
  });
  if (data.title && typeof data.title === "string") {
    state.title = data.title;
  }
  $("#title").textContent = state.title;
  updateTotal();
}

function loadLocalFiles(files) {
  if (!files || !files.length) return;
  state.rawQuestions = [];
  state.title = "Тест із JSON-файлів";
  $("#title").textContent = state.title;

  let remaining = files.length;
  for (const file of files) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const json = JSON.parse(e.target.result);
        mergeQuestionsFromJson(json);
      } catch (err) {
        console.error("Помилка парсингу JSON з файлу", file.name, err);
      } finally {
        remaining -= 1;
        if (remaining === 0) {
          updateTotal();
        }
      }
    };
    reader.readAsText(file, "utf-8");
  }
}

async function loadBuiltinById(id) {
  const item = BUILTIN_QUIZZES.find(x => x.id === id);
  if (!item) {
    alert("Не знайдено вбудований тест з таким ID");
    return;
  }
  try {
    const res = await fetch(item.path, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    state.rawQuestions = [];
    state.title = data.title || item.name || "Тест";
    $("#title").textContent = state.title;
    mergeQuestionsFromJson(data);
  } catch (e) {
    console.error(e);
    alert("Не вдалося завантажити вбудований тест: " + e.message);
  }
}

function prepareQuiz() {
  const total = state.rawQuestions.length;
  if (!total) {
    alert("Немає завантажених питань. Спочатку обери файли або вбудований тест.");
    return false;
  }
  let n = parseInt($("#count").value || "0", 10);
  if (!Number.isFinite(n) || n <= 0) n = total;
  if (n > total) n = total;

  const order = shuffle([...Array(total).keys()]).slice(0, n);
  state.activeQuestions = order.map(i => {
    const q = state.rawQuestions[i];
    const opts = q.options.map((text, idx) => ({
      text: String(text),
      isCorrect: q.correctIndex === idx
    }));
    const finalOptions = q.shuffleOptions !== false ? shuffle(opts) : opts;
    const newCorrectIndex = finalOptions.findIndex(o => o.isCorrect);
    return {
      text: q.text,
      options: finalOptions,
      correctIndex: newCorrectIndex >= 0 ? newCorrectIndex : null,
      points: q.points
    };
  });

  state.answers = {};
  state.current = 0;
  return true;
}

function updateProgress() {
  const n = state.activeQuestions.length;
  const answered = Object.keys(state.answers).length;
  $("#progress-label").textContent = answered + "/" + n;
  const pct = n ? Math.round((answered / n) * 100) : 0;
  $("#progressbar").style.width = pct + "%";
}

function renderQuestion() {
  const i = state.current;
  const q = state.activeQuestions[i];
  $("#q-counter").textContent = "Питання " + (i + 1) + " з " + state.activeQuestions.length;
  $("#q-text").textContent = q.text;

  const selected = state.answers[i];
  const list = $("#options");
  list.innerHTML = "";

  q.options.forEach((opt, j) => {
    const id = "q" + i + "_o" + j;
    const radio = el("input", { type: "radio", name: "opt", id: id });
    if (selected === j) radio.checked = true;
    radio.addEventListener("change", () => {
      state.answers[i] = j;
      updateProgress();
    });

    const label = el("label", { for: id });
    label.appendChild(el("div", { class: "option" }, [
      radio,
      el("div", {}, opt.text)
    ]));
    list.appendChild(label);
  });

  $("#prev").disabled = i === 0;
  $("#next").disabled = i === state.activeQuestions.length - 1;
}

function prevQ() {
  if (state.current > 0) {
    state.current -= 1;
    renderQuestion();
  }
}

function nextQ() {
  if (state.current < state.activeQuestions.length - 1) {
    state.current += 1;
    renderQuestion();
  }
}

function submitQuiz() {
  const n = state.activeQuestions.length;
  let score = 0;
  const review = [];

  for (let i = 0; i < n; i++) {
    const q = state.activeQuestions[i];
    const ans = state.answers[i];
    const correctIdx = q.correctIndex;
    const ok = typeof correctIdx === "number" && ans === correctIdx;
    if (ok) score += q.points;
    review.push({
      q: q.text,
      options: q.options,
      ans,
      correctIdx,
      ok,
      points: q.points
    });
  }

  $("#quiz-card").style.display = "none";
  $("#loader-card").style.display = "none";
  $("#result-card").style.display = "block";

  $("#score").textContent = String(score);
  const totalPoints = state.activeQuestions.reduce((s, q) => s + q.points, 0);
  $("#total-points").textContent = String(totalPoints);

  const wrap = $("#review");
  wrap.innerHTML = "";
  review.forEach((r, idx) => {
    const head = el("div", {}, [
      el("span", { class: "badge" }, r.ok ? "правильно" : "неправильно"),
      " ",
      el("span", { class: "small" }, "балів: " + (r.ok ? r.points : 0) + "/" + r.points +
        (r.correctIdx == null ? " (correctIndex не заданий)" : ""))
    ]);
    const title = el("div", { style: "margin:6px 0;font-weight:600;" }, (idx + 1) + ". " + r.q);
    const list = el("div", {});
    r.options.forEach((o, j) => {
      const cls =
        j === r.correctIdx ? "review-item correct" :
        (r.ans === j && r.correctIdx != null && !o.isCorrect ? "review-item wrong" : "review-item");
      const info =
        j === r.correctIdx ? "правильна" :
        (r.ans === j ? "ваша відповідь" : "");
      const row = el("div", { class: cls }, [
        el("div", {}, o.text),
        el("div", { class: "small muted" }, info)
      ]);
      list.appendChild(row);
    });

    const card = el("div", { class: "card" }, [head, title, list]);
    wrap.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initBuiltinSelect();
  updateTotal();

  $("#file-input").addEventListener("change", e => {
    loadLocalFiles(e.target.files);
  });

  $("#load-builtin").addEventListener("click", () => {
    const id = $("#builtin-select").value;
    if (!id) {
      alert("Вибери вбудований тест зі списку або використай локальні файли.");
      return;
    }
    loadBuiltinById(id);
  });

  $("#start").addEventListener("click", () => {
    if (!prepareQuiz()) return;
    $("#loader-card").style.display = "none";
    $("#quiz-card").style.display = "block";
    $("#result-card").style.display = "none";
    renderQuestion();
    updateProgress();
  });

  $("#prev").addEventListener("click", prevQ);
  $("#next").addEventListener("click", nextQ);
  $("#submit").addEventListener("click", submitQuiz);
});
