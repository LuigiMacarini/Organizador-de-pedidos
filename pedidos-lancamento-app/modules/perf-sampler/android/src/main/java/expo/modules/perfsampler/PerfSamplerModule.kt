package expo.modules.perfsampler

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.os.Debug
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.Process
import android.os.SystemClock
import android.system.Os
import android.system.OsConstants
import android.view.Choreographer
import android.view.Display
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Sensor de desempenho do experimento do TCC (ver
 * claude/documentacao/metricas-desempenho-tcc.md). Só lê contadores do próprio
 * processo; as taxas (CPU %, FPS) são calculadas no JS com a mesma fórmula para
 * Android e iOS.
 */
class PerfSamplerModule : Module() {
  private val frameCounter = FrameCounter()

  override fun definition() = ModuleDefinition {
    Name("PerfSampler")

    Constants(
      "deviceModel" to Build.MODEL,
      "cpuCores" to Runtime.getRuntime().availableProcessors()
    )

    AsyncFunction<Unit>("startFrameCounter") {
      frameCounter.start()
    }

    AsyncFunction<Unit>("stopFrameCounter") {
      frameCounter.stop()
    }

    AsyncFunction("readSample") { includeMemory: Boolean ->
      readSample(includeMemory)
    }

    OnDestroy {
      frameCounter.stop()
    }
  }

  private fun readSample(includeMemory: Boolean): Map<String, Any?> {
    val monotonicMs = SystemClock.elapsedRealtimeNanos() / 1_000_000.0
    // O AOSP implementa getElapsedCpuTime() com clock_gettime(CLOCK_PROCESS_CPUTIME_ID),
    // o mesmo relógio usado no iOS.
    val cpuTimeMs = Process.getElapsedCpuTime().toDouble()
    val frames = frameCounter.drain()

    val sample = mutableMapOf<String, Any?>(
      "monotonicMs" to monotonicMs,
      "cpuTimeMs" to cpuTimeMs,
      "frameCount" to frames.count,
      "maxFrameIntervalMs" to frames.maxIntervalMs,
      "refreshRateHz" to refreshRateHz(),
      "thermalState" to thermalState(),
      "powerSave" to powerManager()?.isPowerSaveMode
    )

    if (includeMemory) {
      val start = SystemClock.elapsedRealtimeNanos()
      sample["memory"] = readMemory()
      // Ler o smaps custa CPU do próprio processo; registrar a duração deixa esse custo mensurável.
      sample["memoryReadMs"] = (SystemClock.elapsedRealtimeNanos() - start) / 1_000_000.0
    }
    return sample
  }

  /** PSS (métrica oficial do Android) com a mesma divisão do Memory Profiler, mais RSS. Valores em bytes. */
  private fun readMemory(): Map<String, Double?> {
    val info = Debug.MemoryInfo()
    Debug.getMemoryInfo(info)
    return mapOf(
      "pss" to info.totalPss * 1024.0,
      "java_heap" to statBytes(info, "summary.java-heap"),
      "native_heap" to statBytes(info, "summary.native-heap"),
      "graphics" to statBytes(info, "summary.graphics"),
      "rss" to residentBytes()
    )
  }

  private fun statBytes(info: Debug.MemoryInfo, name: String): Double? =
    info.getMemoryStat(name)?.toDoubleOrNull()?.times(1024.0)

  /** Segundo campo de /proc/self/statm: páginas residentes do processo. */
  private fun residentBytes(): Double? =
    try {
      val fields = File("/proc/self/statm").readText().trim().split(Regex("\\s+"))
      fields[1].toDouble() * Os.sysconf(OsConstants._SC_PAGESIZE)
    } catch (e: Exception) {
      null
    }

  private fun refreshRateHz(): Double? {
    val displayManager = appContext.reactContext?.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager
    return displayManager?.getDisplay(Display.DEFAULT_DISPLAY)?.refreshRate?.toDouble()
  }

  private fun powerManager(): PowerManager? =
    appContext.reactContext?.getSystemService(Context.POWER_SERVICE) as? PowerManager

  private fun thermalState(): String? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return null
    }
    return when (powerManager()?.currentThermalStatus) {
      null -> null
      PowerManager.THERMAL_STATUS_NONE -> "none"
      PowerManager.THERMAL_STATUS_LIGHT -> "light"
      PowerManager.THERMAL_STATUS_MODERATE -> "moderate"
      PowerManager.THERMAL_STATUS_SEVERE -> "severe"
      PowerManager.THERMAL_STATUS_CRITICAL -> "critical"
      PowerManager.THERMAL_STATUS_EMERGENCY -> "emergency"
      PowerManager.THERMAL_STATUS_SHUTDOWN -> "shutdown"
      else -> "unknown"
    }
  }
}

/**
 * Conta os callbacks de quadro da thread principal via Choreographer, o mesmo
 * mecanismo do monitor de FPS do React Native (FpsDebugFrameCallback).
 */
private class FrameCounter : Choreographer.FrameCallback {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val lock = Any()

  // Só usados na thread principal.
  private var running = false
  private var lastFrameTimeNanos = 0L

  // Escritos na thread principal e zerados a cada leitura, por isso protegidos por `lock`.
  private var frameCount = 0
  private var maxIntervalNanos = 0L

  fun start() {
    mainHandler.post {
      if (running) return@post
      running = true
      lastFrameTimeNanos = 0L
      synchronized(lock) {
        frameCount = 0
        maxIntervalNanos = 0L
      }
      Choreographer.getInstance().postFrameCallback(this)
    }
  }

  fun stop() {
    mainHandler.post {
      if (!running) return@post
      running = false
      Choreographer.getInstance().removeFrameCallback(this)
    }
  }

  override fun doFrame(frameTimeNanos: Long) {
    if (!running) return
    synchronized(lock) {
      frameCount++
      if (lastFrameTimeNanos != 0L) {
        maxIntervalNanos = maxOf(maxIntervalNanos, frameTimeNanos - lastFrameTimeNanos)
      }
    }
    lastFrameTimeNanos = frameTimeNanos
    Choreographer.getInstance().postFrameCallback(this)
  }

  fun drain(): Frames =
    synchronized(lock) {
      val frames = Frames(frameCount, maxIntervalNanos / 1_000_000.0)
      frameCount = 0
      maxIntervalNanos = 0L
      frames
    }
}

private data class Frames(val count: Int, val maxIntervalMs: Double)
