import Link from 'next/link';
import { Tag, Code, Book, ExternalLink } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Help & Documentation</h1>
      
      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link 
          href="/admin/help/gtm-setup"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <Tag className="text-blue-500 mb-3" size={24} />
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">GTM Setup Guide</h3>
          <p className="text-sm text-gray-500 mt-1">Configure Google Tag Manager for analytics</p>
        </Link>
        
        <Link 
          href="/admin/help#host-kit"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-green-300 hover:shadow-md transition-all group"
        >
          <Code className="text-green-500 mb-3" size={24} />
          <h3 className="font-semibold text-gray-900 group-hover:text-green-600">Host kit</h3>
          <p className="text-sm text-gray-500 mt-1">Embed discovery on partner sites via bond-host</p>
        </Link>
        
        <Link 
          href="/admin/help#deep-linking"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-purple-300 hover:shadow-md transition-all group"
        >
          <Book className="text-purple-500 mb-3" size={24} />
          <h3 className="font-semibold text-gray-900 group-hover:text-purple-600">URL Parameters</h3>
          <p className="text-sm text-gray-500 mt-1">Deep linking and filtering options</p>
        </Link>
      </div>
      
      <div className="space-y-6">
        {/* Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Overview</h2>
          <p className="text-gray-600 mb-4">
            Bond Discovery Admin lets you create branded program discovery pages for different partners.
          </p>
          
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-blue-50 rounded-lg">
              <strong className="text-blue-900">Partner Groups</strong>
              <p className="text-blue-800 mt-1">
                A partner (like Socceroof or TOCA) with shared branding, API key, and settings.
                Each partner can have multiple discovery pages.
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <strong className="text-green-900">Discovery Pages</strong>
              <p className="text-green-800 mt-1">
                Individual pages with unique URLs that show programs for specific organizations.
                Pages inherit branding from their partner group.
              </p>
            </div>
          </div>
        </div>

        {/* Workflow */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Setup Workflow</h2>
          
          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm">1</span>
              <div>
                <p className="font-medium text-gray-900">Create Partner Group</p>
                <p className="text-sm text-gray-600">
                  Go to Partner Groups → New Partner. Set name, branding colors, logo, and API key.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm">2</span>
              <div>
                <p className="font-medium text-gray-900">Add Discovery Pages</p>
                <p className="text-sm text-gray-600">
                  Click "Add Page" on the partner. Enter a URL slug and organization IDs.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm">3</span>
              <div>
                <p className="font-medium text-gray-900">Configure Filters</p>
                <p className="text-sm text-gray-600">
                  Click "Configure" on any page to customize which filters are shown.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm">4</span>
              <div>
                <p className="font-medium text-gray-900">Share the URL</p>
                <p className="text-sm text-gray-600">
                  Each page is available at /your-slug. Share this URL with partners.
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* URL Parameters */}
        <div id="deep-linking" className="bg-white rounded-xl border border-gray-200 p-6 scroll-mt-20">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Deep Linking</h2>
          <p className="text-gray-600 mb-4">
            You can pre-filter results using URL parameters:
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm space-y-2">
            <p><span className="text-blue-600">/toca</span>?facilityIds=123</p>
            <p><span className="text-blue-600">/toca</span>?programIds=456</p>
            <p><span className="text-blue-600">/toca</span>?viewMode=schedule</p>
            <p><span className="text-blue-600">/toca</span>?programTypes=camp_clinic</p>
          </div>
        </div>

        <div id="host-kit" className="bg-white rounded-xl border border-gray-200 p-6 scroll-mt-20">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Partner host kit</h2>
          <p className="text-gray-600 mb-4">
            The supported integration path is the Bond host kit: one script tag on the partner site
            mounts an iframe to <code className="bg-gray-100 px-1 rounded">/portal/&#123;slug&#125;</code>,
            handles checkout on the org domain, and forwards GTM conversion events. Full setup:{' '}
            <a
              className="text-blue-600 underline font-medium"
              href="/docs/partner-host-integration.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              partner host integration (markdown)
            </a>
          </p>
          <ol className="list-decimal list-inside text-sm text-gray-700 space-y-2 mb-4">
            <li>
              Set <code className="bg-gray-100 px-1 rounded">features.partnerPublicOrigin</code> and
              checkout paths in the page editor (Appearance → Partner site integration).
            </li>
            <li>
              Optional CORS lockdown: set{' '}
              <code className="bg-gray-100 px-1 rounded">features.embedAllowedOrigins</code> to exact
              partner origins — this gates cross-origin browser calls to{' '}
              <code className="bg-gray-100 px-1 rounded">/api/events</code>.
            </li>
            <li>
              Preview locally:{' '}
              <code className="bg-gray-100 px-1 rounded">/kit-harness.html?slug=YOUR_SLUG</code>
            </li>
          </ol>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
            <pre>{`<script src="https://YOUR-DISCOVERY-HOST/bond-host/v1.js" defer></script>

<div data-bond-host data-bond-slug="YOUR_SLUG"></div>`}</pre>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            The legacy embed kit (<code className="bg-gray-100 px-1 rounded">embed-kit/v1.js</code>)
            has been retired. Existing <code className="bg-gray-100 px-1 rounded">/embed/&#123;slug&#125;</code>{' '}
            URLs redirect to the public discovery page.
          </p>
        </div>
      </div>
    </div>
  );
}
