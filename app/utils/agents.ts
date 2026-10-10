export type AgentClientId = 'claude-code' | 'cursor' | 'vscode' | 'codex' | 'other'

// Official marks from Iconify's `logos` set, served from public/brand/agents.
export const agentClients: { id: AgentClientId; label: string; logo?: string }[] = [
  { id: 'claude-code', label: 'Claude Code', logo: '/brand/agents/claude-code.svg' },
  { id: 'cursor', label: 'Cursor', logo: '/brand/agents/cursor.svg' },
  { id: 'vscode', label: 'VS Code', logo: '/brand/agents/vscode.svg' },
  { id: 'codex', label: 'Codex', logo: '/brand/agents/codex.svg' },
  { id: 'other', label: 'Other' },
]
