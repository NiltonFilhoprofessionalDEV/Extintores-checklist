export default function BrandLogo({ size = 80 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shield */}
      <path
        d="M40 6L12 18v22c0 14.4 11.6 27.8 28 32 16.4-4.2 28-17.6 28-32V18L40 6z"
        fill="white"
        fillOpacity="0.15"
        stroke="white"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Fire extinguisher body */}
      <rect x="33" y="22" width="10" height="22" rx="5" fill="white" />
      {/* Nozzle */}
      <path d="M43 30h8l2 4h-10" fill="white" />
      {/* Handle */}
      <rect x="31" y="20" width="14" height="3" rx="1.5" fill="white" fillOpacity="0.8" />
      {/* Pin */}
      <circle cx="38" cy="19" r="2" fill="white" fillOpacity="0.6" />
      {/* Checkmark badge */}
      <circle cx="56" cy="58" r="12" fill="#16a34a" />
      <path
        d="M50 58l4 4 8-8"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
