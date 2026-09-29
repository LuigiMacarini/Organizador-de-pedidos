import ExpoModulesCore
import Foundation
import QuartzCore

/**
 Sensor de desempenho do experimento do TCC (ver
 claude/documentacao/metricas-desempenho-tcc.md). Só lê contadores do próprio
 processo; as taxas (CPU %, FPS) são calculadas no JS com a mesma fórmula para
 Android e iOS.
 */
public final class PerfSamplerModule: Module {
  private let frameCounter = FrameCounter()

  public func definition() -> ModuleDefinition {
    Name("PerfSampler")

    Constants([
      "deviceModel": PerfSamplerModule.deviceModel(),
      "cpuCores": ProcessInfo.processInfo.processorCount
    ])

    AsyncFunction("startFrameCounter") {
      self.frameCounter.start()
    }.runOnQueue(.main)

    AsyncFunction("stopFrameCounter") {
      self.frameCounter.stop()
    }.runOnQueue(.main)

    AsyncFunction("readSample") { (includeMemory: Bool) -> [String: Any] in
      return self.readSample(includeMemory: includeMemory)
    }

    OnDestroy {
      let frameCounter = self.frameCounter
      DispatchQueue.main.async {
        frameCounter.stop()
      }
    }
  }

  private func readSample(includeMemory: Bool) -> [String: Any] {
    let monotonicMs = Double(clock_gettime_nsec_np(CLOCK_MONOTONIC)) / 1_000_000
    // Mesmo relógio que o Android usa em Process.getElapsedCpuTime().
    let cpuTimeNs = clock_gettime_nsec_np(CLOCK_PROCESS_CPUTIME_ID)
    let frames = frameCounter.drain()

    var sample: [String: Any] = [
      "monotonicMs": monotonicMs,
      "frameCount": frames.count,
      "maxFrameIntervalMs": frames.maxIntervalMs,
      "thermalState": PerfSamplerModule.thermalState(),
      "powerSave": ProcessInfo.processInfo.isLowPowerModeEnabled
    ]
    // clock_gettime_nsec_np devolve 0 em caso de erro.
    if cpuTimeNs > 0 {
      sample["cpuTimeMs"] = Double(cpuTimeNs) / 1_000_000
    }
    if let refreshRateHz = frames.refreshRateHz {
      sample["refreshRateHz"] = refreshRateHz
    }

    if includeMemory {
      let start = clock_gettime_nsec_np(CLOCK_MONOTONIC)
      if let memory = PerfSamplerModule.readMemory() {
        sample["memory"] = memory
      }
      sample["memoryReadMs"] = Double(clock_gettime_nsec_np(CLOCK_MONOTONIC) - start) / 1_000_000
    }
    return sample
  }

  /// phys_footprint é o "memory footprint" que o Xcode mostra; também RSS e o pico registrado pelo kernel. Valores em bytes.
  private static func readMemory() -> [String: Any]? {
    var info = task_vm_info_data_t()
    var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size)
    let result = withUnsafeMutablePointer(to: &info) { infoPointer in
      infoPointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { rawPointer in
        task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), rawPointer, &count)
      }
    }
    guard result == KERN_SUCCESS else {
      return nil
    }

    var memory: [String: Any] = [
      "footprint": Double(info.phys_footprint),
      "rss": Double(info.resident_size)
    ]
    if info.ledger_phys_footprint_peak > 0 {
      memory["footprint_peak"] = Double(info.ledger_phys_footprint_peak)
    }
    return memory
  }

  private static func thermalState() -> String {
    switch ProcessInfo.processInfo.thermalState {
    case .nominal:
      return "nominal"
    case .fair:
      return "fair"
    case .serious:
      return "serious"
    case .critical:
      return "critical"
    @unknown default:
      return "unknown"
    }
  }

  /// Identificador do hardware, ex.: "iPhone17,3" para o iPhone 16.
  private static func deviceModel() -> String {
    var systemInfo = utsname()
    uname(&systemInfo)
    let mirror = Mirror(reflecting: systemInfo.machine)
    return mirror.children.reduce("") { identifier, element in
      guard let value = element.value as? Int8, value != 0 else {
        return identifier
      }
      return identifier + String(UnicodeScalar(UInt8(value)))
    }
  }
}

/**
 Conta os callbacks de quadro da thread principal via CADisplayLink, o mesmo
 mecanismo do monitor de FPS do React Native (RCTPerfMonitor).
 */
private final class FrameCounter: NSObject {
  private let lock = NSLock()

  // Só usados na thread principal.
  private var displayLink: CADisplayLink?
  private var lastTimestamp: CFTimeInterval = 0

  // Escritos na thread principal e zerados a cada leitura, por isso protegidos por `lock`.
  private var frameCount = 0
  private var maxInterval: CFTimeInterval = 0
  private var refreshRateHz: Double?

  func start() {
    guard displayLink == nil else {
      return
    }
    lastTimestamp = 0
    lock.lock()
    frameCount = 0
    maxInterval = 0
    lock.unlock()

    let link = CADisplayLink(target: self, selector: #selector(onFrame(_:)))
    link.add(to: .main, forMode: .common)
    displayLink = link
  }

  func stop() {
    displayLink?.invalidate()
    displayLink = nil
  }

  @objc private func onFrame(_ link: CADisplayLink) {
    lock.lock()
    frameCount += 1
    if lastTimestamp > 0 {
      maxInterval = max(maxInterval, link.timestamp - lastTimestamp)
    }
    let frameDuration = link.targetTimestamp - link.timestamp
    if frameDuration > 0 {
      refreshRateHz = 1 / frameDuration
    }
    lock.unlock()
    lastTimestamp = link.timestamp
  }

  func drain() -> (count: Int, maxIntervalMs: Double, refreshRateHz: Double?) {
    lock.lock()
    defer { lock.unlock() }
    let frames = (count: frameCount, maxIntervalMs: maxInterval * 1000, refreshRateHz: refreshRateHz)
    frameCount = 0
    maxInterval = 0
    return frames
  }
}
