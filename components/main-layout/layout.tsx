import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/router";

import styles from "./Layout.module.scss";
import Navigation from "../navigation/Navigation";
import ui from "@store/ui";
import Graph from "@components/graph";
import AboutLink from "@components/about-link";

let x = 50;
let y = 50;

interface TransitionParams {
  initial: {};
  animate: {};
  exit: {};
}
export default function Layout({ children }: any) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 800) setIsMobile(true);
  }, []);
  const router = useRouter();

  const p5Canvas = useRef(null);
  let transitionAnimation: TransitionParams = {
    initial: {},
    animate: {},
    exit: {},
  };

  const defaultTransition = {
    initial: { y: -30, opacity: 0, scale: 1.5 },
    animate: { y: 0, opacity: 1, scale: 1 },
    exit: { y: 30, opacity: 0, scale: 1.5 },
  };

  const aboutTransition = {
    initial: { x: 1000, opacity: 0, scale: 1 },
    animate: { x: 0, opacity: 1, scale: 1 },
    exit: { x: 1000, opacity: 0, scale: 1 },
  };

  if (router.pathname === "/about") {
    transitionAnimation = aboutTransition;
  } else {
    transitionAnimation = defaultTransition;
  }

  return (
    <div className={styles.mainLayout}>
      <div
          className={styles.canvasContainer}
          id="canvas-container"
          ref={p5Canvas}
        >
          <Graph parent={p5Canvas.current} />
        </div>
      <motion.div
        initial={transitionAnimation.initial}
        animate={transitionAnimation.animate}
        exit={transitionAnimation.exit}
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
          <a
            className={styles.email}
            href="mailto:solinandrey@gmail.com"
            onMouseEnter={() => {
              ui.setCursorHoverMode(true);
            }}
            onMouseLeave={() => {
              ui.setCursorHoverMode(false);
            }}
            target="_blank"
          >
            solinandrey@gmail.com
          </a>
          <div
            className={`${styles.aboutLink} ${
              router.pathname === "/about" ? styles.hidden : ""
            }`}
          >
            <AboutLink />
          </div>
        </div>
      </div>
    </div>
  );
}
