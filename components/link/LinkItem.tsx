import Image, { StaticImageData } from "next/image";
import styles from "./LinkItem.module.scss";
import ui from "@store/ui";

interface Props {
  image: string | StaticImageData;
  link: string;
}

const LinkItem = ({ image, link }: Props) => {
  const onHover = (mode: boolean) => {
    ui.setCursorHoverMode(mode);
  };
  return (
    <a
      href={link}
      target="_blank"
      className={styles.link}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <Image src={image} alt={link}></Image>
    </a>
  );
};

export default LinkItem;
