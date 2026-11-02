/* =============================================================================
   KICKSLAB — effetti condivisi (home e catalogo), nessuna dipendenza.
     1. HEADER     vetro dopo lo scroll
     2. TILT       card che si inclinano in 3D seguendo il mouse
     3. REVEAL     ingresso ruotato in prospettiva (.reveal -> .is-in)
     4. CILINDRO   marche su un tamburo 3D (#brandRing, solo home)
     5. SCATOLA    tocco sulla scatola 3D: pausa / riparte
     6. CURSORE    pallino acido che segue il mouse
   Tutto si spegne con prefers-reduced-motion o senza mouse dove serve.
   ========================================================================== */
(function () {
  'use strict';

  var RIDOTTO = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOUSE = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* --- 1. Header ------------------------------------------------------------ */
  var topbar = document.querySelector('.topbar');
  function aggiornaHeader() {
    if (topbar) topbar.classList.toggle('is-scrolled', window.scrollY > 40);
  }
  window.addEventListener('scroll', aggiornaHeader, { passive: true });
  aggiornaHeader();

  /* --- 2. Tilt -------------------------------------------------------------- */
  // Delegato sul documento: le card del catalogo vengono ridisegnate spesso.
  if (MOUSE && !RIDOTTO) {
    var attiva = null;

    var lascia = function (c) {
      c.classList.remove('is-tilting');
      c.style.setProperty('--rx', '0deg');
      c.style.setProperty('--ry', '0deg');
    };

    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest ? e.target.closest('.card') : null;
      if (attiva && attiva !== c) lascia(attiva);
      attiva = c;
      if (!c) return;
      var r = c.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      c.classList.add('is-tilting');
      c.style.setProperty('--ry', ((x - .5) * 16).toFixed(2) + 'deg');
      c.style.setProperty('--rx', ((.5 - y) * 14).toFixed(2) + 'deg');
      c.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    }, { passive: true });

    document.addEventListener('pointerleave', function () {
      if (attiva) { lascia(attiva); attiva = null; }
    });
  }

  /* --- 3. Reveal ------------------------------------------------------------ */
  var daRivelare = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && daRivelare.length) {
    var io = new IntersectionObserver(function (voci) {
      voci.forEach(function (v) {
        if (!v.isIntersecting) return;
        v.target.classList.add('is-in');
        io.unobserve(v.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    daRivelare.forEach(function (el, i) {
      // Le righe vicine entrano a cascata
      el.style.transitionDelay = (i % 3) * 0.08 + 's';
      io.observe(el);
    });
  } else {
    daRivelare.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* --- 4. Cilindro marche --------------------------------------------------- */
  var ring = document.getElementById('brandRing');
  var lista = document.getElementById('marcheHome');
  if (ring && lista) {
    var nomi = Array.prototype.map.call(lista.querySelectorAll('strong'), function (s) {
      return s.textContent;
    });

    ring.innerHTML = nomi.map(function (n) {
      return '<span class="ring__face">' + n.replace(/[<>&]/g, '') + '</span>';
    }).join('');
    var facce = Array.prototype.slice.call(ring.children);
    var passo = 360 / facce.length;
    var raggio = 0;

    // Il raggio dipende dalla faccia piu' larga: le scritte non si accavallano
    var misura = function () {
      var largh = facce.reduce(function (m, f) { return Math.max(m, f.offsetWidth); }, 0);
      raggio = (largh + 60) / (2 * Math.tan(Math.PI / facce.length));
      facce.forEach(function (f) {
        f.style.marginLeft = (-f.offsetWidth / 2) + 'px';
        f.style.marginTop = (-f.offsetHeight / 2) + 'px';
      });
    };

    var angolo = 0, spinta = 0, ultimoY = window.scrollY, visibile = false, ultimo = 0;

    var disegna = function (ora) {
      var dt = Math.min(0.05, (ora - (ultimo || ora)) / 1000);
      ultimo = ora;
      var dy = window.scrollY - ultimoY;
      ultimoY = window.scrollY;
      spinta = spinta * 0.92 + dy * 0.05;          // lo scroll da' una spinta
      angolo -= (RIDOTTO ? 2 : 10) * dt + spinta;

      // Niente rotateX: col centro cosi' profondo spingerebbe la faccia davanti fuori dallo stage
      ring.style.transform = 'translateZ(' + (-raggio).toFixed(0) + 'px) rotateY(' + angolo.toFixed(2) + 'deg)';
      facce.forEach(function (f, i) {
        var a = (i * passo + angolo) % 360;
        if (a < 0) a += 360;
        f.style.transform = 'rotateY(' + (i * passo) + 'deg) translateZ(' + raggio.toFixed(0) + 'px)';
        f.classList.toggle('is-front', a < passo / 2 || a > 360 - passo / 2);
      });
      if (visibile) requestAnimationFrame(disegna);
    };

    var avviaRing = function () {
      misura();
      new IntersectionObserver(function (voci) {
        var era = visibile;
        visibile = voci[0].isIntersecting;
        if (visibile && !era) { ultimo = 0; requestAnimationFrame(disegna); }
      }).observe(ring.parentNode);
      window.addEventListener('resize', misura);
    };

    // Aspetta il font: con quello di ripiego le larghezze sarebbero sbagliate
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(avviaRing);
    else avviaRing();
  }

  /* --- 5. Scatola 3D -------------------------------------------------------- */
  var scatola = document.querySelector('.box-stage');
  if (scatola) {
    scatola.addEventListener('click', function () {
      var ferma = scatola.dataset.paused === 'true';
      scatola.dataset.paused = String(!ferma);
      scatola.querySelectorAll('.box, .box__lid, .box__shoe').forEach(function (el) {
        el.style.animationPlayState = ferma ? '' : 'paused';
      });
    });
  }

  /* --- 6. Cursore ----------------------------------------------------------- */
  if (MOUSE && !RIDOTTO) {
    var punto = document.createElement('div');
    punto.className = 'cursor is-hidden';
    punto.setAttribute('aria-hidden', 'true');
    document.body.appendChild(punto);

    var cx = 0, cy = 0, tx = 0, ty = 0, giro = false;
    var segui = function () {
      cx += (tx - cx) * 0.25;
      cy += (ty - cy) * 0.25;
      punto.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      if (Math.abs(tx - cx) + Math.abs(ty - cy) > 0.2) requestAnimationFrame(segui);
      else giro = false;
    };

    document.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      punto.classList.remove('is-hidden');
      punto.classList.toggle('is-big', !!(e.target.closest &&
        e.target.closest('a, button, .card, select, input, [data-hot]')));
      if (!giro) { giro = true; requestAnimationFrame(segui); }
    }, { passive: true });
    document.addEventListener('pointerleave', function () { punto.classList.add('is-hidden'); });
  }
})();
