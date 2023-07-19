import { useRouter } from "next/router";
import styles from "./Switcher.module.scss";
import { useRef, useEffect, useState, RefObject } from "react";
import Link from "next/link";

interface IProps {
  label: string;
  link: string;
  ref?: RefObject<any>;
  white?: boolean;
  switcherActive: boolean;
}

const Switcher = ({ label, link, ref, white, switcherActive }: IProps) => {

  return (
    <div
      className={`${styles.switcher} ${switcherActive ? styles.active : ""} ${
        white ? styles.white : ""
      }`}
    >
      {[0, 1, 2, 3].map((border, idx) => {
        return (
          <div
            className={`${styles.border}`}
            style={{ animationDelay: `${idx * 0.1}s` }}
            key={`border${idx}`}
          ></div>
        );
      })}
      <Link className={styles.switcherText} href={link}>
        {label}
      </Link>
    </div>
  );
};

export default Switcher;
