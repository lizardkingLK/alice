/**
 * Copy for the Settings → Integrations marketplace disconnect confirm
 * (hard-delete style / rose warning).
 */
export function workspaceIntegrationDisconnectCopy(integrationName: string): {
  title: string;
  subject: string;
  detail: string;
  confirmLabel: string;
  pendingLabel: string;
  actionVerb: string;
} {
  return {
    title: 'Disconnect integration',
    subject: integrationName,
    detail:
      'Warning: This disconnects the integration for the whole workspace. Active configurations (including chat models and stored credentials) are removed. People using this connection lose access until an admin reconnects it.',
    confirmLabel: 'Disconnect',
    pendingLabel: 'Disconnecting…',
    actionVerb: 'disconnect',
  };
}
