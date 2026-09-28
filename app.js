// 중2 역사 퀴즈 앱 로직
const STORAGE_KEY = "midhist_quiz_v1";
const CIRCLE = ["①", "②", "③", "④", "⑤"];
let state = loadState();
let currentIndex = 0;
let currentFilter = "all";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

function normalize(s) {
  return (s || "")
    .replace(/\s+/g, "")
    .replace(/[.,·・、,()（）\[\]『』「」【】·]/g, "")
    .toLowerCase();
}

function checkShortAnswer(userInput, acceptable) {
  const u = normalize(userInput);
  if (!u) return false;
  return acceptable.some(a => {
    const na = normalize(a);
    return u === na || u.includes(na) || na.includes(u);
  });
}

function getFilteredIndices() {
  return QUESTIONS
    .map((q, i) => ({ q, i }))
    .filter(({ q, i }) => {
      const s = state[q.id];
      if (currentFilter === "all") return true;
      if (currentFilter === "unsolved") return !s || !s.done;
      if (currentFilter === "wrong") return s && s.done && s.correct === false;
      if (currentFilter === "mcq") return q.type === "mcq";
      if (currentFilter === "short") return q.type === "short";
      if (currentFilter === "long") return q.type === "long";
      return true;
    })
    .map(({ i }) => i);
}

function updateStats() {
  const total = QUESTIONS.length;
  const done = Object.values(state).filter(s => s.done).length;
  const correct = Object.values(state).filter(s => s.correct === true).length;
  const wrong = Object.values(state).filter(s => s.correct === false).length;
  document.getElementById("chip-progress").textContent = `${done} / ${total}`;
  document.getElementById("chip-score").textContent = `정답 ${correct}`;
  document.getElementById("chip-wrong").textContent = `오답 ${wrong}`;
  document.getElementById("progress").style.width = `${(done / total) * 100}%`;
}

function render() {
  const area = document.getElementById("quiz-area");
  const indices = getFilteredIndices();
  if (indices.length === 0) {
    area.innerHTML = `<div class="card summary-card"><h2>해당 조건의 문항이 없습니다.</h2><p class="sub-title">필터를 바꿔 보세요.</p></div>`;
    return;
  }
  if (currentIndex >= indices.length) currentIndex = indices.length - 1;
  if (currentIndex < 0) currentIndex = 0;
  const qIdx = indices[currentIndex];
  const q = QUESTIONS[qIdx];
  const st = state[q.id] || {};

  const typeLabel = { mcq: "5지선다", short: "단답형", long: "서술형" }[q.type];

  let html = `
    <div class="card">
      <div class="q-meta">
        <span class="q-num">Q ${q.id}</span>
        <span class="q-type">${typeLabel}</span>
        <span class="q-topic">${q.topic}</span>
        <span style="margin-left:auto; color:var(--sub); font-size:12px;">${currentIndex + 1} / ${indices.length} · 전체 ${q.id}/${QUESTIONS.length}</span>
      </div>
      <div class="q-body">${q.q}</div>
  `;

  if (q.type === "mcq") {
    html += `<div class="choices">`;
    for (let i = 0; i < q.choices.length; i++) {
      const n = i + 1;
      let cls = "choice";
      if (st.done) {
        cls += " disabled";
        if (n === q.answer) cls += " correct";
        else if (n === st.pick) cls += " wrong";
      }
      html += `
        <button class="${cls}" data-pick="${n}" ${st.done ? "disabled" : ""}>
          <span class="choice-mark">${CIRCLE[i]}</span>
          <span>${q.choices[i]}</span>
        </button>
      `;
    }
    html += `</div>`;
  } else if (q.type === "short") {
    html += `
      <input class="short-input" id="short-input" placeholder="정답을 입력하세요" value="${st.userText || ""}" ${st.done ? "disabled" : ""}>
      <div class="submit-row">
        ${!st.done ? `<button class="btn primary" id="submit-short">채점하기</button>` : ""}
      </div>
    `;
  } else if (q.type === "long") {
    html += `
      <textarea class="long-input" id="long-input" placeholder="답을 서술하세요 (자기채점 방식)" ${st.done ? "disabled" : ""}>${st.userText || ""}</textarea>
      <div class="submit-row">
        ${!st.done ? `<button class="btn primary" id="submit-long">모범 답안 보기</button>` : ""}
      </div>
    `;
  }

  if (st.done) {
    html += renderExplain(q, st);
  }

  html += `</div>`;

  // 네비게이션 요약
  html += `<div class="footer-note">전체 진행: 정답 ${Object.values(state).filter(s => s.correct === true).length}개 · 오답 ${Object.values(state).filter(s => s.correct === false).length}개 · 서술형(자기채점) ${Object.values(state).filter(s => s.correct === "self").length}개</div>`;

  area.innerHTML = html;

  // 이벤트 바인딩
  if (q.type === "mcq" && !st.done) {
    document.querySelectorAll(".choice").forEach(btn => {
      btn.addEventListener("click", () => {
        const pick = parseInt(btn.dataset.pick, 10);
        state[q.id] = {
          done: true,
          pick,
          correct: pick === q.answer,
          type: "mcq"
        };
        saveState();
        updateStats();
        render();
      });
    });
  } else if (q.type === "short" && !st.done) {
    const btn = document.getElementById("submit-short");
    const inp = document.getElementById("short-input");
    const submit = () => {
      const val = inp.value.trim();
      if (!val) {
        inp.focus();
        return;
      }
      const ok = checkShortAnswer(val, q.answer);
      state[q.id] = {
        done: true,
        userText: val,
        correct: ok,
        type: "short"
      };
      saveState();
      updateStats();
      render();
    };
    btn.addEventListener("click", submit);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
    inp.focus();
  } else if (q.type === "long" && !st.done) {
    const btn = document.getElementById("submit-long");
    const inp = document.getElementById("long-input");
    btn.addEventListener("click", () => {
      const val = inp.value.trim();
      state[q.id] = {
        done: true,
        userText: val,
        correct: null,
        type: "long"
      };
      saveState();
      updateStats();
      render();
    });
    inp.focus();
  }

  // 서술형 자기채점 버튼
  if (q.type === "long" && st.done) {
    document.querySelectorAll(".self-grade button").forEach(b => {
      b.addEventListener("click", () => {
        state[q.id].selfGrade = b.dataset.grade;
        state[q.id].correct = "self";
        saveState();
        render();
      });
    });
  }
}

function renderExplain(q, st) {
  let html = `<div class="explain">`;
  if (q.type === "mcq") {
    if (st.correct) {
      html += `<div class="explain-head"><span class="explain-label ok">정답</span> ${CIRCLE[q.answer - 1]}번</div>`;
    } else {
      html += `<div class="explain-head"><span class="explain-label no">오답</span> 선택: ${CIRCLE[st.pick - 1]}번 / 정답: ${CIRCLE[q.answer - 1]}번</div>`;
    }
    html += `<div class="explain-block"><strong>왜 정답인가?</strong><br>${q.explain.why}</div>`;
    if (q.explain.wrongs && q.explain.wrongs.length > 0) {
      html += `<div class="explain-block"><strong>다른 선지 해설</strong><ul class="explain-wrong-list">`;
      q.explain.wrongs.forEach(w => {
        html += `<li>${w}</li>`;
      });
      html += `</ul></div>`;
    }
  } else if (q.type === "short") {
    const okAns = q.answer.join(" / ");
    if (st.correct) {
      html += `<div class="explain-head"><span class="explain-label ok">정답</span> ${okAns}</div>`;
    } else {
      html += `<div class="explain-head"><span class="explain-label no">오답</span> 내 답: <em>${escapeHtml(st.userText)}</em> / 정답: ${okAns}</div>`;
    }
    html += `<div class="explain-block">${q.explain.why}</div>`;
  } else if (q.type === "long") {
    html += `<div class="explain-head"><span class="explain-label model">모범 답안</span></div>`;
    html += `<div class="explain-block">${q.model}</div>`;
    if (q.rubric && q.rubric.length > 0) {
      html += `<div class="explain-block"><strong>채점 기준</strong><ul class="explain-wrong-list">`;
      q.rubric.forEach(r => {
        html += `<li>${r}</li>`;
      });
      html += `</ul></div>`;
    }
    html += `<div class="explain-block">${q.explain.why}</div>`;
    html += `<div class="explain-block"><strong>자기 채점</strong>
      <div class="self-grade">
        <button data-grade="상" class="${st.selfGrade === "상" ? "picked" : ""}">상 (모범 답안 수준)</button>
        <button data-grade="중" class="${st.selfGrade === "중" ? "picked" : ""}">중 (핵심 일부)</button>
        <button data-grade="하" class="${st.selfGrade === "하" ? "picked" : ""}">하 (미흡)</button>
      </div>
    </div>`;
  }
  html += `</div>`;
  return html;
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// 이벤트 리스너
document.getElementById("btn-prev").addEventListener("click", () => {
  currentIndex--;
  render();
});
document.getElementById("btn-next").addEventListener("click", () => {
  const indices = getFilteredIndices();
  currentIndex = Math.min(currentIndex + 1, indices.length - 1);
  render();
});
document.getElementById("btn-reset").addEventListener("click", () => {
  if (confirm("모든 풀이 기록을 지우시겠어요?")) {
    state = {};
    saveState();
    currentIndex = 0;
    updateStats();
    render();
  }
});
document.getElementById("btn-theme").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme") || "light";
  const next = cur === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("midhist_theme", next); } catch (e) {}
});
document.querySelectorAll(".filter-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.dataset.filter;
    currentIndex = 0;
    render();
  });
});
document.getElementById("jump-btn").addEventListener("click", () => {
  const n = parseInt(document.getElementById("jump-input").value, 10);
  if (n >= 1 && n <= QUESTIONS.length) {
    // 필터 무시하고 전체로 이동
    currentFilter = "all";
    document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
    document.querySelector('.filter-chip[data-filter="all"]').classList.add("active");
    currentIndex = n - 1;
    render();
  }
});
document.getElementById("jump-input").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("jump-btn").click();
});

// 초기 테마
try {
  const savedTheme = localStorage.getItem("midhist_theme");
  if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
} catch (e) {}

// 초기 렌더
updateStats();
render();
