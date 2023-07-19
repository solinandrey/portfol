import styles from "./Projects.module.scss";
import ProjectItem from "@components/project-item";
import { projects } from "@content/index";
import { useState } from "react";
import Switcher from "@components/switcher";

const ProjectsPage = () => {
  const [idxOpened, setIdxOpened] = useState<number | null>(null);

  const toggleProject = (idx: number | null) => {
    setIdxOpened(idx);
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
