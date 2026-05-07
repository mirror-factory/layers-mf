import Foundation
import Capacitor
import ActivityKit

/**
 * Capacitor plugin to start/update/end Dynamic Island Live Activities
 * from the web app's JavaScript layer.
 */
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    /// Start a Live Activity for a chat generation
    @objc func start(_ call: CAPPluginCall) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("Live Activities not available")
            return
        }

        let conversationId = call.getString("conversationId") ?? ""
        let modelName = call.getString("modelName") ?? "AI"

        let attributes = GrangerActivityAttributes(
            conversationId: conversationId,
            modelName: modelName
        )
        let state = GrangerActivityAttributes.ContentState(
            status: "generating",
            toolName: nil,
            progress: 0.0,
            tokenCount: 0
        )

        do {
            let activity = try Activity.request(
                attributes: attributes,
                content: .init(state: state, staleDate: nil),
                pushType: nil
            )
            call.resolve(["activityId": activity.id])
        } catch {
            call.reject("Failed to start: \(error.localizedDescription)")
        }
    }

    /// Update the Live Activity state (status, tool, progress)
    @objc func update(_ call: CAPPluginCall) {
        let status = call.getString("status") ?? "generating"
        let toolName = call.getString("toolName")
        let progress = call.getDouble("progress") ?? 0.0
        let tokenCount = call.getInt("tokenCount") ?? 0

        let state = GrangerActivityAttributes.ContentState(
            status: status,
            toolName: toolName,
            progress: progress,
            tokenCount: tokenCount
        )

        Task {
            for activity in Activity<GrangerActivityAttributes>.activities {
                await activity.update(.init(state: state, staleDate: nil))
            }
            call.resolve()
        }
    }

    /// End the Live Activity (response complete)
    @objc func end(_ call: CAPPluginCall) {
        let finalState = GrangerActivityAttributes.ContentState(
            status: "complete",
            toolName: nil,
            progress: 1.0,
            tokenCount: call.getInt("tokenCount") ?? 0
        )

        Task {
            for activity in Activity<GrangerActivityAttributes>.activities {
                await activity.end(
                    .init(state: finalState, staleDate: nil),
                    dismissalPolicy: .after(.now + 5) // Dismiss after 5s
                )
            }
            call.resolve()
        }
    }
}
