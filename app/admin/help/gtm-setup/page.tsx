'use client';

import Link from 'next/link';
import { ArrowLeft, Copy, Check, ExternalLink, Tag, MousePointer, Eye, Share2, Filter, Calendar } from 'lucide-react';
import { useState } from 'react';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
    </button>
  );
}

function CodeBlock({ code, language = 'javascript' }: { code: string; language?: string }) {
  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-400">{language}</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 overflow-x-auto text-sm text-gray-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function GTMSetupPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/admin/help"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} />
          Back to Help
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Google Tag Manager Setup Guide</h1>
        <p className="text-gray-600 mt-2">
          Learn how to configure Google Tag Manager to capture events from your Discovery pages.
        </p>
      </div>

      {/* Quick Start */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Tag className="text-blue-500" size={20} />
          Quick Start
        </h2>
        <ol className="space-y-4 text-gray-700">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">1</span>
            <div>
              <p className="font-medium">Get your GTM Container ID</p>
              <p className="text-sm text-gray-500">Find it in GTM under Admin → Container Settings (format: GTM-XXXXXX)</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">2</span>
            <div>
              <p className="font-medium">Add GTM ID to Bond Discovery</p>
              <p className="text-sm text-gray-500">
                Go to <Link href="/admin/partners" className="text-blue-600 hover:underline">Partner Groups</Link> or{' '}
                <Link href="/admin/pages" className="text-blue-600 hover:underline">Pages</Link> → Settings → Analytics
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">3</span>
            <div>
              <p className="font-medium">Create triggers and tags in GTM</p>
              <p className="text-sm text-gray-500">Follow the setup instructions below for each event you want to track</p>
            </div>
          </li>
        </ol>
      </section>

      {/* Events Reference */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Events Reference</h2>
        <p className="text-gray-600 mb-6">
          Bond Discovery automatically pushes these events to the GTM dataLayer:
        </p>
        
        <div className="space-y-6">
          {/* click_register */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-3">
              <MousePointer className="text-green-500" size={18} />
              <div>
                <h3 className="font-semibold text-gray-900">click_register</h3>
                <p className="text-sm text-gray-500">Fired when a user clicks a Register button</p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Data Layer Variables:</p>
              <CodeBlock code={`{
  event: "click_register",
  program_id: "3817",
  program_name: "Flag Football",
  session_id: "87596",
  session_name: "Winter 2 - 12U Coed",
  product_id: "119110",
  price: 299,
  currency: "USD"
}`} />
            </div>
          </div>

          {/* view_mode_changed */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-3">
              <Eye className="text-purple-500" size={18} />
              <div>
                <h3 className="font-semibold text-gray-900">view_mode_changed</h3>
                <p className="text-sm text-gray-500">Fired when user switches between Programs and Schedule views</p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Data Layer Variables:</p>
              <CodeBlock code={`{
  event: "view_mode_changed",
  from_view: "programs",
  to_view: "schedule"
}`} />
            </div>
          </div>

          {/* share_link */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-3">
              <Share2 className="text-blue-500" size={18} />
              <div>
                <h3 className="font-semibold text-gray-900">share_link</h3>
                <p className="text-sm text-gray-500">Fired when user clicks the Share button</p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Data Layer Variables:</p>
              <CodeBlock code={`{
  event: "share_link",
  page_slug: "toca-evanston",
  shared_url: "https://discovery.bondsports.co/toca-evanston?programIds=3817"
}`} />
            </div>
          </div>

          {/* schedule_view_changed */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-3">
              <Calendar className="text-orange-500" size={18} />
              <div>
                <h3 className="font-semibold text-gray-900">schedule_view_changed</h3>
                <p className="text-sm text-gray-500">Fired when user changes schedule view type</p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Data Layer Variables:</p>
              <CodeBlock code={`{
  event: "schedule_view_changed",
  view_type: "table"  // list, table, day, week, month
}`} />
            </div>
          </div>

          {/* filter_applied */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-3">
              <Filter className="text-indigo-500" size={18} />
              <div>
                <h3 className="font-semibold text-gray-900">filter_applied</h3>
                <p className="text-sm text-gray-500">Fired when user applies a filter</p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Data Layer Variables:</p>
              <CodeBlock code={`{
  event: "filter_applied",
  filter_type: "program",
  filter_value: "3817,3818"  // comma-separated if multiple
}`} />
            </div>
          </div>
        </div>
      </section>

      {/* GTM Setup Instructions */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">GTM Configuration</h2>
        
        <div className="space-y-8">
          {/* Step 1: Create Variables */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Step 1: Create Data Layer Variables</h3>
            <p className="text-gray-600 mb-4">
              In GTM, go to <strong>Variables → New → Data Layer Variable</strong> and create variables for each data point you want to track:
            </p>
            <div className="bg-gray-50 rounded-lg p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pb-2">Variable Name</th>
                    <th className="pb-2">Data Layer Variable Name</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  <tr><td className="py-1">DLV - Program ID</td><td className="py-1 font-mono text-xs">program_id</td></tr>
                  <tr><td className="py-1">DLV - Program Name</td><td className="py-1 font-mono text-xs">program_name</td></tr>
                  <tr><td className="py-1">DLV - Session ID</td><td className="py-1 font-mono text-xs">session_id</td></tr>
                  <tr><td className="py-1">DLV - Session Name</td><td className="py-1 font-mono text-xs">session_name</td></tr>
                  <tr><td className="py-1">DLV - Price</td><td className="py-1 font-mono text-xs">price</td></tr>
                  <tr><td className="py-1">DLV - Currency</td><td className="py-1 font-mono text-xs">currency</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 2: Create Triggers */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Step 2: Create Triggers</h3>
            <p className="text-gray-600 mb-4">
              Create Custom Event triggers for each event:
            </p>
            <div className="bg-gray-50 rounded-lg p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pb-2">Trigger Name</th>
                    <th className="pb-2">Event Name</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  <tr><td className="py-1">CE - Click Register</td><td className="py-1 font-mono text-xs">click_register</td></tr>
                  <tr><td className="py-1">CE - View Mode Changed</td><td className="py-1 font-mono text-xs">view_mode_changed</td></tr>
                  <tr><td className="py-1">CE - Share Link</td><td className="py-1 font-mono text-xs">share_link</td></tr>
                  <tr><td className="py-1">CE - Schedule View Changed</td><td className="py-1 font-mono text-xs">schedule_view_changed</td></tr>
                  <tr><td className="py-1">CE - Filter Applied</td><td className="py-1 font-mono text-xs">filter_applied</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 3: Create GA4 Event Tag */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Step 3: Create GA4 Event Tags</h3>
            <p className="text-gray-600 mb-4">
              Example: GA4 Event tag for tracking registrations:
            </p>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
              <div><span className="text-gray-500">Tag Type:</span> <span className="font-medium">Google Analytics: GA4 Event</span></div>
              <div><span className="text-gray-500">Configuration Tag:</span> <span className="font-medium">Your GA4 Config Tag</span></div>
              <div><span className="text-gray-500">Event Name:</span> <span className="font-mono">click_register</span></div>
              <div>
                <span className="text-gray-500">Event Parameters:</span>
                <ul className="mt-2 ml-4 space-y-1 font-mono text-xs">
                  <li>program_id = {'{{DLV - Program ID}}'}</li>
                  <li>program_name = {'{{DLV - Program Name}}'}</li>
                  <li>session_id = {'{{DLV - Session ID}}'}</li>
                  <li>value = {'{{DLV - Price}}'}</li>
                  <li>currency = {'{{DLV - Currency}}'}</li>
                </ul>
              </div>
              <div><span className="text-gray-500">Trigger:</span> <span className="font-medium">CE - Click Register</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Testing */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Testing Your Setup</h2>
        <ol className="space-y-3 text-gray-700">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-sm font-bold">1</span>
            <div>
              <p>Enable <strong>Preview Mode</strong> in GTM</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-sm font-bold">2</span>
            <div>
              <p>Visit your Discovery page (e.g., discovery.bondsports.co/your-page)</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-sm font-bold">3</span>
            <div>
              <p>Perform actions (click Register, change views, apply filters)</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-sm font-bold">4</span>
            <div>
              <p>Check the Tag Assistant panel - you should see events firing</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-sm font-bold">5</span>
            <div>
              <p>Once verified, <strong>Publish</strong> your GTM container</p>
            </div>
          </li>
        </ol>
      </section>

      {/* Help */}
      <section className="bg-blue-50 rounded-xl border border-blue-200 p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Need Help?</h2>
        <p className="text-blue-700">
          Contact the Bond Sports team for assistance with your analytics setup.
        </p>
        <a 
          href="mailto:support@bondsports.co" 
          className="inline-flex items-center gap-2 mt-3 text-blue-600 hover:text-blue-800 font-medium"
        >
          support@bondsports.co
          <ExternalLink size={14} />
        </a>
      </section>
    </div>
  );
}
