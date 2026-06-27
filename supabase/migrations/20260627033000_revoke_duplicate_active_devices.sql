with ranked_devices as (
  select
    id,
    row_number() over (
      partition by user_id, device_fingerprint_hash
      order by last_seen_at desc nulls last, created_at desc
    ) as active_rank
  from public.paired_devices
  where revoked_at is null
)
update public.paired_devices
set revoked_at = now()
where id in (
  select id
  from ranked_devices
  where active_rank > 1
);
