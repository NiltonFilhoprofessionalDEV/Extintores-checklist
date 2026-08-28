type EstoqueLoadingSkeletonProps = {
  rows?: number;
  variant?: "list" | "cards";
};

export default function EstoqueLoadingSkeleton({ rows = 4, variant = "list" }: EstoqueLoadingSkeletonProps) {
  if (variant === "cards") {
    return (
      <div className="estoque-stats">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="estoque-skeleton__bar estoque-skeleton__bar--lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="estoque-skeleton">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="estoque-skeleton__bar" style={{ width: `${88 - index * 8}%` }} />
      ))}
    </div>
  );
}
