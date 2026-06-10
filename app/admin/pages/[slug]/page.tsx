'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Check, ExternalLink, RefreshCw, Save } from 'lucide-react';
import { PageEditorSectionNav } from './components/PageEditorSectionNav';
import {
  buildNextTableColumns,
  getActiveTableColumns,
  parseCommaSeparatedIds,
  parseOriginsList,
} from './page-config-utils';
import type { IPageConfig, PageEditorSectionId } from './page-config-types';
import { PageEditorPageSection } from './sections/PageEditorPageSection';
import { PageEditorAppearanceSection } from './sections/PageEditorAppearanceSection';
import { PageEditorProgramsSection } from './sections/PageEditorProgramsSection';
import { PageEditorRegistrationSection } from './sections/PageEditorRegistrationSection';
import { PageEditorDataSection } from './sections/PageEditorDataSection';

type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

export default function EditPagePage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('clean');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [config, setConfigState] = useState<IPageConfig | null>(null);
  const [activeSection, setActiveSection] = useState<PageEditorSectionId>('page');
  const [organizationIdsInput, setOrganizationIdsInputState] = useState('');
  const [facilityIdsInput, setFacilityIdsInputState] = useState('');
  const [allowedOriginsInput, setAllowedOriginsInputState] = useState('');

  const markDirty = useCallback(() => {
    setSaveState((prev) => (prev === 'saving' ? prev : 'dirty'));
    setSaveError(null);
  }, []);

  const setConfig = useCallback(
    (next: IPageConfig) => {
      setConfigState(next);
      markDirty();
    },
    [markDirty],
  );
  const setOrganizationIdsInput = useCallback(
    (value: string) => {
      setOrganizationIdsInputState(value);
      markDirty();
    },
    [markDirty],
  );
  const setFacilityIdsInput = useCallback(
    (value: string) => {
      setFacilityIdsInputState(value);
      markDirty();
    },
    [markDirty],
  );
  const setAllowedOriginsInput = useCallback(
    (value: string) => {
      setAllowedOriginsInputState(value);
      markDirty();
    },
    [markDirty],
  );

  useEffect(() => {
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  const fetchPage = async () => {
    try {
      const res = await fetch(`/api/pages/${params.slug}`);
      if (!res.ok) {
        throw new Error('Page not found');
      }
      const data = await res.json();
      setConfigState(data.page);
      setOrganizationIdsInputState(data.page.organizationIds.join(', '));
      setFacilityIdsInputState(data.page.facilityIds?.join(', ') || '');
      setAllowedOriginsInputState((data.page.features?.embedAllowedOrigins || []).join('\n'));
      setSaveState('clean');
      setSaveError(null);
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
    setSaveState('saving');
    setSaveError(null);
    try {
      const origins = parseOriginsList(allowedOriginsInput);
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
        setConfigState(sanitizedConfig);
        setOrganizationIdsInputState(sanitizedConfig.organizationIds.join(', '));
        setFacilityIdsInputState(sanitizedConfig.facilityIds?.join(', ') || '');
        setAllowedOriginsInputState(
          (sanitizedConfig.features.embedAllowedOrigins || []).join('\n'),
        );
        setSaveState('saved');
        setLastSavedAt(new Date());
        if (sanitizedConfig.slug !== params.slug) {
          router.push(`/admin/pages/${sanitizedConfig.slug}`);
        }
      } else {
        let message = 'Failed to save page';
        try {
          const error = await res.json();
          message = error.error || message;
        } catch {
          message = `Failed to save page (HTTP ${res.status})`;
        }
        setSaveState('error');
        setSaveError(message);
      }
    } catch (error) {
      console.error('Error saving page:', error);
      setSaveState('error');
      setSaveError(error instanceof Error ? error.message : 'Failed to save page');
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
  const saving = saveState === 'saving';

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
          <span className="text-sm" aria-live="polite">
            {saveState === 'dirty' && <span className="text-amber-700">Unsaved changes</span>}
            {saveState === 'saved' && lastSavedAt && (
              <span className="flex items-center gap-1 text-green-700">
                <Check size={14} />
                Saved at {lastSavedAt.toLocaleTimeString()}
              </span>
            )}
            {saveState === 'error' && (
              <span className="flex items-center gap-1 text-red-700">
                <AlertCircle size={14} />
                Save failed
              </span>
            )}
          </span>
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

      {saveError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-64">
          <PageEditorSectionNav activeSection={activeSection} onSectionChange={setActiveSection} />
        </aside>

        <div className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white p-6">
          {activeSection === 'page' && (
            <PageEditorPageSection
              {...sectionProps}
              organizationIdsInput={organizationIdsInput}
              setOrganizationIdsInput={setOrganizationIdsInput}
              facilityIdsInput={facilityIdsInput}
              setFacilityIdsInput={setFacilityIdsInput}
              allowedOriginsInput={allowedOriginsInput}
              setAllowedOriginsInput={setAllowedOriginsInput}
            />
          )}
          {activeSection === 'appearance' && <PageEditorAppearanceSection {...sectionProps} />}
          {activeSection === 'programs' && (
            <PageEditorProgramsSection
              {...sectionProps}
              activeTableColumns={activeTableColumns}
              updateTableColumns={updateTableColumns}
            />
          )}
          {activeSection === 'registration' && (
            <PageEditorRegistrationSection {...sectionProps} />
          )}
          {activeSection === 'data' && <PageEditorDataSection {...sectionProps} />}
        </div>
      </div>
    </div>
  );
}
