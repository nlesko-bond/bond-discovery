export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Help & Documentation</h1>
      
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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
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

        {/* Embedding */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Embedding in Webflow</h2>
          <p className="text-gray-600 mb-4">
            Use the /embed/ version for iframe embedding:
          </p>
          
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
            <pre>{`<iframe 
  src="https://bond-discovery.vercel.app/embed/toca"
  width="100%"
  height="800"
  frameborder="0"
></iframe>`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
