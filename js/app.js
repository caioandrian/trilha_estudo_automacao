const STORAGE_KEY = "trilha_estudo_automacao_v1";
const THEME_KEY = "trilha_theme_pref";

/** @typedef {{ id: string; texto: string; detalhes?: string | string[] }} ChecklistPasso */
/** @typedef {{ id: string; tipo: string; descricao: string; codigo?: string | null; passos?: ChecklistPasso[]; opcoes?: { id: string; texto: string }[]; corretas?: string[]; explicacao?: string; codigoExplicacao?: string }} Atividade */
/** @typedef {{ titulo: string; url: string }} TeoriaLink */
/** @typedef {{ titulo: string; paragrafos: string[]; codigo?: string | null; links?: TeoriaLink[] }} Teoria */
/** @typedef {{ id: string; ordem: number; titulo: string; contexto: string; teoria?: Teoria; atividades: Atividade[] }} Topico */
/** @typedef {{ titulo: string; topicos: Topico[] }} TrilhaData */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return {
        completed: /** @type {string[]} */ ([]),
        theoryVisited: /** @type {string[]} */ ([]),
        checklist: /** @type {Record<string, string[]>} */ ({}),
        selections: /** @type {Record<string, string[]>} */ ({}),
      };
    const parsed = JSON.parse(raw);
    const completed = Array.isArray(parsed.completed) ? parsed.completed : [];
    const theoryVisited = Array.isArray(parsed.theoryVisited) ? parsed.theoryVisited : [];
    const chk = parsed.checklist;
    const checklist =
      chk && typeof chk === "object" && !Array.isArray(chk) ? /** @type {Record<string, string[]>} */ (chk) : {};
    const sel = parsed.selections;
    const selections =
      sel && typeof sel === "object" && !Array.isArray(sel) ? /** @type {Record<string, string[]>} */ (sel) : {};
    return { completed, theoryVisited, checklist, selections };
  } catch {
    return { completed: [], theoryVisited: [], checklist: {}, selections: {} };
  }
}

function persist(completedSet, theoryVisitedSet, checklistDict, selectionsDict) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      completed: [...completedSet],
      theoryVisited: [...theoryVisitedSet],
      checklist: { ...checklistDict },
      selections: { ...selectionsDict },
    })
  );
}

function saveQuizSelectionsForActivity(
  atividadeId,
  optionsRoot,
  selectionsDict,
  completedSet,
  theoryVisitedSet,
  checklistDict
) {
  const vals = optionsRoot
    ? Array.from(optionsRoot.querySelectorAll("input:checked")).map((/** @type {HTMLInputElement} */ i) => i.value).sort()
    : [];
  if (vals.length === 0) delete selectionsDict[atividadeId];
  else selectionsDict[atividadeId] = vals;
  persist(completedSet, theoryVisitedSet, checklistDict, selectionsDict);
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function flattenIndices(topicos) {
  /** @type {{ topico: Topico; atividade: Atividade; globalIndex: number }[]} */
  const list = [];
  let globalIndex = 0;
  for (const t of topicos) {
    for (const a of t.atividades) {
      list.push({ topico: t, atividade: a, globalIndex: globalIndex++ });
    }
  }
  return list;
}

function topicHasTheory(topico) {
  const t = topico.teoria;
  if (!t) return false;
  const paragraphs = Array.isArray(t.paragrafos) ? t.paragrafos.filter(Boolean) : [];
  return paragraphs.length > 0 || Boolean(t.codigo);
}

function theoryPanelClass(topico) {
  const ctx = topico.contexto || "";
  if (/Cypress|Automação/i.test(ctx)) return "theory-panel--cypress";
  if (/GitHub|Versionamento/i.test(ctx)) return "theory-panel--github";
  return "theory-panel--logica";
}

/** @param {string} contexto */
function sidebarContextoClass(contexto) {
  const ctx = contexto || "";
  if (/Cypress|Automação/i.test(ctx)) return "topic-btn__ctx--cypress";
  if (/GitHub|Versionamento/i.test(ctx)) return "topic-btn__ctx--github";
  return "topic-btn__ctx--logica";
}

function topicDone(topico, completedSet) {
  return topico.atividades.every((a) => completedSet.has(a.id));
}

function collectValidActivityIds(topicos) {
  const ids = new Set();
  for (const t of topicos) for (const a of t.atividades) ids.add(a.id);
  return ids;
}

function pruneStaleCompleted(topicos, completedSet) {
  const valid = collectValidActivityIds(topicos);
  for (const id of [...completedSet]) if (!valid.has(id)) completedSet.delete(id);
}

function pruneStaleSelections(topicos, selections) {
  const valid = collectValidActivityIds(topicos);
  for (const id of Object.keys(selections)) if (!valid.has(id)) delete selections[id];
}

function checklistStepIds(atividade) {
  return new Set((atividade.passos || []).map((p) => p.id));
}

function checklistAllMarked(atividade, checklistDict) {
  const need = checklistStepIds(atividade);
  if (need.size === 0) return false;
  const got = new Set(checklistDict[atividade.id] || []);
  for (const id of need) if (!got.has(id)) return false;
  return true;
}

function syncChecklistCompletion(topicos, completedSet, checklistDict) {
  for (const t of topicos) {
    for (const a of t.atividades) {
      if (a.tipo !== "checklist_trilha") continue;
      if (checklistAllMarked(a, checklistDict)) completedSet.add(a.id);
      else completedSet.delete(a.id);
    }
  }
}

function allDone(topicos, completedSet) {
  const total = topicos.reduce((n, t) => n + t.atividades.length, 0);
  return total > 0 && completedSet.size >= total;
}

async function loadTrilha() {
  const res = await fetch("data/trilha.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Não foi possível carregar data/trilha.json");
  return /** @type {TrilhaData} */ (await res.json());
}

function isMultiSelect(atividade) {
  if (atividade.tipo === "checklist_trilha") return false;
  const c = atividade.corretas;
  return atividade.tipo === "multipla_correta" || (Array.isArray(c) && c.length > 1);
}

function checklistMarkedCount(atividade, checklistDict) {
  const allowed = checklistStepIds(atividade);
  const marked = checklistDict[atividade.id] || [];
  return marked.filter((id) => allowed.has(id)).length;
}

function renderTopicList(
  topicos,
  completedSet,
  activeTopicId,
  onSelectTopic,
  onOpenTopicTheory
) {
  const nav = document.getElementById("topicList");
  if (!nav) return;
  const sorted = [...topicos].sort((a, b) => a.ordem - b.ordem);
  nav.innerHTML = sorted
    .map((t) => {
      const done = topicDone(t, completedSet);
      const active = t.id === activeTopicId;
      const hasTheory = topicHasTheory(t);
      const theoryBtn = hasTheory
        ? `<button type="button" class="btn-topic-theory" data-topic-theory="${escapeHtml(t.id)}" aria-label="Abrir teoria: ${escapeHtml(t.titulo)}">Teoria</button>`
        : "";
      return `
        <div class="topic-block">
          <button type="button" class="topic-btn ${active ? "topic-btn--active" : ""} ${done ? "topic-btn--done" : ""}" data-topic-id="${t.id}">
            <span class="topic-btn__badge">${t.ordem}</span>
            <span class="topic-btn__text">
              <span class="topic-btn__title">${escapeHtml(t.titulo)}</span>
              <span class="topic-btn__ctx ${sidebarContextoClass(t.contexto)}">${escapeHtml(t.contexto)}</span>
            </span>
            <span class="check" aria-hidden="true">✓</span>
          </button>
          ${theoryBtn}
        </div>`;
    })
    .join("");

  nav.querySelectorAll(".topic-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      onSelectTopic(/** @type {HTMLElement} */ (btn).dataset.topicId)
    );
  });
  nav.querySelectorAll("[data-topic-theory]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = /** @type {HTMLElement} */ (btn).dataset.topicTheory;
      if (id) onOpenTopicTheory(id);
    });
  });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** @param {string | string[] | undefined} detalhes */
function formatChecklistDetalhesHtml(detalhes) {
  if (detalhes == null || detalhes === "") return "";
  const parts = Array.isArray(detalhes)
    ? detalhes.map((x) => String(x).trim()).filter(Boolean)
    : String(detalhes)
        .split(/\n\n+/)
        .map((x) => x.trim())
        .filter(Boolean);
  if (parts.length === 0) return "";
  return parts.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
}

function setFeedbackTheoryHint(/** @type {boolean} */ onlyChecklistFollows) {
  const panel = document.getElementById("feedbackPanel");
  if (!panel) return;
  panel.innerHTML = onlyChecklistFollows
    ? `<p class="feedback__hint">Bloco de <strong>teoria</strong>. Depois abra <strong>Ir para a checklist</strong> e marque cada passo ao executá-lo na sua máquina.</p>`
    : `<p class="feedback__hint">Bloco de <strong>teoria</strong>. Quando estiver pronto, use <strong>Ir para as questões</strong> para avaliar o que você aprendeu.</p>`;
}

function clearFeedbackHint() {
  const panel = document.getElementById("feedbackPanel");
  if (!panel) return;
  panel.innerHTML = `<p class="feedback__hint">Responda à atividade e clique em <strong>Verificar resposta</strong> para ver se acertou, com código e explicação.</p>`;
}

function renderTheory(topico, ctx) {
  const view = document.getElementById("activityView");
  const teoria = topico.teoria;
  if (!view || !teoria) return;

  const variant = theoryPanelClass(topico);
  const paragraphs = (teoria.paragrafos || [])
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  const codeHtml = teoria.codigo
    ? `<div class="code-block"><pre>${escapeHtml(teoria.codigo)}</pre></div>`
    : "";
  const linksItems = (teoria.links || [])
    .map(
      (l) =>
        `<li><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.titulo)}</a></li>`
    )
    .join("");

  const linksBlock =
    linksItems.length > 0
      ? `<div class="theory-links">
          <h3>Links para estudo complementar</h3>
          <ul>${linksItems}</ul>
        </div>`
      : "";

  const onlyChecklistFollows =
    Array.isArray(topico.atividades) &&
    topico.atividades.length > 0 &&
    topico.atividades.every((a) => a.tipo === "checklist_trilha");
  const btnTheoryLabel = onlyChecklistFollows ? "Ir para a checklist" : "Ir para as questões";
  const theoryFollowText = onlyChecklistFollows
    ? `O passo a passo seguinte está em formato <strong>checklist</strong>: marque o que já fez até concluir o tópico.`
    : `As questões a seguir servem só para <strong>fixar e avaliar</strong> o conteúdo acima.`;

  view.innerHTML = `
    <div class="theory-shell">
      <article class="theory-panel ${variant}" aria-labelledby="theoryHeading">
        <div class="theory-panel__inner">
          <span class="theory-badge" aria-hidden="true">● Teoria</span>
          <h2 class="theory-heading" id="theoryHeading">${escapeHtml(teoria.titulo || "Teoria")}</h2>
          <div class="theory-body">${paragraphs}</div>
          ${codeHtml}
          ${linksBlock}
          <div class="theory-actions">
            <button type="button" class="btn btn--primary" id="btnTheoryContinue">${btnTheoryLabel}</button>
          </div>
          <p class="theory-follow">${theoryFollowText}</p>
        </div>
      </article>
    </div>`;

  setFeedbackTheoryHint(onlyChecklistFollows);

  document.getElementById("btnTheoryContinue")?.addEventListener("click", () => {
    ctx.theoryVisitedSet.add(topico.id);
    persist(ctx.completedSet, ctx.theoryVisitedSet, ctx.checklistDict, ctx.selectionsDict);
    clearFeedbackHint();
    ctx.paint();
  });
}

function renderChecklistSidebar(atividade, checklistDict) {
  const panel = document.getElementById("feedbackPanel");
  if (!panel) return;
  const steps = atividade.passos || [];
  const n = steps.length;
  const k = checklistMarkedCount(atividade, checklistDict);
  const done = checklistAllMarked(atividade, checklistDict);

  panel.innerHTML = `
    <div class="feedback-result ${done ? "feedback-result--ok" : ""}">
      <p class="feedback-result__title">Checklist</p>
      <p>Você marcou <strong>${k}</strong> de <strong>${n}</strong> passo(s).</p>
      ${
        done
          ? "<p>Este tópico conta como <strong>concluído</strong> na trilha.</p>"
          : "<p>Marque cada item à medida que cumprir no seu terminal ou IDE para avançar o progresso.</p>"
      }
    </div>
    <p class="feedback__hint">Em cada passo, use <strong>Ver detalhes</strong> para orientação extra (instalação, comandos e boas práticas).</p>`;
}

function renderChecklistActivity(ctx, topico, atividade) {
  const {
    completedSet,
    theoryVisitedSet,
    checklistDict,
    selectionsDict,
    onPrev,
    onNext,
    paint,
    topicos,
    onSelectTopic,
    onOpenTopicTheory,
  } = ctx;
  const view = document.getElementById("activityView");
  if (!view) return;

  const idxInTopic = topico.atividades.findIndex((a) => a.id === atividade.id) + 1;
  const totalInTopic = topico.atividades.length;
  const allMarked = checklistAllMarked(atividade, checklistDict);

  const codeHtml = atividade.codigo
    ? `<div class="code-block"><pre>${escapeHtml(atividade.codigo)}</pre></div>`
    : "";

  const passosHtml = (atividade.passos || [])
    .map((p, i) => {
      const checked = (checklistDict[atividade.id] || []).includes(p.id);
      const detalhesBody = formatChecklistDetalhesHtml(p.detalhes);
      const detailsBlock =
        detalhesBody.length > 0
          ? `<details class="checklist__details">
          <summary class="checklist__summary">Ver detalhes</summary>
          <div class="checklist__details-body">${detalhesBody}</div>
        </details>`
          : "";
      return `
      <div class="checklist__card">
        <label class="checklist__item">
          <input type="checkbox" class="checklist__check" data-step-id="${escapeHtml(p.id)}" ${checked ? "checked" : ""} />
          <span class="checklist__marker" aria-hidden="true">${i + 1}</span>
          <span class="checklist__text">${escapeHtml(p.texto)}</span>
        </label>
        ${detailsBlock}
      </div>`;
    })
    .join("");

  view.innerHTML = `
    <article class="activity-card">
      <div class="activity-meta">
        <span class="pill pill--accent">${escapeHtml(topico.contexto)}</span>
        <span class="pill">${idxInTopic} / ${totalInTopic} neste tópico</span>
        <span class="pill">Passo a passo (checklist)</span>
      </div>
      <h2>${escapeHtml(topico.titulo)}</h2>
      <p class="activity-desc">${escapeHtml(atividade.descricao)}</p>
      ${codeHtml}
      <div class="checklist-root" role="group" aria-label="Passos do projeto">${passosHtml}</div>
      <div class="actions">
        <button type="button" class="btn btn--ghost" id="btnPrev">Anterior</button>
        <button type="button" class="btn btn--ghost" id="btnNext">Próxima</button>
        ${allMarked ? `<span class="nav-hint">Checklist completa.</span>` : ""}
      </div>
    </article>`;

  view.querySelectorAll(".checklist__check").forEach((inp) => {
    inp.addEventListener("change", () => {
      const id = inp.getAttribute("data-step-id");
      if (!id) return;
      const arr = checklistDict[atividade.id] ? [...checklistDict[atividade.id]] : [];
      const s = new Set(arr);
      if (inp.checked) s.add(id);
      else s.delete(id);
      checklistDict[atividade.id] = [...s];
      syncChecklistCompletion(topicos, completedSet, checklistDict);
      persist(completedSet, theoryVisitedSet, checklistDict, selectionsDict);
      renderTopicList(topicos, completedSet, topico.id, onSelectTopic, onOpenTopicTheory);
      updateProgress(topicos, completedSet);
      renderChecklistSidebar(atividade, checklistDict);
      if (allDone(topicos, completedSet)) showCongratulations();
    });
  });

  renderChecklistSidebar(atividade, checklistDict);
  document.getElementById("btnPrev")?.addEventListener("click", onPrev);
  document.getElementById("btnNext")?.addEventListener("click", onNext);
}

function renderActivity(ctx) {
  const { flat, index, completedSet, theoryVisitedSet, checklistDict, selectionsDict, onPrev, onNext, paint } = ctx;
  const view = document.getElementById("activityView");
  if (!view) return;

  if (index < 0 || index >= flat.length) {
    view.innerHTML = `<p class="loading">Nenhuma atividade.</p>`;
    return;
  }

  const { topico, atividade } = flat[index];

  if (atividade.tipo === "checklist_trilha") {
    renderChecklistActivity(ctx, topico, atividade);
    return;
  }

  const idxInTopic = topico.atividades.findIndex((a) => a.id === atividade.id) + 1;
  const totalInTopic = topico.atividades.length;
  const already = completedSet.has(atividade.id);
  const multi = isMultiSelect(atividade);

  const codeHtml = atividade.codigo
    ? `<div class="code-block"><pre>${escapeHtml(atividade.codigo)}</pre></div>`
    : "";

  const inputType = multi ? "checkbox" : "radio";
  const inputName = multi ? `opt-${atividade.id}` : `opt-${atividade.id}`;

  const savedSel = new Set(selectionsDict[atividade.id] || []);

  const optionsHtml = atividade.opcoes
    .map((o) => {
      const chk = savedSel.has(o.id) ? " checked" : "";
      return `
        <label class="option">
          <input type="${inputType}" name="${inputName}" value="${escapeHtml(o.id)}"${chk} />
          <span class="option__id">${escapeHtml(o.id)}</span>
          <span class="option__text">${escapeHtml(o.texto)}</span>
        </label>`;
    })
    .join("");

  const tipoLabel =
    atividade.tipo === "desafio_codigo"
      ? "Desafio: analisar código"
      : atividade.tipo === "multipla_correta"
        ? "Múltipla escolha (uma ou mais corretas)"
        : "Múltipla escolha";

  view.innerHTML = `
    <article class="activity-card">
      <div class="activity-meta">
        <span class="pill pill--accent">${escapeHtml(topico.contexto)}</span>
        <span class="pill">Questão ${idxInTopic} / ${totalInTopic} neste tópico</span>
        <span class="pill">${escapeHtml(tipoLabel)}</span>
      </div>
      <h2>${escapeHtml(topico.titulo)}</h2>
      <p class="activity-desc">${escapeHtml(atividade.descricao)}</p>
      ${codeHtml}
      <div class="options" id="optionsRoot">${optionsHtml}</div>
      <div class="actions">
        <button type="button" class="btn btn--primary" id="btnVerify">Verificar resposta</button>
        <button type="button" class="btn btn--ghost" id="btnPrev">Anterior</button>
        <button type="button" class="btn btn--ghost" id="btnNext">Próxima</button>
        ${already ? `<span class="nav-hint">Já concluída — pode revisar ou avançar.</span>` : ""}
      </div>
    </article>`;

  const optionsRoot = document.getElementById("optionsRoot");
  optionsRoot?.addEventListener("change", () => {
    saveQuizSelectionsForActivity(atividade.id, optionsRoot, selectionsDict, completedSet, theoryVisitedSet, checklistDict);
  });

  document.getElementById("btnVerify")?.addEventListener("click", () => {
    const root = document.getElementById("optionsRoot");
    saveQuizSelectionsForActivity(atividade.id, root, selectionsDict, completedSet, theoryVisitedSet, checklistDict);
    const selected = new Set(
      root ? Array.from(root.querySelectorAll("input:checked")).map((/** @type {HTMLInputElement} */ i) => i.value) : []
    );
    const correct = new Set(atividade.corretas);
    const ok = setsEqual(selected, correct);
    renderFeedback(ok, atividade, selected);
    if (ok) {
      completedSet.add(atividade.id);
      persist(completedSet, theoryVisitedSet, checklistDict, selectionsDict);
      renderTopicList(ctx.topicos, completedSet, topico.id, ctx.onSelectTopic, ctx.onOpenTopicTheory);
      updateProgress(ctx.topicos, completedSet);
      if (allDone(ctx.topicos, completedSet)) {
        showCongratulations();
      }
    }
  });

  document.getElementById("btnPrev")?.addEventListener("click", onPrev);
  document.getElementById("btnNext")?.addEventListener("click", onNext);

  if (already) {
    renderCompletedQuestionPanel(atividade, selectionsDict);
  } else {
    clearFeedbackHint();
  }
}

function renderCompletedQuestionPanel(atividade, selectionsDict) {
  const panel = document.getElementById("feedbackPanel");
  if (!panel) return;
  const saved = selectionsDict[atividade.id] || [];
  const savedSet = new Set(saved.map((l) => String(l).toLowerCase()));
  const correctSet = new Set(
    (atividade.corretas || []).map((l) => String(l).toLowerCase())
  );
  const matches = setsEqual(savedSet, correctSet);

  const selArrSaved = saved.length
    ? [...saved].map((l) => String(l).toUpperCase()).sort().join(", ")
    : "(nenhuma)";
  const corrArrSaved = [...(atividade.corretas || [])]
    .map((l) => String(l).toUpperCase())
    .sort()
    .join(", ");
  const selArrWrong = [...saved].sort().join(", ") || "(nenhuma)";
  const corrArrWrong = [...(atividade.corretas || [])].sort().join(", ");

  const resultCls = matches ? "feedback-result--ok" : "feedback-result--bad";
  const title = matches ? "Questão já respondida" : "Resposta incorreta";
  const detailLine = matches
    ? `<p>Sua seleção salva: <strong>${escapeHtml(selArrSaved)}</strong>. Gabarito: <strong>${escapeHtml(corrArrSaved)}</strong>.</p>`
    : `<p>Você marcou: <strong>${escapeHtml(selArrWrong)}</strong>. Corretas: <strong>${escapeHtml(corrArrWrong)}</strong>.</p>`;

  const expl = atividade.explicacao || "";
  const code = atividade.codigoExplicacao || "";
  const codeBlock = code
    ? `<div class="feedback-section">
      <h3>Código / referência</h3>
      <div class="code-block"><pre>${escapeHtml(code)}</pre></div>
    </div>`
    : "";
  panel.innerHTML = `
    <div class="feedback-result ${resultCls}">
      <p class="feedback-result__title">${escapeHtml(title)}</p>
      ${detailLine}
    </div>
    <div class="feedback-section">
      <h3>Explicação</h3>
      <p style="margin:0;color:var(--muted)">${escapeHtml(expl)}</p>
    </div>
    ${codeBlock}`;
}

function renderFeedback(ok, atividade, selected) {
  const panel = document.getElementById("feedbackPanel");
  if (!panel) return;

  const selArr = [...selected].sort().join(", ") || "(nenhuma)";
  const corrArr = [...atividade.corretas].sort().join(", ");

  const title = ok ? "Resposta correta" : "Resposta incorreta";
  const cls = ok ? "feedback-result--ok" : "feedback-result--bad";

  panel.innerHTML = `
    <div class="feedback-result ${cls}">
      <p class="feedback-result__title">${title}</p>
      <p>Você marcou: <strong>${escapeHtml(selArr)}</strong>. Corretas: <strong>${escapeHtml(corrArr)}</strong>.</p>
    </div>
    <div class="feedback-section">
      <h3>Explicação</h3>
      <p style="margin:0;color:var(--muted)">${escapeHtml(atividade.explicacao)}</p>
    </div>
    <div class="feedback-section">
      <h3>Código / referência</h3>
      <div class="code-block"><pre>${escapeHtml(atividade.codigoExplicacao)}</pre></div>
    </div>`;
}

function updateProgress(topicos, completedSet) {
  const total = topicos.reduce((n, t) => n + t.atividades.length, 0);
  const pct = total === 0 ? 0 : Math.round((completedSet.size / total) * 100);
  const fill = document.getElementById("progressFill");
  const pctEl = document.getElementById("progressPct");
  if (fill) {
    fill.style.width = `${pct}%`;
    fill.parentElement?.setAttribute("aria-valuenow", String(pct));
  }
  if (pctEl) pctEl.textContent = `${pct}%`;
}

function showCongratulations() {
  const view = document.getElementById("activityView");
  if (!view) return;
  view.innerHTML = `
    <div class="congrats">
      <h2>Parabéns!</h2>
      <p>Você concluiu a trilha de estudos básicos para iniciar automação de testes.</p>
    </div>`;
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const isLight = saved !== "dark";
  document.documentElement.setAttribute("data-theme", isLight ? "light" : "dark");

  const btn = document.getElementById("themeToggle");
  const label = document.getElementById("themeLabel");
  if (btn) btn.setAttribute("aria-checked", isLight ? "true" : "false");
  if (label) label.textContent = isLight ? "Tema claro" : "Tema escuro";

  btn?.addEventListener("click", () => {
    const nowLight = document.documentElement.getAttribute("data-theme") === "light";
    const next = nowLight ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next === "light" ? "light" : "dark");
    localStorage.setItem(THEME_KEY, next);
    btn.setAttribute("aria-checked", next === "light" ? "true" : "false");
    if (label) label.textContent = next === "light" ? "Tema claro" : "Tema escuro";
  });
}

async function main() {
  initTheme();

  const topicListEl = document.getElementById("topicList");
  const sidebarToggle = document.getElementById("sidebarToggle");

  sidebarToggle?.addEventListener("click", () => {
    const expanded = sidebarToggle.getAttribute("aria-expanded") === "true";
    sidebarToggle.setAttribute("aria-expanded", String(!expanded));
    topicListEl?.classList.toggle("collapsed", expanded);
  });

  let data;
  try {
    data = await loadTrilha();
  } catch (e) {
    const view = document.getElementById("activityView");
    if (view) {
      view.innerHTML = `
        <div class="activity-card">
          <h2>Erro ao carregar a trilha</h2>
          <p class="activity-desc">Abra o site por um servidor local (por exemplo, na pasta do projeto: <code>npx serve</code> ou extensão Live Server), pois o navegador bloqueia <code>fetch</code> em arquivos <code>file://</code>.</p>
          <p class="activity-desc" style="margin-top:0.75rem">${escapeHtml(String(e))}</p>
        </div>`;
    }
    return;
  }

  const topicos = data.topicos.sort((a, b) => a.ordem - b.ordem);
  const flat = flattenIndices(topicos);
  const state = loadState();
  const completedSet = new Set(state.completed);
  const theoryVisitedSet = new Set(state.theoryVisited);
  /** @type {Record<string, string[]>} */
  const checklistDict = { ...state.checklist };
  /** @type {Record<string, string[]>} */
  const selectionsDict = { ...state.selections };
  pruneStaleCompleted(topicos, completedSet);
  pruneStaleSelections(topicos, selectionsDict);
  syncChecklistCompletion(topicos, completedSet, checklistDict);
  persist(completedSet, theoryVisitedSet, checklistDict, selectionsDict);

  let currentIndex = 0;
  for (let i = 0; i < flat.length; i++) {
    if (!completedSet.has(flat[i].atividade.id)) {
      currentIndex = i;
      break;
    }
    currentIndex = i;
  }
  if (flat.length && allDone(topicos, completedSet)) {
    currentIndex = flat.length - 1;
  }

  function activeTopicId() {
    if (currentIndex < 0 || currentIndex >= flat.length) return topicos[0]?.id ?? "";
    return flat[currentIndex].topico.id;
  }

  function currentTopicoFromIndex() {
    if (currentIndex < 0 || currentIndex >= flat.length) return null;
    return flat[currentIndex].topico;
  }

  function shouldShowTheory() {
    const t = currentTopicoFromIndex();
    if (!t) return false;
    return topicHasTheory(t) && !theoryVisitedSet.has(t.id);
  }

  function onSelectTopic(topicId) {
    const idx = flat.findIndex((x) => x.topico.id === topicId);
    if (idx >= 0) {
      currentIndex = idx;
      clearFeedbackHint();
      paint();
    }
  }

  function onOpenTopicTheory(topicId) {
    const idx = flat.findIndex((x) => x.topico.id === topicId);
    if (idx >= 0) {
      currentIndex = idx;
      theoryVisitedSet.delete(topicId);
      persist(completedSet, theoryVisitedSet, checklistDict, selectionsDict);
      clearFeedbackHint();
      paint();
    }
  }

  function paint() {
    if (allDone(topicos, completedSet)) {
      updateProgress(topicos, completedSet);
      renderTopicList(topicos, completedSet, activeTopicId(), onSelectTopic, onOpenTopicTheory);
      showCongratulations();
      return;
    }

    const ctx = {
      flat,
      topicos,
      index: currentIndex,
      completedSet,
      theoryVisitedSet,
      checklistDict,
      selectionsDict,
      onSelectTopic,
      onOpenTopicTheory,
      paint,
      onPrev: () => {
        if (currentIndex > 0) {
          currentIndex--;
          clearFeedbackHint();
          paint();
        }
      },
      onNext: () => {
        if (currentIndex < flat.length - 1) {
          currentIndex++;
          clearFeedbackHint();
          paint();
        }
      },
    };

    renderTopicList(topicos, completedSet, activeTopicId(), onSelectTopic, onOpenTopicTheory);
    updateProgress(topicos, completedSet);

    if (shouldShowTheory()) {
      const t = currentTopicoFromIndex();
      if (t) renderTheory(t, ctx);
      return;
    }

    renderActivity(ctx);
  }

  if (allDone(topicos, completedSet)) {
    updateProgress(topicos, completedSet);
    renderTopicList(topicos, completedSet, activeTopicId(), onSelectTopic, onOpenTopicTheory);
    showCongratulations();
  } else {
    paint();
  }
}

main();
