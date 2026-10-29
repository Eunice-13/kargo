import type { NotificationContext, NotificationRoute } from "./notificationRoute";

// Leaf module: the provider, the row, and the detail modal all share this shape,
// so none of them has to import another's main component.
export type NotificationItemData = {
  id: string | number;
  icon: string;
  text: string;
  time: string;
  unread: boolean;
  // Exactly one action per notification: a page, the admin invite popup, or the
  // detail modal. Both the header menu and the Notifications page use this.
  route: NotificationRoute;
  // Short label shown on the row naming where a tap goes ("Open in Claims").
  cue: string;
  context: NotificationContext;
};
