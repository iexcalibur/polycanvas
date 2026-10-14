import Foundation

// MARK: - Entry point

let port: UInt16 = {
  if CommandLine.arguments.count >= 2, let p = UInt16(CommandLine.arguments[1]) {
    return p
  }
  return 9111
}()

NSLog("[transcription-server] Starting on port %d", port)

// Retain coordinator + server at top level so they outlive any Task.
// Previously they were captured inside a Task and got deallocated when
// the Task completed, tearing down the HTTP listener.
@MainActor
class AppState {
  static let shared = AppState()
  let coordinator = MeetingCoordinator()
  lazy var server: HTTPServer = HTTPServer(coordinator: coordinator, port: port)
}

Task { @MainActor in
  let app = AppState.shared

  do {
    try app.server.start()
    NSLog("[transcription-server] Server ready on http://localhost:%d", port)
  } catch {
    NSLog("[transcription-server] Fatal: could not start HTTP server: %@", error.localizedDescription)
    exit(1)
  }

  NSLog("[transcription-server] Pre-loading models...")
  do {
    try await app.coordinator.loadModels()
    NSLog("[transcription-server] Models ready")
  } catch {
    NSLog("[transcription-server] Model load failed: %@", error.localizedDescription)
    // Server keeps running — /health reports modelsLoaded:false
  }
}

RunLoop.main.run()
