/* =============================================================================
   KICKSLAB â€” logica del catalogo
   -----------------------------------------------------------------------------
   Legge window.CATALOGO da catalogo.js e costruisce: griglia filtrabile,
   chip marche, marche nel menu hamburger, elenco marche, scheda, ricerca.
   Un prodotto = una voce. L'unico raggruppamento e' la marca.

   Link diretti supportati:
     catalogo.html?marca=Nike     apre il catalogo gia' filtrato
     catalogo.html?p=esempio-01   apre direttamente la scheda del prodotto
   ========================================================================== */
(function () {
  'use strict';

  /* --- Da modificare -------------------------------------------------------- */
  var TELEGRAM = "KeKKo0202";      // username Telegram, senza chiocciola
  var PER_PAGINA = 24;             // quante card prima di "Mostra altri"

  var DATI = Array.isArray(window.CATALOGO) ? window.CATALOGO : [];

  /* --- Scorciatoie ---------------------------------------------------------- */
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  // Normalizza per la ricerca: minuscolo, senza accenti e senza punteggiatura
  var norm = function (t) {
    return String(t || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  };

  /* --- Stato ---------------------------------------------------------------- */
  var stato = { testo: '', marca: null, mostrati: PER_PAGINA };
  var scrollLock = false;
  var infiniteObserver = null;
  var AUTO_SCROLL = 'IntersectionObserver' in window;

  /* --- Indice di ricerca precalcolato --------------------------------------- */
  DATI.forEach(function (p, i) {
    if (!p.id) p.id = 'p' + i;
    p._cerca = norm([p.marca, p.nome, p.categoria, p.note, p.taglie].join(' '));
  });

  function costruisciMarche() {
    var m = {};
    DATI.forEach(function (p) { m[p.marca] = (m[p.marca] || 0) + 1; });
    return Object.keys(m).sort().map(function (k) { return { nome: k, n: m[k] }; });
  }

  var MARCHE = costruisciMarche();

  /* --- Pezzi di markup ------------------------------------------------------ */
  function media(p) {
    if (p.foto && p.foto.length) {
      return '<img src="' + esc(p.foto[0]) + '" alt="' + esc(p.marca + ' ' + p.nome) +
             '" loading="lazy" decoding="async">';
    }
    // Segnaposto: nessuna richiesta di rete, non lascia buchi bianchi
    return '<div class="ph"><span class="kicker">' + esc(p.marca) + '</span>' +
           '<span class="kicker">KICKSLAB</span></div>';
  }

  function marcaChip(m) {
    return '<option value="' + esc(m.nome) + '">' +
      esc(m.nome) + ' (' + m.n + ')' +
      '</option>';
  }

  function card(p) {
    return '<article class="card" data-id="' + esc(p.id) + '" tabindex="0">' +
      '<span class="card__media">' + media(p) +
        (p.note ? '<span class="card__collab">' + esc(p.note) + '</span>' : '') +
      '</span>' +
      '<span class="card__body">' +
        '<span class="card__brand">' + esc(p.marca) + '</span>' +
        '<span class="card__name">' + esc(p.nome) + '</span>' +
        (p.taglie ? '<span class="card__colors"><span class="card__more">TAGLIE ' +
                    esc(p.taglie) + '</span></span>' : '') +
      '</span>' +
    '</article>';
  }

  /* --- Filtro --------------------------------------------------------------- */
  function filtra() {
    var q = norm(stato.testo);
    var parole = q ? q.split(' ') : [];
    return DATI.filter(function (p) {
      if (stato.marca && p.marca !== stato.marca) return false;
      // Tutte le parole devono comparire: cosi' "nike max" restringe davvero
      return parole.every(function (w) { return p._cerca.indexOf(w) !== -1; });
    });
  }

  function caricaAltri() {
    var risultati = filtra();
    if (risultati.length <= stato.mostrati || scrollLock) return;

    scrollLock = true;
    stato.mostrati = Math.min(stato.mostrati + PER_PAGINA, risultati.length);
    disegna();
    setTimeout(function () { scrollLock = false; }, 120);
  }

  /* --- Rendering della griglia ---------------------------------------------- */
  function disegna() {
    var risultati = filtra();
    var visibili = risultati.slice(0, stato.mostrati);

    $('#grid').innerHTML = visibili.length
      ? visibili.map(card).join('')
      : '<div class="empty"><strong>Niente qui</strong><p>Prova con un\'altra marca o cancella la ricerca.</p></div>';

    $('#resultCount').textContent = risultati.length +
      (risultati.length === 1 ? ' prodotto' : ' prodotti');

    $('#loadMore').hidden = AUTO_SCROLL || risultati.length <= stato.mostrati;
    $('#loadMoreWrap').hidden = risultati.length <= stato.mostrati;
    $('#resetFilters').hidden = !stato.marca && !stato.testo;

    var brandSelect = $('#brandSelect');
    if (brandSelect) brandSelect.value = stato.marca || '';

    document.querySelectorAll('#drawerBrands button').forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.marca === stato.marca));
    });
  }

  /* --- Chip marche, elenco marche, marche nel menu --------------------------- */
  function costruisciStatici() {
    $('#brandChips').innerHTML =
      '<label class="brandSelect" for="brandSelect">' +
        '<span>Scegli marca</span>' +
        '<select id="brandSelect">' +
          '<option value="">Tutte le marche</option>' +
          MARCHE.map(marcaChip).join('') +
        '</select>' +
      '</label>';

    $('#brandList').innerHTML = MARCHE.map(function (m) {
      return '<button data-marca="' + esc(m.nome) + '"><strong>' + esc(m.nome) +
             '</strong><span>' + m.n + (m.n === 1 ? ' prodotto' : ' prodotti') + ' &rarr;</span></button>';
    }).join('');

    // Stesse marche nel menu hamburger: e' la navigazione da telefono
    $('#drawerBrands').innerHTML = MARCHE.map(function (m) {
      return '<button data-marca="' + esc(m.nome) + '" aria-pressed="false">' +
             esc(m.nome) + '<i>' + m.n + '</i></button>';
    }).join('');

    $('#heroModels').textContent = String(DATI.length).padStart(3, '0');
    $('#footerYear').textContent = new Date().getFullYear();
  }

  /* --- Scheda prodotto ------------------------------------------------------- */
  var sheet = $('#sheet');
  var apertoDa = null;

  function apriScheda(id) {
    var p = DATI.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    apertoDa = document.activeElement;

    $('#sheetBrand').textContent = p.marca;
    $('#sheetTitle').textContent = p.nome;
    $('#sheetMedia').innerHTML = media(p);
    $('#sheetTelegram').href = 'https://t.me/' + TELEGRAM;

    sheet.dataset.open = 'true';
    document.body.classList.add('is-locked');
    // L'indirizzo tiene traccia del prodotto aperto: il tasto indietro lo chiude
    history.replaceState(null, '', '?p=' + encodeURIComponent(p.id));
    setTimeout(function () { $('.sheet__close').focus(); }, 60);
  }

  function chiudiScheda() {
    sheet.dataset.open = 'false';
    document.body.classList.remove('is-locked');
    history.replaceState(null, '', location.pathname);
    if (apertoDa) apertoDa.focus();
  }

  // Copia negli appunti il link della scheda aperta
  function copiaLink() {
    var url = location.origin + location.pathname + location.search;
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(url).then(function () {
      var b = $('#sheetShare');
      b.textContent = 'Link copiato';
      setTimeout(function () { b.textContent = 'Copia link'; }, 1800);
    }, function () { /* appunti negati dal browser: pazienza */ });
  }

  /* --- Ricerca a tutto schermo ----------------------------------------------- */
  function risultatiRicerca(q) {
    var parole = norm(q).split(' ').filter(Boolean);
    if (!parole.length) return [];
    return DATI.filter(function (p) {
      return parole.every(function (w) { return p._cerca.indexOf(w) !== -1; });
    }).slice(0, 30);
  }

  function disegnaRicerca(q) {
    var r = risultatiRicerca(q);
    $('#searchResults').innerHTML = r.length
      ? r.map(function (p) {
          return '<button class="qres" data-id="' + esc(p.id) + '">' +
                 '<strong>' + esc(p.nome) + '<small>' + esc(p.marca) + '</small></strong>' +
                 '<span>' + esc(p.taglie || '') + '</span></button>';
        }).join('')
      : (q ? '<p class="kicker" style="padding:18px 0">Nessun risultato</p>' : '');
  }

  function statoRicerca(aperta) {
    $('#search').dataset.open = String(aperta);
    document.body.classList.toggle('is-locked', aperta);
    if (aperta) setTimeout(function () { $('#searchInput').focus(); }, 60);
  }

  /* --- Drawer ---------------------------------------------------------------- */
  function statoDrawer(aperto) {
    var d = $('#drawer');
    d.dataset.open = String(aperto);
    d.setAttribute('aria-hidden', String(!aperto));
    $('#menuOpen').setAttribute('aria-expanded', String(aperto));
    document.body.classList.toggle('is-locked', aperto);
  }

  /* --- Eventi ---------------------------------------------------------------- */
  function collega() {
    // Un solo listener per tutti i click: le card vengono ridisegnate spesso
    document.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip[data-marca]');
      if (chip) {
        stato.marca = (stato.marca === chip.dataset.marca) ? null : chip.dataset.marca;
        stato.mostrati = PER_PAGINA;
        disegna();
        return;
      }

      var voceDrawer = e.target.closest('#drawerBrands button[data-marca]');
      if (voceDrawer) {
        stato.marca = voceDrawer.dataset.marca;
        stato.mostrati = PER_PAGINA;
        disegna();
        statoDrawer(false);
        document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
        return;
      }

      var voceMarca = e.target.closest('#brandList button[data-marca]');
      if (voceMarca) {
        stato.marca = voceMarca.dataset.marca;
        stato.mostrati = PER_PAGINA;
        disegna();
        document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
        return;
      }

      var c = e.target.closest('.card[data-id], .qres[data-id]');
      if (c) {
        if ($('#search').dataset.open === 'true') statoRicerca(false);
        apriScheda(c.dataset.id);
        return;
      }

      // Telegram non accetta un messaggio precompilato: copio il link del
      // prodotto negli appunti, cosi' il cliente lo incolla in chat.
      if (e.target.closest('#sheetTelegram')) {
        copiaLink();
        return;
      }

      if (e.target.closest('[data-sheet-close]')) chiudiScheda();
    });

    $('#filterInput').addEventListener('input', function (e) {
      stato.testo = e.target.value;
      stato.mostrati = PER_PAGINA;
      disegna();
    });

    $('#brandSelect').addEventListener('change', function (e) {
      stato.marca = e.target.value || null;
      stato.mostrati = PER_PAGINA;
      disegna();
    });

    $('#resetFilters').addEventListener('click', function () {
      stato.testo = ''; stato.marca = null; stato.mostrati = PER_PAGINA;
      $('#filterInput').value = '';
      $('#brandSelect').value = '';
      disegna();
    });

    $('#loadMore').addEventListener('click', function () {
      caricaAltri();
    });

    if (AUTO_SCROLL) {
      infiniteObserver = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) {
          caricaAltri();
        }
      }, { root: null, rootMargin: '700px 0px', threshold: 0 });
      infiniteObserver.observe($('#loadMoreWrap'));
    }

    $('#searchOpen').addEventListener('click', function () { statoRicerca(true); });
    $('#searchClose').addEventListener('click', function () { statoRicerca(false); });
    $('#searchInput').addEventListener('input', function (e) { disegnaRicerca(e.target.value); });

    $('#menuOpen').addEventListener('click', function () { statoDrawer(true); });
    $('#menuClose').addEventListener('click', function () { statoDrawer(false); });
    document.querySelectorAll('#drawer [data-close]').forEach(function (a) {
      a.addEventListener('click', function () { statoDrawer(false); });
    });

    $('#sheetShare').addEventListener('click', copiaLink);

    document.addEventListener('keydown', function (e) {
      var cardTarget = e.target.closest('.card[data-id]');
      if (cardTarget && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        apriScheda(cardTarget.dataset.id);
        return;
      }

      if (e.key !== 'Escape') return;
      if (sheet.dataset.open === 'true') chiudiScheda();
      else if ($('#search').dataset.open === 'true') statoRicerca(false);
      else if ($('#drawer').dataset.open === 'true') statoDrawer(false);
    });
  }

  /* --- Avvio ----------------------------------------------------------------- */
  function avvia() {
    if (!DATI.length) {
      $('#grid').innerHTML =
        '<div class="empty"><strong>Catalogo vuoto</strong><p>catalogo.js non contiene prodotti.</p></div>';
      return;
    }

    costruisciStatici();

    // Link in arrivo dalla home: ?marca=Nike
    var par = new URLSearchParams(location.search);
    var marca = par.get('marca');
    if (marca) {
      var trovata = MARCHE.filter(function (m) {
        return norm(m.nome) === norm(marca);
      })[0];
      if (trovata) stato.marca = trovata.nome;
    }

    disegna();
    collega();

    // Link diretto a una scheda: ?p=esempio-01
    var prod = par.get('p');
    if (prod) apriScheda(prod);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', avvia);
  } else {
    avvia();
  }
})();
