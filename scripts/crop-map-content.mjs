import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

/**
 * Detecta a região do mapa (conteúdo colorido) ignorando margens brancas e rodapé.
 * Pensado para PDFs exportados do Google Maps com faixa de satélite no topo.
 */
export async function detectMapContentBounds(
  inputPath,
  {
    whiteThreshold = 248,
    rowMinDensity = 0.05,
    colMinDensity = 0.05,
    minMapHeight = 200,
  } = {},
) {
  const { data, info } = await sharp(inputPath, { limitInputPixels: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  function isContentPixel(i) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    return r < whiteThreshold || g < whiteThreshold || b < whiteThreshold;
  }

  const rowDensity = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    let count = 0;
    const rowStart = y * width * channels;
    for (let x = 0; x < width; x++) {
      if (isContentPixel(rowStart + x * channels)) count++;
    }
    rowDensity[y] = count / width;
  }

  /** Maior faixa contínua com conteúdo (ignora cabeçalho/rodapé com poucas linhas de texto). */
  const runs = [];
  let runStart = null;
  for (let y = 0; y < height; y++) {
    if (rowDensity[y] >= rowMinDensity) {
      if (runStart === null) runStart = y;
    } else if (runStart !== null) {
      runs.push({ start: runStart, end: y - 1, height: y - runStart });
      runStart = null;
    }
  }
  if (runStart !== null) {
    runs.push({ start: runStart, end: height - 1, height: height - runStart });
  }

  const bestRun = runs.sort((a, b) => b.height - a.height)[0];
  if (!bestRun || bestRun.height < minMapHeight) {
    throw new Error("Não foi possível detectar a área do mapa na imagem.");
  }

  const top = bestRun.start;
  const bottom = bestRun.end;

  const colDensity = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = top; y <= bottom; y++) {
      const i = (y * width + x) * channels;
      if (isContentPixel(i)) count++;
    }
    colDensity[x] = count / (bottom - top + 1);
  }

  let left = 0;
  let right = width - 1;
  for (let x = 0; x < width; x++) {
    if (colDensity[x] >= colMinDensity) {
      left = x;
      break;
    }
  }
  for (let x = width - 1; x >= 0; x--) {
    if (colDensity[x] >= colMinDensity) {
      right = x;
      break;
    }
  }

  const pad = Math.round(Math.min(width, height) * 0.004);
  return {
    left: Math.max(0, left - pad),
    top: Math.max(0, top - pad),
    width: Math.min(width, right - left + 1 + pad * 2),
    height: Math.min(height, bottom - top + 1 + pad * 2),
  };
}

const TARGET_W = 14042;
const TARGET_H = 9934;

async function main() {
  const input =
    process.argv[2] ?? path.join(process.cwd(), "public", "maps", "tps_1.raw.png");
  const output =
    process.argv[3] ?? path.join(process.cwd(), "public", "maps", "tps_1.jpg");

  const bounds = await detectMapContentBounds(input);
  console.log("Recorte detectado:", bounds);

  await sharp(input)
    .extract(bounds)
    .resize(TARGET_W, TARGET_H, { fit: "fill" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(output);

  const meta = await sharp(output).metadata();
  const stat = await fs.stat(output);
  console.log(
    `OK: ${output} (${meta.width}x${meta.height}, ${(stat.size / 1024 / 1024).toFixed(2)} MB)`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
