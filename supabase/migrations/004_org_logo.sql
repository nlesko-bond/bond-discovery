-- Optional org logo: HTTPS URL to an image (set in admin org settings)
alter table orgs add column if not exists logo_url text;
