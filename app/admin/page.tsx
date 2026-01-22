import { getConfig } from '@/lib/config';
import { 
  Building2, 
  Users, 
  Calendar,
  TrendingUp,
  Settings,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboard() {
  const config = await getConfig('default');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Manage your Bond Discovery configuration
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Building2}
          label="Organizations"
          value={config.organizationIds.length}
          color="blue"
        />
        <StatCard
          icon={Users}
          label="Facilities"
          value={config.facilityIds.length || 'All'}
          color="green"
        />
        <StatCard
          icon={Calendar}
          label="Default View"
          value={config.features.defaultView === 'programs' ? 'Programs' : 'Schedule'}
          color="purple"
        />
        <StatCard
          icon={TrendingUp}
          label="Cache TTL"
          value={`${config.cacheTtl}s`}
          color="amber"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <QuickActionCard
          href="/admin/organizations"
          icon={Building2}
          title="Manage Organizations"
          description="Add or remove organization and facility IDs"
        />
        <QuickActionCard
          href="/admin/branding"
          icon={Settings}
          title="Customize Branding"
          description="Update colors, logo, and company name"
        />
        <QuickActionCard
          href="/"
          icon={ExternalLink}
          title="View Discovery"
          description="See your changes live"
          external
        />
      </div>

      {/* Current Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Current Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Branding</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Company:</span>
                <span className="font-medium">{config.branding.companyName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Primary Color:</span>
                <div 
                  className="w-6 h-6 rounded border border-gray-200"
                  style={{ backgroundColor: config.branding.primaryColor }}
                />
                <span className="font-mono text-xs">{config.branding.primaryColor}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Features</h3>
            <div className="space-y-1 text-sm">
              <FeatureStatus label="Show Pricing" enabled={config.features.showPricing} />
              <FeatureStatus label="Show Availability" enabled={config.features.showAvailability} />
              <FeatureStatus label="Membership Badges" enabled={config.features.showMembershipBadges} />
              <FeatureStatus label="Age/Gender Info" enabled={config.features.showAgeGender} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Enabled Filters</h3>
            <div className="flex flex-wrap gap-1">
              {config.features.enableFilters.map(filter => (
                <span 
                  key={filter}
                  className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full capitalize"
                >
                  {filter}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Organization IDs</h3>
            <div className="flex flex-wrap gap-1">
              {config.organizationIds.slice(0, 6).map(id => (
                <span 
                  key={id}
                  className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-mono"
                >
                  {id}
                </span>
              ))}
              {config.organizationIds.length > 6 && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                  +{config.organizationIds.length - 6} more
                </span>
              )}
            </div>
          </div>
        </div>
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

function FeatureStatus({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
      <span className={enabled ? 'text-gray-900' : 'text-gray-500'}>{label}</span>
    </div>
  );
}
