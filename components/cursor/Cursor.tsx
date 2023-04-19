import styles from "./Cursor.module.scss";
import { useEffect, useState } from "react";

const Cursor = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    window.addEventListener("mousemove", cursorPositioner);
    return () => window.removeEventListener("mousemove", cursorPositioner);
  }, []);

  const cursorPositioner = (event: MouseEvent) => {
    setPosition({ x: event.clientX, y: event.clientY });
  };

  return (
    <div
      className={styles.cursor}
      style={{ transform: `translate(${position.x}px,${position.y}px)` }}
    ></div>
  );
};

export default Cursor;
