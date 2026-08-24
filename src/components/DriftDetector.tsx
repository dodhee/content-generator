import React, { useState, useEffect, useCallback } from 'react';

interface Drift {
  title: string;
  status: 'match' | 'divergent';
  diff?: string;
}

export default function DriftDetector({ workspaceId: _workspaceId }: { workspaceId: string }) {
  const [drifts, setDrifts] = useState<Drift[]>([]);
  const [running, setRunning] = useState(false);

  const runDetection = useCallback(async () => {
    setRunning(true);
    // Mocking the API call for now
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setDrifts([
      { title: 'Article 1', status: 'match' },
      { title: 'Article 2', status: 'divergent', diff: '...' },
    ]);
    setRunning(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(runDetection, 60000);
    return () => clearInterval(interval);
  }, [runDetection]);

  return (
    <div className="p-4 border rounded">
      <button type="button" onClick={runDetection} disabled={running}>
        {running ? 'Running...' : 'Run Drift Detection'}
      </button>
      <div className="mt-4">
        {drifts.map((d) => (
          <div key={d.title} className={d.status === 'divergent' ? 'text-red-500' : ''}>
            {d.title}: {d.status}
          </div>
        ))}
      </div>
    </div>
  );
}
