import { supabase } from '@/lib/supabase';
import { 
  Users, 
  FileText, 
  Globe,
  ExternalLink,
  Plus,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

async function getStats() {
  const { data: partners } = await supabase
    .from('partner_groups')
    .select('id, name, branding')
    .eq('is_active', true);
  
  const { data: pages } = await supabase
    .from('discovery_pages')
    .select('id, name, slug, branding, is_active, partner_group_id')
    .eq('is_active', true);
  
  return {
    partnerCount: partners?.length || 0,
    pageCount: pages?.length || 0,
    partners: partners || [],
    pages: pages || [],
  };
}

export default async function AdminDashboard() {
  const { partnerCount, pageCount, partners, pages } = await getStats();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Manage partner groups and discovery pages
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          icon={Users}
          label="Partner Groups"
          value={partnerCount}
          color="blue"
        />
        <StatCard
          icon={FileText}
          label="Discovery Pages"
          value={pageCount}
          color="green"
        />
        <StatCard
          icon={Globe}
          label="Status"
          value="Live"
          color="purple"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <QuickActionCard
          href="/admin/partners"
          icon={Users}
          title="Manage Partners"
          description="Create and configure partner groups with shared branding"
        />
        <QuickActionCard
          href="/admin/pages"
          icon={FileText}
          title="All Discovery Pages"
          description="View and manage all discovery pages"
        />
      </div>

      {/* Partners Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Partner Groups</h2>
          <Link
            href="/admin/partners"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <Plus size={16} />
            New Partner
          </Link>
        </div>
        
        {partners.length === 0 ? (
          <div className="text-center py-8">
            <Users className="mx-auto mb-3 text-gray-300" size={40} />
            <p className="text-gray-500 mb-4">
              No partners created yet. Create your first partner group to get started.
            </p>
            <Link href="/admin/partners" className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} />
              Create Partner
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {partners.slice(0, 5).map((partner: any) => {
              const partnerPages = pages.filter((p: any) => p.partner_group_id === partner.id);
              return (
                <div
                  key={partner.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: partner.branding?.primaryColor || '#1E2761' }}
                    >
                      {partner.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{partner.name}</p>
                      <p className="text-sm text-gray-500">{partnerPages.length} pages</p>
                    </div>
                  </div>
                  <Link
                    href={`/admin/partners/${partner.id}`}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    Manage <ArrowRight size={14} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Pages */}
      {pages.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Recent Pages</h2>
            <Link
              href="/admin/pages"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View all →
            </Link>
          </div>
          
          <div className="space-y-2">
            {pages.slice(0, 5).map((page: any) => (
              <div
                key={page.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: page.branding?.primaryColor || '#1E2761' }}
                  >
                    {page.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{page.name}</p>
                    <code className="text-xs text-gray-500">/{page.slug}</code>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/${page.slug}`}
                    target="_blank"
                    className="p-1.5 text-gray-400 hover:text-gray-600"
                    title="View page"
                  >
                    <ExternalLink size={14} />
                  </Link>
                  <Link
                    href={`/admin/pages/${page.slug}`}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Getting Started */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Getting Started</h3>
        <ol className="space-y-2 text-sm text-gray-700">
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">1.</span>
            Create a Partner Group (e.g., "Socceroof") with branding and API key
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">2.</span>
            Add Discovery Pages under the partner (e.g., "/socceroof-nyc", "/socceroof-canada")
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">3.</span>
            Configure filters and settings for each page
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">4.</span>
            Share the page URLs or embed them in websites
          </li>
        </ol>
        <Link 
          href="/admin/help" 
          className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Read full documentation →
        </Link>
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
  color: 'blue' | 'green' | 'purple';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
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
}: { 
  href: string;
  icon: React.ComponentType<any>;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-blue-50 transition-colors">
          <Icon size={20} className="text-gray-600 group-hover:text-blue-600 transition-colors" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {title}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
      </div>
    </Link>
  );
}
