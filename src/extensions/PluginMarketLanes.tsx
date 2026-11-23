import { useEffect, useRef, useState, type ReactElement } from "react";

export function PluginMarketLanes({ paused, cards }: { paused: boolean; cards: ReactElement[] }) {
  const lanes = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = lanes.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The stationary catalog provides keyboard access. Both copies here respond to pointer input.
  return <div className="df-extension-market-lanes" ref={lanes} aria-hidden="true" data-paused={paused || !visible}>
    {[0, 1].map(index => {
      const row = cards.filter((_, cardIndex) => cardIndex % 2 === index);
      return <div className="df-extension-market-lane" key={index}>
        <div className="df-extension-market-track" style={{ animationDuration: `${row.length * 12}s` }}>
          <div className="df-extension-market-sequence">{row}</div>
          <div className="df-extension-market-sequence">{row}</div>
        </div>
      </div>;
    })}
  </div>;
}
