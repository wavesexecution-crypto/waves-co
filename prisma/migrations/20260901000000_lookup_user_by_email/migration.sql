-- lookup_user_by_email SECURITY DEFINER function
-- This function allows finding a user by email across ALL tenants,
-- bypassing RLS. Required for authentication before a tenant context exists.
-- Used by the auth system to look up users during login.

CREATE OR REPLACE FUNCTION public.lookup_user_by_email(p_email text)
RETURNS SETOF public."User"  -- returns SETOF User to match the queryRaw usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.*
  FROM public."User" u
  WHERE u.email = p_email;
END;
$$;

-- Grant execute to the application role
GRANT EXECUTE ON FUNCTION public.lookup_user_by_email(text) TO wavesco_app;