import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../AuthProvider.jsx";
import {
  listItems, createItem, updateItem, deleteItem,
  ITEM_UNITS, ITEM_CATEGORIES,
} from "../../lib/items.js";
import { formatGHS as GHS } from "../../lib/currency.js";
import { supabase } from "../../lib/supabase.js";
import { Search, Inbox, Image, Upload, X } from "lucide-react";

const inp =
  "w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2 text-sm text-[var(--t-text1)] " +
  "placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red transition-colors";
const sel = inp;

const BLANK = {
  name: "", description: "", category: "", unit: "ea", unitPrice: "",
  itemType: "standard", printSpecMaterial: "", printSpecSize: "",
  isPublic: false, thumbnailUrl: "",
};

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className={[
          "w-9 h-5 rounded-full transition-colors",
          checked ? "bg-brand-red" : "bg-gray-300 dark:bg-white/20",
        ].join(" ")} />
        <div className={[
          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "",
        ].join(" ")} />
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--t-text1)]">{label}</p>
        {description && <p className="text-xs text-[var(--t-muted)] mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

function ThumbnailField({ value, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  async function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setUploadErr("Please select an image file."); return; }
    if (file.size > 2 * 1024 * 1024) { setUploadErr("Image must be under 2 MB."); return; }
    setUploadErr("");
    setUploading(true);
    try {
      const ext  = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("item-thumbnails")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("item-thumbnails").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err) {
      setUploadErr(err.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-[var(--t-text2)] mb-1.5 flex items-center gap-1.5">
        <Image size={12} /> Thumbnail image
        <span className="text-[var(--t-muted)] font-normal">(optional — shown in customer Rates tab)</span>
      </label>

      {value ? (
        <div className="flex items-start gap-3">
          <img src={value} alt="thumbnail" className="w-20 h-20 rounded-lg object-cover border border-[var(--t-border)] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--t-muted)] truncate mb-2">{value}</p>
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
            >
              <X size={11} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2 text-xs font-medium text-[var(--t-text2)] hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-60 transition-colors"
          >
            <Upload size={12} />
            {uploading ? "Uploading…" : "Upload image"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <span className="text-xs text-[var(--t-muted)]">or</span>
          <input
            type="url"
            className={inp + " flex-1"}
            placeholder="Paste image URL"
            value={value}
            onChange={(e) => { setUploadErr(""); onChange(e.target.value); }}
          />
        </div>
      )}

      {uploadErr && (
        <p className="mt-1 text-xs text-red-600">{uploadErr}</p>
      )}
    </div>
  );
}

function ItemForm({ value, onChange, onSubmit, onCancel, saving, submitLabel }) {
  const isPrint = value.itemType === "print";

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-5 space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[var(--t-text2)] mb-1.5">
            Item name <span className="text-brand-red">*</span>
          </label>
          <input
            required
            type="text"
            className={inp}
            placeholder="e.g. Full-colour flyer printing"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[var(--t-text2)] mb-1.5">
            Description
          </label>
          <input
            type="text"
            className={inp}
            placeholder="Short description shown on invoice"
            value={value.description}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--t-text2)] mb-1.5">Category</label>
          <select
            className={sel}
            value={value.category}
            onChange={(e) => onChange({ ...value, category: e.target.value })}
          >
            <option value="">— Uncategorised —</option>
            {ITEM_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--t-text2)] mb-1.5">Unit</label>
          <select
            className={sel}
            value={value.unit}
            onChange={(e) => onChange({ ...value, unit: e.target.value })}
          >
            {ITEM_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--t-text2)] mb-1.5">
            Unit price (GHS) <span className="text-brand-red">*</span>
          </label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            className={inp}
            placeholder="0.00"
            value={value.unitPrice}
            onChange={(e) => onChange({ ...value, unitPrice: e.target.value })}
          />
        </div>
      </div>

      {/* ── Print item toggle ──────────────────────────────────────────────── */}
      <div className="border-t border-[var(--t-border)] pt-4 space-y-4">
        <Toggle
          checked={isPrint}
          onChange={(v) => onChange({ ...value, itemType: v ? "print" : "standard" })}
          label="Print item"
          description="Adds material and size specs — displayed on the production spec sheet when this item appears on a job's invoice."
        />

        {isPrint && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-12">
            <div>
              <label className="block text-xs font-medium text-[var(--t-text2)] mb-1.5">
                Material / substrate <span className="text-brand-red">*</span>
              </label>
              <input
                required={isPrint}
                type="text"
                className={inp}
                placeholder="e.g. 130gsm Gloss Art Paper"
                value={value.printSpecMaterial}
                onChange={(e) => onChange({ ...value, printSpecMaterial: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--t-text2)] mb-1.5">
                Size / format <span className="text-brand-red">*</span>
              </label>
              <input
                required={isPrint}
                type="text"
                className={inp}
                placeholder='e.g. A5 (148×210mm) or DL Folded'
                value={value.printSpecSize}
                onChange={(e) => onChange({ ...value, printSpecSize: e.target.value })}
              />
            </div>
          </div>
        )}

        <Toggle
          checked={value.isPublic}
          onChange={(v) => onChange({ ...value, isPublic: v })}
          label="Show in customer Rates tab"
          description="Customers will see this item and its price in the Rates section of their portal."
        />

        {value.isPublic && (
          <div className="pl-12">
            <ThumbnailField
              value={value.thumbnailUrl}
              onChange={(url) => onChange({ ...value, thumbnailUrl: url })}
            />
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-2 text-sm font-medium text-[var(--t-text2)] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-red text-white text-sm font-semibold px-5 py-2 hover:bg-brand-red/90 disabled:opacity-60 transition-colors"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function ItemsTab() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(BLANK);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(BLANK);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setItems(await listItems()); }
    catch (err) { setError(err.message ?? "Could not load items."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!addForm.name.trim()) { setAddError("Item name is required."); return; }
    setAddError("");
    setAddSaving(true);
    try {
      const item = await createItem({
        ...addForm,
        createdBy: user?.id,
        printSpecs: addForm.itemType === "print"
          ? { material: addForm.printSpecMaterial, size: addForm.printSpecSize }
          : null,
        thumbnailUrl: addForm.thumbnailUrl || null,
      });
      setItems((prev) => [...prev, item].sort((a, b) =>
        (a.category || "").localeCompare(b.category || "") || a.name.localeCompare(b.name)
      ));
      setAddForm(BLANK);
      setShowAdd(false);
    } catch (err) {
      setAddError(err.message ?? "Could not save item.");
    } finally {
      setAddSaving(false);
    }
  }

  function startEdit(item) {
    setEditId(item.id);
    setEditForm({
      name:              item.name,
      description:       item.description || "",
      category:          item.category || "",
      unit:              item.unit,
      unitPrice:         Number(item.unit_price),
      itemType:          item.item_type || "standard",
      printSpecMaterial: item.print_specs?.material || "",
      printSpecSize:     item.print_specs?.size     || "",
      isPublic:          item.is_public || false,
      thumbnailUrl:      item.thumbnail_url || "",
    });
    setEditError("");
  }

  async function handleEdit() {
    if (!editForm.name.trim()) { setEditError("Item name is required."); return; }
    setEditError("");
    setEditSaving(true);
    try {
      const updated = await updateItem(editId, {
        ...editForm,
        printSpecs: editForm.itemType === "print"
          ? { material: editForm.printSpecMaterial, size: editForm.printSpecSize }
          : null,
        thumbnailUrl: editForm.thumbnailUrl || null,
      });
      setItems((prev) => prev.map((i) => i.id === editId ? updated : i));
      setEditId(null);
    } catch (err) {
      setEditError(err.message ?? "Could not update item.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await deleteItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      setError(err.message ?? "Could not delete item.");
    }
  }

  // ── Filtering ───────────────────────────────────────────────────────────────
  const q = search.toLowerCase().trim();
  const visibleItems = items.filter((item) => {
    const matchesSearch = !q ||
      item.name.toLowerCase().includes(q) ||
      (item.description ?? "").toLowerCase().includes(q) ||
      (item.category ?? "").toLowerCase().includes(q);
    const matchesCat = !filterCategory ||
      (filterCategory === "Uncategorised"
        ? !item.category
        : item.category === filterCategory);
    return matchesSearch && matchesCat;
  });

  const grouped = visibleItems.reduce((acc, item) => {
    const key = item.category || "Uncategorised";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const allCategories = [...new Set(items.map((i) => i.category || "Uncategorised"))].sort();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--t-text1)]">Items Catalogue</h2>
          <p className="mt-0.5 text-sm text-[var(--t-muted)]">
            Products and services you can add to quotes, invoices and receipts.
            Mark items as <strong className="text-[var(--t-text2)]">Print items</strong> to attach specs,
            or <strong className="text-[var(--t-text2)]">public</strong> to show them in the customer Rates tab.
          </p>
        </div>
        {!showAdd && (
          <button
            type="button"
            onClick={() => { setShowAdd(true); setAddForm(BLANK); setAddError(""); }}
            className="rounded-lg bg-brand-red text-white text-sm font-semibold px-4 py-2.5 hover:bg-brand-red/90 transition-colors shrink-0"
          >
            + Add Item
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-6">
          {addError && (
            <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
              {addError}
            </div>
          )}
          <ItemForm
            value={addForm}
            onChange={setAddForm}
            onSubmit={handleAdd}
            onCancel={() => { setShowAdd(false); setAddError(""); }}
            saving={addSaving}
            submitLabel="Add item"
          />
        </div>
      )}

      {/* Items list */}
      <div className="bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] p-5 sm:p-6">

        {/* Search + filter row */}
        <div className="flex flex-wrap gap-2 mb-5">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--t-muted)]" />
            <input
              type="text"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--t-border)] bg-[var(--t-bg)] pl-9 pr-4 py-2.5 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-colors"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-xl border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2.5 text-sm text-[var(--t-text1)] focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-colors"
          >
            <option value="">All categories</option>
            {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--t-text2)] text-sm">No items yet.</p>
            <p className="text-[var(--t-muted)] text-xs mt-1">Add your first item above to get started.</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-2">
            <Inbox size={32} className="text-[var(--t-muted)]" />
            <p className="text-sm text-[var(--t-text2)]">No items match your search or filter.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([category, catItems]) => (
              <div key={category}>
                <div className="text-xs font-semibold uppercase tracking-widest text-brand-red mb-3 border-b border-[var(--t-border)] pb-2">
                  {category}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-[var(--t-muted)] border-b border-[var(--t-border)]">
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Specs</th>
                        <th className="py-2 pr-4 text-center">Unit</th>
                        <th className="py-2 pr-4 text-right">Unit price</th>
                        <th className="py-2 pr-4">Flags</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catItems.map((item) =>
                        editId === item.id ? (
                          <tr key={item.id}>
                            <td colSpan={6} className="py-3">
                              {editError && (
                                <div role="alert" className="mb-2 text-xs text-red-700">{editError}</div>
                              )}
                              <ItemForm
                                value={editForm}
                                onChange={setEditForm}
                                onSubmit={handleEdit}
                                onCancel={() => setEditId(null)}
                                saving={editSaving}
                                submitLabel="Save changes"
                              />
                            </td>
                          </tr>
                        ) : (
                          <tr key={item.id} className="border-b border-[var(--t-border)] hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-2.5">
                                {item.thumbnail_url && (
                                  <img
                                    src={item.thumbnail_url}
                                    alt={item.name}
                                    className="w-9 h-9 rounded-lg object-cover border border-[var(--t-border)] shrink-0"
                                  />
                                )}
                                <div>
                                  <p className="font-medium text-[var(--t-text1)]">{item.name}</p>
                                  {item.description && (
                                    <p className="text-xs text-[var(--t-muted)] mt-0.5">{item.description}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-[var(--t-muted)]">
                              {item.item_type === "print" && item.print_specs ? (
                                <span className="text-xs">
                                  {item.print_specs.material}
                                  {item.print_specs.size ? ` · ${item.print_specs.size}` : ""}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="py-2.5 pr-4 text-center text-[var(--t-text2)]">{item.unit}</td>
                            <td className="py-2.5 pr-4 text-right font-medium text-[var(--t-text1)] whitespace-nowrap">
                              {GHS(item.unit_price)}
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="flex flex-wrap gap-1">
                                {item.item_type === "print" && (
                                  <span className="rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-[10px] font-semibold px-2 py-0.5">
                                    🖨️ Print
                                  </span>
                                )}
                                {item.is_public && (
                                  <span className="rounded-full bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 text-[10px] font-semibold px-2 py-0.5">
                                    ✓ Public
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => startEdit(item)}
                                  className="text-xs font-medium text-brand-red hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item)}
                                  className="text-xs font-medium text-red-500 hover:underline"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
