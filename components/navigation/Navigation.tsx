import styles from "./Navigation.module.scss";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import uiStore from '@store/ui';
import { observer } from "mobx-react-lite";

const menuList = [
  {
    label: "home",
    link: "/",
  },
  {
    label: "projects",
    link: "/projects",
  },
  {
    label: "experience",
    link: "/experience",
  },
  {
    label: "about me",
    link: "/about",
  },
];

const Navigation = () => {

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
    </div>
  );
};

export default observer(Navigation);
