import { NotificationSettings } from "@/components/notification-settings";

export default function NotificationSettingsPage() {
  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Notifications</h1>
        <p className="text-muted-foreground text-sm">
          Control how and when you receive email notifications.
        </p>
      </div>
      <NotificationSettings />
    </div>
  );
}
