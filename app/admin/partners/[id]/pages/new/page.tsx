'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';

interface PartnerGroup {
  id: string;
  name: string;
  branding: {
    companyName: string;
    primaryColor: string;
  };
}

export default function NewPageForPartner({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [partner, setPartner] = useState<PartnerGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  const [newPage, setNewPage] = useState({
    name: '',
    slug: '',
    organizationIds: '',
    facilityIds: '',
  });

  useEffect(() => {
    fetchPartner();
  }, [params.id]);

  const fetchPartner = async () => {
    try {
      const res = await fetch(`/api/partners/${params.id}`);
      if (!res.ok) throw new Error('Partner not found');
      const data = await res.json();
      setPartner(data.partner);
    } catch (error) {
      console.error('Error fetching partner:', error);
      router.push('/admin/partners');
    } finally {
      setLoading(false);
    }
  };

  const createPage = async () => {
    if (!partner) return;
    setCreating(true);
    
    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPage.name,
          slug: newPage.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          organizationIds: newPage.organizationIds.split(',').map(s => s.trim()).filter(Boolean),
          facilityIds: newPage.facilityIds ? newPage.facilityIds.split(',').map(s => s.trim()).filter(Boolean) : [],
          partner_group_id: params.id,
          // Inherit branding from partner
          branding: partner.branding,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        router.push(`/admin/pages/${data.page.slug}`);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create page');
      }
    } catch (error) {
      console.error('Error creating page:', error);
      alert('Failed to create page');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (!partner) return null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link 
          href={`/admin/partners/${params.id}`}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Page</h1>
          <p className="text-gray-500 text-sm">Under {partner.name}</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            This page will inherit branding and API key from <strong>{partner.name}</strong>.
            You can customize org/facility IDs for this specific page.
          </p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="label">Page Name *</label>
            <input
              type="text"
              className="input"
              placeholder={`e.g., ${partner.name} NYC`}
              value={newPage.name}
              onChange={(e) => setNewPage({ ...newPage, name: e.target.value })}
            />
          </div>
          
          <div>
            <label className="label">URL Slug *</label>
            <div className="flex items-center">
              <span className="text-gray-500 text-sm mr-1">/</span>
              <input
                type="text"
                className="input"
                placeholder={`e.g., ${partner.name.toLowerCase().replace(/\s+/g, '-')}-nyc`}
                value={newPage.slug}
                onChange={(e) => setNewPage({ 
                  ...newPage, 
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') 
                })}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This will be the public URL: /{newPage.slug || 'your-slug'}
            </p>
          </div>
          
          <div>
            <label className="label">Organization IDs *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., 101, 102, 103"
              value={newPage.organizationIds}
              onChange={(e) => setNewPage({ ...newPage, organizationIds: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated list of Bond Sports organization IDs for this page
            </p>
          </div>
          
          <div>
            <label className="label">Facility IDs (Optional)</label>
            <input
              type="text"
              className="input"
              placeholder="Leave empty for all facilities"
              value={newPage.facilityIds}
              onChange={(e) => setNewPage({ ...newPage, facilityIds: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Restrict to specific facilities (optional)
            </p>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
          <Link href={`/admin/partners/${params.id}`} className="btn-secondary">
            Cancel
          </Link>
          <button
            onClick={createPage}
            disabled={creating || !newPage.name || !newPage.slug || !newPage.organizationIds}
            className="btn-primary flex items-center gap-2"
          >
            {creating ? (
              <><RefreshCw size={16} className="animate-spin" /> Creating...</>
            ) : (
              <><Plus size={16} /> Create Page</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
