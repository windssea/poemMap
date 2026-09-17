import { useEffect, useRef, useState } from "react";

/**
 * 数字滚动：只在**首次挂载**时从 0 滚到目标值（与旧版开场一致），
 * 之后筛选变化直接显示真值，免得每次筛选都重滚一遍。
 */
export function useCountUp(target, animate) {
  const [value, setValue] = useState(animate ? 0 : target);
  const introDone = useRef(!animate);

  useEffect(function () {
    if (introDone.current) { setValue(target); return; }
    let raf = 0, t0 = 0;
    const dur = 900;
    function step(now) {
      if (!t0) t0 = now;
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 2);
      setValue(Math.round(target * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else introDone.current = true;
    }
    raf = requestAnimationFrame(step);
    return function () { cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}
