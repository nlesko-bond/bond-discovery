import { getAllPageConfigs } from '@/lib/config';
import { 
  Building2, 
  FileText, 
  Calendar,
  Globe,
  Settings,
  ExternalLink,
  Plus,
  Eye
} from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboard() {
  const pages = await getAllPageConfigs();
  const totalOrgs = new Set(pages.flatMap(p => p.organizationIds)).size;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Manage your Bond Discovery pages and configurations
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={FileText}
          label="Discovery Pages"
          value={pages.length}
          color="blue"
        />
        <StatCard
          icon={Building2}
          label="Organizations"
          value={totalOrgs}
          color="green"
        />
        <StatCard
          icon={Eye}
          label="Active Pages"
          value={pages.filter(p => p.isActive !== false).length}
          color="purple"
        />
        <StatCard
          icon={Globe}
          label="Status"
          value="Live"
          color="amber"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <QuickActionCard
          href="/admin/pages"
          icon={FileText}
          title="Manage Pages"
          description="Create and configure discovery pages"
        />
        <QuickActionCard
          href="/admin/branding"
          icon={Settings}
          title="Default Branding"
          description="Update colors, logo, and styling"
        />
        <QuickActionCard
          href="/toca"
          icon={ExternalLink}
          title="View TOCA Page"
          description="Preview the main discovery page"
          external
        />
      </div>

      {/* Pages Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Discovery Pages</h2>
          <Link
            href="/admin/pages"
            className="text-sm text-toca-purple hover:text-toca-purple-dark font-medium flex items-center gap-1"
          >
            <Plus size={16} />
            New Page
          </Link>
        </div>
        
        {pages.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No pages created yet. Create your first discovery page to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {pages.slice(0, 5).map(page => (
              <div
                key={page.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: page.branding.primaryColor }}
                  >
                    {page.branding.companyName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{page.name}</p>
                    <p className="text-sm text-gray-500">/{page.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    page.isActive !== false
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {page.isActive !== false ? 'Active' : 'Draft'}
                  </span>
                  <Link
                    href={`/${page.slug}`}
                    target="_blank"
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ExternalLink size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {pages.length > 5 && (
          <Link
            href="/admin/pages"
            className="block text-center text-sm text-toca-purple hover:text-toca-purple-dark font-medium mt-4"
          >
            View all {pages.length} pages →
          </Link>
        )}
      </div>

      {/* Embed Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Embedding in Webflow</h3>
        <p className="text-sm text-blue-800 mb-3">
          Use the embed URL to add discovery pages to your Webflow site:
        </p>
        <code className="block bg-white p-3 rounded-lg text-sm font-mono text-blue-700 mb-3">
          &lt;iframe src="https://your-domain.com/embed/toca" width="100%" height="800"&gt;&lt;/iframe&gt;
        </code>
        <p className="text-xs text-blue-600">
          Replace "toca" with your page slug and update the domain after deployment.
        </p>
      </div>
    </div>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  color: 'blue' | 'green' | 'purple' | 'amber';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({ 
  href, 
  icon: Icon, 
  title, 
  description,
  external = false
}: { 
  href: string;
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-toca-purple hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-toca-purple/10 transition-colors">
          <Icon size={20} className="text-gray-600 group-hover:text-toca-purple transition-colors" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 group-hover:text-toca-purple transition-colors">
            {title}
            {external && <ExternalLink size={14} className="inline ml-1" />}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
      </div>
    </Link>
  );
}
