import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import TransactionSetup from '../components/TransactionSetup';
import TransactionWorkspace from '../components/TransactionWorkspace';
import TransactionPriceHeader from '../components/TransactionPriceHeader';
import PrivateListingFlag from '../components/transactions/PrivateListingFlag';
import { buildFallbackParties } from '../data/transactionParties';
import { parseTransactionAddress } from '../utils/format';
import { isPrivateListing } from '../constants/transactionForm';

async function fetchPartiesForTransaction(id, transaction) {
  const res = await fetch(`/api/transactions/${id}/parties`, { credentials: 'include' });
  if (res.ok) {
    const json = await res.json();
    if (json.parties?.length) return json.parties;
  }

  const fallback = buildFallbackParties(transaction);
  const seed = fallback.map(({ role, name, user_id }) => ({ role, name, user_id }));

  const putRes = await fetch(`/api/transactions/${id}/parties`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ parties: seed }),
  });
  if (putRes.ok) {
    const json = await putRes.json();
    if (json.parties?.length) return json.parties;
  }
  return fallback;
}

export default function TransactionManager() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState(null);
  const [parties, setParties] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransaction = useCallback(async () => {
    if (!id || id === 'undefined') return;
    const res = await fetch(`/api/transactions/${id}`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setTransaction(json.transaction);
      const loaded = json.parties?.length
        ? json.parties
        : await fetchPartiesForTransaction(id, json.transaction);
      setParties(loaded);
    }
    setLoading(false);
  }, [id]);

  const fetchTasks = useCallback(async () => {
    if (!id || id === 'undefined') return;
    const res = await fetch(`/api/tasks?transaction_id=${id}&include_completed=true`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setTasks(json.tasks || []);
    }
  }, [id]);

  const fetchChecklists = useCallback(async () => {
    if (!id || id === 'undefined') return;
    const res = await fetch(`/api/transactions/${id}/checklists`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setChecklists(json.checklists || []);
    }
  }, [id]);

  const fetchActivities = useCallback(async () => {
    if (!id || id === 'undefined') return;
    const res = await fetch(`/api/transactions/${id}/activity`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setActivities(json.activities || []);
    }
  }, [id]);

  useEffect(() => {
    fetch('/api/team', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setUsers(d.members || []));
  }, []);

  useEffect(() => {
    fetchTransaction();
    fetchTasks();
    fetchChecklists();
    fetchActivities();
  }, [fetchTransaction, fetchTasks, fetchChecklists, fetchActivities]);

  if (!id || id === 'undefined') {
    return <Navigate to="/transactions" replace />;
  }

  async function saveTransaction(payload) {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok) {
      setTransaction(json.transaction);
      if (json.parties?.length) setParties(json.parties);
      if (json.tasksRecalculated) fetchTasks();
      fetchActivities();
      return json;
    }
    return null;
  }

  async function saveParties(partiesPayload) {
    const res = await fetch(`/api/transactions/${id}/parties`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ parties: partiesPayload }),
    });
    const json = await res.json();
    if (res.ok) {
      setTransaction(json.transaction);
      setParties(json.parties?.length ? json.parties : await fetchPartiesForTransaction(id, json.transaction));
      return json;
    }
    return null;
  }

  async function updateTask(taskId, body) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? json.task : t)));
      return json.task;
    }
    return null;
  }

  async function deleteTask(taskId) {
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE', credentials: 'include' });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    fetchActivities();
  }

  async function createTask(body) {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...body, transaction_id: Number(id) }),
    });
    const json = await res.json();
    if (res.ok) {
      setTasks((prev) => [...prev, json.task]);
      fetchActivities();
      return json.task;
    }
    return null;
  }

  async function addComment(text) {
    await fetch(`/api/transactions/${id}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ comment: text }),
    });
    fetchActivities();
  }

  async function completeOverdueTasks() {
    const res = await fetch('/api/tasks/bulk/complete-overdue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ transaction_id: Number(id) }),
    });
    const json = await res.json();
    if (!res.ok) return false;
    if (json.tasks) setTasks(json.tasks);
    else await fetchTasks();
    fetchActivities();
    return true;
  }

  async function deleteTransaction() {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      navigate('/transactions');
      return true;
    }
    return false;
  }

  async function removeChecklist(templateId) {
    const res = await fetch(`/api/transactions/${id}/checklists/${templateId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { ok: false, error: json.error || 'Could not remove checklist' };
    }
    const json = await res.json();
    if (json.checklists) setChecklists(json.checklists);
    else await fetchChecklists();
    await fetchTasks();
    await fetchActivities();
    return { ok: true };
  }

  async function applyChecklists(templateIds) {
    const res = await fetch(`/api/transactions/${id}/apply-checklists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ template_ids: templateIds }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || 'Could not apply checklist' };
    await fetchTasks();
    if (json.checklists) setChecklists(json.checklists);
    else await fetchChecklists();
    await fetchActivities();
    return {
      ok: true,
      applied: json.applied || [],
      checklists: json.checklists || [],
      templateIds,
    };
  }

  if (loading) {
    return (
      <DashboardLayout title="Transaction" className="p-0">
        <p className="p-8 text-on-surface-variant">Loading…</p>
      </DashboardLayout>
    );
  }

  if (!transaction) {
    return (
      <DashboardLayout title="Transaction" className="p-8">
        <p className="text-on-surface-variant">Transaction not found.</p>
        <Link to="/transactions" className="text-secondary hover:underline text-sm mt-2 inline-block">← Back to portfolio</Link>
      </DashboardLayout>
    );
  }

  const inSetup = transaction.workflow_status && transaction.workflow_status !== 'active';
  const { street, cityLine } = parseTransactionAddress({
    address: transaction.address,
    city: transaction.city,
    state: transaction.state,
    zip: transaction.zip,
  });

  const privateFlag = isPrivateListing(transaction) ? <PrivateListingFlag /> : null;

  if (inSetup) {
    return (
      <DashboardLayout title={street} subtitle={cityLine || undefined} titleAddon={privateFlag} className="bg-surface">
        <div className="px-8 pt-4">
          <Link to="/transactions" className="text-sm text-secondary hover:underline">← Back to transactions</Link>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <h1 className="text-2xl font-bold text-primary">{street}</h1>
            {privateFlag}
          </div>
          {cityLine && <p className="text-sm text-on-surface-variant mt-1">{cityLine}</p>}
        </div>
        <TransactionSetup
          transaction={transaction}
          onUpdate={(tx) => setTransaction(tx)}
          onComplete={(tx) => {
            setTransaction(tx);
            fetchTasks();
            fetchChecklists();
            fetchActivities();
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={street}
      subtitle={cityLine || undefined}
      titleAddon={privateFlag}
      fillViewport
      className="p-0 overflow-hidden flex flex-col"
      headerRight={
        <TransactionPriceHeader
          value={transaction.value}
          onSave={(value) => saveTransaction({ value })}
        />
      }
    >
      <TransactionWorkspace
        transaction={transaction}
        checklists={checklists}
        parties={parties}
        tasks={tasks}
        activities={activities}
        users={users}
        onSaveTransaction={saveTransaction}
        onSaveParties={saveParties}
        onTaskUpdate={updateTask}
        onTaskDelete={deleteTask}
        onTaskCreate={createTask}
        onAddComment={addComment}
        onRefreshActivities={fetchActivities}
        onDeleteTransaction={deleteTransaction}
        onRemoveChecklist={removeChecklist}
        onApplyChecklists={applyChecklists}
        onCompleteOverdueTasks={completeOverdueTasks}
      />
    </DashboardLayout>
  );
}
