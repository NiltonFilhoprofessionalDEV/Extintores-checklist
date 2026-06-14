import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { pdf } from "pdf-to-img";
import { detectMapContentBounds } from "./crop-map-content.mjs";

const TARGET_W = 14042;
const TARGET_H = 9934;
const TARGET_ASPECT = TARGET_W / TARGET_H;
const REF_DETECT_SCALE = 12;
const MIN_CROP_WIDTH = TARGET_W;
const MAX_SCALE = 30;
const JPEG_QUALITY = 95;
const ASPECT_TOLERANCE = 0.08;

const pdfPath =
  process.argv[2] ??
  "c:\\Users\\cabra\\Downloads\\ppci teca aeroporto incendio 2024 com chancela.pdf";
const baseName = process.argv[3] ?? "teca";
const pageNumber = Number.parseInt(process.argv[4] ?? "1", 10);

const outDir = path.join(process.cwd(), "public", "maps");
const outJpg = path.join(outDir, `${baseName}.jpg`);
const tempPng = path.join(outDir, `${baseName}.raw.png`);

const sharpLarge = (input) =>
  sharp(input, {
    limitInputPixels: false,
  });

async function extractPage(scale) {
  const doc = await pdf(pdfPath, { scale });
  let current = 0;
  for await (const image of doc) {
    current += 1;
    if (current === pageNumber) return image;
  }
  throw new Error(`Página ${pageNumber} não encontrada no PDF.`);
}

function chooseResizeFit(width, height) {
  const aspect = width / height;
  const diff = Math.abs(aspect - TARGET_ASPECT) / TARGET_ASPECT;
  if (diff <= ASPECT_TOLERANCE) {
    return { fit: "fill", note: "proporção compatível — preenche o canvas padrão" };
  }
  return {
    fit: "contain",
    note: "PDF retrato — recorte inteligente do mapa",
  };
}

function scaleBounds(bounds, fromScale, toScale) {
  const factor = toScale / fromScale;
  return {
    left: Math.round(bounds.left * factor),
    top: Math.round(bounds.top * factor),
    width: Math.round(bounds.width * factor),
    height: Math.round(bounds.height * factor),
  };
}

async function run() {
  await fs.mkdir(outDir, { recursive: true });

  const detectBuffer = await extractPage(REF_DETECT_SCALE);
  await fs.writeFile(tempPng, detectBuffer);
  const detectMeta = await sharpLarge(tempPng).metadata();
  console.log(
    `Detecção @ scale ${REF_DETECT_SCALE}: ${detectMeta.width}x${detectMeta.height} px`,
  );

  const { fit, note } = chooseResizeFit(detectMeta.width ?? 0, detectMeta.height ?? 0);
  console.log(`Modo: ${fit} (${note})`);

  let finalScale = REF_DETECT_SCALE;
  let cropBounds = null;

  if (fit === "contain") {
    const refBounds = await detectMapContentBounds(tempPng);
    console.log(`Recorte referência @ scale ${REF_DETECT_SCALE}:`, refBounds);

    finalScale = Math.min(
      MAX_SCALE,
      Math.max(REF_DETECT_SCALE, Math.ceil((REF_DETECT_SCALE * MIN_CROP_WIDTH) / refBounds.width)),
    );
    cropBounds = scaleBounds(refBounds, REF_DETECT_SCALE, finalScale);
    console.log(`Escala final: ${finalScale} (recorte ~${cropBounds.width}x${cropBounds.height} px)`);
  } else {
    finalScale = REF_DETECT_SCALE;
    while (finalScale < MAX_SCALE) {
      const next = finalScale + 1;
      const probe = await extractPage(next);
      const probeMeta = await sharpLarge(probe).metadata();
      if (Math.max(probeMeta.width ?? 0, probeMeta.height ?? 0) < 12000) {
        finalScale = next;
      } else {
        break;
      }
    }
  }

  const buffer = await extractPage(finalScale);
  await fs.writeFile(tempPng, buffer);
  const meta = await sharpLarge(tempPng).metadata();
  console.log(`Render final @ scale ${finalScale}: ${meta.width}x${meta.height} px`);

  const resizeOptions = {
    fit: "fill",
    kernel: sharp.kernel.lanczos3,
  };

  if (fit === "contain" && cropBounds) {
    console.log("Recorte final:", cropBounds);
    await sharpLarge(tempPng)
      .extract(cropBounds)
      .resize(TARGET_W, TARGET_H, resizeOptions)
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toFile(outJpg);
  } else {
    await sharpLarge(tempPng)
      .resize(TARGET_W, TARGET_H, resizeOptions)
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toFile(outJpg);
  }

  await fs.unlink(tempPng);

  const outMeta = await sharp(outJpg).metadata();
  const stat = await fs.stat(outJpg);
  console.log(
    `OK: ${outJpg} (${outMeta.width}x${outMeta.height}, ${(stat.size / 1024 / 1024).toFixed(2)} MB)`,
  );
}

run().catch((error) => {
  console.error("Falha na extração do PDF:", error);
  process.exit(1);
});
