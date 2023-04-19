import styles from "./Navigation.module.scss";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

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
  const [bgHeight, setBgHeight] = useState(0);

  return (
    <div className={styles.navigation}>
      {menuList.map((item, idx) => (
        <Link
          className={`${styles.navigationItem} ${
            item.label === activePoint ? styles.active : ""
          }`}
          key={item.label}
          href={item.link}
        >
          {item.label}
        </Link>
      ))}
      <div
        className={`${styles.activeBackground} ${
          activePoint ? styles.visible : ""
        }`}
        style={{ transform: `translateY(${bgPos}px)`, height: `${bgHeight}px` }}
      ></div>
    </div>
  );
};

export default Navigation;
