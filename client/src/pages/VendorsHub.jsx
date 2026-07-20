import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import CrmHubTabs from '../components/crm/CrmHubTabs';
import VendorStars from '../components/crm/VendorStars';
import Icon from '../components/shared/Icon';
import ListPagination from '../components/shared/ListPagination';

const EMPTY_FORM = {
  name: '',
  company: '',
  category: '',
  phone: '',
  email: '',
  website: '',
  rating: null,
  notes: '',
};

const selectClass =
  'px-3 py-2 border border-outline-variant/25 rounded-lg text-sm bg-white min-w-0 focus:outline-none focus:ring-2 focus:ring-secondary/30';

const inputClass =
  'w-full px-3 py-2 border border-outline-variant/25 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30';

function VendorCard({ vendor, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        selected
          ? 'border-secondary bg-secondary/5 ring-2 ring-secondary/20'
          : 'border-outline-variant/15 bg-white hover:border-secondary/40 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-primary truncate">{vendor.name}</p>
          {vendor.company && (
            <p className="text-xs text-on-surface-variant truncate">{vendor.company}</p>
          )}
        </div>
        {vendor.category && (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary-container/10 text-primary-container border border-primary-container/20 truncate max-w-[7rem]">
            {vendor.category}
          </span>
        )}
      </div>
      <VendorStars rating={vendor.rating} size="sm" className="mb-2" />
      <div className="space-y-0.5 text-[12px] text-on-surface-variant">
        {vendor.phone && <p className="truncate">{vendor.phone}</p>}
        {vendor.email && <p className="truncate">{vendor.email}</p>}
        {!vendor.phone && !vendor.email && <p className="text-on-surface-variant/50">No contact info</p>}
      </div>
      {vendor.notes && (
        <p className="mt-2 text-[12px] text-on-surface-variant/80 line-clamp-2 whitespace-pre-wrap">
          {vendor.notes}
        </p>
      )}
    </button>
  );
}

function VendorDrawer({
  mode,
  form,
  setForm,
  categories,
  saving,
  error,
  onClose,
  onSave,
  onDelete,
}) {
  const isCreate = mode === 'create';

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-primary/20 backdrop-blur-[1px]"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white shadow-2xl border-l border-outline-variant/15 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
          <h2 className="text-lg font-bold text-primary">
            {isCreate ? 'Add vendor' : 'Edit vendor'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low"
            aria-label="Close"
          >
            <Icon name="close" className="!text-[20px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Name *
            </span>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Vendor name"
              autoFocus
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Company
            </span>
            <input
              className={inputClass}
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Category
            </span>
            <input
              className={inputClass}
              list="vendor-categories"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="e.g. Inspector, Title, Photographer"
            />
            <datalist id="vendor-categories">
              {categories.map((c) => (
                <option key={c.value} value={c.value} />
              ))}
            </datalist>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Phone
              </span>
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                Email
              </span>
              <input
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Website
            </span>
            <input
              className={inputClass}
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="https://"
            />
          </label>
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Rating
            </span>
            <div className="flex items-center gap-2">
              <VendorStars
                rating={form.rating}
                onChange={(r) => setForm((f) => ({ ...f, rating: r }))}
              />
              <span className="text-[11px] text-on-surface-variant">
                {form.rating ? `${form.rating}/5` : 'Click a star · click again to clear'}
              </span>
            </div>
          </div>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Notes
            </span>
            <textarea
              className={`${inputClass} min-h-[8rem] resize-y`}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Team notes about this vendor…"
            />
          </label>
          {error && <p className="text-sm text-error">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-outline-variant/10 flex items-center gap-2">
          {!isCreate && (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              className="px-3 py-2 text-sm font-semibold text-error hover:bg-error/5 rounded-lg disabled:opacity-50"
            >
              Delete
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isCreate ? 'Create' : 'Save'}
          </button>
        </div>
      </aside>
    </>
  );
}

export default function VendorsHub() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('rating');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ vendors: [], total: 0 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null); // null | 'create' | vendor id
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadCategories = useCallback(async () => {
    const res = await fetch('/api/vendors/categories', { credentials: 'include' });
    const json = await res.json();
    setCategories(json.categories || []);
  }, []);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: '50',
      sort,
      order: sort === 'name' ? 'asc' : 'desc',
    });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (category) params.set('category', category);

    const res = await fetch(`/api/vendors?${params}`, { credentials: 'include' });
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [page, debouncedSearch, category, sort]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setError('');
    setDrawer('create');
  }

  function openEdit(vendor) {
    setForm({
      name: vendor.name || '',
      company: vendor.company || '',
      category: vendor.category || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      website: vendor.website || '',
      rating: vendor.rating ?? null,
      notes: vendor.notes || '',
    });
    setError('');
    setDrawer(vendor.id);
  }

  function closeDrawer() {
    setDrawer(null);
    setError('');
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      company: form.company.trim() || null,
      category: form.category.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      rating: form.rating,
      notes: form.notes.trim() || null,
    };

    try {
      const isCreate = drawer === 'create';
      const res = await fetch(isCreate ? '/api/vendors' : `/api/vendors/${drawer}`, {
        method: isCreate ? 'POST' : 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Save failed');
        setSaving(false);
        return;
      }
      closeDrawer();
      await Promise.all([fetchVendors(), loadCategories()]);
    } catch {
      setError('Save failed');
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (drawer === 'create' || drawer == null) return;
    if (!window.confirm('Delete this vendor? This cannot be undone.')) return;

    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/vendors/${drawer}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || 'Delete failed');
        setSaving(false);
        return;
      }
      closeDrawer();
      await Promise.all([fetchVendors(), loadCategories()]);
    } catch {
      setError('Delete failed');
    }
    setSaving(false);
  }

  const selectedId = drawer !== 'create' && drawer != null ? drawer : null;

  return (
    <DashboardLayout title="CRM Hub" headerRight={<CrmHubTabs />} className="p-6 lg:p-8">
      <div className="w-full space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-primary">Vendors</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Team directory of preferred vendors — notes and ratings shared by everyone.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90"
          >
            <Icon name="add" className="!text-[18px]" />
            Add vendor
          </button>
        </div>

        <div className="rounded-xl border border-outline-variant/15 bg-white p-3 sm:p-4 space-y-3 shadow-sm">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[14rem]">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-[18px]"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, company, category, notes, phone, email…"
                className="w-full pl-9 pr-3 py-2 border border-outline-variant/25 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              />
            </div>
            <input
              type="text"
              list="vendor-filter-categories"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              placeholder="Category filter…"
              className={`${selectClass} w-[10rem]`}
            />
            <datalist id="vendor-filter-categories">
              {categories.map((c) => (
                <option key={c.value} value={c.value} />
              ))}
            </datalist>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className={`${selectClass} w-[9rem]`}
            >
              <option value="rating">Sort: Rating</option>
              <option value="name">Sort: Name</option>
              <option value="updated_at">Sort: Updated</option>
            </select>
          </div>
          <p className="text-xs text-on-surface-variant">
            {loading ? 'Loading…' : `${data.total?.toLocaleString() ?? 0} vendors`}
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-outline-variant/15 bg-white py-16 text-center text-on-surface-variant">
            Loading vendors…
          </div>
        ) : data.vendors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant/30 bg-white py-16 px-6 text-center">
            <Icon name="storefront" className="!text-[40px] text-on-surface-variant/40 mb-3" />
            <p className="font-semibold text-primary mb-1">No vendors yet</p>
            <p className="text-sm text-on-surface-variant mb-4 max-w-sm mx-auto">
              Add inspectors, title companies, photographers, and other partners the team recommends.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90"
            >
              <Icon name="add" className="!text-[18px]" />
              Add first vendor
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/40 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 p-3 sm:p-4">
              {data.vendors.map((v) => (
                <VendorCard
                  key={v.id}
                  vendor={v}
                  selected={selectedId === v.id}
                  onClick={() => openEdit(v)}
                />
              ))}
            </div>
            <ListPagination page={page} total={data.total ?? 0} onPageChange={setPage} />
          </div>
        )}
      </div>

      {drawer != null && (
        <VendorDrawer
          mode={drawer === 'create' ? 'create' : 'edit'}
          form={form}
          setForm={setForm}
          categories={categories}
          saving={saving}
          error={error}
          onClose={closeDrawer}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </DashboardLayout>
  );
}
