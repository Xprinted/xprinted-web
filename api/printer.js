/* assets/printer.js — Selector global "Tu impresora" · XPRINTED
   Se autoinyecta en la barra (>1180px) y en el menú móvil.
   Guarda xp_printer_name / xp_printer_kw en localStorage.
   Expone: window.xpOpenPrinterPicker(), window.xpRefreshPrinterBtn()
   Consume (si existen): window.xpOnPrinterChange(), window.xpHeroPickPaint()
*/
(function () {
  'use strict';

  var PRINTERS = [
    { name: 'Creality Ender-3 Series', kw: 'Ender 3', sub: 'Creality' },
    { name: 'Creality Ender 3 Neo / V2 Neo', kw: 'Ender 3', sub: 'Creality' },
    { name: 'Creality Ender 3 S1 / Pro / Plus', kw: 'Ender 3', sub: 'Creality' },
    { name: 'Creality Ender-3 V3 / V3 Plus / V3 SE / V3 KE', kw: 'Ender 3', sub: 'Creality' },
    { name: 'Creality Ender-5 Series / Ender-6 / Ender-7', kw: 'Ender 5', sub: 'Creality' },
    { name: 'Creality K1 / K2', kw: 'K1', sub: 'Creality' },
    { name: 'Creality Hi', kw: 'Creality', sub: 'Creality' },
    { name: 'Creality CR-10 (todas)', kw: 'CR-10', sub: 'Creality' },
    { name: 'Creality CR-6 / CR-5 / CR-20', kw: 'CR-6', sub: 'Creality' },
    { name: 'Bambu Lab A1 / A1 Mini', kw: 'A1', sub: 'Bambu Lab' },
    { name: 'Bambu Lab X1 / P1 (Series)', kw: 'X1', sub: 'Bambu Lab' },
    { name: 'Bambu Lab H2D', kw: 'H2D', sub: 'Bambu Lab' },
    { name: 'Anycubic Kobra 3 / Kobra S1', kw: 'Kobra', sub: 'Anycubic' },
    { name: 'Artillery Sidewinder X1 / X2 / X3 / X4 / Genius / Genius Pro', kw: 'Sidewinder', sub: 'Artillery' },
    { name: 'Prusa i3', kw: 'Prusa', sub: 'Prusa' },
    { name: 'Otras marcas', kw: '', sub: 'Anet · Geeetech · Tronxy · Tevo' }
  ];

  // Término de búsqueda por impresora. Debe coincidir con el mapa KW de index.html.
  function kwFor(name) {
    for (var i = 0; i < PRINTERS.length; i++) {
      if (PRINTERS[i].name === name) return PRINTERS[i].kw || '';
    }
    return '';
  }

  function getName() { try { return localStorage.getItem('xp_printer_name'); } catch (e) { return null; } }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-/·]/g, ' ');
  }

  /* ── estilos ── */
  var CSS = [
    '.xpp-navbtn{display:inline-flex;align-items:center;gap:8px;background:rgba(224,169,74,0.08);border:1px solid rgba(224,169,74,0.32);color:#F0F0EE;border-radius:9px;padding:8px 13px;font-family:var(--fb,Inter,sans-serif);font-size:0.8rem;cursor:pointer;white-space:nowrap;max-width:230px;transition:border-color .2s,background .2s;}',
    '.xpp-navbtn:hover{border-color:rgba(224,169,74,0.7);background:rgba(224,169,74,0.14);}',
    '.xpp-navbtn svg{width:15px;height:15px;flex-shrink:0;stroke:#E0A94A;fill:none;stroke-width:2;}',
    '.xpp-navbtn .xpp-lbl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.xpp-navbtn .xpp-lbl b{color:#E0A94A;font-weight:600;}',
    '@media(max-width:1180px){.xpp-navbtn{display:none;}}',
    '.xpp-mm{width:100%;text-align:left;background:none;border:none;border-bottom:1px solid rgba(255,255,255,0.07);color:#E0A94A;font-family:var(--fd,"Barlow Condensed",sans-serif);font-weight:700;font-size:1.5rem;text-transform:uppercase;letter-spacing:0.01em;padding:17px 6px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;}',
    '.xpp-mm::after{content:"\\2192";font-family:var(--fb,Inter,sans-serif);font-size:1rem;color:#E0A94A;}',
    '.xpp-mm small{display:block;font-family:var(--fb,Inter,sans-serif);font-size:0.72rem;font-weight:400;text-transform:none;letter-spacing:0;color:#8A8A8C;margin-top:3px;}',
    '.xpp-ov{position:fixed;inset:0;z-index:400;background:rgba(5,5,6,0.82);backdrop-filter:blur(6px);display:none;align-items:flex-start;justify-content:center;padding:70px 18px 30px;overflow-y:auto;}',
    '.xpp-ov.open{display:flex;}',
    '.xpp-box{width:100%;max-width:560px;background:linear-gradient(155deg,#16171a,#101012);border:1px solid #26272a;border-radius:14px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,0.6);animation:xppIn .22s ease;}',
    '@keyframes xppIn{from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:none;}}',
    '@media(prefers-reduced-motion:reduce){.xpp-box{animation:none;}}',
    '.xpp-hd{padding:20px 22px 14px;border-bottom:1px solid #222224;position:relative;}',
    '.xpp-hd h3{font-family:var(--fd,"Barlow Condensed",sans-serif);font-weight:700;font-size:1.5rem;text-transform:uppercase;color:#F0F0EE;line-height:1.1;}',
    '.xpp-hd h3 em{color:#E0A94A;font-style:normal;}',
    '.xpp-hd p{font-family:var(--fb,Inter,sans-serif);font-size:0.82rem;color:#8A8A8C;margin-top:4px;}',
    '.xpp-x{position:absolute;top:16px;right:16px;width:30px;height:30px;border-radius:8px;background:#191919;border:1px solid #222224;color:#8A8A8C;font-size:1.05rem;line-height:1;cursor:pointer;}',
    '.xpp-x:hover{color:#F0F0EE;border-color:#3A3A3C;}',
    '.xpp-sr{padding:14px 22px;border-bottom:1px solid #222224;}',
    '.xpp-sr input{width:100%;background:#0d0d0f;border:1px solid #222224;border-radius:9px;padding:11px 14px;color:#F0F0EE;font-family:var(--fb,Inter,sans-serif);font-size:0.9rem;outline:none;}',
    '.xpp-sr input:focus{border-color:rgba(224,169,74,0.5);}',
    '.xpp-sr input::placeholder{color:#5a5a5c;}',
    '.xpp-list{max-height:min(52vh,420px);overflow-y:auto;padding:8px;}',
    '.xpp-it{width:100%;text-align:left;background:none;border:1px solid transparent;border-radius:10px;padding:11px 13px;color:#e6e6e4;font-family:var(--fb,Inter,sans-serif);cursor:pointer;display:block;transition:background .15s,border-color .15s;}',
    '.xpp-it:hover,.xpp-it:focus-visible{background:rgba(224,169,74,0.07);border-color:rgba(224,169,74,0.28);outline:none;}',
    '.xpp-it.sel{background:rgba(224,169,74,0.1);border-color:rgba(224,169,74,0.45);}',
    '.xpp-it .xpp-n{display:block;font-size:0.92rem;line-height:1.25;}',
    '.xpp-it.sel .xpp-n{color:#E0A94A;}',
    '.xpp-it .xpp-s{display:block;font-family:var(--fm,monospace);font-size:0.66rem;color:#8A8A8C;text-transform:uppercase;letter-spacing:0.05em;margin-top:3px;}',
    '.xpp-empty{padding:22px 14px;text-align:center;color:#8A8A8C;font-size:0.85rem;font-family:var(--fb,Inter,sans-serif);}',
    '.xpp-ft{padding:13px 22px;border-top:1px solid #222224;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}',
    '.xpp-ft span{font-family:var(--fb,Inter,sans-serif);font-size:0.76rem;color:#8A8A8C;}',
    '.xpp-clr{background:none;border:1px solid #222224;border-radius:8px;color:#8A8A8C;font-family:var(--fb,Inter,sans-serif);font-size:0.78rem;padding:7px 13px;cursor:pointer;}',
    '.xpp-clr:hover{color:#F0F0EE;border-color:#3A3A3C;}',
    'body.xpp-lock{overflow:hidden;}'
  ].join('\n');

  var ICON = '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V4h12v5M6 18H4v-6h16v6h-2M8 14h8v7H8z"/></svg>';

  var ov = null, listEl = null, srchEl = null, navBtn = null, mmBtn = null;

  function build() {
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    ov = document.createElement('div');
    ov.className = 'xpp-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Elegí tu impresora');
    ov.innerHTML =
      '<div class="xpp-box">' +
        '<div class="xpp-hd">' +
          '<h3>¿Qué impresora <em>tenés?</em></h3>' +
          '<p>La recordamos para mostrarte solo lo compatible y para que el asistente sepa con qué trabajás.</p>' +
          '<button class="xpp-x" type="button" aria-label="Cerrar">✕</button>' +
        '</div>' +
        '<div class="xpp-sr"><input type="text" id="xpp-q" placeholder="Buscar modelo… (ej: ender 3, a1, k1)" autocomplete="off" aria-label="Buscar impresora"></div>' +
        '<div class="xpp-list" id="xpp-list"></div>' +
        '<div class="xpp-ft"><span>¿No la encontrás? Elegí <b>Otras marcas</b>.</span><button class="xpp-clr" type="button" id="xpp-clr">Quitar impresora</button></div>' +
      '</div>';
    document.body.appendChild(ov);

    listEl = ov.querySelector('#xpp-list');
    srchEl = ov.querySelector('#xpp-q');

    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.xpp-x').addEventListener('click', close);
    ov.querySelector('#xpp-clr').addEventListener('click', clear);
    srchEl.addEventListener('input', function () { paintList(srchEl.value); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov.classList.contains('open')) close();
    });
  }

  function paintList(q) {
    var cur = getName();
    var nq = norm(q || '').trim();
    var hits = PRINTERS.filter(function (p) {
      if (!nq) return true;
      return norm(p.name + ' ' + p.sub).indexOf(nq) !== -1;
    });
    if (!hits.length) {
      listEl.innerHTML = '<div class="xpp-empty">No encontramos ese modelo. Probá con menos palabras o elegí "Otras marcas".</div>';
      return;
    }
    listEl.innerHTML = hits.map(function (p) {
      var sel = (cur === p.name) ? ' sel' : '';
      return '<button class="xpp-it' + sel + '" type="button" data-n="' + esc(p.name) + '">' +
        '<span class="xpp-n">' + esc(p.name) + '</span>' +
        '<span class="xpp-s">' + esc(p.sub) + '</span></button>';
    }).join('');
    Array.prototype.forEach.call(listEl.querySelectorAll('.xpp-it'), function (b) {
      b.addEventListener('click', function () { choose(b.getAttribute('data-n')); });
    });
  }

  function open() {
    if (!ov) build();
    paintList('');
    srchEl.value = '';
    ov.classList.add('open');
    document.body.classList.add('xpp-lock');
    setTimeout(function () { try { srchEl.focus(); } catch (e) {} }, 40);
  }

  function close() {
    if (!ov) return;
    ov.classList.remove('open');
    document.body.classList.remove('xpp-lock');
  }

  function notify() {
    refreshBtn();
    if (typeof window.xpHeroPickPaint === 'function') { try { window.xpHeroPickPaint(); } catch (e) {} }
    if (typeof window.xpOnPrinterChange === 'function') { try { window.xpOnPrinterChange(); } catch (e) {} }
  }

  function onCatalogo() {
    return /\/catalogo\.html$/.test(location.pathname);
  }

  function choose(name) {
    try {
      localStorage.setItem('xp_printer_name', name);
      localStorage.setItem('xp_printer_kw', kwFor(name));
    } catch (e) {}
    close();
    if (onCatalogo()) {
      notify();
    } else {
      refreshBtn();
      if (typeof window.xpHeroPickPaint === 'function') { try { window.xpHeroPickPaint(); } catch (e) {} }
      try { sessionStorage.setItem('xp_apply_printer', '1'); } catch (e) {}
      location.href = '/catalogo.html';
    }
  }

  function clear() {
    try {
      localStorage.removeItem('xp_printer_name');
      localStorage.removeItem('xp_printer_kw');
    } catch (e) {}
    close();
    notify();
  }

  function refreshBtn() {
    var n = getName();
    if (navBtn) {
      navBtn.innerHTML = ICON + '<span class="xpp-lbl">' +
        (n ? 'Tu impresora: <b>' + esc(n) + '</b>' : 'Elegí tu impresora') + '</span>';
      navBtn.setAttribute('title', n ? 'Tu impresora: ' + n + ' — tocá para cambiarla' : 'Elegí tu impresora');
    }
    if (mmBtn) {
      mmBtn.innerHTML = '<span>' + (n ? 'Tu impresora' : 'Elegí tu impresora') +
        (n ? '<small>' + esc(n) + '</small>' : '<small>Te mostramos solo lo compatible</small>') + '</span>';
    }
  }

  function mount() {
    build();

    var nav = document.querySelector('header nav');
    if (nav) {
      navBtn = document.createElement('button');
      navBtn.className = 'xpp-navbtn';
      navBtn.type = 'button';
      navBtn.addEventListener('click', open);
      var cta = nav.querySelector('.nav-cta');
      if (cta) nav.insertBefore(navBtn, cta); else nav.appendChild(navBtn);
    }

    var mm = document.getElementById('mob-menu');
    if (mm) {
      mmBtn = document.createElement('button');
      mmBtn.className = 'xpp-mm';
      mmBtn.type = 'button';
      mmBtn.addEventListener('click', function () {
        // el menú móvil solo se cierra solo con <a>, así que lo cerramos a mano
        var burger = document.getElementById('nav-burger');
        mm.classList.remove('open');
        document.body.classList.remove('menu-open');
        if (burger) { burger.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
        open();
      });
      mm.insertBefore(mmBtn, mm.firstChild);
    }

    refreshBtn();
  }

  window.xpOpenPrinterPicker = open;
  window.xpRefreshPrinterBtn = refreshBtn;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
