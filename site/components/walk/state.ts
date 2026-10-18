import * as THREE from "three";

// Общее состояние между DOM и сценой. Меняется каждый кадр, поэтому не в React-стейте.
export const walkState = {
  /** прогресс прокрутки страницы, 0..1 */
  progress: 0,
  /** курсор в NDC */
  pointer: new THREE.Vector2(),
  pointerActive: 0,
  /** сглаженный номер этапа с дробной частью, пишет сцена, читает полоса прогресса */
  stage: 0,
};
