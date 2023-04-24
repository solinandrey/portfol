import styles from "./Projects.module.scss";
import ProjectItem from "@components/project-item";
import { projects } from "@content/index";

const ProjectsPage = () => {
  return <div className="projects">
    {/* <div className={styles.projectsTitle}>Projects</div> */}
    {projects.map((item, idx) => <ProjectItem project={item} index={idx} key={idx}/>)}
  </div>;
};

export default ProjectsPage;
