import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/router";
import { observer } from "mobx-react-lite";

import styles from "./Layout.module.scss";
import Navigation from "../navigation/Navigation";
import ui from "@store/ui";
import Graph from "@components/graph";
import AboutLink from "@components/about-link";
import Switcher from "@components/switcher";
import { switcherLinks } from "@content/index";

let x = 50;
let y = 50;

interface TransitionParams {
  initial: {};
  animate: {};
  exit: {};
}
export default observer(function Layout({ children }: any) {
  const [loaded, setLoaded] = useState(false);
  const [switcherActive, setSwitcherActive] = useState(false);
  const [mobileSwitcherActive, setMobileSwitcherActive] = useState(false);

  const scrollerRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (window.innerWidth < 800) ui.setIsMobile(true);
    setTimeout(() => {
      setLoaded(true);
    }, 200);
  }, []);
  useEffect(() => {
    window.addEventListener("wheel", switcherAppear);
    return () => {
      window.removeEventListener("wheel", switcherAppear);
    };
  }, []);
  useEffect(() => {
    // Обработчик события свайпа
    const handleSwipe = (event: TouchEvent) => {
      const deltaY = event.touches[0].clientY - startY;
      if (deltaY > 50) {
        // Свайп вниз
        setMobileSwitcherActive(false);
      } else if (deltaY < -50) {
        // Свайп вверх
        setMobileSwitcherActive(true);
      }
    };

    // Переменные для отслеживания начальной точки касания
    let startY = 0;

    // Добавление обработчика события свайпа
    window.addEventListener("touchstart", (event) => {
      startY = event.touches[0].clientY;
    });

    window.addEventListener("touchmove", handleSwipe);

    return () => {
      window.removeEventListener("touchstart", (event) => {
        startY = event.touches[0].clientY;
      });
      window.removeEventListener("touchmove", handleSwipe);
    };
  }, []);

  const switcherAppear = (ev: WheelEvent) => {
    const gotBottom =
      (scrollerRef.current as any).scrollTop + window.innerHeight >=
      (scrollerRef.current as any)?.scrollHeight;
    setSwitcherActive(gotBottom && ev.deltaY > 0);
  };

  const p5Canvas = useRef(null);
  let transitionAnimation: TransitionParams = {
    initial: {},
    animate: {},
    exit: {},
  };

  const switcherContentFormer = () => {
    return switcherLinks.find((item) => item.path === router.pathname);
  };

  const defaultTransition = ui.isMobile
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { y: "100vh" },
        animate: { y: 0 },
        exit: { y: "-100vh", opacity: 0 },
      };

  const aboutTransition = {
    initial: { x: 1000, opacity: 0, scale: 1 },
    animate: { x: 0, opacity: 1, scale: 1 },
    exit: { x: 1000, opacity: 0, scale: 1 },
  };

  if (router.pathname === "/about" && !ui.isMobile) {
    transitionAnimation = aboutTransition;
  } else {
    transitionAnimation = defaultTransition;
  }

  return (
    <div
      className={`${styles.mainLayout} ${!loaded ? styles.notLoaded : ""} ${
        router.pathname === "/" ? styles.home : ""
      } ${mobileSwitcherActive ? styles.mobileSwitcherActive : ""}`}
    >
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
          duration: 1.8,
        }}
      >
        <main className={styles.leftSide} ref={scrollerRef}>
          {children}
        </main>
      </motion.div>
      <div className={styles.rightSide}>
        <div className={styles.rightTop}>
          <Navigation />
        </div>
        <div className={styles.rightBottom}>
          <a
            className={`${styles.email} ${
              router.pathname !== "/" ? styles.hidden : ""
            }`}
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
          <div
            className={`${styles.switcher} ${
              switcherActive ? styles.active : ""
            }`}
            onClick={() => {setSwitcherActive(false); setMobileSwitcherActive(false);}}
          >
            <Switcher
              label={switcherContentFormer()?.label || ""}
              link={switcherContentFormer()?.link || "/"}
              switcherActive={switcherActive || mobileSwitcherActive}
              white={switcherContentFormer()?.white || false}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
