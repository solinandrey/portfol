import LinkedIn from "@images/linkedin.png";
import Instagram from "@images/instagram.png";
import Telegram from "@images/telegram.png";
import Fleet from "@images/fleet.png";
import Rasu from "@images/rasu.jpg";
import Drigmatic from "@images/drigmatic.jpg"
import {IconFileCv} from "@tabler/icons-react";

export const projects = [
  {
    name: "Fleet",
    link: "https://fleet.city-mobil.ru/",
    description: "Fleet helps to control processes of taxi stations",
    image: Fleet.src,
    tags: ["React", "MobX", "styled-components", "Angular", "TypeScript"],
    fullDesc: `<div>
    <p>Product I was working on during my time in <a href="https://vk.company/en/" target="_blank">VK</a>
    <p>I was working in a team of 5 devs (3 backend and 2 frontend), 2 QA, one product designer and product manager. We were making product called Fleet.</p>
    <div>Fleet helps to control processes of taxi stations, such as collecting different reports about rides, working with drivers and other information connected with taxi stations</div>
    <p>We had classic SCRUM planning, two week sprints, regular Retro meetings every week, daily meetings and all in all were always been in touch. These measures helped us to be sure everybody knows in which direction the product is going and everybody could contribute to the product development. It was cool.</p> 
    <br/>
    <br/>
    <div>Speaking about my duties:</div>
    <ul>
      <li>Developing new product features with React + MobX</li>
      <li>Сomplexity assessment of tasks and plannig future sprints</li>
      <li>Refactoring legacy code (transferring from Angular to React)</li>
      <li>Working with design team</li>
      <li>Working with QA team</li>
      <li>Working with data visualization in different formats (tables, graphs, charts)</li>
      <li>Working with forms</li>
    </ul>
    <br/>
    <br/>
    <br/>
  </div>`,
  },
  {
    name: "ROSATOM AUTOMATED CONTROL SYSTEMS",
    link: "https://www.rasu.ru/en/",
    description: "Informational website for RASU about nuclear power stations",
    image: Rasu.src,
    tags: ["Vue JS", "Nuxt JS", "Stylus", "Lottie", "TypeScript", "p5"],
    fullDesc: `<p>Informational website for RASU about nuclear power stations</p>
    <p>Navigation of website is made through animated posters, every page has its own unique design</p>
    <p>Scrolling on main page change active poster</p>
    <p>Clicking on the poster seamlessly takes you to detailed page of project</p>
    <p>Posters were made in Adobe After Effects by designers. We were also testing their performance for a numerous number of times, trying to make them light as possible in terms of rendering</p>
    <p>On detailed pages you can find interactive grpahics in right top corner. It was made with p5 library and interacts with user actions on page such as scrolling or moving cursor</p>
    <p>As a framework we used Nuxt JS</p>
    <p>Project was made during my great times in <a href="https://beta.agency" target="_blank">Beta Agency</a></p>`,
  },
  {
    name: "Absolut Insurance",
    link: "https://www.absolutins.ru/",     description: "Website for insurance company Absolut",
    image: "",
    video: "https://player.vimeo.com/video/766458572?h=ee71c4bd8f&title=0&byline=0&portrait=0",
    tags: ["Vue JS", "Nuxt JS", "Stylus", "GSAP", "TypeScript", "Lottie"],
    fullDesc: `
    <p>On this project I was leading frontend team of 5 devs</p>
    <p>We had really tiny amount of time to complete the project, which had to have not ordinary design with animations and at the same time product functions because they sell insurance products online</p>
    <p>I managed to allocate responsibilities in a proper way to finish the project despite lack of time</p>
    </p>We've created our own form builder to complete all pages with forms much quicker, which helped us to decrease amount of time for this part of website</p>
    <p>Also we optimized all animations we used through profiling and finding all bottle-neck places of code. For example, animations on cards were made with Lottie JS and all of them are controlled by user location on the page</p>
    <p>Card animations were made in Adobe After Effects by designers and implemented with Lottie JS. We were also testing their performance for a numerous number of times, trying to make them light as possible in terms of rendering</p>
    <p>Menu opening and closing animations were made with GSAP</p>
    <p>Website also has admin panel from which data is collected through REST API</p>
    <p>Nuxt JS was picked as framework</p>
    <p>Project was made during my great times in <a href="https://beta.agency" target="_blank">Beta Agency</a></p>
    `
  },
  {
    name: "SIBUR DIGITAL",
    link: "https://sibur.digital/",
    description: "Digital magazine about digitalization of oil refineries",
    image: "",
    tags: ["Vue JS", "Nuxt JS", "Stylus", "GSAP", "TypeScript"],
    fullDesc: `<div>
    <p>This project was my first project in <a href="https://beta.agency" target="_blank">Beta Agency</a></p>
    <p>The main goal of the project was to create a digital magazine website about digitalization of the oil industry and all its aspects, as well as implementing modern technologies in this business sector</p>
    <p>Lots of animations mostly made with GSAP took a lot of time to optimize work on most devices</p>
    <p>Different pages of website have different types of design experiments, from dragging event cards to nonstop running texts, so it's really intersting just to surf through pages and try all of these features</p>
    <p>Website has admin panel from which data is collected through REST API</p>
    <p>Nuxt JS was picked as framework</p>
  </div>`,
    video: "https://player.vimeo.com/video/349689739?h=a688799f38&title=0",
  },
  {
    name: "DRIGMATIC",
    link: "https://drigmatic.com/",
    description: "Gaming community website",
    image: Drigmatic.src,
    tags: ["Vue JS", "SCSS", "GSAP"],
    fullDesc: `<p>Project was made during my freelancing time</p>
    <p>Mostly I used Vue on this project</p><p>Color reverse effect was made by using mix-blend-mode property</p><p>Horizontal scrolling effect in a middle of main page was made with GSAP plugin</p>
    <p>Hearts in top right corner tracks scroll progress</p>
    <p>Also used Intersection Observer for footer animation with interacts with scrolling</p>`
  },
];

export const companies = [
  {
    name: "citymobil",
    link: "https://city-mobil.ru/",
    description: "Taxi aggregator",
    image: "",
    tags: ["React", "TypeScript", "MobX", "styled-components", "Storybook"],
    year: "07.2021 - 04.2022",
    fullDesc: ` <p>Taxi companies work with Citymobil using b2b software - Fleet. It helps to control processes of taxi stations, such as collecting different reports about rides, working with drivers and other information connected with taxi stations. I was working in a team of 5 devs (3 backend and 2 frontend), 2 QA, one product designer and product manager.</p>
    <p>We had classic SCRUM planning, two week sprints, regular Retro meetings every week, daily meetings and, all in all, had always been in touch. These measures helped us to be sure everybody knows in which direction the product is going and everybody could contribute to the product development.</p>
    <p>Duties:</p>
    <ul>
      <li>Developing new product features with React + MobX</li>
      <li>Complexity assessment of tasks and planning of future sprints</li>
      <li>Refactoring legacy code (transferring from Angular to React)</li>
      <li>Working with design team</li>
      <li>Working with QA team</li>
      <li>Working with data visualization in different formats (tables, graphs, charts)</li>
      <li>Working with forms</li>
    </ul>`,
  },
  {
    name: "beta digital",
    link: "https://beta.ru/",
    description: "digital agency",
    image: "",
    tags: ["Vue", "Nuxt", "GSAP", "TypeScript", "Stylus", "Lottie", "p5"],
    year: "06.2019 - 07.2021",
    fullDesc: `
    <p>Outsource development of websites with creative interfaces</p>
  <p>Worked with creative interfaces. Came here to the position of Junior Frontend Developer and after 1.5 years I was leading a Frontend team of 5 devs. In these two years I took part in 5 projects</p>
  <p>Thanks to these time I gained a lot of experience in creating web animations, paying attention to website performance and working on optimization of the rendering process. Usually we had a really small amount of time to complete projects (as in any digital studio), so in this tempo I also upgraded my ability to complete tasks in a short time but not forgetting about quality of code. Strict deadlines forced me to gain expertise in new technologies fast and I was rather good at it.</p>
  <p>Duties:</p>
  <ul>
    <li>Working with complicated animations using Vue JS (Nuxt JS was used where SSR was needed)</li>
    <li>Optimizing website performance in terms of rendering process</li>
    <li>Mentoring Junior Developers</li>
    <li>Working with forms</li>
    <li>Leading a Frontend team of 5 developers on the last project</li>
  </ul>`,
  },
  {
    name: "12.digital",
    link: "https://12.digital/",
    description: "digital agency",
    image: "",
    tags: ["Vue", "JQuery", "SCSS"],
    year: "01.2018 - 01.2019",
    fullDesc: ` <p>My starting point in Frontend Development. We made websites for different customers, mostly on classic HTML+JS+CSS, and several projects were made with Vue JS.</p>
    <p>This place of work taught me the basics of web development and planning of my work (because there were always several active projects at the same time).</p>
    <p>Duties:</p>
    <ul>
      <li>Working with layouts. Coding new and supporting legacy.</li>
      <li>Working directly with design team</li>
      <li>Working with backend team</li>
    </ul>`,
  },
];

export const links = [
  { link: "https://www.linkedin.com/in/andreysolin/", image: LinkedIn },
  { link: "https://www.instagram.com/solinandrey/", image: Instagram },
  { link: "https://t.me/soul_in", image: Telegram },
  // { link: "https://t.me/soul_in", image: IconFileCv },
];
