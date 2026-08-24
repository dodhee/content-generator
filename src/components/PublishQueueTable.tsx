import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

interface Job {
  id: string;
  title: string;
  target_site: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  timestamp: string;
  error_message?: string;
}

export default function PublishQueueTable({ workspaceId }: { workspaceId: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/publish/queue?workspace_id=${workspaceId}`);
      if (!response.ok) throw new Error('Failed to fetch queue');
      const data = await response.json();
      setJobs(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleRetry = useCallback(
    async (jobId: string) => {
      try {
        await fetch(`/api/publish/${jobId}/retry`, { method: 'PATCH' });
        fetchJobs();
      } catch (err) {
        console.error('Retry failed', err);
      }
    },
    [fetchJobs],
  );

  const filteredJobs =
    statusFilter === 'all' ? jobs : jobs.filter((j) => j.status === statusFilter);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="p-4 border rounded">
      <div className="flex justify-between mb-4">
        <select
          value={statusFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
        <button type="button" onClick={fetchJobs}>
          Refresh
        </button>
      </div>
      <table className="w-full">
        <thead>
          <tr>
            <th>Title</th>
            <th>Site</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredJobs.map((job) => (
            <tr key={job.id}>
              <td>{job.title}</td>
              <td>{job.target_site}</td>
              <td>{job.status}</td>
              <td>
                {job.status === 'failed' && (
                  <button type="button" onClick={() => handleRetry(job.id)}>
                    Retry
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
