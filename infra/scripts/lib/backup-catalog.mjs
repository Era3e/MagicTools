import { databaseQuery } from "./backup-docker.mjs";

export async function databaseCatalog(container, databases, query = databaseQuery) {
  const global = JSON.parse(await query(container, "postgres", `SELECT json_build_object(
    'databases',(SELECT json_agg(json_build_object('name',datname,'owner',pg_get_userbyid(datdba),'encoding',pg_encoding_to_char(encoding)) ORDER BY datname) FROM pg_database WHERE NOT datistemplate),
    'roles',(SELECT json_agg(row_to_json(r) ORDER BY rolname) FROM (SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,extract(epoch FROM rolvaliduntil) AS valid_until FROM pg_roles) r),
    'memberships',(SELECT coalesce(json_agg(row_to_json(m) ORDER BY roleid,member),'[]'::json) FROM (SELECT roleid,member,grantor,admin_option,inherit_option,set_option FROM pg_auth_members) m));`));
  if (databases.some((name) => !global.databases.some((database) => database.name === name))) throw new Error("恢复数据库未覆盖业务清单");
  const extensions = [];
  for (const database of global.databases) {
    extensions.push({ database: database.name, extensions: JSON.parse(await query(container, database.name,
      "SELECT coalesce(json_agg(json_build_object('name',extname,'version',extversion) ORDER BY extname),'[]'::json) FROM pg_extension;")) });
  }
  return { ...global, extensions };
}
