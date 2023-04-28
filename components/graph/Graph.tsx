import styles from "./Graph.module.scss";
import dynamic from "next/dynamic";
import React, { useEffect, useRef, useState } from "react";
import ui from "@store/ui";
import { observer } from "mobx-react-lite";
const Sketch = dynamic(() => import("react-p5").then((mod) => mod.default), {
  ssr: false,
});


let t = 0;

const Graph = observer(({ parent }: { parent: Element | null }) => {
  const p5Ref = useRef(null);
  const [colorRev, setColorRev] = useState(false);

  useEffect(() => {
    if (ui.activePage === 'about me' || ui.activePage === 'projects') {
      setColorRev(true);
    } else {
      setColorRev(false);
    }
  }, [ui.activePage])

  const setup = (p5: any, canvasParentRef: Element | null) => {
    if (p5Ref.current) (p5Ref.current as any).remove();

    window.addEventListener('resize', () => {
      
    });
    p5.createCanvas(
      window.innerWidth,
      window.innerHeight
    ).parent(canvasParentRef);
    p5Ref.current = p5; 
    p5.noStroke();
    p5.fill(170, 170, 170);
  };

  const draw = (p5: any) => {
    const bgColor = colorRev ? 0 : 255;

    p5.background(bgColor, 120); // translucent background (creates trails)

    // make a x and y grid of ellipses
    for (let x = 0; x <= p5.width; x = x + 30) {
      for (let y = 0; y <= p5.height; y = y + 30) {
        // starting point of each circle depends on mouse position
        const xAngle = p5.map(
          ui.cursorPoint.x * 0.1,
          0,
          p5.width / 2,
          -0.1 * p5.PI,
          20 * p5.PI,
          true
        );
        const yAngle = p5.map(
          ui.cursorPoint.y * 0.1,
          0,
          p5.height / 2,
          -0.1 * p5.PI,
          20 * p5.PI,
          true
        );
        // and also varies based on the particle's location
        const angle = xAngle * (x / p5.width) + yAngle * (y / p5.height);

        // each particle moves in a circle
        const myX = x + 10 * p5.cos(0.5 * p5.PI * t + angle);
        const myY = y + 10 * p5.sin(0.5 * p5.PI * t + angle);

        p5.ellipse(myX, myY, 2); // draw particle
      }
    }

    t = t + 0.01;
  };

  function windowResized(p5: any){
    p5.resizeCanvas(window.innerWidth, window.innerHeight);
  }

  return <Sketch setup={setup} draw={draw} windowResized={windowResized}/>;
});

export default React.memo(Graph);
