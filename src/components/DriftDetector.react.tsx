import React, { useState, useEffect, useCallback } from 'react';

interface Drift {
  articleId: string;
  title: string;
  status: 'match' | 'divergent' | 'error';
  diff?: string;
}

export default function DriftDetector({ workspaceId: _workspaceId }: { workspaceId: string }) {
  const [drifts, setDrifts] = useState<Drift[]>([]);
  const [running, setRunning] = useState(false);

  const runDetection = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/drift');
      if (res.ok) {
        const data = (await res.json()) as Drift[];
        setDrifts(data);
      } else {
        setDrifts([]);
      }
    } catch {
      setDrifts([]);
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    runDetection();
  }, [runDetection]);

  return (
    <div className="p-4 border rounded">
      <button type="button" onClick={runDetection} disabled={running}>
        {running ? 'Running...' : 'Run Drift Detection'}
      </button>
      <div className="mt-4">
        {drifts.map((d) => {
          const badge =
            d.status === 'match' ? (
              <span className="text-green-600">✓ match</span>
            ) : d.status === 'divergent' ? (
              <span className="text-red-600">⚠ divergent</span>
            ) : (
              <span className="text-gray-500">✗ error</span>
            );

          return (
            <div key={d.articleId} className="mb-2">
              <strong>{d.title}</strong>: {badge}
              {d.diff && <div className="text-xs text-gray-600 mt-1">{d.diff}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
