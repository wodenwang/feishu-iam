alter table sync_runs add column if not exists operator_type text not null default 'feishu_user';

alter table sync_runs alter column operator_feishu_user_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sync_runs_operator_type_check'
  ) then
    alter table sync_runs
      add constraint sync_runs_operator_type_check
      check (operator_type in ('feishu_user', 'system'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sync_runs_operator_consistency_check'
  ) then
    alter table sync_runs
      add constraint sync_runs_operator_consistency_check
      check (
        (operator_type = 'feishu_user' and operator_feishu_user_id is not null)
        or (operator_type = 'system' and operator_feishu_user_id is null)
      );
  end if;
end $$;

create index if not exists idx_sync_runs_operator_type on sync_runs(operator_type);
