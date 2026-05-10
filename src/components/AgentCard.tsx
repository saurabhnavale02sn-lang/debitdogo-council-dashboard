import { Bot, Settings2, Play, Circle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Agent } from '../types';
import { getModelDisplay } from '../types';

interface Props {
  agent: Agent;
  onConfigure: (agent: Agent) => void;
  onTestRun: (agent: Agent) => void;
}

export default function AgentCard({ agent, onConfigure, onTestRun }: Props) {
  const model = getModelDisplay(agent.model);
  const lastRun = agent.last_run_at
    ? formatDistanceToNow(new Date(agent.last_run_at), { addSuffix: true })
    : 'Never';

  return (
    <div className="card p-0 overflow-hidden fade-in" style={{ borderLeft: `4px solid ${agent.color}` }}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{agent.icon}</span>
            <div>
              <h3 className="font-semibold text-gray-900 text-[15px]">{agent.display_name}</h3>
              <span className="text-xs font-mono text-gray-400">{agent.department}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Circle
              size={10}
              fill={agent.is_enabled ? '#22c55e' : '#ef4444'}
              stroke="none"
            />
            <span className={`text-xs font-medium ${agent.is_enabled ? 'text-green-600' : 'text-red-500'}`}>
              {agent.is_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        {/* Model badge */}
        <div className="mb-4">
          <span className={`badge ${model.color}`}>{model.label}</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-lg p-3 mb-4">
          <div>
            <p className="text-lg font-bold text-gray-900">{agent.run_count}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Runs</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-700 mt-1">{lastRun}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Last Run</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {agent.last_run_status === 'success' ? <span className="text-green-600">OK</span> :
               agent.last_run_status === 'error' ? <span className="text-red-500">ERR</span> :
               <span className="text-gray-400">--</span>}
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Status</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={() => onConfigure(agent)} className="btn-outline flex-1 flex items-center justify-center gap-1.5 text-sm py-2">
            <Settings2 size={14} /> Configure
          </button>
          <button onClick={() => onTestRun(agent)} className="btn-maroon flex-1 flex items-center justify-center gap-1.5 text-sm py-2">
            <Play size={14} /> Test Run
          </button>
        </div>
      </div>
    </div>
  );
}
