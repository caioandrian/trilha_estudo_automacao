const STORAGE_KEY = "trilha_estudo_automacao_v1";
const THEME_KEY = "trilha_theme_pref";
const CONTEXT_KEY = "trilha_contexto_pref";
/** Em atividades com `codigo`, a pergunta mostra `.code-block`; no feedback, quando houver `codigoExplicacao`. Na teoria, quando houver `teoria.codigo`. */

/** @typedef {{ id: string; texto: string; detalhes?: string | string[]; codigoExemplo?: string }} ChecklistPasso */
/** @typedef {{ id: string; tipo: string; descricao: string; codigo?: string | null; passos?: ChecklistPasso[]; opcoes?: { id: string; texto: string }[]; corretas?: string[]; explicacao?: string; codigoExplicacao?: string }} Atividade */
/** @typedef {{ titulo: string; url: string }} TeoriaLink */
/** @typedef {{ titulo: string; paragrafos: string[]; codigo?: string | null; links?: TeoriaLink[] }} Teoria */
/** @typedef {{ titulo: string; passos: string[]; codigoFinal: string }} DesafioBloco */
/** @typedef {{ titulo?: string; introducao?: string[]; siteUrl?: string; credenciais?: { usuario: string; senha: string }; blocos: DesafioBloco[] }} Desafios */
/** @typedef {{ id: string; ordem: number; titulo: string; contexto: string; teoria?: Teoria; desafios?: Desafios; atividades: Atividade[] }} Topico */
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

function topicHasDesafios(topico) {
  const d = topico.desafios;
  return Boolean(d && Array.isArray(d.blocos) && d.blocos.length > 0);
}

function contextNavVariantClass(/** @type {string} */ label) {
  const ctx = label || "";
  if (/Cypress|Automação/i.test(ctx)) return "context-nav__btn--cypress";
  if (/GitHub|Versionamento/i.test(ctx)) return "context-nav__btn--github";
  return "context-nav__btn--logica";
}

/** @returns {"topic-btn--ctx-logica" | "topic-btn--ctx-cypress" | "topic-btn--ctx-github"} */
function topicBtnContextClass(/** @type {string} */ contextoLabel) {
  const v = contextNavVariantClass(contextoLabel);
  if (v.includes("cypress")) return "topic-btn--ctx-cypress";
  if (v.includes("github")) return "topic-btn--ctx-github";
  return "topic-btn--ctx-logica";
}

function collectContextos(topicos) {
  const sorted = [...topicos].sort((a, b) => a.ordem - b.ordem);
  const seen = new Set();
  /** @type {string[]} */
  const list = [];
  for (const t of sorted) {
    const c = t.contexto || "";
    if (seen.has(c)) continue;
    seen.add(c);
    list.push(c);
  }
  return list;
}

function contextIsComplete(contexto, topicos, completedSet) {
  let total = 0;
  let done = 0;
  for (const t of topicos) {
    if (t.contexto !== contexto) continue;
    for (const a of t.atividades) {
      total++;
      if (completedSet.has(a.id)) done++;
    }
  }
  return total > 0 && done === total;
}

function firstActivityIndexForContext(contexto, flat, completedSet, /** @type {boolean} */ allDoneGlobally) {
  if (allDoneGlobally && flat.length > 0) return flat.length - 1;
  let firstAny = -1;
  for (let i = 0; i < flat.length; i++) {
    if (flat[i].topico.contexto !== contexto) continue;
    if (firstAny < 0) firstAny = i;
    if (!completedSet.has(flat[i].atividade.id)) return i;
  }
  return firstAny >= 0 ? firstAny : 0;
}

function renderContextNav(contextos, selectedContexto, topicos, completedSet, onSelectContexto) {
  const nav = document.getElementById("contextNav");
  if (!nav) return;
  nav.innerHTML = contextos
    .map((label) => {
      const complete = contextIsComplete(label, topicos, completedSet);
      const active = label === selectedContexto;
      const check = complete
        ? `<span class="context-nav__check" aria-hidden="true">✓</span>`
        : "";
      const variantCls = contextNavVariantClass(label);
      return `<button type="button" role="tab" aria-selected="${active}" class="context-nav__btn ${variantCls} ${
        active ? "context-nav__btn--active" : ""
      } ${complete ? "context-nav__btn--complete" : ""}" data-contexto="${escapeHtml(label)}">${check}<span class="context-nav__label">${escapeHtml(label)}</span></button>`;
    })
    .join("");

  nav.querySelectorAll(".context-nav__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const label = /** @type {HTMLElement} */ (btn).dataset.contexto;
      if (label) {
        onSelectContexto(label);
        closeContextNavMobilePanel();
      }
    });
  });
  syncContextNavMobileLabel(selectedContexto);
}

function syncContextNavMobileLabel(/** @type {string} */ selectedContexto) {
  const el = document.getElementById("contextNavActiveOnly");
  if (!el) return;
  el.textContent = selectedContexto;
  const btnVariant = contextNavVariantClass(selectedContexto);
  const activeOnlyVariant = btnVariant.replace("context-nav__btn--", "context-nav__active-only--");
  el.className = `context-nav__active-only ${activeOnlyVariant}`;
}

function closeContextNavMobilePanel() {
  if (!window.matchMedia(MOBILE_STUDY_SCROLL_MQ).matches) return;
  const wrap = document.getElementById("contextNavWrap");
  const toggle = document.getElementById("contextNavToggle");
  wrap?.classList.remove("context-nav-wrap--open");
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}

/** Ao voltar para desktop, remove o estado expandido do menu de contexto. */
function resetContextNavMobileForViewport() {
  if (window.matchMedia(MOBILE_STUDY_SCROLL_MQ).matches) return;
  const wrap = document.getElementById("contextNavWrap");
  const toggle = document.getElementById("contextNavToggle");
  wrap?.classList.remove("context-nav-wrap--open");
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}

function wireContextNavMobileToggle() {
  const wrap = document.getElementById("contextNavWrap");
  const toggle = document.getElementById("contextNavToggle");
  if (!wrap || !toggle) return;
  toggle.addEventListener("click", () => {
    if (!window.matchMedia(MOBILE_STUDY_SCROLL_MQ).matches) return;
    const open = !wrap.classList.contains("context-nav-wrap--open");
    wrap.classList.toggle("context-nav-wrap--open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
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

function topicSidebarKindLabel(topico) {
  const acts = topico.atividades || [];
  if (acts.length === 0) return "Perguntas";
  const allChecklist = acts.every((a) => a.tipo === "checklist_trilha");
  return allChecklist ? "Passo a passo" : "Perguntas";
}

function syncTopbarOffset() {
  const bar = document.querySelector(".topbar");
  if (!bar) return;
  document.documentElement.style.setProperty("--topbar-offset", `${Math.ceil(bar.getBoundingClientRect().height)}px`);
}

/** Mesmo breakpoint da grade em coluna única (sidebar + conteúdo empilhados). */
const MOBILE_STUDY_SCROLL_MQ = "(max-width: 1024px)";

function isMobileStudyLayout() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_STUDY_SCROLL_MQ).matches;
}

/** Ancora em #main__inner (conteúdo da trilha), respeitando a barra fixa via scroll-margin. */
function scrollAnchorMainInner() {
  requestAnimationFrame(() => {
    const el = document.getElementById("main__inner");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/** Ancora no quadro de resposta após verificar (ou aviso de validação). */
function scrollAnchorFeedbackPanel() {
  requestAnimationFrame(() => {
    const el = document.getElementById("feedbackPanel");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderTopicList(
  topicos,
  completedSet,
  activeTopicId,
  selectedContexto,
  onSelectTopic,
  onOpenTopicTheory,
  onOpenTopicActivities,
  onOpenTopicDesafios
) {
  const nav = document.getElementById("topicList");
  if (!nav) return;
  const sorted = [...topicos].sort((a, b) => a.ordem - b.ordem);
  const visible = sorted.filter((t) => t.contexto === selectedContexto);
  nav.innerHTML = visible
    .map((t) => {
      const done = topicDone(t, completedSet);
      const ctxCls = topicBtnContextClass(t.contexto);
      const isCurrent = t.id === activeTopicId;
      const hasTheory = topicHasTheory(t);
      const hasDesafios = topicHasDesafios(t);
      const kindLabel = topicSidebarKindLabel(t);
      const theoryBtn = hasTheory
        ? `<button type="button" class="btn-topic-theory" data-topic-theory="${escapeHtml(t.id)}" aria-label="Abrir teoria: ${escapeHtml(t.titulo)}">Teoria</button>`
        : "";
      const desafiosBtn = hasDesafios
        ? `<button type="button" class="btn-topic-theory" data-topic-desafios="${escapeHtml(t.id)}" aria-label="Abrir desafios: ${escapeHtml(t.titulo)}">Desafios</button>`
        : "";
      const kindBtn = `<button type="button" class="btn-topic-theory" data-topic-activities="${escapeHtml(t.id)}" aria-label="Ir para: ${escapeHtml(kindLabel)} — ${escapeHtml(t.titulo)}">${escapeHtml(kindLabel)}</button>`;
      const currentAttr = isCurrent ? ' aria-current="true"' : "";
      return `
        <div class="topic-block">
          <button type="button" class="topic-btn ${ctxCls} ${done ? "topic-btn--done" : ""} ${isCurrent ? "topic-btn--current" : ""}" data-topic-id="${t.id}"${currentAttr}>
            <span class="topic-btn__badge">${t.ordem}</span>
            <span class="topic-btn__text">
              <span class="topic-btn__title">${escapeHtml(t.titulo)}</span>
            </span>
            <span class="check" aria-hidden="true">✓</span>
          </button>
          ${theoryBtn}
          ${kindBtn}
          ${desafiosBtn}
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
  nav.querySelectorAll("[data-topic-desafios]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = /** @type {HTMLElement} */ (btn).dataset.topicDesafios;
      if (id) onOpenTopicDesafios(id);
    });
  });
  nav.querySelectorAll("[data-topic-activities]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = /** @type {HTMLElement} */ (btn).dataset.topicActivities;
      if (id) onOpenTopicActivities(id);
    });
  });
}

function activityCodeBlockHtml(/** @type {string | null | undefined} */ code) {
  if (code == null || String(code).trim() === "") return "";
  return `<div class="code-block"><pre>${escapeHtml(String(code))}</pre></div>`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Trechos entre ** viram &lt;strong&gt; (escape). */
function formatActivityDescBoldSegments(/** @type {string} */ plain) {
  const bits = plain.split(/\*\*/);
  return bits
    .map((bit, i) => {
      const esc = escapeHtml(bit);
      return i % 2 === 1 ? `<strong>${esc}</strong>` : esc;
    })
    .join("");
}

/** {{iu:...}} = itálico e sublinhado; demais trechos seguem regra de **. */
function formatActivityDescParagraph(/** @type {string} */ para) {
  const re = /\{\{iu:([\s\S]*?)\}\}/g;
  let out = "";
  let last = 0;
  let m;
  while ((m = re.exec(para)) !== null) {
    out += formatActivityDescBoldSegments(para.slice(last, m.index));
    out += `<em class="activity-desc--iu">${escapeHtml(m[1])}</em>`;
    last = m.index + m[0].length;
  }
  out += formatActivityDescBoldSegments(para.slice(last));
  return out;
}

/** Parágrafos em \\n\\n; ** negrito; \\{\\{iu:...\\}\\} itálico e sublinhado (conteúdo escapado). */
function formatActivityDescricaoHtml(/** @type {string | null | undefined} */ raw) {
  const text = raw == null ? "" : String(raw);
  const paras = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  if (paras.length === 0) return `<p class="activity-desc"></p>`;
  return paras.map((para) => `<p class="activity-desc">${formatActivityDescParagraph(para)}</p>`).join("");
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
  const view = document.getElementById("main__inner");
  const teoria = topico.teoria;
  if (!view || !teoria) return;

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
      <article class="theory-panel" aria-labelledby="theoryHeading">
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
    if (isMobileStudyLayout()) scrollAnchorMainInner();
  });
}

function setFeedbackDesafiosHint(/** @type {boolean} */ onlyChecklistFollows) {
  const panel = document.getElementById("feedbackPanel");
  if (!panel) return;
  panel.innerHTML = onlyChecklistFollows
    ? `<p class="feedback__hint">Conteúdo de <strong>desafios práticos</strong>. Depois use <strong>Passo a passo</strong> na barra lateral para marcar a checklist do projeto.</p>`
    : `<p class="feedback__hint">Desafios práticos: implemente no seu projeto e volte às atividades do tópico quando quiser.</p>`;
}

function renderDesafios(topico) {
  const view = document.getElementById("main__inner");
  const d = topico.desafios;
  if (!view || !d || !Array.isArray(d.blocos)) return;

  const introHtml = (d.introducao || [])
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");

  const creds = d.credenciais;
  const credsHtml =
    creds && (creds.usuario || creds.senha)
      ? `<div class="desafios-creds" aria-label="Credenciais do site de demonstração">
          <p class="desafios-creds__title">Credenciais (Sauce Demo)</p>
          <p><strong>Usuário:</strong> <code>${escapeHtml(creds.usuario || "")}</code></p>
          <p><strong>Senha:</strong> <code>${escapeHtml(creds.senha || "")}</code></p>
        </div>`
      : "";

  const siteUrl = (d.siteUrl || "").trim();
  const siteBlock = siteUrl
    ? `<div class="desafios-site">
        <p class="desafios-site__label">Acesse o site da tarefa</p>
        <p><a href="${escapeHtml(siteUrl)}" target="_blank" rel="noopener noreferrer" class="desafios-site__link">${escapeHtml(siteUrl)}</a></p>
      </div>`
    : "";

  const blocosHtml = d.blocos
    .map((bloco, i) => {
      const passos = (bloco.passos || [])
        .filter(Boolean)
        .map((pas) => `<li>${escapeHtml(pas)}</li>`)
        .join("");
      const code = (bloco.codigoFinal || "").trim();
      const collapse =
        code.length > 0
          ? `<details class="desafios-code-collapse">
          <summary class="desafios-code-collapse__summary">Código final (referência)</summary>
          <div class="desafios-code-collapse__body"><pre>${escapeHtml(code)}</pre></div>
        </details>`
          : "";
      return `
        <section class="desafios-bloco" aria-labelledby="desafio-bloco-h-${i}">
          <h3 class="desafios-bloco__title" id="desafio-bloco-h-${i}">${escapeHtml(bloco.titulo || "Passo a passo")}</h3>
          <ol class="desafios-passos">${passos}</ol>
          ${collapse}
        </section>`;
    })
    .join("");

  const onlyChecklistFollows =
    Array.isArray(topico.atividades) &&
    topico.atividades.length > 0 &&
    topico.atividades.every((a) => a.tipo === "checklist_trilha");

  view.innerHTML = `
    <div class="theory-shell">
      <article class="theory-panel desafios-panel" aria-labelledby="desafiosHeading">
        <div class="theory-panel__inner">
          <span class="theory-badge desafios-badge" aria-hidden="true">◆ Desafios</span>
          <h2 class="theory-heading" id="desafiosHeading">${escapeHtml(d.titulo || "Desafios")}</h2>
          <div class="theory-body desafios-intro">${introHtml}</div>
          ${siteBlock}
          ${credsHtml}
          ${blocosHtml}
        </div>
      </article>
    </div>`;

  setFeedbackDesafiosHint(onlyChecklistFollows);
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

function wireChecklistDetailsAccordion(/** @type {Element | null | undefined} */ checklistRoot) {
  if (!checklistRoot) return;
  checklistRoot.querySelectorAll(".checklist__details").forEach((det) => {
    det.addEventListener("toggle", () => {
      if (!(det instanceof HTMLDetailsElement) || !det.open) return;
      checklistRoot.querySelectorAll(".checklist__details").forEach((other) => {
        if (other !== det && other instanceof HTMLDetailsElement) other.open = false;
      });
    });
  });
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
    onOpenTopicDesafios,
    onOpenTopicActivities,
    selectedContexto,
    contextos,
    onSelectContexto,
  } = ctx;
  const view = document.getElementById("main__inner");
  if (!view) return;

  const passos = atividade.passos || [];
  const totalPassos = passos.length;
  const markedPassos = checklistMarkedCount(atividade, checklistDict);

  const codeHtml = activityCodeBlockHtml(atividade.codigo);

  const passosHtml = passos
    .map((p, i) => {
      const checked = (checklistDict[atividade.id] || []).includes(p.id);
      const detalhesBody = formatChecklistDetalhesHtml(p.detalhes);
      const exemploRaw = p.codigoExemplo != null ? String(p.codigoExemplo).trim() : "";
      const exemploHtml =
        exemploRaw.length > 0
          ? `<p class="checklist__code-intro">Exemplo para copiar e adaptar:</p><div class="checklist__code"><pre>${escapeHtml(exemploRaw)}</pre></div>`
          : "";
      const detailsInner = `${detalhesBody}${exemploHtml}`;
      const detailsBlock =
        detailsInner.length > 0
          ? `<details class="checklist__details">
          <summary class="checklist__summary">Ver detalhes</summary>
          <div class="checklist__details-body">${detailsInner}</div>
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
      <div class="activity-card__head">
        <span class="theory-badge activity-badge--perguntas" aria-hidden="true">● Passo a passo (checklist)</span>
        <span class="pill activity-card__progress" id="checklistStepProgress">${markedPassos}/${totalPassos} passos finalizados</span>
      </div>
      ${formatActivityDescricaoHtml(atividade.descricao)}
      ${codeHtml}
      <div class="checklist-root" role="group" aria-label="Passos do projeto">${passosHtml}</div>
      <div class="actions">
        <button type="button" class="btn btn--ghost" id="btnPrev">Anterior</button>
        <button type="button" class="btn btn--ghost" id="btnNext">Próxima</button>
      </div>
    </article>`;

  wireChecklistDetailsAccordion(view.querySelector(".checklist-root"));

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
      const pill = document.getElementById("checklistStepProgress");
      if (pill) {
        const n = (atividade.passos || []).length;
        const k = checklistMarkedCount(atividade, checklistDict);
        pill.textContent = `${k}/${n} passos finalizados`;
      }
      if (allDone(topicos, completedSet)) {
        paint();
      } else {
        renderTopicList(
          topicos,
          completedSet,
          topico.id,
          selectedContexto,
          onSelectTopic,
          onOpenTopicTheory,
          onOpenTopicActivities,
          onOpenTopicDesafios
        );
        renderContextNav(contextos, selectedContexto, topicos, completedSet, onSelectContexto);
        updateProgress(topicos, completedSet);
        renderChecklistSidebar(atividade, checklistDict);
      }
    });
  });

  renderChecklistSidebar(atividade, checklistDict);
  document.getElementById("btnPrev")?.addEventListener("click", onPrev);
  document.getElementById("btnNext")?.addEventListener("click", onNext);
}

function renderActivity(ctx) {
  const { flat, index, completedSet, theoryVisitedSet, checklistDict, selectionsDict, onPrev, onNext, paint } = ctx;
  const view = document.getElementById("main__inner");
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
  const isDesafioCodigo = atividade.tipo === "desafio_codigo";
  const kindBadge = isDesafioCodigo
    ? `<span class="theory-badge activity-badge--desafios" aria-hidden="true">◆ Desafios</span>`
    : `<span class="theory-badge activity-badge--perguntas" aria-hidden="true">● Perguntas</span>`;
  const progressPill = isDesafioCodigo
    ? `<span class="pill activity-card__progress">Desafio ${idxInTopic} / ${totalInTopic} neste tópico</span>`
    : `<span class="pill activity-card__progress">Questão ${idxInTopic} / ${totalInTopic} neste tópico</span>`;

  const codeHtml = activityCodeBlockHtml(atividade.codigo);

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

  view.innerHTML = `
    <article class="activity-card">
      <div class="activity-card__head">
        ${kindBadge}
        ${progressPill}
      </div>
      ${formatActivityDescricaoHtml(atividade.descricao)}
      ${codeHtml}
      <div class="options" id="optionsRoot">${optionsHtml}</div>
      <div class="actions">
        <button type="button" class="btn btn--ghost" id="btnPrev">Anterior</button>
        <button type="button" class="btn btn--ghost" id="btnNext">Próxima</button>
        <button type="button" class="btn btn--primary" id="btnVerify">Verificar resposta</button>
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
    if (selected.size === 0) {
      const panel = document.getElementById("feedbackPanel");
      if (panel) {
        panel.innerHTML = `<p class="feedback__hint">Selecione pelo menos uma alternativa antes de <strong>Verificar resposta</strong>.</p>`;
      }
      scrollAnchorFeedbackPanel();
      return;
    }
    const correct = new Set(atividade.corretas);
    const ok = setsEqual(selected, correct);
    renderFeedback(ok, atividade, selected, topico);
    if (ok) {
      completedSet.add(atividade.id);
      persist(completedSet, theoryVisitedSet, checklistDict, selectionsDict);
      if (allDone(ctx.topicos, completedSet)) {
        paint();
        scrollAnchorMainInner();
      } else {
        scrollAnchorFeedbackPanel();
        renderTopicList(
          ctx.topicos,
          completedSet,
          topico.id,
          ctx.selectedContexto,
          ctx.onSelectTopic,
          ctx.onOpenTopicTheory,
          ctx.onOpenTopicActivities,
          ctx.onOpenTopicDesafios
        );
        renderContextNav(
          ctx.contextos,
          ctx.selectedContexto,
          ctx.topicos,
          completedSet,
          ctx.onSelectContexto
        );
        updateProgress(ctx.topicos, completedSet);
      }
    } else {
      scrollAnchorFeedbackPanel();
    }
  });

  document.getElementById("btnPrev")?.addEventListener("click", onPrev);
  document.getElementById("btnNext")?.addEventListener("click", onNext);

  if (already) {
    renderCompletedQuestionPanel(atividade, selectionsDict, topico);
  } else {
    clearFeedbackHint();
  }
}

function renderCompletedQuestionPanel(atividade, selectionsDict, topico) {
  const panel = document.getElementById("feedbackPanel");
  if (!panel) return;
  const saved = selectionsDict[atividade.id] || [];
  const hasSavedSelection = saved.length > 0;
  const savedSet = new Set(saved.map((l) => String(l).toLowerCase()));
  const correctSet = new Set(
    (atividade.corretas || []).map((l) => String(l).toLowerCase())
  );
  const matches = setsEqual(savedSet, correctSet);
  const wrongAttempt = hasSavedSelection && !matches;

  const selArrSaved = saved.length
    ? [...saved].map((l) => String(l).toUpperCase()).sort().join(", ")
    : "(nenhuma)";
  const corrArrSaved = [...(atividade.corretas || [])]
    .map((l) => String(l).toUpperCase())
    .sort()
    .join(", ");
  const selArrWrong = [...saved].sort().join(", ") || "(nenhuma)";
  const corrArrWrong = [...(atividade.corretas || [])].sort().join(", ");

  let resultCls;
  let title;
  let detailLine;
  if (matches) {
    resultCls = "feedback-result--ok";
    title = "Resposta correta";
    detailLine = `<p>Sua seleção salva: <strong>${escapeHtml(selArrSaved)}</strong>. Gabarito: <strong>${escapeHtml(corrArrSaved)}</strong>.</p>`;
  } else if (!wrongAttempt) {
    resultCls = "feedback-result";
    title = "Questão já respondida";
    detailLine = `<p>Nenhuma alternativa salva neste dispositivo. Gabarito: <strong>${escapeHtml(corrArrSaved)}</strong>. Marque e use <strong>Verificar resposta</strong> para conferir.</p>`;
  } else {
    resultCls = "feedback-result--bad";
    title = "Resposta incorreta";
    detailLine = `<p>Você marcou: <strong>${escapeHtml(selArrWrong)}</strong>. Corretas: <strong>${escapeHtml(corrArrWrong)}</strong>.</p>`;
  }

  const expl = atividade.explicacao || "";
  const code = (atividade.codigoExplicacao || "").trim();
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

function renderFeedback(ok, atividade, selected, topico) {
  const panel = document.getElementById("feedbackPanel");
  if (!panel) return;

  if (!ok && selected.size === 0) {
    panel.innerHTML = `<p class="feedback__hint">Selecione pelo menos uma alternativa antes de <strong>Verificar resposta</strong>.</p>`;
    return;
  }

  const selArr = [...selected].sort().join(", ") || "(nenhuma)";
  const corrArr = [...atividade.corretas].sort().join(", ");

  const title = ok ? "Resposta correta" : "Resposta incorreta";
  const cls = ok ? "feedback-result--ok" : "feedback-result--bad";

  const codeRef = (atividade.codigoExplicacao || "").trim();
  const codeSection = codeRef
    ? `<div class="feedback-section">
      <h3>Código / referência</h3>
      <div class="code-block"><pre>${escapeHtml(atividade.codigoExplicacao || "")}</pre></div>
    </div>`
    : "";

  panel.innerHTML = `
    <div class="feedback-result ${cls}">
      <p class="feedback-result__title">${title}</p>
      <p>Você marcou: <strong>${escapeHtml(selArr)}</strong>. Corretas: <strong>${escapeHtml(corrArr)}</strong>.</p>
    </div>
    <div class="feedback-section">
      <h3>Explicação</h3>
      <p style="margin:0;color:var(--muted)">${escapeHtml(atividade.explicacao || "")}</p>
    </div>
    ${codeSection}`;
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
  const view = document.getElementById("main__inner");
  if (!view) return;
  view.innerHTML = `
    <div class="congrats">
      <h2>Parabéns!</h2>
      <p>Você concluiu a trilha de estudos básicos para iniciar automação de testes.</p>
    </div>`;
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const isLight = saved === "light";
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
  wireContextNavMobileToggle();

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
    const view = document.getElementById("main__inner");
    if (view) {
      view.innerHTML = `
        <div class="activity-card">
          <p class="activity-card__title">Erro ao carregar a trilha</p>
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

  const contextos = collectContextos(topicos);
  let selectedContexto = localStorage.getItem(CONTEXT_KEY) || "";
  if (!contextos.includes(selectedContexto)) {
    selectedContexto = contextos[0] || "";
  }

  const doneGlobal = allDone(topicos, completedSet);
  let currentIndex = firstActivityIndexForContext(selectedContexto, flat, completedSet, doneGlobal);

  function activeTopicId() {
    if (currentIndex < 0 || currentIndex >= flat.length) return "";
    const cur = flat[currentIndex].topico;
    if (cur.contexto !== selectedContexto) return "";
    return cur.id;
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

  let desafiosFocusTopicId = /** @type {string | null} */ (null);

  function onSelectTopic(topicId) {
    desafiosFocusTopicId = null;
    const idx = flat.findIndex((x) => x.topico.id === topicId);
    if (idx >= 0) {
      currentIndex = idx;
      const ctxTop = flat[currentIndex].topico.contexto;
      if (ctxTop && ctxTop !== selectedContexto) {
        selectedContexto = ctxTop;
        localStorage.setItem(CONTEXT_KEY, selectedContexto);
      }
      clearFeedbackHint();
      paint();
      if (isMobileStudyLayout()) scrollAnchorMainInner();
    }
  }

  function onOpenTopicTheory(topicId) {
    desafiosFocusTopicId = null;
    const idx = flat.findIndex((x) => x.topico.id === topicId);
    if (idx >= 0) {
      currentIndex = idx;
      const ctxTop = flat[currentIndex].topico.contexto;
      if (ctxTop && ctxTop !== selectedContexto) {
        selectedContexto = ctxTop;
        localStorage.setItem(CONTEXT_KEY, selectedContexto);
      }
      theoryVisitedSet.delete(topicId);
      persist(completedSet, theoryVisitedSet, checklistDict, selectionsDict);
      clearFeedbackHint();
      paint();
      if (isMobileStudyLayout()) scrollAnchorMainInner();
    }
  }

  function onOpenTopicActivities(topicId) {
    desafiosFocusTopicId = null;
    const idx = flat.findIndex((x) => x.topico.id === topicId);
    if (idx < 0) return;
    const top = flat[idx].topico;
    if (topicHasTheory(top)) {
      theoryVisitedSet.add(top.id);
    }
    currentIndex = idx;
    const ctxTop = top.contexto;
    if (ctxTop && ctxTop !== selectedContexto) {
      selectedContexto = ctxTop;
      localStorage.setItem(CONTEXT_KEY, selectedContexto);
    }
    persist(completedSet, theoryVisitedSet, checklistDict, selectionsDict);
    clearFeedbackHint();
    paint();
    if (isMobileStudyLayout()) scrollAnchorMainInner();
  }

  function onOpenTopicDesafios(topicId) {
    const idx = flat.findIndex((x) => x.topico.id === topicId);
    if (idx < 0) return;
    const top = flat[idx].topico;
    if (!topicHasDesafios(top)) return;
    desafiosFocusTopicId = topicId;
    currentIndex = idx;
    const ctxTop = top.contexto;
    if (ctxTop && ctxTop !== selectedContexto) {
      selectedContexto = ctxTop;
      localStorage.setItem(CONTEXT_KEY, selectedContexto);
    }
    clearFeedbackHint();
    paint();
    if (isMobileStudyLayout()) scrollAnchorMainInner();
  }

  function onSelectContexto(contexto) {
    desafiosFocusTopicId = null;
    if (!contextos.includes(contexto)) return;
    selectedContexto = contexto;
    localStorage.setItem(CONTEXT_KEY, selectedContexto);
    currentIndex = firstActivityIndexForContext(
      selectedContexto,
      flat,
      completedSet,
      allDone(topicos, completedSet)
    );
    clearFeedbackHint();
    paint();
    if (isMobileStudyLayout()) scrollAnchorMainInner();
  }

  function paint() {
    if (allDone(topicos, completedSet)) {
      updateProgress(topicos, completedSet);
      renderContextNav(contextos, selectedContexto, topicos, completedSet, onSelectContexto);
      renderTopicList(
        topicos,
        completedSet,
        activeTopicId(),
        selectedContexto,
        onSelectTopic,
        onOpenTopicTheory,
        onOpenTopicActivities,
        onOpenTopicDesafios
      );
      showCongratulations();
      syncTopbarOffset();
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
      selectedContexto,
      contextos,
      onSelectTopic,
      onOpenTopicTheory,
      onOpenTopicActivities,
      onOpenTopicDesafios,
      onSelectContexto,
      paint,
      onPrev: () => {
        if (currentIndex > 0) {
          desafiosFocusTopicId = null;
          currentIndex--;
          const ctxTop = flat[currentIndex]?.topico.contexto;
          if (ctxTop && ctxTop !== selectedContexto) {
            selectedContexto = ctxTop;
            localStorage.setItem(CONTEXT_KEY, selectedContexto);
          }
          clearFeedbackHint();
          paint();
          scrollAnchorMainInner();
        }
      },
      onNext: () => {
        if (currentIndex < flat.length - 1) {
          desafiosFocusTopicId = null;
          currentIndex++;
          const ctxTop = flat[currentIndex]?.topico.contexto;
          if (ctxTop && ctxTop !== selectedContexto) {
            selectedContexto = ctxTop;
            localStorage.setItem(CONTEXT_KEY, selectedContexto);
          }
          clearFeedbackHint();
          paint();
          scrollAnchorMainInner();
        }
      },
    };

    renderContextNav(contextos, selectedContexto, topicos, completedSet, onSelectContexto);
    renderTopicList(
      topicos,
      completedSet,
      activeTopicId(),
      selectedContexto,
      onSelectTopic,
      onOpenTopicTheory,
      onOpenTopicActivities,
      onOpenTopicDesafios
    );
    updateProgress(topicos, completedSet);

    const curTop = currentTopicoFromIndex();
    if (
      curTop &&
      desafiosFocusTopicId &&
      desafiosFocusTopicId === curTop.id &&
      topicHasDesafios(curTop)
    ) {
      renderDesafios(curTop);
      syncTopbarOffset();
      return;
    }

    if (shouldShowTheory()) {
      const t = currentTopicoFromIndex();
      if (t) renderTheory(t, ctx);
      syncTopbarOffset();
      return;
    }

    renderActivity(ctx);
    syncTopbarOffset();
  }

  if (allDone(topicos, completedSet)) {
    updateProgress(topicos, completedSet);
    renderContextNav(contextos, selectedContexto, topicos, completedSet, onSelectContexto);
    renderTopicList(
      topicos,
      completedSet,
      activeTopicId(),
      selectedContexto,
      onSelectTopic,
      onOpenTopicTheory,
      onOpenTopicActivities,
      onOpenTopicDesafios
    );
    syncTopbarOffset();
  } else {
    paint();
  }

  window.addEventListener("resize", () => {
    syncTopbarOffset();
    resetContextNavMobileForViewport();
  });
}

main();
