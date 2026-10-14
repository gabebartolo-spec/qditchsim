import * as THREE from 'three';

// True isometric angle: 45 degrees around the vertical axis, then tilted down by
// atan(1 / sqrt(2)), about 35.26 degrees.
const ISO_TILT = Math.atan(1 / Math.SQRT2);

/**
 * A fixed orthographic camera looking at `target` from the isometric angle.
 * `viewHeight` is how many world units fit vertically on screen.
 */
export function createIsoCamera(
  viewHeight: number,
  aspect: number,
  target = new THREE.Vector3(0, 0, 0),
  distance = 200,
): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, distance * 4);
  camera.userData.viewHeight = viewHeight;
  resizeIsoCamera(camera, aspect);

  const horizontal = distance * Math.cos(ISO_TILT);
  camera.position.set(
    target.x + horizontal * Math.sin(Math.PI / 4),
    target.y + distance * Math.sin(ISO_TILT),
    target.z + horizontal * Math.cos(Math.PI / 4),
  );
  camera.lookAt(target);
  return camera;
}

export function resizeIsoCamera(camera: THREE.OrthographicCamera, aspect: number): void {
  const halfH = (camera.userData.viewHeight as number) / 2;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.left = -halfH * aspect;
  camera.right = halfH * aspect;
  camera.updateProjectionMatrix();
}
