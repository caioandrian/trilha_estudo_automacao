const STORAGE_KEY = "trilha_estudo_automacao_v1";
/** Dica de atalho: Anterior / Próxima também respondem às setas do teclado. */
const ACTIVITY_KBD_NAV_HINT_HTML =
  '<p class="activity-actions__hint" role="note">Use ← → para navegar.</p>';
const THEME_KEY = "trilha_theme_pref";
const CONTEXT_KEY = "trilha_contexto_pref";

const TRILHA_PUBLIC_URL = "https://caioandrian.github.io/trilha_estudo_automacao/";

/**
 * Modelos de post para o LinkedIn: tom mais informal, parágrafos curtos, hashtags relevantes.
 * Incluem o que a trilha cobre: lógica básica, Cypress, projeto do zero e GitHub passo a passo.
 */
const LINKEDIN_POST_CONQUISTA = `Fechando mais um ciclo de estudo com um sorriso no rosto 🙂

Acabei de concluir uma trilha gratuita que mistura teoria com prática: revisei lógica de programação no básico, mergulhei nos conceitos e nos comandos iniciais do Cypress (visit, get, should — aquele kit do dia a dia), montei um projeto Cypress do zero seguindo o passo a passo e subi tudo pro GitHub também com checklist bem guiada, sem pegadinha.

Dá uma olhada se fizer sentido pra você: ${TRILHA_PUBLIC_URL}

Valeu demais, @caioandrian, por ter criado essa trilha 100% grátis e acessível.

#QA #QualidadeDeSoftware #TestesAutomatizados #AutomaçãoDeTestes #Cypress #GitHub #CarreiraEmTI #TechBrasil`;

const LINKEDIN_POST_SUGESTAO = `Passando aqui pra recomendar uma trilha que achei super didática — e de graça 👇

Ela cobre lógica de programação no essencial, conceitos e comandos básicos do Cypress, como criar um projeto com Cypress do zero (bem passo a passo) e ainda como enviar seu projeto pro GitHub com o fluxo explicado direitinho. Boa pra quem tá começando em automação ou quer organizar o básico sem se perder.

Link: ${TRILHA_PUBLIC_URL}

Créditos ao @caioandrian por ter montado essa trilha de estudos gratuita pra comunidade.

#QA #Cypress #GitHub #TestesAutomatizados #AutomaçãoDeTestes #Estudos #QualidadeDeSoftware #EngenhariaDeSoftware`;
/** Em atividades com `codigo`, a pergunta mostra `.code-block`; no feedback, quando houver `codigoExplicacao`. Na teoria, quando houver `teoria.codigo`. */

/** @typedef {{ id: string; texto: string; detalhes?: string | string[]; codigoExemplo?: string; codigoExemploIntro?: string }} ChecklistPasso */
/** @typedef {{ id: string; tipo: string; descricao: string; codigo?: string | null; passos?: ChecklistPasso[]; opcoes?: { id: string; texto: string }[]; corretas?: string[]; explicacao?: string; codigoExplicacao?: string }} Atividade */
/** @typedef {{ titulo: string; url: string }} TeoriaLink */
/** @typedef {{ titulo?: string; paragrafos?: string[]; codigo?: string | null; codigoCompletoParaCopiar?: boolean }} TeoriaSecao */
/** @typedef {{ titulo: string; paragrafos?: string[]; codigo?: string | null; links?: TeoriaLink[]; secoes?: TeoriaSecao[] }} Teoria */
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

/** Normaliza id de alternativa para comparar com `corretas` e com valores de input. */
function normalizeQuizOptionId(/** @type {unknown} */ id) {
  return String(id ?? "")
    .trim()
    .toLowerCase();
}

/** Destaca alternativas corretas (verde) e incorretas marcadas (vermelho) após verificação. */
function clearQuizOptionHighlights(/** @type {HTMLElement | null} */ root) {
  if (!root) return;
  root.querySelectorAll("label.option").forEach((label) => {
    label.classList.remove("option--correct", "option--wrong");
  });
}

/**
 * @param {boolean} showCorrectHighlight Se true (resposta certa), aplica verde nas alternativas corretas.
 *   Se false (resposta errada), só aplica vermelho no que foi marcado errado — não revela o gabarito no card.
 */
function paintQuizOptionHighlights(
  /** @type {HTMLElement | null} */ root,
  /** @type {{ corretas?: string[] }} */ atividade,
  /** @type {boolean} */ showCorrectHighlight
) {
  if (!root) return;
  const correct = new Set((atividade.corretas || []).map((id) => normalizeQuizOptionId(id)));
  root.querySelectorAll("label.option").forEach((label) => {
    const input = label.querySelector("input");
    if (!input) return;
    const id = normalizeQuizOptionId(input.value);
    label.classList.remove("option--correct", "option--wrong");
    const isCorrect = correct.has(id);
    const isSelected = input.checked;
    if (showCorrectHighlight && isCorrect) label.classList.add("option--correct");
    if (isSelected && !isCorrect) label.classList.add("option--wrong");
  });
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
  if (filterTheorySecoes(t).length > 0) return true;
  const paragraphs = Array.isArray(t.paragrafos) ? t.paragrafos.filter(Boolean) : [];
  if (paragraphs.length > 0) return true;
  if (t.codigo != null && String(t.codigo).trim() !== "") return true;
  const links = t.links;
  return Array.isArray(links) && links.length > 0;
}

function topicHasDesafios(topico) {
  const d = topico.desafios;
  return Boolean(d && Array.isArray(d.blocos) && d.blocos.length > 0);
}

/** Conteúdo com único tópico passo a passo (GitHub): rótulo em trilha.json inclui "GitHub". */
function isGithubContext(/** @type {string} */ contexto) {
  return /GitHub/i.test(contexto || "");
}

function contextNavVariantClass(/** @type {string} */ label) {
  const ctx = label || "";
  if (/CI\/CD|pipeline/i.test(ctx)) return "context-nav__btn--cicd";
  if (/Cypress|Automação/i.test(ctx)) return "context-nav__btn--cypress";
  if (/GitHub|Versionamento/i.test(ctx)) return "context-nav__btn--github";
  return "context-nav__btn--logica";
}

/** @returns {"topic-btn--ctx-logica" | "topic-btn--ctx-cypress" | "topic-btn--ctx-github" | "topic-btn--ctx-cicd"} */
function topicBtnContextClass(/** @type {string} */ contextoLabel) {
  const v = contextNavVariantClass(contextoLabel);
  if (v.includes("cicd")) return "topic-btn--ctx-cicd";
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
  return firstAny >= 0 ? firstAny : -1;
}

function contextHasFlatActivities(contexto, flat) {
  return flat.some((x) => x.topico.contexto === contexto);
}

function firstTopicIdInContext(topicos, contexto) {
  const list = [...topicos].filter((t) => t.contexto === contexto).sort((a, b) => a.ordem - b.ordem);
  return list[0]?.id ?? null;
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

function topicDone(topico, completedSet, theoryVisitedSet) {
  if (!topico.atividades || topico.atividades.length === 0) {
    return theoryVisitedSet.has(topico.id);
  }
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
  const allChecklist = acts.every((a) => a.tipo === "checklist_trilha");
  return allChecklist ? "Passo a passo" : "Perguntas";
}

function syncTopbarOffset() {
  const bar = document.querySelector(".topbar");
  if (!bar) return;
  document.documentElement.style.setProperty("--topbar-offset", `${Math.ceil(bar.getBoundingClientRect().height)}px`);
}

/** Sidebar fixa no CSS (layout em coluna única ≤1024px); reserva altura no `.layout` para o conteúdo não ficar por baixo. */
const MOBILE_SIDEBAR_FIXED_MQ = "(max-width: 1024px)";

function syncSidebarFixedOffset() {
  const mq = window.matchMedia(MOBILE_SIDEBAR_FIXED_MQ);
  if (!mq.matches) {
    document.documentElement.style.removeProperty("--sidebar-fixed-offset");
    return;
  }
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  document.documentElement.style.setProperty(
    "--sidebar-fixed-offset",
    `${Math.ceil(sidebar.getBoundingClientRect().height)}px`
  );
}

function syncLayoutChrome() {
  syncTopbarOffset();
  requestAnimationFrame(() => {
    syncSidebarFixedOffset();
    if (typeof window !== "undefined" && !window.matchMedia(MOBILE_SIDEBAR_FIXED_MQ).matches) {
      const sidebar = document.querySelector(".sidebar");
      if (sidebar?.classList.contains("sidebar--mobile-topic-active")) {
        sidebar.classList.remove("sidebar--mobile-topic-active");
        const headTitle = document.querySelector(".sidebar__head h2");
        if (headTitle) headTitle.textContent = "Tópicos";
        const tgl = document.getElementById("sidebarToggle");
        tgl?.setAttribute("aria-expanded", "true");
        document.getElementById("topicList")?.classList.remove("collapsed");
      }
    }
  });
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

/** Ancora no topo do painel principal: #mainPanel é o scroll container (overflow-y: auto), então usa-se scrollTop, não só scrollIntoView no próprio main. */
function scrollAnchorMainPanel() {
  requestAnimationFrame(() => {
    const el = document.getElementById("mainPanel");
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/** Ancora no painel de teoria ao trocar aba no subnav (mobile). */
function scrollAnchorTheorySubpanel() {
  requestAnimationFrame(() => {
    const el = document.getElementById("theorySubpanel");
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

/** Mobile: após marcar alternativa em pergunta/desafio, levar a barra Anterior/Próxima para o topo útil da viewport. */
function scrollAnchorActivityActionsWrap() {
  requestAnimationFrame(() => {
    const el = document.querySelector(".activity-actions-wrap");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function scrollQuizAnswerAnchorMobileElseFeedback() {
  if (isMobileStudyLayout()) scrollAnchorActivityActionsWrap();
  else scrollAnchorFeedbackPanel();
}

function renderTopicList(
  topicos,
  completedSet,
  theoryVisitedSet,
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
      const done = topicDone(t, completedSet, theoryVisitedSet);
      const ctxCls = topicBtnContextClass(t.contexto);
      const isCurrent = t.id === activeTopicId;
      const hasTheory = topicHasTheory(t);
      const hasDesafios = topicHasDesafios(t);
      const hasActivities = Array.isArray(t.atividades) && t.atividades.length > 0;
      const kindLabel = topicSidebarKindLabel(t);
      const theoryBtn = hasTheory
        ? `<button type="button" class="btn-topic-theory" data-topic-theory="${escapeHtml(t.id)}" aria-label="Abrir teoria: ${escapeHtml(t.titulo)}">Teoria</button>`
        : "";
      const desafiosBtn = hasDesafios
        ? `<button type="button" class="btn-topic-theory" data-topic-desafios="${escapeHtml(t.id)}" aria-label="Abrir desafios: ${escapeHtml(t.titulo)}">Desafios</button>`
        : "";
      const kindBtn = hasActivities
        ? `<button type="button" class="btn-topic-theory" data-topic-activities="${escapeHtml(t.id)}" aria-label="Ir para: ${escapeHtml(kindLabel)} — ${escapeHtml(t.titulo)}">${escapeHtml(kindLabel)}</button>`
        : "";
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

function setFeedbackTheoryHint(
  /** @type {boolean} */ onlyChecklistFollows,
  /** @type {boolean | undefined} */ theoryOnlyExtra
) {
  const panel = document.getElementById("feedbackPanel");
  if (!panel) return;
  if (theoryOnlyExtra) {
    panel.innerHTML = `<p class="feedback__hint">Bloco de <strong>teoria</strong>. Este material é só leitura: <strong>não há questões</strong> nem checklist e <strong>não altera</strong> a percentagem da barra de progresso principal.</p>`;
    return;
  }
  panel.innerHTML = onlyChecklistFollows
    ? `<p class="feedback__hint">Bloco de <strong>teoria</strong>. Depois abra <strong>Ir para a checklist</strong> e marque cada passo ao executá-lo na sua máquina.</p>`
    : `<p class="feedback__hint">Bloco de <strong>teoria</strong>. Quando estiver pronto, use <strong>Ir para as questões</strong> para avaliar o que você aprendeu.</p>`;
}

function clearFeedbackHint() {
  const panel = document.getElementById("feedbackPanel");
  if (!panel) return;
  panel.innerHTML = `<p class="feedback__hint">Responda à atividade: ao marcar uma alternativa, o quadro de resposta atualiza automaticamente.</p>`;
}

function theoryCodeBlockHtml(/** @type {string | null | undefined} */ codigo) {
  const c = codigo == null ? "" : String(codigo).trim();
  if (!c) return "";
  return `<div class="code-block"><pre>${escapeHtml(c)}</pre></div>`;
}

/** Código opcionalmente com botão para copiar o arquivo completo (blocos marcados na trilha). */
function theoryCodeSectionFromSec(/** @type {TeoriaSecao} */ sec) {
  const c = sec.codigo == null ? "" : String(sec.codigo).trim();
  if (!c) return "";
  if (!sec.codigoCompletoParaCopiar)
    return `<div class="code-block"><pre>${escapeHtml(c)}</pre></div>`;
  return `<div class="theory-copyable-block"><button type="button" class="btn btn--ghost theory-copyable__btn" aria-label="Copiar arquivo completo">Copiar arquivo completo</button><div class="theory-copyable__pre-wrap"><pre>${escapeHtml(c)}</pre></div></div>`;
}

/** @param {Teoria} teoria */
function filterTheorySecoes(teoria) {
  const secoes = teoria.secoes;
  if (!Array.isArray(secoes) || secoes.length === 0) return [];
  return secoes.filter((s) => {
    if (!s || typeof s !== "object") return false;
    const hasTitle = Boolean(s.titulo && String(s.titulo).trim());
    const hasParas = Array.isArray(s.paragrafos) && s.paragrafos.some(Boolean);
    const hasCode = s.codigo != null && String(s.codigo).trim() !== "";
    return hasTitle || hasParas || hasCode;
  });
}

/** @param {NonNullable<Teoria["secoes"]>[number]} sec */
function buildSingleTheorySectionHtml(sec) {
  const titulo =
    sec.titulo && String(sec.titulo).trim()
      ? `<h3 class="theory-section__title">${escapeHtml(String(sec.titulo).trim())}</h3>`
      : "";
  const paras = (sec.paragrafos || [])
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  const body = paras ? `<div class="theory-body">${paras}</div>` : "";
  return `<section class="theory-section">${titulo}${body}${theoryCodeSectionFromSec(sec)}</section>`;
}

/** @param {Teoria} teoria */
function renderTheoryBodyLegacy(teoria) {
  const paragraphs = (teoria.paragrafos || [])
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  const body = paragraphs ? `<div class="theory-body">${paragraphs}</div>` : "";
  return `${body}${theoryCodeBlockHtml(teoria.codigo)}`;
}

function setFeedbackTheoryOnlyReadHint() {
  const panel = document.getElementById("feedbackPanel");
  if (!panel) return;
  panel.innerHTML = `<p class="feedback__hint">Este tópico é <strong>somente leitura</strong> (sem questões). Você já marcou como lido: o progresso principal da trilha <strong>não</strong> aumenta só por este extra.</p>`;
}

/** Vista após “Marcar como lido” em tópicos só com teoria (sem lista de atividades). */
function renderTheoryOnlyStub(topico, ctx) {
  const view = document.getElementById("main__inner");
  if (!view) return;

  view.innerHTML = `
    <div class="theory-shell">
      <article class="theory-panel theory-panel--theory-only-done" aria-labelledby="theoryOnlyDoneHeading">
        <div class="theory-panel__inner">
          <span class="theory-badge" aria-hidden="true">● Leitura</span>
          <h2 class="theory-heading" id="theoryOnlyDoneHeading">${escapeHtml(topico.titulo)}</h2>
          <div class="theory-body">
            <p>Você marcou esta leitura como concluída. Não há questões nem checklist neste tópico — escolha <strong>Teoria</strong> na lista ao lado se quiser rever o texto e os exemplos.</p>
            <p class="theory-follow">Este conteúdo <strong>não altera</strong> a percentagem na barra de progresso nem o critério de “parabéns” da trilha.</p>
          </div>
          <div class="theory-actions">
            <button type="button" class="btn btn--primary" id="btnTheoryOnlyReopen">Reabrir teoria</button>
          </div>
        </div>
      </article>
    </div>`;

  document.getElementById("btnTheoryOnlyReopen")?.addEventListener("click", () => {
    ctx.theoryVisitedSet.delete(topico.id);
    persist(ctx.completedSet, ctx.theoryVisitedSet, ctx.checklistDict, ctx.selectionsDict);
    clearFeedbackHint();
    ctx.paint();
  });
  setFeedbackTheoryOnlyReadHint();
}

function renderTheory(topico, ctx) {
  const view = document.getElementById("main__inner");
  const teoria = topico.teoria;
  if (!view || !teoria) return;

  const secoesFiltered = filterTheorySecoes(teoria);
  let theoryMainHtml = "";

  if (secoesFiltered.length > 1) {
    const navButtons = secoesFiltered
      .map((sec, i) => {
        const label =
          sec.titulo && String(sec.titulo).trim() ? String(sec.titulo).trim() : `Parte ${i + 1}`;
        const selected = i === 0;
        return `<button type="button" class="theory-subnav__btn${selected ? " theory-subnav__btn--active" : ""}" role="tab" aria-selected="${selected}" aria-controls="theorySubpanel" id="theoryTab${i}" data-theory-idx="${i}">${escapeHtml(
          label
        )}</button>`;
      })
      .join("");
    const firstPane = buildSingleTheorySectionHtml(secoesFiltered[0]);
    theoryMainHtml = `
    <nav class="theory-subnav" aria-label="Partes do conteúdo">
      <div class="theory-subnav__inner" role="tablist">${navButtons}</div>
    </nav>
    <div class="theory-subpanel" id="theorySubpanel" role="tabpanel" tabindex="0" aria-labelledby="theoryTab0">
      ${firstPane}
    </div>`;
  } else if (secoesFiltered.length === 1) {
    theoryMainHtml = buildSingleTheorySectionHtml(secoesFiltered[0]);
  } else {
    theoryMainHtml = renderTheoryBodyLegacy(teoria);
  }

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

  const theoryOnlyExtra = topico.atividades.length === 0;
  const onlyChecklistFollows =
    Array.isArray(topico.atividades) &&
    topico.atividades.length > 0 &&
    topico.atividades.every((a) => a.tipo === "checklist_trilha");

  /** @type {string} */
  let btnTheoryLabel;
  /** @type {string} */
  let theoryFollowText;
  if (theoryOnlyExtra) {
    btnTheoryLabel = "Marcar como lido";
    theoryFollowText = `Este módulo é só leitura: <strong>não há</strong> perguntas depois da teoria. Ao continuar você regista que leu por aqui; a percentagem principal da trilha <strong>não muda</strong>.`;
  } else if (onlyChecklistFollows) {
    btnTheoryLabel = "Ir para a checklist";
    theoryFollowText = `O passo a passo seguinte está em formato <strong>checklist</strong>: marque o que já fez até concluir o tópico.`;
  } else {
    btnTheoryLabel = "Ir para as questões";
    theoryFollowText = `As questões a seguir servem só para <strong>fixar e avaliar</strong> o conteúdo acima.`;
  }

  view.innerHTML = `
    <div class="theory-shell">
      <article class="theory-panel" aria-labelledby="theoryHeading">
        <div class="theory-panel__inner">
          <span class="theory-badge" aria-hidden="true">● Teoria</span>
          <h2 class="theory-heading" id="theoryHeading">${escapeHtml(teoria.titulo || "Teoria")}</h2>
          ${theoryMainHtml}
          ${linksBlock}
          <div class="theory-actions">
            <button type="button" class="btn btn--primary" id="btnTheoryContinue">${btnTheoryLabel}</button>
          </div>
          <p class="theory-follow">${theoryFollowText}</p>
        </div>
      </article>
    </div>`;

  setFeedbackTheoryHint(onlyChecklistFollows, theoryOnlyExtra);

  wireTheoryCopyableBlocks(view);

  if (secoesFiltered.length > 1) {
    const panel = document.getElementById("theorySubpanel");
    view.querySelectorAll(".theory-subnav__btn[data-theory-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const raw = /** @type {HTMLElement} */ (btn).dataset.theoryIdx;
        const idx = raw != null ? parseInt(raw, 10) : 0;
        if (!Number.isFinite(idx) || idx < 0 || idx >= secoesFiltered.length) return;
        view.querySelectorAll(".theory-subnav__btn").forEach((b, j) => {
          const on = j === idx;
          b.classList.toggle("theory-subnav__btn--active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        if (panel) {
          panel.innerHTML = buildSingleTheorySectionHtml(secoesFiltered[idx]);
          wireTheoryCopyableBlocks(panel);
          panel.setAttribute("aria-labelledby", `theoryTab${idx}`);
        }
        if (isMobileStudyLayout()) scrollAnchorTheorySubpanel();
      });
    });
  }

  document.getElementById("btnTheoryContinue")?.addEventListener("click", () => {
    ctx.theoryVisitedSet.add(topico.id);
    persist(ctx.completedSet, ctx.theoryVisitedSet, ctx.checklistDict, ctx.selectionsDict);
    clearFeedbackHint();
    ctx.paint();
    if (isMobileStudyLayout()) scrollAnchorMainInner();
  });
}

function setFeedbackDesafiosHint() {
  const panel = document.getElementById("feedbackPanel");
  if (!panel) return;
  panel.innerHTML = `<p class="feedback__hint">Após concluir siga para o próximo conteúdo</p>`;
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

  setFeedbackDesafiosHint();
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

/**
 * @param {ParentNode | null | undefined} root
 * @param {{ blockSelector?: string; buttonSelector?: string; copyLabel?: string }} [options]
 */
function wireCodeCopyButtons(root, options) {
  const blockSelector = options?.blockSelector ?? ".checklist__code-block";
  const buttonSelector = options?.buttonSelector ?? ".checklist__copy-btn";
  const copyLabel = options?.copyLabel ?? "Copiar código";
  if (!root) return;
  root.querySelectorAll(buttonSelector).forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement)) return;
    btn.addEventListener("click", async () => {
      const block = btn.closest(blockSelector);
      const pre = block?.querySelector("pre");
      const text = pre?.textContent ?? "";
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copiado!";
        window.setTimeout(() => {
          btn.textContent = copyLabel;
        }, 2000);
      } catch {
        if (pre) {
          const range = document.createRange();
          range.selectNodeContents(pre);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
        try {
          document.execCommand("copy");
          btn.textContent = "Copiado!";
          window.setTimeout(() => {
            btn.textContent = copyLabel;
          }, 2000);
        } catch {
          btn.textContent = copyLabel;
        }
      }
    });
  });
}

function wireChecklistCodeCopy(/** @type {ParentNode | null} */ root) {
  wireCodeCopyButtons(root, {
    blockSelector: ".checklist__code-block",
    buttonSelector: ".checklist__copy-btn",
    copyLabel: "Copiar código",
  });
}

function wireTheoryCopyableBlocks(/** @type {ParentNode | null | undefined} */ root) {
  wireCodeCopyButtons(root, {
    blockSelector: ".theory-copyable-block",
    buttonSelector: ".theory-copyable__btn",
    copyLabel: "Copiar arquivo completo",
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
      const exemploIntroRaw =
        p.codigoExemploIntro != null && String(p.codigoExemploIntro).trim() !== ""
          ? String(p.codigoExemploIntro).trim()
          : "";
      const exemploIntroPara =
        exemploIntroRaw.length > 0 ? exemploIntroRaw : "Exemplo para copiar e adaptar:";
      const exemploHtml =
        exemploRaw.length > 0
          ? `<p class="checklist__code-intro">${escapeHtml(exemploIntroPara)}</p><div class="checklist__code-block"><button type="button" class="btn btn--ghost checklist__copy-btn" aria-label="Copiar código do exemplo">Copiar código</button><div class="checklist__code"><pre>${escapeHtml(exemploRaw)}</pre></div></div>`
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
      <div class="activity-actions-wrap">
        <div class="actions">
          <button type="button" class="btn btn--ghost" id="btnPrev">Anterior</button>
          <button type="button" class="btn btn--ghost" id="btnNext">Próxima</button>
        </div>
        ${ACTIVITY_KBD_NAV_HINT_HTML}
      </div>
    </article>`;

  const checklistRootEl = view.querySelector(".checklist-root");
  wireChecklistDetailsAccordion(checklistRootEl);
  wireChecklistCodeCopy(checklistRootEl);

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
          theoryVisitedSet,
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
    ? `<span class="pill activity-card__progress">Desafio ${idxInTopic} / ${totalInTopic} </span>`
    : `<span class="pill activity-card__progress">Questão ${idxInTopic} / ${totalInTopic} </span>`;

  const codeHtml = activityCodeBlockHtml(atividade.codigo);

  const hasSplitQuestionLayout =
    atividade.codigo != null &&
    String(atividade.codigo).trim() !== "" &&
    (!isDesafioCodigo || topico.contexto === "Lógica de programação");

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

  const descAndStem = `${formatActivityDescricaoHtml(atividade.descricao)}${
    hasSplitQuestionLayout
      ? `<div class="activity-split">
        <div class="activity-split__code">${codeHtml}</div>
        <div class="activity-split__options"><div class="options" id="optionsRoot">${optionsHtml}</div></div>
      </div>`
      : `${codeHtml}<div class="options" id="optionsRoot">${optionsHtml}</div>`
  }`;

  view.innerHTML = `
    <article class="activity-card">
      <div class="activity-card__head">
        ${kindBadge}
        ${progressPill}
      </div>
      ${descAndStem}
      <div class="activity-actions-wrap">
        <div class="actions">
          <button type="button" class="btn btn--ghost" id="btnPrev">Anterior</button>
          <button type="button" class="btn btn--ghost" id="btnNext">Próxima</button>
        </div>
        ${ACTIVITY_KBD_NAV_HINT_HTML}
      </div>
    </article>`;

  const optionsRoot = document.getElementById("optionsRoot");
  optionsRoot?.addEventListener("change", () => {
    applyQuestionFeedbackFromDom(ctx, topico, atividade);
  });

  document.getElementById("btnPrev")?.addEventListener("click", onPrev);
  document.getElementById("btnNext")?.addEventListener("click", onNext);

  if (!already && optionsRoot?.querySelector("input:checked")) {
    applyQuestionFeedbackFromDom(ctx, topico, atividade);
  } else if (already) {
    renderCompletedQuestionPanel(atividade, selectionsDict, topico);
    const savedNorm = new Set((selectionsDict[atividade.id] || []).map((id) => normalizeQuizOptionId(id)));
    const correctNorm = new Set((atividade.corretas || []).map((id) => normalizeQuizOptionId(id)));
    const matches = setsEqual(savedNorm, correctNorm);
    paintQuizOptionHighlights(optionsRoot, atividade, matches);
  } else {
    clearQuizOptionHighlights(optionsRoot);
    if (isDesafioCodigo) setFeedbackDesafiosHint();
    else clearFeedbackHint();
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
    detailLine = `<p>Nenhuma alternativa salva neste dispositivo. Gabarito: <strong>${escapeHtml(corrArrSaved)}</strong>. Marque uma alternativa para conferir no quadro abaixo.</p>`;
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
      <p>Você marcou: <strong>${escapeHtml(selArr)}</strong>. Correta: <strong>${escapeHtml(corrArr)}</strong>.</p>
    </div>
    <div class="feedback-section">
      <h3>Explicação</h3>
      <p style="margin:0;color:var(--muted)">${escapeHtml(atividade.explicacao || "")}</p>
    </div>
    ${codeSection}`;
}

/** Salva marcações, atualiza o quadro de resposta ao marcar alternativa e ancora no feedback. */
function applyQuestionFeedbackFromDom(ctx, topico, atividade) {
  const root = document.getElementById("optionsRoot");
  saveQuizSelectionsForActivity(
    atividade.id,
    root,
    ctx.selectionsDict,
    ctx.completedSet,
    ctx.theoryVisitedSet,
    ctx.checklistDict
  );
  const selected = new Set(
    root
      ? Array.from(root.querySelectorAll("input:checked")).map((/** @type {HTMLInputElement} */ i) => i.value)
      : []
  );
  if (selected.size === 0) {
    clearQuizOptionHighlights(root);
    if (atividade.tipo === "desafio_codigo") setFeedbackDesafiosHint();
    else clearFeedbackHint();
    scrollAnchorFeedbackPanel();
    return;
  }
  const selectedNorm = new Set([...selected].map((id) => normalizeQuizOptionId(id)));
  const correctNorm = new Set((atividade.corretas || []).map((id) => normalizeQuizOptionId(id)));
  const ok = setsEqual(selectedNorm, correctNorm);
  paintQuizOptionHighlights(root, atividade, ok);
  renderFeedback(ok, atividade, selected, topico);
  if (ok) {
    ctx.completedSet.add(atividade.id);
    persist(ctx.completedSet, ctx.theoryVisitedSet, ctx.checklistDict, ctx.selectionsDict);
    if (allDone(ctx.topicos, ctx.completedSet)) {
      ctx.paint();
      scrollAnchorMainInner();
    } else {
      scrollQuizAnswerAnchorMobileElseFeedback();
      renderTopicList(
        ctx.topicos,
        ctx.completedSet,
        ctx.theoryVisitedSet,
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
        ctx.completedSet,
        ctx.onSelectContexto
      );
      updateProgress(ctx.topicos, ctx.completedSet);
    }
  } else {
    scrollQuizAnswerAnchorMobileElseFeedback();
  }
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
      <p>Se você gostou, compartilhe essa trilha de estudos no seu LinkedIn :)</p>
      <div class="congrats__share">
        <button type="button" class="btn btn--primary" data-linkedin-modal="conquista">
          Compartilhar
        </button>
        <button type="button" class="btn btn--ghost" data-linkedin-modal="sugestao">
          Recomendar
        </button>
      </div>
    </div>`;
}

function initLinkedinShareModal() {
  const dialog = document.getElementById("linkedinShareModal");
  const textarea = document.getElementById("linkedinShareText");
  const titleEl = document.getElementById("linkedinShareTitle");
  const copyBtn = document.getElementById("linkedinShareCopy");
  const closeBtn = document.getElementById("linkedinShareClose");
  if (!dialog || !textarea || !titleEl || !copyBtn || !closeBtn) return;

  let copyResetTimer = /** @type {ReturnType<typeof setTimeout> | null} */ (null);

  function setCopyButtonLabel(label) {
    if (copyResetTimer) {
      clearTimeout(copyResetTimer);
      copyResetTimer = null;
    }
    copyBtn.textContent = label;
    if (label === "Copiado!") {
      copyResetTimer = setTimeout(() => {
        copyBtn.textContent = "Copiar texto";
        copyResetTimer = null;
      }, 2200);
    }
  }

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const btn = t.closest("[data-linkedin-modal]");
    if (!btn) return;
    const kind = btn.getAttribute("data-linkedin-modal");
    if (kind !== "conquista" && kind !== "sugestao") return;
    textarea.value = kind === "conquista" ? LINKEDIN_POST_CONQUISTA : LINKEDIN_POST_SUGESTAO;
    titleEl.textContent =
      kind === "conquista"
        ? "Compartilhar conquista — texto para colar no LinkedIn"
        : "Sugerir a trilha — texto para colar no LinkedIn";
    setCopyButtonLabel("Copiar texto");
    dialog.showModal();
    textarea.focus();
    textarea.select();
  });

  copyBtn.addEventListener("click", async () => {
    const text = textarea.value;
    try {
      await navigator.clipboard.writeText(text);
      setCopyButtonLabel("Copiado!");
    } catch {
      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
        setCopyButtonLabel("Copiado!");
      } catch {
        setCopyButtonLabel("Copiar texto");
      }
    }
  });

  closeBtn.addEventListener("click", () => {
    dialog.close();
  });

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
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

function initAppReset() {
  document.getElementById("appResetBtn")?.addEventListener("click", () => {
    const ok = window.confirm(
      "Apagar progresso da trilha, marcações e preferências salvas neste site? A página será recarregada."
    );
    if (!ok) return;
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    location.reload();
  });
}

/** Não capturar setas em campos de texto (ex.: futuros inputs). */
function shouldIgnoreActivityArrowNav(/** @type {EventTarget | null} */ target) {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const inp = /** @type {HTMLInputElement} */ (el);
    const type = (inp.type || "").toLowerCase();
    if (
      ["text", "email", "password", "search", "url", "tel", "number", "date", "time", "datetime-local"].includes(type)
    )
      return true;
  }
  if (el.isContentEditable) return true;
  return false;
}

/** ← / → entre Anterior e Próxima nas telas de atividade (perguntas ou checklist). */
function attachActivityArrowKeyNav() {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (shouldIgnoreActivityArrowNav(e.target)) return;
    const prev = document.getElementById("btnPrev");
    const next = document.getElementById("btnNext");
    if (!prev || !next) return;
    const card = document.querySelector("#main__inner .activity-card");
    if (!card || !card.contains(prev) || !card.contains(next)) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev.click();
    } else {
      e.preventDefault();
      next.click();
    }
  });
}

async function main() {
  initTheme();
  initAppReset();
  initLinkedinShareModal();
  attachActivityArrowKeyNav();
  wireContextNavMobileToggle();

  const topicListEl = document.getElementById("topicList");
  const sidebarToggle = document.getElementById("sidebarToggle");

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
  let theoryOnlyTopicId = /** @type {string | null} */ (null);
  let currentIndex = firstActivityIndexForContext(selectedContexto, flat, completedSet, doneGlobal);
  if (!contextHasFlatActivities(selectedContexto, flat)) {
    theoryOnlyTopicId = firstTopicIdInContext(topicos, selectedContexto);
  }
  if (currentIndex < 0) currentIndex = 0;

  function resolveFocusTopico() {
    if (!theoryOnlyTopicId) return null;
    const t = topicos.find((x) => x.id === theoryOnlyTopicId);
    if (t && t.contexto === selectedContexto) return t;
    theoryOnlyTopicId = null;
    return null;
  }

  function activeTopicId() {
    if (theoryOnlyTopicId) {
      const tp = topicos.find((x) => x.id === theoryOnlyTopicId);
      if (tp && tp.contexto === selectedContexto) return theoryOnlyTopicId;
    }
    if (currentIndex < 0 || currentIndex >= flat.length) return "";
    const cur = flat[currentIndex].topico;
    if (cur.contexto !== selectedContexto) return "";
    return cur.id;
  }

  function currentTopicoFromIndex() {
    if (currentIndex < 0 || currentIndex >= flat.length) return null;
    return flat[currentIndex].topico;
  }

  function resetMobileSidebarTopicActiveMode() {
    document.querySelector(".sidebar")?.classList.remove("sidebar--mobile-topic-active");
    const headTitle = document.querySelector(".sidebar__head h2");
    if (headTitle) headTitle.textContent = "Tópicos";
    sidebarToggle?.setAttribute("aria-expanded", "true");
    topicListEl?.classList.remove("collapsed");
  }

  function refreshMobileSidebarHeadTitle() {
    if (typeof window === "undefined" || !window.matchMedia(MOBILE_SIDEBAR_FIXED_MQ).matches) return;
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar?.classList.contains("sidebar--mobile-topic-active")) return;
    const top =
      theoryOnlyTopicId &&
      topicos.find((x) => x.id === theoryOnlyTopicId && x.contexto === selectedContexto)
        ? topicos.find((x) => x.id === theoryOnlyTopicId)
        : currentTopicoFromIndex();
    const headTitle = document.querySelector(".sidebar__head h2");
    if (headTitle && top) headTitle.textContent = top.titulo;
  }

  function enterMobileSidebarTopicActiveMode() {
    if (typeof window === "undefined" || !window.matchMedia(MOBILE_SIDEBAR_FIXED_MQ).matches) return;
    document.querySelector(".sidebar")?.classList.add("sidebar--mobile-topic-active");
    sidebarToggle?.setAttribute("aria-expanded", "false");
    topicListEl?.classList.add("collapsed");
    refreshMobileSidebarHeadTitle();
  }

  sidebarToggle?.addEventListener("click", () => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia(MOBILE_SIDEBAR_FIXED_MQ).matches &&
      document.querySelector(".sidebar")?.classList.contains("sidebar--mobile-topic-active")
    ) {
      resetMobileSidebarTopicActiveMode();
      requestAnimationFrame(() => {
        syncLayoutChrome();
      });
      return;
    }
    const expanded = sidebarToggle.getAttribute("aria-expanded") === "true";
    sidebarToggle.setAttribute("aria-expanded", String(!expanded));
    topicListEl?.classList.toggle("collapsed", expanded);
    requestAnimationFrame(() => {
      syncLayoutChrome();
    });
  });

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
      theoryOnlyTopicId = null;
      currentIndex = idx;
      const ctxTop = flat[currentIndex].topico.contexto;
      if (ctxTop && ctxTop !== selectedContexto) {
        selectedContexto = ctxTop;
        localStorage.setItem(CONTEXT_KEY, selectedContexto);
      }
      clearFeedbackHint();
      paint();
      enterMobileSidebarTopicActiveMode();
      requestAnimationFrame(() => {
        syncLayoutChrome();
        requestAnimationFrame(() => {
          scrollAnchorMainPanel();
        });
      });
      return;
    }
    const top = topicos.find((t) => t.id === topicId);
    if (!top || (top.atividades && top.atividades.length > 0)) return;
    theoryOnlyTopicId = topicId;
    const ctxTop = top.contexto;
    if (ctxTop && ctxTop !== selectedContexto) {
      selectedContexto = ctxTop;
      localStorage.setItem(CONTEXT_KEY, selectedContexto);
    }
    clearFeedbackHint();
    paint();
    enterMobileSidebarTopicActiveMode();
    requestAnimationFrame(() => {
      syncLayoutChrome();
      requestAnimationFrame(() => {
        scrollAnchorMainPanel();
      });
    });
  }

  function onOpenTopicTheory(topicId) {
    desafiosFocusTopicId = null;
    const idx = flat.findIndex((x) => x.topico.id === topicId);
    const topKnown = topicos.find((t) => t.id === topicId);
    if (!topKnown) return;
    if (idx >= 0) {
      theoryOnlyTopicId = null;
      currentIndex = idx;
    } else {
      theoryOnlyTopicId = topicId;
    }
    const ctxTop = topKnown.contexto;
    if (ctxTop && ctxTop !== selectedContexto) {
      selectedContexto = ctxTop;
      localStorage.setItem(CONTEXT_KEY, selectedContexto);
    }
    theoryVisitedSet.delete(topicId);
    persist(completedSet, theoryVisitedSet, checklistDict, selectionsDict);
    clearFeedbackHint();
    paint();
    enterMobileSidebarTopicActiveMode();
    requestAnimationFrame(() => {
      syncLayoutChrome();
      requestAnimationFrame(() => {
        scrollAnchorMainPanel();
      });
    });
  }

  function onOpenTopicActivities(topicId) {
    desafiosFocusTopicId = null;
    const top = topicos.find((t) => t.id === topicId);
    if (!top) return;
    const idx = flat.findIndex((x) => x.topico.id === topicId);
    if (idx >= 0) {
      theoryOnlyTopicId = null;
      if (topicHasTheory(top)) theoryVisitedSet.add(top.id);
      currentIndex = idx;
    } else if (!top.atividades || top.atividades.length === 0) {
      theoryOnlyTopicId = topicId;
    } else {
      return;
    }
    const ctxTop = top.contexto;
    if (ctxTop && ctxTop !== selectedContexto) {
      selectedContexto = ctxTop;
      localStorage.setItem(CONTEXT_KEY, selectedContexto);
    }
    persist(completedSet, theoryVisitedSet, checklistDict, selectionsDict);
    clearFeedbackHint();
    paint();
    enterMobileSidebarTopicActiveMode();
    requestAnimationFrame(() => {
      syncLayoutChrome();
      requestAnimationFrame(() => {
        scrollAnchorMainPanel();
      });
    });
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
    enterMobileSidebarTopicActiveMode();
    requestAnimationFrame(() => {
      syncLayoutChrome();
      requestAnimationFrame(() => {
        scrollAnchorMainPanel();
      });
    });
  }

  function onSelectContexto(contexto) {
    desafiosFocusTopicId = null;
    if (!contextos.includes(contexto)) return;
    selectedContexto = contexto;
    localStorage.setItem(CONTEXT_KEY, contexto);
    const idxFlat = firstActivityIndexForContext(
      selectedContexto,
      flat,
      completedSet,
      allDone(topicos, completedSet)
    );
    if (contextHasFlatActivities(selectedContexto, flat)) {
      theoryOnlyTopicId = null;
      currentIndex = idxFlat >= 0 ? idxFlat : 0;
    } else {
      theoryOnlyTopicId = firstTopicIdInContext(topicos, selectedContexto);
      currentIndex = idxFlat >= 0 ? idxFlat : 0;
    }
    clearFeedbackHint();
    const sidebarEl = document.querySelector(".sidebar");
    if (isGithubContext(selectedContexto)) {
      sidebarEl?.classList.add("sidebar--github-context");
      enterMobileSidebarTopicActiveMode();
      if (typeof window !== "undefined" && !window.matchMedia(MOBILE_SIDEBAR_FIXED_MQ).matches) {
        topicListEl?.classList.remove("collapsed");
        sidebarToggle?.setAttribute("aria-expanded", "true");
      }
    } else {
      sidebarEl?.classList.remove("sidebar--github-context");
      resetMobileSidebarTopicActiveMode();
    }
    paint();
    requestAnimationFrame(() => {
      syncLayoutChrome();
      requestAnimationFrame(() => {
        syncLayoutChrome();
        if (isGithubContext(selectedContexto)) {
          scrollAnchorMainPanel();
        } else if (isMobileStudyLayout()) {
          scrollAnchorMainInner();
        }
      });
    });
  }

  function paint() {
    if (allDone(topicos, completedSet)) {
      updateProgress(topicos, completedSet);
      renderContextNav(contextos, selectedContexto, topicos, completedSet, onSelectContexto);
      renderTopicList(
        topicos,
        completedSet,
        theoryVisitedSet,
        activeTopicId(),
        selectedContexto,
        onSelectTopic,
        onOpenTopicTheory,
        onOpenTopicActivities,
        onOpenTopicDesafios
      );
      showCongratulations();
      resetMobileSidebarTopicActiveMode();
      document.querySelector(".sidebar")?.classList.remove("sidebar--github-context");
      syncLayoutChrome();
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
          theoryOnlyTopicId = null;
          currentIndex--;
          const ctxTop = flat[currentIndex]?.topico.contexto;
          if (ctxTop && ctxTop !== selectedContexto) {
            selectedContexto = ctxTop;
            localStorage.setItem(CONTEXT_KEY, selectedContexto);
          }
          clearFeedbackHint();
          paint();
          scrollAnchorMainPanel();
        }
      },
      onNext: () => {
        if (currentIndex < flat.length - 1) {
          desafiosFocusTopicId = null;
          theoryOnlyTopicId = null;
          currentIndex++;
          const ctxTop = flat[currentIndex]?.topico.contexto;
          if (ctxTop && ctxTop !== selectedContexto) {
            selectedContexto = ctxTop;
            localStorage.setItem(CONTEXT_KEY, selectedContexto);
          }
          clearFeedbackHint();
          paint();
          scrollAnchorMainPanel();
        }
      },
    };

    renderContextNav(contextos, selectedContexto, topicos, completedSet, onSelectContexto);
    renderTopicList(
      topicos,
      completedSet,
      theoryVisitedSet,
      activeTopicId(),
      selectedContexto,
      onSelectTopic,
      onOpenTopicTheory,
      onOpenTopicActivities,
      onOpenTopicDesafios
    );
    updateProgress(topicos, completedSet);

    const focusExtras = resolveFocusTopico();
    if (
      focusExtras &&
      focusExtras.atividades.length === 0 &&
      focusExtras.contexto === selectedContexto
    ) {
      if (topicHasTheory(focusExtras) && !theoryVisitedSet.has(focusExtras.id)) {
        renderTheory(focusExtras, ctx);
      } else {
        renderTheoryOnlyStub(focusExtras, ctx);
      }
      refreshMobileSidebarHeadTitle();
      syncLayoutChrome();
      return;
    }

    const curTop = currentTopicoFromIndex();
    if (
      curTop &&
      desafiosFocusTopicId &&
      desafiosFocusTopicId === curTop.id &&
      topicHasDesafios(curTop)
    ) {
      renderDesafios(curTop);
      refreshMobileSidebarHeadTitle();
      syncLayoutChrome();
      return;
    }

    if (shouldShowTheory()) {
      const t = currentTopicoFromIndex();
      if (t) renderTheory(t, ctx);
      refreshMobileSidebarHeadTitle();
      syncLayoutChrome();
      return;
    }

    renderActivity(ctx);
    refreshMobileSidebarHeadTitle();
    syncLayoutChrome();
  }

  if (allDone(topicos, completedSet)) {
    updateProgress(topicos, completedSet);
    renderContextNav(contextos, selectedContexto, topicos, completedSet, onSelectContexto);
    renderTopicList(
      topicos,
      completedSet,
      theoryVisitedSet,
      activeTopicId(),
      selectedContexto,
      onSelectTopic,
      onOpenTopicTheory,
      onOpenTopicActivities,
      onOpenTopicDesafios
    );
    resetMobileSidebarTopicActiveMode();
    document.querySelector(".sidebar")?.classList.remove("sidebar--github-context");
    syncLayoutChrome();
  } else {
    paint();
    const sidebarBoot = document.querySelector(".sidebar");
    if (isGithubContext(selectedContexto)) {
      sidebarBoot?.classList.add("sidebar--github-context");
      if (typeof window !== "undefined" && !window.matchMedia(MOBILE_SIDEBAR_FIXED_MQ).matches) {
        topicListEl?.classList.remove("collapsed");
        sidebarToggle?.setAttribute("aria-expanded", "true");
      }
    } else {
      sidebarBoot?.classList.remove("sidebar--github-context");
    }
    if (isMobileStudyLayout()) {
      enterMobileSidebarTopicActiveMode();
      requestAnimationFrame(() => {
        syncLayoutChrome();
        requestAnimationFrame(() => {
          scrollAnchorMainPanel();
        });
      });
    } else if (isGithubContext(selectedContexto)) {
      requestAnimationFrame(() => {
        syncLayoutChrome();
        requestAnimationFrame(() => {
          scrollAnchorMainPanel();
        });
      });
    }
  }

  window.addEventListener("resize", () => {
    syncLayoutChrome();
    resetContextNavMobileForViewport();
  });
}

main();
