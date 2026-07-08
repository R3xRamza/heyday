import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { writeTransactionsNavPath } from '../utils/transactionsListPath';

/** Persist last /transactions route (list or detail) for sidebar return navigation. */
export default function TransactionsNavTracker() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    writeTransactionsNavPath(pathname, search);
  }, [pathname, search]);

  return null;
}
