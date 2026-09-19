import type { AdminTopTargetWire, AdminVoteWire } from '../infrastructure/vote-admin-api';
import type { AdminTopTargetItem, AdminVoteListItem } from '../domain/vote-admin';

/** Wire snake_case → domain camelCase. Wire tidak punya field sensitive. */
export function normalizeAdminVoteListItem(wire: AdminVoteWire): AdminVoteListItem {
  return {
    id: wire.id,
    voterId: wire.voter_id,
    voterUsername: wire.voter_username,
    voterEmail: wire.voter_email,
    targetType: wire.target_type,
    targetId: wire.target_id,
    value: wire.value,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

export function normalizeAdminTopTarget(wire: AdminTopTargetWire): AdminTopTargetItem {
  return {
    targetType: wire.target_type,
    targetId: wire.target_id,
    upvotes: wire.upvotes,
    downvotes: wire.downvotes,
    net: wire.net,
  };
}
