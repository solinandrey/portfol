export interface ProjectItem {
  name: string;
  link: string;
  image?: string;
  description: string;
  tags?: string[];
  fullDesc?: string;
  video?: string;
}

export interface CompanyItem extends ProjectItem {
  year: string;
}