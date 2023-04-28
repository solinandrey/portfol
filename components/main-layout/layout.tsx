import { useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/router";

import styles from "./Layout.module.scss";
import Navigation from "../navigation/Navigation";
import ui from "@store/ui";
import Graph from "@components/graph";

let x = 50;
let y = 50;
export default function Layout({ children }: any) {
  const router = useRouter();

  const p5Canvas = useRef(null);

  return (
    <div className={styles.mainLayout}>
      <motion.div
        initial={{ y: -30, opacity: 0, scale: 1.5 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 1.5 }}
        key={router.asPath}
        style={{ zIndex: 1 }}
        transition={{
          type: "spring",
          duration: 0.8,
        }}
      >
        <main className={styles.leftSide}>{children}</main>
      </motion.div>
      <div className={styles.rightSide}>
        <div className={styles.rightTop}>
          <Navigation />
        </div>
        <div className={styles.rightBottom}>
          <div
            className={styles.canvasContainer}
            id="canvas-container"
            ref={p5Canvas}
          >
            <Graph parent={p5Canvas.current} />
            <a
              className={styles.email}
              href="mailto:solinandrey@gmail.com"
              onMouseEnter={() => {
                ui.setCursorHoverMode(true);
              }}
              onMouseLeave={() => {
                ui.setCursorHoverMode(false);
              }}
            >
              solinandrey@gmail.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
