-- So admin UI can subscribe to org status / metadata updates (e.g. completed_at)
alter publication supabase_realtime add table orgs;
