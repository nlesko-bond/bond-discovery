import { FormResponsesStaffApp } from '@/components/form-responses/FormResponsesStaffApp';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function FormResponsesSlugPage({ params }: PageProps) {
  const { slug } = await params;
  return <FormResponsesStaffApp slug={slug} />;
}
