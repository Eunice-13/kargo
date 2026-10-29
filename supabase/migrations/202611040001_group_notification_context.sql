-- Group-order notifications: add the batch and whether the recipient can still
-- open the group, so a notification can take the user to the actual place.
--
-- The group notices written by join_group_order, leave_group_order and
-- remove_group_member (and the checkout / payment notices) carry only
-- group_order_id in their context. The app needs two more facts to route them:
--
--   batch_id    the batch the group belongs to. The member list lives in that
--               batch's Group Order modal, and a removed member can no longer
--               read the group row to look it up (row-level security).
--   group_open  true when the recipient is an active member of a group that is
--               not cancelled or expired, i.e. the Group Order modal will load.
--               "You were removed" and "The leader cancelled" notices are
--               false, so they open the batch page instead of an error.
--
-- A BEFORE INSERT trigger adds both keys, so every present and future producer
-- is covered without rewriting those functions. No new tables. Existing rows are
-- backfilled once at the bottom (group_open is evaluated as of now).
--
-- Roll back: drop trigger notifications_group_context on public.notifications;
--            drop function public.enrich_group_notification_context();

create or replace function public.enrich_group_notification_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group record;
begin
  if new.context is null
     or jsonb_typeof(new.context) <> 'object'
     or not (new.context ? 'group_order_id')
     or (new.context ? 'batch_id') then
    return new;
  end if;

  -- Compare as text so a malformed id can never raise a cast error and block
  -- the notification (and the order action that produced it).
  select g.batch_id, g.status
    into v_group
  from public.group_orders g
  where g.id::text = new.context ->> 'group_order_id';

  if found then
    new.context := new.context || jsonb_build_object(
      'batch_id', v_group.batch_id,
      'group_open', (
        v_group.status not in ('cancelled', 'expired')
        and exists (
          select 1
          from public.group_order_members m
          where m.group_order_id::text = new.context ->> 'group_order_id'
            and m.user_id = new.recipient_id
            and m.status = 'active'
        )
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.enrich_group_notification_context() from public, anon, authenticated;

drop trigger if exists notifications_group_context on public.notifications;
create trigger notifications_group_context
  before insert on public.notifications
  for each row execute function public.enrich_group_notification_context();

-- One-time backfill for notifications that already exist.
update public.notifications n
set context = n.context || jsonb_build_object(
  'batch_id', g.batch_id,
  'group_open', (
    g.status not in ('cancelled', 'expired')
    and exists (
      select 1
      from public.group_order_members m
      where m.group_order_id = g.id
        and m.user_id = n.recipient_id
        and m.status = 'active'
    )
  )
)
from public.group_orders g
where jsonb_typeof(n.context) = 'object'
  and n.context ? 'group_order_id'
  and not (n.context ? 'batch_id')
  and g.id::text = n.context ->> 'group_order_id';
