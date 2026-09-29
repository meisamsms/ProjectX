-- ProjectX roster persistence decision: identity names belong to User;
-- job title and notification preference belong to OrganizationMembership.
-- NULL means unprovided/unconfigured, distinct from explicit false.
ALTER TABLE users
 ADD COLUMN first_name text,
 ADD COLUMN last_name text;

ALTER TABLE organization_memberships
 ADD COLUMN job_title text,
 ADD COLUMN email_notifications_enabled boolean;
