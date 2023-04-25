import styles from "./Tag.module.scss";

interface Props {
  tag: string;
  noHover?: boolean;
}

const Tag = ({ tag, noHover }: Props) => {
  return (
    <div className={`${styles.tag} ${noHover ? styles.noHover : ""}`}>
      {tag}
    </div>
  );
};

export default Tag;
