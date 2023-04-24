import styles from "./ProjectsBlock.module.scss";
import ProjectItem from "@components/project-item";
import { projects } from "@content/index";

const ProjectsBlock = () => {
  return (
    <div className={styles.projects}>
      {projects.map((prj, idx) => (
        <ProjectItem project={prj} key={prj.name + idx} />
      ))}
    </div>
  );
};

export default ProjectsBlock;
