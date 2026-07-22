import type { SVGProps } from "react";

interface AnkurMarkProps {
  readonly compact?: boolean;
  readonly inverse?: boolean;
  readonly className?: string;
}

function MarkSvg(props: Readonly<SVGProps<SVGSVGElement>>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path className="ankur-mark-page" d="M7.5 13.5C14.3 13.5 19.8 15.2 24 18.7C28.2 15.2 33.7 13.5 40.5 13.5V36.1C34.2 35.7 28.8 37.2 24 40C19.2 37.2 13.8 35.7 7.5 36.1V13.5Z" />
      <path className="ankur-mark-fold" d="M24 18.7V39.5M11.5 18.1C16.2 18.1 20.1 19.4 24 22M36.5 18.1C31.8 18.1 27.9 19.4 24 22" />
      <path className="ankur-mark-stem" d="M24 22V9.2" />
      <path className="ankur-mark-leaf" d="M23.6 12.1C18.1 12.2 14.6 9.5 14.2 5.1C19.4 4.8 23.1 7.3 23.6 12.1ZM24.4 12.1C29.9 12.2 33.4 9.5 33.8 5.1C28.6 4.8 24.9 7.3 24.4 12.1Z" />
      <circle className="ankur-mark-seed" cx="24" cy="22" r="2.2" />
    </svg>
  );
}

export function AnkurMark({ compact = false, inverse = false, className = "" }: Readonly<AnkurMarkProps>) {
  if (compact) {
    return <span className={`ankur-mark ankur-mark--compact ${inverse ? "ankur-mark--inverse" : ""} ${className}`}><MarkSvg aria-label="Ankur" role="img" /></span>;
  }
  return (
    <span className={`ankur-lockup ${inverse ? "ankur-mark--inverse" : ""} ${className}`}>
      <span className="ankur-mark" aria-hidden="true"><MarkSvg /></span>
      <span className="ankur-wordmark"><strong>Ankur</strong><small>Adaptive learning, grounded in your source</small></span>
    </span>
  );
}
