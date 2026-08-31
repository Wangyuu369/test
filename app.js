const STORAGE_KEY = "teacherExamWorkbench.v1";

let defaultQuestions = [];
async function loadQuestionsFromFile() {
  try {
    const response = await fetch("./教育理论基础3600题_题库1.json");
    const data = await response.json();

    defaultQuestions = data.map((item) => ({
      id: item.id,
      category: item.category,
      type: item.type,
      source: item.source,
      question: item.question,
      options: item.options || [],
      answer: item.answer,
      explanation: item.explanation || ""
    }));

    state.questions = defaultQuestions;
    saveState();
    renderAll();

  } catch (error) {
    console.error("题库加载失败：", error);
  }
}

let state = loadState();
let selectedQuestionId = state.currentQuestionId || state.questions[0]?.id;
let selectedOption = "";
let cardIndex = 0;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        questions: parsed.questions?.length ? parsed.questions : defaultQuestions,
        attempts: parsed.attempts || {},
        wrongIds: parsed.wrongIds || [],
        daily: parsed.daily || {},
        currentQuestionId: parsed.currentQuestionId || null,
        importedFiles: parsed.importedFiles || []
      };
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return {
    questions: defaultQuestions,
    attempts: {},
    wrongIds: [],
    daily: {},
    currentQuestionId: null,
    importedFiles: []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getQuestion() {
  return state.questions.find((item) => item.id === selectedQuestionId) || state.questions[0];
}

function answerLetters(question, answer) {
  const raw = String(answer || "").trim().toUpperCase();
  if (/^[A-Z]+$/.test(raw)) return raw.split("");
  const index = question.options.findIndex((option) => option === answer);
  return index >= 0 ? [String.fromCharCode(65 + index)] : [raw];
}

function normalizeSelection(value) {
  return String(value || "").toUpperCase().split("").sort().join("");
}

function isCorrect(question, value) {
  if (question.type === "subjective") return true;
  return normalizeSelection(value) === normalizeSelection(answerLetters(question, question.answer).join(""));
}

function recordAttempt(question, correct) {
  const stats = state.attempts[question.id] || { total: 0, correct: 0, category: question.category };
  stats.total += 1;
  stats.correct += correct ? 1 : 0;
  stats.category = question.category;
  state.attempts[question.id] = stats;

  const day = todayKey();
  state.daily[day] = (state.daily[day] || 0) + 1;

  if (!correct && !state.wrongIds.includes(question.id)) state.wrongIds.push(question.id);
  if (correct) state.wrongIds = state.wrongIds.filter((id) => id !== question.id);
  state.currentQuestionId = question.id;
  saveState();
}

function renderAll() {
  renderCategories();
  renderDashboard();
  renderPractice();
  renderMindmap();
  renderWrongBook();
  renderBank();
}

function renderCategories() {
  const categories = ["全部", ...new Set(state.questions.map((item) => item.category || "未分类"))];
  for (const selector of ["#categoryFilter", "#practiceCategory"]) {
    const node = $(selector);
    const current = node.value || "全部";
    node.innerHTML = categories.map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join("");
    node.value = categories.includes(current) ? current : "全部";
  }
}

function renderDashboard() {
  const attempts = Object.values(state.attempts);
  const total = attempts.reduce((sum, item) => sum + item.total, 0);
  const correct = attempts.reduce((sum, item) => sum + item.correct, 0);
  $("#totalAnswered").textContent = total;
  $("#overallAccuracy").textContent = total ? `${Math.round((correct / total) * 100)}%` : "0%";
  $("#wrongCount").textContent = state.wrongIds.length;
  $("#questionCount").textContent = state.questions.length;
  $("#streakDays").textContent = `${calculateStreak()} 天`;

  const category = $("#categoryFilter").value || "全部";
  const grouped = categoryStats().filter((item) => category === "全部" || item.category === category);
  $("#categoryStats").innerHTML = grouped.length
    ? grouped.map((item) => `
      <div class="stat-row">
        <strong>${escapeHtml(item.category)}</strong>
        <div class="bar"><span style="width:${item.accuracy}%"></span></div>
        <span>${item.accuracy}%</span>
      </div>
    `).join("")
    : `<p class="empty">还没有作答记录。</p>`;

  $("#weakList").innerHTML = weakestCategories().map((item) => `<li>${escapeHtml(item.category)}：${item.accuracy}%</li>`).join("") || "<li>先刷几题，薄弱项会自动出现。</li>";
  renderWeekly();
}

function categoryStats() {
  const stats = {};
  for (const question of state.questions) {
    const category = question.category || "未分类";
    stats[category] ||= { category, total: 0, correct: 0 };
    const attempt = state.attempts[question.id];
    if (attempt) {
      stats[category].total += attempt.total;
      stats[category].correct += attempt.correct;
    }
  }
  return Object.values(stats).map((item) => ({
    ...item,
    accuracy: item.total ? Math.round((item.correct / item.total) * 100) : 0
  }));
}

function weakestCategories() {
  return categoryStats()
    .filter((item) => item.total > 0)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 4);
}

function calculateStreak() {
  let streak = 0;
  const date = new Date();
  while (true) {
    const key = date.toISOString().slice(0, 10);
    if (!state.daily[key]) break;
    streak += 1;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}

function renderWeekly() {
  const labels = ["一", "二", "三", "四", "五", "六", "日"];
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(d);
  }
  const max = Math.max(1, ...days.map((d) => state.daily[d.toISOString().slice(0, 10)] || 0));
  $("#weeklyBars").innerHTML = days.map((d) => {
    const count = state.daily[d.toISOString().slice(0, 10)] || 0;
    const height = Math.max(18, Math.round((count / max) * 140));
    const label = labels[(d.getDay() + 6) % 7];
    return `<div class="day-bar" title="${count} 题" style="height:${height}px"><span>${label}</span></div>`;
  }).join("");
}

function renderPractice() {
  const question = getQuestion();
  if (!question) return;
  selectedQuestionId = question.id;
  $("#practiceTitle").textContent = `第 ${state.questions.findIndex((item) => item.id === question.id) + 1} 题`;
  $("#questionType").textContent = question.type === "multi" ? "多选" : question.type === "subjective" ? "主观" : "单选";
  $("#questionCategory").textContent = question.category || "未分类";
  $("#questionSource").textContent = question.source || "题库";
  $("#questionText").textContent = question.question;
  $("#answerFeedback").classList.remove("is-visible");
  $("#answerFeedback").innerHTML = "";
  selectedOption = "";

  const subjective = question.type === "subjective";
  $("#subjectiveAnswer").classList.toggle("is-visible", subjective);
  $("#optionList").style.display = subjective ? "none" : "grid";
  $("#optionList").innerHTML = (question.options || []).map((option, index) => {
    const letter = String.fromCharCode(65 + index);
    return `<button class="option" data-option="${letter}"><strong>${letter}.</strong> ${escapeHtml(option)}</button>`;
  }).join("");
}

function renderMindmap() {
  const positions = [
    ["8%", "12%"], ["70%", "12%"], ["5%", "48%"],
    ["72%", "48%"], ["16%", "76%"], ["58%", "76%"]
  ];
  $("#mindmap").innerHTML = knowledgeMap.map((node, index) => `
    <div class="mindmap-node" style="left:${positions[index][0]};top:${positions[index][1]}">
      <strong>${node.title}</strong>
      <ul>${node.items.map((item) => `<li>${item}</li>`).join("")}</ul>
    </div>
  `).join("");
}

function renderWrongBook() {
  const wrong = state.wrongIds.map((id) => state.questions.find((item) => item.id === id)).filter(Boolean);
  $("#wrongList").innerHTML = wrong.length
    ? wrong.map((question) => `
      <article class="wrong-item">
        <strong>${escapeHtml(question.question)}</strong>
        <div>分类：${escapeHtml(question.category || "未分类")} · 答案：${escapeHtml(question.answer)}</div>
        <div>${escapeHtml(question.explanation || "暂无解析")}</div>
        <button class="ghost-btn remove-wrong" data-id="${question.id}">移出错题</button>
      </article>
    `).join("")
    : `<article class="wrong-item">错题集目前是空的。</article>`;
}

function renderBank() {
  const bySource = {};
  for (const question of state.questions) {
    const source = question.source || "未命名题库";
    bySource[source] ||= { source, count: 0 };
    bySource[source].count += 1;
  }
  $("#bankList").innerHTML = Object.values(bySource).map((item) => `
    <article class="bank-item">
      <strong>${escapeHtml(item.source)}</strong>
      <span>${item.count} 道题</span>
    </article>
  `).join("");
}

function nextQuestion(random = false) {
  const category = $("#practiceCategory").value || "全部";
  const pool = state.questions.filter((item) => category === "全部" || item.category === category);
  if (!pool.length) return;
  const currentIndex = pool.findIndex((item) => item.id === selectedQuestionId);
  const next = random ? pool[Math.floor(Math.random() * pool.length)] : pool[(currentIndex + 1 + pool.length) % pool.length];
  selectedQuestionId = next.id;
  state.currentQuestionId = next.id;
  saveState();
  renderPractice();
}

function submitAnswer() {
  const question = getQuestion();
  if (!question) return;
  const value = question.type === "subjective" ? $("#subjectiveAnswer").value.trim() : selectedOption;
  if (!value && question.type !== "subjective") return;
  const correct = isCorrect(question, value);
  recordAttempt(question, correct);
  showFeedback(question, correct);
  renderDashboard();
  renderWrongBook();
}

function showFeedback(question, correct) {
  const answer = answerLetters(question, question.answer).join("");
  $$(".option").forEach((button) => {
    const value = button.dataset.option;
    button.classList.toggle("is-correct", answer.includes(value));
    button.classList.toggle("is-wrong", selectedOption.includes(value) && !answer.includes(value));
  });
  $("#answerFeedback").classList.add("is-visible");
  $("#answerFeedback").innerHTML = `<strong>${correct ? "答对了" : "再记一次"}</strong><br>答案：${escapeHtml(question.answer)}<br>${escapeHtml(question.explanation || "")}`;
}

function markWrong() {
  const question = getQuestion();
  if (!question || state.wrongIds.includes(question.id)) return;
  state.wrongIds.push(question.id);
  saveState();
  renderDashboard();
  renderWrongBook();
}

function parseImportedText(text, filename) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (filename.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : parsed.questions || [];
  }
  return parseCsv(trimmed);
}

function parseCsv(text) {
  const rows = text.split(/\r?\n/).filter(Boolean).map((line) => splitCsv(line));
  const headers = rows.shift().map((item) => item.trim());
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function splitCsv(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells.map((item) => item.trim());
}

function normalizeQuestion(item, source, index) {
  const options = Array.isArray(item.options)
    ? item.options
    : String(item.options || "").split(/[|；;]/).map((part) => part.trim()).filter(Boolean);
  return {
    id: item.id || `${source}-${Date.now()}-${index}`,
    category: item.category || item.subject || "未分类",
    type: item.type || (options.length > 1 ? "single" : "subjective"),
    source: item.source || source,
    question: item.question || item.title || item.stem || "",
    options,
    answer: item.answer || item.correct || "",
    explanation: item.explanation || item.analysis || ""
  };
}

async function importFiles(files) {
  for (const file of files) {
    const text = await file.text();
    const raw = parseImportedText(text, file.name);
    const normalized = raw.map((item, index) => normalizeQuestion(item, file.name, index)).filter((item) => item.question);
    state.questions.push(...normalized);
    state.importedFiles.push({ name: file.name, count: normalized.length, at: new Date().toISOString() });
  }
  saveState();
  renderAll();
}

function exportWrong(format) {
  const wrong = state.wrongIds.map((id) => state.questions.find((item) => item.id === id)).filter(Boolean);
  if (format === "csv") {
    const headers = ["category", "question", "options", "answer", "explanation", "source"];
    const rows = wrong.map((item) => headers.map((key) => csvCell(Array.isArray(item[key]) ? item[key].join("|") : item[key] || "")).join(","));
    download(`错题集_${todayKey()}.csv`, [headers.join(","), ...rows].join("\n"), "text/csv");
  } else {
    download(`错题集_${todayKey()}.json`, JSON.stringify(wrong, null, 2), "application/json");
  }
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 300);
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function renderFlashcard() {
  const cards = state.questions;
  if (!cards.length) return;
  const question = cards[cardIndex % cards.length];
  $("#flashFront").textContent = question.question;
  $("#flashBack").textContent = `答案：${question.answer}。${question.explanation || ""}`;
  $("#flashBack").classList.remove("is-visible");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function bindEvents() {
  $$(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  $("#startPracticeBtn").addEventListener("click", () => switchView("practice"));
  $("#categoryFilter").addEventListener("change", renderDashboard);
  $("#practiceCategory").addEventListener("change", () => nextQuestion(true));
  $("#shuffleBtn").addEventListener("click", () => nextQuestion(true));
  $("#nextQuestionBtn").addEventListener("click", () => nextQuestion(false));
  $("#submitAnswerBtn").addEventListener("click", submitAnswer);
  $("#markWrongBtn").addEventListener("click", markWrong);
  $("#optionList").addEventListener("click", (event) => {
    const button = event.target.closest(".option");
    if (!button) return;
    const question = getQuestion();
    if (question.type === "multi") {
      selectedOption = selectedOption.includes(button.dataset.option)
        ? selectedOption.replace(button.dataset.option, "")
        : `${selectedOption}${button.dataset.option}`;
    } else {
      selectedOption = button.dataset.option;
    }
    $$(".option").forEach((item) => item.classList.toggle("is-selected", selectedOption.includes(item.dataset.option)));
  });
  $("#bankFileInput").addEventListener("change", (event) => importFiles(event.target.files));
  $("#exportWrongJsonBtn").addEventListener("click", () => exportWrong("json"));
  $("#exportWrongCsvBtn").addEventListener("click", () => exportWrong("csv"));
  $("#wrongList").addEventListener("click", (event) => {
    const button = event.target.closest(".remove-wrong");
    if (!button) return;
    state.wrongIds = state.wrongIds.filter((id) => id !== button.dataset.id);
    saveState();
    renderAll();
  });
  $("#downloadTemplateBtn").addEventListener("click", () => {
    download("teacher-question-template.json", JSON.stringify(defaultQuestions, null, 2), "application/json");
  });
  $("#resetProgressBtn").addEventListener("click", () => {
    if (!confirm("确认清空学习进度和错题记录？题库会保留。")) return;
    state.attempts = {};
    state.wrongIds = [];
    state.daily = {};
    saveState();
    renderAll();
  });
  $("#generateCardsBtn").addEventListener("click", renderFlashcard);
  $("#flipCardBtn").addEventListener("click", () => $("#flashBack").classList.toggle("is-visible"));
  $("#prevCardBtn").addEventListener("click", () => {
    cardIndex = (cardIndex - 1 + state.questions.length) % state.questions.length;
    renderFlashcard();
  });
  $("#nextCardBtn").addEventListener("click", () => {
    cardIndex = (cardIndex + 1) % state.questions.length;
    renderFlashcard();
  });
}

function switchView(view) {
  $$(".nav-tab").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  $$(".view").forEach((section) => section.classList.toggle("is-active", section.id === view));
  if (view === "memory") renderFlashcard();
}

bindEvents();
loadQuestionsFromFile();
renderFlashcard();

