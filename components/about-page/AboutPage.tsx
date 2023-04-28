import { useEffect } from "react";
import styles from "./AboutPage.module.scss";
import ui from "@store/ui";
import me from "@images/IMG_6583.png";
import Image from "next/image";

const AboutPage = () => {
  useEffect(() => {
    ui.setActivePage("about me");

    return () => {
      ui.setActivePage("");
    };
  }, []);
  return (
    <div className={styles.about}>
      <div className={styles.title}>About me</div>
      <div className={styles.body}>
        <div className={styles.image}>
          <Image src={me} alt="me" />
        </div>
        <div className={styles.text}>
          I'm Andrey and I develop interfaces, shoot film photos, listen music
          and play tennis
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
