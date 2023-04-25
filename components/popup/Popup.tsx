import { ReactNode } from "react";
import styles from "./Popup.module.scss";

interface Props {
  children: ReactNode;
}
const Popup = ({ children }: Props) => {
  return <div className={styles.popup}>
    <div className={styles.close}></div>
    <div className={styles.body}>{children}</div>
    </div>;
};

export default Popup;
