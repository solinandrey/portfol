import styles from "./Tag.module.scss";

interface Props {
  tag: string;
}

const Tag = ({ tag }: Props) => {
  return <div className={styles.tag}>{tag}</div>;
};

export default Tag;
