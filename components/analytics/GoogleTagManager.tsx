'use client';

import Script from 'next/script';
import { useEffect, useRef } from 'react';

// Bond's system-level GTM container ID - tracks all discovery pages
const BOND_SYSTEM_GTM_ID = process.env.NEXT_PUBLIC_BOND_GTM_ID;

interface GoogleTagManagerProps {
  gtmId?: string; // Partner-specific GTM ID (optional)
  pageSlug?: string; // For tracking which page
}

// Extend window type for GTM dataLayer
declare global {
  interface Window {
    dataLayer: any[];
  }
}

/**
 * Google Tag Manager component
 * Loads both Bond's system GTM (for internal analytics) and optional partner GTM
 */
export function GoogleTagManager({ gtmId, pageSlug }: GoogleTagManagerProps) {
  const initialized = useRef(false);
  
  // Initialize dataLayer with page context
  useEffect(() => {
    if (typeof window !== 'undefined' && !initialized.current) {
      window.dataLayer = window.dataLayer || [];
      
      // Push initial page context
      if (pageSlug) {
        window.dataLayer.push({
          'bond_page_slug': pageSlug,
          'bond_timestamp': new Date().toISOString(),
        });
      }
      
      initialized.current = true;
    }
  }, [pageSlug]);
  
  // No GTM IDs configured
  if (!BOND_SYSTEM_GTM_ID && !gtmId) return null;

  // Get unique GTM IDs (avoid loading same container twice)
  const gtmIds = [...new Set([BOND_SYSTEM_GTM_ID, gtmId].filter(Boolean))] as string[];

  return (
    <>
      {/* GTM Scripts - one for each container */}
      {gtmIds.map((id, index) => (
        <Script
          key={id}
          id={`gtm-script-${index}`}
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${id}');
            `,
          }}
        />
      ))}
      {/* GTM NoScript - for users without JavaScript */}
      {gtmIds.map((id) => (
        <noscript key={`noscript-${id}`}>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${id}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      ))}
    </>
  );
}

/**
 * GTM Event Tracking utilities
 */
export const gtmEvent = {
  /**
   * Push a custom event to GTM dataLayer
   */
  push: (event: string, data?: Record<string, any>) => {
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event,
        ...data,
      });
    }
  },

  /**
   * Track page view. Fired exactly once per page load (mount effect) — the
   * discovery surface intentionally emits only page_view + register-intent
   * clicks to partner GTM containers. page_location / page_referrer are
   * included so partner GA4 can distinguish the iframe context.
   */
  pageView: (pagePath: string, pageTitle: string) => {
    gtmEvent.push('page_view', {
      page_path: pagePath,
      page_title: pageTitle,
      page_location: typeof window !== 'undefined' ? window.location.href : undefined,
      page_referrer: typeof document !== 'undefined' ? document.referrer : undefined,
    });
  },

  /**
   * Track register button click
   */
  clickRegister: (data: {
    programId: string;
    programName: string;
    sessionId?: string;
    sessionName?: string;
    productId?: string;
    price?: number;
    currency?: string;
  }) => {
    gtmEvent.push('click_register', {
      program_id: data.programId,
      program_name: data.programName,
      session_id: data.sessionId,
      session_name: data.sessionName,
      product_id: data.productId,
      price: data.price,
      currency: data.currency || 'USD',
    });
  },

  clickRedeemPass: (data: {
    eventId: string;
    programId: string;
    programName: string;
    sessionId?: string;
    sessionName?: string;
  }) => {
    gtmEvent.push('click_redeem_pass', {
      event_id: data.eventId,
      program_id: data.programId,
      program_name: data.programName,
      session_id: data.sessionId,
      session_name: data.sessionName,
    });
  },
};

export default GoogleTagManager;
