import { makeAutoObservable } from "mobx"

export class UIStore {
  projectOpened = false;

  constructor() {
    makeAutoObservable(this);
  }

  toggleProject() {
    this.projectOpened = !this.projectOpened
  }
}