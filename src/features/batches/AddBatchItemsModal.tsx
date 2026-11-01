import { useState } from "react";
import { ImageUp, X } from "lucide-react";
import type { SellingUnit } from "@/types";
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared";

export type BatchItemInput = {
  name: string;
  basePrice: string;
  markup: string;
  qty: string;
  limit: string;
  sellingUnit: SellingUnit;
  piecesPerBox: string;
  imageFile?: File;
  imagePreview?: string;
};

export default function AddBatchItemsModal({
  onAdd,
  onClose,
}: {
  onAdd: (items: Array<{ name: string; price: number; qty: number; claimed: number; locked: boolean; limitPerUser?: number; waitlistLimit: number; sellingUnit: SellingUnit; piecesPerBox?: number; imageUrl?: string }>) => void;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<BatchItemInput[]>([
    { name: "", basePrice: "", markup: "", qty: "", limit: "", waitlistLimit: "0", sellingUnit: "piece", piecesPerBox: "" },
  ]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const addRow = () =>
    setProducts((p) => [
      ...p,
      { name: "", basePrice: "", markup: "", qty: "", limit: "", waitlistLimit: "0", sellingUnit: "piece", piecesPerBox: "" },
    ]);

  const removeRow = (i: number) =>
    setProducts((p) => {
      if (p[i]?.imagePreview) URL.revokeObjectURL(p[i].imagePreview);
      return p.filter((_, idx) => idx !== i);
    });

  const updateRow = (i: number, k: keyof BatchItemInput, v: string) =>
    setProducts((p) => p.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));

  const chooseImage = (i: number, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setError("Choose an image file that is 5 MB or smaller.");
      return;
    }
    setError("");
    setProducts((current) =>
      current.map((product, index) => {
        if (index !== i) return product;
        if (product.imagePreview) URL.revokeObjectURL(product.imagePreview);
        return { ...product, imageFile: file, imagePreview: URL.createObjectURL(file) };
      }),
    );
  };

  const submit = async () => {
    const valid = products.filter(
      (p) => p.name.trim() && Number(p.basePrice) + Number(p.markup) > 0 && Number(p.qty) > 0,
    );
    if (valid.length === 0) {
      setError("Add at least one product with a name, price, and quantity.");
      return;
    }
    if (valid.some((p) => p.sellingUnit === "box" && (!Number.isInteger(Number(p.piecesPerBox)) || Number(p.piecesPerBox) < 1))) {
      setError("Enter the number of pieces included in every box item.");
      return;
    }
    setError("");
    setLoading(true);
    const added = valid.map((p) => ({
      name: p.name.trim(),
      price: Number(p.basePrice) + Number(p.markup),
      qty: Number(p.qty),
      claimed: 0,
      locked: false,
      limitPerUser: Number(p.limit) > 0 ? Number(p.limit) : undefined,
      waitlistLimit: Number(p.waitlistLimit || 0),
      sellingUnit: p.sellingUnit,
      piecesPerBox: p.sellingUnit === "box" ? Number(p.piecesPerBox) : undefined,
      imageUrl: p.imagePreview || undefined,
    }));
    setLoading(false);
    onAdd(added);
    onClose();
  };

  return (
    <Modal title="Add Items to Batch" onClose={onClose} width={560}>
      <div className="space-y-4">
        {products.map((p, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <input
                value={p.name}
                onChange={(e) => updateRow(i, "name", e.target.value)}
                placeholder="Item name"
                className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2 outline-none focus:border-[#191BA9]"
              />
              <button type="button" onClick={() => removeRow(i)} aria-label="Remove" className="p-1 text-red-600 hover:bg-red-50 rounded-md"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" min="0" step="1" placeholder="Base price" value={p.basePrice} onChange={(e) => updateRow(i, "basePrice", e.target.value)} className="text-sm border border-gray-300 rounded-md px-3 py-2 outline-none" />
              <input type="number" min="0" step="1" placeholder="Markup" value={p.markup} onChange={(e) => updateRow(i, "markup", e.target.value)} className="text-sm border border-gray-300 rounded-md px-3 py-2 outline-none" />
              <input type="number" min="1" step="1" placeholder="Qty" value={p.qty} onChange={(e) => updateRow(i, "qty", e.target.value)} className="text-sm border border-gray-300 rounded-md px-3 py-2 outline-none" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" min="0" step="1" placeholder="Limit per buyer" value={p.limit} onChange={(e) => updateRow(i, "limit", e.target.value)} className="text-sm border border-gray-300 rounded-md px-3 py-2 outline-none" />
              <select value={p.sellingUnit} onChange={(e) => updateRow(i, "sellingUnit", e.target.value)} className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white outline-none">
                <option value="piece">Piece</option>
                <option value="box">Box</option>
              </select>
              {p.sellingUnit === "box" && (
                <input type="number" min="1" step="1" placeholder="Pieces/box" value={p.piecesPerBox} onChange={(e) => updateRow(i, "piecesPerBox", e.target.value)} className="text-sm border border-gray-300 rounded-md px-3 py-2 outline-none" />
              )}
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 cursor-pointer border-2 border-dashed border-gray-300 rounded-lg px-3 py-2 hover:border-[#191BA9] hover:text-[#191BA9] transition-colors w-fit">
              <ImageUp size={14} />
              <span>{p.imagePreview ? "Change image" : "Upload image"}</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => chooseImage(i, e.target.files?.[0])} />
            </label>
            {p.imagePreview && <img src={p.imagePreview} alt="" className="w-24 h-24 object-cover rounded-lg border" />}
          </div>
        ))}
        <button type="button" onClick={addRow} className="text-sm font-semibold text-[#191BA9] hover:underline">+ Add another item</button>
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
          <PrimaryBtn onClick={submit} disabled={loading}>{loading ? "Adding…" : "Add Items"}</PrimaryBtn>
        </div>
      </div>
    </Modal>
  );
}
