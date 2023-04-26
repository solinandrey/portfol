import styles from "./Projects.module.scss";
import ProjectItem from "@components/project-item";
import Popup from "@components/popup";
import { projects } from "@content/index";
import { useState } from "react";

const ProjectsPage = () => {
  const [idxOpened, setIdxOpened] = useState<number | null>(null);

  const toggleProject = (idx: number | null) => {
    setIdxOpened(idx);
    console.log(idx, 'idx')
  };

  return (
    <div className={styles.projects}>
      {projects.map((item, idx) => (
        <ProjectItem
          toggleProject={toggleProject}
          project={item}
          index={idx + 1}
          key={idx + item.name}
          hidden={!!idxOpened && (idx + 1) !== idxOpened}
        />
      ))}
    </div>
  );
};

export default ProjectsPage;
