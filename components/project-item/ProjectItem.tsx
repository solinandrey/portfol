import styles from "./ProjectItem.module.scss";
import { ProjectItem } from "@interfaces/index";
import Tag from "@components/tag";
import { useEffect, useRef, useState } from "react";
import AnimateHeight from "react-animate-height";

interface Props {
  project: ProjectItem;
  index: number;
  hidden?: boolean;
  toggleProject: (idx: number | null) => void;
}

const ProjectItem = ({ project, index, hidden, toggleProject }: Props) => {
  const [opened, setOpened] = useState(false);

  const toggleFullDesc = (idx: number | null) => {
    setOpened(!opened);
    toggleProject(idx);
  };

  const borderSvg = (
    <svg width="102%" height="120%" className={styles.border}>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="none"
        stroke="black"
        strokeWidth="2"
      />
    </svg>
  );

  return (
    <div
      className={`${styles.project} ${hidden ? styles.hidden : ""} ${
        opened ? styles.opened : ""
      }`}
    >
      <div
        className={styles.projectShort}
        onClick={() => {
          toggleFullDesc(opened ? null : index);
        }}
      >
        <div className={styles.index}>/{index}</div>
        <div className={styles.text}>
          <div className={styles.name}>{project.name}</div>
          <div className={styles.description}>
            <div className={styles.descriptionText}>{project.description}</div>
            {!opened && (
              <div className={styles.tags}>
                {project.tags?.map((tag) => (
                  <Tag tag={tag} noHover/>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {!opened && borderSvg}

      <div
        className={styles.closeTag}
        onClick={() => {
          toggleFullDesc(null);
        }}
      >
        <Tag tag={"close"} />
      </div>

      <AnimateHeight
        duration={500}
        height={project.fullDesc && opened ? "auto" : 0}
      >
        <div className={styles.projectFull}>
          <div
            className={styles.fullDesc}
            dangerouslySetInnerHTML={{ __html: project.fullDesc || "" }}
          ></div>
        </div>
      </AnimateHeight>
    </div>
  );
};

export default ProjectItem;
