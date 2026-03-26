-- Optional Slack user ID (U… / W…) for <@…> mentions in onboarding alerts
alter table staff add column if not exists slack_member_id text;
