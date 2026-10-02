/* F.T Athletic Football Position — interazioni */
(() => {
  'use strict';

  // Email a cui arrivano le richieste del form.
  // Invio tramite FormSubmit (nessun backend): la prima richiesta manda a questo indirizzo
  // un'email di attivazione da confermare una volta sola.
  const CONTACT_EMAIL = 'ftfootballposition@gmail.com';
  const FORM_ENDPOINT = `https://formsubmit.co/ajax/${CONTACT_EMAIL}`;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ------------------------------------------------------------------
     Nav: sfondo solido allo scroll + menu mobile
     ------------------------------------------------------------------ */
  const nav = $('[data-nav]');
  const burger = $('[data-burger]');
  const menu = $('[data-menu]');

  const onScroll = () => nav.classList.toggle('is-solid', window.scrollY > 24 || !menu.hidden);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setMenu = (open) => {
    menu.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Chiudi menu' : 'Apri menu');
    onScroll();
  };
  burger.addEventListener('click', () => setMenu(menu.hidden));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  /* ------------------------------------------------------------------
     Reveal allo scroll (una volta sola)
     ------------------------------------------------------------------ */
  // Titoli: ogni parola in una maschera, sale in sequenza (conserva <br> e <span class="gold">)
  const splitWords = (root) => {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const inner = document.createElement('span');
            inner.textContent = part;
            inner.style.setProperty('--wi', i++);
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    root.setAttribute('aria-label', root.textContent.replace(/\s+/g, ' ').trim());
    walk(root);
    $$('.w', root).forEach((w) => w.setAttribute('aria-hidden', 'true'));
  };
  $$('[data-split]').forEach(splitWords);

  // il titolo della hero parte al caricamento, non allo scroll
  const heroTitle = $('[data-split="load"]');
  requestAnimationFrame(() => requestAnimationFrame(() => heroTitle && heroTitle.classList.add('is-in')));

  // sfalsa gli elementi fratelli che entrano insieme
  $$('.steps, .plans__grid, .about__body, .entries, .faq__list, .contact__intro').forEach((group) => {
    $$(':scope > .reveal, :scope .reveal', group).forEach((el, i) => el.style.setProperty('--d', i));
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
  $$('.reveal, [data-steps], [data-split]:not([data-split="load"]), .about__media[data-reveal-media]').forEach((el) => io.observe(el));

  /* ------------------------------------------------------------------
     Toast + popup
     ------------------------------------------------------------------ */
  const toastEl = $('[data-toast]');
  let toastTimer;
  const toast = (msg) => {
    $('[data-toast-text]', toastEl).textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 3200);
  };

  const modal = $('[data-modal]');
  const card = $('.modal__card', modal);
  let lastFocus = null;
  const openModal = ({ eyebrow, title, html, error = false, actions }) => {
    $('[data-modal-eyebrow]', modal).textContent = eyebrow;
    $('[data-modal-title]', modal).textContent = title;
    $('[data-modal-text]', modal).innerHTML = html;
    modal.classList.toggle('modal--error', error);
    $('[data-modal-icon]', modal).innerHTML = error
      ? '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path class="modal__check" d="M12 7v6M12 17h.01"/></svg>'
      : '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="modal__check" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    $('.modal__actions', modal).innerHTML = actions || '<button class="btn btn--gold" type="button" data-close>Perfetto</button>';
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.classList.remove('is-closing');
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      modal.classList.add('is-open');
      card.focus();
    }));
  };
  const closeModal = () => {
    if (modal.hidden || modal.classList.contains('is-closing')) return;
    modal.classList.add('is-closing');
    modal.classList.remove('is-open');
    setTimeout(() => {
      modal.hidden = true;
      modal.classList.remove('is-closing');
      document.documentElement.style.overflow = '';
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    }, reduceMotion ? 0 : 180);
  };
  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  /* ------------------------------------------------------------------
     FAQ: apertura animata (details nativo)
     ------------------------------------------------------------------ */
  $$('.qa').forEach((qa) => {
    const summary = $('summary', qa);
    const body = $('.qa__body', qa);
    summary.addEventListener('click', (e) => {
      if (reduceMotion || !body.animate) return;
      e.preventDefault();
      const opening = !qa.open;
      if (opening) qa.open = true;
      const h = body.scrollHeight;
      const anim = body.animate(
        opening
          ? [{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }]
          : [{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
        { duration: opening ? 320 : 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
      );
      anim.onfinish = () => { if (!opening) qa.open = false; };
    });
  });

  /* ------------------------------------------------------------------
     Profile builder
     ------------------------------------------------------------------ */
  const LEVELS = {
    youth: [
      { id: 'u14', name: 'U14 – U15', note: 'Giovanissimi', code: 'U14', sessions: 2 },
      { id: 'u16', name: 'U16 – U17', note: 'Allievi', code: 'U16', sessions: 2 },
      { id: 'u18', name: 'U18 – U19', note: 'Juniores · Primavera', code: 'U18', sessions: 3 },
    ],
    adult: [
      { id: 'am', name: 'Amatoriale', note: 'CSI · UISP · 3ª Cat.', code: 'AM', sessions: 2 },
      { id: 'dil', name: 'Dilettanti', note: '2ª Cat. – Eccellenza', code: 'DL', sessions: 3 },
      { id: 'sd', name: 'Serie D', note: 'Semi-pro', code: 'SD', sessions: 3 },
      { id: 'pro', name: 'Professionista', note: 'Serie C e oltre', code: 'PR', sessions: 4 },
    ],
  };

  const QUALITIES = [
    ['acc', 'Accelerazione'],
    ['vmax', 'Velocità massima'],
    ['cod', 'Cambi di direzione'],
    ['str', 'Forza'],
    ['pow', 'Potenza · Salto'],
    ['end', 'Resistenza (RSA)'],
  ];

  // Profili di ruolo: richieste di gara (0–100) e focus specifici.
  const ROLES = {
    gk: {
      name: 'Portiere', short: 'GK', dots: [[34, 97]],
      demand: 'Esplosività su 1–3 metri, salto e reattività. Tuffi, cadute e rialzate ripetute: pochi metri, intensità massima.',
      q: { acc: 80, vmax: 25, cod: 75, str: 75, pow: 95, end: 35 },
      focus: ['Potenza reattiva e stacco verticale', 'Rapidità laterale e lavoro di piedi', 'Forza di core e spalle per i tuffi'],
    },
    cb: {
      name: 'Difensore centrale', short: 'DC', dots: [[25, 84], [43, 84]],
      demand: 'Duelli aerei e a terra, accelerazioni in copertura e cambi di direzione all’indietro contro attaccanti più rapidi.',
      q: { acc: 75, vmax: 65, cod: 70, str: 90, pow: 85, end: 55 },
      focus: ['Forza massima e nei duelli', 'Stacco di testa e atterraggio', 'Partenze in corsa all’indietro'],
    },
    fb: {
      name: 'Terzino / Esterno', short: 'TS', dots: [[8, 74], [60, 74]],
      demand: 'Tra i ruoli con più sprint ad alta intensità: sovrapposizioni, rientri e corse lunghe ripetute su tutta la fascia.',
      q: { acc: 80, vmax: 90, cod: 70, str: 60, pow: 65, end: 95 },
      focus: ['Sprint ripetuti con recuperi brevi', 'Velocità massima su 30–40 m', 'Prevenzione flessori e adduttori'],
    },
    dm: {
      name: 'Mediano', short: 'MED', dots: [[34, 66]],
      demand: 'Distanza totale elevata, pressione continua, duelli e cambi di direzione in spazi stretti davanti alla difesa.',
      q: { acc: 70, vmax: 50, cod: 80, str: 80, pow: 60, end: 90 },
      focus: ['Resistenza intermittente', 'Decelerazioni e cambi di direzione', 'Forza nei contrasti'],
    },
    cm: {
      name: 'Mezzala', short: 'MZ', dots: [[20, 55], [48, 55]],
      demand: 'Box-to-box: tanta distanza e corse ad alta velocità negli inserimenti, con pochi secondi per recuperare.',
      q: { acc: 75, vmax: 70, cod: 75, str: 65, pow: 65, end: 95 },
      focus: ['Capacità aerobica ad alta intensità', 'Inserimenti: accelerazione da corsa lanciata', 'Economia di corsa'],
    },
    am: {
      name: 'Trequartista', short: 'TQ', dots: [[34, 42]],
      demand: 'Accelerazioni brevissime e cambi di direzione tra le linee, ricezione e prima giocata sotto pressione.',
      q: { acc: 90, vmax: 60, cod: 95, str: 55, pow: 70, end: 70 },
      focus: ['Agilità reattiva e primo passo', 'Decelerazione e ripartenza', 'Equilibrio e stabilità nei contatti'],
    },
    w: {
      name: 'Ala', short: 'AL', dots: [[10, 32], [58, 32]],
      demand: 'Sprint massimali, 1 contro 1, accelerazioni e frenate ripetute ad alta intensità lungo la fascia.',
      q: { acc: 95, vmax: 95, cod: 85, str: 55, pow: 75, end: 75 },
      focus: ['Accelerazione e velocità massima', 'Cambi di direzione ad alta velocità', 'Prevenzione flessori'],
    },
    st: {
      name: 'Attaccante', short: 'ATT', dots: [[34, 19]],
      demand: 'Scatti brevi in profondità, duelli spalle alla porta, salto e protezione palla. Poche corse, tutte decisive.',
      q: { acc: 95, vmax: 80, cod: 70, str: 80, pow: 90, end: 60 },
      focus: ['Accelerazione sui primi 10 m', 'Forza e potenza per i duelli', 'Stacco e colpo di testa'],
    },
  };

  // Fasi: obiettivo, modifiche alle priorità, settimana tipo.
  // p = priorità della sessione FT (vengono mostrate le prime N in base al livello)
  const PHASES = {
    off: {
      name: 'Off-season', code: 'OFF',
      goal: 'Ricostruire la base: forza, correzione dei deficit e volume progressivo.',
      mod: { str: 12, pow: 0, end: -8, vmax: -6, acc: 0, cod: 0 },
      focus: 'Correzione delle asimmetrie emerse in valutazione',
      week: [
        { d: 'Lun', t: 'gym', l: 'Forza generale', p: 1 },
        { d: 'Mar', t: 'field', l: 'Tecnica di corsa · Aerobico', p: 2 },
        { d: 'Mer', t: 'rest', l: 'Riposo' },
        { d: 'Gio', t: 'gym', l: 'Forza · Deficit', p: 3 },
        { d: 'Ven', t: 'field', l: 'Accelerazione · COD', p: 4 },
        { d: 'Sab', t: 'rec', l: 'Mobilità', p: 5 },
        { d: 'Dom', t: 'rest', l: 'Riposo' },
      ],
      fallback: 'rest', bonus: 1,
    },
    pre: {
      name: 'Pre-season', code: 'PRE',
      goal: 'Costruire capacità di lavoro e velocità per arrivare pronto alla prima giornata.',
      mod: { str: 0, pow: 4, end: 12, vmax: 4, acc: 6, cod: 0 },
      focus: 'Esposizione progressiva alla velocità massima',
      week: [
        { d: 'Lun', t: 'gym', l: 'Forza · Potenza', p: 1 },
        { d: 'Mar', t: 'field', l: 'Accelerazione · RSA', p: 2 },
        { d: 'Mer', t: 'club', l: 'Squadra' },
        { d: 'Gio', t: 'field', l: 'Velocità massima', p: 3 },
        { d: 'Ven', t: 'gym', l: 'Potenza · Prevenzione', p: 4 },
        { d: 'Sab', t: 'match', l: 'Amichevole' },
        { d: 'Dom', t: 'rest', l: 'Riposo' },
      ],
      fallback: 'club', bonus: 0,
    },
    in: {
      name: 'In-season', code: 'IN',
      goal: 'Mantenere forza e velocità senza accumulare fatica per la partita del weekend.',
      mod: { str: -4, pow: 6, end: -6, vmax: 4, acc: 6, cod: 0 },
      focus: 'Carichi gestiti su MD: niente fatica residua in partita',
      week: [
        { d: 'Lun', t: 'rec', l: 'MD+1 · Recupero', p: 3, f: { t: 'rest', l: 'MD+1 · Riposo' } },
        { d: 'Mar', t: 'club', l: 'MD-5 · Squadra' },
        { d: 'Mer', t: 'gym', l: 'MD-4 · Forza', p: 1 },
        { d: 'Gio', t: 'field', l: 'MD-3 · Velocità', p: 2 },
        { d: 'Ven', t: 'club', l: 'MD-2 · Squadra' },
        { d: 'Sab', t: 'field', l: 'MD-1 · Attivazione', p: 4, f: { t: 'club', l: 'MD-1 · Squadra' } },
        { d: 'Dom', t: 'match', l: 'MD · Partita' },
      ],
      fallback: 'club', bonus: 0,
    },
    win: {
      name: 'Winter break', code: 'WB',
      goal: 'Ricaricare e rilanciare: mini-blocco di forza e velocità per il girone di ritorno.',
      mod: { str: 8, pow: 4, end: -4, vmax: 6, acc: 2, cod: 0 },
      focus: 'Richiamo della velocità prima della ripresa',
      week: [
        { d: 'Lun', t: 'gym', l: 'Forza', p: 1 },
        { d: 'Mar', t: 'field', l: 'Velocità · COD', p: 2 },
        { d: 'Mer', t: 'rest', l: 'Riposo' },
        { d: 'Gio', t: 'gym', l: 'Potenza', p: 3 },
        { d: 'Ven', t: 'field', l: 'Richiamo RSA', p: 4 },
        { d: 'Sab', t: 'rec', l: 'Mobilità', p: 5 },
        { d: 'Dom', t: 'rest', l: 'Riposo' },
      ],
      fallback: 'rest', bonus: 1,
    },
  };

  const TYPE_LABEL = { gym: 'Gym', field: 'Field', rec: 'Recovery', club: 'Squadra', match: 'Partita', rest: 'Riposo' };
  const PATHS = { field: 'Field', gym: 'Gym', complete: 'Complete Performance' };

  const state = { cat: null, level: null, phase: null, role: null };

  const form = $('[data-builder]');
  const fs = Object.fromEntries($$('[data-q]', form).map((f) => [f.dataset.q, f]));
  const levelsBox = $('[data-levels]');
  const rolesBox = $('[data-roles]');
  const dotsG = $('[data-dots]');
  const out = {
    code: $('[data-code]'), progress: $('[data-progress]'), bar: $('[data-progress-bar]'),
    empty: $('[data-empty]'), body: $('[data-body]'), title: $('[data-title]'), demand: $('[data-demand]'),
    bars: $('[data-bars]'), week: $('[data-week]'), sessions: $('[data-sessions]'), focus: $('[data-focus]'),
    rec: $('[data-rec]'), request: $('[data-request]'),
  };

  const radio = (name, value, title, note) =>
    `<label class="choice"><input type="radio" name="${name}" value="${value}"><span><b>${title}</b>${note ? `<small>${note}</small>` : ''}</span></label>`;

  // ruoli: lista + punti sul campo
  rolesBox.innerHTML = Object.entries(ROLES).map(([id, r]) => radio('role', id, r.name, r.short)).join('');
  const SVG = 'http://www.w3.org/2000/svg';
  Object.entries(ROLES).forEach(([id, r]) => {
    r.dots.forEach(([x, y]) => {
      const g = document.createElementNS(SVG, 'g');
      g.setAttribute('class', 'pdot');
      g.dataset.role = id;
      g.innerHTML =
        `<circle class="halo" cx="${x}" cy="${y}" r="5.5"/>` +
        `<circle class="hit" cx="${x}" cy="${y}" r="5"/>` +
        `<circle class="core" cx="${x}" cy="${y}" r="2.2"/>` +
        `<text x="${x}" y="${y + 5.6}">${r.short}</text>`;
      g.addEventListener('click', () => {
        if (fs.role.disabled) return;
        const input = $(`input[name="role"][value="${id}"]`, rolesBox);
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      dotsG.appendChild(g);
    });
  });

  const renderLevels = () => {
    levelsBox.innerHTML = LEVELS[state.cat].map((l) => radio('level', l.id, l.name, l.note)).join('');
  };

  form.addEventListener('change', (e) => {
    const { name, value } = e.target;
    if (!(name in state)) return;
    state[name] = value;

    if (name === 'cat') {
      state.level = null;
      renderLevels();
      fs.level.disabled = false;
    }
    if (name === 'level') fs.phase.disabled = false;
    if (name === 'phase') fs.role.disabled = false;

    update();
  });

  const clamp = (n) => Math.max(15, Math.min(100, Math.round(n)));

  const compute = () => {
    const level = LEVELS[state.cat].find((l) => l.id === state.level);
    const phase = PHASES[state.phase];
    const role = ROLES[state.role];
    const youth = state.cat === 'youth';

    const q = {};
    QUALITIES.forEach(([k]) => {
      let v = role.q[k] + (phase.mod[k] || 0);
      if (youth && k === 'str') v -= 8; // tecnica prima del carico
      if (youth && k === 'cod') v += 5; // sviluppo coordinativo
      q[k] = clamp(v);
    });

    let sessions = level.sessions + phase.bonus;
    if (youth && state.phase === 'in') sessions = Math.min(sessions, 2);
    const maxP = Math.max(...phase.week.map((d) => d.p || 0));
    sessions = Math.min(sessions, maxP);

    const week = phase.week.map((d) => {
      if (!d.p) return d;
      if (d.p <= sessions) return d;
      if (d.f) return { d: d.d, ...d.f };
      return { d: d.d, t: phase.fallback, l: phase.fallback === 'club' ? 'Squadra' : 'Libero' };
    });

    let path = 'field';
    if (sessions >= 3 || state.phase === 'pre') path = 'complete';
    else if (state.phase === 'off' || state.phase === 'win') path = 'gym';

    const focus = [...role.focus, phase.focus];
    if (youth) focus.push('Maturazione biologica (PHV): carichi calibrati sull’età');

    return { level, phase, role, q, sessions, week, path, focus };
  };

  let swapTimer;
  const update = () => {
    const done = ['cat', 'level', 'phase', 'role'].filter((k) => state[k]).length;
    out.progress.textContent = done;
    out.bar.style.setProperty('--p', done / 4);

    Object.entries(fs).forEach(([k, f]) => f.classList.toggle('is-done', !!state[k]));

    $$('.pdot', dotsG).forEach((g) => g.classList.toggle('is-on', g.dataset.role === state.role));

    const lvl = state.cat && state.level ? LEVELS[state.cat].find((l) => l.id === state.level) : null;
    out.code.textContent = [
      'FT',
      state.cat ? (state.cat === 'youth' ? 'YT' : 'AD') : '—',
      lvl ? lvl.code : '—',
      state.phase ? PHASES[state.phase].code : '—',
      state.role ? ROLES[state.role].short : '—',
    ].join(' · ');

    if (done < 4) {
      out.empty.hidden = false;
      out.body.hidden = true;
      return;
    }

    const r = compute();
    const wasHidden = out.body.hidden;
    out.empty.hidden = true;
    out.body.hidden = false;

    if (!wasHidden) {
      out.body.classList.add('is-swap');
      clearTimeout(swapTimer);
      swapTimer = setTimeout(() => out.body.classList.remove('is-swap'), 120);
    }

    out.title.textContent = `${r.role.name} · ${r.level.name} · ${r.phase.name}`;
    out.demand.textContent = `${r.role.demand} ${r.phase.goal}`;

    // barre: crea una volta, poi aggiorna (così la transizione riparte dal valore attuale)
    if (!out.bars.children.length) {
      out.bars.innerHTML = QUALITIES.map(([k, label]) =>
        `<li data-k="${k}"><span>${label}</span><span class="bar"><i></i></span><span class="val">0</span></li>`).join('');
    }
    const top = [...QUALITIES].sort((a, b) => r.q[b[0]] - r.q[a[0]]).slice(0, 2).map(([k]) => k);
    requestAnimationFrame(() => {
      $$('li', out.bars).forEach((li) => {
        const v = r.q[li.dataset.k];
        $('i', li).style.setProperty('--v', v / 100);
        $('.val', li).textContent = v;
        li.classList.toggle('is-top', top.includes(li.dataset.k));
      });
    });

    out.sessions.textContent = `${r.sessions} sessioni FT / sett.`;
    out.week.innerHTML = r.week.map((d) =>
      `<li data-t="${d.t}"><span class="d">${d.d}</span><span class="t">${TYPE_LABEL[d.t]}</span><span class="l">${d.l}</span></li>`).join('');

    out.focus.innerHTML = r.focus.map((f) => `<li>${f}</li>`).join('');
    out.rec.textContent = PATHS[r.path];

    const summary = `${out.code.textContent} — ${r.role.name}, ${r.level.name}, ${r.phase.name} → ${PATHS[r.path]}`;
    out.request.dataset.summary = summary;
  };

  out.request.addEventListener('click', () => {
    const input = $('[data-profile-input]');
    if (input && out.request.dataset.summary) {
      input.value = out.request.dataset.summary;
      toast('Profilo aggiunto alla richiesta');
    }
  });

  /* ------------------------------------------------------------------
     Pacchetti: In presenza / Online
     ------------------------------------------------------------------ */
  const seg = $('.seg');
  const plans = $('.plans');
  $$('.seg__btn', seg).forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (seg.dataset.mode === mode || (!seg.dataset.mode && mode === 'live')) return;
      seg.dataset.mode = mode;
      $$('.seg__btn', seg).forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      plans.classList.add('is-swap');
      setTimeout(() => {
        $$('[data-live]', plans).forEach((el) => { el.textContent = el.dataset[mode]; });
        plans.classList.remove('is-swap');
      }, 150);
    });
  });

  $$('[data-plan-cta]').forEach((a) => a.addEventListener('click', () => {
    const msg = $('.form textarea[name="messaggio"]');
    const mode = seg.dataset.mode === 'online' ? 'Online' : 'In presenza';
    if (msg && !msg.value.trim()) msg.value = `Mi interessa il pacchetto ${a.dataset.planCta} (${mode}).`;
    toast(`${a.dataset.planCta} · ${mode} aggiunto alla richiesta`);
  }));

  /* ------------------------------------------------------------------
     Form contatti → FormSubmit → ftfootballposition@gmail.com
     ------------------------------------------------------------------ */
  const cform = $('[data-form]');
  const submit = $('[data-submit]', cform);
  const isValid = (el) => {
    const v = el.value.trim();
    if (!v) return false;
    return el.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  };

  // l'errore sparisce appena il campo diventa valido
  $$('[required]', cform).forEach((el) => el.addEventListener('input', () => {
    if (el.getAttribute('aria-invalid') === 'true' && isValid(el)) el.setAttribute('aria-invalid', 'false');
  }));

  cform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = $$('[required]', cform).filter((el) => {
      const ok = isValid(el);
      el.setAttribute('aria-invalid', 'false');
      if (!ok) void el.offsetWidth; // riavvia l'animazione di errore
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      return !ok;
    });
    if (bad.length) { bad[0].focus(); return; }

    const data = Object.fromEntries(new FormData(cform));
    if (data._honey) return; // bot
    delete data._honey;

    const payload = {
      _subject: `F.T Athletic Football Position — richiesta valutazione di ${data.nome}`,
      _template: 'table',
      _replyto: data.email,
      Nome: data.nome,
      'Età': data.eta || '—',
      Email: data.email,
      Telefono: data.telefono || '—',
      Profilo: data.profilo || '—',
      Messaggio: data.messaggio || '—',
    };

    submit.classList.add('is-loading');
    submit.setAttribute('aria-busy', 'true');
    const started = performance.now();

    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || String(json.success) === 'false') throw new Error(json.message || res.status);

      // lo spinner resta almeno 600ms: un lampo troppo breve sembra un errore
      await new Promise((r) => setTimeout(r, Math.max(0, 600 - (performance.now() - started))));
      const first = (data.nome || '').trim().split(/\s+/)[0];
      openModal({
        eyebrow: 'Request sent',
        title: 'See you on the pitch.',
        html: `Grazie${first ? ` ${first}` : ''}, ho ricevuto la tua richiesta. Ti ricontatto entro 48 ore per fissare la valutazione.`,
      });
      cform.reset();
    } catch (err) {
      const body = Object.entries(payload).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${k}: ${v}`).join('\n');
      const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(payload._subject)}&body=${encodeURIComponent(body)}`;
      openModal({
        error: true,
        eyebrow: 'Something went wrong',
        title: 'Try again.',
        html: `La richiesta non è partita, probabilmente per un problema di connessione. Riprova tra poco oppure scrivimi direttamente a <a href="${mailto}">${CONTACT_EMAIL}</a>.`,
        actions: `<a class="btn btn--gold" href="${mailto}">Invia via email</a><button class="btn btn--ghost" type="button" data-close>Chiudi</button>`,
      });
    } finally {
      submit.classList.remove('is-loading');
      submit.removeAttribute('aria-busy');
    }
  });

  $('[data-year]').textContent = new Date().getFullYear();
})();
