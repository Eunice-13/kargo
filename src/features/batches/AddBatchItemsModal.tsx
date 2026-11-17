import { useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  PackagePlus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { SellingUnit } from "@/types";
import { useDialogA11y } from "@/components/shared";
import "./addBatchItemsModal.css";

export type BatchItemInput = {
  name: string;
  basePrice: string;
  markup: string;
  qty: string;
  limit: string;
  waitlistLimit: string;
  sellingUnit: SellingUnit;
  piecesPerBox: string;
  imageFile?: File;
  imagePreview?: string;
};

const emptyItem = (): BatchItemInput => ({
  name: "",
  basePrice: "",
  markup: "",
  qty: "",
  limit: "",
  waitlistLimit: "0",
  sellingUnit: "piece",
  piecesPerBox: "",
});

const buyerPays = (product: BatchItemInput) => {
  const base = Number(product.basePrice);
  const markup = Number(product.markup);
  const total = Number.isFinite(base) && Number.isFinite(markup) ? base + markup : 0;
  return Math.max(0, total).toFixed(2);
};

const hasMissingRequiredField = (product: BatchItemInput) =>
  !product.name.trim() ||
  Number(product.basePrice) + Number(product.markup) <= 0 ||
  Number(product.qty) <= 0 ||
  (product.sellingUnit === "box" &&
    (!Number.isInteger(Number(product.piecesPerBox)) || Number(product.piecesPerBox) < 1));

export default function AddBatchItemsModal({
  batchTitle,
  onAdd,
  onClose,
}: {
  batchTitle: string;
  onAdd: (
    items: Array<{
      name: string;
      price: number;
      qty: number;
      claimed: number;
      locked: boolean;
      limitPerUser?: number;
      waitlistLimit: number;
      sellingUnit: SellingUnit;
      piecesPerBox?: number;
      imageUrl?: string;
    }>,
  ) => void;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<BatchItemInput[]>([emptyItem()]);
  const [expandedItem, setExpandedItem] = useState<number | null>(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dialogRef = useDialogA11y(onClose);
  const titleId = useId();
  const photoInputPrefix = useId();

  const addRow = () => {
    setExpandedItem(products.length);
    setProducts((current) => [...current, emptyItem()]);
  };

  const removeRow = (index: number) => {
    if (products[index]?.imagePreview) URL.revokeObjectURL(products[index].imagePreview);
    const nextLength = products.length - 1;
    setProducts((current) => current.filter((_, productIndex) => productIndex !== index));
    setExpandedItem((expanded) => {
      if (nextLength === 0) return null;
      if (expanded === null) return null;
      if (expanded === index) return Math.min(index, nextLength - 1);
      return expanded > index ? expanded - 1 : expanded;
    });
  };

  const updateRow = (index: number, key: keyof BatchItemInput, value: string) =>
    setProducts((current) =>
      current.map((row, productIndex) =>
        productIndex === index ? { ...row, [key]: value } : row,
      ),
    );

  const chooseImage = (index: number, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setError("Choose an image file that is 5 MB or smaller.");
      return;
    }
    setError("");
    setProducts((current) =>
      current.map((product, productIndex) => {
        if (productIndex !== index) return product;
        if (product.imagePreview) URL.revokeObjectURL(product.imagePreview);
        return { ...product, imageFile: file, imagePreview: URL.createObjectURL(file) };
      }),
    );
  };

  const submit = async () => {
    const valid = products.filter(
      (product) =>
        product.name.trim() &&
        Number(product.basePrice) + Number(product.markup) > 0 &&
        Number(product.qty) > 0,
    );
    if (valid.length === 0) {
      setError("Add at least one product with a name, price, and quantity.");
      return;
    }
    if (
      valid.some(
        (product) =>
          product.sellingUnit === "box" &&
          (!Number.isInteger(Number(product.piecesPerBox)) || Number(product.piecesPerBox) < 1),
      )
    ) {
      setError("Enter the number of pieces included in every box item.");
      return;
    }
    setError("");
    setLoading(true);
    const added = valid.map((product) => ({
      name: product.name.trim(),
      price: Number(product.basePrice) + Number(product.markup),
      qty: Number(product.qty),
      claimed: 0,
      locked: false,
      limitPerUser: Number(product.limit) > 0 ? Number(product.limit) : undefined,
      waitlistLimit: Number(product.waitlistLimit || 0),
      sellingUnit: product.sellingUnit,
      piecesPerBox:
        product.sellingUnit === "box" ? Number(product.piecesPerBox) : undefined,
      imageUrl: product.imagePreview || undefined,
    }));
    setLoading(false);
    onAdd(added);
    onClose();
  };

  return createPortal(
    <div
      className="add-items-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="add-items-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="add-items-modal__header">
          <span className="add-items-modal__icon" aria-hidden="true">
            <PackagePlus size={18} />
          </span>
          <div className="add-items-modal__heading">
            <h2 id={titleId}>Add items to batch</h2>
            <p>{batchTitle}</p>
          </div>
          <button
            type="button"
            className="add-items-modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="add-items-modal__body">
          <div className="add-items-modal__list">
            {products.map((product, index) => {
              const expanded = expandedItem === index;
              const photoInputId = `${photoInputPrefix}-photo-${index}`;
              const missingRequired = hasMissingRequiredField(product);
              return (
                <article className="add-items-item" data-expanded={expanded} key={index}>
                  <div className="add-items-item__header">
                    <button
                      type="button"
                      className="add-items-item__toggle"
                      aria-expanded={expanded}
                      onClick={() => setExpandedItem(expanded ? null : index)}
                    >
                      <span>Item {index + 1}</span>
                      {expanded ? (
                        <ChevronUp size={16} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={16} aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="add-items-item__remove"
                      aria-label={`Remove item ${index + 1}`}
                      onClick={() => removeRow(index)}
                    >
                      <Trash2 size={14} aria-hidden="true" /> Remove
                    </button>
                  </div>

                  <button
                    type="button"
                    className="add-items-item__summary"
                    aria-expanded={expanded}
                    onClick={() => setExpandedItem(index)}
                  >
                    <span
                      className={`add-items-item__summary-photo${product.imagePreview ? "" : " add-items-item__summary-photo--empty"}`}
                    >
                      {product.imagePreview ? (
                        <img src={product.imagePreview} alt="" />
                      ) : (
                        <ImagePlus size={16} aria-hidden="true" />
                      )}
                    </span>
                    <span className="add-items-item__summary-copy">
                      <strong>{product.name.trim() || `Item ${index + 1}`}</strong>
                      <small data-invalid={missingRequired}>
                        ₱{buyerPays(product)} · {product.qty || 0} pcs
                      </small>
                    </span>
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>

                  <div className="add-items-item__body">
                    <button
                      type="button"
                      className={`add-items-item__photo${product.imagePreview ? " has-photo" : ""}`}
                      aria-label={product.imagePreview ? "Change photo" : "Add photo"}
                      onClick={() => document.getElementById(photoInputId)?.click()}
                    >
                      {product.imagePreview ? (
                        <>
                          <img src={product.imagePreview} alt="" />
                          <span className="add-items-item__photo-badge" aria-hidden="true">
                            <Camera size={13} />
                          </span>
                        </>
                      ) : (
                        <>
                          <ImagePlus size={20} aria-hidden="true" />
                          <span>Add photo</span>
                        </>
                      )}
                    </button>
                    <input
                      id={photoInputId}
                      className="sr-only"
                      type="file"
                      accept="image/*"
                      onChange={(event) => chooseImage(index, event.target.files?.[0])}
                    />

                    <label className="add-items-field add-items-field--name">
                      <span>Item name</span>
                      <input
                        className="add-items-field__control"
                        value={product.name}
                        onChange={(event) => updateRow(index, "name", event.target.value)}
                        placeholder="e.g. Matcha cookies"
                      />
                    </label>

                    <div className="add-items-item__prices">
                      <label className="add-items-field">
                        <span>Base price</span>
                        <span className="add-items-field__money">
                          <i aria-hidden="true">₱</i>
                          <input
                            className="add-items-field__control"
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0.00"
                            value={product.basePrice}
                            onChange={(event) => updateRow(index, "basePrice", event.target.value)}
                          />
                        </span>
                      </label>
                      <label className="add-items-field">
                        <span>Markup</span>
                        <span className="add-items-field__money">
                          <i aria-hidden="true">₱</i>
                          <input
                            className="add-items-field__control"
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0.00"
                            value={product.markup}
                            onChange={(event) => updateRow(index, "markup", event.target.value)}
                          />
                        </span>
                      </label>
                      <div className="add-items-field add-items-field--buyer-pays">
                        <span>Buyer pays</span>
                        <output>₱{buyerPays(product)}</output>
                      </div>
                    </div>

                    <div className="add-items-item__stock">
                      <label className="add-items-field">
                        <span>Quantity</span>
                        <input
                          className="add-items-field__control"
                          type="number"
                          min="1"
                          step="1"
                          placeholder="1"
                          value={product.qty}
                          onChange={(event) => updateRow(index, "qty", event.target.value)}
                        />
                      </label>
                      <label className="add-items-field">
                        <span>Limit per buyer</span>
                        <input
                          className="add-items-field__control"
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Optional"
                          value={product.limit}
                          onChange={(event) => updateRow(index, "limit", event.target.value)}
                        />
                      </label>
                      <label className="add-items-field add-items-field--unit">
                        <span>Unit</span>
                        <select
                          className="add-items-field__control"
                          value={product.sellingUnit}
                          onChange={(event) => updateRow(index, "sellingUnit", event.target.value)}
                        >
                          <option value="piece">Piece</option>
                          <option value="box">Box</option>
                        </select>
                      </label>
                    </div>

                    {product.sellingUnit === "box" && (
                      <label className="add-items-field add-items-field--pieces">
                        <span>Pieces per box</span>
                        <input
                          className="add-items-field__control"
                          type="number"
                          min="1"
                          step="1"
                          placeholder="1"
                          value={product.piecesPerBox}
                          onChange={(event) =>
                            updateRow(index, "piecesPerBox", event.target.value)
                          }
                        />
                      </label>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <button type="button" className="add-items-modal__add" onClick={addRow}>
            <Plus size={16} aria-hidden="true" /> Add another item
          </button>
          {error && (
            <p className="add-items-modal__error" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className="add-items-modal__footer">
          <p>
            {products.length} {products.length === 1 ? "item" : "items"} ready
          </p>
          <div>
            <button type="button" className="add-items-modal__cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="add-items-modal__submit"
              disabled={loading}
              onClick={submit}
            >
              {loading
                ? "Adding…"
                : `Add ${products.length} ${products.length === 1 ? "item" : "items"}`}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
