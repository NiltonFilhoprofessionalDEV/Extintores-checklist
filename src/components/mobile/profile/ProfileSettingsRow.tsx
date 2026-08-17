import type { ReactNode } from "react";
import Link from "next/link";

type ProfileSettingsRowProps = {
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  value?: string;
  destructive?: boolean;
};

export default function ProfileSettingsRow({
  href,
  onClick,
  icon,
  label,
  value,
  destructive = false,
}: ProfileSettingsRowProps) {
  const className = `profile-row${destructive ? " profile-row--danger" : ""}`;
  const content = (
    <>
      <span className="profile-row__icon">{icon}</span>
      <span className="profile-row__label">{label}</span>
      {value ? <span className="profile-row__value">{value}</span> : null}
      {!destructive ? (
        <svg className="profile-row__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
