import { useLocation } from 'react-router-dom';
import { transactionsListPath } from '../utils/transactionsListPath';

export function useTransactionsListReturn() {
  const location = useLocation();
  const transactionsList = location.state?.transactionsList ?? null;
  const returnTo = transactionsList ? transactionsListPath(transactionsList) : '/transactions';
  return { returnTo, transactionsList };
}
