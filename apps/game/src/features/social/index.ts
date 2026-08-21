/**
 * The social feature area.
 *
 * Five destinations. `SocialScreen` is the feed the player acts in;
 * `PressConferenceScreen`, `CreatorHubScreen` and `CommunityScreen` are the
 * three surfaces where the actions that shape the feed are taken; `MediaScreen`
 * and `CreatorProfileScreen` are where the consequences are read back.
 *
 * Suggested paths, for whoever wires the router:
 *   /social                       SocialScreen
 *   /social/press                 PressConferenceScreen
 *   /social/creators              CreatorHubScreen
 *   /social/community             CommunityScreen
 *   /social/media                 MediaScreen
 *   /social/creator/:creatorId    CreatorProfileScreen
 */
export { SocialScreen } from './SocialScreen';
export { MediaScreen } from './MediaScreen';
export { CreatorProfileScreen } from './CreatorProfileScreen';
export { PressConferenceScreen } from './PressConferenceScreen';
export { CreatorHubScreen } from './CreatorHubScreen';
export { CommunityScreen } from './CommunityScreen';
