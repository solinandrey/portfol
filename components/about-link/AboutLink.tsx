import styles from "./AboutLink.module.scss";
import me from "@images/me.jpg";
import Image from "next/image";
import ui from "@store/ui";
import Link from "next/link";

const AboutLink = () => {
  const onHover = (mode: boolean) => {
    ui.setCursorHoverMode(mode);
  };
  return (
    <Link
      href='/about'
      className={styles.aboutLink}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
        <Image src={me} alt="it's me" />
    </Link>
  );
};

export default AboutLink;
