/* Bond Host Shell v1 — partner parent page. Load once; mount discovery + checkout iframes. */
(function (global) {
  'use strict';

  var MIN_IFRAME_HEIGHT_PX = 480;
  var MSG_NAVIGATE = 'bond:navigate';
  var MSG_RESIZE = 'bond:resize';
  var MSG_RESIZE_LEGACY = 'discovery-resize';
  var MSG_POPSTATE = 'bond:popstate';

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

  function pathMatchesCheckout(locationPath, prefix) {
    return locationPath === prefix || locationPath.indexOf(prefix + '/') === 0;
  }

  function setIframeHeight(iframe, height) {
    if (!iframe) return;
    iframe.style.height = Math.max(height, MIN_IFRAME_HEIGHT_PX) + 'px';
  }

  function BondHostShell(options) {
    this.slug = options.slug;
    this.discoveryBase = (options.discoveryBase || getScriptOrigin()).replace(/\/$/, '');
    this.mount = options.mount;
    this.discoveryPath = options.discoveryPath || '/programs';
    this.checkoutLayerId = options.checkoutLayerId || 'bond-checkout-layer';
    this.bootstrap = null;
    this.discoveryIframe = null;
    this.checkoutIframe = null;
    this.checkoutLayer = null;
    this.mode = 'discovery';
  }

  BondHostShell.prototype.fetchBootstrap = function () {
    var self = this;
    var url =
      self.discoveryBase +
      '/api/host/bootstrap?slug=' +
      encodeURIComponent(self.slug);
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Host bootstrap failed: ' + r.status);
      return r.json();
    });
  };

  BondHostShell.prototype.ensureCheckoutLayer = function () {
    if (this.checkoutLayer) return this.checkoutLayer;
    var layer = document.getElementById(this.checkoutLayerId);
    if (!layer) {
      layer = document.createElement('div');
      layer.id = this.checkoutLayerId;
      layer.setAttribute('data-bond-checkout-layer', '1');
      layer.style.cssText =
        'display:none;position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,0.45);padding:0.75rem;box-sizing:border-box';
      var dialog = document.createElement('div');
      dialog.style.cssText =
        'width:100%;height:100%;max-width:72rem;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.25)';
      var bar = document.createElement('div');
      bar.style.cssText =
        'flex-shrink:0;display:flex;justify-content:flex-end;padding:0.5rem 0.75rem;border-bottom:1px solid #e2e8f0;background:#f8fafc';
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.textContent = 'Close';
      closeBtn.style.cssText =
        'padding:0.35rem 0.85rem;border-radius:8px;border:1px solid #cbd5e1;background:#fff;font:inherit;font-weight:600;cursor:pointer';
      var self = this;
      closeBtn.addEventListener('click', function () {
        self.showDiscovery();
      });
      bar.appendChild(closeBtn);
      dialog.appendChild(bar);
      var frameWrap = document.createElement('div');
      frameWrap.style.cssText = 'flex:1;min-height:0';
      dialog.appendChild(frameWrap);
      layer.appendChild(dialog);
      layer._bondFrameWrap = frameWrap;
      document.body.appendChild(layer);
    }
    this.checkoutLayer = layer;
    return layer;
  };

  BondHostShell.prototype.showDiscovery = function () {
    this.mode = 'discovery';
    if (this.checkoutLayer) {
      this.checkoutLayer.style.display = 'none';
    }
    if (this.checkoutIframe && this.checkoutIframe.parentNode) {
      this.checkoutIframe.parentNode.removeChild(this.checkoutIframe);
      this.checkoutIframe = null;
    }
    if (this.discoveryIframe) {
      this.discoveryIframe.style.display = 'block';
    }
  };

  BondHostShell.prototype.showCheckout = function (path, search) {
    var boot = this.bootstrap;
    if (!boot) return;
    var src = boot.consumerOrigin.replace(/\/$/, '') + path + (search || '');
    this.mode = 'checkout';
    var layer = this.ensureCheckoutLayer();
    layer.style.display = 'block';
    if (this.discoveryIframe) {
      this.discoveryIframe.style.display = 'none';
    }
    if (!this.checkoutIframe) {
      this.checkoutIframe = document.createElement('iframe');
      this.checkoutIframe.setAttribute('title', 'Registration');
      this.checkoutIframe.style.cssText = 'width:100%;height:100%;border:0;display:block;min-height:60vh';
      layer._bondFrameWrap.appendChild(this.checkoutIframe);
    }
    if (this.checkoutIframe.src !== src) {
      this.checkoutIframe.src = src;
    }
    try {
      history.pushState({ bondCheckout: true, path: path, search: search || '' }, '', path + (search || ''));
    } catch (e) {}
  };

  BondHostShell.prototype.mountDiscoveryIframe = function () {
    var boot = this.bootstrap;
    var iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Programs');
    iframe.setAttribute('data-bond-discovery-iframe', '1');
    iframe.style.cssText = 'width:100%;border:0;display:block;min-height:' + MIN_IFRAME_HEIGHT_PX + 'px';
    iframe.src = boot.paths.portalDiscoveryUrl;
    this.discoveryIframe = iframe;
    this.mount.appendChild(iframe);
  };

  BondHostShell.prototype.onMessage = function (event) {
    var boot = this.bootstrap;
    if (!boot || !event.data || typeof event.data !== 'object') return;
    var allowed = [boot.discoveryOrigin, boot.consumerOrigin];
    if (allowed.indexOf(event.origin) === -1 && event.origin !== window.location.origin) {
      return;
    }
    var data = event.data;
    if (data.type === MSG_NAVIGATE && typeof data.path === 'string') {
      this.showCheckout(data.path, data.search || '');
      return;
    }
    if (
      (data.type === MSG_RESIZE || data.type === MSG_RESIZE_LEGACY) &&
      typeof data.height === 'number'
    ) {
      var target =
        this.mode === 'checkout' && this.checkoutIframe
          ? this.checkoutIframe
          : this.discoveryIframe;
      setIframeHeight(target, data.height);
    }
  };

  BondHostShell.prototype.onPopState = function () {
    var boot = this.bootstrap;
    var prefix = normalizePrefix(boot.linkSeoPathPrefix);
    var path = window.location.pathname;
    if (pathMatchesCheckout(path, prefix)) {
      this.showCheckout(path, window.location.search);
    } else {
      this.showDiscovery();
    }
  };

  BondHostShell.prototype.routeInitial = function () {
    var boot = this.bootstrap;
    var prefix = normalizePrefix(boot.linkSeoPathPrefix);
    var path = window.location.pathname;
    this.mountDiscoveryIframe();
    if (pathMatchesCheckout(path, prefix)) {
      this.showCheckout(path, window.location.search);
    }
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
      window.addEventListener('message', function (e) {
        self.onMessage(e);
      });
      window.addEventListener('popstate', function () {
        self.onPopState();
      });
    });
  };

  function initFromMount(mountEl) {
    var slug = mountEl.getAttribute('data-bond-slug');
    var discoveryBase = mountEl.getAttribute('data-bond-discovery-base') || getScriptOrigin();
    var discoveryPath = mountEl.getAttribute('data-bond-discovery-path') || '/programs';
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
      discoveryPath: discoveryPath,
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
