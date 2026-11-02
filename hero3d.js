/* =============================================================================
   KICKSLAB — hero 3D (Three.js, modulo ES)
   -----------------------------------------------------------------------------
   Scena:
     - wordmark KICKSLAB estruso (strati di piani sovrapposti, fianchi acidi)
     - anello inclinato di scarpe su "cartellini" di vetro che ci orbita attraverso
     - pavimento a griglia che scorre, polvere luminosa, alone dietro la scritta
   Interazione:
     - mouse: parallasse della camera / trascinamento: gira l'anello
     - passaggio su una scarpa: etichetta; click o tocco: scheda nel catalogo
     - scroll: la camera sale e l'anello accelera
   Se WebGL manca o il CDN non risponde resta il fallback CSS (.hero3d__fallback).
   Le immagini sono in assets/hero/ (512px, generate dalle foto del catalogo).
   ========================================================================== */
import * as THREE from 'three';

/* --- Da modificare ---------------------------------------------------------- */
// id = scheda in catalogo.html?p=..., etichetta = testo al passaggio del mouse
const SCARPE = [
  { id: '221709069', etichetta: 'Jordan 1 Chicago',     img: 'aj1' },
  { id: '239423256', etichetta: 'Dunk SB Clear Jade',   img: 'dunk' },
  { id: '229930365', etichetta: 'Louis Vuitton Trainer', img: 'lv' },
  { id: '210562970', etichetta: 'Adidas Samba',         img: 'samba' },
  { id: '221594021', etichetta: 'New Balance 1906R',    img: 'nb' },
  { id: '245565811', etichetta: 'Travis Scott AJ1',     img: 'travis' },
  { id: '221557342', etichetta: "Prada America's Cup",  img: 'prada' },
  { id: '229928595', etichetta: 'Air Force 1',          img: 'af1' },
  { id: '244084744', etichetta: 'Jordan 4',             img: 'aj4' },
  { id: '221437073', etichetta: 'Balenciaga 3XL',       img: 'balenciaga' },
  { id: '242935046', etichetta: 'Off-White',            img: 'offwhite' },
  { id: '243965587', etichetta: 'Dior B30',             img: 'dior' },
  { id: '238131370', etichetta: 'Asics Kayano 14',      img: 'asics' },
  { id: '221707664', etichetta: 'Jordan 3 Black Cat',   img: 'aj3' }
];

const ACIDO = 0xd7ff2f;
const SFONDO = 0x0a0a0a;
const RAGGIO = 5.4;         // raggio dell'anello a dimensione piena
const TESTO_L = 9.6;        // larghezza del wordmark a dimensione piena
const STRATI = 16;          // spessore dell'estrusione

const hero = document.getElementById('hero');
const canvas = document.getElementById('heroCanvas');
const etichetta = document.getElementById('heroLabel');
const RIDOTTO = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --- Texture disegnate al volo -------------------------------------------- */
async function texWordmark() {
  try { await document.fonts.load('400 100px "Archivo Black"'); } catch (e) { /* font di ripiego */ }
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 512;
  const g = c.getContext('2d');
  let px = 380;
  const imposta = () => {
    g.font = `400 ${px}px "Archivo Black", Impact, sans-serif`;
    if ('letterSpacing' in g) g.letterSpacing = `${-px * 0.06}px`;
  };
  imposta();
  while (g.measureText('KICKSLAB').width > 1960 && px > 120) { px -= 10; imposta(); }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.fillText('KICKSLAB', 1024, 272);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function texCartellino(i, testo) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 400;
  const g = c.getContext('2d');
  const r = 26;
  g.beginPath();
  g.roundRect ? g.roundRect(4, 4, 312, 392, r) : g.rect(4, 4, 312, 392);
  const sf = g.createLinearGradient(0, 0, 320, 400);
  sf.addColorStop(0, 'rgba(255,255,255,0.10)');
  sf.addColorStop(1, 'rgba(255,255,255,0.02)');
  g.fillStyle = sf;
  g.fill();
  const bordo = g.createLinearGradient(0, 0, 320, 400);
  bordo.addColorStop(0, 'rgba(215,255,47,0.9)');
  bordo.addColorStop(0.5, 'rgba(215,255,47,0.15)');
  bordo.addColorStop(1, 'rgba(215,255,47,0.6)');
  g.strokeStyle = bordo;
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = 'rgba(243,240,232,0.55)';
  g.font = '800 18px Inter, Arial, sans-serif';
  g.fillText(String(i + 1).padStart(2, '0') + ' / ' + SCARPE.length, 24, 42);
  g.fillStyle = '#d7ff2f';
  g.font = '800 22px Inter, Arial, sans-serif';
  g.fillText(testo.toUpperCase().slice(0, 22), 24, 370);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texAlone() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(215,255,47,0.55)');
  gr.addColorStop(0.35, 'rgba(215,255,47,0.12)');
  gr.addColorStop(1, 'rgba(215,255,47,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/* --- Scena ------------------------------------------------------------------ */
async function avvia() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);

  const scena = new THREE.Scene();
  scena.fog = new THREE.Fog(SFONDO, 11, 30);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const mondo = new THREE.Group();          // tutto cio' che si scala con lo schermo
  scena.add(mondo);

  // Alone dietro la scritta
  const alone = new THREE.Sprite(new THREE.SpriteMaterial({ map: texAlone(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  alone.scale.set(18, 12, 1);
  alone.position.set(0, 0, -5);
  mondo.add(alone);

  // Wordmark estruso: lo strato davanti e' carta, quelli dietro sfumano dall'acido al nero
  const tex = await texWordmark();
  const parola = new THREE.Group();
  const geo = new THREE.PlaneGeometry(TESTO_L, TESTO_L / 4);
  const davanti = new THREE.Color(0xf3f0e8);
  const fianco = new THREE.Color(ACIDO);
  const fondo = new THREE.Color(0x1d2400);
  for (let i = STRATI - 1; i >= 0; i--) {
    const col = i === 0 ? davanti : fianco.clone().lerp(fondo, i / STRATI);
    const m = new THREE.MeshBasicMaterial({ map: tex, color: col, transparent: i === 0, alphaTest: i === 0 ? 0.02 : 0.5, depthWrite: i !== 0, fog: false });
    const strato = new THREE.Mesh(geo, m);
    strato.position.z = -i * 0.035;
    parola.add(strato);
  }
  mondo.add(parola);

  // Anello di scarpe
  const anello = new THREE.Group();
  anello.rotation.set(0.2, 0, -0.1);
  mondo.add(anello);

  const loader = new THREE.TextureLoader();
  const geoScarpa = new THREE.PlaneGeometry(2, 2);
  const geoCart = new THREE.PlaneGeometry(2.2, 2.75);
  const scarpe = [];       // mesh cliccabili
  const pezzi = [];        // { gruppo, scarpa, cart, angolo, dati }

  const caricate = await Promise.all(SCARPE.map((s) =>
    loader.loadAsync('assets/hero/' + s.img + '.webp').catch(() => null)));

  caricate.forEach((t, i) => {
    if (!t) return;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    const dati = SCARPE[i];
    const a = (i / SCARPE.length) * Math.PI * 2;
    const gruppo = new THREE.Group();
    gruppo.position.set(Math.sin(a) * RAGGIO, Math.sin(a * 3) * 0.35, Math.cos(a) * RAGGIO);
    gruppo.rotation.y = a;

    const cart = new THREE.Mesh(geoCart, new THREE.MeshBasicMaterial({ map: texCartellino(i, dati.etichetta), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    cart.position.z = -0.08;
    const scarpa = new THREE.Mesh(geoScarpa, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    scarpa.position.y = 0.12;
    scarpa.rotation.z = (i % 2 ? 1 : -1) * 0.12;
    scarpa.userData = dati;

    gruppo.add(cart, scarpa);
    anello.add(gruppo);
    scarpe.push(scarpa);
    pezzi.push({ gruppo, scarpa, cart, a, fase: i * 1.7, scala: 1 });
  });

  // Pavimento a griglia
  const griglia = new THREE.GridHelper(80, 80, ACIDO, 0x2a2d1c);
  griglia.material.transparent = true;
  griglia.material.opacity = 0.35;
  griglia.position.y = -3.4;
  mondo.add(griglia);

  // Polvere luminosa
  const N = 700;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 30;
    pos[i * 3 + 1] = Math.random() * 12 - 4;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 22 - 2;
  }
  const geoPolvere = new THREE.BufferGeometry();
  geoPolvere.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const polvere = new THREE.Points(geoPolvere, new THREE.PointsMaterial({ color: ACIDO, size: 0.045, transparent: true, opacity: 0.7, depthWrite: false }));
  mondo.add(polvere);

  /* --- Dimensioni: la scena sta nello spazio libero sopra titolo e pulsanti -- */
  // Altezza dell'anello (scarpe davanti comprese) a scala piena, in unita' 3D
  const ALTEZZA_SCENA = 6.4;
  const uiSopra = hero.querySelector('.hero3d__top');
  const uiSotto = hero.querySelector('.hero3d__bottom');
  let camZ = 13, scalaMondo = 1, kAnello = 1;
  function ridimensiona() {
    const w = hero.clientWidth, h = hero.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camZ = camera.aspect < 0.8 ? 15 : 13;
    // La nebbia segue la camera, altrimenti su telefono (camera piu' lontana) le scarpe spariscono
    scena.fog.near = camZ - 2;
    scena.fog.far = camZ + 17;
    // Su telefono l'anello e' piu' grande della scritta: le scarpe escono dai bordi, ma si vedono
    kAnello = camera.aspect < 0.8 ? 1.45 : 1;

    // Spazio libero in pixel tra i testi in alto e il blocco titolo + pulsanti
    const base = hero.getBoundingClientRect().top;
    const libSu = uiSopra.getBoundingClientRect().bottom - base + 8;
    const libGiu = uiSotto.getBoundingClientRect().top - base - 12;
    const libero = Math.max(120, libGiu - libSu);

    // Larghezza e altezza visibili a z=0, e quanti pixel vale un'unita' 3D
    const vistaH = 2 * camZ * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const vistaW = vistaH * camera.aspect;
    const pxUnita = h / vistaH;
    scalaMondo = Math.min(1, (vistaW * 0.94) / TESTO_L, libero / (ALTEZZA_SCENA * kAnello * pxUnita));
    mondo.scale.setScalar(scalaMondo);

    // Sposto l'inquadratura: il centro della scena finisce al centro dello spazio libero
    const sposta = h / 2 - (libSu + libero / 2);
    camera.setViewOffset(w, h, 0, sposta, w, h);
    camera.updateProjectionMatrix();
  }
  ridimensiona();
  // Osservo l'hero (barra del browser su telefono) e il blocco testi (caricamento del font)
  new ResizeObserver(ridimensiona).observe(hero);
  new ResizeObserver(ridimensiona).observe(uiSotto);

  /* --- Input ------------------------------------------------------------------ */
  const mouse = new THREE.Vector2(0, 0);       // -1..1 per la parallasse
  const ndc = new THREE.Vector2(9, 9);         // per il raycast
  const ray = new THREE.Raycaster();
  let trascina = false, ultimoX = 0, mosso = 0, velocita = 0, sopra = null;

  function aggiornaPuntatore(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    mouse.copy(ndc);
    etichetta.style.left = (e.clientX - r.left) + 'px';
    etichetta.style.top = (e.clientY - r.top) + 'px';
  }

  function colpita() {
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(scarpe, false)[0];
    return h ? h.object : null;
  }

  // L'interfaccia sta sopra il canvas: ascolto sull'hero e lascio passare link e bottoni
  hero.addEventListener('pointermove', (e) => {
    aggiornaPuntatore(e);
    if (trascina) {
      const dx = e.clientX - ultimoX;
      ultimoX = e.clientX;
      mosso += Math.abs(dx);
      velocita = dx * 0.004;
    }
  });
  hero.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button')) return;
    aggiornaPuntatore(e);
    trascina = true; ultimoX = e.clientX; mosso = 0;
  });
  window.addEventListener('pointerup', (e) => {
    if (!trascina) return;
    trascina = false;
    if (mosso < 8 && !e.target.closest('a, button')) {
      aggiornaPuntatore(e);
      const s = colpita();
      if (s) location.href = 'catalogo.html?p=' + encodeURIComponent(s.userData.id);
    }
  });
  hero.addEventListener('pointerleave', () => { ndc.set(9, 9); mouse.set(0, 0); });

  /* --- Ciclo ------------------------------------------------------------------ */
  const orologio = new THREE.Clock();
  let rot = 0, t = 0, attivo = false;
  const inizio = performance.now();
  const easeOut = (x) => 1 - Math.pow(1 - x, 4);
  const pos3 = new THREE.Vector3();

  function frame() {
    const dt = Math.min(orologio.getDelta(), 0.05);
    t += dt;
    const intro = easeOut(Math.min(1, (performance.now() - inizio) / 2200));
    const scroll = Math.min(1, window.scrollY / hero.clientHeight);

    // Hover sulle scarpe (non durante il trascinamento)
    const nuovo = trascina ? null : colpita();
    if (nuovo !== sopra) {
      sopra = nuovo;
      document.body.style.cursor = sopra ? 'pointer' : '';
      etichetta.classList.toggle('is-on', !!sopra);
      if (sopra) etichetta.textContent = sopra.userData.etichetta + ' →';
    }

    // Rotazione: automatica + trascinamento con inerzia + spinta dello scroll
    velocita *= 0.94;
    const auto = (RIDOTTO ? 0.03 : 0.16) * (sopra ? 0.15 : 1) * (1 + scroll * 3);
    rot += auto * dt + velocita + (1 - intro) * 0.06;
    anello.rotation.y = rot;
    anello.scale.setScalar((0.25 + 0.75 * intro) * kAnello);
    anello.rotation.x = 0.2 + scroll * 0.35 + mouse.y * 0.06;

    pezzi.forEach((p) => {
      p.gruppo.position.y = Math.sin(p.a * 3) * 0.35 + Math.sin(t * 1.2 + p.fase) * 0.12;
      const voluta = p.scarpa === sopra ? 1.22 : 1;
      p.scala += (voluta - p.scala) * 0.15;
      p.gruppo.scale.setScalar(p.scala);
      // Quelle dietro sfumano: profondita'
      p.gruppo.getWorldPosition(pos3);
      const davanti = THREE.MathUtils.clamp((pos3.z / (RAGGIO * scalaMondo * kAnello) + 1) / 2, 0, 1);
      p.scarpa.material.opacity = 0.35 + 0.65 * davanti;
      p.cart.material.opacity = 0.15 + 0.85 * davanti;
    });

    // Wordmark: entra da lontano e ondeggia piano
    parola.position.z = -8 * (1 - intro);
    parola.rotation.y = Math.sin(t * 0.4) * 0.08 + mouse.x * 0.12;
    parola.rotation.x = -mouse.y * 0.08;

    griglia.position.z = (t * 0.8) % 1;
    const p = geoPolvere.attributes.position;
    for (let i = 0; i < N; i++) {
      let y = p.array[i * 3 + 1] + dt * 0.25;
      if (y > 8) y = -4;
      p.array[i * 3 + 1] = y;
    }
    p.needsUpdate = true;

    // Camera: parallasse col mouse, sale e si avvicina con lo scroll
    const cx = mouse.x * 1.2;
    const cy = 0.9 + mouse.y * 0.6 + scroll * 2.4;
    camera.position.x += (cx - camera.position.x) * 0.05;
    camera.position.y += (cy - camera.position.y) * 0.05;
    camera.position.z += (camZ - scroll * 3 - camera.position.z) * 0.08;
    camera.lookAt(0, 0, 0);

    renderer.render(scena, camera);
  }

  // Disegna solo quando l'hero si vede e la scheda e' in primo piano
  function aggiornaCiclo(v) {
    const vuole = v && !document.hidden;
    if (vuole === attivo) return;
    attivo = vuole;
    orologio.getDelta();
    renderer.setAnimationLoop(attivo ? frame : null);
  }
  let visibile = true;
  new IntersectionObserver((voci) => { visibile = voci[0].isIntersecting; aggiornaCiclo(visibile); }).observe(hero);
  document.addEventListener('visibilitychange', () => aggiornaCiclo(visibile));

  camera.position.set(0, 0.9, camZ + 4);
  aggiornaCiclo(true);
  hero.classList.add('is-ready');
}

avvia().catch((err) => {
  // Niente WebGL o errore di caricamento: resta il fallback CSS
  hero.classList.remove('is-ready');
  console.warn('KICKSLAB hero 3D non disponibile:', err);
});
