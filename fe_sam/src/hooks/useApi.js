
import { useEffect, useState } from 'react';
import { subscribe } from '../utils/api';

/** Gọi API và tự gọi lại khi dữ liệu thay đổi (thay cho refetch thủ công). */
export function useApi(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);

  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(fn)
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, loading: data === null && error === null };
}
