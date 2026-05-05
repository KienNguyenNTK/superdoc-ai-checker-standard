import { vi } from "../../i18n";
import type { AgentOption } from "../../types";

type Props = {
  agents: AgentOption[];
  currentAgentId: string;
  disabled?: boolean;
  layout?: "inline" | "stack";
  onAgentChange: (agentId: string) => void;
  onRunAgent: () => void;
};

export function AgentsDropdown({
  agents,
  currentAgentId,
  disabled,
  layout = "inline",
  onAgentChange,
  onRunAgent,
}: Props) {
  return (
    <div className={`agentsDock ${layout === "stack" ? "agentsDock--stack" : ""}`}>
      <select
        className="topSelect agentsSelect"
        value={currentAgentId}
        onChange={(event) => onAgentChange(event.target.value)}
        disabled={disabled}
      >
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
      <button type="button" className="ghostBtn agentsRunBtn" onClick={onRunAgent} disabled={disabled}>
        {vi.agents.runAgent}
      </button>
    </div>
  );
}
