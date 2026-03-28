import MetricsCards from '@/components/MetricsCards';
import TraceList from '@/components/TraceList';

export default function Home() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-sm text-gray-500">Real-time agent observability — auto-refreshes every 10s</p>
      </div>
      <MetricsCards />
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Traces</h2>
        <TraceList />
      </div>
    </div>
  );
}
