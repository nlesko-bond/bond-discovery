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
   * Track page view
   */
  pageView: (pagePath: string, pageTitle: string) => {
    gtmEvent.push('page_view', {
      page_path: pagePath,
      page_title: pageTitle,
    });
  },

  /**
   * Track program view
   */
  viewProgram: (program: { id: string; name: string; type?: string; sport?: string }) => {
    gtmEvent.push('view_program', {
      program_id: program.id,
      program_name: program.name,
      program_type: program.type,
      sport: program.sport,
    });
  },

  /**
   * Track session view
   */
  viewSession: (session: { id: string; name: string; programId: string; programName: string }) => {
    gtmEvent.push('view_session', {
      session_id: session.id,
      session_name: session.name,
      program_id: session.programId,
      program_name: session.programName,
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

  /**
   * Track filter applied
   */
  filterApplied: (filterType: string, filterValue: string | string[]) => {
    gtmEvent.push('filter_applied', {
      filter_type: filterType,
      filter_value: Array.isArray(filterValue) ? filterValue.join(',') : filterValue,
    });
  },

  /**
   * Track view mode change
   */
  viewModeChanged: (fromView: string, toView: string) => {
    gtmEvent.push('view_mode_changed', {
      from_view: fromView,
      to_view: toView,
    });
  },

  /**
   * Track schedule view change
   */
  scheduleViewChanged: (viewType: string) => {
    gtmEvent.push('schedule_view_changed', {
      view_type: viewType,
    });
  },

  /**
   * Track share link clicked
   */
  shareLink: (pageSlug: string, url: string) => {
    gtmEvent.push('share_link', {
      page_slug: pageSlug,
      shared_url: url,
    });
  },

  /**
   * Track event click (calendar event)
   */
  clickEvent: (event: {
    id: string;
    title: string;
    programId?: string;
    programName?: string;
    sessionId?: string;
  }) => {
    gtmEvent.push('click_event', {
      event_id: event.id,
      event_title: event.title,
      program_id: event.programId,
      program_name: event.programName,
      session_id: event.sessionId,
    });
  },
};

export default GoogleTagManager;
