import { DocumentationEditor } from '../DocumentationEditor';

export default function EditDocumentationPage({ params }: { params: { id: string } }) {
  return <DocumentationEditor pageId={params.id} />;
}
