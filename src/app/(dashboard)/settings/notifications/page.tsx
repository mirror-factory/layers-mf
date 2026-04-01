import { NotificationSettings } from "@/components/notification-settings";
import { PageExplainer } from "@/components/page-explainer";

export default function NotificationSettingsPage() {
  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Notifications</h1>
        <p className="text-muted-foreground text-sm">
          Control how and when you receive email notifications.
        </p>
      </div>
      <PageExplainer
        title="How Notifications Work"
        sections={[
          { title: "Email Digest", content: "Receive a summary of activity at your chosen frequency -- daily, weekly, or only on important events." },
          { title: "Frequency", content: "Set how often you get notified. Real-time alerts are available for approvals and high-priority items." },
          { title: "Filtering", content: "Mute specific event types or sources so you only see notifications that matter to you." },
        ]}
      />
      <NotificationSettings />
    </div>
  );
}
