import Foundation
import Network

/// Minimal HTTP server using Apple's Network framework.
/// Handles JSON request/response for meeting transcription endpoints.
class HTTPServer {
  private var listener: NWListener?
  private let coordinator: MeetingCoordinator
  private let port: UInt16
  private let queue = DispatchQueue(label: "transcription-server.http", qos: .userInitiated)

  init(coordinator: MeetingCoordinator, port: UInt16) {
    self.coordinator = coordinator
    self.port = port
  }

  func start() throws {
    let params = NWParameters.tcp
    params.allowLocalEndpointReuse = true
    listener = try NWListener(using: params, on: NWEndpoint.Port(rawValue: port)!)

    listener?.newConnectionHandler = { [weak self] connection in
      self?.handleConnection(connection)
    }

    listener?.stateUpdateHandler = { state in
      NSLog("[HTTPServer] Listener state: %@", String(describing: state))
    }

    listener?.start(queue: queue)
    NSLog("[HTTPServer] Listening on port %d", port)
  }

  // MARK: - Connection handling

  /// Endpoints that get polled every 1-2s by the renderer. Logging
  /// each `New connection` / `Connection ready` / `GET ...` line for
  /// these triples the line count of every meeting log without
  /// adding any signal — silence them at the source.
  private static let noisyPaths: Set<String> = [
    "/meeting/status",
    "/health",
  ]

  private func handleConnection(_ connection: NWConnection) {
    connection.stateUpdateHandler = { [weak self] state in
      switch state {
      case .ready:
        self?.receiveRequest(connection, accumulated: Data())
      case .failed(let err):
        NSLog("[HTTPServer] Connection failed: %@", err.localizedDescription)
        connection.cancel()
      case .cancelled:
        break
      default:
        break
      }
    }

    connection.start(queue: queue)
  }

  private func receiveRequest(_ connection: NWConnection, accumulated: Data) {
    connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) {
      [weak self] data, _, isComplete, error in
      guard let self else { return }

      if let error = error {
        NSLog("[HTTPServer] Receive error: %@", error.localizedDescription)
        connection.cancel()
        return
      }

      var buffer = accumulated
      if let data = data {
        buffer.append(data)
      }

      // Check if we have a complete HTTP request (ends with \r\n\r\n for headers).
      // For this server, we don't accept POST bodies larger than what fits in
      // the initial buffer, so we treat header-end as request-complete.
      let requestStr = String(data: buffer, encoding: .utf8) ?? ""
      let hasHeaderEnd = requestStr.contains("\r\n\r\n")

      if hasHeaderEnd || isComplete {
        let (method, path, body) = self.parseHTTP(requestStr)
        // Skip logs for endpoints the renderer polls (status / health) —
        // those don't carry meaningful signal and bury everything else.
        if !Self.noisyPaths.contains(path) {
          NSLog("[HTTPServer] %@ %@", method, path)
        }

        // Route in a Task so we can await the coordinator
        Task {
          let response = await self.route(method: method, path: path, body: body)
          self.sendResponse(connection, response: response)
        }
      } else {
        // Keep reading
        self.receiveRequest(connection, accumulated: buffer)
      }
    }
  }

  // MARK: - Routing

  private func route(method: String, path: String, body: String) async -> (Int, Data) {
    do {
      switch (method, path) {

      case ("GET", "/health"):
        // Read state directly from the lock-protected store — no MainActor
        // needed, so this works even during CoreML compilation.
        let s = coordinator.modelState.read()
        return jsonResponse(200, HealthResponse(
          status: "ok",
          // Phase-8f: gate is three models —
          //   - Live draft (liveLoaded — Parakeet-TDT)
          //   - DTLN-aec (aecLoaded) — dual-track echo cancellation
          //   - Cohere Transcribe 2B (cohereLoaded) — post-stop engine
          //
          // VAD (smallLoaded) and diariser (diarLoaded) were both
          // Whisper-era pre-passes and have been removed entirely.
          // Cohere does its own framing; its single-segment output
          // gave diarisation nothing to attach to.
          modelsLoaded: s.liveLoaded && s.aecLoaded && s.cohereLoaded,
          liveLoaded: s.liveLoaded,
          liveProgress: s.liveProgress,
          aecLoaded: s.aecLoaded,
          aecProgress: s.aecProgress,
          cohereLoaded: s.cohereLoaded,
          cohereProgress: s.cohereProgress,
          currentlyDownloading: s.currentlyDownloading
        ))

      case ("POST", "/meeting/start"):
        // Phase-7.6 transitional handler. Two contracts coexist:
        //
        //  - Legacy (pre-7.6 Electron): empty body or missing
        //    `audioPath`. Swift starts captures + live pipeline
        //    but skips the disk writer. Rust is still the
        //    canonical .m4a recorder.
        //  - Phase-7.6 (new Electron): `audioPath` (and
        //    optionally `systemAudioPath`) in body. Swift owns
        //    everything — capture, pipeline, AND disk writes.
        //
        // The legacy branch will be removed once Electron
        // migrates and the Rust audio capture path is retired.
        let startReq: StartRequest? = {
          if body.isEmpty { return nil }
          return try? JSONDecoder().decode(
            StartRequest.self,
            from: Data(body.utf8)
          )
        }()
        if let micPath = startReq?.audioPath, !micPath.isEmpty {
          try await coordinator.startMeeting(
            audioPath: micPath,
            systemAudioPath: startReq?.systemAudioPath
          )
          return jsonResponse(200, StartResponse(
            success: true,
            audioPath: micPath,
            systemAudioPath: startReq?.systemAudioPath
          ))
        } else {
          try await coordinator.startMeetingLegacyNoCapture()
          return jsonResponse(200, StartResponse(
            success: true,
            audioPath: "",
            systemAudioPath: nil
          ))
        }

      case ("GET", "/meeting/status"):
        let status = await coordinator.getStatus()
        return jsonResponse(200, status)

      case ("POST", "/meeting/stop"):
        // Phase-7.6: body is empty — Swift already knows the paths
        // it's writing to from /meeting/start. The stop response
        // returns the paths back so the caller can hand them to
        // the post-stop file pass.
        _ = body
        let result = try await coordinator.stopMeeting()
        return jsonResponse(200, result)

      case ("POST", "/meeting/transcribe-file"):
        // User-triggered full-file transcription. Whisper-large-v3
        // runs end-to-end on the recorded `.m4a`(s) and this
        // endpoint blocks until every second of audio has been
        // transcribed.
        //
        // - Single-track: only `audioPath` set in the body. One
        //   pass, segments returned with `speaker: nil`.
        // - Dual-track: `systemAudioPath` also set. Two passes
        //   (mic tagged "You", system tagged "Speaker"), merged
        //   chronologically by start time before return.
        let transReq = try JSONDecoder().decode(
          TranscribeFileRequest.self,
          from: Data(body.utf8)
        )
        // Phase-8r: `engine` field is ignored — post-stop is now
        // Cohere-only. Old clients passing "parakeet" / "whisper"
        // still get a Cohere transcript (no error). Parakeet is
        // reserved for live streaming during the meeting.
        if let requestedEngine = transReq.engine,
           requestedEngine != "cohere" {
          NSLog(
            "[HTTPServer] /meeting/transcribe-file: engine=%@ ignored (post-stop is Cohere-only since Phase-8r)",
            requestedEngine
          )
        }
        let segments = await coordinator.transcribeFile(
          audioPath: transReq.audioPath,
          systemAudioPath: transReq.systemAudioPath,
          // Diarisation is a no-op since Phase-8d/e (Cohere produces
          // a single segment); kept on the request shape for back-compat.
          diarise: transReq.diarise ?? true,
          // Phase-6 cleanup chain — opt-in via settings.
          removeFillers: transReq.removeFillers ?? false,
          customVocabulary: transReq.customVocabulary ?? [],
          // Phase-6.5: AEC defaults ON. Fires for dual-track only
          // (systemAudioPath set). Client passes false to disable.
          applyAec: transReq.applyAec ?? true
        )
        let title = segments
          .map { $0.text }
          .joined(separator: " ")
          .prefix(80)
        return jsonResponse(200, TranscribeFileResponse(
          success: true,
          title: title.isEmpty ? "Meeting Transcript" : String(title),
          segments: segments
        ))

      case ("POST", "/meeting/cancel"):
        await coordinator.cancelMeeting()
        // Cancel doesn't have meaningful paths to return — the
        // recording was discarded — so we send back the same
        // StartResponse shape with empty paths.
        return jsonResponse(200, StartResponse(
          success: true,
          audioPath: "",
          systemAudioPath: nil
        ))

      default:
        return jsonResponse(404, ErrorResponse(error: "Not found: \(method) \(path)"))
      }
    } catch {
      NSLog("[HTTPServer] Error handling %@ %@: %@", method, path, error.localizedDescription)
      return jsonResponse(500, ErrorResponse(error: error.localizedDescription))
    }
  }

  // MARK: - HTTP parsing (minimal)

  private func parseHTTP(_ raw: String) -> (method: String, path: String, body: String) {
    let lines = raw.components(separatedBy: "\r\n")
    guard let requestLine = lines.first else { return ("GET", "/", "") }

    let parts = requestLine.split(separator: " ")
    let method = parts.count > 0 ? String(parts[0]) : "GET"
    let path = parts.count > 1 ? String(parts[1]) : "/"

    if let blankIdx = lines.firstIndex(of: "") {
      let body = lines.dropFirst(blankIdx + 1).joined(separator: "\r\n")
      return (method, path, body)
    }
    return (method, path, "")
  }

  // MARK: - Response helpers

  private func jsonResponse<T: Encodable>(_ status: Int, _ body: T) -> (Int, Data) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = .sortedKeys
    let data = (try? encoder.encode(body)) ?? Data()
    return (status, data)
  }

  private func sendResponse(_ connection: NWConnection, response: (Int, Data)) {
    let (status, body) = response
    let statusText = status == 200 ? "OK" : status == 404 ? "Not Found" : "Error"
    let header = "HTTP/1.1 \(status) \(statusText)\r\nContent-Type: application/json\r\nContent-Length: \(body.count)\r\nConnection: close\r\n\r\n"

    var fullResponse = Data(header.utf8)
    fullResponse.append(body)

    connection.send(content: fullResponse, completion: .contentProcessed { err in
      if let err = err {
        NSLog("[HTTPServer] Send error: %@", err.localizedDescription)
      }
      connection.cancel()
    })
  }
}
