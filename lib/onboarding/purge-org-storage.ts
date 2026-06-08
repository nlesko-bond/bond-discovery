import { getSupabaseAdmin } from '@/lib/supabase';

const BUCKET_ONBOARDING_UPLOADS = 'onboarding-uploads';

type OrgStoragePaths = {
  spaces_upload_storage_path?: string | null;
  gl_codes_upload_storage_path?: string | null;
  programs_upload_storage_path?: string | null;
};

/**
 * Removes uploaded onboarding files for an org from Supabase Storage before org delete.
 */
export async function purgeOrgOnboardingStorage(
  orgId: string,
  knownPaths?: OrgStoragePaths,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const paths = new Set<string>();

  const fromOrg = [
    knownPaths?.spaces_upload_storage_path,
    knownPaths?.gl_codes_upload_storage_path,
    knownPaths?.programs_upload_storage_path,
  ];
  for (const path of fromOrg) {
    if (typeof path === 'string' && path.trim()) {
      paths.add(path.trim());
    }
  }

  const { data: listed } = await admin.storage.from(BUCKET_ONBOARDING_UPLOADS).list(orgId);
  for (const item of listed ?? []) {
    if (typeof item.name === 'string' && item.name.trim()) {
      paths.add(`${orgId}/${item.name.trim()}`);
    }
  }

  if (paths.size === 0) {
    return;
  }

  const { error } = await admin.storage.from(BUCKET_ONBOARDING_UPLOADS).remove([...paths]);
  if (error) {
    console.error('[purge-org-storage] remove failed', { orgId, message: error.message });
  }
}
