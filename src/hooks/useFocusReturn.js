/* ============================================================
   焦点移入 / 归还（C10）
   ----------------------------------------------------------
   一个浮层打开时，键盘用户的第一件事应该是「进到这个浮层里」。
   原来抽屉打开后焦点还留在地图上，按 Tab 会继续走顶栏与底栏的控件，
   读屏也完全不知道右边多了一块内容。

   这个 hook 做两件事：
     · 打开时把焦点移进容器（容器本身，不是关闭钮 —— 焦点落在关闭钮上，
       读屏会先念「关闭 按钮」，反而盖过了「这是哪首诗」）
     · 关闭时把焦点还给打开它的那个元素

   刻意**不做**焦点陷阱：抽屉与索引面板是「侧栏」不是模态框，
   用户完全可能想跳回搜索框或地图。真正的模态（命令面板 / 速查卡）
   靠 background 的 inert 来关，那是另一件事（见 App.jsx）。
   ============================================================ */
import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled])",
  "select:not([disabled])", "textarea:not([disabled])", '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useFocusReturn(open, ref, opts) {
  const prev = useRef(null);
  const delay = (opts && opts.delay) || 40;

  useEffect(function () {
    if (!open) return;

    /* 记下「谁打开的」——必须在移入焦点之前记 */
    const from = document.activeElement;
    prev.current = from && from !== document.body ? from : null;

    const t = setTimeout(function () {
      const el = ref.current;
      if (!el) return;
      /* 容器自己能接焦点就落在容器上（读屏会念 aria-label），
         接不了才退而求其次找第一个可聚焦子元素 */
      if (el.hasAttribute("tabindex")) {
        el.focus({ preventScroll: true });
      } else {
        const first = el.querySelector(FOCUSABLE);
        if (first) first.focus({ preventScroll: true });
      }
    }, delay);

    return function () {
      clearTimeout(t);
      const el = ref.current;
      const back = prev.current;

      /* isConnected：打开它的那个按钮可能已经随浮层一起卸载了
         （典型路径：命令面板里点「随机读一首」→ 面板卸载 → 抽屉打开）。 */
      if (back && back.isConnected && typeof back.focus === "function") {
        back.focus({ preventScroll: true });
        prev.current = null;
        return;
      }

      /* 没有可归还的目标，而焦点还留在**已经滑出屏幕**的容器里——
         必须把它请出来。否则下一次 Tab 会从一个看不见的元素开始，
         键盘用户会以为「焦点丢了」。（实测：关抽屉后 activeElement
         仍停在 transform: translateX(102%) 的 #detail 上。） */
      if (el && el.contains(document.activeElement)) {
        if (typeof document.activeElement.blur === "function") document.activeElement.blur();
      }
      prev.current = null;
    };
  }, [open, ref, delay]);
}
