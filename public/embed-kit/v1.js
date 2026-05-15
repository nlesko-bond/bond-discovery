/* Bond Discovery embed kit v1 — iframe-free mount. API: BondDiscovery.init({ mount, slug?, baseUrl?, portalTemplate?, theme?: { mode, accent } }); auto-init: [data-bond-discovery][data-bond-slug]. */
(function (global) {
  'use strict';

  var MAX_SCHEDULE_ROWS = 40;
  var HERO_CARD_MIN_WIDTH_PX = 260;
  var HERO_SECTION_GAP_PX = 16;

  function getKitOrigin() {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src;
      if (src && src.indexOf('/embed-kit/v1') !== -1) {
        return new URL(src).origin;
      }
    }
    return '';
  }

  function buildRegistrationUrl(linkSEO, options) {
    if (!linkSEO) return undefined;
    if (options && options.isRegistrationOpen === false) {
      return linkSEO;
    }
    try {
      var url = new URL(linkSEO);
      if (!options || options.skipToProducts !== false) {
        url.searchParams.set('skipToProducts', 'true');
      }
      if (options && options.productId) {
        url.searchParams.set('productId', String(options.productId));
      }
      return url.toString();
    } catch (e) {
      if (linkSEO.indexOf('?') === -1) {
        return (
          linkSEO +
          '?skipToProducts=true' +
          (options && options.productId ? '&productId=' + encodeURIComponent(String(options.productId)) : '')
        );
      }
      return (
        linkSEO +
        '&skipToProducts=true' +
        (options && options.productId ? '&productId=' + encodeURIComponent(String(options.productId)) : '')
      );
    }
  }

  function getSessions(program) {
    return program.sessions || [];
  }

  function allSessionsRegistrationClosed(program) {
    var sessions = getSessions(program);
    if (!sessions.length) return false;
    return sessions.every(function (s) {
      var st = s.registrationWindowStatus;
      return st === 'closed' || st === 'ended';
    });
  }

  function linkTarget(linkBehavior) {
    if (linkBehavior === 'same_window') return '_top';
    if (linkBehavior === 'in_frame') return '_self';
    return '_blank';
  }

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === 'style' && props.style && typeof props.style === 'object') {
          Object.assign(node.style, props.style);
        } else if (k === 'className') {
          node.className = props[k];
        } else if (k === 'text') {
          node.textContent = props[k];
        } else if (k.slice(0, 2) === 'on' && typeof props[k] === 'function') {
          node.addEventListener(k.slice(2), props[k]);
        } else if (k === 'href' || k === 'target' || k === 'rel') {
          node.setAttribute(k, props[k]);
        } else {
          node.setAttribute(k, props[k]);
        }
      });
    }
    (children || []).forEach(function (c) {
      if (c) node.appendChild(c);
    });
    return node;
  }

  function mergeThemeBranding(branding, theme) {
    var b = branding || {};
    if (!theme) return b;
    if (theme.accent) {
      return Object.assign({}, b, { accentColor: theme.accent });
    }
    return b;
  }

  function themeExtraCss(theme) {
    if (!theme || theme.mode !== 'light') return '';
    return (
      '.bd-hero{background:#f1f5f9;color:#0f172a}' +
      '.bd-filters select{border-color:#cbd5e1;background:#fff;color:#111}' +
      '.bd-root .bd-card-h{background:linear-gradient(135deg,var(--bd-primary),#334155)}'
    );
  }

  function baseStyles(branding, theme) {
    var merged = mergeThemeBranding(branding, theme);
    var primary = merged.primaryColor || '#1E2761';
    var accent = merged.accentColor || merged.secondaryColor || '#6366F1';
    return (
      ':host{--bd-primary:' +
      primary +
      ';--bd-accent:' +
      accent +
      ';display:block;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-sizing:border-box}' +
      ':host *,:host *::before,:host *::after{box-sizing:border-box}' +
      '.bd-root{color:#111;line-height:1.4}' +
      '.bd-hero{background:#0f0f10;color:#fff;padding:2rem 1.25rem 1.5rem;border-radius:12px;margin-bottom:' +
      HERO_SECTION_GAP_PX +
      'px}' +
      '.bd-hero h2{margin:0 0 0.5rem;font-size:1.35rem;letter-spacing:0.04em;text-transform:uppercase}' +
      '.bd-accent-bar{width:3rem;height:4px;background:var(--bd-accent);margin-bottom:1rem}' +
      '.bd-filters{display:flex;flex-wrap:wrap;gap:0.75rem;margin-top:1rem}' +
      '.bd-filters select{min-width:10rem;padding:0.45rem 0.6rem;border-radius:6px;border:1px solid rgba(255,255,255,0.35);background:rgba(0,0,0,0.35);color:#fff}' +
      '.bd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(' +
      HERO_CARD_MIN_WIDTH_PX +
      'px,1fr));gap:1rem}' +
      '.bd-card{border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff}' +
      '.bd-card-h{padding:1rem;background:linear-gradient(135deg,var(--bd-primary),#111827);color:#fff;min-height:5rem}' +
      '.bd-card-b{padding:1rem}' +
      '.bd-title{font-weight:700;font-size:1rem;margin:0 0 0.35rem}' +
      '.bd-meta{font-size:0.8rem;opacity:0.85}' +
      '.bd-actions{margin-top:0.75rem}' +
      '.bd-btn{display:inline-flex;align-items:center;justify-content:center;padding:0.55rem 1rem;border-radius:8px;font-weight:600;text-decoration:none;background:var(--bd-primary);color:#fff;border:none;cursor:pointer;font-size:0.9rem}' +
      '.bd-btn.secondary{background:#6b7280}' +
      '.bd-carousel{display:flex;gap:1rem;overflow-x:auto;padding-bottom:0.5rem;scroll-snap-type:x mandatory}' +
      '.bd-carousel .bd-card{min-width:' +
      HERO_CARD_MIN_WIDTH_PX +
      'px;max-width:320px;flex:0 0 auto;scroll-snap-align:start}' +
      '.bd-table{width:100%;border-collapse:collapse;font-size:0.85rem}' +
      '.bd-table th,.bd-table td{border:1px solid #e5e7eb;padding:0.45rem 0.5rem;text-align:left}' +
      '.bd-table th{background:#f3f4f6}' +
      '.bd-foot{margin-top:1rem;font-size:0.85rem}' +
      '.bd-foot a{color:var(--bd-accent)}' +
      themeExtraCss(theme)
    );
  }

  function programRegisterHref(program, boot) {
    if (boot.features.hideRegistrationLinks) return null;
    if (boot.features.customRegistrationUrl) return boot.features.customRegistrationUrl;
    if (!program.linkSEO) return null;
    var closed = allSessionsRegistrationClosed(program);
    return buildRegistrationUrl(program.linkSEO, { isRegistrationOpen: !closed });
  }

  function renderProgramCard(program, boot, t) {
    var href = programRegisterHref(program, boot);
    var facility =
      program.facilityName ||
      (program.sessions && program.sessions[0] && program.sessions[0].facility && program.sessions[0].facility.name) ||
      '';
    var sport = program.sport || '';
    var actions = el('div', { className: 'bd-actions' });
    if (href) {
      actions.appendChild(
        el('a', {
          className: 'bd-btn' + (allSessionsRegistrationClosed(program) ? ' secondary' : ''),
          href: href,
          target: t,
          rel: 'noopener noreferrer',
          text: allSessionsRegistrationClosed(program) ? 'More info' : 'Register',
        }),
      );
    }
    return el('div', { className: 'bd-card' }, [
      el('div', { className: 'bd-card-h' }, [
        el('div', { className: 'bd-meta', text: (sport || 'Program').toUpperCase() }),
        el('h3', { className: 'bd-title', text: program.name || 'Program' }),
      ]),
      el('div', { className: 'bd-card-b' }, [
        facility ? el('div', { className: 'bd-meta', text: facility }) : el('span'),
        actions,
      ]),
    ]);
  }

  function uniqueStrings(arr) {
    var seen = {};
    var out = [];
    arr.forEach(function (s) {
      if (!s || seen[s]) return;
      seen[s] = true;
      out.push(s);
    });
    return out.sort();
  }

  function filterPrograms(programs, sport, facility, ptype) {
    return programs.filter(function (p) {
      if (sport && (p.sport || '') !== sport) return false;
      if (ptype && (p.type || '') !== ptype) return false;
      if (facility) {
        var fn =
          p.facilityName ||
          (p.sessions && p.sessions[0] && p.sessions[0].facility && p.sessions[0].facility.name) ||
          '';
        if (fn !== facility) return false;
      }
      return true;
    });
  }

  function mountClassic(shadow, programs, boot) {
    var t = linkTarget(boot.features.linkBehavior);
    var grid = el('div', { className: 'bd-grid' });
    programs.forEach(function (p) {
      grid.appendChild(renderProgramCard(p, boot, t));
    });
    shadow.appendChild(el('div', { className: 'bd-root' }, [grid, footerLinks(boot)]));
  }

  function mountHeroCarousel(shadow, programs, boot) {
    var t = linkTarget(boot.features.linkBehavior);
    var sports = uniqueStrings(programs.map(function (p) { return p.sport || ''; }));
    var facilities = uniqueStrings(
      programs.map(function (p) {
        return (
          p.facilityName ||
          (p.sessions && p.sessions[0] && p.sessions[0].facility && p.sessions[0].facility.name) ||
          ''
        );
      }),
    );
    var types = uniqueStrings(programs.map(function (p) { return p.type || ''; }));

    var state = { sport: '', facility: '', ptype: '' };

    var selSport = el('select', {});
    selSport.appendChild(el('option', { value: '', text: 'All sports' }));
    sports.forEach(function (s) {
      selSport.appendChild(el('option', { value: s, text: s }));
    });

    var selFac = el('select', {});
    selFac.appendChild(el('option', { value: '', text: 'All locations' }));
    facilities.forEach(function (s) {
      selFac.appendChild(el('option', { value: s, text: s }));
    });

    var selType = el('select', {});
    selType.appendChild(el('option', { value: '', text: 'All programs' }));
    types.forEach(function (s) {
      selType.appendChild(el('option', { value: s, text: s }));
    });

    var carousel = el('div', { className: 'bd-carousel' });

    function redraw() {
      while (carousel.firstChild) carousel.removeChild(carousel.firstChild);
      var list = filterPrograms(programs, state.sport, state.facility, state.ptype);
      list.forEach(function (p) {
        carousel.appendChild(renderProgramCard(p, boot, t));
      });
    }

    function onChange() {
      state.sport = selSport.value;
      state.facility = selFac.value;
      state.ptype = selType.value;
      redraw();
    }
    selSport.addEventListener('change', onChange);
    selFac.addEventListener('change', onChange);
    selType.addEventListener('change', onChange);

    redraw();

    var hero = el('div', { className: 'bd-hero' }, [
      el('div', { className: 'bd-accent-bar' }),
      el('h2', { text: 'Upcoming programs' }),
      el('div', { className: 'bd-filters' }, [selSport, selFac, selType]),
    ]);

    shadow.appendChild(
      el('div', { className: 'bd-root' }, [hero, carousel, footerLinks(boot)]),
    );
  }

  function footerLinks(boot) {
    var full = boot.paths.fullDiscoveryUrl;
    var iframe = boot.paths.embedIframeUrl;
    return el('div', { className: 'bd-foot' }, [
      el('span', { text: 'Open full discovery: ' }),
      el('a', { href: full, target: '_blank', rel: 'noopener noreferrer', text: full }),
      el('span', { text: ' · Legacy iframe: ' }),
      el('a', { href: iframe, target: '_blank', rel: 'noopener noreferrer', text: 'embed' }),
    ]);
  }

  function mountScheduleFirst(shadow, programs, boot, origin) {
    var t = linkTarget(boot.features.linkBehavior);
    var wrap = el('div', { className: 'bd-root' });
    var title = el('h2', { className: 'bd-title', text: 'Schedule' });
    var tableHost = el('div', {});

    wrap.appendChild(title);
    wrap.appendChild(tableHost);
    wrap.appendChild(el('h3', { className: 'bd-title', style: { marginTop: '1.25rem' }, text: 'Programs' }));
    var grid = el('div', { className: 'bd-grid' });
    programs.forEach(function (p) {
      grid.appendChild(renderProgramCard(p, boot, t));
    });
    wrap.appendChild(grid);
    wrap.appendChild(footerLinks(boot));
    shadow.appendChild(wrap);

    fetch(origin + '/api/events?slug=' + encodeURIComponent(boot.slug))
      .then(function (r) { return r.json(); })
      .then(function (json) {
        var rows = (json && json.data) || [];
        var slice = rows.slice(0, MAX_SCHEDULE_ROWS);
        var table = el('table', { className: 'bd-table' });
        table.appendChild(
          el('tr', {}, [
            el('th', { text: 'Date' }),
            el('th', { text: 'Program' }),
            el('th', { text: 'Action' }),
          ]),
        );
        slice.forEach(function (ev) {
          var href = ev.linkSEO
            ? buildRegistrationUrl(ev.linkSEO, {
                isRegistrationOpen: ev.registrationWindowStatus === 'open',
              })
            : null;
          var link = href
            ? el('a', {
                className: 'bd-btn',
                href: href,
                target: t,
                rel: 'noopener noreferrer',
                text: 'Register',
              })
            : el('span', { text: '—' });
          table.appendChild(
            el('tr', {}, [
              el('td', { text: String(ev.date || '') }),
              el('td', { text: String(ev.programName || ev.title || '') }),
              el('td', {}, [link]),
            ]),
          );
        });
        tableHost.appendChild(table);
      })
      .catch(function () {
        tableHost.appendChild(el('p', { text: 'Schedule could not be loaded.' }));
      });
  }

  function init(options) {
    var mount =
      typeof options.mount === 'string'
        ? document.querySelector(options.mount)
        : options.mount;
    var slug = options.slug || (mount && mount.getAttribute('data-bond-slug'));
    if (!mount || !slug) {
      console.error('BondDiscovery.init: mount element and slug are required');
      return;
    }

    var origin = options.baseUrl || getKitOrigin();
    if (!origin) {
      console.error('BondDiscovery.init: could not resolve kit origin; pass baseUrl');
      return;
    }

    if (mount.getAttribute('data-bond-initialized') === '1') {
      return;
    }
    mount.setAttribute('data-bond-initialized', '1');

    mount.textContent = '';

    var shadow = mount.attachShadow({ mode: 'open' });
    var style = el('style', { text: baseStyles({}, null) });
    shadow.appendChild(style);

    function readThemeFromMount(m, optTheme) {
      var t = optTheme ? Object.assign({}, optTheme) : {};
      try {
        var raw = m.getAttribute('data-bond-theme');
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            Object.assign(t, parsed);
          }
        }
      } catch (e) {}
      return Object.keys(t).length ? t : null;
    }

    var portalForBootstrap =
      options.portalTemplate || mount.getAttribute('data-bond-portal') || '';
    var bootstrapUrl =
      origin + '/api/embed/bootstrap?slug=' + encodeURIComponent(slug);
    if (portalForBootstrap) {
      bootstrapUrl += '&portal=' + encodeURIComponent(portalForBootstrap);
    }

    Promise.all([
      fetch(bootstrapUrl).then(function (r) {
        return r.json();
      }),
      fetch(origin + '/api/embed/programs?slug=' + encodeURIComponent(slug)).then(function (r) {
        return r.json();
      }),
    ])
      .then(function (pair) {
        var boot = pair[0];
        var prog = pair[1];
        if (boot.error) throw new Error(boot.error);
        if (prog.error) throw new Error(prog.error);
        var programs = prog.data || [];
        var theme = readThemeFromMount(mount, options.theme);
        shadow.querySelector('style').textContent = baseStyles(
          boot.branding || {},
          theme,
        );
        var template =
          options.portalTemplate ||
          boot.features.embedPortalTemplate ||
          'classic';
        if (template === 'hero-carousel') {
          mountHeroCarousel(shadow, programs, boot);
        } else if (template === 'schedule-first') {
          mountScheduleFirst(shadow, programs, boot, origin);
        } else {
          mountClassic(shadow, programs, boot);
        }
      })
      .catch(function (err) {
        while (shadow.firstChild) {
          shadow.removeChild(shadow.firstChild);
        }
        shadow.appendChild(style);
        shadow.appendChild(
          el('div', { className: 'bd-root' }, [
            el('p', { text: 'Discovery could not be loaded.' }),
            el('pre', {
              style: { color: '#b91c1c', fontSize: '12px' },
              text: String(err && err.message ? err.message : err),
            }),
          ]),
        );
      });
  }

  function runAutoInit() {
    var nodes = document.querySelectorAll('[data-bond-discovery][data-bond-slug]');
    for (var j = 0; j < nodes.length; j++) {
      var node = nodes[j];
      if (node.getAttribute('data-bond-initialized') === '1') continue;
      init({
        mount: node,
        slug: node.getAttribute('data-bond-slug') || undefined,
        baseUrl: node.getAttribute('data-bond-base') || undefined,
        portalTemplate: node.getAttribute('data-bond-portal') || undefined,
        theme: (function () {
          try {
            var raw = node.getAttribute('data-bond-theme');
            return raw ? JSON.parse(raw) : undefined;
          } catch (e) {
            return undefined;
          }
        })(),
      });
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runAutoInit);
    } else {
      runAutoInit();
    }
  }

  global.BondDiscovery = { init: init };
})(typeof window !== 'undefined' ? window : this);
