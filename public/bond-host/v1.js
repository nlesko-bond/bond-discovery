/* Bond Host Shell v1 — partner-page script that owns discovery iframe sizing.
 *
 * Programs load in an iframe (/portal/{slug}); the kit sets height from discovery-resize
 * postMessages, re-measures on parent viewport changes, and applies margin-top for fixed nav
 * (data-bond-chrome-offset-px) so content aligns with the partner layout without raw iframe embeds.
 */
(function (global) {
  'use strict';

  var MIN_IFRAME_HEIGHT_PX = 480;
  var MOBILE_CHROME_MAX_WIDTH_PX = 767;
  var MSG_OPEN_TAB = 'bond:open_tab';
  var MSG_RESIZE = 'bond:resize';
  var MSG_RESIZE_LEGACY = 'discovery-resize';
  var MSG_CHROME_OFFSET = 'bond:chrome-offset';
  var MSG_REQUEST_CHROME_OFFSET = 'bond:request-chrome-offset';
  var MSG_REQUEST_RESIZE = 'bond:request-resize';
  var MSG_GTM_EVENT = 'BOND_GTM_EVENT';
  var EMBED_CHROME_QUERY_PARAM = 'embedChromePx';
  var CHECKOUT_QUERY_PARAM = 'bondPath';

  function getScriptOrigin() {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src;
      if (src && src.indexOf('/bond-host/v1') !== -1) {
        return new URL(src).origin;
      }
    }
    return '';
  }

  function normalizePrefix(prefix) {
    if (!prefix) return '/programs';
    return prefix.charAt(0) === '/' ? prefix : '/' + prefix;
  }

  function isDiscoveryLandingPath(locationPath, prefix) {
    return locationPath === prefix || locationPath === prefix + '/';
  }

  function isCheckoutPath(locationPath, prefix) {
    if (!pathMatchesPrefix(locationPath, prefix)) return false;
    return !isDiscoveryLandingPath(locationPath, prefix);
  }

  function pathMatchesPrefix(locationPath, prefix) {
    return locationPath === prefix || locationPath.indexOf(prefix + '/') === 0;
  }

  function readChromeOffsetPx(mountEl) {
    var mobileRaw = mountEl.getAttribute('data-bond-chrome-offset-px-mobile');
    var desktopRaw = mountEl.getAttribute('data-bond-chrome-offset-px');
    var useMobile =
      mobileRaw &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: ' + MOBILE_CHROME_MAX_WIDTH_PX + 'px)').matches;
    var raw = useMobile ? mobileRaw : desktopRaw;
    if (!raw) return 0;
    var n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function setIframeHeight(iframe, height) {
    if (!iframe) return;
    var resolvedHeight = Math.max(height, MIN_IFRAME_HEIGHT_PX);
    iframe.style.height = resolvedHeight + 'px';
    iframe.style.minHeight = resolvedHeight + 'px';
  }

  function applyCheckoutFallbackHeight(iframe, chromeOffsetPx) {
    if (!iframe) return;
    if (chromeOffsetPx > 0) {
      iframe.style.height = 'calc(100dvh - ' + chromeOffsetPx + 'px)';
      iframe.style.minHeight = 'calc(100dvh - ' + chromeOffsetPx + 'px)';
    } else {
      iframe.style.height = '100dvh';
      iframe.style.minHeight = '100dvh';
    }
  }

  function partnerOrigin(boot) {
    if (boot.partnerPublicOrigin) {
      return boot.partnerPublicOrigin.replace(/\/$/, '');
    }
    return window.location.origin;
  }

  /**
   * Host shell on the partner page: mounts discovery/checkout iframes and keeps discovery
   * iframe height in sync with content and partner chrome (nav offset, viewport resize).
   */
  function BondHostShell(options) {
    this.slug = options.slug;
    this.discoveryBase = (options.discoveryBase || getScriptOrigin()).replace(/\/$/, '');
    this.mount = options.mount;
    this.chromeOffsetPx = options.chromeOffsetPx || 0;
    this.bootstrap = null;
    this.activeIframe = null;
  }

  BondHostShell.prototype.fetchBootstrap = function () {
    var self = this;
    var url =
      self.discoveryBase + '/api/host/bootstrap?slug=' + encodeURIComponent(self.slug);
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Host bootstrap failed: ' + r.status);
      return r.json();
    });
  };

  BondHostShell.prototype.applyDiscoveryIframeChrome = function (iframe) {
    if (this.chromeOffsetPx > 0) {
      iframe.style.marginTop = this.chromeOffsetPx + 'px';
    } else {
      iframe.style.marginTop = '';
    }
  };

  BondHostShell.prototype.syncChromeOffsetFromMount = function () {
    if (!this.mount) return;
    var next = readChromeOffsetPx(this.mount);
    if (next === this.chromeOffsetPx) return;
    this.chromeOffsetPx = next;
    if (this.activeIframe) {
      this.applyDiscoveryIframeChrome(this.activeIframe);
    }
  };

  BondHostShell.prototype.requestDiscoveryResize = function () {
    if (
      !this.activeIframe ||
      this.activeIframe.getAttribute('data-bond-discovery-iframe') !== '1' ||
      !this.activeIframe.contentWindow
    ) {
      return;
    }
    try {
      this.activeIframe.contentWindow.postMessage({ type: MSG_REQUEST_RESIZE }, '*');
    } catch (e) {
      /* cross-origin guard */
    }
  };

  BondHostShell.prototype.bindParentResize = function () {
    var self = this;
    window.addEventListener('resize', function () {
      self.syncChromeOffsetFromMount();
      self.requestDiscoveryResize();
    });
  };

  BondHostShell.prototype.mountDiscovery = function () {
    var boot = this.bootstrap;
    var self = this;
    var iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Programs');
    iframe.setAttribute('data-bond-discovery-iframe', '1');
    iframe.style.cssText =
      'width:100%;border:0;display:block;min-height:' + MIN_IFRAME_HEIGHT_PX + 'px';
    this.applyDiscoveryIframeChrome(iframe);
    iframe.src = boot.paths.portalDiscoveryUrl;
    iframe.addEventListener('load', function () {
      if (iframe.contentWindow) {
        try {
          iframe.contentWindow.scrollTo(0, 0);
        } catch (e) {
          /* cross-origin guard */
        }
      }
      self.requestDiscoveryResize();
    });
    this.activeIframe = iframe;
    this.mount.appendChild(iframe);
  };

  BondHostShell.prototype.mountCheckout = function (path, search) {
    var boot = this.bootstrap;
    var src = boot.consumerOrigin.replace(/\/$/, '') + path + (search || '');
    var iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Registration');
    iframe.setAttribute('data-bond-checkout-iframe', '1');
    iframe.style.cssText = 'width:100%;border:0;display:block';
    applyCheckoutFallbackHeight(iframe, this.chromeOffsetPx);
    iframe.src = src;
    this.activeIframe = iframe;
    this.mount.style.overflow = 'hidden';
    this.mount.textContent = '';
    this.mount.appendChild(iframe);
  };

  BondHostShell.prototype.openRegistrationTab = function (path, search) {
    var boot = this.bootstrap;
    var landing = boot.checkoutLandingPath || '/programs/register';
    var bondPath = path + (search || '');
    var url =
      partnerOrigin(boot) +
      landing +
      '?' +
      CHECKOUT_QUERY_PARAM +
      '=' +
      encodeURIComponent(bondPath);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  BondHostShell.prototype.parseBondPathQuery = function (raw) {
    if (!raw) return null;
    try {
      var decoded = decodeURIComponent(raw);
      var q = decoded.indexOf('?');
      if (q === -1) {
        return { path: decoded, search: '' };
      }
      return { path: decoded.slice(0, q), search: decoded.slice(q) };
    } catch (e) {
      return null;
    }
  };

  BondHostShell.prototype.onMessage = function (event) {
    var boot = this.bootstrap;
    if (!boot || !event.data || typeof event.data !== 'object') return;
    var allowed = [boot.discoveryOrigin, boot.consumerOrigin];
    if (allowed.indexOf(event.origin) === -1) return;

    var data = event.data;
    if (data.type === MSG_OPEN_TAB && typeof data.path === 'string') {
      this.openRegistrationTab(data.path, data.search || '');
      return;
    }
    if (data.type === MSG_REQUEST_CHROME_OFFSET && event.source) {
      event.source.postMessage(
        { type: MSG_CHROME_OFFSET, px: this.chromeOffsetPx || 0 },
        event.origin,
      );
      return;
    }
    if (data.type === MSG_GTM_EVENT) {
      this.forwardGtmEvent(data, event.origin);
      return;
    }
    if (
      (data.type === MSG_RESIZE || data.type === MSG_RESIZE_LEGACY) &&
      typeof data.height === 'number'
    ) {
      var height = data.height;
      if (this.activeIframe && this.activeIframe.getAttribute('data-bond-checkout-iframe') === '1') {
        height = height + this.chromeOffsetPx;
      }
      setIframeHeight(this.activeIframe, height);
    }
  };

  BondHostShell.prototype.forwardGtmEvent = function (data, origin) {
    try {
      // Conversion events come only from the Bond checkout (consumer origin).
      if (origin !== this.bootstrap.consumerOrigin) return;
      var payload = data.dataLayerEvent;
      if (!payload || typeof payload !== 'object' || typeof payload.event !== 'string') return;
      window.dataLayer = window.dataLayer || [];
      if (window.__bondGtmListenerAttached) return; // partner already runs Bond's manual listener; avoid double-push
      if (payload.ecommerce) {
        window.dataLayer.push({ ecommerce: null }); // GA4: clear previous ecommerce object
      }
      window.dataLayer.push(payload);
    } catch (e) {
      /* analytics must never break the partner page */
    }
  };

  BondHostShell.prototype.routeInitial = function () {
    var boot = this.bootstrap;
    var prefix = normalizePrefix(boot.linkSeoPathPrefix);
    var path = window.location.pathname;
    var search = window.location.search || '';
    var params = new URLSearchParams(search);
    var bondPathRaw = params.get(CHECKOUT_QUERY_PARAM);
    var parsedQuery = this.parseBondPathQuery(bondPathRaw);

    if (parsedQuery) {
      this.mountCheckout(parsedQuery.path, parsedQuery.search);
      return;
    }

    if (isCheckoutPath(path, prefix)) {
      this.mountCheckout(path, search);
      return;
    }

    this.mountDiscovery();
  };

  BondHostShell.prototype.init = function () {
    var self = this;
    if (!self.mount || !self.slug) {
      console.error('BondHost.init: mount and slug are required');
      return Promise.resolve();
    }
    return self.fetchBootstrap().then(function (boot) {
      self.bootstrap = boot;
      self.routeInitial();
      self.bindParentResize();
      window.addEventListener('message', function (e) {
        self.onMessage(e);
      });
    });
  };

  function initFromMount(mountEl) {
    var slug = mountEl.getAttribute('data-bond-slug');
    var discoveryBase = mountEl.getAttribute('data-bond-discovery-base') || getScriptOrigin();
    if (!slug) {
      console.error('BondHost: data-bond-slug is required on mount element');
      return;
    }
    if (mountEl.getAttribute('data-bond-host-initialized') === '1') {
      return;
    }
    mountEl.setAttribute('data-bond-host-initialized', '1');
    mountEl.textContent = '';
    var shell = new BondHostShell({
      slug: slug,
      discoveryBase: discoveryBase,
      mount: mountEl,
      chromeOffsetPx: readChromeOffsetPx(mountEl),
    });
    shell.init().catch(function (err) {
      console.error('BondHost init failed', err);
      mountEl.textContent = 'Programs could not be loaded.';
    });
  }

  global.BondHost = {
    init: function (options) {
      var mount =
        typeof options.mount === 'string'
          ? document.querySelector(options.mount)
          : options.mount;
      if (!mount) {
        console.error('BondHost.init: mount not found');
        return Promise.resolve();
      }
      mount.setAttribute('data-bond-slug', options.slug);
      if (options.discoveryBase) {
        mount.setAttribute('data-bond-discovery-base', options.discoveryBase);
      }
      initFromMount(mount);
      return Promise.resolve();
    },
  };

  function autoInit() {
    var nodes = document.querySelectorAll('[data-bond-host]');
    for (var i = 0; i < nodes.length; i++) {
      initFromMount(nodes[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})(typeof window !== 'undefined' ? window : globalThis);
