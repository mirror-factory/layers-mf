import ActivityKit
import Foundation

/// Shared Activity Attributes — used by both the App and the Widget Extension.
/// Add this file to BOTH targets in Xcode (App + GrangerLiveActivity).
struct GrangerActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var status: String      // "generating", "searching", "thinking", "complete"
        var toolName: String?   // e.g. "search_context", "write_code"
        var progress: Double    // 0.0 to 1.0
        var tokenCount: Int
    }

    var conversationId: String
    var modelName: String
}
