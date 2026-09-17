/* ============================================================
   轻提示：由 store.toast 驱动（{ msg, at, ms }）
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { useStore } from "../store.js";

export default function Toast() {
  const toast = useStore("toast");
  const [text, setText] = useState("");
  const [hidden, setHidden] = useState(true);
  const [on, setOn] = useState(false);
  const timers = useRef([]);

  useEffect(function () {
    if (!toast) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    setText(toast.msg);
    setHidden(false);
    setOn(false);

    const raf = requestAnimationFrame(function () { setOn(true); });
    const t1 = setTimeout(function () {
      setOn(false);
      const t2 = setTimeout(function () { setHidden(true); }, 320);
      timers.current.push(t2);
    }, toast.ms || 2200);
    timers.current.push(t1);

    return function () {
      cancelAnimationFrame(raf);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [toast]);

  return (
    <div id="toast" className={"toast" + (on ? " on" : "")} hidden={hidden}>
      {text}
    </div>
  );
}
