import styles from "./Navigation.module.scss";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import uiStore from "@store/ui";
import { observer } from "mobx-react-lite";
import { IconHome2 } from "@tabler/icons-react";

const menuList = [
  {
    label: "projects",
    link: "/projects",
  },
  {
    label: "experience",
    link: "/experience",
  },
];

const Navigation = () => {
  const nodeRef = useRef(null);
  const [showHome, setShowHome] = useState(false);

  useEffect(() => {
    setShowHome(uiStore.activePage !== "home");
  }, [uiStore.activePage]);

  return (
    <div className={styles.navigation}>
      {menuList.map((item, idx) => (
        <Link
          className={`${styles.navigationItem} ${
            item.label === uiStore.activePage ? styles.active : ""
          }`}
          key={item.label}
          href={item.link}
        >
          {item.label}
        </Link>
      ))}
      <Link
        className={`${styles.navigationItem} ${styles.navigationHome} ${
          !showHome ? styles.hidden : ""
        }`}
        key={"home"}
        href={"/"}
        ref={nodeRef}
      >
        {/* <div className="text">
          
        </div> */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="80"
          width="80"
          className={styles.homeCircle}
        >
          <circle cx="40" cy="40" r="39" fill="#ffffff" className={styles.bgHome}/>
          <path
            id="myTextPath"
            d="M12,40a28,28 0 1,0 56,0a28,28 0 1,0 -56,0"
            fill="none"
            stroke="none"
            strokeWidth="2"
          />

          <text style={{stroke: "#ffffff"}} fill="white" strokeWidth="0">
            <textPath href="#myTextPath" className={styles.homeText}>
              <tspan dy="2">back home</tspan>
            </textPath>
          </text>
        </svg>
        <IconHome2 className={styles.homeIcon}/>
      </Link>
    </div>
  );
};

export default observer(Navigation);
