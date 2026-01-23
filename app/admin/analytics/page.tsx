'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  Eye, 
  Users, 
  MousePointer, 
  TrendingUp,
  Calendar,
  RefreshCw,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface AnalyticsData {
  summary: {
    totalViews: number;
    uniqueVisitors: number;
    registerClicks: number;
    conversionRate: string;
  };
  dailyStats: { date: string; views: number }[];
  topPages: { slug: string; views: number }[];
  eventBreakdown: Record<string, number>;
  period: { days: number; startDate: string };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);
  
  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/stats?days=${period}`);
      if (!res.ok) throw new Error('Failed to load analytics');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchAnalytics();
  }, [period]);
  
  if (loading && !data) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="animate-spin text-gray-400" size={32} />
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-800 mb-4">{error}</p>
          <p className="text-sm text-red-600 mb-4">
            Make sure you've run the analytics migration in Supabase.
          </p>
          <Link 
            href="/admin/help/gtm-setup" 
            className="text-blue-600 hover:underline text-sm"
          >
            View setup instructions →
          </Link>
        </div>
      </div>
    );
  }
  
  const maxViews = Math.max(...(data?.dailyStats.map(d => d.views) || [1]));
  
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">
            Track page views and user engagement across all Discovery pages
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          icon={Eye}
          label="Total Views"
          value={data?.summary.totalViews || 0}
          color="blue"
        />
        <SummaryCard
          icon={Users}
          label="Unique Visitors"
          value={data?.summary.uniqueVisitors || 0}
          color="green"
        />
        <SummaryCard
          icon={MousePointer}
          label="Register Clicks"
          value={data?.summary.registerClicks || 0}
          color="purple"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Conversion Rate"
          value={`${data?.summary.conversionRate || 0}%`}
          color="orange"
        />
      </div>
      
      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="text-blue-500" size={20} />
          Daily Page Views
        </h2>
        
        {data?.dailyStats && data.dailyStats.length > 0 ? (
          <div className="h-48 flex items-end gap-1">
            {data.dailyStats.map((day, i) => {
              const height = maxViews > 0 ? (day.views / maxViews) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-xs text-gray-500">{day.views}</div>
                  <div 
                    className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${day.date}: ${day.views} views`}
                  />
                  <div className="text-xs text-gray-400 truncate w-full text-center">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-500">
            No data for this period
          </div>
        )}
      </div>
      
      {/* Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Pages */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Pages</h2>
          
          {data?.topPages && data.topPages.length > 0 ? (
            <div className="space-y-3">
              {data.topPages.map((page, i) => (
                <div key={page.slug} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                      {i + 1}
                    </span>
                    <div>
                      <Link 
                        href={`/${page.slug}`} 
                        target="_blank"
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 flex items-center gap-1"
                      >
                        /{page.slug}
                        <ExternalLink size={12} />
                      </Link>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    {page.views.toLocaleString()} views
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No page data yet</p>
          )}
        </div>
        
        {/* Event Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Events</h2>
          
          {data?.eventBreakdown && Object.keys(data.eventBreakdown).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(data.eventBreakdown)
                .sort(([,a], [,b]) => b - a)
                .map(([event, count]) => (
                  <div key={event} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      {formatEventName(event)}
                    </span>
                    <span className="text-sm font-semibold text-gray-700">
                      {count.toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No events tracked yet</p>
          )}
        </div>
      </div>
      
      {/* Setup Notice */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">
          Bond System Analytics
        </h3>
        <p className="text-sm text-blue-800 mb-3">
          These stats are automatically tracked for all Discovery pages. For advanced 
          analytics with custom funnels and user flows, set up Google Tag Manager.
        </p>
        <Link 
          href="/admin/help/gtm-setup"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          View GTM Setup Guide →
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

function formatEventName(event: string): string {
  return event
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
