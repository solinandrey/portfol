import styles from "./Tag.module.scss";
import {IconLink} from '@tabler/icons-react';

interface Props {
  tag: string;
  noHover?: boolean;
  bigFont?: boolean;
  isLink?: boolean;
}

const Tag = ({ tag, noHover, bigFont, isLink }: Props) => {
  return (
    <div
      className={`${styles.tag} ${noHover ? styles.noHover : ""} ${
        bigFont ? styles.bigFont : ""
      }`}
    >
      <div className={styles.text}>{tag}</div>
      {isLink && <IconLink className={styles.link} />}
    </div>
  );
};

export default Tag;
