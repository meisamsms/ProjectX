import { Pool } from "pg";
import type { StaffAuthConfig } from "./config.js";

/** Refuse migration/owner/global database credentials before registering any staff route. */
export async function createStaffRuntimePool(
  config: StaffAuthConfig,
): Promise<Pool> {
  const pool = new Pool({
    connectionString: config.runtimeDatabaseUrl,
    max: 10,
    connectionTimeoutMillis: 5000,
  });
  try {
    const result = await pool.query<{ safe: boolean }>(`
      SELECT NOT (r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication)
        AND pg_has_role(current_user,'projectx_people_runtime','MEMBER')
        AND pg_has_role(current_user,'projectx_staff_auth_runtime','MEMBER')
        AND NOT EXISTS (SELECT 1 FROM pg_roles inherited
          WHERE (inherited.rolsuper OR inherited.rolbypassrls OR inherited.rolcreatedb
            OR inherited.rolcreaterole OR inherited.rolreplication)
          AND pg_has_role(current_user,inherited.oid,'MEMBER'))
        AND NOT pg_has_role(current_user,'pg_read_all_data','MEMBER')
        AND NOT pg_has_role(current_user,'pg_write_all_data','MEMBER')
        AND NOT pg_has_role(current_user,'pg_execute_server_program','MEMBER')
        AND NOT pg_has_role(current_user,'pg_read_server_files','MEMBER')
        AND NOT pg_has_role(current_user,'pg_write_server_files','MEMBER')
        AND NOT EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname='projectx_test'
          AND pg_has_role(current_user,n.nspowner,'MEMBER'))
        AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='projectx_test' AND pg_has_role(current_user,c.relowner,'MEMBER'))
        AND NOT EXISTS (SELECT 1 FROM pg_database d WHERE d.datname=current_database()
          AND pg_has_role(current_user,d.datdba,'MEMBER')) AS safe
      FROM pg_roles r WHERE r.rolname=current_user
    `);
    if (result.rows[0]?.safe !== true) throw new Error();
    await pool.query("SELECT projectx_test.staff_session_read($1,false)", [
      "0".repeat(64),
    ]);
    return pool;
  } catch {
    await pool.end();
    throw new Error("Restricted staff database configuration required");
  }
}
