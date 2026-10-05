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
     Calcio (Youth / Senior): livello → fase → ruolo sul campo
     Fitness Athlete: niente campo né ruolo, solo l'obiettivo di allenamento
     ------------------------------------------------------------------ */
  const LEVELS = {
    youth: [
      { id: 'u14', name: 'U14 – U15', note: 'Giovanissimi', code: 'U14' },
      { id: 'u16', name: 'U16 – U17', note: 'Allievi', code: 'U16' },
      { id: 'u18', name: 'U18 – U19', note: 'Juniores · Primavera', code: 'U18' },
    ],
    senior: [
      { id: 'am', name: 'Amatoriale', note: 'CSI · UISP · Calcio a 8 · Tornei amatoriali', code: 'AM' },
      { id: 'dil', name: 'Dilettante', note: '3ª · 2ª · 1ª Categoria', code: 'DL' },
      { id: 'dile', name: 'Dilettante Élite', note: 'Promozione · Eccellenza', code: 'DE' },
      { id: 'sd', name: 'Semi-Pro', note: 'Serie D', code: 'SD' },
      { id: 'pro', name: 'Professionista', note: 'Serie A · B · C', code: 'PR' },
    ],
  };
  const HIGH_LEVELS = ['u18', 'dile', 'sd', 'pro'];

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
      name: 'Portiere', short: 'P', dots: [[34, 97]],
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

  const PHASES = {
    off: {
      name: 'Off-season', code: 'OFF',
      goal: 'Ricostruire la base: forza, correzione dei deficit e volume progressivo.',
      mod: { str: 12, pow: 0, end: -8, vmax: -6, acc: 0, cod: 0 },
      focus: 'Correzione delle asimmetrie emerse in valutazione',
    },
    pre: {
      name: 'Pre-season', code: 'PRE',
      goal: 'Costruire capacità di lavoro e velocità per arrivare pronto alla prima giornata.',
      mod: { str: 0, pow: 4, end: 12, vmax: 4, acc: 6, cod: 0 },
      focus: 'Esposizione progressiva alla velocità massima',
    },
    in: {
      name: 'In-season', code: 'IN',
      goal: 'Mantenere forza e velocità senza accumulare fatica per la partita del weekend.',
      mod: { str: -4, pow: 6, end: -6, vmax: 4, acc: 6, cod: 0 },
      focus: 'Carichi gestiti sul microciclo: niente fatica residua in partita',
    },
    win: {
      name: 'Winter break', code: 'WB',
      goal: 'Ricaricare e rilanciare: mini-blocco di forza e velocità per il girone di ritorno.',
      mod: { str: 8, pow: 4, end: -4, vmax: 6, acc: 2, cod: 0 },
      focus: 'Richiamo della velocità prima della ripresa',
    },
  };

  // Fitness Athlete: obiettivo di allenamento al posto del ruolo
  const FIT_QUALITIES = [
    ['str', 'Forza'],
    ['pow', 'Potenza'],
    ['spd', 'Velocità'],
    ['end', 'Resistenza'],
    ['mob', 'Mobilità'],
    ['core', 'Core · Stabilità'],
  ];
  const GOALS = {
    str: {
      name: 'Strength', it: 'Forza', code: 'STR', path: 'gym',
      demand: 'Obiettivo: diventare più forte in modo solido e progressivo, con una tecnica pulita sui fondamentali e carichi che crescono settimana dopo settimana.',
      q: { str: 95, pow: 65, spd: 40, end: 40, mob: 60, core: 75 },
      focus: ['Progressione sui fondamentali: squat, stacco, spinta e trazione', 'Tecnica degli esercizi prima del carico', 'Core e stabilità per trasferire la forza'],
    },
    pow: {
      name: 'Power', it: 'Potenza', code: 'PWR', path: 'gym',
      demand: 'Obiettivo: esprimere forza più velocemente. Salti, lanci e sollevamenti esplosivi costruiti su una base di forza adeguata.',
      q: { str: 75, pow: 95, spd: 70, end: 35, mob: 55, core: 70 },
      focus: ['Pliometria progressiva e atterraggi corretti', 'Esercizi balistici e lanci con palla medica', 'Base di forza per sostenere il lavoro esplosivo'],
    },
    spd: {
      name: 'Speed', it: 'Velocità', code: 'SPD', path: 'field',
      demand: 'Obiettivo: correre più veloce e cambiare direzione con più controllo. Tecnica di corsa, accelerazione e velocità massima.',
      q: { str: 60, pow: 80, spd: 95, end: 45, mob: 65, core: 60 },
      focus: ['Tecnica di corsa e accelerazione', 'Velocità massima ed esposizione allo sprint', 'Cambi di direzione e decelerazione'],
    },
    end: {
      name: 'Endurance', it: 'Resistenza', code: 'END', path: 'field',
      demand: 'Obiettivo: reggere più a lungo e recuperare meglio tra uno sforzo e l’altro, con lavoro aerobico e intervallato ben dosato.',
      q: { str: 45, pow: 40, spd: 50, end: 95, mob: 55, core: 55 },
      focus: ['Base aerobica e lavoro intervallato', 'Capacità di recupero tra gli sforzi', 'Forza di base per prevenire i sovraccarichi'],
    },
    gen: {
      name: 'General Fitness', it: 'Condizione generale', code: 'GEN', path: 'complete',
      demand: 'Obiettivo: stare meglio e muoverti meglio. Un programma equilibrato tra forza, condizionamento e mobilità, sostenibile nel tempo.',
      q: { str: 70, pow: 50, spd: 50, end: 70, mob: 80, core: 75 },
      focus: ['Equilibrio tra forza, condizionamento e mobilità', 'Qualità del movimento e prevenzione', 'Progressione costante e sostenibile'],
    },
  };

  const PATHS = { field: 'Field', gym: 'Gym', complete: 'Complete Performance' };
  const STEPS = { football: ['cat', 'level', 'phase', 'role'], fitness: ['cat', 'goal'] };

  const state = { cat: null, level: null, phase: null, role: null, goal: null };
  const isFitness = () => state.cat === 'fitness';
  let lastFootballCat = null;

  const form = $('[data-builder]');
  const fs = Object.fromEntries($$('[data-q]', form).map((f) => [f.dataset.q, f]));
  const branches = Object.fromEntries($$('[data-branch]', form).map((b) => [b.dataset.branch, b]));
  const levelsBox = $('[data-levels]');
  const rolesBox = $('[data-roles]');
  const goalsBox = $('[data-goals]');
  const dotsG = $('[data-dots]');
  const out = {
    code: $('[data-code]'), progress: $('[data-progress]'), total: $('[data-total]'), bar: $('[data-progress-bar]'),
    empty: $('[data-empty]'), body: $('[data-body]'), kind: $('[data-kind]'), title: $('[data-title]'), demand: $('[data-demand]'),
    bars: $('[data-bars]'), focus: $('[data-focus]'), rec: $('[data-rec]'), request: $('[data-request]'),
  };

  const radio = (name, value, title, note) =>
    `<label class="choice"><input type="radio" name="${name}" value="${value}"><span><b>${title}</b>${note ? `<small>${note}</small>` : ''}</span></label>`;

  rolesBox.innerHTML = Object.entries(ROLES).map(([id, r]) => radio('role', id, r.name, r.short)).join('');
  goalsBox.innerHTML = Object.entries(GOALS).map(([id, g]) => radio('goal', id, g.name, g.it)).join('');

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
        if (fs.role.disabled || isFitness()) return;
        const input = $(`input[name="role"][value="${id}"]`, rolesBox);
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      dotsG.appendChild(g);
    });
  });

  const setBranch = (name) => {
    Object.entries(branches).forEach(([k, el]) => {
      const open = k === name;
      el.classList.toggle('is-open', open);
      el.inert = !open;
      el.setAttribute('aria-hidden', String(!open));
    });
  };

  form.addEventListener('change', (e) => {
    const { name, value } = e.target;
    if (!(name in state)) return;
    state[name] = value;

    if (name === 'cat') {
      if (value === 'fitness') {
        setBranch('fitness');
      } else {
        setBranch('football');
        // cambio Youth ↔ Senior: livelli diversi, i passi 02–04 ripartono da capo
        // (andare su Fitness e tornare alla stessa categoria invece conserva le scelte)
        if (value !== lastFootballCat) {
          state.level = state.phase = state.role = null;
          levelsBox.innerHTML = LEVELS[value].map((l) => radio('level', l.id, l.name, l.note)).join('');
          $$('input[name="phase"], input[name="role"]', form).forEach((i) => { i.checked = false; });
          lastFootballCat = value;
        }
        fs.level.disabled = false;
        fs.phase.disabled = !state.level;
        fs.role.disabled = !state.phase;
      }
    }
    if (name === 'level') fs.phase.disabled = false;
    if (name === 'phase') fs.role.disabled = false;

    update();
  });

  const clamp = (n) => Math.max(15, Math.min(100, Math.round(n)));

  const compute = () => {
    if (isFitness()) {
      const goal = GOALS[state.goal];
      return {
        kind: 'Fitness Performance Profile',
        title: `Fitness Athlete · ${goal.name}`,
        demand: goal.demand,
        qualities: FIT_QUALITIES,
        q: goal.q,
        focus: goal.focus,
        path: goal.path,
        label: `Fitness Athlete, ${goal.name}`,
      };
    }
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

    let path = 'field';
    if (state.phase === 'pre' || HIGH_LEVELS.includes(state.level)) path = 'complete';
    else if (state.phase === 'off' || state.phase === 'win') path = 'gym';

    const focus = [...role.focus, phase.focus];
    if (youth) focus.push('Sviluppo adattato all’età: qualità del movimento prima del carico');

    return {
      kind: 'Football Performance Profile',
      title: `${role.name} · ${level.name} · ${phase.name}`,
      demand: `${role.demand} ${phase.goal}`,
      qualities: QUALITIES,
      q,
      focus,
      path,
      label: `${role.name}, ${level.name}, ${phase.name}`,
    };
  };

  let swapTimer;
  const update = () => {
    const steps = STEPS[isFitness() ? 'fitness' : 'football'];
    const done = steps.filter((k) => state[k]).length;
    out.progress.textContent = done;
    out.total.textContent = steps.length;
    out.bar.style.setProperty('--p', done / steps.length);

    Object.entries(fs).forEach(([k, f]) => f.classList.toggle('is-done', !!state[k]));
    $$('.pdot', dotsG).forEach((g) => g.classList.toggle('is-on', g.dataset.role === state.role));

    if (isFitness()) {
      out.code.textContent = ['FT', 'FIT', state.goal ? GOALS[state.goal].code : '—'].join(' · ');
    } else {
      const lvl = state.cat && state.level ? LEVELS[state.cat].find((l) => l.id === state.level) : null;
      out.code.textContent = [
        'FT',
        state.cat ? (state.cat === 'youth' ? 'YT' : 'SR') : '—',
        lvl ? lvl.code : '—',
        state.phase ? PHASES[state.phase].code : '—',
        state.role ? ROLES[state.role].short : '—',
      ].join(' · ');
    }

    if (done < steps.length) {
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

    out.kind.textContent = r.kind;
    out.title.textContent = r.title;
    out.demand.textContent = r.demand;

    // barre: ricreate solo se cambia il tipo di profilo, così la transizione parte dal valore attuale
    const kindKey = isFitness() ? 'fit' : 'foot';
    if (out.bars.dataset.kind !== kindKey) {
      out.bars.dataset.kind = kindKey;
      out.bars.innerHTML = r.qualities.map(([k, label]) =>
        `<li data-k="${k}"><span>${label}</span><span class="bar"><i></i></span><span class="val">0</span></li>`).join('');
    }
    const top = [...r.qualities].sort((a, b) => r.q[b[0]] - r.q[a[0]]).slice(0, 2).map(([k]) => k);
    requestAnimationFrame(() => {
      $$('li', out.bars).forEach((li) => {
        const v = r.q[li.dataset.k];
        $('i', li).style.setProperty('--v', v / 100);
        $('.val', li).textContent = v;
        li.classList.toggle('is-top', top.includes(li.dataset.k));
      });
    });

    out.focus.innerHTML = r.focus.map((f) => `<li>${f}</li>`).join('');
    out.rec.textContent = PATHS[r.path];
    out.request.dataset.summary = `${out.code.textContent} — ${r.label} → ${PATHS[r.path]}`;
  };

  out.request.addEventListener('click', () => {
    const input = $('[data-profile-input]');
    if (input && out.request.dataset.summary) {
      input.value = out.request.dataset.summary;
      toast('Profilo aggiunto alla richiesta');
    }
  });

  /* ------------------------------------------------------------------
     Pacchetti: In presenza / Online (due pannelli, tab accessibili)
     ------------------------------------------------------------------ */
  const seg = $('.seg');
  const tabs = $$('.seg__btn', seg);
  const panels = Object.fromEntries($$('[data-panel]').map((p) => [p.dataset.panel, p]));
  let panelTimer;

  const showMode = (mode, focus = false) => {
    const current = seg.dataset.mode || 'live';
    if (current === mode) return;
    seg.dataset.mode = mode;
    tabs.forEach((b) => {
      const on = b.dataset.mode === mode;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    const from = panels[current];
    const to = panels[mode];
    clearTimeout(panelTimer);
    from.classList.remove('is-active');
    panelTimer = setTimeout(() => {
      from.hidden = true;
      to.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => to.classList.add('is-active')));
    }, reduceMotion ? 0 : 160);
  };

  tabs.forEach((btn, i) => {
    btn.tabIndex = i === 0 ? 0 : -1;
    btn.addEventListener('click', () => showMode(btn.dataset.mode));
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      showMode(next.dataset.mode, true);
    });
  });

  $$('[data-plan-cta]').forEach((a) => a.addEventListener('click', () => {
    const msg = $('.form textarea[name="messaggio"]');
    const mode = a.dataset.planMode;
    const what = mode === 'Online' ? `${a.dataset.planCta} Online (12 settimane)` : `${a.dataset.planCta} in presenza`;
    if (msg && !msg.value.trim()) {
      msg.value = mode === 'Online'
        ? `Mi interessa il percorso ${what}.`
        : `Vorrei ricevere informazioni sul percorso ${what}.`;
    }
    toast(`${what} aggiunto alla richiesta`);
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
