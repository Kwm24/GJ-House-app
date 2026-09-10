import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../AuthProvider.jsx";
import {
  listItems, createItem, updateItem, deleteItem,
  ITEM_UNITS, ITEM_CATEGORIES,
} from "../../lib/items.js";
import { formatGHS as GHS } from "../../lib/currency.js";

const inp =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 " +
  "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red";
const sel = inp;

const BLANK = { name: "", description: "", category: "", unit: "ea", unitPrice: "" };

function ItemForm({ value, onChange, onSubmit, onCancel, saving, submitLabel }) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="rounded-xl border border-brand-red/30 bg-white p-5 space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
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
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
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
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Category</label>
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
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Unit</label>
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
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
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

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(BLANK);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(BLANK);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Group items by category for display
  const grouped = items.reduce((acc, item) => {
    const key = item.category || "Uncategorised";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

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
      const item = await createItem({ ...addForm, createdBy: user?.id });
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
      name: item.name,
      description: item.description || "",
      category: item.category || "",
      unit: item.unit,
      unitPrice: Number(item.unit_price),
    });
    setEditError("");
  }

  async function handleEdit() {
    if (!editForm.name.trim()) { setEditError("Item name is required."); return; }
    setEditError("");
    setEditSaving(true);
    try {
      const updated = await updateItem(editId, editForm);
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-brand-cream">Items Catalogue</h2>
          <p className="mt-0.5 text-sm text-brand-cream/60">
            Products and services you can add to quotes, invoices and receipts.
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
      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No items yet.</p>
            <p className="text-gray-400 text-xs mt-1">Add your first item above to get started.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([category, catItems]) => (
              <div key={category}>
                <div className="text-xs font-semibold uppercase tracking-widest text-brand-red mb-3 border-b border-brand-sand pb-2">
                  {category}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-300">
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Description</th>
                        <th className="py-2 pr-4 text-center">Unit</th>
                        <th className="py-2 pr-4 text-right">Unit price</th>
                        <th className="py-2 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catItems.map((item) =>
                        editId === item.id ? (
                          <tr key={item.id}>
                            <td colSpan={5} className="py-3">
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
                          <tr key={item.id} className="border-b border-gray-100 hover:bg-white/60 transition-colors">
                            <td className="py-2.5 pr-4 font-medium text-brand-dark">{item.name}</td>
                            <td className="py-2.5 pr-4 text-gray-500 text-xs">{item.description || "—"}</td>
                            <td className="py-2.5 pr-4 text-center text-gray-600">{item.unit}</td>
                            <td className="py-2.5 pr-4 text-right font-medium text-brand-dark whitespace-nowrap">
                              {GHS(item.unit_price)}
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
