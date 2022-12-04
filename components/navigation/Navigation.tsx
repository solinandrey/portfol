import styles from "./Navigation.module.scss";
import { useState, useRef } from "react";

const menuList = [
  {
    label: "projects",
    link: "/projects",
  },
  {
    label: "tech stack",
    link: "/stack",
  },
  {
    label: "experience",
    link: "/experience",
  },
  {
    label: "contacts",
    link: "/contacts",
  },
  {
    label: "about me",
    link: "/about",
  },
];

const Navigation = () => {
  const [activePoint, setActivePoint] = useState("");
  const [bgPos, setBgPos] = useState(0);

  const activeBg = useRef();
  const itemEls = useRef({});

  const setActiveMenuPoint = (name: string, idx: number | null) => {
    setActivePoint(name);
    if (idx || idx === 0)
      setBgPos(itemEls.current[idx].getBoundingClientRect().top - 10);
  };

  return (
    <div className={styles.navigation}>
      {menuList.map((item, idx) => (
        <div
          className={`${styles.navigationItem} ${
            item.label === activePoint ? styles.active : ""
          }`}
          key={item.label}
          onMouseEnter={() => setActiveMenuPoint(item.label, idx)}
          onMouseLeave={() => setActiveMenuPoint("", null)}
          ref={(element) => (itemEls.current[idx] = element)}
        >
          {item.label}
        </div>
      ))}
      <div
        ref={activeBg}
        className={`${styles.activeBackground} ${activePoint ? styles.visible : ''}`}
        style={{ transform: `translateY(${bgPos}px)` }}
      ></div>
    </div>
  );
};

export default Navigation;
