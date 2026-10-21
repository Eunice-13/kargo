begin read only;
set local search_path=public,extensions;
select json_build_object(
 'server_version',current_setting('server_version'),
 'columns',(select json_agg(json_build_object('table',c.relname,'name',a.attname,'position',a.attnum,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid))) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname='public' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped),
 'enums',(select json_agg(json_build_object('type',t.typname,'label',e.enumlabel,'position',e.enumsortorder)) from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid where n.nspname='public'),
 'sequences',(select json_agg(json_build_object('name',sequencename,'type',data_type,'start',start_value,'min',min_value,'max',max_value,'increment',increment_by,'cycle',cycle,'cache',cache_size)) from pg_sequences where schemaname='public'),
 'views',(select json_agg(json_build_object('name',c.relname,'definition',pg_get_viewdef(c.oid,true),'options',c.reloptions)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'),
 'functions',(select json_agg(json_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'),
 'constraints',(select json_agg(json_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid),'validated',convalidated)) from pg_constraint where connamespace='public'::regnamespace),
 'indexes',(select json_agg(json_build_object('table',tablename,'name',indexname,'definition',indexdef)) from pg_indexes where schemaname='public'),
 'triggers',(select json_agg(json_build_object('table',c.relname,'schema',n.nspname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled)) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','auth','storage')),
 'policies',(select json_agg(json_build_object('schema',schemaname,'table',tablename,'name',policyname,'permissive',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check)) from pg_policies where schemaname in ('public','auth','storage')),
 'tables',(select json_agg(json_build_object('name',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl,'replica_identity',c.relreplident)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','S')),
 'default_privileges',(select json_agg(json_build_object('role',pg_get_userbyid(defaclrole),'schema',n.nspname,'type',defaclobjtype,'acl',defaclacl)) from pg_default_acl a left join pg_namespace n on n.oid=a.defaclnamespace where n.nspname='public' or a.defaclnamespace=0),
 'event_triggers',(select json_agg(json_build_object('name',evtname,'event',evtevent,'function',evtfoid::regproc::text,'enabled',evtenabled,'tags',evttags)) from pg_event_trigger)
) as metadata;
rollback;
