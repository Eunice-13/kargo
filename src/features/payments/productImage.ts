import type { BatchType, EntityId } from "@/types";

type ProductImageRecord = {
  product: string;
  imageUrl?: string;
  productId?: EntityId;
  batchId?: EntityId;
  batch?: string;
  seller?: string;
  sellerId?: string;
};

/** Resolve only stored product media; ambiguous legacy records have no image. */
export function resolveProductImage(
  batches: BatchType[],
  record: ProductImageRecord,
): string | undefined {
  if (record.imageUrl?.trim()) return record.imageUrl;

  const catalog = batches.filter((batch) => {
    if (record.batchId != null) {
      return batch.dbId === String(record.batchId) || String(batch.id) === String(record.batchId);
    }
    if (record.productId != null) return true;
    return (
      record.batch === batch.title &&
      (!record.sellerId || record.sellerId === batch.sellerId) &&
      (!record.seller || record.seller === batch.seller)
    );
  });
  const products = catalog.flatMap((batch) =>
    batch.products.filter((product) =>
      record.productId != null
        ? product.dbId === String(record.productId) ||
          String(product.id) === String(record.productId)
        : product.name === record.product,
    ),
  );
  return products.length === 1 ? products[0].imageUrl : undefined;
}
