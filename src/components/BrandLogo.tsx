import Image from "next/image";
import logoFirecheck from "../../public/logo-firecheck.png";

const LOGO_ASPECT = logoFirecheck.width / logoFirecheck.height;

type BrandLogoProps = {
  /** Altura em px; a largura segue a proporção da arte. */
  height?: number;
  /** @deprecated Use `height`. */
  size?: number;
  className?: string;
  /** Quando true, renderiza ocupando toda a largura disponível. */
  fluid?: boolean;
  priority?: boolean;
};

export default function BrandLogo({
  height,
  size,
  className = "",
  fluid = false,
  priority = false,
}: BrandLogoProps) {
  const h = height ?? size ?? 40;
  const w = Math.round(h * LOGO_ASPECT);

  return (
    <Image
      src={logoFirecheck}
      alt="FireCheck"
      width={w}
      height={h}
      priority={priority}
      className={`object-contain object-left ${className}`}
      style={{ height: fluid ? "auto" : h, width: fluid ? "100%" : w, maxWidth: "100%" }}
    />
  );
}
