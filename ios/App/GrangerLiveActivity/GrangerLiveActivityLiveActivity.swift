//
//  GrangerLiveActivityLiveActivity.swift
//  GrangerLiveActivity
//
//  Created by Alfonso Morales on 4/3/26.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct GrangerLiveActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct GrangerLiveActivityLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GrangerLiveActivityAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                    // more content
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension GrangerLiveActivityAttributes {
    fileprivate static var preview: GrangerLiveActivityAttributes {
        GrangerLiveActivityAttributes(name: "World")
    }
}

extension GrangerLiveActivityAttributes.ContentState {
    fileprivate static var smiley: GrangerLiveActivityAttributes.ContentState {
        GrangerLiveActivityAttributes.ContentState(emoji: "😀")
     }
     
     fileprivate static var starEyes: GrangerLiveActivityAttributes.ContentState {
         GrangerLiveActivityAttributes.ContentState(emoji: "🤩")
     }
}

#Preview("Notification", as: .content, using: GrangerLiveActivityAttributes.preview) {
   GrangerLiveActivityLiveActivity()
} contentStates: {
    GrangerLiveActivityAttributes.ContentState.smiley
    GrangerLiveActivityAttributes.ContentState.starEyes
}
