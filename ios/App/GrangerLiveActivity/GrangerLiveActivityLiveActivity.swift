import ActivityKit
import WidgetKit
import SwiftUI

// GrangerActivityAttributes is defined in GrangerActivityAttributes.swift (shared with App target)

// MARK: - Live Activity Widget

struct GrangerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GrangerActivityAttributes.self) { context in
            // Lock Screen / StandBy banner
            lockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded Dynamic Island
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        PulsingDots()
                            .frame(width: 24, height: 24)
                        Text("Granger")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.white)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.status.capitalized)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color(red: 0.204, green: 0.827, blue: 0.6)) // #34d399
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        if let tool = context.state.toolName {
                            Text(friendlyToolName(tool))
                                .font(.system(size: 12))
                                .foregroundColor(.secondary)
                        }
                        ProgressView(value: context.state.progress)
                            .tint(Color(red: 0.204, green: 0.827, blue: 0.6))
                    }
                    .padding(.horizontal, 4)
                }
                DynamicIslandExpandedRegion(.center) {}
            } compactLeading: {
                // Compact left — animated dots
                PulsingDots()
                    .frame(width: 20, height: 20)
            } compactTrailing: {
                // Compact right — status
                Text(shortStatus(context.state.status))
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(Color(red: 0.204, green: 0.827, blue: 0.6))
            } minimal: {
                // Minimal — just the dots
                PulsingDots()
                    .frame(width: 16, height: 16)
            }
        }
    }

    @ViewBuilder
    func lockScreenView(context: ActivityViewContext<GrangerActivityAttributes>) -> some View {
        HStack {
            PulsingDots()
                .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text("Granger")
                    .font(.system(size: 14, weight: .semibold))
                Text(context.state.status == "complete" ? "Response ready" : "Generating response...")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
            }
            Spacer()
            if context.state.status != "complete" {
                ProgressView(value: context.state.progress)
                    .frame(width: 60)
                    .tint(Color(red: 0.204, green: 0.827, blue: 0.6))
            } else {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(Color(red: 0.204, green: 0.827, blue: 0.6))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    func shortStatus(_ status: String) -> String {
        switch status {
        case "generating": return "Gen..."
        case "searching": return "Search"
        case "thinking": return "Think"
        case "complete": return "Done"
        default: return "..."
        }
    }

    func friendlyToolName(_ name: String) -> String {
        switch name {
        case "search_context": return "Searching your knowledge..."
        case "write_code": return "Writing code..."
        case "create_document": return "Creating document..."
        case "web_browse": return "Browsing the web..."
        case "run_project": return "Running project..."
        default: return "Working..."
        }
    }
}

// MARK: - Pulsing Dots Animation (our green NeuralDots)

struct PulsingDots: View {
    @State private var isAnimating = false

    var body: some View {
        GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height)
            let dotSize = size * 0.18
            let center = CGPoint(x: size / 2, y: size / 2)
            let radius = size * 0.32

            ZStack {
                // 6 dots in a circle
                ForEach(0..<6, id: \.self) { i in
                    let angle = Double(i) * (.pi * 2 / 6) + (isAnimating ? .pi * 2 : 0)
                    let x = center.x + CGFloat(cos(angle)) * radius
                    let y = center.y + CGFloat(sin(angle)) * radius

                    Circle()
                        .fill(Color(red: 0.204, green: 0.827, blue: 0.6).opacity(0.6 + Double(i) * 0.06))
                        .frame(width: dotSize, height: dotSize)
                        .position(x: x, y: y)
                        .scaleEffect(isAnimating ? 1.2 : 0.8)
                }

                // Center dot
                Circle()
                    .fill(Color(red: 0.204, green: 0.827, blue: 0.6))
                    .frame(width: dotSize * 1.3, height: dotSize * 1.3)
                    .position(center)
                    .scaleEffect(isAnimating ? 0.9 : 1.1)
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                isAnimating = true
            }
        }
    }
}
