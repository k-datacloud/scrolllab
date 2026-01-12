import { gsap } from "gsap";
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  PlaneGeometry,
  ShaderMaterial,
  TextureLoader,
  Mesh,
} from "three";
import vertexShader from "../shaders/vertex.glsl?raw";
import fragmentShader from "../shaders/fragment.glsl?raw";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

const mainScript = () => {
  const runLenis = () => {
    const lenis = new Lenis({
      autoRaf: true,
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easing equation
      smoothWheel: true,
      smoothTouch: false,
    });
  };
  runLenis();
  const header = document.querySelector(".header");
  const headerNav = header.querySelector(".header__nav");
  const headerTitle = document.querySelector(".header__title");
  const openingAnimation = () => {
    const text = headerTitle.querySelector(".text-wrapper").textContent;
    const letter = text.trim().split("");
    headerTitle.querySelector(".text-wrapper").textContent = "";
    letter.forEach((char, index) => {
      const span = document.createElement("span");
      span.textContent = char;
      span.classList.add("header__title-char");
      headerTitle.querySelector(".text-wrapper").appendChild(span);
    });
    const char = document.querySelectorAll(".header__title-char");
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px)", () => {
      gsap.set(char, {
        yPercent: 100,
        opacity: 0,
        fontSize: "96px",
      });
    });
    mm.add("(max-width: 1023px)", () => {
      gsap.set(char, {
        yPercent: 100,
        opacity: 0,
        fontSize: "48px",
      });
    });

    gsap.set(headerTitle, {
      x: window.innerWidth - headerTitle.offsetWidth - 80,
      y: window.innerHeight - headerTitle.offsetHeight,
    });

    gsap.set(headerNav, {
      opacity: 0,
    });

    const timeline = gsap.timeline();
    timeline
      .to(char, {
        yPercent: 0,
        opacity: 1,
        duration: 0.7,
        ease: "power2.out",
        stagger: {
          each: 0.1,
        },
      })
      .to(
        {},
        {
          duration: 1,
        }
      )
      .to(headerTitle, {
        x: 0,
        y: 0,
        duration: 4,
        ease: "power2.out",
      })
      .to(
        char,
        {
          fontSize: "16px",
          duration: 4,
          ease: "power2.out",
        },
        "<"
      )
      .to(
        headerNav,
        {
          opacity: 1,
          duration: 1,
          ease: "power2.out",
        },
        "-=2"
      );
  };
  // openingAnimation();

  // スクロール追従
  let targetScrollY = 0; // 本来のスクロール位置
  let currentScrollY = 0; // 線形補間を適用した現在のスクロール位置
  let scrollOffset = 0; // 上記2つの差分

  // 開始と終了をなめらかに補間する関数
  const lerp = (start, end, multiplier) => {
    return (1 - multiplier) * start + multiplier * end;
  };

  const updateScroll = () => {
    // スクロール位置を取得
    targetScrollY = document.documentElement.scrollTop;
    // リープ関数でスクロール位置をなめらかに追従
    currentScrollY = lerp(currentScrollY, targetScrollY, 0.1);

    scrollOffset = targetScrollY - currentScrollY;
  };

  const canvasEl = document.getElementById("webgl-canvas");
  const canvasSize = {
    w: window.innerWidth,
    h: window.innerHeight,
  };

  // リサイズ処理
  let timeoutId = 0;
  const resize = () => {
    // three.jsのリサイズ
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvasSize.w = width;
    canvasSize.h = height;

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // カメラの距離を計算し直す
    const fov = 60;
    const fovRad = (fov / 2) * (Math.PI / 180);
    const dist = canvasSize.h / 2 / Math.tan(fovRad);
    camera.position.z = dist;
  };

  const renderer = new WebGLRenderer({
    canvas: canvasEl,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvasSize.w, canvasSize.h);

  // ウィンドウとwebGLの座標を一致させるため、描画がウィンドウぴったりになるようカメラを調整
  const fov = 60; // 視野角
  const fovRad = (fov / 2) * (Math.PI / 180);
  const dist = canvasSize.h / 2 / Math.tan(fovRad);
  const camera = new PerspectiveCamera(
    fov,
    canvasSize.w / canvasSize.h,
    0.1,
    1000
  );
  camera.position.z = dist;

  const scene = new Scene();

  const loader = new TextureLoader();

  // 画像をテクスチャにしたplaneを扱うクラス
  class ImagePlane {
    constructor(mesh, img) {
      this.refImage = img;
      this.mesh = mesh;
    }

    setParams() {
      // 参照するimg要素から大きさ、位置を取得してセット
      const rect = this.refImage.getBoundingClientRect();

      this.mesh.scale.x = rect.width;
      this.mesh.scale.y = rect.height;

      const x = rect.left - canvasSize.w / 2 + rect.width / 2;
      const y = -rect.top + canvasSize.h / 2 - rect.height / 2;
      this.mesh.position.set(x, y, this.mesh.position.z);
    }

    update(offset) {
      this.setParams();

      this.mesh.material.uniforms.uTime.value = offset;
    }
  }

  // Planeメッシュを作る関数
  const createMesh = (img) => {
    const texture = loader.load(img.src);

    const uniforms = {
      uTexture: { value: texture },
      uImageAspect: { value: img.naturalWidth / img.naturalHeight },
      uPlaneAspect: { value: img.clientWidth / img.clientHeight },
      uTime: { value: 0 },
    };
    const geo = new PlaneGeometry(1, 1, 100, 100); // 後から画像のサイズにscaleするので1にしておく
    const mat = new ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });

    const mesh = new Mesh(geo, mat);

    return mesh;
  };

  const imagePlaneArray = [];

  // 毎フレーム呼び出す
  const loop = () => {
    updateScroll();
    for (const plane of imagePlaneArray) {
      plane.update(scrollOffset);
    }
    renderer.render(scene, camera);

    requestAnimationFrame(loop);
  };

  const main = () => {
    const imageArray = [...document.querySelectorAll("img")];
    for (const img of imageArray) {
      const mesh = createMesh(img);
      scene.add(mesh);

      const imagePlane = new ImagePlane(mesh, img);
      imagePlane.setParams();

      imagePlaneArray.push(imagePlane);
    }

    loop();
  };

  window.addEventListener("resize", () => {
    if (timeoutId) clearTimeout(timeoutId);

    timeoutId = setTimeout(resize, 200);
  });

  main();

  gsap.registerPlugin(ScrollTrigger);

  const scrollList = document.querySelector(".p-top-scroll__list");
  const scrollListItems = [...scrollList.querySelectorAll("li div")];
  const scrollListOverlay = scrollList.querySelectorAll(".overlay");
  console.log(scrollListItems);

  gsap.set(scrollListItems.slice(0, -1), {
    scale: 1,
    rotate: 0,
    rotateX: 0,
  });

  gsap.set(scrollListOverlay, {
    opacity: 0,
  });

  scrollListItems.slice(0, -1).forEach((el, index) => {
    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: "top top", // sticky した瞬間
        end: "+=400", // どれくらいスクロールしたら完成か
        scrub: true,
        markers: true, // デバッグ用
      },
    });
    timeline.to(el, {
      scale: 0.92,
      rotate: -5,
      rotateX: 7,
      ease: "none",
    });
  });

  // scrollListItems.forEach((el, index) => {
  //   ScrollTrigger.create({
  //     trigger: scrollList,
  //     start: "top top",
  //     end: "bottom bottom",
  //     markers: true,
  //     scrub: true,
  //     onEnter: () => {
  //       gsap.to(scrollListItems[index], {
  //         scale: 0.8,
  //         rotate: -10,
  //       });
  //     },
  //   });
  // });
};

export default mainScript;
