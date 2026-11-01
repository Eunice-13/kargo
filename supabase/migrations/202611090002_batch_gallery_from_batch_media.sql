-- Batch galleries are now derived from the batch's own media instead of
-- separately curated (often unrelated) stock photos: the cover photo first,
-- followed by each item's photo in product order. The catalog view already
-- exposes batches.gallery_paths as batch_gallery_paths, so updating the source
-- column is enough.

update public.batches b
set gallery_paths = derived.paths
from (
  select
    b2.id,
    array_remove(
      array_prepend(
        b2.cover_path,
        array_agg(bp.image_path order by bp.created_at, bp.id)
      ),
      null
    ) as paths
  from public.batches b2
  left join public.batch_products bp
    on bp.batch_id = b2.id
   and bp.image_path is not null
  group by b2.id, b2.cover_path
) derived
where b.id = derived.id;

notify pgrst, 'reload schema';
