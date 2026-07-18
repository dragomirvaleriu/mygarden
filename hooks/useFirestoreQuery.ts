import { useState, useEffect, useCallback } from 'react';
import { query, onSnapshot, Query, limit, DocumentData } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/firebase';

interface UseFirestoreQueryOptions {
  pageSize?: number;
}

export function useFirestoreQuery<T>(
  baseQuery: Query<DocumentData> | null,
  options: UseFirestoreQueryOptions = {}
) {
  const { pageSize = 20 } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentLimit, setCurrentLimit] = useState(pageSize);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!baseQuery) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = pageSize > 0 ? query(baseQuery, limit(currentLimit)) : baseQuery;
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as unknown as T));
        setData(items);
        setHasMore(pageSize > 0 ? snapshot.docs.length === currentLimit : false);
        setLoading(false);
        setLoadingMore(false);
      },
      (err) => {
        console.error('Error fetching data:', err);
        setError(err as Error);
        setLoading(false);
        setLoadingMore(false);
        
        // Use handleFirestoreError to provide more context if it's a permission error
        if (err.code === 'permission-denied') {
          try {
            handleFirestoreError(err, OperationType.LIST, null);
          } catch (e) {
            // Error is re-thrown by handleFirestoreError
          }
        }
      }
    );

    return () => unsubscribe();
  }, [baseQuery, currentLimit]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || !baseQuery) return;
    setLoadingMore(true);
    setCurrentLimit((prev) => prev + pageSize);
  }, [baseQuery, hasMore, loadingMore, pageSize]);

  return { data, loading, error, hasMore, loadMore, loadingMore };
}
