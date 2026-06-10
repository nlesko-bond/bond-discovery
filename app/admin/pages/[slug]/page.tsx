'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, RefreshCw, Save } from 'lucide-react';
import { PageEditorSectionNav } from './components/PageEditorSectionNav';
import {
  buildNextTableColumns,
  getActiveTableColumns,
  parseCommaSeparatedIds,
  parseOriginsList,
} from './page-config-utils';
import type { IPageConfig, PageEditorSectionId } from './page-config-types';
import { PageEditorBasicsSection } from './sections/PageEditorBasicsSection';
import { PageEditorBrandingSection } from './sections/PageEditorBrandingSection';
import { PageEditorProgramsSection } from './sections/PageEditorProgramsSection';
import { PageEditorFiltersSection } from './sections/PageEditorFiltersSection';
import { PageEditorRegistrationSection } from './sections/PageEditorRegistrationSection';
import { PageEditorEmbedSection } from './sections/PageEditorEmbedSection';
import { PageEditorHostPortalSection } from './sections/PageEditorHostPortalSection';
import { PageEditorAnalyticsSection } from './sections/PageEditorAnalyticsSection';
import { PageEditorAdvancedSection } from './sections/PageEditorAdvancedSection';

export default function EditPagePage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<IPageConfig | null>(null);
  const [activeSection, setActiveSection] = useState<PageEditorSectionId>('basics');
  const [organizationIdsInput, setOrganizationIdsInput] = useState('');
  const [facilityIdsInput, setFacilityIdsInput] = useState('');
  const [embedAllowedOriginsInput, setEmbedAllowedOriginsInput] = useState('');

  useEffect(() => {
    fetchPage();
  }, [params.slug]);

  const fetchPage = async () => {
    try {
      const res = await fetch(`/api/pages/${params.slug}`);
      if (!res.ok) {
        throw new Error('Page not found');
      }
      const data = await res.json();
      setConfig(data.page);
      setOrganizationIdsInput(data.page.organizationIds.join(', '));
      setFacilityIdsInput(data.page.facilityIds?.join(', ') || '');
      setEmbedAllowedOriginsInput((data.page.features?.embedAllowedOrigins || []).join('\n'));
    } catch (error) {
      console.error('Error fetching page:', error);
      alert('Page not found');
      router.push('/admin/pages');
    } finally {
      setLoading(false);
    }
  };

  const savePage = async () => {
    if (!config) {
      return;
    }
    setSaving(true);
    try {
      const origins = parseOriginsList(embedAllowedOriginsInput);
      const featuresNext: IPageConfig['features'] = { ...config.features };
      if (origins.length > 0) {
        featuresNext.embedAllowedOrigins = origins;
      } else {
        delete (featuresNext as Record<string, unknown>).embedAllowedOrigins;
      }

      const sanitizedConfig = {
        ...config,
        organizationIds: parseCommaSeparatedIds(organizationIdsInput),
        facilityIds: parseCommaSeparatedIds(facilityIdsInput),
        features: featuresNext,
      };
      const res = await fetch(`/api/pages/${params.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedConfig),
      });

      if (res.ok) {
        setConfig(sanitizedConfig);
        setOrganizationIdsInput(sanitizedConfig.organizationIds.join(', '));
        setFacilityIdsInput(sanitizedConfig.facilityIds?.join(', ') || '');
        setEmbedAllowedOriginsInput(
          (sanitizedConfig.features.embedAllowedOrigins || []).join('\n'),
        );
        alert('Page saved successfully!');
        if (sanitizedConfig.slug !== params.slug) {
          router.push(`/admin/pages/${sanitizedConfig.slug}`);
        }
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save page');
      }
    } catch (error) {
      console.error('Error saving page:', error);
      alert('Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (!config) {
    return null;
  }

  const activeTableColumns = getActiveTableColumns(config);
  const updateTableColumns = (
    nextColumns: NonNullable<IPageConfig['features']['tableColumns']>,
  ) => {
    setConfig(buildNextTableColumns(config, nextColumns));
  };

  const sectionProps = { config, setConfig };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/pages" className="rounded-lg p-2 transition-colors hover:bg-gray-200">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{config.name}</h1>
            <p className="text-sm text-gray-500">/{config.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`${process.env.NEXT_PUBLIC_DISCOVERY_DOMAIN || ''}/${config.slug}`}
            target="_blank"
            className="btn-secondary flex items-center gap-2"
          >
            <ExternalLink size={16} />
            Preview
          </Link>
          <button
            type="button"
            onClick={savePage}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-64">
          <PageEditorSectionNav activeSection={activeSection} onSectionChange={setActiveSection} />
        </aside>

        <div className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white p-6">
          {activeSection === 'basics' && (
            <PageEditorBasicsSection
              {...sectionProps}
              organizationIdsInput={organizationIdsInput}
              setOrganizationIdsInput={setOrganizationIdsInput}
              facilityIdsInput={facilityIdsInput}
              setFacilityIdsInput={setFacilityIdsInput}
            />
          )}
          {activeSection === 'branding' && <PageEditorBrandingSection {...sectionProps} />}
          {activeSection === 'programs' && (
            <PageEditorProgramsSection
              {...sectionProps}
              activeTableColumns={activeTableColumns}
              updateTableColumns={updateTableColumns}
            />
          )}
          {activeSection === 'filters' && <PageEditorFiltersSection {...sectionProps} />}
          {activeSection === 'registration' && (
            <PageEditorRegistrationSection {...sectionProps} />
          )}
          {activeSection === 'embed' && (
            <PageEditorEmbedSection
              {...sectionProps}
              embedAllowedOriginsInput={embedAllowedOriginsInput}
              setEmbedAllowedOriginsInput={setEmbedAllowedOriginsInput}
            />
          )}
          {activeSection === 'host-portal' && (
            <PageEditorHostPortalSection
              {...sectionProps}
              onNavigateToSection={setActiveSection}
            />
          )}
          {activeSection === 'analytics' && <PageEditorAnalyticsSection {...sectionProps} />}
          {activeSection === 'advanced' && <PageEditorAdvancedSection {...sectionProps} />}
        </div>
      </div>
    </div>
  );
}
