import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import CrmHubTabs from '../components/crm/CrmHubTabs';
import VendorLikeButton from '../components/crm/VendorLikeButton';
import Icon from '../components/shared/Icon';
import ListPagination from '../components/shared/ListPagination';
import DateText from '../components/shared/DateText';

const EMPTY_FORM = {
  name: '',
  company: '',
  category: '',
  phone: '',
  email: '',
  website: '',
  notes: '',
};

const selectClass =
  'px-3 py-2 border border-outline-variant/25 rounded-lg text-sm bg-white min-w-0 focus:outline-none focus:ring-2 focus:ring-secondary/30';

const inputClass =
  'w-full px-3 py-2 border border-outline-variant/25 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30';

function CategoryChip({ category }) {
  if (!category) {
    return <span className="text-on-surface-variant/40">—</span>;
  }
  return (
    <span className="inline-flex max-w-full px-3 py-1 rounded-full text-sm font-semibold border bg-primary-container/10 text-primary-container border-primary-container/25 truncate">
      {category}
    </span>
  );
}

function LikeNoteModal({ vendorName, busy, onClose, onSubmit }) {
  const [wantNote, setWantNote] = useState(false);
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-primary/25 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
        disabled={busy}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="like-note-title"
        className="relative w-full max-w-md rounded-xl bg-white shadow-2xl border border-outline-variant/15 p-5 space-y-4"
      >
        <h3 id="like-note-title" className="text-lg font-bold text-primary">
          Add a like
        </h3>
        <p className="text-sm text-on-surface-variant">
          {vendorName ? (
            <>
              Liking <span className="font-semibold text-primary">{vendorName}</span>
            </>
          ) : (
            'Add a like for this vendor'
          )}
        </p>

        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={wantNote}
            onChange={(e) => setWantNote(e.target.checked)}
            className="mt-1 rounded border-outline-variant"
            disabled={busy}
          />
          <span className="text-sm text-primary font-medium">Leave a note with this like</span>
        </label>

        {wantNote && (
          <textarea
            className={`${inputClass} min-h-[5.5rem] resize-y`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why you recommend them…"
            autoFocus
            disabled={busy}
          />
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSubmit(wantNote ? note.trim() : '')}
            className="px-4 py-2 text-sm font-semibold bg-secondary text-white rounded-lg hover:bg-secondary/90 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Add like'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditLikeNoteModal({ like, busy, onClose, onSubmit }) {
  const [note, setNote] = useState(like?.note || '');

  useEffect(() => {
    setNote(like?.note || '');
  }, [like]);

  if (!like) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-primary/25 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
        disabled={busy}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-like-title"
        className="relative w-full max-w-md rounded-xl bg-white shadow-2xl border border-outline-variant/15 p-5 space-y-4"
      >
        <h3 id="edit-like-title" className="text-lg font-bold text-primary">
          Edit like note
        </h3>
        <p className="text-sm text-on-surface-variant">
          From <span className="font-semibold text-primary">{like.user_name || 'Teammate'}</span>
        </p>
        <textarea
          className={`${inputClass} min-h-[5.5rem] resize-y`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional — leave blank to clear)"
          autoFocus
          disabled={busy}
        />
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSubmit(note.trim())}
            className="px-4 py-2 text-sm font-semibold bg-secondary text-white rounded-lg hover:bg-secondary/90 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formFromVendor(vendor) {
  return {
    name: vendor.name || '',
    company: vendor.company || '',
    category: vendor.category || '',
    phone: vendor.phone || '',
    email: vendor.email || '',
    website: vendor.website || '',
    notes: vendor.notes || '',
  };
}

function VendorDrawer({
  mode,
  form,
  setForm,
  categories,
  likes,
  likedByMe,
  likeCount,
  likeBusy,
  saving,
  error,
  onClose,
  onSave,
  onDelete,
  onLike,
  onEditLike,
  onRemoveLike,
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
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Team notes
            </span>
            <textarea
              className={`${inputClass} min-h-[5rem] resize-y`}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="General notes about this vendor…"
            />
          </label>

          {!isCreate && (
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                  Likes
                </p>
                <VendorLikeButton count={likeCount} liked={likedByMe} size="md" />
              </div>
              <button
                type="button"
                disabled={likeBusy}
                onClick={onLike}
                className="w-full px-3 py-2 text-sm font-semibold rounded-lg bg-secondary text-white hover:bg-secondary/90 disabled:opacity-50"
              >
                {likeBusy ? 'Saving…' : 'Add a like'}
              </button>
              <p className="text-[11px] text-on-surface-variant">
                You can like multiple times and optionally add a note each time.
              </p>

              {likes?.length > 0 && (
                <ul className="space-y-2.5 pt-2 border-t border-outline-variant/10">
                  {likes.map((like) => (
                    <li key={like.id} className="text-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-semibold text-primary truncate">
                          {like.user_name || 'Teammate'}
                          {like.is_mine ? (
                            <span className="ml-1 text-[10px] font-semibold uppercase text-secondary">You</span>
                          ) : null}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <DateText
                            value={like.created_at?.slice?.(0, 10) || like.created_at}
                            className="text-[11px] text-on-surface-variant"
                          />
                          <button
                            type="button"
                            disabled={likeBusy}
                            onClick={() => onEditLike(like)}
                            className="text-[11px] font-semibold text-secondary hover:underline disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={likeBusy}
                            onClick={() => onRemoveLike(like.id)}
                            className="text-[11px] font-semibold text-error hover:underline disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      {like.note ? (
                        <p className="text-on-surface-variant mt-0.5 whitespace-pre-wrap">{like.note}</p>
                      ) : (
                        <p className="text-on-surface-variant/50 text-xs mt-0.5 italic">Liked</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
  const [sort, setSort] = useState('likes');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ vendors: [], total: 0 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [likes, setLikes] = useState([]);
  const [likedByMe, setLikedByMe] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [likeModal, setLikeModal] = useState(null); // { vendorId, vendorName }
  const [editLike, setEditLike] = useState(null); // like object
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
      order: sort === 'name' || sort === 'category' ? 'asc' : 'desc',
    });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (category) params.set('category', category);

    const res = await fetch(`/api/vendors?${params}`, { credentials: 'include' });
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [page, debouncedSearch, category, sort]);

  const hasFilters = !!(debouncedSearch || category);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  function applyVendorDetail(vendor) {
    setForm(formFromVendor(vendor));
    setLikes(vendor.likes || []);
    setLikedByMe(!!vendor.liked_by_me);
    setLikeCount(vendor.like_count ?? 0);
  }

  function patchVendorInList(vendor) {
    setData((prev) => ({
      ...prev,
      vendors: (prev.vendors || []).map((v) =>
        v.id === vendor.id
          ? {
            ...v,
            like_count: vendor.like_count ?? 0,
            liked_by_me: !!vendor.liked_by_me,
          }
          : v,
      ),
    }));
    if (drawer === vendor.id) {
      applyVendorDetail(vendor);
    }
  }

  async function postLike(vendorId, note) {
    const res = await fetch(`/api/vendors/${vendorId}/likes`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note || null }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Could not like');
    return json.vendor;
  }

  function openLikeModal(vendorId, vendorName) {
    setLikeModal({ vendorId, vendorName: vendorName || '' });
  }

  async function submitLikeModal(note) {
    if (!likeModal) return;
    setLikeBusy(true);
    setError('');
    try {
      const vendor = await postLike(likeModal.vendorId, note);
      patchVendorInList(vendor);
      setLikeModal(null);
      await fetchVendors();
    } catch (err) {
      setError(err.message || 'Could not like');
    }
    setLikeBusy(false);
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setLikes([]);
    setLikedByMe(false);
    setLikeCount(0);
    setError('');
    setDrawer('create');
  }

  async function openEdit(vendor) {
    setError('');
    setDrawer(vendor.id);
    setForm(formFromVendor(vendor));
    setLikedByMe(!!vendor.liked_by_me);
    setLikeCount(vendor.like_count ?? 0);
    setLikes([]);

    const res = await fetch(`/api/vendors/${vendor.id}`, { credentials: 'include' });
    if (!res.ok) return;
    const json = await res.json();
    if (json.vendor) applyVendorDetail(json.vendor);
  }

  function closeDrawer() {
    setDrawer(null);
    setError('');
  }

  function handleLike() {
    if (drawer === 'create' || drawer == null) return;
    openLikeModal(drawer, form.name);
  }

  async function handleRemoveLike(likeId) {
    if (drawer === 'create' || drawer == null) return;
    setLikeBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/vendors/${drawer}/likes/${likeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Could not remove like');
        setLikeBusy(false);
        return;
      }
      patchVendorInList(json.vendor);
      await fetchVendors();
    } catch {
      setError('Could not remove like');
    }
    setLikeBusy(false);
  }

  async function submitEditLike(note) {
    if (!editLike || drawer === 'create' || drawer == null) return;
    setLikeBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/vendors/${drawer}/likes/${editLike.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Could not update note');
        setLikeBusy(false);
        return;
      }
      patchVendorInList(json.vendor);
      setEditLike(null);
      await fetchVendors();
    } catch {
      setError('Could not update note');
    }
    setLikeBusy(false);
  }

  function addLikeFromList(vendor) {
    openLikeModal(vendor.id, vendor.name);
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
    <DashboardLayout
      title="CRM Hub"
      headerRight={(
        <div className="flex items-center gap-2">
          <CrmHubTabs />
          <button
            type="button"
            onClick={openCreate}
            className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold uppercase tracking-wide hover:bg-primary/90"
          >
            <Icon name="add" className="!text-[16px]" />
            Add
          </button>
        </div>
      )}
      className="p-6 lg:p-8"
    >
      <div className="w-full space-y-5">
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
              placeholder="Category…"
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
              <option value="likes">Sort: Likes</option>
              <option value="category">Sort: Category</option>
              <option value="name">Sort: Name</option>
              <option value="updated_at">Sort: Updated</option>
            </select>
            <button
              type="button"
              onClick={openCreate}
              className="sm:hidden inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
            >
              <Icon name="add" className="!text-[18px]" />
              Add
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>
              {loading ? 'Loading…' : `${data.total?.toLocaleString() ?? 0} vendors`}
              {hasFilters && ' (filtered)'}
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCategory('');
                  setPage(1);
                }}
                className="text-secondary font-semibold hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant/15 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[780px]">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col className="w-[18%]" />
                <col className="w-10" />
              </colgroup>
              <thead className="bg-surface-container-low border-b border-outline-variant/10">
                <tr>
                  {['Vendor', 'Category', 'Likes', 'Phone', 'Email', 'Notes', ''].map((h) => (
                    <th
                      key={h || 'chevron'}
                      className="px-4 py-3 text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center text-on-surface-variant">
                      Loading vendors…
                    </td>
                  </tr>
                ) : data.vendors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center">
                      <Icon name="storefront" className="!text-[36px] text-on-surface-variant/40 mb-2" />
                      <p className="font-semibold text-primary mb-1">No vendors match</p>
                      <p className="text-sm text-on-surface-variant mb-3">
                        Try clearing filters or add a new vendor.
                      </p>
                      <button
                        type="button"
                        onClick={openCreate}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90"
                      >
                        <Icon name="add" className="!text-[18px]" />
                        Add vendor
                      </button>
                    </td>
                  </tr>
                ) : (
                  data.vendors.map((v) => (
                    <tr
                      key={v.id}
                      onClick={() => openEdit(v)}
                      className={`transition-colors cursor-pointer group ${
                        selectedId === v.id
                          ? 'bg-secondary/5'
                          : 'hover:bg-primary-container/5'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-sm text-primary truncate">{v.name}</p>
                        {v.company && (
                          <p className="text-[11px] text-on-surface-variant truncate">{v.company}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <CategoryChip category={v.category} />
                      </td>
                      <td className="px-4 py-3">
                        <VendorLikeButton
                          count={v.like_count ?? 0}
                          liked={!!v.liked_by_me}
                          onToggle={() => addLikeFromList(v)}
                        />
                      </td>
                      <td className="px-4 py-3 text-[13px] text-on-surface-variant truncate">
                        {v.phone || '—'}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-on-surface-variant truncate">
                        {v.email || '—'}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-on-surface-variant/80 truncate">
                        {v.notes || '—'}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Icon
                          name="chevron_right"
                          className="text-outline group-hover:text-primary transition-colors !text-[20px]"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <ListPagination page={page} total={data.total ?? 0} onPageChange={setPage} />
        </div>
      </div>

      {drawer != null && (
        <VendorDrawer
          mode={drawer === 'create' ? 'create' : 'edit'}
          form={form}
          setForm={setForm}
          categories={categories}
          likes={likes}
          likedByMe={likedByMe}
          likeCount={likeCount}
          likeBusy={likeBusy}
          saving={saving}
          error={error}
          onClose={closeDrawer}
          onSave={handleSave}
          onDelete={handleDelete}
          onLike={handleLike}
          onEditLike={setEditLike}
          onRemoveLike={handleRemoveLike}
        />
      )}

      {likeModal && (
        <LikeNoteModal
          vendorName={likeModal.vendorName}
          busy={likeBusy}
          onClose={() => !likeBusy && setLikeModal(null)}
          onSubmit={submitLikeModal}
        />
      )}

      {editLike && (
        <EditLikeNoteModal
          like={editLike}
          busy={likeBusy}
          onClose={() => !likeBusy && setEditLike(null)}
          onSubmit={submitEditLike}
        />
      )}
    </DashboardLayout>
  );
}
