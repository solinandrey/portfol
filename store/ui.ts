import { makeAutoObservable } from "mobx"

class UIStore {
  projectOpened = false;
  activePage = '';
  cursorPoint = {x: 0, y: 0};
  cursorHoverMode = false;

  constructor() {
    makeAutoObservable(this);
  }

  toggleProject() {
    this.projectOpened = !this.projectOpened
  }

  setActivePage(name: string) {
    this.activePage = name;
  }

  setCursorPoint({x, y}: {x: number, y: number}) {
    this.cursorPoint = {x, y};
  }

  setCursorHoverMode(mode: boolean) {
    this.cursorHoverMode = mode;
    console.log(mode, 'mode')
  }
}

export default new UIStore();