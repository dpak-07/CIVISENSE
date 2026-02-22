import { useMemo } from "react";

function BootLoader({ text = "Initializing CiviSense..." }) {
  const titleChars = useMemo(() => "CIVISENSE".split(""), []);
  const subtitleChars = useMemo(() => "SMART CIVIC INTELLIGENCE".split(""), []);

  return (
    <div className="boot-loader" role="status" aria-live="polite" aria-label="Loading application">
      <div className="boot-loader__halo" />

      <div className="boot-loader__flower" aria-hidden="true">
        <div className="boot-loader__ring" />

        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index} className="boot-loader__petal" style={{ "--i": index }} />
        ))}

        <div className="boot-loader__core-glow" />
        <div className="boot-loader__core-dot" />
      </div>

      <div className="boot-loader__brand">
        <p className="boot-loader__line boot-loader__line--primary">
          {titleChars.map((char, index) => (
            <span key={`${char}-${index}`} style={{ "--idx": index }}>
              {char}
            </span>
          ))}
        </p>

        <p className="boot-loader__line boot-loader__line--secondary">
          {subtitleChars.map((char, index) => (
            <span key={`${char}-${index}`} style={{ "--idx": index }}>
              {char === " " ? "\u00A0" : char}
            </span>
          ))}
        </p>

        <p className="boot-loader__status">{text}</p>
      </div>
    </div>
  );
}

export default BootLoader;
