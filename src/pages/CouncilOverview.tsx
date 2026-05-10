import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import AgentCard from '../components/AgentCard';
import ConfigDrawer from '../components/ConfigDrawer';
import TestRunModal from '../components/TestRunModal';
import type { Agent } from '../types';
import { Activity, Zap, Bot } from 'lucide-react';

export default function CouncilOverview() {
  const { councilUser } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [configAgent, setConfigAgent] = useState<Agent | null>(null);
  const [testAgent, setTestAgent] = useState<Agent | null>(null);
  const [todayRuns, setTodayRuns] = useState(0);

  const fetchAgents = async () => {
    const { data } = await supabase.from('council_agents').select('*').order('created_at');
    setAgents((data as Agent[]) || []);
    setLoading(false);
  };

  const fetchTodayRuns = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('council_agent_runs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    setTodayRuns(count || 0);
  };

  useEffect(() => {
    fetchAgents();
    fetchTodayRuns();

    // Real-time subscription
    const channel = supabase
      .channel('council-agents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'council_agents' }, () => fetchAgents())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'council_agent_runs' }, () => {
        fetchAgents();
        fetchTodayRuns();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const enabledCount = agents.filter(a => a.is_enabled).length;

  return (
    <div>
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Council</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your 6 AI agents from one place</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${councilUser?.role === 'super_admin' ? 'bg-maroon-700 text-white' : 'bg-blue-600 text-white'}`}>
            {councilUser?.role === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'}
          </span>
          <span className="text-sm text-gray-500">{councilUser?.full_name}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
            <Bot size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{enabledCount}/{agents.length}</p>
            <p className="text-xs text-gray-500">Agents Active</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Zap size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{todayRuns}</p>
            <p className="text-xs text-gray-500">Runs Today</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
            <Activity size={20} className="text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {agents.reduce((s, a) => s + a.run_count, 0)}
            </p>
            <p className="text-xs text-gray-500">Total Runs</p>
          </div>
        </div>
      </div>

      {/* Agent grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-maroon-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onConfigure={setConfigAgent}
              onTestRun={setTestAgent}
            />
          ))}
        </div>
      )}

      {/* Drawers / Modals */}
      {configAgent && (
        <ConfigDrawer
          agent={configAgent}
          onClose={() => setConfigAgent(null)}
          onUpdated={() => { fetchAgents(); }}
        />
      )}
      {testAgent && (
        <TestRunModal agent={testAgent} onClose={() => setTestAgent(null)} />
      )}
    </div>
  );
}
