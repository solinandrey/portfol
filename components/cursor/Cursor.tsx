import styles from "./Cursor.module.scss";
import { useEffect, useState } from "react";
import ui from "@store/ui";

const Cursor = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    window.addEventListener("mousemove", cursorPositioner);
    return () => window.removeEventListener("mousemove", cursorPositioner);
  }, []);

  const cursorPositioner = (event: MouseEvent) => {
    setPosition({ x: event.clientX, y: event.clientY });
    ui.setCursorPoint({ x: event.clientX, y: event.clientY });
  };

  return (
    <div
      className={`${styles.cursor} ${
        ui.cursorHoverMode ? styles.hoverMode : ""
      }`}
      style={{ transform: `translate(${position.x}px,${position.y}px)` }}
    >
      <div className={styles.cursorFig}></div>
    </div>
  );
};

export default Cursor;
