import ProjectsPage from "@components/projects";
import { useEffect } from "react";
import uiStore from '@store/ui';

const Projects = () => {
  useEffect(() => {
    uiStore.setActivePage('projects');
    return () => {
      uiStore.setActivePage('');
    }
  }, [])
  return <ProjectsPage />;
};

export default Projects;
