import type { EasterEgg } from "@/lib/easter-eggs";

export function EasterEggPanel({ egg }: { egg: EasterEgg }) {
  return (
    <div className={egg.theme ? `easter-egg easter-egg--${egg.theme}` : "easter-egg"}>
      <p className="easter-egg-kicker">{egg.kicker}</p>
      <h2 className="easter-egg-title">{egg.title}</h2>
      <p className="easter-egg-lead">{egg.lead}</p>
      <ol className="easter-egg-steps">
        {egg.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="easter-egg-meta">
        {egg.meta.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <p className="easter-egg-foot">{egg.foot}</p>
    </div>
  );
}
