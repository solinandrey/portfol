import styles from "./ProjectItem.module.scss";
import { ProjectItem } from "@interfaces/index";
import Tag from "@components/tag";

interface Props {
  project: ProjectItem;
  index: number;
}

const ProjectItem = ({ project, index }: Props) => {
  return (
    <div className={styles.project}>
      <div className={styles.index}>/{index + 1}</div>
      <div className={styles.text}>
        <div className={styles.name}>{project.name}</div>
        <div className={styles.description}>
          <div className={styles.descriptionText}>{project.description}</div>
          <div className={styles.tags}>
            {project.tags?.map((tag) => (
              <Tag tag={tag} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectItem;
