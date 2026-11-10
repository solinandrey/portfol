import { build } from "@/lib/dots-build";

// Фоновый поток: собирает все предметы и отдаёт готовые массивы без копирования.

const scope = self as unknown as {
  onmessage: (e: MessageEvent<{ buffer: ArrayBuffer; count: number; cols: number }>) => void;
  postMessage: (message: unknown, transfer: Transferable[]) => void;
};

scope.onmessage = (e) => {
  const built = build(e.data.buffer, e.data.count, e.data.cols);
  scope.postMessage(built, [built.pos.buffer, built.motion.buffer, built.lum.buffer]);
};
