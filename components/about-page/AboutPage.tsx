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
      {/* <div className={styles.title}>About me</div> */}
      <div className={styles.body}>
        <div className={styles.image}>
          <Image src={me} alt="me" />
        </div>
        <div className={styles.text}>
          <p>
            I'm Andrey and I develop interfaces, shoot film photos, listen music
            and play tennis and football
          </p>
          <br />
          Throughout my career, I have worked in different projects, most of them connected with complicated interfaces and animations, but I also have experience of product development in a big company.
          <br/>
          <br/>
          My main stack right now is React + MobX + SCSS, but I also worked with Vue for a couple of years. Anyway, I'm always ready to learn new technologies as well as to upgrade my skills with known stack. 
          <br />
          <br />
          I'm open for full-time job opportunities and for contract-based projects
          <br />
          <br />
          <p>
            If you are interested to work with me, you can reach me out on{" "}
            <a href="https://t.me/soul_in" target="_blank">
              telegram
            </a>{" "}
            or just{" "}
            <a href="mailto:solinandrey@gmail.com" target="_blank">
              email
            </a>{" "}
            me
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
