import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import { promises as fsp } from "node:fs";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export type CompressVideoResult = {
  originalBytes: number;
  compressedBytes: number;
  skipped: boolean;
};

export type CompressVideoOptions = {
  /** Hard timeout for the compression run, in milliseconds. Default 10 min. */
  timeoutMs?: number;
};

/** Bits per (pixel × frame) threshold above which a re-encode is worth doing. */
const BITRATE_PER_MEGAPIXEL_THRESHOLD = 2_000_000; // ~2 Mbps per megapixel

type ProbeData = {
  width: number;
  height: number;
  durationSec: number;
  videoCodec: string;
  audioCodec: string | null;
  bitRate: number; // overall stream bitrate in bits/sec
};

function ffprobe(inputPath: string): Promise<ProbeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const videoStream = data.streams.find((s) => s.codec_type === "video");
      const audioStream = data.streams.find((s) => s.codec_type === "audio");
      if (!videoStream) {
        reject(new Error("No video stream found"));
        return;
      }
      resolve({
        width: Number(videoStream.width ?? 0),
        height: Number(videoStream.height ?? 0),
        durationSec: Number(data.format.duration ?? 0),
        videoCodec: String(videoStream.codec_name ?? "").toLowerCase(),
        audioCodec: audioStream
          ? String(audioStream.codec_name ?? "").toLowerCase()
          : null,
        bitRate: Number(data.format.bit_rate ?? 0),
      });
    });
  });
}

async function safeStatSize(path: string): Promise<number> {
  try {
    const stat = await fsp.stat(path);
    return stat.size;
  } catch {
    return 0;
  }
}

/**
 * Visually-equivalent video re-encode.
 *
 * Uses H.264 + AAC in MP4 with `+faststart` so the file is web-streamable.
 * Resolution and frame rate are preserved (no `-vf scale` or `-r` flag).
 *
 * - Probes the input first; if it's already H.264 + AAC at a low-enough bitrate
 *   the source is kept and `skipped: true` is returned.
 * - If the re-encoded output is not actually smaller than the source, the
 *   source is kept and `skipped: true` is returned.
 * - On timeout the ffmpeg process is killed and an error is thrown so the
 *   caller can fall back to the original.
 */
export async function compressVideo(
  inputPath: string,
  outputPath: string,
  options: CompressVideoOptions = {},
): Promise<CompressVideoResult> {
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;

  const originalBytes = await safeStatSize(inputPath);
  if (originalBytes === 0) {
    throw new Error("Input video is empty or missing");
  }

  // Probe to decide if compression is worth it.
  let probe: ProbeData | null = null;
  try {
    probe = await ffprobe(inputPath);
  } catch {
    probe = null;
  }

  if (probe && probe.width > 0 && probe.height > 0) {
    const megapixels = (probe.width * probe.height) / 1_000_000;
    const bitratePerMP = megapixels > 0 ? probe.bitRate / megapixels : 0;
    const alreadyH264 = probe.videoCodec === "h264" || probe.videoCodec === "avc1";
    const alreadyAac =
      probe.audioCodec === null || probe.audioCodec === "aac";
    if (
      alreadyH264 &&
      alreadyAac &&
      probe.bitRate > 0 &&
      bitratePerMP <= BITRATE_PER_MEGAPIXEL_THRESHOLD
    ) {
      return {
        originalBytes,
        compressedBytes: originalBytes,
        skipped: true,
      };
    }
  }

  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .outputOptions([
        "-c:v libx264",
        "-preset slow",
        "-crf 20",
        "-pix_fmt yuv420p",
        "-c:a aac",
        "-b:a 160k",
        "-movflags +faststart",
      ])
      .format("mp4")
      .output(outputPath);

    const timer = setTimeout(() => {
      try {
        command.kill("SIGKILL");
      } catch {
        // ignore
      }
      reject(new Error(`Video compression timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    command.on("end", () => {
      clearTimeout(timer);
      resolve();
    });
    command.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    command.run();
  });

  const compressedBytes = await safeStatSize(outputPath);
  if (compressedBytes === 0 || compressedBytes >= originalBytes) {
    // No savings — caller should fall back to the source.
    return {
      originalBytes,
      compressedBytes: originalBytes,
      skipped: true,
    };
  }

  return {
    originalBytes,
    compressedBytes,
    skipped: false,
  };
}
