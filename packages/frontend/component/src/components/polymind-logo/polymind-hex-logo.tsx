import type { SVGProps } from 'react';

/**
 * Hexagonal Polymind logo (24x24) — replaces the triangle Logo1Icon.
 * Composed of 6 equilateral triangles arranged in a pointy-top hexagon,
 * each retaining the original internal geometric pattern.
 */
export const PolymindHexLogo = (props: SVGProps<SVGSVGElement>) => {
  // Affine transform mapping the original 24x24 triangle into one hexagonal sector.
  // Maps: apex(12,3.5)→center(12,12), bottom-left(2.7,19.5)→V1, bottom-right(21.6,19.5)→V0
  // Hexagon: pointy-top, R≈9.2, center=(12,12)
  const sectorMatrix =
    'matrix(-0.4217 -0.2433 0.2530 -0.4289 16.175 16.421)';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      style={{ userSelect: 'none', flexShrink: 0 }}
      {...props}
    >
      <defs>
        <path
          id="polymind-hex-tri"
          fill="currentColor"
          d="m21.602 18.535-1.456-2.523-.497-.86-.846-1.466c-1.49-2.574-4.421-7.67-5.886-10.189-.451-.702-1.497-.647-1.885.08L9.594 6.069l-.496.859-6.409 11.1c-.09.165-.26.434-.345.611-.148.321-.119.72.068 1.017.21.351.605.543 1.007.524h3.832c4.618 0 11.672.003 13.403 0 .84.001 1.368-.92.95-1.645zm-9.94-3.273-.85-1.472a.388.388 0 0 1 .337-.583h1.7c.299 0 .485.324.335.583l-.85 1.472a.388.388 0 0 1-.672 0m-1.424-2.742a5 5 0 0 1-.18-.546l2.811.546zm1.285 3.874q-.18.226-.383.43l-.933-2.708zm2.712-3.05q.287.044.564.117l-1.88 2.162zm-4.35-2.293a7 7 0 0 1-.043-.827l3.714 1.811-3.672-.983zm-.441 2.712.983 3.67a7 7 0 0 1-.696.45zm6.24.01q.38.167.738.377l-3.425 2.311zM9.928 9.055a12 12 0 0 1 .3-1.474l5.642 4.905zm-1.25 9.34c-.47.193-.95.35-1.426.477l1.426-7.337zm8.715-3.587c.4.31.778.65 1.126.997l-7.068 2.433zm-5.147-9.984c1.04 1.805 2.55 4.422 3.99 6.913l-5.372-5.371.89-1.543c.11-.19.383-.19.492 0m-8.39 13.678c.297-.51.703-1.21.793-1.372l3.2-5.542-1.966 7.34h-1.78a.284.284 0 0 1-.246-.425m16.042.428h-7.986l7.341-1.968.89 1.542a.283.283 0 0 1-.244.426z"
        />
      </defs>
      {[0, 60, 120, 180, 240, 300].map(angle => (
        <use
          key={angle}
          href="#polymind-hex-tri"
          transform={
            angle === 0
              ? sectorMatrix
              : `rotate(${angle} 12 12) ${sectorMatrix}`
          }
        />
      ))}
    </svg>
  );
};
