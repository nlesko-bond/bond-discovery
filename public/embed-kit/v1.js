/* Bond Discovery embed kit v1 — iframe-free mount. API: BondDiscovery.init({ mount, slug?, baseUrl?, portalTemplate?, theme?: { mode, accent } }); auto-init: [data-bond-discovery][data-bond-slug]. */
(function (global) {
  'use strict';

  var MAX_SCHEDULE_ROWS = 50;
  var HERO_CARD_MIN_WIDTH_PX = 300;
  var HERO_SECTION_GAP_PX = 16;
  var CARD_MEDIA_HEIGHT_REM = 11;
  var DESCRIPTION_PREVIEW_CHARS = 220;
  var SCHEDULE_FETCH_ROWS = 120;
  var SCHEDULE_DEEP_LINK_VIEW = 'list';
  var MAX_DRAWER_EVENTS = 40;
  var MOBILE_STACKED_SCHEDULE_MAX_WIDTH_PX = 720;
  var OVERLAY_Z_INDEX = 2147483000;
  var EMBED_MODAL_MAX_WIDTH_REM = 56;
  var EMBED_MODAL_MAX_HEIGHT_REM = 52;
  var EMBED_MODAL_VIEWPORT_WIDTH_CAP_PCT = 96;
  var EMBED_MODAL_VIEWPORT_HEIGHT_CAP_PCT = 90;

  var embedProgramsByMount = new WeakMap();

  var PROGRAM_TYPE_LABELS = {
    class: 'Class',
    clinic: 'Clinic',
    camp: 'Camp',
    lesson: 'Lesson',
    league: 'League',
    tournament: 'Tournament',
    club_team: 'Club team',
    drop_in: 'Drop-in',
    rental: 'Rental',
  };

  var SPORT_GRADIENTS = {
    soccer: 'linear-gradient(135deg,#22c55e 0%,#059669 100%)',
    football: 'linear-gradient(135deg,#d97706 0%,#c2410c 100%)',
    basketball: 'linear-gradient(135deg,#f97316 0%,#dc2626 100%)',
    tennis: 'linear-gradient(135deg,#eab308 0%,#84cc16 100%)',
    yoga: 'linear-gradient(135deg,#a855f7 0%,#7c3aed 100%)',
    fitness: 'linear-gradient(135deg,#3b82f6 0%,#4f46e5 100%)',
    swimming: 'linear-gradient(135deg,#06b6d4 0%,#2563eb 100%)',
    baseball: 'linear-gradient(135deg,#ef4444 0%,#e11d48 100%)',
    volleyball: 'linear-gradient(135deg,#ec4899 0%,#f43f5e 100%)',
    hockey: 'linear-gradient(135deg,#64748b 0%,#334155 100%)',
    lacrosse: 'linear-gradient(135deg,#2563eb 0%,#312e81 100%)',
  };

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
    if (linkBehavior === 'in_frame') return '_blank';
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
        } else if (
          k === 'href' ||
          k === 'target' ||
          k === 'rel' ||
          k === 'role' ||
          k === 'ariaSelected' ||
          k === 'ariaPressed'
        ) {
          if (k === 'ariaSelected') {
            node.setAttribute('aria-selected', props[k] ? 'true' : 'false');
          } else if (k === 'ariaPressed') {
            node.setAttribute('aria-pressed', props[k] ? 'true' : 'false');
          } else {
            node.setAttribute(k, props[k]);
          }
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
      '.bd-shell{background:#f8fafc}' +
      '.bd-toolbar .bd-select{border-color:#cbd5e1;background:#fff;color:#0f172a}' +
      '.bd-search{border-color:#cbd5e1;background:#fff;color:#0f172a}'
    );
  }

  function upcomingSessionCount(program) {
    var sessions = getSessions(program);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return sessions.filter(function (s) {
      if (!s.endDate) return true;
      try {
        return new Date(s.endDate) >= today;
      } catch (e) {
        return true;
      }
    }).length;
  }

  function renderEmptyState(title, message) {
    return el('div', { className: 'bd-empty' }, [
      el('div', { className: 'bd-empty-mark', 'aria-hidden': 'true' }),
      el('h3', { text: title }),
      el('p', { text: message }),
    ]);
  }

  function renderLoadingLine(text) {
    return el('div', { className: 'bd-loading' }, [
      el('div', { className: 'bd-skeleton bd-skeleton--line' }),
      el('p', { text: text || 'Loading\u2026' }),
    ]);
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
      ';--bd-primary-soft:color-mix(in srgb,' +
      primary +
      ' 12%,#fff);--bd-accent-soft:color-mix(in srgb,' +
      accent +
      ' 14%,#fff);--bd-surface:#fff;--bd-surface-muted:#f8fafc;--bd-border:#e2e8f0;--bd-text:#0f172a;--bd-text-muted:#64748b;--bd-shadow-sm:0 1px 2px rgba(15,23,42,0.06);--bd-shadow-md:0 8px 24px rgba(15,23,42,0.08);--bd-shadow-lg:0 16px 40px rgba(15,23,42,0.12);--bd-radius:1rem;--bd-radius-sm:0.65rem;display:block;font-family:var(--bd-host-font,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);font-size:var(--bd-host-font-size,1rem);color:var(--bd-host-color,var(--bd-text));box-sizing:border-box;-webkit-font-smoothing:antialiased}' +
      ':host *,:host *::before,:host *::after{box-sizing:border-box}' +
      '.bd-shell{background:linear-gradient(180deg,var(--bd-surface-muted) 0%,#eef2f7 100%);color:inherit;line-height:1.5;min-width:0;border-radius:16px;overflow:hidden;border:1px solid var(--bd-border);box-shadow:var(--bd-shadow-md)}' +
      '.bd-top{position:relative;border-bottom:1px solid var(--bd-border);background:var(--bd-surface);padding:1.1rem 1.35rem;display:flex;align-items:center;gap:0.85rem;flex-wrap:wrap}' +
      '.bd-top::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--bd-primary),var(--bd-accent))}' +
      '.bd-top img{max-height:44px;max-width:200px;object-fit:contain}' +
      '.bd-top-copy{min-width:0;flex:1}' +
      '.bd-top h1{margin:0;font-size:1.2rem;font-weight:800;color:var(--bd-text);letter-spacing:-0.02em;line-height:1.2}' +
      '.bd-top-tagline{margin:0.2rem 0 0;font-size:0.8125rem;color:var(--bd-text-muted);font-weight:500}' +
      '.bd-tabs-wrap{padding:0.85rem 1.25rem 0;background:var(--bd-surface)}' +
      '.bd-tabs{display:inline-flex;gap:0.25rem;padding:0.25rem;background:var(--bd-surface-muted);border:1px solid var(--bd-border);border-radius:999px}' +
      '.bd-tabs--full{width:100%;max-width:22rem}' +
      '.bd-tab{flex:1;padding:0.55rem 1.1rem;border:none;background:transparent;font:inherit;font-weight:700;font-size:0.875rem;color:var(--bd-text-muted);cursor:pointer;border-radius:999px;transition:background 0.15s,color 0.15s,box-shadow 0.15s}' +
      '.bd-tab[aria-selected="true"]{background:var(--bd-surface);color:var(--bd-primary);box-shadow:var(--bd-shadow-sm)}' +
      '.bd-panel{padding:1.15rem 1.35rem 1.65rem;display:none;background:transparent}' +
      '.bd-panel.bd-panel--active{display:block}' +
      '.bd-section-title{margin:0 0 0.85rem;font-size:1.05rem;font-weight:800;color:var(--bd-text);letter-spacing:-0.02em}' +
      '.bd-toolbar{display:flex;flex-wrap:wrap;gap:0.6rem;align-items:stretch;margin-bottom:1rem;padding:0.85rem;background:var(--bd-surface);border:1px solid var(--bd-border);border-radius:var(--bd-radius);box-shadow:var(--bd-shadow-sm)}' +
      '.bd-search{flex:1 1 12rem;min-height:2.85rem;padding:0.55rem 1rem 0.55rem 2.35rem;border-radius:999px;border:1px solid var(--bd-border);font:inherit;background:var(--bd-surface-muted) url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\'%3E%3Ccircle cx=\'7\' cy=\'7\' r=\'5\'/%3E%3Cpath d=\'M11 11l3 3\'/%3E%3C/svg%3E") no-repeat 0.85rem center;transition:border-color 0.15s,box-shadow 0.15s,background 0.15s}' +
      '.bd-search:focus{outline:none;border-color:var(--bd-accent);box-shadow:0 0 0 3px var(--bd-accent-soft);background-color:var(--bd-surface)}' +
      '.bd-select{flex:1 1 8rem;min-height:2.85rem;padding:0.5rem 2rem 0.5rem 0.9rem;border-radius:999px;border:1px solid var(--bd-border);font:inherit;font-weight:600;font-size:0.8125rem;background:var(--bd-surface) url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' fill=\'%2364748b\'%3E%3Cpath d=\'M1 1l5 5 5-5\'/%3E%3C/svg%3E") no-repeat right 0.85rem center;cursor:pointer;color:var(--bd-text)}' +
      '.bd-results-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.5rem;margin:0 0 1rem}' +
      '.bd-results{font-size:0.875rem;color:var(--bd-text-muted);margin:0}' +
      '.bd-results strong{color:var(--bd-text);font-weight:800}' +
      '.bd-results-pill{font-size:0.75rem;font-weight:700;padding:0.25rem 0.65rem;border-radius:999px;background:var(--bd-primary-soft);color:var(--bd-primary)}' +
      '.bd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(' +
      HERO_CARD_MIN_WIDTH_PX +
      'px,1fr));gap:1.35rem}' +
      '.bd-card{border:1px solid var(--bd-border);border-radius:var(--bd-radius);overflow:hidden;background:var(--bd-surface);box-shadow:var(--bd-shadow-sm);transition:box-shadow 0.25s,transform 0.25s,border-color 0.25s;display:flex;flex-direction:column;height:100%}' +
      '.bd-card:hover{box-shadow:var(--bd-shadow-lg);transform:translateY(-3px);border-color:#cbd5e1}' +
      '.bd-card-media{position:relative;height:' +
      CARD_MEDIA_HEIGHT_REM +
      'rem;background:#e2e8f0;overflow:hidden;flex-shrink:0}' +
      '.bd-card-media img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.45s ease}' +
      '.bd-card:hover .bd-card-media img{transform:scale(1.04)}' +
      '.bd-card-media-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(15,23,42,0.72) 0%,rgba(15,23,42,0.15) 45%,transparent 70%);pointer-events:none}' +
      '.bd-card-media--grad{position:absolute;inset:0}' +
      '.bd-card-badges{position:absolute;top:0.75rem;left:0.75rem;z-index:2;display:flex;flex-wrap:wrap;gap:0.35rem}' +
      '.bd-card-badges--foot{top:auto;bottom:0.75rem;left:0.75rem;right:0.75rem;align-items:flex-end;justify-content:space-between}' +
      '.bd-badge{font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;padding:0.3rem 0.55rem;border-radius:999px;background:rgba(255,255,255,0.96);color:#1e293b;box-shadow:0 1px 3px rgba(0,0,0,0.08);backdrop-filter:blur(6px)}' +
      '.bd-badge--dark{background:rgba(15,23,42,0.55);color:#fff}' +
      '.bd-badge--urgent{background:#dc2626;color:#fff}' +
      '.bd-card-body{padding:1.15rem 1.2rem 1.2rem;display:flex;flex-direction:column;flex:1;gap:0.35rem}' +
      '.bd-card-title{margin:0;font-size:1.0625rem;font-weight:800;color:var(--bd-text);line-height:1.3;letter-spacing:-0.02em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
      '.bd-card-facility{font-size:0.8125rem;color:var(--bd-text-muted);margin:0;display:flex;align-items:center;gap:0.35rem;font-weight:500}' +
      '.bd-card-facility::before{content:"";width:0.85rem;height:0.85rem;flex-shrink:0;background:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'14\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\'%3E%3Cpath d=\'M7 1.5L2.5 6v5.5h9V6L7 1.5z\'/%3E%3C/svg%3E") center/contain no-repeat}' +
      '.bd-desc{font-size:0.8125rem;color:var(--bd-text-muted);margin:0;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
      '.bd-meta-chips{display:flex;flex-wrap:wrap;gap:0.35rem;margin:0.15rem 0}' +
      '.bd-meta-chip{font-size:0.7rem;font-weight:600;padding:0.2rem 0.55rem;border-radius:999px;background:var(--bd-surface-muted);color:var(--bd-text-muted);border:1px solid var(--bd-border)}' +
      '.bd-card-stats{display:flex;flex-wrap:wrap;gap:0.65rem 1rem;font-size:0.78rem;color:var(--bd-text-muted);margin:0.25rem 0 0}' +
      '.bd-card-stats span{display:inline-flex;align-items:center;gap:0.3rem;font-weight:600}' +
      '.bd-card-pricing{margin-top:auto;padding-top:0.85rem;border-top:1px solid #f1f5f9;display:flex;align-items:flex-end;justify-content:space-between;gap:0.75rem}' +
      '.bd-price-label{font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--bd-text-muted)}' +
      '.bd-price-value{font-size:1.35rem;font-weight:800;color:var(--bd-text);line-height:1;letter-spacing:-0.02em}' +
      '.bd-spots{font-size:0.78rem;font-weight:600;text-align:right}' +
      '.bd-spots--warn{color:#b45309}' +
      '.bd-spots--bad{color:#b91c1c}' +
      '.bd-card-actions{display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:0.85rem}' +
      '.bd-card-actions .bd-btn{width:100%;min-height:2.65rem;border-radius:var(--bd-radius-sm)}' +
      '@media (max-width:420px){.bd-card-actions{grid-template-columns:1fr}.bd-card-actions .bd-btn--ghost{order:2}}' +
      '.bd-actions{display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center}' +
      '.bd-btn{display:inline-flex;align-items:center;justify-content:center;padding:0.6rem 1.05rem;border-radius:var(--bd-radius-sm);font-weight:700;text-decoration:none;background:var(--bd-primary);color:#fff;border:none;cursor:pointer;font-size:0.875rem;transition:transform 0.12s,box-shadow 0.12s,opacity 0.12s;box-shadow:0 1px 2px rgba(15,23,42,0.12)}' +
      '.bd-btn:hover{opacity:0.94;box-shadow:0 4px 12px rgba(15,23,42,0.15)}' +
      '.bd-btn:active{transform:scale(0.98)}' +
      '.bd-btn.secondary{background:#64748b}' +
      '.bd-btn--ghost{background:var(--bd-surface);color:var(--bd-primary);border:1px solid var(--bd-border);box-shadow:none}' +
      '.bd-btn--accent{background:var(--bd-accent)}' +
      '.bd-btn--sm{padding:0.4rem 0.75rem;font-size:0.8125rem;min-height:auto}' +
      '.bd-hero{position:relative;color:#fff;padding:1.75rem 1.35rem 1.35rem;border-radius:var(--bd-radius);margin-bottom:' +
      HERO_SECTION_GAP_PX +
      'px;overflow:hidden;background:linear-gradient(135deg,var(--bd-primary) 0%,#0f172a 55%,#1e293b 100%)}' +
      '.bd-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 20%,rgba(255,255,255,0.12),transparent 50%);pointer-events:none}' +
      '.bd-hero-inner{position:relative;z-index:1}' +
      '.bd-hero h2{margin:0 0 0.35rem;font-size:1.45rem;font-weight:800;letter-spacing:-0.03em}' +
      '.bd-hero-lead{margin:0 0 1rem;font-size:0.9rem;opacity:0.88;max-width:32rem;line-height:1.45}' +
      '.bd-accent-bar{width:2.5rem;height:4px;background:var(--bd-accent);margin-bottom:0.85rem;border-radius:2px}' +
      '.bd-hero .bd-toolbar{margin-bottom:0;background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.2);backdrop-filter:blur(8px)}' +
      '.bd-hero .bd-search,.bd-hero .bd-select{background:rgba(15,23,42,0.35);border-color:rgba(255,255,255,0.25);color:#fff}' +
      '.bd-carousel{display:flex;gap:1.15rem;overflow-x:auto;padding:0.25rem 0.15rem 0.75rem;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:thin}' +
      '.bd-carousel .bd-card{min-width:' +
      HERO_CARD_MIN_WIDTH_PX +
      'px;max-width:24rem;flex:0 0 auto;scroll-snap-align:start}' +
      '.bd-schedule-wrap{overflow-x:auto;border-radius:var(--bd-radius);border:1px solid var(--bd-border);background:var(--bd-surface);box-shadow:var(--bd-shadow-sm)}' +
      '.bd-table{width:100%;border-collapse:collapse;font-size:0.8125rem}' +
      '.bd-table th,.bd-table td{border-bottom:1px solid var(--bd-border);padding:0.7rem 0.85rem;text-align:left;vertical-align:top}' +
      '.bd-table th{background:var(--bd-surface-muted);font-weight:800;color:var(--bd-text-muted);white-space:nowrap;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em}' +
      '.bd-table tbody tr:hover td{background:var(--bd-primary-soft)}' +
      '.bd-table tr:last-child td{border-bottom:none}' +
      '@media (min-width:' +
      (MOBILE_STACKED_SCHEDULE_MAX_WIDTH_PX + 1) +
      'px){.bd-schedule-wrap .bd-table{min-width:36rem}}' +
      '@media (max-width:' +
      MOBILE_STACKED_SCHEDULE_MAX_WIDTH_PX +
      'px){.bd-schedule-wrap .bd-table{min-width:0}.bd-schedule-wrap .bd-table thead{display:none}.bd-schedule-wrap .bd-table tbody tr{display:block;margin-bottom:0.85rem;border:1px solid #e2e8f0;border-radius:10px;padding:0.65rem 0.75rem;background:#fff}.bd-schedule-wrap .bd-table td{display:block;border:none;padding:0.25rem 0}.bd-schedule-wrap .bd-table td:last-child{padding-top:0.5rem}.bd-schedule-wrap .bd-table td[data-label]::before{content:attr(data-label);display:block;font-size:0.65rem;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.04em;margin-bottom:0.12rem}}' +
      '.bd-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:' +
      OVERLAY_Z_INDEX +
      ';display:flex;align-items:center;justify-content:center;padding:0.75rem}' +
      '.bd-overlay-dialog{width:min(' +
      EMBED_MODAL_VIEWPORT_WIDTH_CAP_PCT +
      'vw,' +
      EMBED_MODAL_MAX_WIDTH_REM +
      'rem);height:min(' +
      EMBED_MODAL_VIEWPORT_HEIGHT_CAP_PCT +
      'vh,' +
      EMBED_MODAL_MAX_HEIGHT_REM +
      'rem);background:#fff;border-radius:12px;box-shadow:0 24px 64px rgba(0,0,0,0.28);display:flex;flex-direction:column;overflow:hidden}' +
      '.bd-overlay-bar{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;padding:0.55rem 0.75rem;border-bottom:1px solid #e2e8f0;background:#f8fafc}' +
      '.bd-overlay-title{font-size:0.8125rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%}' +
      '.bd-overlay-actions{display:flex;align-items:center;gap:0.5rem;flex-shrink:0}' +
      '.bd-overlay-close{padding:0.35rem 0.75rem;border-radius:8px;border:1px solid #cbd5e1;background:#fff;font:inherit;cursor:pointer;font-weight:600;font-size:0.8125rem}' +
      '.bd-overlay-link{font-size:0.8125rem;font-weight:600;color:var(--bd-accent)}' +
      '.bd-overlay-frame{flex:1;width:100%;border:none;min-height:0;background:#fff}' +
      '.bd-drawer-backdrop{position:fixed;inset:0;background:rgba(15,23,42,0.45);z-index:' +
      OVERLAY_Z_INDEX +
      ';display:flex;align-items:flex-end;justify-content:center;padding:0}' +
      '@media (min-width:' +
      (MOBILE_STACKED_SCHEDULE_MAX_WIDTH_PX + 1) +
      'px){.bd-drawer-backdrop{align-items:center;padding:1rem}}' +
      '.bd-drawer-dialog{width:100%;max-width:42rem;max-height:92vh;background:var(--bd-surface);border-radius:16px 16px 0 0;box-shadow:var(--bd-shadow-lg);display:flex;flex-direction:column;overflow:hidden}' +
      '@media (min-width:' +
      (MOBILE_STACKED_SCHEDULE_MAX_WIDTH_PX + 1) +
      'px){.bd-drawer-dialog{border-radius:16px;max-height:min(88vh,42rem)}}' +
      '.bd-drawer-hero{position:relative;height:9.5rem;background:var(--bd-primary-soft);background-size:cover;background-position:center;flex-shrink:0}' +
      '.bd-drawer-hero-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(15,23,42,0.85),rgba(15,23,42,0.25))}' +
      '.bd-drawer-hero-title{position:absolute;left:1rem;right:3.5rem;bottom:1rem;margin:0;font-size:1.15rem;font-weight:800;color:#fff;line-height:1.25;letter-spacing:-0.02em}' +
      '.bd-drawer-close-float{position:absolute;top:0.65rem;right:0.65rem;z-index:2;padding:0.4rem 0.75rem;border-radius:999px;border:1px solid rgba(255,255,255,0.35);background:rgba(15,23,42,0.45);color:#fff;font:inherit;font-weight:700;font-size:0.8125rem;cursor:pointer;backdrop-filter:blur(8px)}' +
      '.bd-drawer-bar{display:none}' +
      '.bd-drawer-body{overflow-y:auto;flex:1;padding:1rem 1.15rem 1.25rem;-webkit-overflow-scrolling:touch}' +
      '.bd-drawer-footer{flex-shrink:0;padding:0.85rem 1.15rem;border-top:1px solid var(--bd-border);background:var(--bd-surface-muted);display:flex;flex-wrap:wrap;gap:0.5rem}' +
      '.bd-drawer-footer .bd-btn{flex:1;min-width:8rem}' +
      '.bd-drawer-section{margin-bottom:1.15rem}' +
      '.bd-drawer-h{font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin:0 0 0.4rem}' +
      '.bd-drawer-links{display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem}' +
      '.bd-drawer-p{font-size:0.875rem;color:#475569;line-height:1.5;margin:0}' +
      '.bd-session-card{border:1px solid var(--bd-border);border-radius:var(--bd-radius-sm);padding:0.85rem 0.95rem;margin-bottom:0.55rem;background:var(--bd-surface);box-shadow:var(--bd-shadow-sm)}' +
      '.bd-session-card h4{margin:0 0 0.35rem;font-size:0.95rem;font-weight:800;color:var(--bd-text)}' +
      '.bd-session-card .bd-drawer-links{margin:0.5rem 0 0}' +
      '.bd-mini-row{font-size:0.78rem;color:#64748b;margin-bottom:0.35rem}' +
      '.bd-event-mini{border-left:3px solid var(--bd-accent);padding:0.45rem 0 0.45rem 0.65rem;margin-bottom:0.45rem;background:#fff;border-radius:0 8px 8px 0}' +
      '.bd-schedule-list{display:flex;flex-direction:column;gap:0.25rem}' +
      '.bd-schedule-day-h{font-size:0.8rem;font-weight:800;color:#0f172a;margin:0.75rem 0 0.35rem;padding-bottom:0.25rem;border-bottom:1px solid #e2e8f0}' +
      '.bd-schedule-day-h:first-child{margin-top:0}' +
      '.bd-schedule-list-card{display:grid;grid-template-columns:auto 1fr;gap:0.75rem 1rem;align-items:start;border:1px solid var(--bd-border);border-radius:var(--bd-radius-sm);padding:0.85rem 1rem;margin-bottom:0.55rem;background:var(--bd-surface);box-shadow:var(--bd-shadow-sm);transition:border-color 0.15s,box-shadow 0.15s}' +
      '.bd-schedule-list-card:hover{border-color:#cbd5e1;box-shadow:var(--bd-shadow-md)}' +
      '.bd-time-pill{min-width:3.75rem;text-align:center;padding:0.45rem 0.5rem;border-radius:var(--bd-radius-sm);background:var(--bd-primary-soft);color:var(--bd-primary);font-weight:800;font-size:0.75rem;line-height:1.2}' +
      '.bd-time-pill-date{display:block;font-size:0.65rem;font-weight:700;opacity:0.85;margin-bottom:0.15rem}' +
      '.bd-schedule-list-title{font-weight:800;font-size:0.9rem;color:var(--bd-text);margin:0 0 0.2rem;line-height:1.3}' +
      '.bd-schedule-list-card .bd-meta{font-size:0.78rem;color:var(--bd-text-muted);line-height:1.4}' +
      '.bd-schedule-list-body .bd-actions{margin-top:0.55rem}' +
      '.bd-view-toggle{display:inline-flex;border:1px solid #e2e8f0;border-radius:999px;overflow:hidden;background:#fff;margin-right:0.5rem}' +
      '.bd-view-toggle button{border:none;background:transparent;padding:0.45rem 0.9rem;font:inherit;cursor:pointer;font-weight:600;font-size:0.8125rem;color:#64748b}' +
      '.bd-view-toggle button[aria-pressed="true"]{background:var(--bd-primary);color:#fff}' +
      '.bd-empty{text-align:center;padding:2.75rem 1.25rem;color:var(--bd-text-muted);background:var(--bd-surface);border:1px dashed var(--bd-border);border-radius:var(--bd-radius)}' +
      '.bd-empty-mark{width:3rem;height:3rem;margin:0 auto 1rem;border-radius:50%;background:var(--bd-accent-soft);border:2px solid color-mix(in srgb,var(--bd-accent) 25%,transparent)}' +
      '.bd-empty h3{margin:0 0 0.5rem;font-size:1.05rem;font-weight:800;color:var(--bd-text)}' +
      '.bd-empty p{margin:0;max-width:22rem;margin-left:auto;margin-right:auto;line-height:1.5}' +
      '.bd-loading{padding:0.5rem 0}' +
      '.bd-loading p{margin:0.65rem 0 0;font-size:0.8125rem;color:var(--bd-text-muted);text-align:center}' +
      '.bd-skeleton{border-radius:999px;background:linear-gradient(90deg,#e2e8f0 0%,#f1f5f9 50%,#e2e8f0 100%);background-size:200% 100%;animation:bd-shimmer 1.2s ease-in-out infinite}' +
      '.bd-skeleton--line{height:0.65rem;width:100%;max-width:14rem;margin:0 auto}' +
      '@keyframes bd-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}' +
      '.bd-schedule-loading{font-size:0.875rem;color:var(--bd-text-muted);padding:0.5rem 0}' +
      '.bd-foot{margin:0;padding:1rem 1.35rem 1.35rem;font-size:0.8125rem;color:var(--bd-text-muted);background:var(--bd-surface);border-top:1px solid var(--bd-border)}' +
      '.bd-foot-inner{display:flex;flex-wrap:wrap;align-items:center;gap:0.35rem 0.65rem}' +
      '.bd-foot a{color:var(--bd-accent);font-weight:700;text-decoration:none}' +
      '.bd-foot a:hover{text-decoration:underline}' +
      themeExtraCss(theme)
    );
  }

  function programTypeLabel(type) {
    if (!type) return '';
    return PROGRAM_TYPE_LABELS[type] || type.replace(/_/g, ' ');
  }

  function gradientForSport(sport) {
    var key = (sport || '').toLowerCase();
    return SPORT_GRADIENTS[key] || 'linear-gradient(135deg,var(--bd-primary) 0%,#312e81 100%)';
  }

  function programImageUrl(program) {
    return program.imageUrl || (program.mainMedia && program.mainMedia.url) || '';
  }

  function clampDescription(text) {
    if (!text) return '';
    var t = String(text).replace(/\s+/g, ' ').trim();
    if (t.length <= DESCRIPTION_PREVIEW_CHARS) return t;
    return t.slice(0, DESCRIPTION_PREVIEW_CHARS - 1) + '\u2026';
  }

  function formatAgeLine(program, boot) {
    if (boot.features.showAgeGender === false) return '';
    var min = program.ageMin;
    var max = program.ageMax;
    if (min != null && max != null) return 'Ages ' + min + '\u2013' + max;
    if (min != null) return 'Ages ' + min + '+';
    if (max != null) return 'Up to age ' + max;
    return '';
  }

  function minPriceFromProgram(program) {
    var sessions = getSessions(program);
    var best = null;
    sessions.forEach(function (s) {
      var products = s.products || [];
      products.forEach(function (p) {
        var prices = p.prices || [];
        prices.forEach(function (pr) {
          var n = typeof pr.price === 'number' ? pr.price : pr.amount;
          if (typeof n === 'number' && !Number.isNaN(n)) {
            if (best === null || n < best) best = n;
          }
        });
      });
    });
    return best;
  }

  function spotsSummary(program) {
    var sessions = getSessions(program);
    var total = 0;
    var enrolled = 0;
    sessions.forEach(function (s) {
      var cap = s.maxParticipants || s.capacity || 0;
      var cur = s.currentEnrollment || 0;
      if (cap > 0) {
        total += cap;
        enrolled += cur;
      }
    });
    if (total <= 0) return null;
    var left = total - enrolled;
    return { left: left, total: total };
  }

  function programRegisterHref(program, boot) {
    if (boot.features.hideRegistrationLinks) return null;
    if (boot.features.customRegistrationUrl) return boot.features.customRegistrationUrl;
    if (!program.linkSEO) return null;
    var closed = allSessionsRegistrationClosed(program);
    return buildRegistrationUrl(program.linkSEO, { isRegistrationOpen: !closed });
  }

  function buildProgramDetailUrl(boot, program) {
    var base = boot.paths && boot.paths.fullDiscoveryUrl;
    if (!base || !program) return base || '';
    try {
      var u = new URL(base);
      u.searchParams.set('viewMode', 'programs');
      u.searchParams.set('programIds', String(program.id));
      return u.toString();
    } catch (e) {
      var sep = base.indexOf('?') >= 0 ? '&' : '?';
      return (
        base +
        sep +
        'viewMode=programs&programIds=' +
        encodeURIComponent(String(program.id))
      );
    }
  }

  function buildDiscoveryDeepLink(boot, spec) {
    var base = boot.paths && boot.paths.fullDiscoveryUrl;
    if (!base) return '';
    try {
      var u = new URL(base);
      if (spec.viewMode) u.searchParams.set('viewMode', spec.viewMode);
      if (spec.programIds && spec.programIds.length)
        u.searchParams.set('programIds', spec.programIds.map(String).join('_'));
      if (spec.sessionIds && spec.sessionIds.length)
        u.searchParams.set('sessionIds', spec.sessionIds.map(String).join('_'));
      if (spec.scheduleView) u.searchParams.set('scheduleView', spec.scheduleView);
      return u.toString();
    } catch (e) {
      return base;
    }
  }

  function minPriceFromSession(session) {
    var products = session.products || [];
    var best = null;
    products.forEach(function (p) {
      var prices = p.prices || [];
      prices.forEach(function (pr) {
        var n = typeof pr.price === 'number' ? pr.price : pr.amount;
        if (typeof n === 'number' && !Number.isNaN(n)) {
          if (best === null || n < best) best = n;
        }
      });
    });
    return best;
  }

  function sessionRegisterHref(session, program, boot) {
    if (boot.features.hideRegistrationLinks) return null;
    if (boot.features.customRegistrationUrl) return boot.features.customRegistrationUrl;
    var link = session.linkSEO || program.linkSEO;
    if (!link) return null;
    var st = session.registrationWindowStatus;
    var closed = st === 'closed' || st === 'ended';
    return buildRegistrationUrl(link, { isRegistrationOpen: !closed });
  }

  function applyHostFontVars(mount) {
    try {
      var cs = getComputedStyle(mount);
      mount.style.setProperty('--bd-host-font', cs.fontFamily);
      mount.style.setProperty('--bd-host-font-size', cs.fontSize);
      mount.style.setProperty('--bd-host-color', cs.color);
    } catch (e) {}
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

  function filterPrograms(programs, state) {
    var sport = state.sport;
    var facility = state.facility;
    var ptype = state.ptype;
    var q = (state.search || '').toLowerCase().trim();
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
      if (q) {
        var name = (p.name || '').toLowerCase();
        var desc = (p.description || p.longDescription || '').toLowerCase();
        if (name.indexOf(q) === -1 && desc.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderRichProgramCard(program, boot, t) {
    var href = programRegisterHref(program, boot);
    var facility =
      program.facilityName ||
      (program.sessions && program.sessions[0] && program.sessions[0].facility && program.sessions[0].facility.name) ||
      '';
    var sport = program.sport || '';
    var imgUrl = programImageUrl(program);
    var mediaChildren = [];
    var badges = el('div', { className: 'bd-card-badges' });
    if (program.type) {
      badges.appendChild(el('span', { className: 'bd-badge', text: programTypeLabel(program.type) }));
    }
    var spotsEarly = boot.features.showAvailability !== false ? spotsSummary(program) : null;
    if (spotsEarly && spotsEarly.left <= 0) {
      badges.appendChild(el('span', { className: 'bd-badge bd-badge--urgent', text: 'Full' }));
    } else if (
      spotsEarly &&
      spotsEarly.left <= Math.max(3, Math.floor(spotsEarly.total * 0.08))
    ) {
      badges.appendChild(el('span', { className: 'bd-badge bd-badge--urgent', text: 'Almost full' }));
    }
    if (imgUrl) {
      mediaChildren.push(
        el('img', { src: imgUrl, alt: program.name || 'Program', loading: 'lazy' }),
      );
      mediaChildren.push(badges);
      mediaChildren.push(el('div', { className: 'bd-card-media-overlay' }));
    } else {
      mediaChildren.push(
        el('div', {
          className: 'bd-card-media--grad',
          style: {
            position: 'absolute',
            inset: 0,
            background: gradientForSport(sport),
            opacity: 1,
          },
        }),
      );
      mediaChildren.push(badges);
      mediaChildren.push(el('div', { className: 'bd-card-media-overlay' }));
    }
    if (sport) {
      var footBadges = el('div', { className: 'bd-card-badges bd-card-badges--foot' });
      footBadges.appendChild(el('span', { className: 'bd-badge bd-badge--dark', text: sport }));
      mediaChildren.push(footBadges);
    }
    var media = el('div', { className: 'bd-card-media' }, mediaChildren);

    var desc = clampDescription(program.description || program.longDescription || '');
    var ageLine = formatAgeLine(program, boot);
    var priceVal = boot.features.showPricing !== false ? minPriceFromProgram(program) : null;
    var spots = boot.features.showAvailability !== false ? spotsSummary(program) : null;

    var metaParts = [];
    if (facility) metaParts.push(el('span', { text: facility }));
    if (ageLine) metaParts.push(el('span', { text: ageLine }));

    var metaRow =
      metaParts.length > 0
        ? el(
            'div',
            { className: 'bd-meta-row' },
            metaParts.reduce(function (acc, n, i) {
              if (i) acc.push(el('span', { text: '\u00b7' }));
              acc.push(n);
              return acc;
            }, []),
          )
        : el('span');

    var priceEl = null;
    if (priceVal != null) {
      priceEl = el('div', { className: 'bd-price', text: 'From $' + priceVal.toFixed(0) });
    }

    var spotsEl = null;
    if (spots) {
      var cls = 'bd-spots';
      if (spots.left <= 0) cls += ' bd-spots--bad';
      else if (spots.left <= Math.max(3, Math.floor(spots.total * 0.08))) cls += ' bd-spots--warn';
      spotsEl = el('div', { className: cls, text: spots.left + ' of ' + spots.total + ' spots open' });
    }

    var actions = el('div', { className: 'bd-card-actions' });
    if (href) {
      actions.appendChild(
        el('a', {
          className: 'bd-btn' + (allSessionsRegistrationClosed(program) ? ' secondary' : ''),
          href: href,
          target: t,
          rel: 'noopener noreferrer',
          'aria-label':
            (allSessionsRegistrationClosed(program) ? 'More information' : 'Register') +
            ' for ' +
            (program.name || 'program'),
          text: allSessionsRegistrationClosed(program) ? 'More info' : 'Register',
        }),
      );
    }
    actions.appendChild(
      el('a', {
        className: 'bd-btn bd-btn--ghost bd-detail-link',
        href: buildProgramDetailUrl(boot, program),
        target: t,
        rel: 'noopener noreferrer',
        'aria-label': 'Full program details for ' + (program.name || 'program'),
        text: 'Details',
        'data-bd-program-id': String(program.id),
      }),
    );

    var bodyKids = [el('h3', { className: 'bd-card-title', text: program.name || 'Program' })];
    if (facility) bodyKids.push(el('p', { className: 'bd-card-facility', text: facility }));
    if (desc) bodyKids.push(el('p', { className: 'bd-desc', text: desc }));
    if (ageLine) bodyKids.push(chipRow);
    if (sessionCount > 0 || spots) bodyKids.push(statsRow);
    bodyKids.push(pricingBlock);
    bodyKids.push(actions);
    return el('article', { className: 'bd-card' }, [
      media,
      el('div', { className: 'bd-card-body' }, bodyKids),
    ]);
  }

  function renderSiteHeader(boot) {
    var brand = boot.branding || {};
    var row = el('div', { className: 'bd-top' });
    if (brand.logo) {
      row.appendChild(el('img', { src: brand.logo, alt: brand.companyName || 'Logo' }));
    }
    var copy = el('div', { className: 'bd-top-copy' });
    copy.appendChild(el('h1', { text: brand.companyName || 'Programs' }));
    copy.appendChild(
      el('p', {
        className: 'bd-top-tagline',
        text: 'Browse programs and upcoming sessions',
      }),
    );
    row.appendChild(copy);
    return row;
  }

  function buildProgramToolbar(programs, state, onFilterChange) {
    var sports = uniqueStrings(programs.map(function (p) {
      return p.sport || '';
    }));
    var facilities = uniqueStrings(
      programs.map(function (p) {
        return (
          p.facilityName ||
          (p.sessions && p.sessions[0] && p.sessions[0].facility && p.sessions[0].facility.name) ||
          ''
        );
      }),
    );
    var types = uniqueStrings(programs.map(function (p) {
      return p.type || '';
    }));

    var search = el('input', {
      type: 'search',
      className: 'bd-search',
      placeholder: 'Search programs',
      value: state.search || '',
      'aria-label': 'Search programs',
    });
    search.addEventListener('input', function () {
      state.search = search.value;
      onFilterChange();
    });

    function mkSelect(label, items, key) {
      var sel = el('select', { className: 'bd-select', 'aria-label': label });
      sel.appendChild(el('option', { value: '', text: label }));
      items.forEach(function (s) {
        sel.appendChild(el('option', { value: s, text: s }));
      });
      sel.value = state[key] || '';
      sel.addEventListener('change', function () {
        state[key] = sel.value;
        onFilterChange();
      });
      return sel;
    }

    return el('div', { className: 'bd-toolbar' }, [
      search,
      mkSelect('All sports', sports, 'sport'),
      mkSelect('All locations', facilities, 'facility'),
      mkSelect('All types', types, 'ptype'),
    ]);
  }

  function renderProgramsPanel(programs, boot, t) {
    var state = { sport: '', facility: '', ptype: '', search: '' };
    var host = el('div', { className: 'bd-programs-host' });
    var countEl = el('p', { className: 'bd-results' });
    var countPill = el('span', { className: 'bd-results-pill', text: '' });
    var resultsBar = el('div', { className: 'bd-results-bar' }, [countEl, countPill]);

    function redraw() {
      while (host.firstChild) host.removeChild(host.firstChild);
      var list = filterPrograms(programs, state);
      countEl.innerHTML =
        'Showing <strong>' +
        list.length +
        '</strong> program' +
        (list.length === 1 ? '' : 's');
      countPill.textContent = list.length + ' shown';
      if (!list.length) {
        host.appendChild(
          renderEmptyState(
            'No programs match',
            'Try clearing search or filters, or open the full discovery page for every filter option.',
          ),
        );
        return;
      }
      var grid = el('div', { className: 'bd-grid' });
      list.forEach(function (p) {
        grid.appendChild(renderRichProgramCard(p, boot, t));
      });
      host.appendChild(grid);
    }

    var toolbar = buildProgramToolbar(programs, state, redraw);
    redraw();

    return el('div', {}, [toolbar, resultsBar, host]);
  }

  function filterScheduleRows(rows, state) {
    var q = (state.search || '').toLowerCase().trim();
    var sport = state.sport || '';
    var programId = state.programId || '';
    return rows.filter(function (ev) {
      if (sport && String(ev.sport || '') !== sport) return false;
      if (programId && String(ev.programId || '') !== programId) return false;
      if (!q) return true;
      var hay = [ev.title, ev.programName, ev.sessionName, ev.facilityName, ev.spaceName, ev.type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function formatEventWhen(ev) {
    var iso = ev.startDate || '';
    if (!iso) return { date: '', time: '' };
    try {
      var d = new Date(iso);
      return {
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
      };
    } catch (e) {
      return { date: iso.split('T')[0] || '', time: '' };
    }
  }

  function eventSortKey(ev) {
    return ev.startDate || '';
  }

  function groupScheduleRowsByDate(rows) {
    var sorted = rows.slice().sort(function (a, b) {
      return eventSortKey(a).localeCompare(eventSortKey(b));
    });
    var groups = [];
    var byKey = {};
    sorted.forEach(function (ev) {
      var when = formatEventWhen(ev);
      var key = when.date || 'Date TBD';
      if (!byKey[key]) {
        byKey[key] = { dateLabel: key, items: [] };
        groups.push(byKey[key]);
      }
      byKey[key].items.push(ev);
    });
    return groups;
  }

  function renderScheduleList(rows, boot, t) {
    var showPrice = boot.features.showPricing !== false;
    var showSpots = boot.features.showAvailability !== false;
    var groups = groupScheduleRowsByDate(rows);
    var root = el('div', { className: 'bd-schedule-list' });
    groups.forEach(function (g) {
      root.appendChild(el('h3', { className: 'bd-schedule-day-h', text: g.dateLabel }));
      g.items.forEach(function (ev) {
        var when = formatEventWhen(ev);
        var where = [ev.facilityName, ev.spaceName].filter(Boolean).join(' \u00b7 ');
        var href = ev.linkSEO
          ? buildRegistrationUrl(ev.linkSEO, {
              isRegistrationOpen: ev.registrationWindowStatus === 'open',
            })
          : null;
        var reg = href
          ? el('a', {
              className: 'bd-btn',
              href: href,
              target: t,
              rel: 'noopener noreferrer',
              'aria-label': 'Register for ' + (ev.programName || ev.title || 'event'),
              text: 'Register',
            })
          : el('span', { text: '\u2014' });
        var titleText = ev.title || ev.programName || 'Event';
        var metaParts = [when.time, ev.programName && ev.title && ev.title !== ev.programName ? ev.title : '', where]
          .filter(Boolean)
          .join(' \u00b7 ');
        var spotLine = '';
        if (showSpots) {
          var sr = ev.spotsRemaining;
          var mx = ev.maxParticipants;
          spotLine =
            typeof sr === 'number' && typeof mx === 'number'
              ? sr + ' / ' + mx + ' spots'
              : typeof sr === 'number'
                ? sr + ' spots'
                : '';
        }
        var priceLine = '';
        if (showPrice) {
          var sp = ev.startingPrice;
          priceLine =
            typeof sp === 'number' && !Number.isNaN(sp) ? 'From $' + sp.toFixed(0) : '';
        }
        var metaTail = [spotLine, priceLine].filter(Boolean).join(' \u00b7 ');
        var metaText = [metaParts, metaTail].filter(Boolean).join(metaParts && metaTail ? ' \u00b7 ' : '');
        var timePill = el('div', { className: 'bd-time-pill' }, [
          el('span', { className: 'bd-time-pill-date', text: when.date || 'TBD' }),
          el('span', { text: when.time || '' }),
        ]);
        var bodyCol = el('div', { className: 'bd-schedule-list-body' }, [
          el('h4', { className: 'bd-schedule-list-title', text: titleText }),
          metaText ? el('div', { className: 'bd-meta', text: metaText }) : el('span'),
          el('div', { className: 'bd-actions' }, [reg]),
        ]);
        root.appendChild(el('div', { className: 'bd-schedule-list-card' }, [timePill, bodyCol]));
      });
    });
    return root;
  }

  function renderScheduleTable(rows, boot, t) {
    var showPrice = boot.features.showPricing !== false;
    var showSpots = boot.features.showAvailability !== false;
    var headCells = [
      el('th', { text: 'When' }),
      el('th', { text: 'Program' }),
      el('th', { text: 'Where' }),
    ];
    if (showSpots) headCells.push(el('th', { text: 'Spots' }));
    if (showPrice) headCells.push(el('th', { text: 'From' }));
    headCells.push(el('th', { text: 'Action' }));
    var tbody = el('tbody', {}, []);
    var table = el(
      'table',
      { className: 'bd-table' },
      [el('thead', {}, [el('tr', {}, headCells)]), tbody],
    );
    rows.forEach(function (ev) {
      var when = formatEventWhen(ev);
      var where = [ev.facilityName, ev.spaceName].filter(Boolean).join(' \u00b7 ');
      var href = ev.linkSEO
        ? buildRegistrationUrl(ev.linkSEO, {
            isRegistrationOpen: ev.registrationWindowStatus === 'open',
          })
        : null;
      var reg = href
        ? el('a', {
            className: 'bd-btn',
            href: href,
            target: t,
            rel: 'noopener noreferrer',
            'aria-label': 'Register for ' + (ev.programName || ev.title || 'event'),
            text: 'Register',
          })
        : el('span', { text: '\u2014' });
      var cells = [
        el(
          'td',
          { 'data-label': 'When' },
          [
            el('div', { text: when.date, style: { fontWeight: '700', color: '#0f172a' } }),
            el('div', { text: when.time, style: { fontSize: '0.75rem', color: '#64748b' } }),
          ],
        ),
        el(
          'td',
          { 'data-label': 'Program' },
          [
            el('div', { text: ev.programName || ev.title || '', style: { fontWeight: '600' } }),
            ev.title && ev.programName && ev.title !== ev.programName
              ? el('div', { text: ev.title, style: { fontSize: '0.75rem', color: '#64748b' } })
              : el('span'),
          ],
        ),
        el('td', { 'data-label': 'Where', text: where || '\u2014' }),
      ];
      if (showSpots) {
        var sr = ev.spotsRemaining;
        var mx = ev.maxParticipants;
        var spotsText =
          typeof sr === 'number' && typeof mx === 'number'
            ? sr + ' / ' + mx
            : typeof sr === 'number'
              ? String(sr)
              : '\u2014';
        cells.push(el('td', { 'data-label': 'Spots', text: spotsText }));
      }
      if (showPrice) {
        var sp = ev.startingPrice;
        cells.push(
          el('td', {
            'data-label': 'From',
            text: typeof sp === 'number' && !Number.isNaN(sp) ? '$' + sp.toFixed(0) : '\u2014',
          }),
        );
      }
      cells.push(el('td', { 'data-label': 'Action' }, [reg]));
      tbody.appendChild(el('tr', {}, cells));
    });
    return el('div', { className: 'bd-schedule-wrap' }, [table]);
  }

  function fetchScheduleRows(origin, slug) {
    return fetch(origin + '/api/events?slug=' + encodeURIComponent(slug))
      .then(function (r) {
        return r.json();
      })
      .then(function (json) {
        var rows = (json && json.data) || [];
        return rows.slice(0, SCHEDULE_FETCH_ROWS);
      });
  }

  function renderSchedulePanel(origin, slug, boot, t) {
    var wrap = el('div', { className: 'bd-schedule-root' });
    var loading = el('p', { className: 'bd-schedule-loading', text: 'Loading schedule\u2026' });
    wrap.appendChild(loading);
    fetchScheduleRows(origin, slug)
      .then(function (rows) {
        if (loading.parentNode) wrap.removeChild(loading);
        if (!rows.length) {
          wrap.appendChild(
            el('div', { className: 'bd-empty' }, [
              el('h3', { text: 'No upcoming events' }),
              el('p', { text: 'Check back soon or view the full discovery page.' }),
            ]),
          );
          return;
        }
        var state = {
          search: '',
          sport: '',
          programId: '',
          allRows: rows,
          scheduleLayout:
            typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(max-width: ' + MOBILE_STACKED_SCHEDULE_MAX_WIDTH_PX + 'px)').matches
              ? 'list'
              : 'table',
        };
        var toolbar = el('div', { className: 'bd-toolbar bd-schedule-toolbar' });
        var layoutToggle = el('div', {
          className: 'bd-view-toggle',
          role: 'group',
          'aria-label': 'Schedule layout',
        });
        var btnTable = el('button', { type: 'button', text: 'Table', ariaPressed: true });
        var btnList = el('button', { type: 'button', text: 'List', ariaPressed: false });
        layoutToggle.appendChild(btnTable);
        layoutToggle.appendChild(btnList);
        function syncLayoutToggle() {
          btnTable.setAttribute('aria-pressed', state.scheduleLayout === 'table' ? 'true' : 'false');
          btnList.setAttribute('aria-pressed', state.scheduleLayout === 'list' ? 'true' : 'false');
        }
        syncLayoutToggle();
        btnTable.addEventListener('click', function () {
          state.scheduleLayout = 'table';
          syncLayoutToggle();
          redraw();
        });
        btnList.addEventListener('click', function () {
          state.scheduleLayout = 'list';
          syncLayoutToggle();
          redraw();
        });
        var search = el('input', {
          type: 'search',
          className: 'bd-search',
          placeholder: 'Search events, locations, programs',
          'aria-label': 'Search schedule',
        });
        search.addEventListener('input', function () {
          state.search = search.value;
          redraw();
        });
        var sports = uniqueStrings(rows.map(function (r) {
          return r.sport || '';
        }));
        var selSport = el('select', { className: 'bd-select', 'aria-label': 'Filter by sport' });
        selSport.appendChild(el('option', { value: '', text: 'All sports' }));
        sports.forEach(function (s) {
          selSport.appendChild(el('option', { value: s, text: s }));
        });
        selSport.addEventListener('change', function () {
          state.sport = selSport.value;
          redraw();
        });
        var progMap = {};
        rows.forEach(function (r) {
          if (r.programId) {
            progMap[String(r.programId)] = r.programName || r.title || 'Program';
          }
        });
        var selProg = el('select', { className: 'bd-select', 'aria-label': 'Filter by program' });
        selProg.appendChild(el('option', { value: '', text: 'All programs' }));
        Object.keys(progMap)
          .sort(function (a, b) {
            return progMap[a].localeCompare(progMap[b]);
          })
          .forEach(function (pid) {
            selProg.appendChild(el('option', { value: pid, text: progMap[pid] }));
          });
        selProg.addEventListener('change', function () {
          state.programId = selProg.value;
          redraw();
        });
        toolbar.appendChild(layoutToggle);
        toolbar.appendChild(search);
        toolbar.appendChild(selSport);
        toolbar.appendChild(selProg);
        var countEl = el('p', { className: 'bd-results' });
        var tableHost = el('div', {});
        function redraw() {
          while (tableHost.firstChild) tableHost.removeChild(tableHost.firstChild);
          var filtered = filterScheduleRows(state.allRows, state);
          countEl.innerHTML =
            'Showing <strong>' +
            filtered.length +
            '</strong> of <strong>' +
            state.allRows.length +
            '</strong> events. Full date, sport, and space filters are on the discovery site.';
          var slice = filtered.slice(0, MAX_SCHEDULE_ROWS);
          if (!slice.length) {
            tableHost.appendChild(
              el('div', { className: 'bd-empty' }, [
                el('h3', { text: 'No events match' }),
                el('p', { text: 'Clear search or filters to see more rows.' }),
              ]),
            );
            return;
          }
          if (state.scheduleLayout === 'list') {
            tableHost.appendChild(renderScheduleList(slice, boot, t));
          } else {
            tableHost.appendChild(renderScheduleTable(slice, boot, t));
          }
        }
        wrap.appendChild(toolbar);
        wrap.appendChild(countEl);
        wrap.appendChild(tableHost);
        redraw();
      })
      .catch(function () {
        if (loading.parentNode) wrap.removeChild(loading);
        wrap.appendChild(el('p', { className: 'bd-empty', text: 'Schedule could not be loaded.' }));
      });
    return wrap;
  }

  function mountClassicShell(shadow, programs, boot, origin, mount) {
    var t = linkTarget(boot.features.linkBehavior);
    var shell = el('div', { className: 'bd-shell' });
    shell.appendChild(renderSiteHeader(boot));
    var tabs = boot.features.enabledTabs;
    if (!tabs || !tabs.length) {
      tabs = ['programs', 'schedule'];
    }
    var hasPrograms = tabs.indexOf('programs') !== -1;
    var hasSchedule = tabs.indexOf('schedule') !== -1;
    if (hasPrograms && hasSchedule) {
      var defaultTab = boot.features.defaultView === 'schedule' ? 'schedule' : 'programs';
      var tabRow = el('div', { className: 'bd-tabs-wrap' }, [
        el('div', { className: 'bd-tabs bd-tabs--full', role: 'tablist' }),
      ]);
      var tabInner = tabRow.firstChild;
      var progPanel = el('div', {
        className: 'bd-panel' + (defaultTab === 'programs' ? ' bd-panel--active' : ''),
        role: 'tabpanel',
      });
      var schedPanel = el('div', {
        className: 'bd-panel' + (defaultTab === 'schedule' ? ' bd-panel--active' : ''),
        role: 'tabpanel',
      });
      progPanel.appendChild(renderProgramsPanel(programs, boot, t));
      schedPanel.appendChild(renderSchedulePanel(origin, boot.slug, boot, t));
      var btnProg = el('button', {
        type: 'button',
        className: 'bd-tab',
        role: 'tab',
        text: 'Programs',
        ariaSelected: defaultTab === 'programs',
      });
      var btnSched = el('button', {
        type: 'button',
        className: 'bd-tab',
        role: 'tab',
        text: 'Schedule',
        ariaSelected: defaultTab === 'schedule',
      });
      function activate(which) {
        var isProg = which === 'programs';
        btnProg.setAttribute('aria-selected', isProg ? 'true' : 'false');
        btnSched.setAttribute('aria-selected', !isProg ? 'true' : 'false');
        progPanel.className = 'bd-panel' + (isProg ? ' bd-panel--active' : '');
        schedPanel.className = 'bd-panel' + (!isProg ? ' bd-panel--active' : '');
      }
      btnProg.addEventListener('click', function () {
        activate('programs');
      });
      btnSched.addEventListener('click', function () {
        activate('schedule');
      });
      tabInner.appendChild(btnProg);
      tabInner.appendChild(btnSched);
      shell.appendChild(tabRow);
      shell.appendChild(progPanel);
      shell.appendChild(schedPanel);
    } else if (hasSchedule && !hasPrograms) {
      var onlySched = el('div', { className: 'bd-panel bd-panel--active' });
      onlySched.appendChild(renderSchedulePanel(origin, boot.slug, boot, t));
      shell.appendChild(onlySched);
    } else {
      var onlyProg = el('div', { className: 'bd-panel bd-panel--active' });
      onlyProg.appendChild(renderProgramsPanel(programs, boot, t));
      shell.appendChild(onlyProg);
    }
    shell.appendChild(footerLinks(boot));
    shadow.appendChild(shell);
    attachProgramDetailClicks(shadow, boot, mount, origin, t);
    attachBondOverlayNavigation(shadow, boot);
  }

  function mountHeroCarousel(shadow, programs, boot, origin, mount) {
    var t = linkTarget(boot.features.linkBehavior);
    var state = { sport: '', facility: '', ptype: '', search: '' };
    var carousel = el('div', { className: 'bd-carousel' });

    function redrawCarousel() {
      while (carousel.firstChild) carousel.removeChild(carousel.firstChild);
      var list = filterPrograms(programs, state);
      list.forEach(function (p) {
        carousel.appendChild(renderRichProgramCard(p, boot, t));
      });
    }

    var toolbar = buildProgramToolbar(programs, state, redrawCarousel);
    redrawCarousel();

    var hero = el('div', { className: 'bd-hero' }, [
      el('div', { className: 'bd-hero-inner' }, [
        el('div', { className: 'bd-accent-bar' }),
        el('h2', { text: 'Upcoming programs' }),
        el('p', {
          className: 'bd-hero-lead',
          text: 'Filter by sport, location, or type — then register or view full details.',
        }),
        toolbar,
      ]),
    ]);

    var shell = el('div', { className: 'bd-shell' });
    shell.appendChild(renderSiteHeader(boot));
    shell.appendChild(hero);
    shell.appendChild(
      el('div', { className: 'bd-panel bd-panel--active' }, [
        el('p', { className: 'bd-results', text: 'Swipe or scroll horizontally to browse cards.' }),
        carousel,
      ]),
    );
    shell.appendChild(footerLinks(boot));
    shadow.appendChild(shell);
    attachProgramDetailClicks(shadow, boot, mount, origin, t);
    attachBondOverlayNavigation(shadow, boot);
  }

  function mountScheduleFirst(shadow, programs, boot, origin, mount) {
    var t = linkTarget(boot.features.linkBehavior);
    var shell = el('div', { className: 'bd-shell' });
    shell.appendChild(renderSiteHeader(boot));
    var block = el('div', { className: 'bd-panel bd-panel--active' });
    block.appendChild(el('h2', { className: 'bd-card-title', style: { marginBottom: '0.75rem' }, text: 'Schedule' }));
    block.appendChild(renderSchedulePanel(origin, boot.slug, boot, t));
    block.appendChild(el('h2', { className: 'bd-card-title', style: { margin: '1.5rem 0 0.75rem' }, text: 'Programs' }));
    block.appendChild(renderProgramsPanel(programs, boot, t));
    shell.appendChild(block);
    shell.appendChild(footerLinks(boot));
    shadow.appendChild(shell);
    attachProgramDetailClicks(shadow, boot, mount, origin, t);
    attachBondOverlayNavigation(shadow, boot);
  }

  function openBondOverlay(shadow, href, title) {
    var prev = shadow.querySelector('.bd-overlay');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    var backdrop = el('div', { className: 'bd-overlay' });
    var dialog = el('div', {
      className: 'bd-overlay-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': title,
    });
    var bar = el('div', { className: 'bd-overlay-bar' });
    var ttl = el('div', { className: 'bd-overlay-title', text: title });
    var actionWrap = el('div', { className: 'bd-overlay-actions' });
    var openTab = el('a', {
      className: 'bd-overlay-link',
      href: href,
      target: '_blank',
      rel: 'noopener noreferrer',
      text: 'Open in new tab',
      'data-bd-external': '1',
    });
    var closeBtn = el('button', { type: 'button', className: 'bd-overlay-close', text: 'Close' });
    var iframe = el('iframe', { className: 'bd-overlay-frame', src: href, title: title });
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    function onKeyDown(ev) {
      if (ev.key === 'Escape') close();
    }
    function close() {
      document.removeEventListener('keydown', onKeyDown);
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop) close();
    });
    document.addEventListener('keydown', onKeyDown);
    actionWrap.appendChild(openTab);
    actionWrap.appendChild(closeBtn);
    bar.appendChild(ttl);
    bar.appendChild(actionWrap);
    dialog.appendChild(bar);
    dialog.appendChild(iframe);
    backdrop.appendChild(dialog);
    shadow.appendChild(backdrop);
  }

  function scheduleDeepLinkForEvent(boot, ev, fallbackProgramId) {
    var pid = ev.programId != null ? ev.programId : fallbackProgramId;
    var spec = {
      viewMode: 'schedule',
      programIds: pid != null ? [pid] : [],
      scheduleView: SCHEDULE_DEEP_LINK_VIEW,
    };
    if (ev.sessionId) spec.sessionIds = [ev.sessionId];
    return buildDiscoveryDeepLink(boot, spec);
  }

  function openProgramDetailDrawer(shadow, program, boot, origin, t) {
    var prev = shadow.querySelector('.bd-drawer-backdrop');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    var programDetailUrl = buildProgramDetailUrl(boot, program);
    var scheduleForProgramUrl = buildDiscoveryDeepLink(boot, {
      viewMode: 'schedule',
      programIds: [program.id],
      scheduleView: SCHEDULE_DEEP_LINK_VIEW,
    });
    var backdrop = el('div', { className: 'bd-drawer-backdrop' });
    var dialog = el('div', {
      className: 'bd-drawer-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Program details for ' + (program.name || 'program'),
    });
    function onKeyDown(ev) {
      if (ev.key === 'Escape') close();
    }
    function close() {
      document.removeEventListener('keydown', onKeyDown);
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }
    var closeBtn = el('button', { type: 'button', className: 'bd-drawer-close-float', text: 'Close' });
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop) close();
    });
    document.addEventListener('keydown', onKeyDown);
    var imgUrl = programImageUrl(program);
    var hero = el('div', { className: 'bd-drawer-hero' });
    if (imgUrl) {
      hero.style.backgroundImage = 'url(' + imgUrl + ')';
    } else {
      hero.style.background = gradientForSport(program.sport || '');
    }
    hero.appendChild(el('div', { className: 'bd-drawer-hero-overlay' }));
    hero.appendChild(el('h2', { className: 'bd-drawer-hero-title', text: program.name || 'Program' }));
    hero.appendChild(closeBtn);
    var body = el('div', { className: 'bd-drawer-body' });
    var linksSection = el('div', { className: 'bd-drawer-section' });
    linksSection.appendChild(el('div', { className: 'bd-drawer-h', text: 'Open in discovery' }));
    linksSection.appendChild(
      el('div', { className: 'bd-drawer-links' }, [
        el('a', {
          className: 'bd-btn bd-btn--ghost',
          href: programDetailUrl,
          target: t,
          rel: 'noopener noreferrer',
          text: 'Program page',
          'data-bd-external': '1',
        }),
        el('a', {
          className: 'bd-btn bd-btn--ghost',
          href: scheduleForProgramUrl,
          target: t,
          rel: 'noopener noreferrer',
          text: 'Schedule',
          'data-bd-external': '1',
        }),
      ]),
    );
    body.appendChild(linksSection);
    var longDesc = program.longDescription || program.description || '';
    if (longDesc) {
      var copySec = el('div', { className: 'bd-drawer-section' });
      copySec.appendChild(el('div', { className: 'bd-drawer-h', text: 'About' }));
      copySec.appendChild(el('p', { className: 'bd-drawer-p', text: longDesc }));
      body.appendChild(copySec);
    }
    var sessionsSection = el('div', { className: 'bd-drawer-section' });
    sessionsSection.appendChild(el('div', { className: 'bd-drawer-h', text: 'Sessions' }));
    var sessList = getSessions(program);
    if (!sessList.length) {
      sessionsSection.appendChild(
        el('p', {
          className: 'bd-drawer-p',
          text: 'No session list was included in this embed response. Use the program or schedule links above for full session and segment detail.',
        }),
      );
    } else {
      sessList.forEach(function (session) {
        var sessionScheduleUrl = buildDiscoveryDeepLink(boot, {
          viewMode: 'schedule',
          programIds: [program.id],
          sessionIds: [session.id],
          scheduleView: SCHEDULE_DEEP_LINK_VIEW,
        });
        var regHref = sessionRegisterHref(session, program, boot);
        var fac =
          (session.facility && session.facility.name) ||
          (typeof session.facilityName === 'string' ? session.facilityName : '') ||
          '';
        var card = el('div', { className: 'bd-session-card' });
        card.appendChild(el('h4', { text: session.name || 'Session' }));
        if (fac) {
          card.appendChild(el('div', { className: 'bd-mini-row', text: fac }));
        }
        var sessPrice = boot.features.showPricing !== false ? minPriceFromSession(session) : null;
        if (sessPrice != null) {
          card.appendChild(
            el('div', { className: 'bd-mini-row', text: 'From $' + sessPrice.toFixed(0) }),
          );
        }
        var rowLinks = el('div', { className: 'bd-drawer-links', style: { marginTop: '0.35rem' } });
        rowLinks.appendChild(
          el('a', {
            className: 'bd-btn bd-btn--ghost',
            href: sessionScheduleUrl,
            target: t,
            rel: 'noopener noreferrer',
            text: 'View on schedule',
            'data-bd-external': '1',
          }),
        );
        if (regHref) {
          rowLinks.appendChild(
            el('a', {
              className: 'bd-btn',
              href: regHref,
              target: t,
              rel: 'noopener noreferrer',
              text: 'Register',
              'data-bd-external': '1',
            }),
          );
        }
        card.appendChild(rowLinks);
        sessionsSection.appendChild(card);
      });
    }
    body.appendChild(sessionsSection);
    var eventsSection = el('div', { className: 'bd-drawer-section' });
    eventsSection.appendChild(el('div', { className: 'bd-drawer-h', text: 'Upcoming events' }));
    var eventsLoading = el('p', { className: 'bd-drawer-p', text: 'Loading events\u2026' });
    eventsSection.appendChild(eventsLoading);
    body.appendChild(eventsSection);
    var footer = el('div', { className: 'bd-drawer-footer' });
    var regMain = programRegisterHref(program, boot);
    if (regMain) {
      footer.appendChild(
        el('a', {
          className: 'bd-btn',
          href: regMain,
          target: t,
          rel: 'noopener noreferrer',
          text: allSessionsRegistrationClosed(program) ? 'More info' : 'Register',
          'data-bd-external': '1',
        }),
      );
    }
    footer.appendChild(
      el('a', {
        className: 'bd-btn bd-btn--ghost',
        href: programDetailUrl,
        target: t,
        rel: 'noopener noreferrer',
        text: 'Full program page',
        'data-bd-external': '1',
      }),
    );
    dialog.appendChild(hero);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    backdrop.appendChild(dialog);
    shadow.appendChild(backdrop);
    fetchScheduleRows(origin, boot.slug)
      .then(function (allRows) {
        if (!eventsLoading.parentNode) return;
        eventsSection.removeChild(eventsLoading);
        var pid = String(program.id);
        var evs = allRows
          .filter(function (r) {
            return String(r.programId || '') === pid;
          })
          .slice(0, MAX_DRAWER_EVENTS);
        if (!evs.length) {
          eventsSection.appendChild(
            el('p', {
              className: 'bd-drawer-p',
              text: 'No events were returned for this program in the embed preview window. Open the schedule on discovery for the full calendar.',
            }),
          );
          return;
        }
        evs.forEach(function (ev) {
          var when = formatEventWhen(ev);
          var seg = ev.segmentName ? ' \u00b7 ' + ev.segmentName : '';
          var line =
            when.date +
            (when.time ? ' \u00b7 ' + when.time : '') +
            ' \u00b7 ' +
            (ev.title || ev.programName || 'Event') +
            seg;
          var viewHref = scheduleDeepLinkForEvent(boot, ev, program.id);
          eventsSection.appendChild(
            el('div', { className: 'bd-event-mini' }, [
              el('div', { style: { fontSize: '0.82rem', fontWeight: '600', color: '#0f172a' }, text: line }),
              viewHref
                ? el('div', { style: { marginTop: '0.35rem' } }, [
                    el('a', {
                      className: 'bd-btn bd-btn--ghost',
                      href: viewHref,
                      target: t,
                      rel: 'noopener noreferrer',
                      text: 'Open on schedule',
                      'data-bd-external': '1',
                    }),
                  ])
                : el('span'),
            ]),
          );
        });
      })
      .catch(function () {
        if (!eventsLoading.parentNode) return;
        eventsSection.removeChild(eventsLoading);
        eventsSection.appendChild(
          el('p', {
            className: 'bd-drawer-p',
            text: 'Events could not be loaded. Try again from the full discovery page.',
          }),
        );
      });
  }

  function attachProgramDetailClicks(shadow, boot, mount, origin, t) {
    if (boot.features.linkBehavior !== 'in_frame') return;
    shadow.addEventListener(
      'click',
      function (e) {
        var a = e.target && e.target.closest('a.bd-detail-link');
        if (!a || !shadow.contains(a)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        var rawId = a.getAttribute('data-bd-program-id');
        var programs = embedProgramsByMount.get(mount) || [];
        var program = null;
        for (var i = 0; i < programs.length; i++) {
          if (String(programs[i].id) === String(rawId)) {
            program = programs[i];
            break;
          }
        }
        if (!program) return;
        openProgramDetailDrawer(shadow, program, boot, origin, t);
      },
      true,
    );
  }

  function attachBondOverlayNavigation(shadow, boot) {
    if (boot.features.linkBehavior !== 'in_frame') return;
    shadow.addEventListener(
      'click',
      function (e) {
        var a = e.target && e.target.closest('a');
        if (!a || !shadow.contains(a)) return;
        if (a.classList.contains('bd-detail-link')) return;
        if (a.getAttribute('data-bd-external') === '1') return;
        var href = a.getAttribute('href');
        if (!href) return;
        if (href.indexOf('http:') !== 0 && href.indexOf('https:') !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        openBondOverlay(
          shadow,
          href,
          a.getAttribute('aria-label') || a.textContent.trim() || 'Bond',
        );
      },
      true,
    );
  }

  function footerLinks(boot) {
    var full = boot.paths.fullDiscoveryUrl;
    return el('div', { className: 'bd-foot' }, [
      el('div', { className: 'bd-foot-inner' }, [
        el('span', { text: 'Need filters, exports, or calendar views?' }),
        el('a', {
          href: full,
          target: '_blank',
          rel: 'noopener noreferrer',
          text: 'Open full discovery',
          'data-bd-external': '1',
        }),
        el('span', { text: '\u00b7' }),
        el('a', {
          href: boot.paths.embedIframeUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
          text: 'Legacy iframe embed',
          'data-bd-external': '1',
        }),
      ]),
    ]);
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
        embedProgramsByMount.set(mount, programs);
        var theme = readThemeFromMount(mount, options.theme);
        shadow.querySelector('style').textContent = baseStyles(
          boot.branding || {},
          theme,
        );
        applyHostFontVars(mount);
        var template =
          options.portalTemplate ||
          boot.features.embedPortalTemplate ||
          'classic';
        if (template === 'hero-carousel') {
          mountHeroCarousel(shadow, programs, boot, origin, mount);
        } else if (template === 'schedule-first') {
          mountScheduleFirst(shadow, programs, boot, origin, mount);
        } else {
          mountClassicShell(shadow, programs, boot, origin, mount);
        }
      })
      .catch(function (err) {
        while (shadow.firstChild) {
          shadow.removeChild(shadow.firstChild);
        }
        shadow.appendChild(style);
        shadow.appendChild(
          el('div', { className: 'bd-shell' }, [
            el('div', { className: 'bd-panel bd-panel--active' }, [
              el('p', { text: 'Discovery could not be loaded.' }),
              el('pre', {
                style: { color: '#b91c1c', fontSize: '12px', whiteSpace: 'pre-wrap' },
                text: String(err && err.message ? err.message : err),
              }),
            ]),
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
